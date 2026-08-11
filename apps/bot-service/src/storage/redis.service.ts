import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, RedisClientType } from 'redis';
import { Env } from '../config/env.schema';

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private client: RedisClientType;
  private readonly ttl: number;

  constructor(private readonly config: ConfigService<Env>) {
    this.ttl = this.config.get('SESSION_CACHE_TTL')!;
    this.client = createClient({
      url: this.config.get('REDIS_URL'),
    }) as RedisClientType;

    this.client.on('error', (err) => {
      this.logger.error('Redis client error', err);
    });
  }

  async onModuleInit() {
    await this.client.connect();
    this.logger.log('Redis connected');
  }

  async onModuleDestroy() {
    await this.client.disconnect();
    this.logger.log('Redis disconnected');
  }

  async get<T>(key: string): Promise<T | null> {
    try {
      const value = await this.client.get(key);
      if (!value) return null;
      return JSON.parse(value) as T;
    } catch (error) {
      this.logger.warn(`Redis get failed for key ${key}`, error);
      return null;
    }
  }

  async set(key: string, value: unknown, ttlSeconds?: number): Promise<void> {
    try {
      const serialized = JSON.stringify(value);
      const expiry = ttlSeconds ?? this.ttl;
      await this.client.setEx(key, expiry, serialized);
    } catch (error) {
      this.logger.warn(`Redis set failed for key ${key}`, error);
    }
  }

  async del(key: string): Promise<void> {
    try {
      await this.client.del(key);
    } catch (error) {
      this.logger.warn(`Redis del failed for key ${key}`, error);
    }
  }
}
