CREATE OR REPLACE FUNCTION protect_media_lifecycle() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF OLD.status IS DISTINCT FROM NEW.status AND NOT (
      (OLD.status = 'uploading' AND OLD.media_type = 'image' AND NEW.status = 'ready')
      OR
      (OLD.status = 'uploading' AND OLD.media_type = 'video' AND NEW.status = 'processing')
      OR
      (OLD.status = 'processing' AND OLD.media_type = 'video' AND NEW.status IN ('ready', 'failed'))
    ) THEN
      RAISE EXCEPTION 'Invalid media lifecycle transition';
    END IF;

    IF OLD.status <> 'uploading' AND (
      NEW.organization_id IS DISTINCT FROM OLD.organization_id
      OR NEW.created_by_id IS DISTINCT FROM OLD.created_by_id
      OR NEW.owner_type IS DISTINCT FROM OLD.owner_type
      OR NEW.media_type IS DISTINCT FROM OLD.media_type
      OR NEW.mime_type IS DISTINCT FROM OLD.mime_type
      OR NEW.original_name IS DISTINCT FROM OLD.original_name
      OR NEW.size_bytes IS DISTINCT FROM OLD.size_bytes
      OR NEW.object_key IS DISTINCT FROM OLD.object_key
      OR (OLD.status IN ('ready', 'failed') AND (
        NEW.duration_seconds IS DISTINCT FROM OLD.duration_seconds
        OR NEW.failure_code IS DISTINCT FROM OLD.failure_code
      ))
    ) THEN
      RAISE EXCEPTION 'Committed media metadata is immutable';
    END IF;
  END IF;

  IF NEW.status = 'ready' AND NEW.failure_code IS NOT NULL THEN
    RAISE EXCEPTION 'Ready media cannot contain a failure code';
  END IF;
  IF NEW.status = 'failed' AND NEW.failure_code IS NULL THEN
    RAISE EXCEPTION 'Failed media requires a failure code';
  END IF;
  IF NEW.status = 'ready' AND NEW.media_type = 'video'
    AND (NEW.duration_seconds IS NULL OR NEW.duration_seconds > 180) THEN
    RAISE EXCEPTION 'Ready video requires an allowed duration';
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
