ALTER TABLE "reward_point_accounts"
  ADD COLUMN "ledger_sequence" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "reward_point_ledger"
  ADD COLUMN "sequence" INTEGER;

ALTER TABLE "reward_point_ledger"
  DISABLE TRIGGER "reward_point_ledger_append_only";

WITH ranked AS (
  SELECT
    "id",
    ROW_NUMBER() OVER (
      PARTITION BY "employee_id"
      ORDER BY "created_at" ASC, "id" ASC
    )::INTEGER AS "sequence"
  FROM "reward_point_ledger"
)
UPDATE "reward_point_ledger" AS ledger
SET "sequence" = ranked."sequence"
FROM ranked
WHERE ledger."id" = ranked."id";

ALTER TABLE "reward_point_ledger"
  ENABLE TRIGGER "reward_point_ledger_append_only";

UPDATE "reward_point_accounts" AS account
SET "ledger_sequence" = ledger."maximum_sequence"
FROM (
  SELECT "employee_id", MAX("sequence") AS "maximum_sequence"
  FROM "reward_point_ledger"
  GROUP BY "employee_id"
) AS ledger
WHERE account."employee_id" = ledger."employee_id";

ALTER TABLE "reward_point_accounts"
  ADD CONSTRAINT "reward_point_accounts_ledger_sequence_check"
    CHECK ("ledger_sequence" >= 0);

ALTER TABLE "reward_point_ledger"
  ALTER COLUMN "sequence" SET NOT NULL,
  ADD CONSTRAINT "reward_point_ledger_sequence_check" CHECK ("sequence" > 0);

CREATE UNIQUE INDEX "reward_point_ledger_employee_id_sequence_key"
  ON "reward_point_ledger"("employee_id", "sequence");
