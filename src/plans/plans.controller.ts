import { Controller, Get, Post, Put, Delete, Param, Body, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags, ApiParam, ApiBody, ApiBearerAuth, ApiSecurity } from '@nestjs/swagger';
import { PlansService } from './plans.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AdminGuard } from '../auth/admin.guard';

@ApiTags('Plans')
@Controller('plans')
export class PlansController {
  constructor(private readonly plansService: PlansService) {}

  @ApiOperation({ summary: 'Get all available plans/bundles' })
  @ApiResponse({
    status: 200,
    description: 'List of all plans',
    schema: {
      example: [
        {
          _id: '507f1f77bcf86cd799439011',
          name: '100 CFA - 2 hours',
          price: 100,
          duration: 2,
        },
        {
          _id: '507f1f77bcf86cd799439012',
          name: '500 CFA - 24 hours',
          price: 500,
          duration: 24,
        },
      ],
    },
  })
  @Get()
  async getPlans() {
    return this.plansService.findAll();
  }

  @ApiOperation({ summary: 'Get a specific plan by ID' })
  @ApiParam({ name: 'id', description: 'Plan ID', example: '507f1f77bcf86cd799439011' })
  @ApiResponse({
    status: 200,
    description: 'Plan details',
    schema: {
      example: {
        _id: '507f1f77bcf86cd799439011',
        name: '100 CFA - 2 hours',
        price: 100,
        duration: 2,
      },
    },
  })
  @ApiResponse({ status: 404, description: 'Plan not found' })
  @Get(':id')
  async getPlan(@Param('id') id: string) {
    return this.plansService.findById(id);
  }

  @ApiOperation({ summary: 'Create a new plan' })
  @ApiBody({
    schema: {
      example: {
        name: '100 CFA - 2 hours',
        price: 100,
        duration: 2,
      },
    },
  })
  @ApiResponse({
    status: 201,
    description: 'Plan created successfully',
    schema: {
      example: {
        _id: '507f1f77bcf86cd799439011',
        name: '100 CFA - 2 hours',
        price: 100,
        duration: 2,
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiSecurity('JWT')
  @UseGuards(JwtAuthGuard, AdminGuard)
  @Post()
  async createPlan(@Body() body: { name: string; price: number; duration: number }) {
    return this.plansService.create(body);
  }

  @ApiOperation({ summary: 'Update an existing plan' })
  @ApiParam({ name: 'id', description: 'Plan ID', example: '507f1f77bcf86cd799439011' })
  @ApiBody({
    schema: {
      example: {
        name: 'Updated Plan Name',
        price: 150,
        duration: 3,
      },
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Plan updated successfully',
    schema: {
      example: {
        _id: '507f1f77bcf86cd799439011',
        name: 'Updated Plan Name',
        price: 150,
        duration: 3,
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Plan not found' })
  @ApiSecurity('JWT')
  @UseGuards(JwtAuthGuard, AdminGuard)
  @Put(':id')
  async updatePlan(
    @Param('id') id: string,
    @Body() body: Partial<{ name: string; price: number; duration: number }>,
  ) {
    return this.plansService.update(id, body);
  }

  @ApiOperation({ summary: 'Delete a plan' })
  @ApiParam({ name: 'id', description: 'Plan ID', example: '507f1f77bcf86cd799439011' })
  @ApiResponse({ status: 200, description: 'Plan deleted successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Plan not found' })
  @ApiSecurity('JWT')
  @UseGuards(JwtAuthGuard, AdminGuard)
  @Delete(':id')
  async deletePlan(@Param('id') id: string) {
    return this.plansService.delete(id);
  }
}
