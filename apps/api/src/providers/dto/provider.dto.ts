import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

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

  @ApiProperty({ enum: ["CUSTOMER", "PROVIDER", "ADMIN"] })
  role!: "CUSTOMER" | "PROVIDER" | "ADMIN";

  @ApiPropertyOptional({ type: ProfileLiteDto, nullable: true })
  profile?: ProfileLiteDto | null;

  @ApiProperty({ type: ProviderSummaryDto })
  provider!: ProviderSummaryDto;
}

export class UserLiteDto {
  @ApiPropertyOptional()
  name?: string | null;

  @ApiProperty()
  email!: string;
}

export class ServiceCategoryDto {
  @ApiProperty()
  name!: string;

  @ApiProperty()
  slug!: string;
}

export class ServiceDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  name!: string;

  @ApiPropertyOptional({ nullable: true })
  price?: number | null;

  @ApiPropertyOptional()
  description?: string;

  @ApiPropertyOptional({ type: ServiceCategoryDto, nullable: true })
  category?: ServiceCategoryDto | null;
}

export class ProviderListItemDto {
  @ApiProperty() id!: string;
  @ApiProperty() userId!: string;
  @ApiProperty() online!: boolean;
  @ApiPropertyOptional({ nullable: true }) serviceRadiusKm?: number | null;
  @ApiPropertyOptional({ nullable: true }) lat?: number | null;
  @ApiPropertyOptional({ nullable: true }) lng?: number | null;
  @ApiProperty({ type: UserLiteDto }) user!: UserLiteDto;
  @ApiProperty({ type: [ServiceDto] }) services!: ServiceDto[];
  @ApiPropertyOptional({ nullable: true }) minServicePrice?: number | null;
}

export class ProviderNearItemDto extends ProviderListItemDto {
  @ApiProperty() distanceKm!: number;
}

export class ProvidersSearchResponseDto {
  @ApiProperty({ type: [ProviderListItemDto] }) items!: ProviderListItemDto[];
  @ApiProperty() total!: number;
  @ApiProperty() page!: number;
  @ApiProperty() take!: number;
  @ApiProperty() hasNext!: boolean;
}

export class ProvidersNearResponseDto {
  @ApiProperty({ type: [ProviderNearItemDto] }) items!: ProviderNearItemDto[];
  @ApiProperty() total!: number;
  @ApiProperty() page!: number;
  @ApiProperty() take!: number;
  @ApiProperty() hasNext!: boolean;
}
