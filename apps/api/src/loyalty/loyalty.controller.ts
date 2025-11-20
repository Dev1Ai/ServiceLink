import { Body, Controller, Get, Post, Req, UseGuards, Param } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiOkResponse, ApiTags, ApiBadRequestResponse, ApiNotFoundResponse } from '@nestjs/swagger';
import { JwtAuthGuard, Roles, RolesGuard } from '../auth/jwt.guard';
import { LoyaltyService } from './loyalty.service';
import { ErrorDto } from '../common/dto/error.dto';
import type { AuthedRequest } from '../common/types/request';

/**
 * Loyalty Program Controller
 * - Get loyalty account summary
 * - View available rewards for tier
 * - Redeem points for rewards
 * - Apply rewards to jobs
 */
@ApiTags('loyalty')
@Controller('loyalty')
export class LoyaltyController {
  constructor(private readonly loyalty: LoyaltyService) {}

  @Get('account')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('CUSTOMER')
  @ApiBearerAuth('bearer')
  @ApiOperation({ summary: 'Get loyalty account summary for current user' })
  @ApiOkResponse({ description: 'Loyalty account with points, tier, and recent activity' })
  async getAccount(@Req() req: AuthedRequest) {
    return this.loyalty.getAccountSummary(req.user.sub);
  }

  @Get('rewards')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('CUSTOMER')
  @ApiBearerAuth('bearer')
  @ApiOperation({ summary: 'Get available rewards for user tier' })
  @ApiOkResponse({ description: 'Available rewards based on user tier' })
  async getAvailableRewards(@Req() req: AuthedRequest) {
    return this.loyalty.getAvailableRewards(req.user.sub);
  }

  @Post('redeem')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('CUSTOMER')
  @ApiBearerAuth('bearer')
  @ApiOperation({ summary: 'Redeem points for a reward' })
  @ApiOkResponse({ description: 'Reward created with unique code' })
  @ApiBadRequestResponse({ type: ErrorDto, description: 'Insufficient points' })
  async redeemReward(
    @Req() req: AuthedRequest,
    @Body() body: {
      type: 'DISCOUNT_PERCENT' | 'DISCOUNT_FIXED' | 'FREE_SERVICE';
      value: number;
      pointsCost: number;
      description: string;
    },
  ) {
    return this.loyalty.redeemReward(
      req.user.sub,
      body.type,
      body.pointsCost,
      body.value,
      body.description,
    );
  }

  @Post('apply/:code/:jobId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('CUSTOMER')
  @ApiBearerAuth('bearer')
  @ApiOperation({ summary: 'Apply reward code to a job' })
  @ApiOkResponse({ description: 'Reward applied to job' })
  @ApiNotFoundResponse({ type: ErrorDto, description: 'Reward not found or expired' })
  async applyReward(
    @Req() req: AuthedRequest,
    @Param('code') code: string,
    @Param('jobId') jobId: string,
  ) {
    return this.loyalty.applyReward(req.user.sub, code, jobId);
  }
}
