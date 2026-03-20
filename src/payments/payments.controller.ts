import {
  Controller,
  Post,
  Get,
  Param,
  Body,
  Request,
  UseGuards,
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
}
