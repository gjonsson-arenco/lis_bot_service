import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { BotProcessor } from './bot.processor';

export interface IncomingMessageEvent {
  phoneNumber: string;
  text: string;
  mediaUrl?: string;
}

export const INCOMING_MESSAGE_EVENT = 'bot.message.incoming';

@Injectable()
export class BotEventListener {
  private readonly logger = new Logger(BotEventListener.name);

  constructor(private readonly processor: BotProcessor) {}

  @OnEvent(INCOMING_MESSAGE_EVENT)
  async handleIncomingMessage(event: IncomingMessageEvent): Promise<void> {
    this.logger.debug(
      `Event received: ${INCOMING_MESSAGE_EVENT} from ${event.phoneNumber}`,
    );
    await this.processor.processMessage(
      event.phoneNumber,
      event.text,
      event.mediaUrl,
    );
  }
}
