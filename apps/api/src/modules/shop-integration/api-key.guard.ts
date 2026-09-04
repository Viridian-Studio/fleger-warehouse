import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ShopConnection, ShopConnectionDocument } from './schemas/shop-connection.schema';
import { hashApiKey } from './api-key.util';

/**
 * Authenticates requests from an external shop using its Viridian Warehouse
 * API key (`Authorization: Bearer vw_...`) instead of a user JWT. Resolves
 * the tenant purely from the key and attaches a `tenantContext` shaped like
 * `TenantGuard`'s so downstream code can treat it the same way.
 */
@Injectable()
export class ApiKeyGuard implements CanActivate {
  constructor(
    @InjectModel(ShopConnection.name) private readonly connections: Model<ShopConnectionDocument>
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const header = request.headers['authorization'] as string | undefined;
    const token = header?.startsWith('Bearer ') ? header.slice(7).trim() : undefined;

    if (!token) {
      throw new UnauthorizedException('API key is required');
    }

    const connection = await this.connections.findOne({ keyHash: hashApiKey(token), revoked: false }).exec();

    if (!connection) {
      throw new UnauthorizedException('Invalid API key');
    }

    void this.connections.updateOne({ _id: connection._id }, { $set: { lastUsedAt: new Date() } }).exec();

    request.tenantContext = {
      tenantId: connection.tenantId,
      tenantSlug: '',
      userId: `shop-connection:${connection._id}`,
      permissions: ['inventory.read'],
      platformAdmin: false
    };

    return true;
  }
}
