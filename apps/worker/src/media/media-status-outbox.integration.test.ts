import { randomUUID } from 'node:crypto';

import { database, KudoStatus, MediaStatus } from '@good-job/database';
import { beforeAll, describe, expect, it } from 'vitest';

import { persistMediaTerminalStatus } from './media-worker.service.js';

describe('Phase 8 media status outbox transaction', () => {
  const organizationId = randomUUID();
  const employeeId = randomUUID();
  const receiverId = randomUUID();
  const coreValueId = randomUUID();
  const kudoId = randomUUID();

  beforeAll(async () => {
    await database.organization.create({
      data: {
        id: organizationId,
        name: 'Media outbox rollback',
        slug: `media-outbox-${organizationId}`,
        timezone: 'Asia/Ho_Chi_Minh',
      },
    });
    await database.employee.createMany({
      data: [
        {
          id: employeeId,
          organizationId,
          email: `${employeeId}@good-job.local`,
          normalizedEmail: `${employeeId}@good-job.local`,
          displayName: 'Media Worker',
        },
        {
          id: receiverId,
          organizationId,
          email: `${receiverId}@good-job.local`,
          normalizedEmail: `${receiverId}@good-job.local`,
          displayName: 'Media Receiver',
        },
      ],
    });
    await database.coreValue.create({
      data: {
        id: coreValueId,
        organizationId,
        code: 'media-rollback',
        name: 'Media rollback',
      },
    });
    await database.kudo.create({
      data: {
        id: kudoId,
        organizationId,
        senderId: employeeId,
        receiverId,
        coreValueId,
        points: 20,
        description: 'Media owner for rollback.',
        status: KudoStatus.committed,
        committedAt: new Date(),
      },
    });
  });

  it('rolls back terminal media state when its public outbox insert fails', async () => {
    const attachment = await database.mediaAttachment.create({
      data: {
        organizationId,
        createdById: employeeId,
        ownerType: 'kudo',
        ownerId: kudoId,
        mediaType: 'video',
        status: MediaStatus.processing,
        mimeType: 'video/mp4',
        originalName: 'rollback.mp4',
        sizeBytes: 4,
        objectKey: `${organizationId}/${randomUUID()}`,
      },
    });
    await database.$executeRawUnsafe(`
      CREATE OR REPLACE FUNCTION reject_phase_8_media_outbox()
      RETURNS trigger AS $$
      BEGIN
        IF NEW.organization_id = '${organizationId}'::uuid
          AND NEW.event_type = 'media.status_changed' THEN
          RAISE EXCEPTION 'forced media status outbox failure';
        END IF;
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql
    `);
    await database.$executeRawUnsafe(`
      CREATE TRIGGER phase_8_media_outbox_failure
      BEFORE INSERT ON transactional_outbox
      FOR EACH ROW EXECUTE FUNCTION reject_phase_8_media_outbox()
    `);
    try {
      await expect(
        persistMediaTerminalStatus(attachment.id, MediaStatus.ready, 60, null),
      ).rejects.toThrow();
      expect(
        await database.mediaAttachment.findUniqueOrThrow({
          where: { id: attachment.id },
        }),
      ).toMatchObject({
        status: MediaStatus.processing,
        durationSeconds: null,
      });
      expect(
        await database.transactionalOutbox.count({
          where: {
            aggregateId: attachment.id,
            eventType: 'media.status_changed',
          },
        }),
      ).toBe(0);
    } finally {
      await database.$executeRawUnsafe(
        `DROP TRIGGER IF EXISTS phase_8_media_outbox_failure ON transactional_outbox`,
      );
      await database.$executeRawUnsafe(
        `DROP FUNCTION IF EXISTS reject_phase_8_media_outbox()`,
      );
    }
  });
});
