-- Supports the per-recipient unread-count query without scanning all history.
CREATE INDEX "notifications_recipient_id_read_at_idx"
ON "notifications"("recipient_id", "read_at");
