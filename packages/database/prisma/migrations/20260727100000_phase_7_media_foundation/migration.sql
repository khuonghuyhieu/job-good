ALTER TABLE "media_attachments"
  ALTER COLUMN "duration_seconds" TYPE DOUBLE PRECISION
  USING "duration_seconds"::DOUBLE PRECISION;

ALTER TABLE "media_attachments"
  ADD CONSTRAINT "media_attachments_organization_id_fkey"
    FOREIGN KEY ("organization_id") REFERENCES "organizations"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "media_attachments_created_by_id_fkey"
    FOREIGN KEY ("created_by_id") REFERENCES "employees"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE FUNCTION protect_media_lifecycle() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND OLD.status IN ('ready', 'failed')
    AND NEW.status IS DISTINCT FROM OLD.status THEN
    RAISE EXCEPTION 'Terminal media status is immutable';
  END IF;
  IF NEW.status = 'ready' AND NEW.failure_code IS NOT NULL THEN
    RAISE EXCEPTION 'Ready media cannot contain a failure code';
  END IF;
  IF NEW.owner_id IS NOT NULL AND NEW.owner_type = 'kudo' THEN
    IF NOT EXISTS (
      SELECT 1 FROM "kudos"
      WHERE "id" = NEW.owner_id
        AND "organization_id" = NEW.organization_id
        AND "sender_id" = NEW.created_by_id
    ) THEN
      RAISE EXCEPTION 'Invalid Kudo media owner';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "media_attachments_lifecycle_guard"
BEFORE INSERT OR UPDATE ON "media_attachments"
FOR EACH ROW EXECUTE FUNCTION protect_media_lifecycle();
