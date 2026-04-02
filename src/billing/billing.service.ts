import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Payment, PaymentDocument } from '../schemas/payment.schema';
import { Plan, PlanDocument } from '../schemas/plan.schema';
import { InvoiceDto, BillingHistoryResponseDto, BillingStatsDto } from './dto';

@Injectable()
export class BillingService {
  private readonly logger = new Logger(BillingService.name);

  constructor(
    @InjectModel(Payment.name) private paymentModel: Model<PaymentDocument>,
    @InjectModel(Plan.name) private planModel: Model<PlanDocument>,
  ) {}

  async getBillingHistory(userId: string): Promise<BillingHistoryResponseDto> {
    this.logger.log(`📋 Fetching billing history for user: ${userId}`);

    try {
      // Fetch all payments for this user, sorted by most recent first
      const payments = await this.paymentModel
        .find({ userId })
        .sort({ createdAt: -1 })
        .lean();

      if (!payments || payments.length === 0) {
        this.logger.log(`ℹ️ No payment history found for user: ${userId}`);
        return {
          totalInvoices: 0,
          totalAmountSpent: 0,
          invoices: [],
        };
      }

      // Fetch all plans for reference
      const plansMap = new Map();
      const plans = await this.planModel.find().lean();
      if (plans) {
        plans.forEach((plan: any) => {
          plansMap.set(plan._id.toString(), plan);
        });
      }

      // Transform payments to invoice DTOs
      const invoices: InvoiceDto[] = payments.map((payment: any) => {
        const plan = plansMap.get(payment.planId);

        return {
          id: payment._id?.toString(),
          planName: plan?.name || 'Unknown Plan',
          amount: payment.amount,
          duration: plan?.duration || 0,
          purchaseDate: payment.createdAt,
          status: payment.status,
          transactionId: payment.fapshiTransactionId,
          email: payment.email,
          phone: payment.phone,
          isGift: payment.isGift || false,
          recipientUsername: payment.recipientUsername || undefined,
          activeRouter: payment.activeRouter || undefined,
        };
      });

      // Calculate totals and date ranges
      const totalAmountSpent = invoices.reduce(
        (sum, invoice) => sum + invoice.amount,
        0,
      );
      const sortedByDate = [...invoices].sort(
        (a, b) =>
          new Date(a.purchaseDate).getTime() -
          new Date(b.purchaseDate).getTime(),
      );

      const response: BillingHistoryResponseDto = {
        totalInvoices: invoices.length,
        totalAmountSpent,
        invoices,
        startDate:
          sortedByDate.length > 0 ? sortedByDate[0].purchaseDate : undefined,
        endDate:
          sortedByDate.length > 0
            ? sortedByDate[sortedByDate.length - 1].purchaseDate
            : undefined,
      };

      this.logger.log(
        `✅ Billing history retrieved for user: ${userId}, Total: ${response.totalInvoices} invoices, ${response.totalAmountSpent} CFA`,
      );
      return response;
    } catch (error) {
      this.logger.error(
        `❌ Failed to fetch billing history for user: ${userId}: ${error.message}`,
      );
      throw error;
    }
  }

  async getBillingStats(userId: string): Promise<BillingStatsDto> {
    this.logger.log(`📊 Fetching billing stats for user: ${userId}`);

    try {
      const payments = await this.paymentModel.find({ userId }).lean();

      if (!payments || payments.length === 0) {
        return {
          totalPurchases: 0,
          totalSpent: 0,
          totalHoursPurchased: 0,
          successfulPayments: 0,
          failedPayments: 0,
          giftsReceived: 0,
          startDate: null,
          endDate: null,
        };
      }

      const plans = await this.planModel.find().lean();
      const plansMap = new Map();
      if (plans) {
        plans.forEach((plan: any) => {
          plansMap.set(plan._id.toString(), plan);
        });
      }

      const successfulPayments = payments.filter(
        (p: any) => p.status === 'SUCCESSFUL',
      );
      const failedPayments = payments.filter((p: any) => p.status === 'FAILED');
      const giftsReceived = payments.filter(
        (p: any) => p.isGift && p.recipientUsername === userId,
      );

      let totalHoursPurchased = 0;
      successfulPayments.forEach((payment: any) => {
        const plan = plansMap.get(payment.planId);
        if (plan) {
          totalHoursPurchased += plan.duration;
        }
      });

      const totalSpent = successfulPayments.reduce(
        (sum, p: any) => sum + p.amount,
        0,
      );
      const sortedByDate = [...payments].sort(
        (a: any, b: any) =>
          new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
      );

      return {
        totalPurchases: payments.length,
        totalSpent,
        totalHoursPurchased,
        successfulPayments: successfulPayments.length,
        failedPayments: failedPayments.length,
        giftsReceived: giftsReceived.length,
        startDate: sortedByDate[0]?.createdAt,
        endDate: sortedByDate[sortedByDate.length - 1]?.createdAt,
      };
    } catch (error) {
      this.logger.error(
        `❌ Failed to fetch billing stats for user: ${userId}: ${error.message}`,
      );
      throw error;
    }
  }
}
