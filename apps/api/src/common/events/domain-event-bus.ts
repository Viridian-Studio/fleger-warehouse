import { Injectable } from '@nestjs/common';

export interface DomainEvent<TPayload = Record<string, unknown>> {
  name: string;
  tenantId: string;
  actorUserId?: string;
  payload: TPayload;
  occurredAt: Date;
}

type Handler = (event: DomainEvent) => Promise<void> | void;

@Injectable()
export class DomainEventBus {
  private readonly handlers = new Map<string, Handler[]>();

  on(eventName: string, handler: Handler) {
    const handlers = this.handlers.get(eventName) ?? [];
    handlers.push(handler);
    this.handlers.set(eventName, handlers);
  }

  async publish(event: DomainEvent) {
    const handlers = this.handlers.get(event.name) ?? [];
    await Promise.all(handlers.map((handler) => handler(event)));
  }
}
