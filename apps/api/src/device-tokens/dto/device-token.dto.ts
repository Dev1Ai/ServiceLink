import { ApiProperty } from '@nestjs/swagger';

export class DeviceTokenDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  userId!: string;

  @ApiProperty()
  token!: string;

  @ApiProperty({ enum: ['ios', 'android', 'web'] })
  platform!: string;

  @ApiProperty()
  active!: boolean;

  @ApiProperty()
  lastUsed!: Date;

  @ApiProperty()
  createdAt!: Date;

  @ApiProperty()
  updatedAt!: Date;
}
