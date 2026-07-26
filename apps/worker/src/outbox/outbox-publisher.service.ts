import {
  Inject,
  Injectable,
  Logger,
  type OnApplicationShutdown,
  type OnModuleInit,
} from '@nestjs/common';
import type { ServerConfig } from '@good-job/config';
import {
  publicRealtimeEventTypes,
  realtimeEventEnvelopeSchema,
  realtimeRedisChannel,
} from '@good-job/contracts';
import { database, OutboxStatus, Prisma } from '@good-job/database';
import { Redis } from 'ioredis';

import { CONFIG } from '../config.js';

type ClaimedEvent = {
  id: string;
  organizationId: string;
  eventType: string;
  payload: Prisma.JsonValue;
};

@Injectable()
export class OutboxPublisherService
  implements OnModuleInit, OnApplicationShutdown
{
  private readonly logger = new Logger(OutboxPublisherService.name);
  private readonly redis: Redis;
  private timer?: ReturnType<typeof setInterval>;
  private publishing = false;

  constructor(@Inject(CONFIG) private readonly config: ServerConfig) {
    this.redis = new Redis(config.REDIS_URL, {
      maxRetriesPerRequest: null,
    });
  }

  onModuleInit(): void {
    void this.publishNext();
    this.timer = setInterval(
      () => void this.publishNext(),
      this.config.OUTBOX_POLL_INTERVAL_MS,
    );
  }

  async ping(): Promise<void> {
    const [, failedEvents] = await Promise.all([
      this.redis.ping(),
      database.transactionalOutbox.count({
        where: {
          status: OutboxStatus.failed,
          eventType: { in: [...publicRealtimeEventTypes] },
        },
      }),
    ]);
    if (failedEvents > 0) {
      throw new Error(`${failedEvents} public outbox event(s) require review.`);
    }
  }

  async onApplicationShutdown(): Promise<void> {
    if (this.timer) clearInterval(this.timer);
    this.redis.disconnect();
  }

  private async publishNext(): Promise<void> {
    if (this.publishing) return;
    this.publishing = true;
    try {
      const event = await this.claim();
      if (!event) return;
      const parsed = realtimeEventEnvelopeSchema.safeParse(event.payload);
      if (!parsed.success) {
        await this.quarantine(
          event.id,
          'Invalid public realtime event envelope.',
        );
        return;
      }
      if (
        parsed.data.eventId !== event.id ||
        parsed.data.type !== event.eventType ||
        parsed.data.organizationId !== event.organizationId
      ) {
        await this.quarantine(
          event.id,
          'Outbox columns do not match the realtime event envelope.',
        );
        return;
      }
      try {
        await this.redis.publish(
          realtimeRedisChannel,
          JSON.stringify(parsed.data),
        );
        await database.transactionalOutbox.update({
          where: { id: event.id },
          data: {
            status: OutboxStatus.published,
            publishedAt: new Date(),
            lastError: null,
          },
        });
      } catch (error: unknown) {
        await database.transactionalOutbox.update({
          where: { id: event.id },
          data: {
            availableAt: new Date(
              Date.now() + this.config.OUTBOX_RETRY_BACKOFF_MS,
            ),
            lastError:
              error instanceof Error
                ? error.message.slice(0, 500)
                : 'Realtime publication failed.',
          },
        });
      }
    } catch (error: unknown) {
      this.logger.error(
        error instanceof Error ? error.message : 'Outbox publisher failed.',
      );
    } finally {
      this.publishing = false;
    }
  }

  private async quarantine(id: string, reason: string): Promise<void> {
    await database.transactionalOutbox.update({
      where: { id },
      data: {
        status: OutboxStatus.failed,
        lastError: reason,
      },
    });
    this.logger.error(`Quarantined public outbox event ${id}: ${reason}`);
  }

  private claim(): Promise<ClaimedEvent | null> {
    const eventTypes = publicRealtimeEventTypes.map(
      (eventType) => Prisma.sql`${eventType}`,
    );
    return database.$transaction(async (transaction) => {
      const [row] = await transaction.$queryRaw<ClaimedEvent[]>`
        SELECT
          "id",
          "organization_id" AS "organizationId",
          "event_type" AS "eventType",
          "payload"
        FROM "transactional_outbox"
        WHERE "status" = 'pending'
          AND "event_type" IN (${Prisma.join(eventTypes)})
          AND "available_at" <= CURRENT_TIMESTAMP
        ORDER BY "available_at", "id"
        LIMIT 1
        FOR UPDATE SKIP LOCKED
      `;
      if (!row) return null;
      await transaction.transactionalOutbox.update({
        where: { id: row.id },
        data: {
          attempts: { increment: 1 },
          availableAt: new Date(Date.now() + this.config.OUTBOX_CLAIM_LEASE_MS),
        },
      });
      return row;
    });
  }
}
