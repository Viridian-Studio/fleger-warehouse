import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import applicationDetails from './application-details.json';
import { ApplicationDetails } from './schemas/application-details.schema';

const DEFAULT_APPLICATION_DETAILS = applicationDetails;

@Injectable()
export class ApplicationDetailsService {
  constructor(@InjectModel(ApplicationDetails.name) private readonly details: Model<ApplicationDetails>) {}

  get() {
    return this.details.findOneAndUpdate(
      { key: DEFAULT_APPLICATION_DETAILS.key },
      { $setOnInsert: DEFAULT_APPLICATION_DETAILS },
      { upsert: true, new: true }
    ).select('-__v');
  }
}
