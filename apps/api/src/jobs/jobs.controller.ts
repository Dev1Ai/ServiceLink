import { BadRequestException, Body, Controller, ForbiddenException, Get, Logger, Param, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBadRequestResponse, ApiBearerAuth, ApiBody, ApiNotFoundResponse, ApiOkResponse, ApiOperation, ApiTags, ApiTooManyRequestsResponse, ApiUnauthorizedResponse } from '@nestjs/swagger';
import { QuotesRoleLimitGuard } from '../common/guards/quotes-role-limit.guard';
import { PrismaService } from '../prisma/prisma.service';
import { JwtAuthGuard, Roles, RolesGuard } from '../auth/jwt.guard';
import { CreateJobDto, CreateQuoteDto, JobDto, QuoteDto, QuoteWithProviderDto } from './dto/job.dto';
import { ErrorDto } from '../common/dto/error.dto';
import { MetricsService } from '../metrics/metrics.service';
import { JobsService } from './jobs.service';
import { QuotesService } from './quotes.service';
import { JobsRoleLimitGuard } from '../common/guards/jobs-role-limit.guard';
import type { AuthedRequest } from '../common/types/request';
import { AssignmentsService, ASSIGNMENT_STATUS } from './assignments.service';
import { AssignmentDto, ProposeScheduleDto } from './dto/schedule.dto';
import { PaymentsService } from '../payments/payments.service';

/**
 * Jobs + Quotes Controller
 * - Customers: create jobs, list own jobs, accept/revoke quotes, verify completion
 * - Providers: create quotes for jobs
 * - AuthZ via JwtAuthGuard + RolesGuard; rate limits via role-specific guards
 */
@ApiTags('jobs')
@Controller('jobs')
export class JobsController {
  private readonly logger = new Logger(JobsController.name);
  constructor(
    private readonly prisma: PrismaService,
    private readonly metrics: MetricsService,
    private readonly jobs: JobsService,
    private readonly quotes: QuotesService,
    private readonly assignments: AssignmentsService,
    private readonly payments: PaymentsService,
  ) {}

