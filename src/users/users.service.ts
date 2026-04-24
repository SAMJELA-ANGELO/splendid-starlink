import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User, UserDocument } from '../schemas/user.schema';
import { MikrotikService } from '../mikrotik/mikrotik.service';
import * as bcrypt from 'bcrypt';

@Injectable()
export class UsersService {
  private logger = new Logger('UsersService');

  constructor(
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    private mikrotikService: MikrotikService,
  ) {}

  async create(
    username: string,
    password: string,
    macAddress?: string,
    ipAddress?: string,
    routerIdentity?: string,
    isGift: boolean = false,
  ): Promise<UserDocument> {
    this.logger.log(
      `👤 Starting user creation process for username: ${username}`,
    );
    if (macAddress) {
      this.logger.log(`   📌 MAC Address: ${macAddress}`);
    }
    if (ipAddress) {
      this.logger.log(`   🌐 IP Address: ${ipAddress}`);
    }
    if (routerIdentity) {
      this.logger.log(`   🛰️ Router Identity: ${routerIdentity}`);
    }

    try {
      // Check MAC address uniqueness (one device, one account policy)
      if (macAddress && !isGift) {
        const existingUser = await this.userModel.findOne({ macAddress }).exec();
        if (existingUser) {
          throw new Error(`This device (MAC: ${macAddress}) already has an account. One device can only have one account.`);
        }
      }

      // Step 1: Hash password for MongoDB storage
      this.logger.log(`  1️⃣ Hashing password for MongoDB storage`);
      const hashedPassword = await bcrypt.hash(password, 10);
      this.logger.log(`  ✅ Password hashed successfully`);

      // Step 2: Create user in MongoDB with device info
      // Note: MikroTik user creation moved to payment activation to avoid duplicates
      this.logger.log(`  2️⃣ Creating user record in MongoDB`);
      const user = new this.userModel({
        username,
        password: hashedPassword,
        plainPassword: password, // Store plain password for recovery - SECURITY RISK
        mikrotikCreated: false, // Will be set to true during payment activation
        macAddress: macAddress || null,
        ipAddress: ipAddress || null,
        routerIdentity: routerIdentity || null,
        isActive: false, // User is NOT activated until payment
      });
      const savedUser = await user.save();
      this.logger.log(
        `✅ User created successfully: ${username} (ID: ${savedUser._id}, MikroTik: not created yet, MAC: ${macAddress || 'null'}, IP: ${ipAddress || 'null'})`,
      );
      return savedUser;
    } catch (error: any) {
      // If MikroTik creation fails, don't create MongoDB user
      this.logger.error(
        `❌ Failed to create user ${username}: ${error.message}`,
      );
      throw error;
    }
  }

  async findByUsername(username: string): Promise<User | null> {
    this.logger.log(`🔍 Finding user by username: ${username}`);
    const user = await this.userModel.findOne({ username }).exec();
    if (user) {
      this.logger.log(`✅ User found: ${username} (ID: ${user._id})`);
    } else {
      this.logger.warn(`⚠️ User not found: ${username}`);
    }
    return user;
  }

  async findById(id: string): Promise<User | null> {
    this.logger.log(`🔍 Finding user by ID: ${id}`);
    const user = await this.userModel.findById(id).exec();
    if (user) {
      this.logger.log(`✅ User found by ID: ${user.username}`);
    } else {
      this.logger.warn(`⚠️ User not found with ID: ${id}`);
    }
    return user;
  }

  async updateUser(id: string, update: Partial<User>): Promise<User | null> {
    this.logger.log(`✏️ Updating user ${id} with: ${JSON.stringify(update)}`);
    const updatedUser = await this.userModel
      .findByIdAndUpdate(id, update, { new: true })
      .exec();
    if (updatedUser) {
      this.logger.log(`✅ User updated successfully: ${updatedUser.username}`);
    } else {
      this.logger.error(`❌ Failed to update user: ${id}`);
    }
    return updatedUser;
  }

  async validatePassword(
    password: string,
    hashedPassword: string,
  ): Promise<boolean> {
    this.logger.debug(`🔐 Validating password`);
    const isValid = await bcrypt.compare(password, hashedPassword);
    if (isValid) {
      this.logger.log(`✅ Password validation successful`);
    } else {
      this.logger.warn(`⚠️ Password validation failed`);
    }
    return isValid;
  }

  async updatePassword(username: string, newPassword: string): Promise<void> {
    this.logger.log(`🔄 Updating password for user: ${username}`);

    try {
      // Hash the new password
      const hashedPassword = await bcrypt.hash(newPassword, 10);

      // Update MikroTik first
      this.logger.log(`  1️⃣ Updating password on MikroTik`);
      await this.mikrotikService.updateUserPassword(username, newPassword);
      this.logger.log(`  ✅ MikroTik password updated`);

      // Update MongoDB
      this.logger.log(`  2️⃣ Updating password in MongoDB`);
      await this.userModel.findOneAndUpdate(
        { username },
        {
          password: hashedPassword,
          plainPassword: newPassword, // Store plain password for recovery
          updatedAt: new Date(),
        }
      );
      this.logger.log(`  ✅ MongoDB password updated`);

      this.logger.log(`✅ Password updated successfully for user: ${username}`);
    } catch (error: any) {
      this.logger.error(`❌ Failed to update password for ${username}: ${error.message}`);
      throw error;
    }
  }

  async findByMacWithActiveSession(macAddress: string): Promise<User | null> {
    this.logger.log(`📌 Checking for active user with MAC: ${macAddress}`);

    const user = await this.userModel
      .findOne({
        macAddress: macAddress,
        isActive: true,
        sessionExpiry: { $gt: new Date() }, // Session not expired
      })
      .exec();

    if (user) {
      this.logger.log(
        `✅ Active user found with MAC ${macAddress}: ${user.username} (expires: ${user.sessionExpiry})`,
      );
      return user;
    } else {
      this.logger.warn(`⚠️ No active user found with MAC: ${macAddress}`);
      return null;
    }
  }

  async findByMacIncludingExpired(macAddress: string): Promise<User | null> {
    this.logger.log(
      `📌 Checking for user with MAC (including expired): ${macAddress}`,
    );

    const user = await this.userModel
      .findOne({
        macAddress: macAddress,
      })
      .exec();

    if (user) {
      const isExpired =
        !user.isActive ||
        !user.sessionExpiry ||
        new Date() > user.sessionExpiry;
      this.logger.log(
        `${isExpired ? '⚠️' : '✅'} User found with MAC ${macAddress}: ${user.username} (expired: ${isExpired})`,
      );
      return user;
    } else {
      this.logger.warn(`⚠️ No user found with MAC: ${macAddress}`);
      return null;
    }
  }
}
