import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
} from '@aws-sdk/lib-dynamodb';
import { AwsClientsService } from '../config/aws-clients';
import { ConversationSession } from '../conversation/conversation.model';
import { Env } from '../config/env.schema';

@Injectable()
export class DynamoDbService {
  private readonly logger = new Logger(DynamoDbService.name);
  private readonly docClient: DynamoDBDocumentClient;
  private readonly tableName: string;

  constructor(
    private readonly awsClients: AwsClientsService,
    private readonly config: ConfigService<Env>,
  ) {
    this.docClient = DynamoDBDocumentClient.from(this.awsClients.dynamodb, {
      marshallOptions: { removeUndefinedValues: true },
    });
    this.tableName = this.config.get('DYNAMODB_TABLE')!;
  }

  async getSession(sessionId: string): Promise<ConversationSession | null> {
    try {
      const result = await this.docClient.send(
        new GetCommand({
          TableName: this.tableName,
          Key: { sessionId },
        }),
      );

      if (!result.Item) return null;

      return this.deserializeSession(result.Item);
    } catch (error) {
      this.logger.error(`Failed to get session ${sessionId}`, error);
      throw error;
    }
  }

  async saveSession(session: ConversationSession): Promise<void> {
    try {
      const item = this.serializeSession(session);
      await this.docClient.send(
        new PutCommand({
          TableName: this.tableName,
          Item: item,
        }),
      );
    } catch (error) {
      this.logger.error(`Failed to save session ${session.sessionId}`, error);
      throw error;
    }
  }

  private serializeSession(session: ConversationSession): Record<string, any> {
    return {
      ...session,
      createdAt: session.createdAt.toISOString(),
      lastUpdatedAt: session.lastUpdatedAt.toISOString(),
      expiresAt: session.expiresAt.toISOString(),
      // TTL for DynamoDB in unix seconds
      ttl: Math.floor(session.expiresAt.getTime() / 1000),
      history: session.history.map((h) => ({
        ...h,
        timestamp: h.timestamp.toISOString(),
      })),
    };
  }

  private deserializeSession(item: Record<string, any>): ConversationSession {
    return {
      ...item,
      createdAt: new Date(item.createdAt),
      lastUpdatedAt: new Date(item.lastUpdatedAt),
      expiresAt: new Date(item.expiresAt),
      history: (item.history || []).map((h: any) => ({
        ...h,
        timestamp: new Date(h.timestamp),
      })),
    } as ConversationSession;
  }
}
