import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Anthropic from '@anthropic-ai/sdk';
import { ConversationHistory } from '../conversation/conversation.model';
import { SYSTEM_PROMPT } from './claude.prompts';
import { CLAUDE_TOOLS } from './claude.tools';
import { Env } from '../config/env.schema';

export interface ClaudeToolCall {
  id: string;
  name: string;
  input: Record<string, any>;
}

export interface ClaudeResponse {
  text: string | null;
  toolCalls: ClaudeToolCall[];
  stopReason: string;
}

@Injectable()
export class ClaudeService {
  private readonly logger = new Logger(ClaudeService.name);
  private readonly client: Anthropic;
  private readonly model: string;

  constructor(private readonly config: ConfigService<Env>) {
    this.client = new Anthropic({
      apiKey: this.config.get('CLAUDE_API_KEY'),
    });
    this.model = this.config.get('CLAUDE_MODEL')!;
  }

  async chat(
    history: ConversationHistory[],
    newMessage: string,
    mediaUrl?: string,
  ): Promise<ClaudeResponse> {
    const messages = this.buildMessages(history, newMessage, mediaUrl);

    this.logger.debug(
      `Calling Claude with ${messages.length} messages, model=${this.model}`,
    );

    const response: any = await (this.client.messages.create as any)({
      model: this.model,
      max_tokens: 4096,
      system: SYSTEM_PROMPT,
      tools: CLAUDE_TOOLS,
      messages,
    });

    this.logger.debug(
      `Claude response: stop_reason=${response.stop_reason}, blocks=${response.content.length}`,
    );

    return this.parseResponse(response);
  }

  async chatWithToolResult(
    history: ConversationHistory[],
    userMessage: string,
    toolCallId: string,
    toolName: string,
    toolResult: unknown,
    mediaUrl?: string,
  ): Promise<ClaudeResponse> {
    const messages = this.buildMessages(history, userMessage, mediaUrl);

    // Add assistant's previous turn (tool use) and tool result
    messages.push({
      role: 'user',
      content: [
        {
          type: 'tool_result',
          tool_use_id: toolCallId,
          content: JSON.stringify(toolResult),
        },
      ],
    } as any);

    const response: any = await (this.client.messages.create as any)({
      model: this.model,
      max_tokens: 4096,
      system: SYSTEM_PROMPT,
      tools: CLAUDE_TOOLS,
      messages,
    });

    return this.parseResponse(response);
  }

  private buildMessages(
    history: ConversationHistory[],
    newMessage: string,
    mediaUrl?: string,
  ): Anthropic.MessageParam[] {
    const messages: Anthropic.MessageParam[] = history.map((h) => ({
      role: h.role,
      content: h.content,
    }));

    if (mediaUrl) {
      messages.push({
        role: 'user',
        content: [
          { type: 'text', text: newMessage },
          {
            type: 'text',
            text: `[Adjunto multimedia: ${mediaUrl}]`,
          },
        ],
      });
    } else {
      messages.push({ role: 'user', content: newMessage });
    }

    return messages;
  }

  private parseResponse(response: any): ClaudeResponse {
    const toolCalls: ClaudeToolCall[] = [];
    let text: string | null = null;

    for (const block of response.content) {
      if (block.type === 'text') {
        text = block.text;
      } else if (block.type === 'tool_use') {
        toolCalls.push({
          id: block.id,
          name: block.name,
          input: block.input as Record<string, any>,
        });
      }
    }

    return { text, toolCalls, stopReason: response.stop_reason ?? 'end_turn' };
  }
}
