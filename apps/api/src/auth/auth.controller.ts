import { Controller, Post, Body, Get, Req, UseGuards } from '@nestjs/common';
import { AuthService } from './auth.service';
import { ApiBadRequestResponse, ApiBearerAuth, ApiBody, ApiOkResponse, ApiOperation, ApiTags, ApiTooManyRequestsResponse, ApiUnauthorizedResponse } from '@nestjs/swagger';
import { JwtAuthGuard } from './jwt.guard';
import { UserDetailDto } from '../users/dto/user.dto';
import { LoginDto, SignupDto, TokenResponseDto } from './dto/auth.dto';
import { ErrorDto } from '../common/dto/error.dto';
import { AuthRateLimitGuard } from '../common/guards/auth-rate-limit.guard';
import type { AuthedRequest } from '../common/types/request';


@Controller('auth')
@ApiTags('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('signup')
  @ApiOperation({ summary: 'Create a new account', description: 'Rate limited; configure via AUTH_SIGNUP_RATE_* env vars (per-role overrides supported)' })
  @ApiBody({ type: SignupDto })
  @ApiOkResponse({ type: TokenResponseDto })
  @ApiBadRequestResponse({ type: ErrorDto })
  @ApiTooManyRequestsResponse({ description: 'Too many requests', type: ErrorDto, headers: { 'Retry-After': { description: 'Seconds to wait before retrying', schema: { type: 'string', example: '60' } } } })
  @UseGuards(AuthRateLimitGuard)
  async signup(@Body() body: SignupDto) {
    return this.authService.signup(body.email, body.password, body.name, body.role);
  }

  @Post('login')
  @ApiOperation({ summary: 'Login with email and password', description: 'Rate limited; configure via AUTH_LOGIN_RATE_* env vars' })
  @ApiBody({ type: LoginDto })
  @ApiOkResponse({ type: TokenResponseDto })
  @ApiUnauthorizedResponse({ type: ErrorDto })
  @ApiTooManyRequestsResponse({ description: 'Too many requests', type: ErrorDto, headers: { 'Retry-After': { description: 'Seconds to wait before retrying', schema: { type: 'string', example: '60' } } } })
  @UseGuards(AuthRateLimitGuard)
  async login(@Body() body: LoginDto) {
    return this.authService.login(body.email, body.password);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('bearer')
  @ApiOperation({ summary: 'Get current user' })
  @ApiOkResponse({ description: 'Current user summary', type: UserDetailDto })
  async me(@Req() req: AuthedRequest) {
    return this.authService.me(req.user.sub);
  }
}
