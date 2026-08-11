import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DynamoDbService } from './dynamodb.service';
import { RedisService } from './redis.service';
import { AwsClientsService } from '../config/aws-clients';

@Module({
  imports: [ConfigModule],
  providers: [AwsClientsService, DynamoDbService, RedisService],
  exports: [DynamoDbService, RedisService],
})
export class StorageModule {}
