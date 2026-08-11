import { Module } from '@nestjs/common';
import { ConversationService } from './conversation.service';
import { StorageModule } from '../storage/storage.module';

@Module({
  imports: [StorageModule],
  providers: [ConversationService],
  exports: [ConversationService],
})
export class ConversationModule {}
