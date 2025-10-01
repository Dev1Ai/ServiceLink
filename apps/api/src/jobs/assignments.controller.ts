import { Body, Controller, Param, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AssignmentsService } from './assignments.service';
import { ConfirmScheduleDto, ProposeScheduleDto, RejectAssignmentDto, AssignmentDto } from './dto/schedule.dto';
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
}
