-- Support the tenant-scoped active Core Value selector and its stable ordering.
CREATE INDEX "core_values_organization_id_is_active_name_id_idx"
ON "core_values"("organization_id", "is_active", "name", "id");
