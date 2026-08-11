import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosInstance } from 'axios';
import { Env } from '../config/env.schema';

@Injectable()
export class BotWhatsappClient {
  private readonly logger = new Logger(BotWhatsappClient.name);
  private readonly http: AxiosInstance;

  constructor(private readonly config: ConfigService<Env>) {
    this.http = axios.create({
      baseURL: this.config.get('WHATSAPP_SERVICE_URL'),
      headers: { 'Content-Type': 'application/json' },
      timeout: 10000,
    });
  }

  async sendMessage(phoneNumber: string, text: string): Promise<void> {
    try {
      await this.http.post('/messages/send', { phoneNumber, text });
      this.logger.debug(`Message sent to ${phoneNumber}`);
    } catch (error) {
      this.logger.error(
        `Failed to send message to ${phoneNumber}`,
        error,
      );
      throw error;
    }
  }
}
