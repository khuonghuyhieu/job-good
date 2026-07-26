import { describe, expect, it } from 'vitest';

import {
  colleagueSearchQuerySchema,
  colleagueSearchResponseSchema,
  coreValuesResponseSchema,
  createKudoRequestSchema,
  createKudoResponseSchema,
  idempotencyKeySchema,
  walletOverviewResponseSchema,
} from './recognition.js';

const id = '10000000-0000-4000-8000-000000000001';

describe('recognition query contracts', () => {
  it('normalizes an omitted or padded colleague query', () => {
    expect(colleagueSearchQuerySchema.parse({})).toEqual({ query: '' });
    expect(colleagueSearchQuerySchema.parse({ query: '  An  ' })).toEqual({
      query: 'An',
    });
  });

  it('rejects unknown colleague query fields and invalid cursors', () => {
    expect(
      colleagueSearchQuerySchema.safeParse({ organizationId: id }).success,
    ).toBe(false);
    expect(
      colleagueSearchQuerySchema.safeParse({ cursor: 'not-a-uuid' }).success,
    ).toBe(false);
  });

  it('accepts the bounded Group A response shapes', () => {
    expect(
      colleagueSearchResponseSchema.parse({
        items: [
          {
            id,
            displayName: 'An Nguyen',
            avatarUrl: null,
            teamName: 'Engineering',
          },
        ],
        nextCursor: null,
      }).items,
    ).toHaveLength(1);

    expect(
      coreValuesResponseSchema.parse({
        items: [
          {
            id,
            code: 'ownership',
            name: 'Own the Outcome',
            description: null,
          },
        ],
      }).items,
    ).toHaveLength(1);

    expect(
      walletOverviewResponseSchema.parse({
        businessMonth: '2026-07',
        givingBudget: { allowance: 200, used: 30, remaining: 170 },
        rewardBalance: 0,
      }),
    ).toMatchObject({
      givingBudget: { allowance: 200, used: 30, remaining: 170 },
    });
  });

  it('rejects invalid business months and budget arithmetic bounds', () => {
    expect(
      walletOverviewResponseSchema.safeParse({
        businessMonth: '2026-13',
        givingBudget: { allowance: 200, used: 0, remaining: 200 },
        rewardBalance: 0,
      }).success,
    ).toBe(false);
    expect(
      walletOverviewResponseSchema.safeParse({
        businessMonth: '2026-07',
        givingBudget: { allowance: 200, used: 201, remaining: -1 },
        rewardBalance: 0,
      }).success,
    ).toBe(false);
  });

  it('defines strict Create Kudo transport and committed response shapes', () => {
    expect(
      createKudoRequestSchema.safeParse({
        receiverId: id,
        coreValueId: id,
        points: 30,
        description: 'Thank you.',
        senderId: id,
      }).success,
    ).toBe(false);
    expect(
      createKudoResponseSchema.parse({
        kudo: {
          id,
          senderId: id,
          receiverId: id,
          coreValueId: id,
          points: 30,
          description: 'Thank you.',
          status: 'committed',
          committedAt: '2026-07-25T00:00:00.000Z',
          attachments: [],
        },
        businessMonth: '2026-07',
        givingBudget: { allowance: 200, used: 30, remaining: 170 },
        receiverCredit: { amount: 30, balanceAfter: 30 },
      }).receiverCredit,
    ).toEqual({ amount: 30, balanceAfter: 30 });
    expect(idempotencyKeySchema.parse(id)).toBe(id);
    expect(idempotencyKeySchema.safeParse('not-a-uuid').success).toBe(false);
  });
});
