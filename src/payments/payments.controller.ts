import { Controller, Post, Get, UseGuards, Body, Param, Request, BadRequestException, UnauthorizedException, InternalServerErrorException, ConflictException } from '@nestjs/common';
import {
  ApiOperation,
  ApiResponse,
  ApiTags,
  ApiBearerAuth,
  ApiParam,
  ApiSecurity,
  ApiBody,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { PaymentsService } from './payments.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { InitiatePaymentDto } from './dto/initiate-payment.dto';
import { WebhookDto } from './dto/webhook.dto';
import { BuyForOthersDto } from './dto/buy-for-others.dto';

@ApiTags('Payments')
@Controller('payments')
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @ApiOperation({ summary: 'Initiate direct payment to mobile device' })
  @ApiResponse({
    status: 201,
    description: 'Payment request sent to mobile phone successfully',
    schema: {
      example: {
        paymentId: '507f1f77bcf86cd799439011',
        transId: 'abc12345',
        message: 'Payment request sent to your mobile phone. Please complete payment on your device.',
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 400, description: 'Invalid plan or request' })
  @ApiSecurity('JWT')
  @Throttle({ default: { limit: 5, ttl: 60000 } }) // 5 payment initiations per minute
  @UseGuards(JwtAuthGuard)
  @Post('initiate')
  async initiate(@Body() body: InitiatePaymentDto, @Request() req) {
    return this.paymentsService.initiatePayment(
      req.user.userId,
      body.planId,
      body.email,
      body.phone,
      body.externalId,
      body.name,
    );
  }

  @ApiOperation({ summary: 'Check payment status by transaction ID' })
  @ApiParam({
    name: 'transactionId',
    description: 'Fapshi transaction ID',
    example: 'abc12345',
  })
  @ApiResponse({
    status: 200,
    description: 'Payment status retrieved',
    schema: {
      example: {
        status: 'SUCCESSFUL',
        transactionId: 'abc12345',
        amount: 1000,
      },
    },
  })
  @ApiResponse({ status: 404, description: 'Transaction not found' })
  @Get('status/:transactionId')
  async getStatus(@Param('transactionId') transactionId: string) {
    return this.paymentsService.checkPaymentStatus(transactionId);
  }

  @ApiOperation({
    summary: 'Webhook endpoint for Fapshi payment notifications',
  })
  @ApiResponse({
    status: 200,
    description: 'Webhook processed successfully',
  })
  @ApiResponse({ status: 400, description: 'Invalid webhook payload' })
  @Post('webhook')
  async handleWebhook(@Body() body: WebhookDto) {
    return this.paymentsService.handleWebhookNotification(body);
  }

  @ApiOperation({ summary: 'Get user purchase history' })
  @ApiResponse({
    status: 200,
    description: 'User purchase history retrieved',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiSecurity('JWT')
  @UseGuards(JwtAuthGuard)
  @Get('user')
  async getUserPurchases(@Request() req) {
    return this.paymentsService.getUserPurchases(req.user.userId);
  }

  @ApiOperation({ summary: 'Buy bundle for another user/device' })
  @ApiBody({ 
    type: BuyForOthersDto,
    examples: {
      example1: {
        summary: 'Buy 1-hour bundle for friend',
        description: 'Purchase a 1-hour internet bundle for another user',
        value: {
          targetUsername: 'john_device',
          targetPassword: 'password123',
          phoneNumber: '674818818',
          planId: '507f1f77bcf86cd799439011'
        }
      },
      example2: {
        summary: 'Buy 2-hour bundle for family member',
        description: 'Purchase a 2-hour internet bundle for family member',
        value: {
          targetUsername: 'mom_tablet',
          targetPassword: 'securepass456',
          phoneNumber: '690123456',
          planId: '507f1f77bcf86cd799439012'
        }
      }
    }
  })
  @ApiResponse({
    status: 201,
    description: 'Payment initiated for target user successfully',
    schema: {
      example: {
        success: true,
        message: 'Payment request sent to mobile phone. Target user created successfully.',
        data: {
          transactionId: 'ABC12345678',
          targetUserId: '507f1f77bcf86cd799439013',
          targetUsername: 'john_device',
          planName: '1 Hour Bundle',
          amount: 520,
          phoneNumber: '674818818'
        }
      },
    },
  })
  @ApiResponse({ 
    status: 400, 
    description: 'Invalid input data',
    schema: {
      example: {
        message: 'Target user already exists. Please choose a different username.',
        error: 'Bad Request',
        statusCode: 400
      }
    }
  })
  @ApiResponse({ 
    status: 401, 
    description: 'Unauthorized - JWT token required',
    schema: {
      example: {
        message: 'Unauthorized',
        statusCode: 401
      }
    }
  })
  @ApiResponse({ 
    status: 409, 
    description: 'Target user already exists',
    schema: {
      example: {
        message: 'Target user already exists. Please choose a different username.',
        error: 'Conflict',
        statusCode: 409
      }
    }
  })
  @ApiSecurity('JWT')
  @Throttle({ default: { limit: 3, ttl: 60000 } }) // 3 buy-for-others requests per minute
  @UseGuards(JwtAuthGuard)
  @Post('buy-for-others')
  async buyForOthers(@Request() req, @Body() buyForOthersDto: BuyForOthersDto) {
    return this.paymentsService.buyForOthers(req.user.userId, buyForOthersDto);
  }
}
