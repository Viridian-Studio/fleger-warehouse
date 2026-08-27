import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Update } from './schemas/update.schema';
import { UpdateChange } from './schemas/update-change.schema';
import { CreateUpdateDto } from './dto/create-update.dto';

@Injectable()
export class UpdatesService {
  constructor(
    @InjectModel(Update.name) private readonly updates: Model<Update>,
    @InjectModel(UpdateChange.name) private readonly changes: Model<UpdateChange>
  ) {}

  async list() {
    const updates = await this.updates.find().sort({ releasedAt: -1 }).lean();
    return updates.map((u) => ({
      _id: String(u._id),
      buildName: u.buildName,
      version: u.version,
      buildNumber: u.buildNumber,
      releasedAt: u.releasedAt,
      changeCount: u.changes.length
    }));
  }

  async detail(id: string) {
    const update = await this.updates.findById(id).lean();
    if (!update) return null;

    // Prefer separate updatechanges collection; fall back to embedded changes array
    let changes = await this.changes
      .find({ updateId: String(update._id) })
      .sort({ _id: 1 })
      .lean();

    // If no separate change docs exist, use the embedded changes array
    if (changes.length === 0 && update.changes.length > 0) {
      const embedded = update.changes as unknown as Array<{ type: string; title: string; description?: string }>;
      return {
        _id: String(update._id),
        buildName: update.buildName,
        version: update.version,
        buildNumber: update.buildNumber,
        releasedAt: update.releasedAt,
        changes: embedded.map((c, i) => ({
          _id: String(update._id) + '-' + i,
          type: c.type,
          title: c.title,
          description: c.description ?? ''
        }))
      };
    }

    return {
      _id: String(update._id),
      buildName: update.buildName,
      version: update.version,
      buildNumber: update.buildNumber,
      releasedAt: update.releasedAt,
      changes: changes.map((c) => ({
        _id: String(c._id),
        type: c.type,
        title: c.title,
        description: c.description ?? ''
      }))
    };
  }

  async create(dto: CreateUpdateDto) {
    const update = await this.updates.create({
      buildName: dto.buildName,
      version: dto.version,
      buildNumber: dto.buildNumber,
      releasedAt: new Date(dto.releasedAt),
      changes: []
    });

    const changeDocs = await this.changes.insertMany(
      dto.changes.map((c) => ({
        updateId: String(update._id),
        type: c.type,
        title: c.title,
        description: c.description ?? ''
      }))
    );

    await this.updates.updateOne(
      { _id: update._id },
      { $set: { changes: changeDocs.map((c) => c._id) } }
    );

    return this.detail(String(update._id));
  }

  async remove(id: string) {
    await this.changes.deleteMany({ updateId: id });
    await this.updates.deleteOne({ _id: new Types.ObjectId(id) });
    return { success: true };
  }
}
