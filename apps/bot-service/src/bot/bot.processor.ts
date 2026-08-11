import { Injectable, Logger } from '@nestjs/common';
import { ClaudeService, ClaudeToolCall } from '../claude-bot/claude.service';
import { ConversationService } from '../conversation/conversation.service';
import { LisClientService } from '../lis-client/lis-client.service';
import { BotWhatsappClient } from './bot.whatsapp-client';
import { ConversationSession } from '../conversation/conversation.model';

const ERROR_MESSAGE =
  'Lo siento, ocurrió un error al procesar tu mensaje. Por favor intenta de nuevo.';

@Injectable()
export class BotProcessor {
  private readonly logger = new Logger(BotProcessor.name);

  constructor(
    private readonly claude: ClaudeService,
    private readonly conversation: ConversationService,
    private readonly lisClient: LisClientService,
    private readonly whatsapp: BotWhatsappClient,
  ) {}

  async processMessage(
    phoneNumber: string,
    text: string,
    mediaUrl?: string,
  ): Promise<void> {
    this.logger.log(`Processing message from ${phoneNumber}: "${text}"`);

    let session: ConversationSession;
    try {
      session = await this.conversation.getOrCreateSession(phoneNumber);
    } catch (error) {
      this.logger.error(`Failed to load session for ${phoneNumber}`, error);
      await this.safeNotifyUser(phoneNumber, ERROR_MESSAGE);
      return;
    }

    try {
      // Call Claude with a snapshot of conversation history
      const claudeResponse = await this.claude.chat(
        [...session.history],
        text,
        mediaUrl,
      );

      // Append user message to history
      session.history.push({
        role: 'user',
        content: text,
        timestamp: new Date(),
      });

      if (claudeResponse.toolCalls.length > 0) {
        // Execute tool calls and continue conversation
        await this.handleToolCalls(
          session,
          text,
          claudeResponse.toolCalls,
          mediaUrl,
        );
      } else {
        // Plain text response
        const responseText = claudeResponse.text ?? ERROR_MESSAGE;
        session.history.push({
          role: 'assistant',
          content: responseText,
          timestamp: new Date(),
        });

        await this.conversation.saveSession(session.sessionId, session);
        await this.whatsapp.sendMessage(phoneNumber, responseText);
      }
    } catch (error) {
      this.logger.error(
        `Error processing message for ${phoneNumber}`,
        error,
      );
      session.history.push({
        role: 'assistant',
        content: ERROR_MESSAGE,
        timestamp: new Date(),
      });
      try {
        await this.conversation.saveSession(session.sessionId, session);
      } catch (saveError) {
        this.logger.error('Failed to save error state to session', saveError);
      }
      await this.safeNotifyUser(phoneNumber, ERROR_MESSAGE);
    }
  }

  private async handleToolCalls(
    session: ConversationSession,
    userMessage: string,
    toolCalls: ClaudeToolCall[],
    mediaUrl?: string,
  ): Promise<void> {
    for (const toolCall of toolCalls) {
      this.logger.log(
        `Executing tool: ${toolCall.name} with input: ${JSON.stringify(toolCall.input)}`,
      );

      let toolResult: unknown;
      let toolError = false;

      try {
        toolResult = await this.executeToolCall(toolCall);
      } catch (error) {
        this.logger.error(`Tool ${toolCall.name} failed`, error);
        toolResult = {
          error: true,
          message: `Error al ejecutar ${toolCall.name}: ${(error as Error).message}`,
        };
        toolError = true;
      }

      // Save tool execution to metadata
      session.metadata.lastToolCall = {
        name: toolCall.name,
        input: toolCall.input,
        result: toolResult,
        error: toolError,
        timestamp: new Date().toISOString(),
      };

      // Send tool result back to Claude for final response
      try {
        const finalResponse = await this.claude.chatWithToolResult(
          [...session.history],
          userMessage,
          toolCall.id,
          toolCall.name,
          toolCall.input,
          toolResult,
          mediaUrl,
        );

        const responseText = finalResponse.text ?? ERROR_MESSAGE;
        session.history.push({
          role: 'assistant',
          content: `[Tool: ${toolCall.name}] ${responseText}`,
          timestamp: new Date(),
        });

        await this.conversation.saveSession(session.sessionId, session);
        await this.whatsapp.sendMessage(session.phoneNumber, responseText);
      } catch (error) {
        this.logger.error(
          `Failed to get Claude response after tool execution`,
          error,
        );
        const fallback = toolError
          ? `Hubo un error al ejecutar la acción "${toolCall.name}". Por favor intenta de nuevo.`
          : ERROR_MESSAGE;
        session.history.push({
          role: 'assistant',
          content: fallback,
          timestamp: new Date(),
        });
        await this.conversation.saveSession(session.sessionId, session);
        await this.safeNotifyUser(session.phoneNumber, fallback);
      }
    }
  }

  private async executeToolCall(
    toolCall: ClaudeToolCall,
  ): Promise<unknown> {
    switch (toolCall.name) {
      case 'create_order':
        return this.lisClient.createOrder(toolCall.input as any);

      case 'query_order':
        return this.lisClient.queryOrder(toolCall.input as any);

      case 'list_patient_orders':
        return this.lisClient.listPatientOrders(toolCall.input as any);

      case 'update_order_status':
        return this.lisClient.updateOrderStatus(toolCall.input as any);

      default:
        throw new Error(`Unknown tool: ${toolCall.name}`);
    }
  }

  private async safeNotifyUser(
    phoneNumber: string,
    message: string,
  ): Promise<void> {
    try {
      await this.whatsapp.sendMessage(phoneNumber, message);
    } catch (error) {
      this.logger.error(
        `Failed to send error notification to ${phoneNumber}`,
        error,
      );
    }
  }
}
