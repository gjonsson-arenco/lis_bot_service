import { Injectable, Logger } from '@nestjs/common';
import { ConversationSession } from './conversation.model';
import { DynamoDbService } from '../storage/dynamodb.service';
import { RedisService } from '../storage/redis.service';

const SESSION_TTL_DAYS = 7;

@Injectable()
export class ConversationService {
  private readonly logger = new Logger(ConversationService.name);

  constructor(
    private readonly dynamo: DynamoDbService,
    private readonly redis: RedisService,
  ) {}

  async getOrCreateSession(phoneNumber: string): Promise<ConversationSession> {
    const sessionId = phoneNumber;

    // Try Redis cache first
    const cached = await this.redis.get<ConversationSession>(
      this.cacheKey(sessionId),
    );
    if (cached) {
      this.logger.debug(`Session cache hit for ${sessionId}`);
      // Re-hydrate Date objects
      return this.hydrateDates(cached);
    }

    // Load from DynamoDB
    const existing = await this.dynamo.getSession(sessionId);
    if (existing) {
      this.logger.debug(`Session loaded from DynamoDB for ${sessionId}`);
      await this.redis.set(this.cacheKey(sessionId), existing);
      return existing;
    }

    // Create new session
    const now = new Date();
    const session: ConversationSession = {
      sessionId,
      phoneNumber,
      history: [],
      metadata: {},
      createdAt: now,
      lastUpdatedAt: now,
      expiresAt: new Date(
        now.getTime() + SESSION_TTL_DAYS * 24 * 60 * 60 * 1000,
      ),
    };

    this.logger.log(`Creating new session for ${phoneNumber}`);
    await this.saveSession(sessionId, session);
    return session;
  }

  async getSession(sessionId: string): Promise<ConversationSession | null> {
    const cached = await this.redis.get<ConversationSession>(
      this.cacheKey(sessionId),
    );
    if (cached) return this.hydrateDates(cached);
    const session = await this.dynamo.getSession(sessionId);
    if (session) {
      await this.redis.set(this.cacheKey(sessionId), session);
    }
    return session;
  }

  async saveSession(
    sessionId: string,
    session: ConversationSession,
  ): Promise<void> {
    session.lastUpdatedAt = new Date();
    await this.dynamo.saveSession(session);
    await this.redis.set(this.cacheKey(sessionId), session);
  }

  private cacheKey(sessionId: string): string {
    return `session:${sessionId}`;
  }

  private hydrateDates(session: ConversationSession): ConversationSession {
    return {
      ...session,
      createdAt: new Date(session.createdAt),
      lastUpdatedAt: new Date(session.lastUpdatedAt),
      expiresAt: new Date(session.expiresAt),
      history: session.history.map((h) => ({
        ...h,
        timestamp: new Date(h.timestamp),
      })),
    };
  }
}
