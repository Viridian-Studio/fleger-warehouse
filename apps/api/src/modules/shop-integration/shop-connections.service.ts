import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ShopConnection, ShopConnectionDocument } from './schemas/shop-connection.schema';
import { generateApiKey } from './api-key.util';

export interface ShopConnectionStatus {
  connected: boolean;
  keyPrefix?: string;
  createdAt?: Date;
  lastUsedAt?: Date;
}

@Injectable()
export class ShopConnectionsService {
  constructor(
    @InjectModel(ShopConnection.name) private readonly connections: Model<ShopConnectionDocument>
  ) {}

  async status(tenantId: string): Promise<ShopConnectionStatus> {
    const connection = await this.connections.findOne({ tenantId, revoked: false }).exec();
    if (!connection) return { connected: false };
    return {
      connected: true,
      keyPrefix: connection.keyPrefix,
      createdAt: connection.createdAt,
      lastUsedAt: connection.lastUsedAt
    };
  }

  /** Generates a fresh key for the tenant, replacing any existing one. The plaintext is returned once. */
  async generate(tenantId: string): Promise<{ apiKey: string; keyPrefix: string }> {
    const { plaintext, hash, prefix } = generateApiKey();
    await this.connections
      .findOneAndUpdate(
        { tenantId },
        { $set: { keyHash: hash, keyPrefix: prefix, revoked: false }, $unset: { lastUsedAt: 1 } },
        { upsert: true }
      )
      .exec();
    return { apiKey: plaintext, keyPrefix: prefix };
  }

  async revoke(tenantId: string): Promise<{ revoked: boolean }> {
    await this.connections.updateOne({ tenantId }, { $set: { revoked: true } }).exec();
    return { revoked: true };
  }
}
