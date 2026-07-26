import {
  Inject,
  Injectable,
  Logger,
  type OnApplicationShutdown,
  type OnModuleInit,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { ServerConfig } from '@good-job/config';
import {
  database,
  MediaStatus,
  OutboxStatus,
  type Prisma,
} from '@good-job/database';
import { Queue, Worker, type Job } from 'bullmq';
import { Redis } from 'ioredis';

import { CONFIG } from '../config.js';
import { FfprobeService } from './ffprobe.service.js';
import { WorkerObjectStorageService } from './worker-object-storage.service.js';
import {
  validateVideoDuration,
  validateVideoMetadata,
} from './video-duration.js';

const queueName = 'media-video-processing';
type MediaJob = { attachmentId: string };

export function shouldPersistTerminalFailure(
  attemptsMade: number,
  configuredAttempts: number,
): boolean {
  return attemptsMade + 1 >= configuredAttempts;
}

@Injectable()
export class MediaWorkerService implements OnModuleInit, OnApplicationShutdown {
  private readonly logger = new Logger(MediaWorkerService.name);
  private readonly connection: Redis;
  private readonly queue: Queue<MediaJob>;
  private readonly worker: Worker<MediaJob>;
  private dispatchTimer?: ReturnType<typeof setInterval>;

  constructor(
    @Inject(CONFIG) private readonly config: ServerConfig,
    @Inject(FfprobeService) private readonly ffprobe: FfprobeService,
    @Inject(WorkerObjectStorageService)
    private readonly storage: WorkerObjectStorageService,
  ) {
    this.connection = new Redis(config.REDIS_URL, {
      maxRetriesPerRequest: null,
    });
    this.queue = new Queue<MediaJob>(queueName, {
      connection: this.connection,
    });
    this.worker = new Worker<MediaJob>(queueName, (job) => this.process(job), {
      connection: this.connection,
      concurrency: config.MEDIA_WORKER_CONCURRENCY,
    });
    this.worker.on('failed', (job, error) => {
      this.logger.warn(
        `Media job ${job?.id ?? 'unknown'} failed: ${error.message}`,
      );
    });
  }

  onModuleInit(): void {
    void this.dispatch();
    this.dispatchTimer = setInterval(() => void this.dispatch(), 500);
  }

  async ping(): Promise<void> {
    await Promise.all([
      database.$queryRaw`SELECT 1`,
      this.storage.ping(),
      this.ffprobe.ping(),
    ]);
  }

  async onApplicationShutdown(): Promise<void> {
    if (this.dispatchTimer) clearInterval(this.dispatchTimer);
    await this.worker.close();
    await this.queue.close();
    await database.$disconnect();
    this.connection.disconnect();
  }

  private async dispatch(): Promise<void> {
    const event = await database.$transaction(async (transaction) => {
      const [row] = await transaction.$queryRaw<
        Array<{ id: string; aggregateId: string; payload: Prisma.JsonValue }>
      >`
        SELECT "id", "aggregate_id" AS "aggregateId", "payload"
        FROM "transactional_outbox"
        WHERE "event_type" = 'media.video_processing_requested'
          AND "status" = 'pending'
          AND "available_at" <= CURRENT_TIMESTAMP
        ORDER BY "available_at", "id"
        LIMIT 1
        FOR UPDATE SKIP LOCKED
      `;
      if (!row) return null;
      await transaction.transactionalOutbox.update({
        where: { id: row.id },
        data: { attempts: { increment: 1 } },
      });
      return row;
    });
    if (!event) return;
    try {
      await this.queue.add(
        'probe-video',
        { attachmentId: event.aggregateId },
        {
          jobId: event.aggregateId,
          attempts: this.config.MEDIA_WORKER_ATTEMPTS,
          backoff: {
            type: 'exponential',
            delay: this.config.MEDIA_WORKER_BACKOFF_MS,
          },
          removeOnComplete: 100,
          removeOnFail: 100,
        },
      );
      await database.transactionalOutbox.update({
        where: { id: event.id },
        data: { status: OutboxStatus.published, publishedAt: new Date() },
      });
    } catch (error: unknown) {
      await database.transactionalOutbox.update({
        where: { id: event.id },
        data: {
          availableAt: new Date(
            Date.now() + this.config.MEDIA_WORKER_BACKOFF_MS,
          ),
          lastError:
            error instanceof Error
              ? error.message.slice(0, 500)
              : 'Queue dispatch failed.',
        },
      });
    }
  }

  private async process(job: Job<MediaJob>): Promise<void> {
    const attachment = await database.mediaAttachment.findFirst({
      where: {
        id: job.data.attachmentId,
        mediaType: 'video',
        status: MediaStatus.processing,
      },
    });
    if (!attachment) return;
    let probe;
    try {
      probe = await this.ffprobe.probeVideo(
        this.storage.presignRead(attachment.objectKey),
      );
    } catch (error) {
      if (
        shouldPersistTerminalFailure(
          job.attemptsMade,
          this.config.MEDIA_WORKER_ATTEMPTS,
        )
      ) {
        await this.markFailed(attachment.id, 'VIDEO_PROCESSING_FAILED');
      }
      throw error;
    }
    if (
      !validateVideoMetadata(
        attachment.mimeType,
        probe.formatNames,
        probe.videoCodecs,
      )
    ) {
      await this.markFailed(attachment.id, 'VIDEO_METADATA_INVALID');
      return;
    }
    const validation = validateVideoDuration(
      probe.durationSeconds,
      this.config.MEDIA_MAX_VIDEO_DURATION_SECONDS,
    );
    if (!validation.accepted) {
      await this.markFailed(
        attachment.id,
        validation.failureCode,
        probe.durationSeconds,
      );
      return;
    }
    await this.markReady(attachment.id, probe.durationSeconds);
  }

  private async markReady(
    attachmentId: string,
    durationSeconds: number,
  ): Promise<void> {
    await persistMediaTerminalStatus(
      attachmentId,
      MediaStatus.ready,
      durationSeconds,
      null,
    );
  }

  private async markFailed(
    attachmentId: string,
    failureCode: string,
    durationSeconds?: number,
  ): Promise<void> {
    await persistMediaTerminalStatus(
      attachmentId,
      MediaStatus.failed,
      durationSeconds,
      failureCode,
    );
  }
}

export async function persistMediaTerminalStatus(
  attachmentId: string,
  status: typeof MediaStatus.ready | typeof MediaStatus.failed,
  durationSeconds: number | undefined,
  failureCode: string | null,
): Promise<void> {
  await database.$transaction(async (transaction) => {
    const existing = await transaction.mediaAttachment.findFirst({
      where: { id: attachmentId, status: MediaStatus.processing },
    });
    if (!existing) return;
    const attachment = await transaction.mediaAttachment.update({
      where: { id: attachmentId, status: MediaStatus.processing },
      data: {
        status,
        failureCode,
        ...(durationSeconds === undefined ? {} : { durationSeconds }),
      },
    });
    if (!attachment.ownerId) return;
    const eventId = randomUUID();
    await transaction.transactionalOutbox.create({
      data: {
        id: eventId,
        organizationId: attachment.organizationId,
        eventType: 'media.status_changed',
        aggregateType: 'media_attachment',
        aggregateId: attachment.id,
        payload: {
          eventId,
          type: 'media.status_changed',
          organizationId: attachment.organizationId,
          occurredAt: new Date().toISOString(),
          payload: {
            attachmentId: attachment.id,
            ownerType: attachment.ownerType,
            ownerId: attachment.ownerId,
            status: attachment.status,
            ...(attachment.failureCode
              ? { failureCode: attachment.failureCode }
              : {}),
          },
        },
        status: OutboxStatus.pending,
      },
    });
  });
}
