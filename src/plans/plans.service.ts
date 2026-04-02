import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Plan, PlanDocument } from '../schemas/plan.schema';

@Injectable()
export class PlansService {
  private readonly logger = new Logger(PlansService.name);

  constructor(@InjectModel(Plan.name) private planModel: Model<PlanDocument>) {}

  async findAll(): Promise<Plan[]> {
    this.logger.log(`📋 Fetching all plans`);
    const plans = await this.planModel.find().exec();
    this.logger.log(`✅ Retrieved ${plans.length} plans`);
    return plans;
  }

  async findById(id: string): Promise<Plan | null> {
    this.logger.log(`🔍 Fetching plan: ${id}`);
    const plan = await this.planModel.findById(id).exec();
    if (plan) {
      this.logger.log(`✅ Plan found: ${plan.name}`);
    } else {
      this.logger.warn(`⚠️ Plan not found: ${id}`);
    }
    return plan;
  }

  async create(planData: {
    name: string;
    price: number;
    duration: number;
  }): Promise<Plan> {
    this.logger.log(
      `➕ Creating new plan: ${planData.name} (${planData.price} XAF, ${planData.duration}h)`,
    );
    const newPlan = new this.planModel(planData);
    const savedPlan = await newPlan.save();
    this.logger.log(
      `✅ Plan created: ${savedPlan.name} (ID: ${savedPlan._id})`,
    );
    return savedPlan;
  }

  async update(
    id: string,
    updateData: Partial<{ name: string; price: number; duration: number }>,
  ): Promise<Plan | null> {
    this.logger.log(
      `✏️ Updating plan ${id} with: ${JSON.stringify(updateData)}`,
    );
    const updatedPlan = await this.planModel
      .findByIdAndUpdate(id, updateData, { new: true })
      .exec();
    if (updatedPlan) {
      this.logger.log(`✅ Plan updated: ${updatedPlan.name}`);
    } else {
      this.logger.error(`❌ Failed to update plan: ${id}`);
    }
    return updatedPlan;
  }

  async delete(id: string): Promise<any> {
    this.logger.log(`🗑️ Deleting plan: ${id}`);
    const deleted = await this.planModel.findByIdAndDelete(id).exec();
    if (deleted) {
      this.logger.log(`✅ Plan deleted: ${deleted.name}`);
    } else {
      this.logger.error(`❌ Failed to delete plan: ${id}`);
    }
    return deleted;
  }
}
