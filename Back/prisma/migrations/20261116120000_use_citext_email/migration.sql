-- The email is already normalized to lowercase by every API validator, but the
-- database must also reject case-insensitive duplicates when rows are written
-- outside the API (seeds, manual fixes, future jobs).
CREATE EXTENSION IF NOT EXISTS citext;

-- AlterTable
ALTER TABLE "users" ALTER COLUMN "email" TYPE citext USING "email"::citext;
