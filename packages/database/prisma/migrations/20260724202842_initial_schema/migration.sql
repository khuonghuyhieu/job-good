-- CreateEnum
CREATE TYPE "EmployeeStatus" AS ENUM ('active', 'inactive');

-- CreateEnum
CREATE TYPE "KudoStatus" AS ENUM ('committed');

-- CreateEnum
CREATE TYPE "LedgerDirection" AS ENUM ('credit', 'debit');

-- CreateEnum
CREATE TYPE "LedgerSourceType" AS ENUM ('kudo_credit', 'redemption_debit', 'seed_adjustment');

-- CreateEnum
CREATE TYPE "RedemptionStatus" AS ENUM ('committed');

-- CreateEnum
CREATE TYPE "MediaOwnerType" AS ENUM ('kudo', 'comment');

-- CreateEnum
CREATE TYPE "MediaType" AS ENUM ('image', 'video');

-- CreateEnum
CREATE TYPE "MediaStatus" AS ENUM ('uploading', 'processing', 'ready', 'failed');

-- CreateEnum
CREATE TYPE "OutboxStatus" AS ENUM ('pending', 'published', 'failed');

-- CreateTable
CREATE TABLE "organizations" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "timezone" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "organizations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "teams" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "teams_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "employees" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "team_id" UUID,
    "email" TEXT NOT NULL,
    "normalized_email" TEXT NOT NULL,
    "display_name" TEXT NOT NULL,
    "avatar_url" TEXT,
    "status" "EmployeeStatus" NOT NULL DEFAULT 'active',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "employees_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "core_values" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "core_values_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "kudos" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "sender_id" UUID NOT NULL,
    "receiver_id" UUID NOT NULL,
    "core_value_id" UUID NOT NULL,
    "client_request_id" UUID,
    "points" INTEGER NOT NULL,
    "description" TEXT NOT NULL,
    "status" "KudoStatus" NOT NULL DEFAULT 'committed',
    "committed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "kudos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reactions" (
    "id" UUID NOT NULL,
    "kudo_id" UUID NOT NULL,
    "employee_id" UUID NOT NULL,
    "emoji_code" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "reactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "comments" (
    "id" UUID NOT NULL,
    "kudo_id" UUID NOT NULL,
    "employee_id" UUID NOT NULL,
    "body" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "comments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "media_attachments" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "created_by_id" UUID NOT NULL,
    "owner_type" "MediaOwnerType" NOT NULL,
    "owner_id" UUID,
    "media_type" "MediaType" NOT NULL,
    "status" "MediaStatus" NOT NULL DEFAULT 'uploading',
    "mime_type" TEXT NOT NULL,
    "original_name" TEXT NOT NULL,
    "size_bytes" BIGINT NOT NULL,
    "object_key" TEXT NOT NULL,
    "duration_seconds" INTEGER,
    "failure_code" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "media_attachments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "monthly_giving_budgets" (
    "id" UUID NOT NULL,
    "employee_id" UUID NOT NULL,
    "business_month" TEXT NOT NULL,
    "allowance_points" INTEGER NOT NULL DEFAULT 200,
    "used_points" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "monthly_giving_budgets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reward_point_accounts" (
    "id" UUID NOT NULL,
    "employee_id" UUID NOT NULL,
    "current_balance" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "reward_point_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reward_point_ledger" (
    "id" UUID NOT NULL,
    "employee_id" UUID NOT NULL,
    "direction" "LedgerDirection" NOT NULL,
    "amount" INTEGER NOT NULL,
    "source_type" "LedgerSourceType" NOT NULL,
    "source_id" UUID NOT NULL,
    "source_kudo_id" UUID,
    "source_redemption_id" UUID,
    "balance_after" INTEGER NOT NULL,
    "description" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reward_point_ledger_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rewards" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "cost_points" INTEGER NOT NULL,
    "image_url" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "rewards_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reward_redemptions" (
    "id" UUID NOT NULL,
    "employee_id" UUID NOT NULL,
    "reward_id" UUID NOT NULL,
    "idempotency_key" UUID NOT NULL,
    "cost_points" INTEGER NOT NULL,
    "reward_name" TEXT NOT NULL,
    "status" "RedemptionStatus" NOT NULL DEFAULT 'committed',
    "committed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reward_redemptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" UUID NOT NULL,
    "recipient_id" UUID NOT NULL,
    "event_id" UUID NOT NULL,
    "type" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "read_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "transactional_outbox" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "event_type" TEXT NOT NULL,
    "aggregate_type" TEXT NOT NULL,
    "aggregate_id" UUID NOT NULL,
    "payload" JSONB NOT NULL,
    "status" "OutboxStatus" NOT NULL DEFAULT 'pending',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "available_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "published_at" TIMESTAMP(3),
    "last_error" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "transactional_outbox_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "idempotency_records" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "employee_id" UUID NOT NULL,
    "operation" TEXT NOT NULL,
    "key" UUID NOT NULL,
    "request_hash" TEXT NOT NULL,
    "resource_type" TEXT,
    "resource_id" UUID,
    "response_code" INTEGER,
    "response_body" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "idempotency_records_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "organizations_slug_key" ON "organizations"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "teams_organization_id_name_key" ON "teams"("organization_id", "name");

-- CreateIndex
CREATE INDEX "employees_organization_id_status_display_name_idx" ON "employees"("organization_id", "status", "display_name");

-- CreateIndex
CREATE UNIQUE INDEX "employees_organization_id_normalized_email_key" ON "employees"("organization_id", "normalized_email");

-- CreateIndex
CREATE UNIQUE INDEX "core_values_organization_id_code_key" ON "core_values"("organization_id", "code");

-- CreateIndex
CREATE INDEX "kudos_organization_id_committed_at_id_idx" ON "kudos"("organization_id", "committed_at" DESC, "id" DESC);

-- CreateIndex
CREATE INDEX "kudos_receiver_id_committed_at_idx" ON "kudos"("receiver_id", "committed_at" DESC);

-- CreateIndex
CREATE INDEX "kudos_sender_id_committed_at_idx" ON "kudos"("sender_id", "committed_at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "kudos_organization_id_client_request_id_key" ON "kudos"("organization_id", "client_request_id");

-- CreateIndex
CREATE UNIQUE INDEX "reactions_kudo_id_employee_id_key" ON "reactions"("kudo_id", "employee_id");

-- CreateIndex
CREATE INDEX "comments_kudo_id_created_at_id_idx" ON "comments"("kudo_id", "created_at", "id");

-- CreateIndex
CREATE UNIQUE INDEX "media_attachments_object_key_key" ON "media_attachments"("object_key");

-- CreateIndex
CREATE INDEX "media_attachments_owner_type_owner_id_idx" ON "media_attachments"("owner_type", "owner_id");

-- CreateIndex
CREATE INDEX "media_attachments_organization_id_created_by_id_idx" ON "media_attachments"("organization_id", "created_by_id");

-- CreateIndex
CREATE UNIQUE INDEX "monthly_giving_budgets_employee_id_business_month_key" ON "monthly_giving_budgets"("employee_id", "business_month");

-- CreateIndex
CREATE UNIQUE INDEX "reward_point_accounts_employee_id_key" ON "reward_point_accounts"("employee_id");

-- CreateIndex
CREATE UNIQUE INDEX "reward_point_ledger_source_kudo_id_key" ON "reward_point_ledger"("source_kudo_id");

-- CreateIndex
CREATE UNIQUE INDEX "reward_point_ledger_source_redemption_id_key" ON "reward_point_ledger"("source_redemption_id");

-- CreateIndex
CREATE INDEX "reward_point_ledger_employee_id_created_at_id_idx" ON "reward_point_ledger"("employee_id", "created_at" DESC, "id" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "reward_point_ledger_source_type_source_id_key" ON "reward_point_ledger"("source_type", "source_id");

-- CreateIndex
CREATE INDEX "rewards_organization_id_is_active_idx" ON "rewards"("organization_id", "is_active");

-- CreateIndex
CREATE UNIQUE INDEX "rewards_organization_id_code_key" ON "rewards"("organization_id", "code");

-- CreateIndex
CREATE INDEX "reward_redemptions_employee_id_committed_at_id_idx" ON "reward_redemptions"("employee_id", "committed_at" DESC, "id" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "reward_redemptions_employee_id_idempotency_key_key" ON "reward_redemptions"("employee_id", "idempotency_key");

-- CreateIndex
CREATE INDEX "notifications_recipient_id_created_at_id_idx" ON "notifications"("recipient_id", "created_at" DESC, "id" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "notifications_event_id_recipient_id_key" ON "notifications"("event_id", "recipient_id");

-- CreateIndex
CREATE INDEX "transactional_outbox_status_available_at_id_idx" ON "transactional_outbox"("status", "available_at", "id");

-- CreateIndex
CREATE INDEX "idempotency_records_expires_at_idx" ON "idempotency_records"("expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "idempotency_records_organization_id_employee_id_operation_k_key" ON "idempotency_records"("organization_id", "employee_id", "operation", "key");

-- AddForeignKey
ALTER TABLE "teams" ADD CONSTRAINT "teams_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employees" ADD CONSTRAINT "employees_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employees" ADD CONSTRAINT "employees_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "teams"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "core_values" ADD CONSTRAINT "core_values_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kudos" ADD CONSTRAINT "kudos_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kudos" ADD CONSTRAINT "kudos_sender_id_fkey" FOREIGN KEY ("sender_id") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kudos" ADD CONSTRAINT "kudos_receiver_id_fkey" FOREIGN KEY ("receiver_id") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kudos" ADD CONSTRAINT "kudos_core_value_id_fkey" FOREIGN KEY ("core_value_id") REFERENCES "core_values"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reactions" ADD CONSTRAINT "reactions_kudo_id_fkey" FOREIGN KEY ("kudo_id") REFERENCES "kudos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reactions" ADD CONSTRAINT "reactions_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comments" ADD CONSTRAINT "comments_kudo_id_fkey" FOREIGN KEY ("kudo_id") REFERENCES "kudos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comments" ADD CONSTRAINT "comments_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "monthly_giving_budgets" ADD CONSTRAINT "monthly_giving_budgets_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reward_point_accounts" ADD CONSTRAINT "reward_point_accounts_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reward_point_ledger" ADD CONSTRAINT "reward_point_ledger_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reward_point_ledger" ADD CONSTRAINT "reward_point_ledger_source_kudo_id_fkey" FOREIGN KEY ("source_kudo_id") REFERENCES "kudos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reward_point_ledger" ADD CONSTRAINT "reward_point_ledger_source_redemption_id_fkey" FOREIGN KEY ("source_redemption_id") REFERENCES "reward_redemptions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rewards" ADD CONSTRAINT "rewards_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reward_redemptions" ADD CONSTRAINT "reward_redemptions_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reward_redemptions" ADD CONSTRAINT "reward_redemptions_reward_id_fkey" FOREIGN KEY ("reward_id") REFERENCES "rewards"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_recipient_id_fkey" FOREIGN KEY ("recipient_id") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transactional_outbox" ADD CONSTRAINT "transactional_outbox_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "idempotency_records" ADD CONSTRAINT "idempotency_records_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "idempotency_records" ADD CONSTRAINT "idempotency_records_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Business invariants that Prisma cannot express in its schema language.
ALTER TABLE "kudos"
  ADD CONSTRAINT "kudos_points_range_check" CHECK ("points" BETWEEN 10 AND 50),
  ADD CONSTRAINT "kudos_sender_receiver_check" CHECK ("sender_id" <> "receiver_id"),
  ADD CONSTRAINT "kudos_description_nonempty_check" CHECK (length(btrim("description")) > 0);

ALTER TABLE "reactions"
  ADD CONSTRAINT "reactions_emoji_allowlist_check"
  CHECK ("emoji_code" IN ('celebrate', 'heart', 'clap', 'fire'));

ALTER TABLE "comments"
  ADD CONSTRAINT "comments_body_nonempty_check" CHECK (length(btrim("body")) > 0);

ALTER TABLE "monthly_giving_budgets"
  ADD CONSTRAINT "monthly_giving_budgets_allowance_check" CHECK ("allowance_points" = 200),
  ADD CONSTRAINT "monthly_giving_budgets_usage_check"
    CHECK ("used_points" >= 0 AND "used_points" <= "allowance_points"),
  ADD CONSTRAINT "monthly_giving_budgets_month_check"
    CHECK ("business_month" ~ '^[0-9]{4}-(0[1-9]|1[0-2])$');

ALTER TABLE "reward_point_accounts"
  ADD CONSTRAINT "reward_point_accounts_balance_check" CHECK ("current_balance" >= 0);

ALTER TABLE "reward_point_ledger"
  ADD CONSTRAINT "reward_point_ledger_amount_check" CHECK ("amount" > 0),
  ADD CONSTRAINT "reward_point_ledger_balance_after_check" CHECK ("balance_after" >= 0),
  ADD CONSTRAINT "reward_point_ledger_source_mapping_check" CHECK (
    ("source_type" = 'kudo_credit' AND "direction" = 'credit' AND "source_kudo_id" = "source_id" AND "source_redemption_id" IS NULL)
    OR
    ("source_type" = 'redemption_debit' AND "direction" = 'debit' AND "source_redemption_id" = "source_id" AND "source_kudo_id" IS NULL)
    OR
    ("source_type" = 'seed_adjustment' AND "source_kudo_id" IS NULL AND "source_redemption_id" IS NULL)
  );

ALTER TABLE "rewards"
  ADD CONSTRAINT "rewards_cost_check" CHECK ("cost_points" > 0);

ALTER TABLE "reward_redemptions"
  ADD CONSTRAINT "reward_redemptions_cost_check" CHECK ("cost_points" > 0);

ALTER TABLE "media_attachments"
  ADD CONSTRAINT "media_attachments_size_check" CHECK ("size_bytes" > 0),
  ADD CONSTRAINT "media_attachments_video_duration_check" CHECK (
    "media_type" <> 'video'
    OR "status" <> 'ready'
    OR ("duration_seconds" IS NOT NULL AND "duration_seconds" BETWEEN 0 AND 180)
  ),
  ADD CONSTRAINT "media_attachments_terminal_state_check" CHECK (
    ("status" = 'failed' AND "failure_code" IS NOT NULL)
    OR "status" <> 'failed'
  );

CREATE FUNCTION protect_committed_kudo() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'Committed Kudos cannot be deleted';
  END IF;

  IF OLD."sender_id" <> NEW."sender_id"
    OR OLD."receiver_id" <> NEW."receiver_id"
    OR OLD."core_value_id" <> NEW."core_value_id"
    OR OLD."points" <> NEW."points"
    OR OLD."organization_id" <> NEW."organization_id"
  THEN
    RAISE EXCEPTION 'Committed Kudo recognition facts are immutable';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "kudos_protect_committed"
  BEFORE UPDATE OR DELETE ON "kudos"
  FOR EACH ROW EXECUTE FUNCTION protect_committed_kudo();

CREATE FUNCTION reject_ledger_mutation() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'Reward Point ledger is append-only';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "reward_point_ledger_append_only"
  BEFORE UPDATE OR DELETE ON "reward_point_ledger"
  FOR EACH ROW EXECUTE FUNCTION reject_ledger_mutation();
