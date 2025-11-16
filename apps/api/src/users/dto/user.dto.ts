import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

export class UserListItemDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  email!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty({ enum: ["CUSTOMER", "PROVIDER", "ADMIN"] })
  role!: "CUSTOMER" | "PROVIDER" | "ADMIN";

  // status removed from current schema

  @ApiProperty({ type: String, format: "date-time" })
  createdAt!: Date;
}

export class ProfileDto {
  @ApiPropertyOptional()
  firstName?: string | null;

  @ApiPropertyOptional()
  lastName?: string | null;

  @ApiPropertyOptional()
  avatarUrl?: string | null;

  // city/state/rating not in current schema
}

export class ProviderSummaryDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  kycStatus!: string;

  @ApiProperty({ required: false, nullable: true })
  stripeAccountId?: string | null;

  @ApiProperty()
  online!: boolean;

  @ApiProperty({ required: false, nullable: true })
  serviceRadiusKm?: number | null;
}

export class UserDetailDto extends UserListItemDto {
  @ApiPropertyOptional({ type: ProfileDto, nullable: true })
  profile?: ProfileDto | null;

  @ApiPropertyOptional({ type: ProviderSummaryDto, nullable: true })
  provider?: ProviderSummaryDto | null;
}

export class PaginatedUsersDto {
  @ApiProperty({ type: [UserListItemDto] })
  items!: UserListItemDto[];

  @ApiPropertyOptional()
  nextCursor?: string;
}
