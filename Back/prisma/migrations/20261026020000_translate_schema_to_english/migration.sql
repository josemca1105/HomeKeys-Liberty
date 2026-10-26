BEGIN;

-- Rename enum values while preserving their stored data.
ALTER TYPE "Rango" RENAME VALUE 'SOCIO' TO 'PARTNER';
ALTER TYPE "Categoria" RENAME VALUE 'Casa' TO 'House';
ALTER TYPE "Categoria" RENAME VALUE 'Apartamento' TO 'Apartment';
ALTER TYPE "Categoria" RENAME VALUE 'Local' TO 'Commercial';
ALTER TYPE "TipoInmueble" RENAME VALUE 'Venta' TO 'Sale';
ALTER TYPE "TipoInmueble" RENAME VALUE 'Alquiler' TO 'Rent';
ALTER TYPE "EstatusInmueble" RENAME VALUE 'Activo' TO 'Active';
ALTER TYPE "EstatusInmueble" RENAME VALUE 'Inactivo' TO 'Inactive';

-- Rename enum types.
ALTER TYPE "Rango" RENAME TO "Role";
ALTER TYPE "Categoria" RENAME TO "Category";
ALTER TYPE "TipoInmueble" RENAME TO "PropertyType";
ALTER TYPE "EstatusInmueble" RENAME TO "PropertyStatus";

-- Rename tables.
ALTER TABLE "usuarios" RENAME TO "users";
ALTER TABLE "inmuebles" RENAME TO "properties";
ALTER TABLE "fotos" RENAME TO "photos";
ALTER TABLE "tokens_revocados" RENAME TO "revoked_tokens";
ALTER TABLE "tokens_reseteo" RENAME TO "password_reset_tokens";

-- Rename sequences.
ALTER SEQUENCE "usuarios_id_seq" RENAME TO "users_id_seq";
ALTER SEQUENCE "inmuebles_id_seq" RENAME TO "properties_id_seq";
ALTER SEQUENCE "fotos_id_seq" RENAME TO "photos_id_seq";
ALTER SEQUENCE "tokens_revocados_id_seq" RENAME TO "revoked_tokens_id_seq";
ALTER SEQUENCE "tokens_reseteo_id_seq" RENAME TO "password_reset_tokens_id_seq";

-- Rename user columns.
ALTER TABLE "users" RENAME COLUMN "nombre" TO "first_name";
ALTER TABLE "users" RENAME COLUMN "apellido" TO "last_name";
ALTER TABLE "users" RENAME COLUMN "correo" TO "email";
ALTER TABLE "users" RENAME COLUMN "clave" TO "password_hash";
ALTER TABLE "users" RENAME COLUMN "telefono" TO "phone";
ALTER TABLE "users" RENAME COLUMN "foto_url" TO "photo_url";
ALTER TABLE "users" RENAME COLUMN "rango" TO "role";

-- Rename property columns.
ALTER TABLE "properties" RENAME COLUMN "asesor_id" TO "agent_id";
ALTER TABLE "properties" RENAME COLUMN "codigo" TO "code";
ALTER TABLE "properties" RENAME COLUMN "categoria" TO "category";
ALTER TABLE "properties" RENAME COLUMN "ciudad" TO "city";
ALTER TABLE "properties" RENAME COLUMN "estado" TO "state";
ALTER TABLE "properties" RENAME COLUMN "direccion" TO "address";
ALTER TABLE "properties" RENAME COLUMN "precio" TO "price";
ALTER TABLE "properties" RENAME COLUMN "descripcion" TO "description";
ALTER TABLE "properties" RENAME COLUMN "banos" TO "bathrooms";
ALTER TABLE "properties" RENAME COLUMN "cuartos" TO "bedrooms";
ALTER TABLE "properties" RENAME COLUMN "estacionamientos" TO "parking_spaces";
ALTER TABLE "properties" RENAME COLUMN "metraje" TO "square_meters";
ALTER TABLE "properties" RENAME COLUMN "estatus" TO "status";
ALTER TABLE "properties" RENAME COLUMN "piso_apto" TO "apartment_floor";
ALTER TABLE "properties" RENAME COLUMN "tiene_ascensor" TO "has_elevator";
ALTER TABLE "properties" RENAME COLUMN "tiene_planta" TO "has_power_plant";

-- Rename photo columns.
ALTER TABLE "photos" RENAME COLUMN "inmueble_id" TO "property_id";
ALTER TABLE "photos" RENAME COLUMN "url_imagen" TO "image_url";
ALTER TABLE "photos" RENAME COLUMN "es_portada" TO "is_cover";

-- Rename token columns.
ALTER TABLE "revoked_tokens" RENAME COLUMN "usuario_id" TO "user_id";
ALTER TABLE "revoked_tokens" RENAME COLUMN "expira_en" TO "expires_at";
ALTER TABLE "password_reset_tokens" RENAME COLUMN "usuario_id" TO "user_id";
ALTER TABLE "password_reset_tokens" RENAME COLUMN "expira_en" TO "expires_at";
ALTER TABLE "password_reset_tokens" RENAME COLUMN "usado" TO "used";

-- Rename primary key constraints.
ALTER TABLE "users" RENAME CONSTRAINT "usuarios_pkey" TO "users_pkey";
ALTER TABLE "properties" RENAME CONSTRAINT "inmuebles_pkey" TO "properties_pkey";
ALTER TABLE "photos" RENAME CONSTRAINT "fotos_pkey" TO "photos_pkey";
ALTER TABLE "revoked_tokens" RENAME CONSTRAINT "tokens_revocados_pkey" TO "revoked_tokens_pkey";
ALTER TABLE "password_reset_tokens" RENAME CONSTRAINT "tokens_reseteo_pkey" TO "password_reset_tokens_pkey";

-- Rename foreign key constraints.
ALTER TABLE "properties" RENAME CONSTRAINT "inmuebles_asesor_id_fkey" TO "properties_agent_id_fkey";
ALTER TABLE "photos" RENAME CONSTRAINT "fotos_inmueble_id_fkey" TO "photos_property_id_fkey";

-- Rename unique and regular indexes.
ALTER INDEX "usuarios_correo_key" RENAME TO "users_email_key";
ALTER INDEX "inmuebles_codigo_key" RENAME TO "properties_code_key";
ALTER INDEX "tokens_revocados_token_hash_key" RENAME TO "revoked_tokens_token_hash_key";
ALTER INDEX "tokens_revocados_expira_en_idx" RENAME TO "revoked_tokens_expires_at_idx";
ALTER INDEX "tokens_reseteo_token_hash_key" RENAME TO "password_reset_tokens_token_hash_key";
ALTER INDEX "tokens_reseteo_expira_en_idx" RENAME TO "password_reset_tokens_expires_at_idx";

COMMIT;
