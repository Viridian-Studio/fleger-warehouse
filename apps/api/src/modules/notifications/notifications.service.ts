import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { TenantContext } from '../../common/tenant/tenant-context';
import { Notification } from './schemas/notification.schema';

export interface CreateNotificationInput {
  tenantId: string;
  userId: string;
  type: string;
  title: string;
  message: string;
  link?: string;
}

@Injectable()
export class NotificationsService {
  constructor(@InjectModel(Notification.name) private readonly notifications: Model<Notification>) {}

  list(ctx: TenantContext) {
    return this.notifications
      .find({ tenantId: ctx.tenantId, userId: ctx.userId })
      .sort({ createdAt: -1 })
      .limit(100);
  }

  unread(ctx: TenantContext) {
    return this.notifications.countDocuments({ tenantId: ctx.tenantId, userId: ctx.userId, read: false });
  }

  async markRead(ctx: TenantContext, id: string) {
    const notification = await this.notifications.findOneAndUpdate(
      { _id: id, tenantId: ctx.tenantId, userId: ctx.userId },
      { read: true },
      { new: true }
    );
    if (!notification) throw new NotFoundException('Notification not found');
    return notification;
  }

  create(input: CreateNotificationInput) {
    return this.notifications.create(input);
  }

  async remove(ctx: TenantContext, id: string) {
    const notification = await this.notifications.findOneAndDelete({
      _id: id,
      tenantId: ctx.tenantId,
      userId: ctx.userId
    });
    if (!notification) throw new NotFoundException('Notification not found');
    return notification;
  }
}
