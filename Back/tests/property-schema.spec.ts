import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import {
  Currency,
  ListingType,
  Prisma,
  PropertyStatus,
  PropertyType,
} from "@prisma/client";

const MIGRATION_PATH = path.join(
  process.cwd(),
  "prisma",
  "migrations",
  "20261118210000_add_property_capture_schema",
  "migration.sql",
);

const migrationSql = readFileSync(MIGRATION_PATH, "utf8");

const getModel = (name: string) => {
  const model = Prisma.dmmf.datamodel.models.find(
    (candidate) => candidate.name === name,
  );

  assert.ok(model, `Missing Prisma model: ${name}`);
  return model;
};

const assertRequiredFields = (modelName: string, fields: string[]): void => {
  const model = getModel(modelName);

  for (const fieldName of fields) {
    const field = model.fields.find((candidate) => candidate.name === fieldName);

    assert.ok(field, `Missing ${modelName}.${fieldName}`);
    assert.equal(field.isRequired, true, `${modelName}.${fieldName} is nullable`);
  }
};

describe("Property capture schema", () => {
  it("defines the approved enums", () => {
    assert.deepEqual(
      Object.values(PropertyType).sort(),
      [
        "APARTMENT",
        "COMMERCIAL",
        "FARM",
        "HOUSE",
        "LAND",
        "OFFICE",
        "TOWNHOUSE",
        "WAREHOUSE",
      ],
    );
    assert.deepEqual(Object.values(ListingType), ["SALE", "RENT"]);
    assert.deepEqual(Object.values(PropertyStatus), [
      "ACTIVE",
      "PAUSED",
      "CLOSED",
    ]);
    assert.deepEqual(Object.values(Currency), ["USD"]);
  });

  it("requires the complete capture fields and removes the legacy shape", () => {
    assertRequiredFields("Property", [
      "agentId",
      "code",
      "title",
      "propertyType",
      "listingType",
      "status",
      "ownerName",
      "ownerPhone",
      "address",
      "city",
      "state",
      "latitude",
      "longitude",
      "price",
      "currency",
      "isNegotiable",
      "bedrooms",
      "bathrooms",
      "parkingSpaces",
      "squareMeters",
      "hasWaterTank",
      "hasPowerPlant",
      "isFurnished",
      "allowsPets",
      "hasPool",
      "hasGym",
      "hasBalcony",
      "hasAirConditioning",
      "hasSecurity",
      "hasElevator",
    ]);

    const property = getModel("Property");
    const fieldNames = new Set(property.fields.map((field) => field.name));

    for (const removedField of ["category", "type"]) {
      assert.equal(fieldNames.has(removedField), false);
    }

    assert.equal(
      property.fields.find((field) => field.name === "propertyType")?.type,
      "PropertyType",
    );
    assert.equal(
      property.fields.find((field) => field.name === "listingType")?.type,
      "ListingType",
    );
  });

  it("stores photo metadata instead of arbitrary image URLs", () => {
    assertRequiredFields("Photo", [
      "propertyId",
      "storageKey",
      "mimeType",
      "sizeBytes",
      "width",
      "height",
      "sortOrder",
      "isCover",
    ]);

    const photo = getModel("Photo");
    const fieldNames = new Set(photo.fields.map((field) => field.name));

    assert.equal(fieldNames.has("imageUrl"), false);
  });

  it("enforces database checks and a single cover photo", () => {
    for (const constraint of [
      "properties_latitude_check",
      "properties_longitude_check",
      "properties_price_check",
      "properties_square_meters_check",
      "properties_year_built_check",
      "photos_mime_type_check",
      "photos_size_bytes_check",
      "photos_sort_order_check",
    ]) {
      assert.match(
        migrationSql,
        new RegExp(`CONSTRAINT "${constraint}"`),
        `Missing constraint: ${constraint}`,
      );
    }

    assert.match(
      migrationSql,
      /CREATE UNIQUE INDEX "photos_one_cover_per_property_key"[\s\S]*WHERE "is_cover" = true;/,
    );
  });
});
