import { Module } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";
import { ConfigModule } from "@nestjs/config";
import { HealthModule } from "./health/health.module";
import { AppController } from "./app.controller";
import { PrismaModule } from "./prisma/prisma.module";
import { UsersModule } from "./users/users.module";
import { AuthModule } from "./auth/auth.module";
import { ProvidersModule } from "./providers/providers.module";
import { PaymentsModule } from "./payments/payments.module";
import { RealtimeModule } from "./realtime/realtime.module";
import { MetricsModule } from "./metrics/metrics.module";
import { JobsModule } from "./jobs/jobs.module";
import { RemindersModule } from "./reminders/reminders.module";
import { LlmModule } from "./llm/llm.module";
import { ReviewsModule } from "./reviews/reviews.module";
import { ThrottlerModule } from "@nestjs/throttler";
import { RoleAwareThrottlerGuard } from "./common/guards/role-throttler.guard";
import { ConfigService } from "@nestjs/config";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ThrottlerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: async (config: ConfigService) => {
        const ttl = Number(config.get<string>("RATE_DEFAULT_TTL") ?? 60);
        const limit = Number(config.get<string>("RATE_DEFAULT_LIMIT") ?? 120);
        const quotesTtl = Number(config.get<string>("QUOTES_RATE_TTL") ?? 60);
        const quotesLimit = Number(
          config.get<string>("QUOTES_RATE_LIMIT") ?? 5,
        );
        const url = config.get<string>("REDIS_URL");
        if (url) {
          try {
            // eslint-disable-next-line @typescript-eslint/no-var-requires
            const {
              ThrottlerStorageRedisService,
            } = require("nestjs-throttler-storage-redis");
            // eslint-disable-next-line @typescript-eslint/no-var-requires
            const IORedis = require("ioredis");
            const client = new IORedis(url);
            const storage = new ThrottlerStorageRedisService(client);
            return [
              { ttl, limit, storage },
              { name: "quotes", ttl: quotesTtl, limit: quotesLimit, storage },
            ];
          } catch {
            // fallback to memory
            return [
              { ttl, limit },
              { name: "quotes", ttl: quotesTtl, limit: quotesLimit },
            ];
          }
        }
        return [
          { ttl, limit },
          { name: "quotes", ttl: quotesTtl, limit: quotesLimit },
        ];
      },
    }),
    HealthModule,
    PrismaModule,
    UsersModule,
    AuthModule,
    ProvidersModule,
    PaymentsModule,
    RealtimeModule,
    MetricsModule,
    JobsModule,
    RemindersModule,
    ReviewsModule,
    LlmModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: RoleAwareThrottlerGuard,
    },
  ],
  controllers: [AppController],
})
export class AppModule {}
