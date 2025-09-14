import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { ConfigModule } from '@nestjs/config';
import { WebSocketClientService } from './websocket-client.service';

@Module({
  imports: [HttpModule, ConfigModule],
  providers: [WebSocketClientService],
  exports: [WebSocketClientService],
})
export class WebSocketClientModule {}