import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import {
  DeleteMessageCommand,
  ReceiveMessageCommand,
} from '@aws-sdk/client-sqs';
import { AwsClientsService } from '../config/aws-clients';
import {
  INCOMING_MESSAGE_EVENT,
  IncomingMessageEvent,
} from '../bot/bot.event-listener';
import { Env } from '../config/env.schema';

interface SqsBody {
  phoneNumber: string;
  text: string;
  mediaUrl?: string;
}

@Injectable()
export class SqsConsumerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(SqsConsumerService.name);
  private running = false;
  private readonly queueUrl: string;
  private readonly maxMessages: number;
  private readonly waitTime: number;
  private readonly visibilityTimeout: number;

  constructor(
    private readonly awsClients: AwsClientsService,
    private readonly config: ConfigService<Env>,
    private readonly eventEmitter: EventEmitter2,
  ) {
    this.queueUrl = this.config.get('SQS_QUEUE_URL')!;
    this.maxMessages = this.config.get('SQS_MAX_MESSAGES')!;
    this.waitTime = this.config.get('SQS_WAIT_TIME')!;
    this.visibilityTimeout = this.config.get('SQS_VISIBILITY_TIMEOUT')!;
  }

  async onModuleInit() {
    this.running = true;
    this.logger.log('SQS consumer starting...');
    this.poll();
  }

  async onModuleDestroy() {
    this.logger.log('SQS consumer stopping...');
    this.running = false;
  }

  private async poll(): Promise<void> {
    while (this.running) {
      try {
        await this.receiveAndProcess();
      } catch (error) {
        this.logger.error('Unhandled error in SQS poll loop', error);
        // Brief pause before retrying to avoid tight error loop
        await this.sleep(2000);
      }
    }
  }

  private async receiveAndProcess(): Promise<void> {
    const result = await this.awsClients.sqs.send(
      new ReceiveMessageCommand({
        QueueUrl: this.queueUrl,
        MaxNumberOfMessages: this.maxMessages,
        WaitTimeSeconds: this.waitTime,
        VisibilityTimeout: this.visibilityTimeout,
        AttributeNames: ['All'],
      }),
    );

    const messages = result.Messages ?? [];
    this.logger.debug(`Received ${messages.length} message(s) from SQS`);

    for (const message of messages) {
      await this.processMessage(message);
    }
  }

  private async processMessage(message: any): Promise<void> {
    const receiptHandle = message.ReceiptHandle!;
    const messageId = message.MessageId;

    try {
      const body = this.parseBody(message.Body ?? '');
      this.logger.log(
        `Processing SQS message ${messageId} from ${body.phoneNumber}`,
      );

      const event: IncomingMessageEvent = {
        phoneNumber: body.phoneNumber,
        text: body.text,
        mediaUrl: body.mediaUrl,
      };

      await this.eventEmitter.emitAsync(INCOMING_MESSAGE_EVENT, event);

      // Delete message on success
      await this.awsClients.sqs.send(
        new DeleteMessageCommand({
          QueueUrl: this.queueUrl,
          ReceiptHandle: receiptHandle,
        }),
      );

      this.logger.debug(`Deleted SQS message ${messageId}`);
    } catch (error) {
      this.logger.error(
        `Failed to process SQS message ${messageId}`,
        error,
      );
      // Do NOT delete — let visibility timeout expire for retry / DLQ
    }
  }

  private parseBody(body: string): SqsBody {
    try {
      const parsed = JSON.parse(body);
      if (!parsed.phoneNumber || !parsed.text) {
        throw new Error('Missing required fields: phoneNumber, text');
      }
      return parsed as SqsBody;
    } catch (error) {
      throw new Error(`Invalid SQS message body: ${(error as Error).message}`);
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
