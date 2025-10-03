import { Controller, Post, Get, Body, Param, UseGuards, Request } from '@nestjs/common';
import { ReviewsService } from './reviews.service';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';

@ApiTags('reviews')
@Controller('reviews')
export class ReviewsController {
  constructor(private readonly reviewsService: ReviewsService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a review for a completed job' })
  async createReview(
    @Request() req: any,
    @Body() body: {
      jobId: string;
      rateeUserId: string;
      stars: number;
      comment?: string;
    },
  ) {
    return this.reviewsService.createReview({
      jobId: body.jobId,
      raterUserId: req.user.userId,
      rateeUserId: body.rateeUserId,
      stars: body.stars,
      comment: body.comment,
    });
  }

  @Get('job/:jobId')
  @ApiOperation({ summary: 'Get all reviews for a job' })
  async getReviewsForJob(@Param('jobId') jobId: string) {
    return this.reviewsService.getReviewsForJob(jobId);
  }

  @Get('user/:userId')
  @ApiOperation({ summary: 'Get all reviews for a user' })
  async getReviewsForUser(@Param('userId') userId: string) {
    return this.reviewsService.getReviewsForUser(userId);
  }

  @Get('user/:userId/average')
  @ApiOperation({ summary: 'Get average rating for a user' })
  async getAverageRating(@Param('userId') userId: string) {
    const average = await this.reviewsService.getAverageRatingForUser(userId);
    return { userId, averageRating: average };
  }
}
