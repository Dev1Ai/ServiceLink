import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class OnboardingLinkDto {
  @ApiProperty()
  url!: string;
}

export class ProviderSummaryDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  kycStatus!: string;

  @ApiPropertyOptional()
  stripeAccountId?: string | null;

  @ApiProperty()
  online!: boolean;

  @ApiProperty({ nullable: true })
  serviceRadiusKm!: number | null;
}

export class ProfileLiteDto {
  @ApiPropertyOptional()
  firstName?: string | null;

  @ApiPropertyOptional()
  lastName?: string | null;

  @ApiPropertyOptional()
  avatarUrl?: string | null;
}

export class ProviderMeDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  email!: string;

  @ApiProperty({ enum: ['CUSTOMER', 'PROVIDER', 'ADMIN'] })
  role!: 'CUSTOMER' | 'PROVIDER' | 'ADMIN';

  @ApiPropertyOptional({ type: ProfileLiteDto, nullable: true })
  profile?: ProfileLiteDto | null;

  @ApiProperty({ type: ProviderSummaryDto })
  provider!: ProviderSummaryDto;
}

