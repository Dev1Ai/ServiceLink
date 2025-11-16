import { Controller, Get, Post, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ReviewsService } from './reviews.service';
import { CreateReviewDto } from './dto/review.dto';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { User } from '@prisma/client';

@Controller('reviews')
export class ReviewsController {
  constructor(private readonly reviewsService: ReviewsService) {}

  @UseGuards(JwtAuthGuard)
  @Post('/jobs/:jobId')
  create(
    @Param('jobId') jobId: string,
    @Body() createReviewDto: CreateReviewDto,
    @CurrentUser() user: User,
  ) {
    return this.reviewsService.create(jobId, user.id, createReviewDto);
  }

  @Get()
  findAll(@Query('job_id') jobId?: string) {
    if (jobId) {
      return this.reviewsService.findAllByJobId(jobId);
    }
    // In a real app, you'd likely have more filters, e.g., by providerId
    return this.reviewsService.findAll();
  }
}