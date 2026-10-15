import { NestExpressApplication } from '@nestjs/platform-express';
import { Test, TestingModule } from '@nestjs/testing';
import { getDataSourceToken } from '@nestjs/typeorm';
import request from 'supertest';
import { App } from 'supertest/types';
import { DataSource } from 'typeorm';

import { AppModule } from './../src/app.module';
import { Category } from './../src/categories/category.entity';
import { configureApp } from './../src/configure-app';
import { truncateAllTables } from './utils/database-cleaner';

interface CategoryListItemBody {
  id: number;
  name: string;
  description: string;
}

interface CategoryListBody {
  items: CategoryListItemBody[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}

describe('Categories (e2e)', () => {
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

  async function createCategory(
    overrides: Partial<Category> = {},
  ): Promise<Category> {
    const categoriesRepository = dataSource.getRepository(Category);
    const category = categoriesRepository.create({
      name: 'Du lịch biển',
      description: 'Các tour biển đảo',
      ...overrides,
    });
    return categoriesRepository.save(category);
  }

  describe('GET /api/v1/categories', () => {
    it('lists categories without requiring auth', async () => {
      await createCategory();

      const res = await request(app.getHttpServer())
        .get('/api/v1/categories')
        .expect(200);

      const body = res.body as CategoryListBody;
      expect(body.items).toHaveLength(1);
      expect(body.items[0]).toMatchObject({
        name: 'Du lịch biển',
        description: 'Các tour biển đảo',
      });
    });

    it('defaults pageSize to 50', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/categories')
        .expect(200);

      const body = res.body as CategoryListBody;
      expect(body.pagination.pageSize).toBe(50);
    });

    it('filters by search', async () => {
      await createCategory({ name: 'Du lịch biển' });
      await createCategory({ name: 'Du lịch núi' });

      const res = await request(app.getHttpServer())
        .get('/api/v1/categories')
        .query({ search: 'núi' })
        .expect(200);

      const body = res.body as CategoryListBody;
      expect(body.items).toHaveLength(1);
      expect(body.items[0].name).toBe('Du lịch núi');
    });

    it('returns 400 VALIDATION_ERROR for an invalid page', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/categories')
        .query({ page: 0 })
        .expect(400);

      expect((res.body as { code: string }).code).toBe('VALIDATION_ERROR');
    });
  });

  afterEach(async () => {
    await truncateAllTables(dataSource);
    await app.close();
  });
});
