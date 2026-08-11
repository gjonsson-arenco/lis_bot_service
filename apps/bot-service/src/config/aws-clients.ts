import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { SQSClient } from '@aws-sdk/client-sqs';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Env } from './env.schema';

@Injectable()
export class AwsClientsService {
  readonly dynamodb: DynamoDBClient;
  readonly sqs: SQSClient;

  constructor(private readonly config: ConfigService<Env>) {
    const region = this.config.get('AWS_REGION');
    const accessKeyId = this.config.get('AWS_ACCESS_KEY_ID');
    const secretAccessKey = this.config.get('AWS_SECRET_ACCESS_KEY');

    const credentials =
      accessKeyId && secretAccessKey
        ? { accessKeyId, secretAccessKey }
        : undefined;

    this.dynamodb = new DynamoDBClient({ region, credentials });
    this.sqs = new SQSClient({ region, credentials });
  }
}
