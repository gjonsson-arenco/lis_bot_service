import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { LisClientService } from './lis-client.service';

@Module({
  imports: [ConfigModule],
  providers: [LisClientService],
  exports: [LisClientService],
})
export class LisClientModule {}
