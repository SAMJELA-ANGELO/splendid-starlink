import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Plan, PlanDocument } from '../schemas/plan.schema';

@Injectable()
export class PlansService {
  constructor(@InjectModel(Plan.name) private planModel: Model<PlanDocument>) {}

  async findAll(): Promise<Plan[]> {
    return this.planModel.find().exec();
  }

  async findById(id: string): Promise<Plan | null> {
    return this.planModel.findById(id).exec();
  }

  async create(planData: { name: string; price: number; duration: number }): Promise<Plan> {
    const newPlan = new this.planModel(planData);
    return newPlan.save();
  }

  async update(id: string, updateData: Partial<{ name: string; price: number; duration: number }>): Promise<Plan | null> {
    return this.planModel.findByIdAndUpdate(id, updateData, { new: true }).exec();
  }

  async delete(id: string): Promise<any> {
    return this.planModel.findByIdAndDelete(id).exec();
  }
}
