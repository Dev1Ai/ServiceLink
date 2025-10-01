import { Body, Controller, Get, Post, Req, UseGuards, Param } from '@nestjs/common';
import { ApiBearerAuth, ApiForbiddenResponse, ApiOkResponse, ApiOperation, ApiQuery, ApiTags, ApiTooManyRequestsResponse, ApiUnauthorizedResponse } from '@nestjs/swagger';
import { JwtAuthGuard, Roles, RolesGuard } from '../auth/jwt.guard';
import { ProvidersService } from './providers.service';
import { OnboardingLinkDto, ProvidersNearResponseDto, ProvidersSearchResponseDto } from './dto/provider.dto';
import { UserDetailDto } from '../users/dto/user.dto';
import { ErrorDto } from '../common/dto/error.dto';
import { PrismaService } from '../prisma/prisma.service';
import { LocationDto } from './dto/location.dto';
import { ProvidersRoleLimitGuard } from '../common/guards/providers-role-limit.guard';
import { SearchRoleLimitGuard } from '../common/guards/search-role-limit.guard';
// import type { Request } from 'express';
import type { Prisma } from '@prisma/client';
import { NearProvidersQueryDto, SearchProvidersQueryDto } from './dto/search.dto';
import { Query } from '@nestjs/common';
import type { AuthedRequest } from '../common/types/request';
import { AssignmentsService } from '../jobs/assignments.service';

/**
 * Providers Controller
 * - Search providers by service/category/price/online filters (GET /providers/search)
 * - Find providers near lat/lng with optional radius and filters (GET /providers/near)
 * - Provider profile helpers: get own profile, update location
 * - Rate-limited via Search/Providers role guards; JWT required except where noted
 */
@ApiTags('providers')
@Controller('providers')
export class ProvidersController {
  constructor(
    private readonly providers: ProvidersService,
    private readonly prisma: PrismaService,
    private readonly assignments: AssignmentsService,
  ) {}

  @Post('onboarding')
  @Roles('PROVIDER')
  @UseGuards(JwtAuthGuard, RolesGuard, ProvidersRoleLimitGuard)
  @ApiOperation({ summary: 'Create Stripe Connect onboarding link for provider' })
  @ApiOkResponse({ type: OnboardingLinkDto })
  @ApiUnauthorizedResponse({ type: ErrorDto })
  @ApiForbiddenResponse({ type: ErrorDto })
  @ApiTooManyRequestsResponse({ description: 'Too many requests', type: ErrorDto, headers: { 'Retry-After': { description: 'Seconds to wait before retrying', schema: { type: 'string', example: '60' } } } })
  async onboarding(@Req() req: AuthedRequest) {
    return this.providers.createOnboardingLink(req.user.sub);
  }

  @Get('me')
  @Roles('PROVIDER')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiBearerAuth('bearer')
  @ApiOperation({ summary: 'Get current provider profile' })
  @ApiOkResponse({ type: UserDetailDto })
  @ApiUnauthorizedResponse({ type: ErrorDto })
  @ApiForbiddenResponse({ type: ErrorDto })
  async me(@Req() req: AuthedRequest) {
    return this.providers.getMe(req.user.sub);
  }

