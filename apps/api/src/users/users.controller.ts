import { Controller, Get, Param, Query, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ApiOkResponse, ApiNotFoundResponse, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { PaginatedUsersDto, UserDetailDto } from './dto/user.dto';

@ApiTags('users')
@Controller('users')
export class UsersController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  @ApiOperation({ summary: 'List users with pagination and filters' })
  @ApiQuery({ name: 'take', required: false, description: 'Items per page (1-100). Default 20.' })
  @ApiQuery({ name: 'cursor', required: false, description: 'Cursor id for next page' })
  @ApiQuery({ name: 'role', required: false, enum: ['customer', 'provider', 'admin'] })
  @ApiQuery({ name: 'status', required: false })
  @ApiQuery({ name: 'q', required: false, description: 'Email contains (case-insensitive)' })
  @ApiOkResponse({ type: PaginatedUsersDto })
  async list(
    @Query('take') takeQ?: string,
    @Query('cursor') cursor?: string,
    @Query('role') role?: 'customer' | 'provider' | 'admin',
    @Query('status') status?: string,
    @Query('q') q?: string,
  ) {
    const take = Math.max(1, Math.min(100, Number.parseInt(takeQ ?? '20', 10) || 20));

    const where: any = {};
    if (role) where.role = role;
    if (status) where.status = status;
    if (q) where.email = { contains: q, mode: 'insensitive' as const };

    const items = await this.prisma.user.findMany({
      where,
      select: {
        id: true,
        email: true,
        role: true,
        status: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
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

  @Get(':id')
  @ApiOperation({ summary: 'Get a user by id' })
  @ApiOkResponse({ type: UserDetailDto })
  @ApiNotFoundResponse({ description: 'User not found' })
  async getById(@Param('id') id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        role: true,
        status: true,
        createdAt: true,
        profile: {
          select: {
            firstName: true,
            lastName: true,
            avatarUrl: true,
            city: true,
            state: true,
            rating: true,
          },
        },
      },
    });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }
}
