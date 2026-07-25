import {
  EmployeeStatus,
  KudoStatus,
  LedgerDirection,
  LedgerSourceType,
  PrismaClient,
} from '@prisma/client';

const prisma = new PrismaClient();

const ids = {
  organization: '10000000-0000-4000-8000-000000000001',
  engineering: '11000000-0000-4000-8000-000000000001',
  people: '11000000-0000-4000-8000-000000000002',
  an: '20000000-0000-4000-8000-000000000001',
  binh: '20000000-0000-4000-8000-000000000002',
  chi: '20000000-0000-4000-8000-000000000003',
  inactive: '20000000-0000-4000-8000-000000000004',
  ownership: '30000000-0000-4000-8000-000000000001',
  teamwork: '30000000-0000-4000-8000-000000000002',
  innovation: '30000000-0000-4000-8000-000000000003',
  coffee: '40000000-0000-4000-8000-000000000001',
  lunch: '40000000-0000-4000-8000-000000000002',
  archivedReward: '40000000-0000-4000-8000-000000000003',
  kudo: '50000000-0000-4000-8000-000000000001',
  ledger: '60000000-0000-4000-8000-000000000001',
  senderBudget: '70000000-0000-4000-8000-000000000001',
} as const;

async function seed(): Promise<void> {
  const timezone = process.env['ORGANIZATION_TIMEZONE'] ?? 'Asia/Ho_Chi_Minh';
  const businessMonth = process.env['SEED_BUSINESS_MONTH'] ?? '2026-07';

  if (!/^\d{4}-(0[1-9]|1[0-2])$/u.test(businessMonth)) {
    throw new Error('SEED_BUSINESS_MONTH must use YYYY-MM format.');
  }

  await prisma.$transaction(async (tx) => {
    await tx.organization.upsert({
      where: { id: ids.organization },
      update: { name: 'Amanotes Demo', timezone },
      create: {
        id: ids.organization,
        name: 'Amanotes Demo',
        slug: 'amanotes-demo',
        timezone,
      },
    });

    await Promise.all([
      tx.team.upsert({
        where: { id: ids.engineering },
        update: { name: 'Engineering' },
        create: {
          id: ids.engineering,
          organizationId: ids.organization,
          name: 'Engineering',
        },
      }),
      tx.team.upsert({
        where: { id: ids.people },
        update: { name: 'People & Culture' },
        create: {
          id: ids.people,
          organizationId: ids.organization,
          name: 'People & Culture',
        },
      }),
    ]);

    const employees = [
      [
        ids.an,
        ids.engineering,
        'an@goodjob.local',
        'An Nguyen',
        EmployeeStatus.active,
      ],
      [
        ids.binh,
        ids.engineering,
        'binh@goodjob.local',
        'Binh Tran',
        EmployeeStatus.active,
      ],
      [
        ids.chi,
        ids.people,
        'chi@goodjob.local',
        'Chi Le',
        EmployeeStatus.active,
      ],
      [
        ids.inactive,
        ids.people,
        'former@goodjob.local',
        'Former Teammate',
        EmployeeStatus.inactive,
      ],
    ] as const;

    for (const [id, teamId, email, displayName, status] of employees) {
      await tx.employee.upsert({
        where: { id },
        update: { displayName, status, teamId },
        create: {
          id,
          organizationId: ids.organization,
          teamId,
          email,
          normalizedEmail: email.toLowerCase(),
          displayName,
          status,
        },
      });
    }

    const values = [
      [ids.ownership, 'ownership', 'Own the Outcome'],
      [ids.teamwork, 'teamwork', 'Win Together'],
      [ids.innovation, 'innovation', 'Keep Inventing'],
    ] as const;

    for (const [id, code, name] of values) {
      await tx.coreValue.upsert({
        where: { id },
        update: { name, isActive: true },
        create: {
          id,
          organizationId: ids.organization,
          code,
          name,
          isActive: true,
        },
      });
    }

    const rewards = [
      [ids.coffee, 'coffee', 'Coffee Voucher', 40, true],
      [ids.lunch, 'team-lunch', 'Team Lunch Voucher', 120, true],
      [ids.archivedReward, 'archived-mug', 'Archived Mug', 80, false],
    ] as const;

    for (const [id, code, name, costPoints, isActive] of rewards) {
      await tx.reward.upsert({
        where: { id },
        update: { name, costPoints, isActive },
        create: {
          id,
          organizationId: ids.organization,
          code,
          name,
          costPoints,
          isActive,
        },
      });
    }

    for (const employeeId of [ids.an, ids.binh, ids.chi, ids.inactive]) {
      await tx.rewardPointAccount.upsert({
        where: { employeeId },
        update: {},
        create: {
          employeeId,
          currentBalance: employeeId === ids.binh ? 30 : 0,
        },
      });
    }

    await tx.kudo.upsert({
      where: { id: ids.kudo },
      update: {
        description: 'Thank you for stabilizing the release pipeline.',
      },
      create: {
        id: ids.kudo,
        organizationId: ids.organization,
        senderId: ids.an,
        receiverId: ids.binh,
        coreValueId: ids.ownership,
        points: 30,
        description: 'Thank you for stabilizing the release pipeline.',
        status: KudoStatus.committed,
      },
    });

    await tx.monthlyGivingBudget.upsert({
      where: {
        employeeId_businessMonth: {
          employeeId: ids.an,
          businessMonth,
        },
      },
      update: { allowancePoints: 200, usedPoints: 30 },
      create: {
        id: ids.senderBudget,
        employeeId: ids.an,
        businessMonth,
        allowancePoints: 200,
        usedPoints: 30,
      },
    });

    await tx.rewardPointLedger.upsert({
      where: { id: ids.ledger },
      update: {},
      create: {
        id: ids.ledger,
        employeeId: ids.binh,
        direction: LedgerDirection.credit,
        amount: 30,
        sourceType: LedgerSourceType.kudo_credit,
        sourceId: ids.kudo,
        sourceKudoId: ids.kudo,
        balanceAfter: 30,
        description: 'Seeded Kudo credit',
      },
    });
  });
}

seed()
  .then(() => {
    console.info('Seed completed successfully.');
  })
  .catch((error: unknown) => {
    console.error('Seed failed.', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
