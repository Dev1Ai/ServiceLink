import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
type RedisPipeline = {
  exists: (key: string) => RedisPipeline;
  exec: () => Promise<Array<[unknown, unknown]>>;
};

type RedisLike = {
  sadd: (key: string, member: string) => Promise<number>;
  srem: (key: string, member: string) => Promise<number>;
  smembers: (key: string) => Promise<string[]>;
  scard: (key: string) => Promise<number>;
  setex: (key: string, seconds: number, value: string) => Promise<unknown>;
  pipeline: () => RedisPipeline;
};

@Injectable()
export class RealtimeService {
  private online = new Set<string>();
  private redis: RedisLike | null = null;
  private readonly setKey = "presence:online";
  private alive = new Map<string, number>();

  constructor(private readonly config: ConfigService) {
    const url = this.config.get<string>("REDIS_URL");
    if (url) {
      try {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const IORedis = require("ioredis");
        this.redis = new IORedis(url);
      } catch {
        this.redis = null;
      }
    }
  }

  async addOnline(userId: string) {
    if (!userId) return;
    if (this.redis) {
      try {
        await this.redis.sadd(this.setKey, userId);
        return;
      } catch {}
    }
    this.online.add(userId);
  }

  async removeOnline(userId: string) {
    if (!userId) return;
    if (this.redis) {
      try {
        await this.redis.srem(this.setKey, userId);
        return;
      } catch {}
    }
    this.online.delete(userId);
    this.alive.delete(userId);
  }

  async listOnline(): Promise<string[]> {
    if (this.redis) {
      try {
        return (await this.redis.smembers(this.setKey)) || [];
      } catch {}
    }
    const now = Date.now();
    // filter out expired from memory map
    return Array.from(this.online).filter((u) => {
      const exp = this.alive.get(u) || 0;
      return exp > now;
    });
  }

  async count(): Promise<number> {
    if (this.redis) {
      try {
        return (await this.redis.scard(this.setKey)) ?? 0;
      } catch {}
    }
    return (await this.listOnline()).length;
  }

  async touchAlive(userId: string, ttlSeconds = 60) {
    if (!userId) return;
    if (this.redis) {
      try {
        await this.redis.setex(`presence:alive:${userId}`, ttlSeconds, "1");
        return;
      } catch {}
    }
    const exp = Date.now() + ttlSeconds * 1000;
    this.alive.set(userId, exp);
  }

  async reconcile(_ttlSeconds = 60): Promise<void> {
    // Remove stale from online when no alive key
    if (this.redis) {
      try {
        const members: string[] =
          (await this.redis.smembers(this.setKey)) || [];
        if (members.length === 0) return;
        const pipeline = this.redis.pipeline();
        members.forEach((u) => pipeline.exists(`presence:alive:${u}`));
        const results = await pipeline.exec();
        for (let i = 0; i < members.length; i++) {
          const exists = Array.isArray(results[i]) ? results[i][1] : results[i];
          if (!exists) {
            await this.redis.srem(this.setKey, members[i]);
          }
        }
      } catch {
        /* ignore */
      }
      return;
    }
    const now = Date.now();
    for (const u of Array.from(this.online)) {
      const exp = this.alive.get(u) || 0;
      if (exp <= now) this.online.delete(u);
    }
  }
}