  @Get('mine')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('CUSTOMER')
  @ApiBearerAuth('bearer')
  @ApiOperation({ summary: 'List jobs for current customer' })
  @ApiOkResponse({ type: [JobDto] })
  async listMine(@Req() req: AuthedRequest) {
    const userId = req.user.sub;
    return this.prisma.job.findMany({
      where: { customerId: userId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        key: true,
        title: true,
        description: true,
        customerId: true,
        createdAt: true,
        assignment: {
          select: {
            id: true,
            providerId: true,
            acceptedAt: true,
            status: true,
            scheduledStart: true,
            scheduledEnd: true,
            scheduleVersion: true,
            scheduleProposedBy: true,
            scheduleProposedAt: true,
            provider: { select: { id: true, user: { select: { name: true, email: true } } } },
          },
        },
      },
    });
  }

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard, JobsRoleLimitGuard)
  @Roles('CUSTOMER')
  @ApiBearerAuth('bearer')
  @ApiOperation({ summary: 'Create job (customer)', description: 'Rate limited via jobs limiter; configure with JOBS_RATE_* env vars. PII in description is automatically redacted.' })
  @ApiOkResponse({ type: JobDto })
  @ApiBadRequestResponse({ type: ErrorDto })
  @ApiUnauthorizedResponse({ type: ErrorDto })
  @ApiTooManyRequestsResponse({ type: ErrorDto, headers: { 'Retry-After': { description: 'Seconds to wait before retrying', schema: { type: 'string', example: '60' } } } })
  async create(@Req() req: AuthedRequest, @Body() dto: CreateJobDto) {
    return this.jobs.createJob(dto, req.user.sub);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get job by id' })
  @ApiOkResponse({ type: JobDto })
  async getById(@Param('id') id: string) {
    return this.prisma.job.findUnique({
      where: { id },
      select: {
        id: true,
        key: true,
        title: true,
        description: true,
        customerId: true,
        createdAt: true,
        assignment: {
          select: {
            id: true,
            providerId: true,
            acceptedAt: true,
            status: true,
            scheduledStart: true,
            scheduledEnd: true,
            scheduleVersion: true,
            scheduleProposedBy: true,
            scheduleProposedAt: true,
            scheduleNotes: true,
            completedAt: true,
            customerVerifiedAt: true,
            rejectedAt: true,
            reminderStatus: true,
            reminderLastSentAt: true,
            reminderCount: true,
            payoutStatus: true,
            payoutApprovedAt: true,
            payoutApprovedBy: true,
            provider: { select: { id: true, userId: true, user: { select: { name: true, email: true } } } },
          },
        },
      },
    });
  }

  @Post(':id/schedule')
  @UseGuards(JwtAuthGuard, RolesGuard, JobsRoleLimitGuard)
  @Roles('CUSTOMER')
  @ApiBearerAuth('bearer')
  @ApiOperation({ summary: 'Customer proposes a schedule window for the assigned provider' })
  @ApiOkResponse({ type: AssignmentDto })
  @ApiBadRequestResponse({ type: ErrorDto })
  async proposeSchedule(@Param('id') id: string, @Req() req: AuthedRequest, @Body() dto: ProposeScheduleDto) {
    return this.assignments.proposeScheduleAsCustomer(id, req.user.sub, dto);
  }

  // Quotes
  @Post(':id/quotes')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('PROVIDER')
  @ApiBearerAuth('bearer')
  @ApiOperation({ summary: 'Create quote for a job (provider)' })
  @ApiOkResponse({ type: QuoteDto })
  @ApiBody({ type: CreateQuoteDto })
  @ApiBadRequestResponse({ type: ErrorDto })
  @ApiNotFoundResponse({ type: ErrorDto })
  @ApiUnauthorizedResponse({ type: ErrorDto })
  async createQuote(@Param('id') id: string, @Req() req: AuthedRequest, @Body() dto: CreateQuoteDto) {
    return this.quotes.createQuote(id, req.user.sub, dto);
  }

  @Get(':id/quotes')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('bearer')
  @ApiOperation({ summary: 'List quotes for a job (authorized)' })
  @ApiOkResponse({ type: [QuoteWithProviderDto] })
  async listQuotes(@Param('id') id: string, @Req() req: AuthedRequest) {
    return this.quotes.listQuotes(id, req.user.sub);
  }

  @Post(':id/quotes/:quoteId/accept')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('CUSTOMER')
  @ApiBearerAuth('bearer')
  @ApiOperation({ summary: 'Accept a quote (customer)', description: 'Rate limited via quotes limiter; configure with QUOTES_RATE_* env vars' })
  @ApiOkResponse({ type: QuoteDto })
  @ApiBadRequestResponse({ description: 'Reasons include: assignment already exists, a quote already accepted, target quote not pending, or invalid quote/job pair', type: ErrorDto })
  @ApiTooManyRequestsResponse({ description: 'Too many accept attempts', type: ErrorDto, headers: { 'Retry-After': { description: 'Seconds to wait before retrying', schema: { type: 'string', example: '60' } } } })
  @UseGuards(JwtAuthGuard, RolesGuard, QuotesRoleLimitGuard)
  async acceptQuote(@Param('id') id: string, @Param('quoteId') quoteId: string, @Req() req: AuthedRequest) {
    return this.quotes.acceptQuote(id, quoteId, req.user.sub);
  }

  @Post(':id/quotes/revoke')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('CUSTOMER')
  @ApiBearerAuth('bearer')
  @ApiOperation({ summary: 'Revoke an accepted quote (customer)', description: 'Rate limited via quotes limiter; configure with QUOTES_RATE_* env vars' })
  @ApiOkResponse({ description: 'Revocation successful', schema: { type: 'object', properties: { ok: { type: 'boolean' } } } })
  @ApiBadRequestResponse({ description: 'No active acceptance to revoke or not allowed', type: ErrorDto })
  @ApiTooManyRequestsResponse({ description: 'Too many revoke attempts', type: ErrorDto, headers: { 'Retry-After': { description: 'Seconds to wait before retrying', schema: { type: 'string', example: '60' } } } })
  @UseGuards(JwtAuthGuard, RolesGuard, QuotesRoleLimitGuard)
  async revokeAccepted(@Param('id') id: string, @Req() req: AuthedRequest) {
    return this.quotes.revokeAcceptance(id, req.user.sub);
  }

  @Post(':id/complete')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('CUSTOMER')
  @ApiBearerAuth('bearer')
  @ApiOperation({ summary: 'Customer verifies job completed' })
  @ApiOkResponse({ description: 'Updated assignment', schema: { type: 'object' } })
  async customerComplete(@Param('id') id: string, @Req() req: AuthedRequest) {
    const job = await this.prisma.job.findUnique({ where: { id }, select: { id: true, customerId: true, assignment: { select: { id: true, status: true } } } });
    if (!job || job.customerId !== req.user.sub) throw new ForbiddenException('Not allowed');
    if (!job.assignment) throw new BadRequestException('No active assignment');
    const updated = await this.prisma.assignment.update({
      where: { id: job.assignment.id },
      data: { status: ASSIGNMENT_STATUS.CUSTOMER_VERIFIED, customerVerifiedAt: new Date() },
    });
    this.metrics.incPaymentInitiate('job_complete');
    const paymentResult = await this.payments.handleCustomerVerification(id);
    this.logger.log(`Payment capture mode for job ${id}: ${paymentResult.mode}`);
    return updated;
  }
}
