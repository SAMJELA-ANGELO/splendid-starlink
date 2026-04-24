import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Blacklist, BlacklistDocument } from '../schemas/blacklist.schema';
import { Payment, PaymentDocument } from '../schemas/payment.schema';

@Injectable()
export class BlacklistService {
  private logger = new Logger('BlacklistService');

  constructor(
    @InjectModel(Blacklist.name) private blacklistModel: Model<BlacklistDocument>,
    @InjectModel(Payment.name) private paymentModel: Model<PaymentDocument>,
  ) {}

  async isBlacklisted(type: 'IP' | 'PHONE' | 'MAC', value: string): Promise<boolean> {
    const entry = await this.blacklistModel.findOne({
      type,
      value,
      $or: [
        { expiresAt: { $gt: new Date() } },
        { expiresAt: null }
      ]
    });
    return !!entry;
  }

  async addToBlacklist(type: 'IP' | 'PHONE' | 'MAC', value: string, reason?: string, expiresAt?: Date): Promise<void> {
    const existing = await this.blacklistModel.findOne({ type, value });
    if (existing) {
      // Update existing entry
      existing.reason = reason;
      existing.expiresAt = expiresAt;
      await existing.save();
    } else {
      // Create new entry
      const blacklistEntry = new this.blacklistModel({
        id: `${type}-${value}-${Date.now()}`,
        type,
        value,
        reason,
        expiresAt,
      });
      await blacklistEntry.save();
    }
    this.logger.log(`Added ${type} ${value} to blacklist${expiresAt ? ` until ${expiresAt}` : ' permanently'}`);
  }

  async checkPhoneStrikeSystem(macAddress: string, phoneNumber: string): Promise<boolean> {
    // Check if this MAC has used multiple phones recently
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

    // Find all payments from this MAC in the last hour
    const recentPayments = await this.paymentModel.find({
      macAddress: macAddress,
      createdAt: { $gte: oneHourAgo }
    }).distinct('phone');

    // Count unique phone numbers used
    const uniquePhones = new Set(recentPayments.filter(p => p)); // Filter out null/undefined
    uniquePhones.add(phoneNumber); // Include current phone

    if (uniquePhones.size >= 3) {
      // Add MAC to blacklist for 24 hours
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
      await this.addToBlacklist('MAC', macAddress, 'Multiple phone numbers used within 1 hour', expiresAt);
      return true;
    }

    return false;
  }
}