import { Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateReviewDto } from './dto/review.dto';
import { Role } from '@prisma/client';

@Injectable()
export class ReviewsService {
  constructor(private prisma: PrismaService) {}

  async create(jobId: string, raterId: string, createReviewDto: CreateReviewDto) {
    const job = await this.prisma.job.findUnique({
      where: { id: jobId },
      include: { assignment: true, customer: true },
    });

    if (!job) {
      throw new NotFoundException(`Job with ID ${jobId} not found.`);
    }

    const rater = await this.prisma.user.findUnique({ where: { id: raterId } });
    if (!rater) {
      throw new UnauthorizedException('Rater not found.');
    }

    let rateeId: string;

    // Determine who is being rated
    if (rater.role === Role.CUSTOMER && job.assignment) {
      rateeId = job.assignment.providerId;
    } else if (rater.role === Role.PROVIDER) {
      rateeId = job.customerId;
    } else {
      throw new UnauthorizedException('You are not authorized to review this job.');
    }

    // Verify that the rater is part of the job
    if (rater.id !== job.customerId && rater.id !== job.assignment?.providerId) {
      throw new UnauthorizedException('You are not part of this job.');
    }

    return this.prisma.review.create({
      data: {
        job: { connect: { id: jobId } },
        rater: { connect: { id: raterId } },
        ratee: { connect: { id: rateeId } },
        stars: createReviewDto.stars,
        comment: createReviewDto.comment,
      },
    });
  }

  findAll() {
    return this.prisma.review.findMany({
      include: {
        rater: { select: { id: true, name: true } },
        ratee: { select: { id: true, name: true } },
      },
    });
  }

  findAllByJobId(jobId: string) {
    return this.prisma.review.findMany({
      where: { jobId },
      include: {
        rater: { select: { id: true, name: true } },
        ratee: { select: { id: true, name: true } },
      },
    });
  }
}