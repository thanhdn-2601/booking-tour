import { Test, TestingModule } from '@nestjs/testing';
import { NestExpressApplication } from '@nestjs/platform-express';
import { getDataSourceToken } from '@nestjs/typeorm';
import request from 'supertest';
import { App } from 'supertest/types';
import { DataSource } from 'typeorm';
import { AppModule } from './../src/app.module';
import { configureApp } from './../src/configure-app';
import { truncateAllTables } from './utils/database-cleaner';

describe('AppController (e2e)', () => {
  let app: NestExpressApplication<App>;
  let dataSource: DataSource;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication<NestExpressApplication<App>>();
    configureApp(app);
    await app.init();
    dataSource = app.get<DataSource>(getDataSourceToken());
  });

  it('/api/v1/hello (GET)', () => {
    return request(app.getHttpServer())
      .get('/api/v1/hello')
      .expect(200)
      .expect('Hello World!');
  });

  afterEach(async () => {
    await truncateAllTables(dataSource);
    await app.close();
  });
});
