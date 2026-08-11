import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { BotEventListener } from './bot.event-listener';
import { BotProcessor } from './bot.processor';
import { BotWhatsappClient } from './bot.whatsapp-client';
import { ClaudeBotModule } from '../claude-bot/claude-bot.module';
import { ConversationModule } from '../conversation/conversation.module';
import { LisClientModule } from '../lis-client/lis-client.module';

@Module({
  imports: [
    ConfigModule,
    ClaudeBotModule,
    ConversationModule,
    LisClientModule,
  ],
  providers: [BotWhatsappClient, BotProcessor, BotEventListener],
  exports: [BotProcessor],
})
export class BotModule {}
