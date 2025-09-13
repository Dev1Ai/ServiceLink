import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard, Roles, RolesGuard } from '../auth/jwt.guard';
import { ProvidersService } from './providers.service';
import { OnboardingLinkDto } from './dto/provider.dto';
import { UserDetailDto } from '../users/dto/user.dto';

@ApiTags('providers')
@Controller('providers')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth('bearer')
export class ProvidersController {
  constructor(private readonly providers: ProvidersService) {}

  @Post('onboarding')
  @Roles('PROVIDER')
  @ApiOperation({ summary: 'Create Stripe Connect onboarding link for provider' })
  @ApiOkResponse({ type: OnboardingLinkDto })
  async onboarding(@Req() req: any) {
    return this.providers.createOnboardingLink(req.user.sub);
  }

  @Get('me')
  @Roles('PROVIDER')
  @ApiOperation({ summary: 'Get current provider profile' })
  @ApiOkResponse({ type: UserDetailDto })
  async me(@Req() req: any) {
    return this.providers.getMe(req.user.sub);
  }
}
