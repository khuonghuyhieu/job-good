import { describe, expect, it } from 'vitest';

import {
  colleagueSearchQuerySchema,
  colleagueSearchResponseSchema,
  coreValuesResponseSchema,
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
});
