import {
  Controller,
  Post,
  Get,
  Param,
  Body,
  Request,
  UseGuards,
  Logger,
} from '@nestjs/common';
import {
  ApiOperation,
  ApiResponse,
  ApiTags,
  ApiBearerAuth,
  ApiParam,
  ApiSecurity,
} from '@nestjs/swagger';
import { PaymentsService } from './payments.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { InitiatePaymentDto } from './dto/initiate-payment.dto';
import { WebhookDto } from './dto/webhook.dto';

@ApiTags('Payments')
@Controller('payments')
export class PaymentsController {
  private readonly logger = new Logger(PaymentsController.name);

  constructor(private readonly paymentsService: PaymentsService) {}

  @ApiOperation({ summary: 'Initiate direct payment to mobile device' })
  @ApiResponse({
    status: 201,
    description: 'Payment request sent to mobile phone successfully',
    schema: {
      example: {
        paymentId: '507f1f77bcf86cd799439011',
        transId: 'abc12345',
        message:
          'Payment request sent to your mobile phone. Please complete payment on your device.',
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 400, description: 'Invalid plan or request' })
  @ApiSecurity('JWT')
  @UseGuards(JwtAuthGuard)
  @Post('initiate')
  async initiate(@Body() body: InitiatePaymentDto, @Request() req) {
    this.logger.log(
      `💳 Payment initiation requested for user: ${req.user.userId}, Plan: ${body.planId}`,
    );
    try {
      const result = await this.paymentsService.initiatePayment(
        req.user.userId,
        body.planId,
        body.email,
        body.phone,
        body.externalId,
        body.name,
        body.macAddress,
        body.routerIdentity,
        body.isGift,
        body.recipientUsername,
        body.userIp,
        body.password,
      );
      this.logger.log(
        `✅ Payment initiated successfully for user: ${req.user.userId}, Transaction: ${result.transId}`,
      );
      return result;
    } catch (error) {
      this.logger.error(
        `❌ Payment initiation failed for user: ${req.user.userId}: ${error.message}`,
      );
      throw error;
    }
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
    this.logger.log(
      `🔍 Checking payment status for transaction: ${transactionId}`,
    );
    try {
      const result =
        await this.paymentsService.checkPaymentStatus(transactionId);
      this.logger.log(
        `✅ Payment status retrieved for transaction: ${transactionId}, Status: ${result.status}`,
      );
      return result;
    } catch (error) {
      this.logger.error(
        `❌ Failed to retrieve payment status for transaction: ${transactionId}: ${error.message}`,
      );
      throw error;
    }
  }

  @ApiOperation({ summary: 'Get current user purchase history' })
  @ApiResponse({
    status: 200,
    description: 'User purchases retrieved',
    isArray: true,
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Get('history')
  async getUserPayments(@Request() req) {
    this.logger.log(`📋 Fetching payment history for user: ${req.user.userId}`);
    try {
      const payments = await this.paymentsService.getUserPayments(
        req.user.userId,
      );
      this.logger.log(
        `✅ Retrieved ${payments.length} payments for user: ${req.user.userId}`,
      );
      return {
        success: true,
        data: payments,
      };
    } catch (error) {
      this.logger.error(
        `❌ Failed to fetch payment history for user: ${req.user.userId}: ${error.message}`,
      );
      throw error;
    }
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
    this.logger.log(
      `🔔 Webhook received from Fapshi for transaction: ${body.transId}`,
    );
    try {
      const result = await this.paymentsService.handleWebhookNotification(body);
      this.logger.log(
        `✅ Webhook processed successfully for transaction: ${body.transId}`,
      );
      return result;
    } catch (error: any) {
      this.logger.error(
        `❌ Webhook processing failed for transaction: ${body.transId}: ${error.message}`,
      );
      throw error;
    }
  }
}
