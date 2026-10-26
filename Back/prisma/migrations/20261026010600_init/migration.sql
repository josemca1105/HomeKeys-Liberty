-- CreateEnum
CREATE TYPE "Rango" AS ENUM ('ADMIN', 'SOCIO');

-- CreateEnum
CREATE TYPE "Categoria" AS ENUM ('Casa', 'Apartamento', 'Local');

-- CreateEnum
CREATE TYPE "TipoInmueble" AS ENUM ('Venta', 'Alquiler');

-- CreateEnum
CREATE TYPE "EstatusInmueble" AS ENUM ('Activo', 'Inactivo');

-- CreateTable
CREATE TABLE "usuarios" (
    "id" SERIAL NOT NULL,
    "nombre" VARCHAR(100) NOT NULL,
    "apellido" VARCHAR(100) NOT NULL,
    "correo" VARCHAR(255) NOT NULL,
    "clave" TEXT NOT NULL,
    "telefono" VARCHAR(20) NOT NULL,
    "foto_url" TEXT,
    "rango" "Rango" NOT NULL DEFAULT 'SOCIO',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "usuarios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inmuebles" (
    "id" SERIAL NOT NULL,
    "asesor_id" INTEGER NOT NULL,
    "codigo" VARCHAR(50) NOT NULL,
    "categoria" "Categoria" NOT NULL,
    "ciudad" VARCHAR(100) NOT NULL,
    "estado" VARCHAR(100) NOT NULL,
    "direccion" TEXT NOT NULL,
    "precio" DECIMAL(12,2) NOT NULL,
    "descripcion" TEXT,
    "banos" INTEGER NOT NULL,
    "cuartos" INTEGER NOT NULL,
    "estacionamientos" INTEGER NOT NULL,
    "tipo" "TipoInmueble" NOT NULL,
    "metraje" DECIMAL(10,2) NOT NULL,
    "estatus" "EstatusInmueble" NOT NULL DEFAULT 'Activo',
    "piso_apto" INTEGER,
    "tiene_ascensor" BOOLEAN,
    "tiene_planta" BOOLEAN,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "inmuebles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fotos" (
    "id" SERIAL NOT NULL,
    "inmueble_id" INTEGER NOT NULL,
    "url_imagen" TEXT NOT NULL,
    "es_portada" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "fotos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tokens_revocados" (
    "id" SERIAL NOT NULL,
    "token_hash" VARCHAR(64) NOT NULL,
    "usuario_id" INTEGER NOT NULL,
    "expira_en" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tokens_revocados_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tokens_reseteo" (
    "id" SERIAL NOT NULL,
    "token_hash" VARCHAR(64) NOT NULL,
    "usuario_id" INTEGER NOT NULL,
    "expira_en" TIMESTAMP(3) NOT NULL,
    "usado" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tokens_reseteo_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "usuarios_correo_key" ON "usuarios"("correo");

-- CreateIndex
CREATE UNIQUE INDEX "inmuebles_codigo_key" ON "inmuebles"("codigo");

-- CreateIndex
CREATE UNIQUE INDEX "tokens_revocados_token_hash_key" ON "tokens_revocados"("token_hash");

-- CreateIndex
CREATE INDEX "tokens_revocados_expira_en_idx" ON "tokens_revocados"("expira_en");

-- CreateIndex
CREATE UNIQUE INDEX "tokens_reseteo_token_hash_key" ON "tokens_reseteo"("token_hash");

-- CreateIndex
CREATE INDEX "tokens_reseteo_expira_en_idx" ON "tokens_reseteo"("expira_en");

-- AddForeignKey
ALTER TABLE "inmuebles" ADD CONSTRAINT "inmuebles_asesor_id_fkey" FOREIGN KEY ("asesor_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fotos" ADD CONSTRAINT "fotos_inmueble_id_fkey" FOREIGN KEY ("inmueble_id") REFERENCES "inmuebles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
