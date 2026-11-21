BEGIN;

-- There were no production property rows when this schema was approved. The
-- old tables are rebuilt so their names, enums and constraints can be changed
-- without carrying a lossy data migration for seed-only records.
DROP TABLE "photos";
DROP TABLE "properties";

DROP TYPE "Category";
DROP TYPE "PropertyType";
DROP TYPE "PropertyStatus";

CREATE TYPE "PropertyType" AS ENUM (
  'HOUSE',
  'APARTMENT',
  'TOWNHOUSE',
  'LAND',
  'COMMERCIAL',
  'OFFICE',
  'WAREHOUSE',
  'FARM'
);

CREATE TYPE "ListingType" AS ENUM ('SALE', 'RENT');

CREATE TYPE "PropertyStatus" AS ENUM ('ACTIVE', 'PAUSED', 'CLOSED');

CREATE TYPE "Currency" AS ENUM ('USD');

CREATE TABLE "properties" (
  "id" SERIAL NOT NULL,
  "agent_id" INTEGER NOT NULL,
  "code" VARCHAR(50) NOT NULL,
  "title" VARCHAR(200) NOT NULL,
  "property_type" "PropertyType" NOT NULL,
  "listing_type" "ListingType" NOT NULL,
  "status" "PropertyStatus" NOT NULL DEFAULT 'ACTIVE',
  "description" TEXT,
  "owner_name" VARCHAR(150) NOT NULL,
  "owner_phone" VARCHAR(20) NOT NULL,
  "owner_email" CITEXT,
  "address" TEXT NOT NULL,
  "neighborhood" VARCHAR(100),
  "city" VARCHAR(100) NOT NULL,
  "state" VARCHAR(100) NOT NULL,
  "latitude" DECIMAL(10,7) NOT NULL,
  "longitude" DECIMAL(10,7) NOT NULL,
  "price" DECIMAL(12,2) NOT NULL,
  "currency" "Currency" NOT NULL DEFAULT 'USD',
  "maintenance_fee" DECIMAL(12,2),
  "is_negotiable" BOOLEAN NOT NULL DEFAULT false,
  "bedrooms" INTEGER NOT NULL,
  "bathrooms" INTEGER NOT NULL,
  "parking_spaces" INTEGER NOT NULL,
  "square_meters" DECIMAL(10,2) NOT NULL,
  "lot_square_meters" DECIMAL(12,2),
  "year_built" INTEGER,
  "apartment_floor" INTEGER,
  "has_water_tank" BOOLEAN NOT NULL DEFAULT false,
  "has_power_plant" BOOLEAN NOT NULL DEFAULT false,
  "is_furnished" BOOLEAN NOT NULL DEFAULT false,
  "allows_pets" BOOLEAN NOT NULL DEFAULT false,
  "has_pool" BOOLEAN NOT NULL DEFAULT false,
  "has_gym" BOOLEAN NOT NULL DEFAULT false,
  "has_balcony" BOOLEAN NOT NULL DEFAULT false,
  "has_air_conditioning" BOOLEAN NOT NULL DEFAULT false,
  "has_security" BOOLEAN NOT NULL DEFAULT false,
  "has_elevator" BOOLEAN NOT NULL DEFAULT false,
  "video_url" TEXT,
  "virtual_tour_url" TEXT,
  "closed_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  "deleted_at" TIMESTAMP(3),

  CONSTRAINT "properties_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "properties_code_check" CHECK ("code" ~ '^HK-[0-9]{4}-[0-9]{6,}$'),
  CONSTRAINT "properties_price_check" CHECK ("price" >= 0),
  CONSTRAINT "properties_maintenance_fee_check" CHECK ("maintenance_fee" IS NULL OR "maintenance_fee" >= 0),
  CONSTRAINT "properties_bedrooms_check" CHECK ("bedrooms" >= 0),
  CONSTRAINT "properties_bathrooms_check" CHECK ("bathrooms" >= 0),
  CONSTRAINT "properties_parking_spaces_check" CHECK ("parking_spaces" >= 0),
  CONSTRAINT "properties_square_meters_check" CHECK ("square_meters" > 0),
  CONSTRAINT "properties_lot_square_meters_check" CHECK ("lot_square_meters" IS NULL OR "lot_square_meters" > 0),
  CONSTRAINT "properties_year_built_check" CHECK ("year_built" IS NULL OR "year_built" BETWEEN 1800 AND 2100),
  CONSTRAINT "properties_apartment_floor_check" CHECK ("apartment_floor" IS NULL OR "apartment_floor" >= 0),
  CONSTRAINT "properties_latitude_check" CHECK ("latitude" BETWEEN -90 AND 90),
  CONSTRAINT "properties_longitude_check" CHECK ("longitude" BETWEEN -180 AND 180)
);

CREATE UNIQUE INDEX "properties_code_key" ON "properties"("code");
CREATE INDEX "properties_agent_id_created_at_idx" ON "properties"("agent_id", "created_at");
CREATE INDEX "properties_status_listing_type_property_type_idx" ON "properties"("status", "listing_type", "property_type");
CREATE INDEX "properties_state_city_idx" ON "properties"("state", "city");
CREATE INDEX "properties_created_at_id_idx" ON "properties"("created_at", "id");

ALTER TABLE "properties"
ADD CONSTRAINT "properties_agent_id_fkey"
FOREIGN KEY ("agent_id") REFERENCES "users"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "photos" (
  "id" SERIAL NOT NULL,
  "property_id" INTEGER NOT NULL,
  "storage_key" VARCHAR(500) NOT NULL,
  "mime_type" VARCHAR(100) NOT NULL,
  "size_bytes" INTEGER NOT NULL,
  "width" INTEGER NOT NULL,
  "height" INTEGER NOT NULL,
  "alt_text" VARCHAR(300),
  "sort_order" INTEGER NOT NULL DEFAULT 0,
  "is_cover" BOOLEAN NOT NULL DEFAULT false,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "photos_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "photos_mime_type_check" CHECK ("mime_type" IN ('image/jpeg', 'image/png', 'image/webp')),
  CONSTRAINT "photos_size_bytes_check" CHECK ("size_bytes" > 0 AND "size_bytes" <= 8388608),
  CONSTRAINT "photos_width_check" CHECK ("width" > 0),
  CONSTRAINT "photos_height_check" CHECK ("height" > 0),
  CONSTRAINT "photos_sort_order_check" CHECK ("sort_order" >= 0)
);

CREATE UNIQUE INDEX "photos_storage_key_key" ON "photos"("storage_key");
CREATE INDEX "photos_property_id_sort_order_idx" ON "photos"("property_id", "sort_order");
CREATE UNIQUE INDEX "photos_one_cover_per_property_key"
ON "photos"("property_id")
WHERE "is_cover" = true;

ALTER TABLE "photos"
ADD CONSTRAINT "photos_property_id_fkey"
FOREIGN KEY ("property_id") REFERENCES "properties"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

COMMIT;
