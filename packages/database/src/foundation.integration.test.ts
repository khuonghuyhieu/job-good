import { randomUUID } from 'node:crypto';
import { afterAll, describe, expect, it } from 'vitest';

import { database } from './index.js';

describe('foundation migration and seed', () => {
  afterAll(async () => {
    await database.$disconnect();
  });

  it('contains the deterministic demo foundation', async () => {
    const [organizations, employees, coreValues, rewards, kudos] =
      await Promise.all([
        database.organization.count(),
        database.employee.count(),
        database.coreValue.count(),
        database.reward.count(),
        database.kudo.count(),
      ]);

    expect(organizations).toBeGreaterThanOrEqual(1);
    expect(employees).toBeGreaterThanOrEqual(4);
    expect(coreValues).toBeGreaterThanOrEqual(3);
    expect(rewards).toBeGreaterThanOrEqual(3);
    expect(kudos).toBeGreaterThanOrEqual(1);
  });

  it('uses the configured deterministic business month exactly once', async () => {
    const businessMonth = process.env['SEED_BUSINESS_MONTH'] ?? '2026-07';
    const budgets = await database.monthlyGivingBudget.findMany({
      where: { businessMonth },
    });

    expect(budgets).toHaveLength(1);
    expect(budgets[0]).toMatchObject({
      allowancePoints: 200,
      usedPoints: 30,
    });
  });

  it('keeps seeded account balances reconciled with the ledger', async () => {
    const accounts = await database.rewardPointAccount.findMany();

    for (const account of accounts) {
      const ledger = await database.rewardPointLedger.findMany({
        where: { employeeId: account.employeeId },
      });
      const balance = ledger.reduce(
        (total, entry) =>
          total + (entry.direction === 'credit' ? entry.amount : -entry.amount),
        0,
      );
      expect(account.currentBalance).toBe(balance);
    }
  });

  it('enforces the Kudo point range in PostgreSQL', async () => {
    const organization = await database.organization.findFirstOrThrow({
      include: { employees: true, coreValues: true },
    });
    const [sender, receiver] = organization.employees;
    const [coreValue] = organization.coreValues;

    expect(sender).toBeDefined();
    expect(receiver).toBeDefined();
    expect(coreValue).toBeDefined();

    await expect(
      database.kudo.create({
        data: {
          id: randomUUID(),
          organizationId: organization.id,
          senderId: sender!.id,
          receiverId: receiver!.id,
          coreValueId: coreValue!.id,
          points: 9,
          description: 'This must be rejected by the database.',
        },
      }),
    ).rejects.toThrow();
  });
});
