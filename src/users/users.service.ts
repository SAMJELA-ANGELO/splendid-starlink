import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User, UserDocument } from '../schemas/user.schema';
import * as bcrypt from 'bcrypt';

@Injectable()
export class UsersService {
  constructor(@InjectModel(User.name) private userModel: Model<UserDocument>) {}

  async create(username: string, password: string): Promise<UserDocument> {
    const hashedPassword = await bcrypt.hash(password, 10);
    const user = new this.userModel({ username, password: hashedPassword });
    return user.save();
  }

  async findByUsername(username: string): Promise<User | null> {
    return this.userModel.findOne({ username }).exec();
  }

  async findById(id: string): Promise<User | null> {
    return this.userModel.findById(id).exec();
  }

  async updateUser(id: string, update: Partial<User>): Promise<User | null> {
    return this.userModel.findByIdAndUpdate(id, update, { new: true }).exec();
  }

  async validatePassword(
    password: string,
    hashedPassword: string,
  ): Promise<boolean> {
    return bcrypt.compare(password, hashedPassword);
  }

  async addPurchasedBundle(userId: string, bundleData: {
    plan: string;
    planName: string;
    purchasedAt: Date;
    amount: number;
    duration: number;
    status: string;
    sessionStart?: Date;
    sessionEnd?: Date;
  }): Promise<User | null> {
    const bundleToAdd: any = {
      plan: bundleData.plan,
      planName: bundleData.planName,
      purchasedAt: bundleData.purchasedAt,
      amount: bundleData.amount,
      duration: bundleData.duration,
      status: bundleData.status
    };

    // Add session times if they exist (only for successful payments)
    if (bundleData.sessionStart) {
      bundleToAdd.sessionStart = bundleData.sessionStart;
    }
    if (bundleData.sessionEnd) {
      bundleToAdd.sessionEnd = bundleData.sessionEnd;
    }

    return this.userModel.findByIdAndUpdate(
      userId,
      {
        $push: {
          purchasedBundles: bundleToAdd
        }
      },
      { new: true }
    ).exec();
  }

  async findActiveUsersWithExpiredSessions(currentTime: Date): Promise<User[]> {
    return this.userModel.find({
      isActive: true,
      sessionExpiry: { $lt: currentTime }
    }).exec();
  }

  async updateExpiredBundle(userId: string): Promise<User | null> {
    return this.userModel.findOneAndUpdate(
      { 
        _id: userId,
        'purchasedBundles.status': 'active'
      },
      { 
        $set: { 'purchasedBundles.$.status': 'expired' }
      },
      { new: true }
    ).exec();
  }
}
