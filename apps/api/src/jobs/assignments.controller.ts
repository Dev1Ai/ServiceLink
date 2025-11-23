import { Body, Controller, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AssignmentsService } from './assignments.service';
import { ConfirmScheduleDto, ProposeScheduleDto, RejectAssignmentDto, AssignmentDto } from './dto/schedule.dto';
import { CheckInDto, CheckOutDto, CreateLocationUpdateDto } from './dto/checkpoint.dto';
import { JwtAuthGuard, Roles, RolesGuard } from '../auth/jwt.guard';
import type { AuthedRequest } from '../common/types/request';
import { ProvidersRoleLimitGuard } from '../common/guards/providers-role-limit.guard';

@ApiTags('assignments')
@Controller('assignments')
export class AssignmentsController {
  constructor(private readonly assignments: AssignmentsService) {}

  @Post(':id/schedule')
  @UseGuards(JwtAuthGuard, RolesGuard, ProvidersRoleLimitGuard)
  @Roles('PROVIDER')
  @ApiBearerAuth('bearer')
  @ApiOperation({ summary: 'Provider proposes or updates a schedule window' })
  @ApiOkResponse({ type: AssignmentDto })
  async proposeAsProvider(@Param('id') id: string, @Req() req: AuthedRequest, @Body() dto: ProposeScheduleDto) {
    return this.assignments.proposeScheduleAsProvider(id, req.user.sub, dto);
  }

  @Post(':id/schedule/confirm')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('PROVIDER', 'CUSTOMER')
  @ApiBearerAuth('bearer')
  @ApiOperation({ summary: 'Confirm the current scheduled visit window' })
  @ApiOkResponse({ type: AssignmentDto })
  async confirmSchedule(@Param('id') id: string, @Req() req: AuthedRequest, @Body() dto: ConfirmScheduleDto) {
    const role = req.user.role === 'PROVIDER' ? 'PROVIDER' : 'CUSTOMER';
    return this.assignments.confirmSchedule(id, { userId: req.user.sub, role }, dto);
  }

  @Post(':id/reject')
  @UseGuards(JwtAuthGuard, RolesGuard, ProvidersRoleLimitGuard)
  @Roles('PROVIDER')
  @ApiBearerAuth('bearer')
  @ApiOperation({ summary: 'Provider rejects the assignment after acceptance' })
  @ApiOkResponse({ type: AssignmentDto })
  async rejectAssignment(@Param('id') id: string, @Req() req: AuthedRequest, @Body() dto: RejectAssignmentDto) {
    return this.assignments.rejectAssignment(id, req.user.sub, dto);
  }

  // M11 Phase 2: GPS Features

  @Post(':id/check-in')
  @UseGuards(JwtAuthGuard, RolesGuard, ProvidersRoleLimitGuard)
  @Roles('PROVIDER')
  @ApiBearerAuth('bearer')
  @ApiOperation({ summary: 'Provider check-in to job site' })
  async checkIn(@Param('id') id: string, @Req() req: AuthedRequest, @Body() dto: CheckInDto) {
    return this.assignments.checkIn(id, req.user.sub, dto);
  }

  @Post(':id/check-out')
  @UseGuards(JwtAuthGuard, RolesGuard, ProvidersRoleLimitGuard)
  @Roles('PROVIDER')
  @ApiBearerAuth('bearer')
  @ApiOperation({ summary: 'Provider check-out from job site' })
  async checkOut(@Param('id') id: string, @Req() req: AuthedRequest, @Body() dto: CheckOutDto) {
    return this.assignments.checkOut(id, req.user.sub, dto);
  }

  @Get(':id/checkpoints')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('bearer')
  @ApiOperation({ summary: 'Get check-in/check-out checkpoints for assignment' })
  async getCheckpoints(@Param('id') id: string, @Req() req: AuthedRequest) {
    return this.assignments.getCheckpoints(id, req.user.sub);
  }

  @Post(':id/location')
  @UseGuards(JwtAuthGuard, RolesGuard, ProvidersRoleLimitGuard)
  @Roles('PROVIDER')
  @ApiBearerAuth('bearer')
  @ApiOperation({ summary: 'Update provider location (real-time tracking)' })
  async updateLocation(@Param('id') id: string, @Req() req: AuthedRequest, @Body() dto: CreateLocationUpdateDto) {
    return this.assignments.updateLocation(id, req.user.sub, dto);
  }

  @Get(':id/location')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('CUSTOMER')
  @ApiBearerAuth('bearer')
  @ApiOperation({ summary: 'Get latest provider location (customer only)' })
  async getLatestLocation(@Param('id') id: string, @Req() req: AuthedRequest) {
    return this.assignments.getLatestLocation(id, req.user.sub);
  }
}
