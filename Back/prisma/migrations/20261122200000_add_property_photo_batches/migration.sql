BEGIN;

CREATE TYPE "PropertyPhotoBatchStatus" AS ENUM ('OPEN', 'CONSUMED', 'EXPIRED');
CREATE TYPE "PropertyPhotoUploadStatus" AS ENUM ('READY', 'CONSUMED');

CREATE TABLE "property_photo_batches" (
  "id" UUID NOT NULL,
  "user_id" INTEGER NOT NULL,
  "status" "PropertyPhotoBatchStatus" NOT NULL DEFAULT 'OPEN',
  "expires_at" TIMESTAMP(3) NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "property_photo_batches_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "property_photo_batches_user_id_status_idx"
ON "property_photo_batches"("user_id", "status");

CREATE INDEX "property_photo_batches_status_expires_at_idx"
ON "property_photo_batches"("status", "expires_at");

ALTER TABLE "property_photo_batches"
ADD CONSTRAINT "property_photo_batches_user_id_fkey"
FOREIGN KEY ("user_id") REFERENCES "users"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "property_photo_uploads" (
  "id" UUID NOT NULL,
  "batch_id" UUID NOT NULL,
  "storage_key" VARCHAR(500) NOT NULL,
  "mime_type" VARCHAR(100) NOT NULL,
  "size_bytes" INTEGER NOT NULL,
  "width" INTEGER NOT NULL,
  "height" INTEGER NOT NULL,
  "alt_text" VARCHAR(300),
  "sort_order" INTEGER NOT NULL DEFAULT 0,
  "status" "PropertyPhotoUploadStatus" NOT NULL DEFAULT 'READY',
  "consumed_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "property_photo_uploads_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "property_photo_uploads_mime_type_check"
    CHECK ("mime_type" IN ('image/jpeg', 'image/png', 'image/webp')),
  CONSTRAINT "property_photo_uploads_size_bytes_check"
    CHECK ("size_bytes" > 0 AND "size_bytes" <= 8388608),
  CONSTRAINT "property_photo_uploads_width_check" CHECK ("width" > 0),
  CONSTRAINT "property_photo_uploads_height_check" CHECK ("height" > 0),
  CONSTRAINT "property_photo_uploads_sort_order_check" CHECK ("sort_order" >= 0)
);

CREATE UNIQUE INDEX "property_photo_uploads_storage_key_key"
ON "property_photo_uploads"("storage_key");

CREATE INDEX "property_photo_uploads_batch_id_status_sort_order_idx"
ON "property_photo_uploads"("batch_id", "status", "sort_order");

ALTER TABLE "property_photo_uploads"
ADD CONSTRAINT "property_photo_uploads_batch_id_fkey"
FOREIGN KEY ("batch_id") REFERENCES "property_photo_batches"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

COMMIT;
