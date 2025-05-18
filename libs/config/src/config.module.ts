import { Module } from '@nestjs/common';
import { ConfigModule as NestConfigModule } from '@nestjs/config';
import * as path from 'path';

@Module({
  imports: [
    NestConfigModule.forRoot({
      isGlobal: true,
      envFilePath: (process.env.NODE_ENV === 'test')
        ? path.resolve(`${process.env.SERVICE_NAME || 'app'}/.env.test`)
        : path.resolve(`${process.env.SERVICE_NAME || 'app'}/.env`),
      cache: true,
    }),
  ],
  exports: [NestConfigModule],
})
export class ConfigModule {}