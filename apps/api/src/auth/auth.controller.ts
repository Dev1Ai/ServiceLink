import { Controller, Post, Body, Get, Req, UseGuards } from '@nestjs/common';
import { AuthService } from './auth.service';
import { ApiBearerAuth, ApiBody, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from './jwt.guard';
import { UserDetailDto } from '../users/dto/user.dto';

@Controller('auth')
@ApiTags('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('signup')
  @ApiOperation({ summary: 'Create a new account' })
  @ApiBody({ schema: { properties: { email: { type: 'string' }, password: { type: 'string' }, name: { type: 'string' }, role: { type: 'string', enum: ['CUSTOMER','PROVIDER','ADMIN'] } }, required: ['email','password','name'] } })
  async signup(@Body() body: { email: string; password: string; name: string; role?: string }) {
    return this.authService.signup(body.email, body.password, body.name, body.role);
  }

  @Post('login')
  @ApiOperation({ summary: 'Login with email and password' })
  @ApiBody({ schema: { properties: { email: { type: 'string' }, password: { type: 'string' } }, required: ['email','password'] } })
  async login(@Body() body: { email: string; password: string }) {
    return this.authService.login(body.email, body.password);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('bearer')
  @ApiOperation({ summary: 'Get current user' })
  @ApiOkResponse({ description: 'Current user summary', type: UserDetailDto })
  async me(@Req() req: any) {
    return this.authService.me(req.user.sub);
  }
}
