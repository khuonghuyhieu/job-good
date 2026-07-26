import { randomUUID } from 'node:crypto';

import { Inject, Injectable } from '@nestjs/common';
import type {
  CreateKudoRequest,
  CreateKudoResponse,
} from '@good-job/contracts';
import {
  database,
  KudoStatus,
  LedgerDirection,
  LedgerSourceType,
  OutboxStatus,
  type Prisma,
} from '@good-job/database';

import type { AuthenticatedPrincipal } from '../../auth/authenticated-principal.js';
import { hashCreateKudoRequest } from '../application/idempotency/request-hash.js';
import {
  CreateKudoRuleError,
  validateCreateKudoFacts,
} from '../domain/create-kudo.rules.js';
import { resolveBusinessMonth } from '../domain/business-month.js';
import { CreateKudoIdempotencyRepository } from './create-kudo-idempotency.repository.js';

type LockedBudget = {
  id: string;
  allowancePoints: number;
  usedPoints: number;
};

type LockedRewardAccount = {
  id: string;
  currentBalance: number;
  ledgerSequence: number;
};

type LockedSelectableRow = {
  id: string;
};

type LockedAttachment = {
  id: string;
  mediaType: 'image' | 'video';
  status: 'processing' | 'ready';
};

@Injectable()
export class CreateKudoRepository {
  constructor(
    @Inject(CreateKudoIdempotencyRepository)
    private readonly idempotency: CreateKudoIdempotencyRepository,
  ) {}

  executeAtomic(
    principal: AuthenticatedPrincipal,
    input: CreateKudoRequest,
    idempotencyKey: string,
  ): Promise<CreateKudoResponse> {
    const requestHash = hashCreateKudoRequest(input);
    return database.$transaction(async (transaction) => {
      const claim = await this.idempotency.claim(
        transaction,
        principal,
        idempotencyKey,
        requestHash,
      );
      if (claim.kind === 'replay') {
        return claim.response;
      }
      const response = await this.executeWithinTransaction(
        transaction,
        principal,
        input,
      );
      await this.idempotency.complete(transaction, claim.recordId, response);
      return response;
    });
  }

