import { Inject, Injectable, OnModuleDestroy } from '@nestjs/common';
import type Redis from 'ioredis';

import { BLACKLIST_KEY_PREFIX, REDIS_CLIENT } from './redis.constants';

@Injectable()
export class RedisService implements OnModuleDestroy {
  constructor(@Inject(REDIS_CLIENT) private readonly client: Redis) {}

  async onModuleDestroy(): Promise<void> {
    await this.client.quit();
  }

  async blacklistToken(jti: string, ttlSeconds: number): Promise<void> {
    if (ttlSeconds <= 0) return;
    await this.client.set(
      `${BLACKLIST_KEY_PREFIX}${jti}`,
      '1',
      'EX',
      ttlSeconds,
    );
  }

  async isTokenBlacklisted(jti: string): Promise<boolean> {
    const value = await this.client.get(`${BLACKLIST_KEY_PREFIX}${jti}`);
    return value !== null;
  }
}
