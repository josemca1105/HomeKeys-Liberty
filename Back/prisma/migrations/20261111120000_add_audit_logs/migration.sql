CREATE TYPE "AuditScope" AS ENUM ('SECURITY', 'BUSINESS');

CREATE TABLE "audit_logs" (
  "id" SERIAL NOT NULL,
  "scope" "AuditScope" NOT NULL,
  "actor_id" INTEGER,
  "actor_role" "Role",
  "actor_email" VARCHAR(255),
  "action" VARCHAR(80) NOT NULL,
  "entity_type" VARCHAR(40),
  "entity_id" INTEGER,
  "changes" JSONB,
  "ip" VARCHAR(45),
  "user_agent" VARCHAR(512),
  "request_id" VARCHAR(64),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "audit_logs_created_at_id_idx" ON "audit_logs"("created_at", "id");
CREATE INDEX "audit_logs_actor_id_created_at_idx" ON "audit_logs"("actor_id", "created_at");
CREATE INDEX "audit_logs_scope_created_at_idx" ON "audit_logs"("scope", "created_at");
CREATE INDEX "audit_logs_action_created_at_idx" ON "audit_logs"("action", "created_at");
CREATE INDEX "audit_logs_entity_type_entity_id_created_at_idx" ON "audit_logs"("entity_type", "entity_id", "created_at");
