import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { SqsConsumerService } from './sqs-consumer.service';
import { AwsClientsService } from '../config/aws-clients';
import { BotModule } from '../bot/bot.module';

@Module({
  imports: [ConfigModule, BotModule],
  providers: [AwsClientsService, SqsConsumerService],
})
export class SqsModule {}
