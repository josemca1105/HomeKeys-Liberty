-- CreateTable
CREATE TABLE "login_attempts" (
    "email" VARCHAR(255) NOT NULL,
    "failed_attempts" INTEGER NOT NULL DEFAULT 0,
    "locked_until" TIMESTAMP(3),
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "login_attempts_pkey" PRIMARY KEY ("email")
);

-- CreateIndex
CREATE INDEX "login_attempts_updated_at_idx" ON "login_attempts"("updated_at");