  @Get('search')
  @ApiOperation({ summary: 'Search providers by service name (simple)', description: 'Rate limited via search limiter; configure with SEARCH_RATE_* env vars' })
  @ApiOkResponse({ description: 'Paginated providers', type: ProvidersSearchResponseDto })
  @ApiQuery({ name: 'q', required: false, description: 'Service name contains' })
  @ApiQuery({ name: 'service', required: false, description: 'Exact service name filter (case-insensitive)' })
  @ApiQuery({ name: 'category', required: false, description: 'Category slug filter (case-insensitive)' })
  @ApiQuery({ name: 'onlineOnly', required: false, description: 'Filter to online providers', schema: { type: 'boolean' } })
  @ApiQuery({ name: 'minPrice', required: false, description: 'Minimum service price', schema: { type: 'number' } })
  @ApiQuery({ name: 'maxPrice', required: false, description: 'Maximum service price', schema: { type: 'number' } })
  @ApiQuery({ name: 'page', required: false, description: 'Page number (1+)', schema: { type: 'integer', default: 1 } })
  @ApiQuery({ name: 'take', required: false, description: 'Page size (1-100)', schema: { type: 'integer', default: 50 } })
  @ApiQuery({ name: 'sort', required: false, description: 'Sort by price | online', schema: { type: 'string', default: 'price' } })
  @ApiQuery({ name: 'order', required: false, description: 'asc | desc', schema: { type: 'string', default: 'asc' } })
  @ApiQuery({ name: 'lat', required: false, description: 'Latitude for optional radius filter', schema: { type: 'number' } })
  @ApiQuery({ name: 'lng', required: false, description: 'Longitude for optional radius filter', schema: { type: 'number' } })
  @ApiQuery({ name: 'radiusKm', required: false, description: 'Radius (km) for optional location filter', schema: { type: 'number' } })
  @UseGuards(SearchRoleLimitGuard)
  @ApiTooManyRequestsResponse({ type: ErrorDto, headers: { 'Retry-After': { description: 'Seconds to wait before retrying', schema: { type: 'string', example: '60' } } } })
  async search(@Query() dto: SearchProvidersQueryDto) {
    const q = dto.q?.trim();
    const serviceName = dto.service?.trim();
    const categorySlug = dto.category?.trim();
    const onlineOnly = !!dto.onlineOnly;
    const minPrice = dto.minPrice ?? NaN;
    const maxPrice = dto.maxPrice ?? NaN;
    const page = dto.page ?? 1;
    const take = dto.take ?? 50;
    // const skip = (page - 1) * take; // not used; results are post-filtered client-side
    const filters: Prisma.ProviderWhereInput[] = [];
    if (q) filters.push({ services: { some: { name: { contains: q, mode: 'insensitive' } } } });
    if (onlineOnly) filters.push({ online: true });
    if (isFinite(minPrice)) filters.push({ services: { some: { price: { gte: Number(minPrice) } } } });
    if (isFinite(maxPrice)) filters.push({ services: { some: { price: { lte: Number(maxPrice) } } } });
    if (serviceName) filters.push({ services: { some: { name: { equals: serviceName, mode: 'insensitive' } } } });
    if (categorySlug) filters.push({ services: { some: { category: { slug: { equals: categorySlug, mode: 'insensitive' } } } } });
    const where: Prisma.ProviderWhereInput = filters.length ? { AND: filters } : {};
    const sort = dto.sort ?? 'price';
    const order = dto.order ?? 'asc';
    const lat = dto.lat as number;
    const lng = dto.lng as number;
    const radiusKm = dto.radiusKm as number;
    const useRadius = isFinite(lat) && isFinite(lng) && isFinite(radiusKm) && radiusKm > 0;
    const radiusWhere: Prisma.ProviderWhereInput = {
      AND: [...filters, { lat: { not: null } }, { lng: { not: null } }],
    };
    const radiusSelect = {
      id: true,
      userId: true,
      serviceRadiusKm: true,
      online: true,
      lat: true,
      lng: true,
      services: { select: { id: true, name: true, price: true, description: true } },
      user: { select: { email: true, name: true } },
    } satisfies Prisma.ProviderSelect;
    if (useRadius) {
      const rows = await this.prisma.provider.findMany({
        where: radiusWhere,
        select: radiusSelect,
        take: Math.max(take * 10, 1000),
      });
      const toRad = (d: number) => (d * Math.PI) / 180;
      const R = 6371;
      type RowWithDist = Prisma.ProviderGetPayload<{ select: typeof radiusSelect }> & {
        distanceKm: number;
        minServicePrice: number | null;
      };
      const withDist: RowWithDist[] = rows
        .map((p) => {
          const dLat = toRad((p.lat || 0) - lat);
          const dLng = toRad((p.lng || 0) - lng);
          const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat)) * Math.cos(toRad(p.lat || 0)) * Math.sin(dLng / 2) ** 2;
          const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
          const dist = R * c;
          const minServicePrice = p.services.reduce((acc: number, s: { price: number | null }) => (typeof s.price === 'number' ? Math.min(acc, s.price || Infinity) : acc), Infinity);
          return { ...p, distanceKm: dist, minServicePrice: isFinite(minServicePrice) ? minServicePrice : null };
        })
        .filter((p) => p.distanceKm <= (radiusKm || 25) && (!p.serviceRadiusKm || p.distanceKm <= p.serviceRadiusKm));
      // Note: sorting by sort param (price|online)
      withDist.sort((a, b) => {
        if (sort === 'online') {
          const av = a.online ? 1 : 0;
          const bv = b.online ? 1 : 0;
          return (order === 'asc' ? av - bv : bv - av) || a.distanceKm - b.distanceKm;
        }
        const av = a.minServicePrice ?? Infinity;
        const bv = b.minServicePrice ?? Infinity;
        return (order === 'asc' ? av - bv : bv - av) || a.distanceKm - b.distanceKm;
      });
      const total = withDist.length;
      const start = (page - 1) * take;
      const paged = withDist.slice(start, start + take);
      return { items: paged, total, page, take, hasNext: start + paged.length < total };
    } else {
      const total = await this.prisma.provider.count({ where });
      const nonRadiusSelect = {
        id: true,
        userId: true,
        serviceRadiusKm: true,
        online: true,
        lat: true,
        lng: true,
        services: {
          select: {
            id: true,
            name: true,
            price: true,
            description: true,
            category: { select: { name: true, slug: true } },
          },
        },
        user: { select: { email: true, name: true } },
      } satisfies Prisma.ProviderSelect;
      const rows = await this.prisma.provider.findMany({
        where,
        select: nonRadiusSelect,
        take: Math.max(take * 5, 500),
      });
      const withPrice = rows.map((p) => {
        const minServicePrice = p.services.reduce((acc: number, s: { price: number | null }) => (typeof s.price === 'number' ? Math.min(acc, s.price || Infinity) : acc), Infinity);
        return { ...p, minServicePrice: isFinite(minServicePrice) ? minServicePrice : null };
      });
      withPrice.sort((a, b) => {
        if (sort === 'online') {
          const av = a.online ? 1 : 0;
          const bv = b.online ? 1 : 0;
          return (order === 'asc' ? av - bv : bv - av);
        }
        const av = a.minServicePrice ?? Infinity;
        const bv = b.minServicePrice ?? Infinity;
        return order === 'asc' ? av - bv : bv - av;
      });
      const start = (page - 1) * take;
      const paged = withPrice.slice(start, start + take);
      return { items: paged, total, page, take, hasNext: start + paged.length < total };
    }
  }

  @Post('location')
  @UseGuards(JwtAuthGuard, RolesGuard, ProvidersRoleLimitGuard)
  @Roles('PROVIDER')
  @ApiBearerAuth('bearer')
  @ApiOperation({ summary: 'Update provider location { lat, lng }' })
  @ApiOkResponse({ description: 'Updated provider', schema: { type: 'object' } })
  @ApiTooManyRequestsResponse({ type: ErrorDto, headers: { 'Retry-After': { description: 'Seconds to wait before retrying', schema: { type: 'string', example: '60' } } } })
  async setLocation(@Req() req: AuthedRequest, @Body() body: LocationDto) {
    const userId = req.user.sub;
    const provider = await this.prisma.provider.findUnique({ where: { userId } });
    if (!provider) return { ok: false };
    const lat = Number(body.lat);
    const lng = Number(body.lng);
    if (!isFinite(lat) || !isFinite(lng)) return { ok: false };
    return this.prisma.provider.update({ where: { id: provider.id }, data: { lat, lng } });
  }

  @Get('near')
  @ApiOperation({ summary: 'Find providers near lat/lng within radiusKm (and optional service name q)', description: 'Rate limited via search limiter; configure with SEARCH_RATE_* env vars' })
  @ApiOkResponse({ description: 'Paginated providers with distanceKm', type: ProvidersNearResponseDto })
  @ApiQuery({ name: 'lat', required: true, schema: { type: 'number' } })
  @ApiQuery({ name: 'lng', required: true, schema: { type: 'number' } })
  @ApiQuery({ name: 'radiusKm', required: false, schema: { type: 'number', default: 25 } })
  @ApiQuery({ name: 'q', required: false, description: 'Service name contains' })
  @ApiQuery({ name: 'service', required: false, description: 'Exact service name filter (case-insensitive)' })
  @ApiQuery({ name: 'onlineOnly', required: false, description: 'Filter to online providers', schema: { type: 'boolean' } })
  @ApiQuery({ name: 'category', required: false, description: 'Category slug filter (case-insensitive)' })
  @ApiQuery({ name: 'minPrice', required: false, description: 'Minimum service price', schema: { type: 'number' } })
  @ApiQuery({ name: 'maxPrice', required: false, description: 'Maximum service price', schema: { type: 'number' } })
  @ApiQuery({ name: 'sort', required: false, description: 'Sort by distance | price | online', schema: { type: 'string', default: 'distance' } })
  @ApiQuery({ name: 'order', required: false, description: 'asc | desc', schema: { type: 'string', default: 'asc' } })
  @ApiQuery({ name: 'page', required: false, description: 'Page number (1+)', schema: { type: 'integer', default: 1 } })
  @ApiQuery({ name: 'take', required: false, description: 'Page size (1-100)', schema: { type: 'integer', default: 50 } })
  @UseGuards(SearchRoleLimitGuard)
  @ApiTooManyRequestsResponse({ type: ErrorDto })
  async near(@Query() req: NearProvidersQueryDto) {
    const lat = req.lat;
    const lng = req.lng;
    const radiusKm = req.radiusKm ?? 25;
    const q = req.q?.trim();
    const serviceName = req.service?.trim();
    const categorySlug = req.category?.trim();
    const onlineOnly = !!req.onlineOnly;
    const minPrice = req.minPrice ?? NaN;
    const maxPrice = req.maxPrice ?? NaN;
    const sort = req.sort ?? 'distance';
    const rank = req.rank ?? 'balanced';
    const order = req.order ?? 'asc';
    const page = req.page ?? 1;
    const take = req.take ?? 50;
    if (!isFinite(lat) || !isFinite(lng)) return { items: [], total: 0, page, take, hasNext: false };
    const nearFilters: Prisma.ProviderWhereInput[] = [
      { lat: { not: null } },
      { lng: { not: null } },
    ];
    if (q) nearFilters.push({ services: { some: { name: { contains: q, mode: 'insensitive' } } } });
    if (serviceName) nearFilters.push({ services: { some: { name: { equals: serviceName, mode: 'insensitive' } } } });
    if (categorySlug) nearFilters.push({ services: { some: { category: { slug: { equals: categorySlug, mode: 'insensitive' } } } } });
    if (onlineOnly) nearFilters.push({ online: true });
    if (isFinite(minPrice)) nearFilters.push({ services: { some: { price: { gte: Number(minPrice) } } } });
    if (isFinite(maxPrice)) nearFilters.push({ services: { some: { price: { lte: Number(maxPrice) } } } });
    const nearWhere: Prisma.ProviderWhereInput = { AND: nearFilters };
    const nearSelect = {
      id: true,
      userId: true,
      lat: true,
      lng: true,
      serviceRadiusKm: true,
      online: true,
      services: { select: { id: true, name: true, price: true, category: { select: { name: true, slug: true } } } },
      user: { select: { name: true, email: true } },
    } satisfies Prisma.ProviderSelect;
    const rows = await this.prisma.provider.findMany({
      where: nearWhere,
      select: nearSelect,
      take: 500,
    });
    const toRad = (d: number) => (d * Math.PI) / 180;
    const R = 6371; // km
    const withDist = rows
      .map((p) => {
        const dLat = toRad((p.lat || 0) - lat);
        const dLng = toRad((p.lng || 0) - lng);
        const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat)) * Math.cos(toRad(p.lat || 0)) * Math.sin(dLng / 2) ** 2;
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        const dist = R * c;
        const minServicePrice = p.services.reduce((acc: number, s: { price: number | null }) => (typeof s.price === 'number' ? Math.min(acc, s.price || Infinity) : acc), Infinity);
        return { ...p, distanceKm: dist, minServicePrice: isFinite(minServicePrice) ? minServicePrice : null };
      })
      .filter((p) => p.distanceKm <= (radiusKm || 25) && (!p.serviceRadiusKm || p.distanceKm <= p.serviceRadiusKm))
      .sort((a, b) => {
        if (sort === 'rank') {
          const weights = (() => {
            switch (rank) {
              case 'cheap': return { wd: 0.3, wp: 0.6, wo: 0.1 };
              case 'near': return { wd: 0.7, wp: 0.2, wo: 0.1 };
              case 'online': return { wd: 0.4, wp: 0.2, wo: 0.4 };
              default: return { wd: 0.5, wp: 0.4, wo: 0.1 };
            }
          })();
          const norm = (x: number, max: number) => (max > 0 ? Math.min(1, Math.max(0, x / max)) : 0);
          const maxDist = Math.max(a.distanceKm, b.distanceKm, radiusKm || 1);
          const maxPrice = Math.max(a.minServicePrice ?? 0, b.minServicePrice ?? 0, 1);
          const score = (p: { distanceKm: number; minServicePrice: number | null; online: boolean }) => {
            const nd = norm(p.distanceKm, maxDist);
            const np = norm(p.minServicePrice ?? 0, maxPrice);
            const no = p.online ? 0 : 1;
            return weights.wd * nd + weights.wp * np + weights.wo * no;
          };
          const delta = score(a) - score(b);
          return delta === 0 ? a.distanceKm - b.distanceKm : delta;
        }
        if (sort === 'price') {
          const av = a.minServicePrice ?? Infinity;
          const bv = b.minServicePrice ?? Infinity;
          return (order === 'asc' ? av - bv : bv - av) || a.distanceKm - b.distanceKm;
        }
        if (sort === 'online') {
          const av = a.online ? 1 : 0;
          const bv = b.online ? 1 : 0;
          return (order === 'asc' ? av - bv : bv - av) || a.distanceKm - b.distanceKm;
        }
        return order === 'asc' ? a.distanceKm - b.distanceKm : b.distanceKm - a.distanceKm;
      });
    const start = (page - 1) * take;
    const paged = withDist.slice(start, start + take);
    return { items: paged, total: withDist.length, page, take, hasNext: start + paged.length < withDist.length };
  }

  @Get('quotes')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('PROVIDER')
  @ApiBearerAuth('bearer')
  @ApiOperation({ summary: 'List quotes for current provider' })
  @ApiOkResponse({ description: 'List of quotes with job info', schema: { type: 'array', items: { type: 'object' } } })
  async myQuotes(@Req() req: AuthedRequest) {
    const userId = req.user.sub;
    const provider = await this.prisma.provider.findUnique({ where: { userId } });
    if (!provider) return [];
    return this.prisma.quote.findMany({
      where: { providerId: provider.id },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        total: true,
        status: true,
        createdAt: true,
        job: { select: { id: true, key: true, title: true, description: true, createdAt: true } },
      },
      take: 100,
    });
  }

  @Get('assignments')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('PROVIDER')
  @ApiBearerAuth('bearer')
  @ApiOperation({ summary: 'List assignments for current provider' })
  @ApiOkResponse({ description: 'List of assignments with job info', schema: { type: 'array', items: { type: 'object' } } })
  async myAssignments(@Req() req: AuthedRequest) {
    const userId = req.user.sub;
    const provider = await this.prisma.provider.findUnique({ where: { userId } });
    if (!provider) return [];
    return this.prisma.assignment.findMany({
      where: { providerId: provider.id },
      orderBy: { acceptedAt: 'desc' },
      select: {
        id: true,
        acceptedAt: true,
        createdAt: true,
        job: { select: { id: true, key: true, title: true, description: true, createdAt: true } },
      },
      take: 100,
    });
  }

  @Get('services')
  @ApiOperation({ summary: 'List distinct service names with counts' })
  @ApiOkResponse({ description: 'Array of { name, count }', schema: { type: 'array', items: { type: 'object', properties: { name: { type: 'string' }, count: { type: 'integer' } } } } })
  async listServices() {
    const rows = await this.prisma.service.groupBy({ by: ['name'], _count: { _all: true } });
    return rows.map((r) => ({ name: r.name, count: r._count._all }));
  }

  @Get('categories')
  @ApiOperation({ summary: 'List categories (tree)' })
  @ApiOkResponse({ description: 'Category tree', schema: { type: 'array', items: { type: 'object', properties: { id: { type: 'string' }, name: { type: 'string' }, slug: { type: 'string' }, children: { type: 'array', items: { type: 'object' } } } } } })
  async listCategories() {
    const rows = await this.prisma.category.findMany({ select: { id: true, name: true, slug: true, parentId: true }, orderBy: { name: 'asc' } });
    type CatNode = { id: string; name: string; slug: string; children: CatNode[] };
    const map = new Map<string, CatNode>();
    rows.forEach((r) => map.set(r.id, { id: r.id, name: r.name, slug: r.slug, children: [] }));
    const roots: CatNode[] = [];
    rows.forEach((r) => {
      const node = map.get(r.id)!;
      if (r.parentId && map.has(r.parentId)) map.get(r.parentId)!.children.push(node);
      else roots.push(node);
    });
    return roots;
  }

  @Post('assignments/:id/complete')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('PROVIDER')
  @ApiBearerAuth('bearer')
  @ApiOperation({ summary: 'Mark assignment completed (provider)' })
  @ApiOkResponse({ description: 'Updated assignment', schema: { type: 'object' } })
  async completeAssignment(@Param('id') id: string, @Req() req: AuthedRequest) {
    return this.assignments.completeAssignmentAsProvider(id, req.user.sub);
  }
}
