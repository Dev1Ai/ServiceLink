import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { PassportModule } from "@nestjs/passport";
import { AuthService } from "./auth.service";
import { AuthController } from "./auth.controller";
import { JwtStrategy } from "./jwt.strategy";
import { PrismaService } from "../prisma/prisma.service";
import { JwtAuthGuard, RolesGuard } from "./jwt.guard";
import { MetricsModule } from "../metrics/metrics.module";

@Module({
  imports: [
    PassportModule,
    MetricsModule,
    JwtModule.register({
      secret: process.env.JWT_SECRET || "changeme",
      signOptions: { expiresIn: "1h" },
    }),
  ],
  providers: [
    AuthService,
    JwtStrategy,
    PrismaService,
    JwtAuthGuard,
    RolesGuard,
  ],
  controllers: [AuthController],
  exports: [AuthService, JwtAuthGuard, RolesGuard, JwtModule],
})
export class AuthModule {}