  private async executeWithinTransaction(
    transaction: Prisma.TransactionClient,
    principal: AuthenticatedPrincipal,
    input: CreateKudoRequest,
  ): Promise<CreateKudoResponse> {
    const organization = await transaction.organization.findUniqueOrThrow({
      where: { id: principal.organizationId },
      select: { timezone: true },
    });
    const businessMonth = resolveBusinessMonth(organization.timezone);

    await transaction.$executeRaw`
      INSERT INTO "monthly_giving_budgets" (
        "id",
        "employee_id",
        "business_month",
        "allowance_points",
        "used_points",
        "created_at",
        "updated_at"
      )
      VALUES (
        ${randomUUID()}::uuid,
        ${principal.employeeId}::uuid,
        ${businessMonth},
        200,
        0,
        CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP
      )
      ON CONFLICT ("employee_id", "business_month") DO NOTHING
    `;
    const [budget] = await transaction.$queryRaw<LockedBudget[]>`
      SELECT
        "id",
        "allowance_points" AS "allowancePoints",
        "used_points" AS "usedPoints"
      FROM "monthly_giving_budgets"
      WHERE "employee_id" = ${principal.employeeId}::uuid
        AND "business_month" = ${businessMonth}
      FOR UPDATE
    `;
    if (!budget) {
      throw new Error('The sender Giving Budget could not be locked.');
    }

    const [sender] = await transaction.$queryRaw<LockedSelectableRow[]>`
      SELECT "id"
      FROM "employees"
      WHERE "id" = ${principal.employeeId}::uuid
        AND "organization_id" = ${principal.organizationId}::uuid
        AND "status" = 'active'
      FOR SHARE
    `;
    if (!sender) {
      throw new CreateKudoRuleError(
        401,
        'UNAUTHENTICATED',
        'The session is no longer valid.',
      );
    }

    const [receiver] = await transaction.$queryRaw<LockedSelectableRow[]>`
      SELECT "id"
      FROM "employees"
      WHERE "id" = ${input.receiverId}::uuid
        AND "organization_id" = ${principal.organizationId}::uuid
        AND "status" = 'active'
      FOR SHARE
    `;
    if (!receiver) {
      throw new CreateKudoRuleError(
        404,
        'RESOURCE_NOT_FOUND',
        'The selected receiver is unavailable.',
      );
    }

    if (principal.employeeId === receiver.id) {
      throw new CreateKudoRuleError(
        409,
        'SELF_RECOGNITION_NOT_ALLOWED',
        'An employee cannot give a Kudo to themselves.',
      );
    }
    if (
      !Number.isInteger(input.points) ||
      input.points < 10 ||
      input.points > 50
    ) {
      throw new CreateKudoRuleError(
        400,
        'VALIDATION_ERROR',
        'The Kudo request is invalid.',
        { points: 'Points must be an integer between 10 and 50.' },
      );
    }

    const [coreValue] = await transaction.$queryRaw<LockedSelectableRow[]>`
      SELECT "id"
      FROM "core_values"
      WHERE "id" = ${input.coreValueId}::uuid
        AND "organization_id" = ${principal.organizationId}::uuid
        AND "is_active" = true
      FOR SHARE
    `;
    if (!coreValue) {
      throw new CreateKudoRuleError(
        409,
        'CORE_VALUE_UNAVAILABLE',
        'The selected Core Value is unavailable.',
      );
    }

    const description = validateCreateKudoFacts({
      senderId: principal.employeeId,
      receiverId: receiver.id,
      points: input.points,
      description: input.description,
    });
    const attachmentIds = [...new Set(input.attachmentIds ?? [])].sort();
    if (attachmentIds.length !== (input.attachmentIds ?? []).length) {
      throw new CreateKudoRuleError(
        400,
        'VALIDATION_ERROR',
        'The Kudo request contains duplicate attachments.',
        { attachmentIds: 'Attachment IDs must be unique.' },
      );
    }
    const attachments: LockedAttachment[] = [];
    for (const attachmentId of attachmentIds) {
      const [attachment] = await transaction.$queryRaw<LockedAttachment[]>`
        SELECT "id", "media_type" AS "mediaType", "status"
        FROM "media_attachments"
        WHERE "id" = ${attachmentId}::uuid
          AND "organization_id" = ${principal.organizationId}::uuid
          AND "created_by_id" = ${principal.employeeId}::uuid
          AND "owner_type" = 'kudo'
          AND "owner_id" IS NULL
          AND "status" IN ('processing', 'ready')
        FOR UPDATE
      `;
      if (!attachment) {
        throw new CreateKudoRuleError(
          409,
          'MEDIA_UNAVAILABLE',
          'A selected media attachment is unavailable.',
        );
      }
      attachments.push(attachment);
    }
    if (budget.usedPoints + input.points > budget.allowancePoints) {
      throw new CreateKudoRuleError(
        409,
        'INSUFFICIENT_GIVING_BUDGET',
        'The monthly Giving Budget is insufficient.',
        undefined,
        {
          businessMonth,
          allowance: budget.allowancePoints,
          used: budget.usedPoints,
          remaining: budget.allowancePoints - budget.usedPoints,
          requested: input.points,
        },
      );
    }

    const kudoId = randomUUID();
    const eventId = randomUUID();
    const committedAt = new Date();
    const kudo = await transaction.kudo.create({
      data: {
        id: kudoId,
        organizationId: principal.organizationId,
        senderId: principal.employeeId,
        receiverId: receiver.id,
        coreValueId: coreValue.id,
        points: input.points,
        description,
        status: KudoStatus.committed,
        committedAt,
      },
    });
    if (attachmentIds.length) {
      await transaction.mediaAttachment.updateMany({
        where: { id: { in: attachmentIds }, ownerId: null },
        data: { ownerId: kudo.id },
      });
    }
    const updatedBudget = await transaction.monthlyGivingBudget.update({
      where: { id: budget.id },
      data: { usedPoints: { increment: input.points } },
    });

    await transaction.$executeRaw`
      INSERT INTO "reward_point_accounts" (
        "id",
        "employee_id",
        "current_balance",
        "created_at",
        "updated_at"
      )
      VALUES (
        ${randomUUID()}::uuid,
        ${receiver.id}::uuid,
        0,
        CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP
      )
      ON CONFLICT ("employee_id") DO NOTHING
    `;
    const [account] = await transaction.$queryRaw<LockedRewardAccount[]>`
      SELECT
        "id",
        "current_balance" AS "currentBalance",
        "ledger_sequence" AS "ledgerSequence"
      FROM "reward_point_accounts"
      WHERE "employee_id" = ${receiver.id}::uuid
      FOR UPDATE
    `;
    if (!account) {
      throw new Error('The receiver Reward Point account could not be locked.');
    }
    const balanceAfter = account.currentBalance + input.points;
    const ledgerSequence = account.ledgerSequence + 1;
    await transaction.rewardPointAccount.update({
      where: { id: account.id },
      data: {
        currentBalance: balanceAfter,
        ledgerSequence,
      },
    });
    await transaction.rewardPointLedger.create({
      data: {
        employeeId: receiver.id,
        direction: LedgerDirection.credit,
        amount: input.points,
        sourceType: LedgerSourceType.kudo_credit,
        sourceId: kudo.id,
        sourceKudoId: kudo.id,
        sequence: ledgerSequence,
        balanceAfter,
        description: `Kudo credit from ${principal.employeeId}`,
      },
    });

    const eventPayload = {
      eventId,
      type: 'kudo.committed',
      organizationId: principal.organizationId,
      recipientUserIds: [receiver.id],
      occurredAt: committedAt.toISOString(),
      payload: {
        kudoId: kudo.id,
        senderId: principal.employeeId,
        receiverId: receiver.id,
        coreValueId: coreValue.id,
        points: input.points,
        description,
      },
    };
    await transaction.notification.create({
      data: {
        recipientId: receiver.id,
        eventId,
        type: 'kudo.received',
        payload: eventPayload.payload,
      },
    });
    await transaction.transactionalOutbox.create({
      data: {
        id: eventId,
        organizationId: principal.organizationId,
        eventType: eventPayload.type,
        aggregateType: 'kudo',
        aggregateId: kudo.id,
        payload: eventPayload,
        status: OutboxStatus.pending,
      },
    });

    return {
      kudo: {
        id: kudo.id,
        senderId: kudo.senderId,
        receiverId: kudo.receiverId,
        coreValueId: kudo.coreValueId,
        points: kudo.points,
        description: kudo.description,
        status: kudo.status,
        committedAt: kudo.committedAt.toISOString(),
        attachments: attachments.map((attachment) => ({
          id: attachment.id,
          mediaType: attachment.mediaType,
          status: attachment.status,
        })),
      },
      businessMonth,
      givingBudget: {
        allowance: 200,
        used: updatedBudget.usedPoints,
        remaining: updatedBudget.allowancePoints - updatedBudget.usedPoints,
      },
      receiverCredit: {
        amount: input.points,
        balanceAfter,
      },
    };
  }
}
