import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { SentryAlertService } from './sentry-alert.service';

@Module({
  imports: [ConfigModule],
  providers: [SentryAlertService],
  exports: [SentryAlertService],
})
export class SentryModule {}