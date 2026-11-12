-- Remove orphaned token rows before enforcing the foreign keys.
DELETE FROM "revoked_tokens"
WHERE NOT EXISTS (
  SELECT 1
  FROM "users"
  WHERE "users"."id" = "revoked_tokens"."user_id"
);

DELETE FROM "password_reset_tokens"
WHERE NOT EXISTS (
  SELECT 1
  FROM "users"
  WHERE "users"."id" = "password_reset_tokens"."user_id"
);

-- Indexes used by authentication, user listing and the property API.
CREATE INDEX "users_created_at_id_idx" ON "users"("created_at", "id");
CREATE INDEX "revoked_tokens_user_id_idx" ON "revoked_tokens"("user_id");
CREATE INDEX "password_reset_tokens_user_id_idx" ON "password_reset_tokens"("user_id");
CREATE INDEX "properties_agent_id_idx" ON "properties"("agent_id");
CREATE INDEX "photos_property_id_idx" ON "photos"("property_id");

-- Token rows are removed automatically when their user is deleted.
ALTER TABLE "revoked_tokens"
ADD CONSTRAINT "revoked_tokens_user_id_fkey"
FOREIGN KEY ("user_id") REFERENCES "users"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "password_reset_tokens"
ADD CONSTRAINT "password_reset_tokens_user_id_fkey"
FOREIGN KEY ("user_id") REFERENCES "users"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
