import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
  UseGuards,
  Logger,
} from '@nestjs/common';
import {
  ApiOperation,
  ApiResponse,
  ApiTags,
  ApiParam,
  ApiBody,
  ApiBearerAuth,
  ApiSecurity,
} from '@nestjs/swagger';
import { PlansService } from './plans.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AdminGuard } from '../auth/admin.guard';

@ApiTags('Plans')
@Controller('plans')
export class PlansController {
  private readonly logger = new Logger(PlansController.name);

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
    this.logger.log(`📋 Fetching all available plans`);
    try {
      const plans = await this.plansService.findAll();
      this.logger.log(`✅ Retrieved ${plans.length} plans`);
      return plans;
    } catch (error) {
      this.logger.error(`❌ Failed to fetch plans: ${error.message}`);
      throw error;
    }
  }

  @ApiOperation({ summary: 'Get a specific plan by ID' })
  @ApiParam({
    name: 'id',
    description: 'Plan ID',
    example: '507f1f77bcf86cd799439011',
  })
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
    this.logger.log(`📋 Fetching plan with ID: ${id}`);
    try {
      const plan = await this.plansService.findById(id);
      this.logger.log(`✅ Plan retrieved: ${plan?.name} (ID: ${id})`);
      return plan;
    } catch (error) {
      this.logger.error(`❌ Failed to fetch plan ${id}: ${error.message}`);
      throw error;
    }
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
  async createPlan(
    @Body() body: { name: string; price: number; duration: number },
  ) {
    this.logger.log(
      `➕ Creating new plan: ${body.name} (Price: ${body.price}, Duration: ${body.duration}h)`,
    );
    try {
      const plan = await this.plansService.create(body);
      this.logger.log(
        `✅ Plan created successfully with ID: ${(plan as any)._id}`,
      );
      return plan;
    } catch (error: any) {
      this.logger.error(
        `❌ Failed to create plan ${body.name}: ${error.message}`,
      );
      throw error;
    }
  }

  @ApiOperation({ summary: 'Update an existing plan' })
  @ApiParam({
    name: 'id',
    description: 'Plan ID',
    example: '507f1f77bcf86cd799439011',
  })
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
    this.logger.log(
      `✏️ Updating plan ${id} with data: ${JSON.stringify(body)}`,
    );
    try {
      const plan = await this.plansService.update(id, body);
      if (plan) {
        this.logger.log(`✅ Plan updated successfully: ${(plan as any)._id}`);
      } else {
        this.logger.error(`❌ Plan not found for update: ${id}`);
      }
      return plan;
    } catch (error) {
      this.logger.error(`❌ Failed to update plan ${id}: ${error.message}`);
      throw error;
    }
  }

  @ApiOperation({ summary: 'Delete a plan' })
  @ApiParam({
    name: 'id',
    description: 'Plan ID',
    example: '507f1f77bcf86cd799439011',
  })
  @ApiResponse({ status: 200, description: 'Plan deleted successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Plan not found' })
  @ApiSecurity('JWT')
  @UseGuards(JwtAuthGuard, AdminGuard)
  @Delete(':id')
  async deletePlan(@Param('id') id: string) {
    this.logger.log(`🗑️ Deleting plan with ID: ${id}`);
    try {
      const result = await this.plansService.delete(id);
      this.logger.log(`✅ Plan deleted successfully: ${id}`);
      return result;
    } catch (error) {
      this.logger.error(`❌ Failed to delete plan ${id}: ${error.message}`);
      throw error;
    }
  }
}
