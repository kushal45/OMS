import { Module } from '@nestjs/common';
import { ConfigModule as NestConfigModule } from '@nestjs/config';
// import * as path from 'path'; // No longer needed here

@Module({
  imports: [
    NestConfigModule.forRoot({ // Services will define their own envFilePath
      isGlobal: true, // Retain global availability of ConfigService
      cache: true,    // Retain caching
      // envFilePath is removed; services like AuthModule, OrderModule already define their own.
      // This shared module now primarily ensures ConfigService is globally available and cached.
    }),
  ],
  exports: [NestConfigModule], // Export NestConfigModule so other modules can use ConfigService
})
export class ConfigModule {}