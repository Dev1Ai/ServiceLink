import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class UserListItemDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  email!: string;

  @ApiProperty({ enum: ['customer', 'provider', 'admin'] })
  role!: 'customer' | 'provider' | 'admin';

  @ApiProperty()
  status!: string;

  @ApiProperty({ type: String, format: 'date-time' })
  createdAt!: Date;
}

export class ProfileDto {
  @ApiPropertyOptional()
  firstName?: string | null;

  @ApiPropertyOptional()
  lastName?: string | null;

  @ApiPropertyOptional()
  avatarUrl?: string | null;

  @ApiPropertyOptional()
  city?: string | null;

  @ApiPropertyOptional()
  state?: string | null;

  @ApiProperty()
  rating!: number;
}

export class UserDetailDto extends UserListItemDto {
  @ApiPropertyOptional({ type: ProfileDto, nullable: true })
  profile?: ProfileDto | null;
}

export class PaginatedUsersDto {
  @ApiProperty({ type: [UserListItemDto] })
  items!: UserListItemDto[];

  @ApiPropertyOptional()
  nextCursor?: string;
}

