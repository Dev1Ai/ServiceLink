import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiQuery, ApiTags, ApiTooManyRequestsResponse } from '@nestjs/swagger';
import { PrismaService } from '../prisma/prisma.service';
import type { Prisma } from '@prisma/client';

class ChatMessageDto {
  id!: string;
  userId!: string;
  content!: string;
  createdAt!: Date;
  user!: { id: string; email: string; name: string };
}

class PaginatedMessagesDto {
  items!: ChatMessageDto[];
  nextCursor?: string;
}

@ApiTags('jobs')
@Controller('jobs')
export class JobsController {
  constructor(private readonly prisma: PrismaService) {}

  @Get(':key/messages')
  @ApiOperation({ summary: 'List recent chat messages for a job room (job:<key>)' })
  @ApiQuery({ name: 'take', required: false, description: 'Number of messages to return (1-200), default 50' })
  @ApiQuery({ name: 'cursorId', required: false, description: 'Message id cursor; returns older messages before this id' })
  @ApiOkResponse({ type: PaginatedMessagesDto })
  @ApiTooManyRequestsResponse({ description: 'Too many requests' })
  async listMessages(@Param('key') key: string, @Query('take') takeQ?: string, @Query('cursorId') cursorId?: string) {
    const take = Math.max(1, Math.min(200, Number.parseInt(takeQ ?? '50', 10) || 50));
    const job = await this.prisma.job.findUnique({ where: { key } });
    if (!job) return { items: [], nextCursor: undefined };
    const args: Prisma.ChatMessageFindManyArgs = {
      where: { jobId: job.id },
      select: { id: true, userId: true, content: true, createdAt: true, user: { select: { id: true, email: true, name: true } } },
      orderBy: { createdAt: 'desc' as const },
      take: take + 1,
    };
    if (cursorId) {
      args.cursor = { id: cursorId };
      args.skip = 1; // exclude the cursor itself
    }
    const rows = await this.prisma.chatMessage.findMany(args);
    let nextCursor: string | undefined = undefined;
    if (rows.length > take) {
      const nextRow = rows.pop();
      nextCursor = nextRow?.id;
    }
    return { items: rows.reverse(), nextCursor };
  }
}
