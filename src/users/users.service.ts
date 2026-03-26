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

  async create(username: string, password: string): Promise<UserDocument> {
    this.logger.log(`👤 Starting user creation process for username: ${username}`);
    try {
      // Step 1: Create user on MikroTik with plain password FIRST
      // This happens before hashing so we use the original password
      this.logger.log(`  1️⃣ Creating MikroTik user: ${username}`);
      await this.mikrotikService.createUser(username, password);
      this.logger.log(`  ✅ MikroTik user created successfully: ${username}`);

      // Step 2: Hash password for MongoDB storage
      this.logger.log(`  2️⃣ Hashing password for MongoDB storage`);
      const hashedPassword = await bcrypt.hash(password, 10);
      this.logger.log(`  ✅ Password hashed successfully`);

      // Step 3: Create user in MongoDB with mikrotikCreated flag
      this.logger.log(`  3️⃣ Creating user record in MongoDB`);
      const user = new this.userModel({
        username,
        password: hashedPassword,
        mikrotikCreated: true,
      });
      const savedUser = await user.save();
      this.logger.log(
        `✅ User created successfully: ${username} (ID: ${savedUser._id}, MikroTik: ✓)`,
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
    const updatedUser = await this.userModel.findByIdAndUpdate(id, update, { new: true }).exec();
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
}
