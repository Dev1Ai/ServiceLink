import { Logger } from '@nestjs/common';
import { OnGatewayConnection, OnGatewayDisconnect, OnGatewayInit, WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { RealtimeService } from './realtime.service';
import { PrismaService } from '../prisma/prisma.service';
import { MetricsService } from '../metrics/metrics.service';
import { InjectThrottlerStorage, ThrottlerStorage } from '@nestjs/throttler';

type JwtPayload = { sub: string; role: string; email?: string };

@WebSocketGateway({
  namespace: '/ws',
  cors: {
    origin: process.env.CORS_ORIGIN
      ? process.env.CORS_ORIGIN.split(',').map((s: string) => s.trim()).filter(Boolean)
      : process.env.NODE_ENV === 'production'
        ? false
        : true,
    credentials: true,
  },
})
export class RealtimeGateway implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer() server!: Server;
  private readonly logger = new Logger(RealtimeGateway.name);

  private redisAdapterReady = false;
  private posthog: { capture: (ev: { distinctId: string; event: string; properties?: Record<string, unknown> }) => void } | null = null;
  private reconcileTimer: NodeJS.Timeout | null = null;

  constructor(
    private config: ConfigService,
    private jwt: JwtService,
    private realtime: RealtimeService,
    private prisma: PrismaService,
    private metrics: MetricsService,
    @InjectThrottlerStorage() private readonly storage: ThrottlerStorage,
  ) {}

  async afterInit() {
    // Optional Redis adapter for horizontal scaling
    const redisUrl = this.config.get<string>('REDIS_URL');
    if (redisUrl) {
      try {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const { createAdapter } = require('@socket.io/redis-adapter');
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const { default: IORedis } = require('ioredis');
        const pubClient = new IORedis(redisUrl);
        const subClient = new IORedis(redisUrl);
        this.server.adapter(createAdapter(pubClient, subClient));
        this.redisAdapterReady = true;
        this.logger.log('Socket.IO Redis adapter enabled');
      } catch (e) {
        this.logger.warn('Redis adapter not available; falling back to in-memory presence');
      }
    }
    // Optional PostHog analytics
    const phKey = this.config.get<string>('POSTHOG_API_KEY');
    if (phKey) {
      try {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const { PostHog } = require('posthog-node');
        this.posthog = new PostHog(phKey);
        this.logger.log('PostHog initialized for realtime events');
      } catch (e) {
        this.logger.warn('PostHog not available');
      }
    }
    this.logger.log('Realtime gateway initialized');
    // Periodic reconcile of presence set
    const ttl = Number(this.config.get<string>('PRESENCE_TTL') || '60');
    this.reconcileTimer = setInterval(async () => {
      try {
        await this.realtime.reconcile(ttl);
        this.broadcastPresence();
      } catch {}
    }, Math.max(15, Math.floor(ttl / 2)) * 1000);
  }

  private async authenticate(client: Socket): Promise<JwtPayload | null> {
    try {
      let token: string | undefined;
      const auth = client.handshake.headers['authorization'] as string | undefined;
      if (auth?.startsWith('Bearer ')) token = auth.slice('Bearer '.length);
      if (!token) token = (client.handshake.auth?.token as string | undefined) || (client.handshake.query?.token as string | undefined);
      if (!token) return null;
      const payload = (await this.jwt.verifyAsync(token, { secret: this.config.get<string>('JWT_SECRET', 'changeme') })) as JwtPayload;
      return payload;
    } catch {
      return null;
    }
  }

  async handleConnection(client: Socket) {
    const payload = await this.authenticate(client);
    if (!payload) {
      client.disconnect(true);
      return;
    }
    (client.data as { userId?: string; role?: string }).userId = payload.sub;
    (client.data as { userId?: string; role?: string }).role = (payload.role || '').toString().toUpperCase();
    await this.realtime.addOnline(payload.sub);
    // mark alive immediately and periodically
    const ttl = Number(this.config.get<string>('PRESENCE_TTL') || '60');
    await this.realtime.touchAlive(payload.sub, ttl);
    const pingTimer = setInterval(() => {
      this.realtime.touchAlive(payload.sub, ttl);
    }, Math.max(10, Math.floor(ttl / 2)) * 1000);
    (client.data as { pingTimer?: NodeJS.Timeout }).pingTimer = pingTimer;
    client.join(`user:${payload.sub}`);
    this.broadcastPresence();
    if (this.posthog) this.posthog.capture({ distinctId: payload.sub, event: 'ws_connect', properties: { role: payload.role, redis: this.redisAdapterReady } });
    this.metrics.incWsConnect(payload.role, this.redisAdapterReady);

    // Basic rooms: clients can join job rooms
    client.on('room:join', (room: string) => {
      if (typeof room === 'string' && room) client.join(room);
    });
    client.on('room:leave', (room: string) => {
      if (typeof room === 'string' && room) client.leave(room);
    });

    // Typing indicator: { room, isTyping }
    client.on('typing', (data: { room: string; isTyping: boolean }) => {
      const userId = (client.data as { userId?: string }).userId as string;
      const role = (client.data as { role?: string }).role as string;
      const res = this.wsAllowed('typing', userId, role);
      if (!res.allowed) {
        try { client.emit('rate_limit', { kind: 'typing', ttl: res.ttl, limit: res.limit }); } catch {}
        return;
      }
      if (!data?.room) return;
      client.to(data.room).emit('typing', { userId, isTyping: !!data.isTyping });
      if (this.posthog) this.posthog.capture({ distinctId: userId, event: 'ws_typing', properties: { room: data.room, isTyping: !!data.isTyping } });
      this.metrics.incWsTyping(data.room);
    });

    // Minimal chat: client -> server -> room broadcast
    // chat:send { room, content }
    client.on('chat:send', async (data: { room: string; content: string }) => {
      const userId = (client.data as { userId?: string }).userId as string;
      const role = (client.data as { role?: string }).role as string;
      const res = this.wsAllowed('chat', userId, role);
      if (!res.allowed) {
        try { client.emit('rate_limit', { kind: 'chat', ttl: res.ttl, limit: res.limit }); } catch {}
        return;
      }
      if (!data?.room || typeof data.content !== 'string' || data.content.trim() === '') return;
      // Persist if room looks like a job room: job:<key>
      const match = /^job:(.+)$/.exec(data.room);
      let ts = new Date().toISOString();
      let id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { id: true, email: true, name: true } });
      if (match) {
        const key = match[1];
        const job = await this.prisma.job.upsert({
          where: { key },
          update: {},
          create: {
            key,
            title: `Chat for ${key}`,
            description: 'Auto-created from chat message',
            customerId: userId,
          },
        });
        const saved = await this.prisma.chatMessage.create({ data: { jobId: job.id, userId, content: data.content } });
        id = saved.id;
        ts = saved.createdAt.toISOString();
      }
      this.server.to(data.room).emit('chat:message', { id, room: data.room, userId, user, content: data.content, ts });
      if (this.posthog) this.posthog.capture({ distinctId: userId, event: 'ws_chat_send', properties: { room: data.room } });
      this.metrics.incWsChat(data.room);
    });

    // Client-driven presence ping to refresh TTL
    client.on('presence:ping', async () => {
      const userId = (client.data as { userId?: string }).userId as string;
      const ttl = Number(this.config.get<string>('PRESENCE_TTL') || '60');
      await this.realtime.touchAlive(userId, ttl);
    });
  }

  private wsAllowed(kind: 'typing' | 'chat', userId: string, role: string | undefined): { allowed: boolean; ttl?: number; limit?: number } {
    try {
      const cfg = this.config;
      const baseTtl = Number(cfg.get<string>(kind === 'typing' ? 'WS_TYPING_RATE_TTL' : 'WS_CHAT_RATE_TTL') ?? (kind === 'typing' ? 10 : 60));
      const baseLimit = Number(cfg.get<string>(kind === 'typing' ? 'WS_TYPING_RATE_LIMIT' : 'WS_CHAT_RATE_LIMIT') ?? (kind === 'typing' ? 10 : 15));
      const cTtl = Number(cfg.get<string>(kind === 'typing' ? 'WS_TYPING_RATE_TTL_CUSTOMER' : 'WS_CHAT_RATE_TTL_CUSTOMER') ?? baseTtl);
      const cLimit = Number(cfg.get<string>(kind === 'typing' ? 'WS_TYPING_RATE_LIMIT_CUSTOMER' : 'WS_CHAT_RATE_LIMIT_CUSTOMER') ?? baseLimit);
      const pTtl = Number(cfg.get<string>(kind === 'typing' ? 'WS_TYPING_RATE_TTL_PROVIDER' : 'WS_CHAT_RATE_TTL_PROVIDER') ?? baseTtl);
      const pLimit = Number(cfg.get<string>(kind === 'typing' ? 'WS_TYPING_RATE_LIMIT_PROVIDER' : 'WS_CHAT_RATE_LIMIT_PROVIDER') ?? baseLimit);
      let ttl = baseTtl;
      let limit = baseLimit;
      if (role === 'CUSTOMER') {
        ttl = cTtl;
        limit = cLimit;
      } else if (role === 'PROVIDER') {
        ttl = pTtl;
        limit = pLimit;
      }
      const key = `ws:${kind}:${userId}`;
      type RateStore = { getRecordSync?: (key: string) => number[]; getRecord?: (key: string) => Promise<number[]>; addRecord?: (key: string, ttl: number) => Promise<void> | void };
      const store = this.storage as unknown as RateStore;
      const records: number[] = store.getRecordSync?.(key) || [];
      // If storage doesn't expose sync, attempt async and note that this.wsAllowed is used synchronously; fallback permit
      if (!records.length && store.getRecord) {
        // NOTE: cannot await in this path; allow once
        store.getRecord(key)!.then((arr: number[]) => {
          const now = Date.now();
          const windowStart = now - ttl * 1000;
          const recent = (arr || []).filter((ts) => ts > windowStart);
          if (recent.length < limit) store.addRecord?.(key, ttl);
        }).catch(() => {});
        return { allowed: true, ttl, limit };
      }
      const now = Date.now();
      const windowStart = now - ttl * 1000;
      const recent = records.filter((ts) => ts > windowStart);
      if (recent.length >= limit) return { allowed: false, ttl, limit };
      store.addRecord?.(key, ttl);
      return { allowed: true, ttl, limit };
    } catch {
      return { allowed: true };
    }
  }

  async handleDisconnect(client: Socket) {
    const userId = (client.data as { userId?: string }).userId as string | undefined;
    if (userId) {
      // Remove only if no other sockets for this user remain
      const sockets = await this.server.in(`user:${userId}`).fetchSockets();
      if (sockets.length <= 1) await this.realtime.removeOnline(userId);
      const pingTimer: NodeJS.Timeout | undefined = (client.data as { pingTimer?: NodeJS.Timeout }).pingTimer;
      if (pingTimer) clearInterval(pingTimer);
      this.broadcastPresence();
      if (this.posthog) this.posthog.capture({ distinctId: userId, event: 'ws_disconnect' });
    }
  }

  private broadcastPresence() {
    Promise.resolve(this.realtime.listOnline()).then((online) => {
      this.server.emit('presence:update', { online });
    });
  }
}
