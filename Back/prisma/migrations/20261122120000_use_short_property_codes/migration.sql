BEGIN;

-- The year was redundant: the sequence is global and never resets annually.
-- Normalize existing year-prefixed codes to the new short human format.
ALTER TABLE "properties" DROP CONSTRAINT "properties_code_check";
ALTER TABLE "properties" ALTER COLUMN "code" DROP DEFAULT;

UPDATE "properties"
SET "code" =
  'HK-' ||
  lpad(
    (
      regexp_replace("code", '^HK-[0-9]{4}-', '')
    )::bigint::text,
    4,
    '0'
  )
WHERE "code" ~ '^HK-[0-9]{4}-[0-9]+$';

ALTER TABLE "properties"
ADD CONSTRAINT "properties_code_check"
CHECK ("code" ~ '^HK-[0-9]{4,}$');

ALTER TABLE "properties"
ALTER COLUMN "code"
SET DEFAULT (
  'HK-' || lpad(nextval('property_code_seq')::text, 4, '0')
);

COMMIT;
