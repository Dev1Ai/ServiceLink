import {
  Controller,
  Get,
  Param,
  Query,
  NotFoundException,
  UseGuards,
  Req,
} from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiOkResponse,
  ApiNotFoundResponse,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from "@nestjs/swagger";
import { PaginatedUsersDto, UserDetailDto } from "./dto/user.dto";
import { Role } from "@prisma/client";
import { JwtAuthGuard } from "../auth/jwt.guard";
import { ErrorDto } from "../common/dto/error.dto";
import type { AuthedRequest } from "../common/types/request";

@ApiTags("users")
@Controller("users")
export class UsersController {
  constructor(private readonly prisma: PrismaService) {}

  @Get("me")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth("bearer")
  @ApiOperation({ summary: "Get current authenticated user" })
  @ApiOkResponse({ type: UserDetailDto })
  async me(@Req() req: AuthedRequest) {
    return this.prisma.user.findUnique({
      where: { id: req.user.sub },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        createdAt: true,
        profile: {
          select: { firstName: true, lastName: true, avatarUrl: true },
        },
        provider: {
          select: {
            id: true,
            kycStatus: true,
            stripeAccountId: true,
            online: true,
            serviceRadiusKm: true,
          },
        },
      },
    });
  }

  @Get()
  @ApiOperation({ summary: "List users with pagination and filters" })
  @ApiQuery({
    name: "take",
    required: false,
    description: "Items per page (1-100). Default 20.",
  })
  @ApiQuery({
    name: "cursor",
    required: false,
    description: "Cursor id for next page",
  })
  @ApiQuery({
    name: "role",
    required: false,
    enum: ["CUSTOMER", "PROVIDER", "ADMIN"],
  })
  @ApiQuery({
    name: "q",
    required: false,
    description: "Email contains (case-insensitive)",
  })
  @ApiOkResponse({ type: PaginatedUsersDto })
  async list(
    @Query("take") takeQ?: string,
    @Query("cursor") cursor?: string,
    @Query("role") role?: Role | string,
    @Query("q") q?: string,
  ) {
    const take = Math.max(
      1,
      Math.min(100, Number.parseInt(takeQ ?? "20", 10) || 20),
    );

    const where: {
      role?: Role;
      email?: { contains: string; mode: "insensitive" };
    } = {};
    if (role) {
      const r = String(role).toUpperCase() as Role;
      where.role = r;
    }
    if (q) where.email = { contains: q, mode: "insensitive" as const };

    const items = await this.prisma.user.findMany({
      where,
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
      cursor: cursor ? { id: cursor } : undefined,
      skip: cursor ? 1 : 0,
      take: take + 1, // fetch one extra to determine next cursor
    });

    let nextCursor: string | undefined = undefined;
    if (items.length > take) {
      const nextItem = items.pop();
      nextCursor = nextItem?.id;
    }

    return { items, nextCursor };
  }

  @Get(":id")
  @ApiOperation({ summary: "Get a user by id" })
  @ApiOkResponse({ type: UserDetailDto })
  @ApiNotFoundResponse({ description: "User not found" })
  @ApiBadRequestResponse({ type: ErrorDto })
  async getById(@Param("id") id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        createdAt: true,
        profile: {
          select: {
            firstName: true,
            lastName: true,
            avatarUrl: true,
          },
        },
      },
    });
    if (!user) throw new NotFoundException("User not found");
    return user;
  }
}
