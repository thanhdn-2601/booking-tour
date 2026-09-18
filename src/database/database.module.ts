import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';

import { buildPostgresConnectionOptions } from './postgres-connection-options';

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        ...buildPostgresConnectionOptions({
          DB_HOST: configService.get<string>('DB_HOST'),
          DB_PORT: configService.get<string>('DB_PORT'),
          DB_USERNAME: configService.get<string>('DB_USERNAME'),
          DB_PASSWORD: configService.get<string>('DB_PASSWORD'),
          DB_NAME: configService.get<string>('DB_NAME'),
        }),
        synchronize: false,
        autoLoadEntities: true,
      }),
      inject: [ConfigService],
    }),
  ],
})
export class DatabaseModule {}
