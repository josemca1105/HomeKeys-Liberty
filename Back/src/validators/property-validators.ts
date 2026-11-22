import { z } from "zod";
import type { ListPropertiesQuery } from "../types/property";
import {
  MAX_PHOTO_BYTES,
  MAX_PHOTOS_PER_PROPERTY,
  PHOTO_MIME_TYPES,
} from "../services/object-storage-service";
import {
  createPersonNameSchema,
  emailSchema,
  phoneSchema,
} from "./common-schemas";
import { strictObjectError } from "./password-schema";
import { createPublicUrlSchema } from "./photo-url-schema";
import { createRequiredStringSchema } from "./string-schema";
import { normalizePropertyCode } from "../utils/property-code";

const propertyTypeSchema = z.enum(
  [
    "HOUSE",
    "APARTMENT",
    "TOWNHOUSE",
    "LAND",
    "COMMERCIAL",
    "OFFICE",
    "WAREHOUSE",
    "FARM",
  ],
  { error: "El tipo de inmueble no es válido." },
);

const listingTypeSchema = z.enum(["SALE", "RENT"], {
  error: "La operación debe ser SALE o RENT.",
});

const propertyStatusSchema = z.enum(["ACTIVE", "PAUSED", "CLOSED"], {
  error: "El estado debe ser ACTIVE, PAUSED o CLOSED.",
});

const propertyIdSchema = z.coerce
  .number()
  .int()
  .positive()
  .max(2147483647, "El ID de la captación debe ser un número entero positivo.");

const agentIdSchema = z
  .number({ error: "El ID del agente debe ser un número entero positivo." })
  .int("El ID del agente debe ser un número entero positivo.")
  .positive("El ID del agente debe ser un número entero positivo.")
  .max(2147483647, "El ID del agente debe ser un número entero positivo.");

const createTextSchema = (
  fieldLabel: string,
  maxLength: number,
): z.ZodString => {
  return createRequiredStringSchema(
    `${fieldLabel} es obligatorio.`,
    `${fieldLabel} debe ser un texto.`,
  )
    .trim()
    .min(1, `${fieldLabel} es obligatorio.`)
    .max(maxLength, `${fieldLabel} no puede tener más de ${maxLength} caracteres.`)
    .refine((value) => !/\p{Cc}/u.test(value), {
      message: `${fieldLabel} no puede contener caracteres de control.`,
    });
};

const optionalTextSchema = (
  fieldLabel: string,
  maxLength: number,
): z.ZodOptional<z.ZodNullable<z.ZodString>> => {
  return z
    .string({ error: `${fieldLabel} debe ser un texto.` })
    .trim()
    .max(
      maxLength,
      `${fieldLabel} no puede tener más de ${maxLength} caracteres.`,
    )
    .refine((value) => !/\p{Cc}/u.test(value), {
      message: `${fieldLabel} no puede contener caracteres de control.`,
    })
    .nullable()
    .optional();
};

const createMoneySchema = (fieldLabel: string): z.ZodNumber => {
  return z
    .number({
      error: (issue) =>
        issue.input === undefined
          ? `${fieldLabel} es obligatorio.`
          : `${fieldLabel} debe ser un número.`,
    })
    .finite(`${fieldLabel} debe ser un número finito.`)
    .min(0, `${fieldLabel} no puede ser negativo.`)
    .max(9_999_999_999.99, `${fieldLabel} supera el máximo permitido.`);
};

const createCountSchema = (fieldLabel: string): z.ZodNumber => {
  return z
    .number({
      error: (issue) =>
        issue.input === undefined
          ? `${fieldLabel} es obligatorio.`
          : `${fieldLabel} debe ser un número entero.`,
    })
    .int(`${fieldLabel} debe ser un número entero.`)
    .min(0, `${fieldLabel} no puede ser negativo.`)
    .max(1000, `${fieldLabel} supera el máximo permitido.`);
};

const priceSchema = createMoneySchema("El precio");
const maintenanceFeeSchema = createMoneySchema("El mantenimiento")
  .nullable()
  .optional();

const squareMetersSchema = z
  .number({
    error: (issue) =>
      issue.input === undefined
        ? "El área construida es obligatoria."
        : "El área construida debe ser un número.",
  })
  .finite("El área construida debe ser un número finito.")
  .positive("El área construida debe ser mayor que cero.")
  .max(99_999_999.99, "El área construida supera el máximo permitido.");

const optionalAreaSchema = z
  .number({ error: "El área del terreno debe ser un número." })
  .finite("El área del terreno debe ser un número finito.")
  .positive("El área del terreno debe ser mayor que cero.")
  .max(9_999_999_999.99, "El área del terreno supera el máximo permitido.")
  .optional()
  .nullable();

const latitudeSchema = z
  .number({
    error: (issue) =>
      issue.input === undefined
        ? "La latitud es obligatoria."
        : "La latitud debe ser un número.",
  })
  .finite("La latitud debe ser un número finito.")
  .min(-90, "La latitud debe estar entre -90 y 90.")
  .max(90, "La latitud debe estar entre -90 y 90.");

const longitudeSchema = z
  .number({
    error: (issue) =>
      issue.input === undefined
        ? "La longitud es obligatoria."
        : "La longitud debe ser un número.",
  })
  .finite("La longitud debe ser un número finito.")
  .min(-180, "La longitud debe estar entre -180 y 180.")
  .max(180, "La longitud debe estar entre -180 y 180.");

const yearBuiltSchema = z
  .number({ error: "El año de construcción debe ser un número entero." })
  .int("El año de construcción debe ser un número entero.")
  .min(1800, "El año de construcción no puede ser anterior a 1800.")
  .max(
    new Date().getFullYear(),
    "El año de construcción no puede estar en el futuro.",
  );

const apartmentFloorSchema = z
  .number({ error: "El piso del apartamento debe ser un número entero." })
  .int("El piso del apartamento debe ser un número entero.")
  .min(0, "El piso del apartamento no puede ser negativo.")
  .max(500, "El piso del apartamento supera el máximo permitido.");

const optionalAmenitySchema = z
  .boolean({ error: "La amenidad debe ser verdadero o falso." })
  .optional();

const videoUrlSchema = createPublicUrlSchema("La URL del video", {
  httpsOnly: true,
})
  .nullable()
  .optional();

const virtualTourUrlSchema = createPublicUrlSchema(
  "La URL del tour virtual",
  {
    httpsOnly: true,
  },
)
  .nullable()
  .optional();

export const propertyIdParamsSchema = z.object(
  {
    id: propertyIdSchema,
  },
  { error: "El ID de la captación debe ser un número entero positivo." },
);

export type PropertyIdParams = z.infer<typeof propertyIdParamsSchema>;

const photoIdSchema = z.coerce
  .number()
  .int()
  .positive()
  .max(2147483647, "El ID de la foto debe ser un número entero positivo.");

export const propertyPhotoParamsSchema = z.object(
  {
    id: propertyIdSchema,
    photoId: photoIdSchema,
  },
  { error: "Los IDs de la captación y la foto deben ser enteros positivos." },
);

export type PropertyPhotoParams = z.infer<typeof propertyPhotoParamsSchema>;

const photoBatchIdSchema = z
  .string({ error: "El ID del lote de fotos es obligatorio." })
  .trim()
  .uuid("El ID del lote de fotos no es válido.");

const photoUploadIdSchema = z
  .string({ error: "El ID de la foto es obligatorio." })
  .trim()
  .uuid("El ID de la foto no es válido.");

export const photoBatchParamsSchema = z.object(
  {
    batchId: photoBatchIdSchema,
  },
  { error: "El ID del lote de fotos no es válido." },
);

export const photoBatchUploadParamsSchema = z.object(
  {
    batchId: photoBatchIdSchema,
    uploadId: photoUploadIdSchema,
  },
  { error: "Los IDs del lote y de la foto no son válidos." },
);

export type PhotoBatchParams = z.infer<typeof photoBatchParamsSchema>;
export type PhotoBatchUploadParams = z.infer<
  typeof photoBatchUploadParamsSchema
>;

export const photoUploadTargetSchema = z.strictObject(
  {
    mimeType: z.enum(PHOTO_MIME_TYPES, {
      error: "La foto debe ser JPEG, PNG o WebP.",
    }),
    sizeBytes: z
      .number({
        error: (issue) =>
          issue.input === undefined
            ? "El tamaño de la foto es obligatorio."
            : "El tamaño de la foto debe ser un número entero.",
      })
      .int("El tamaño de la foto debe ser un número entero.")
      .min(1, "La foto no puede estar vacía.")
      .max(
        MAX_PHOTO_BYTES,
        `La foto no puede superar ${MAX_PHOTO_BYTES} bytes.`,
      ),
  },
  { error: strictObjectError },
);

export const confirmPropertyPhotoSchema = z.strictObject(
  {
    storageKey: z
      .string({ error: "La clave de la foto es obligatoria." })
      .trim()
      .min(1, "La clave de la foto es obligatoria.")
      .max(500, "La clave de la foto no puede tener más de 500 caracteres.")
      .regex(
        /^properties\/\d+\/uploads\/[a-f0-9-]+\.(jpg|jpeg|png|webp)$/,
        "La clave de la foto no es válida.",
      ),
    altText: z
      .string({ error: "El texto alternativo debe ser un texto." })
      .trim()
      .min(1, "El texto alternativo no puede estar vacío.")
      .max(300, "El texto alternativo no puede tener más de 300 caracteres.")
      .nullable()
      .optional(),
  },
  { error: strictObjectError },
);

export const confirmPhotoBatchUploadSchema = z.strictObject(
  {
    storageKey: z
      .string({ error: "La clave de la foto es obligatoria." })
      .trim()
      .min(1, "La clave de la foto es obligatoria.")
      .max(500, "La clave de la foto no puede tener más de 500 caracteres.")
      .regex(
        /^property-photo-batches\/[0-9a-f-]{36}\/uploads\/[a-f0-9-]+\.(jpg|jpeg|png|webp)$/,
        "La clave de la foto no es válida.",
      ),
    altText: z
      .string({ error: "El texto alternativo debe ser un texto." })
      .trim()
      .min(1, "El texto alternativo no puede estar vacío.")
      .max(300, "El texto alternativo no puede tener más de 300 caracteres.")
      .nullable()
      .optional(),
  },
  { error: strictObjectError },
);

export const reorderPropertyPhotosSchema = z.strictObject(
  {
    photoIds: z
      .array(
        z
          .number({ error: "Cada ID de foto debe ser un número entero." })
          .int("Cada ID de foto debe ser un número entero.")
          .positive("Cada ID de foto debe ser un número entero positivo.")
          .max(2147483647, "Cada ID de foto debe ser un entero positivo."),
        { error: "Debes enviar el orden completo de las fotos." },
      )
      .min(1, "Debes enviar al menos una foto.")
      .max(
        MAX_PHOTOS_PER_PROPERTY,
        `No puedes ordenar más de ${MAX_PHOTOS_PER_PROPERTY} fotos.`,
      )
      .refine((ids) => new Set(ids).size === ids.length, {
        message: "No puedes repetir una foto en el orden.",
      }),
  },
  { error: strictObjectError },
);

const queryTextSchema = (fieldLabel: string, maxLength = 100) =>
  z
    .string({ error: `${fieldLabel} debe ser un texto.` })
    .trim()
    .min(1, `${fieldLabel} no puede estar vacío.`)
    .max(
      maxLength,
      `${fieldLabel} no puede tener más de ${maxLength} caracteres.`,
    )
    .optional();

const queryCountSchema = (fieldLabel: string) =>
  z.coerce
    .number({ error: `${fieldLabel} debe ser un número entero.` })
    .int(`${fieldLabel} debe ser un número entero.`)
    .min(0, `${fieldLabel} no puede ser negativo.`)
    .max(1000, `${fieldLabel} supera el máximo permitido.`)
    .optional();

const queryPriceSchema = (fieldLabel: string) =>
  z.coerce
    .number({ error: `${fieldLabel} debe ser un número.` })
    .finite(`${fieldLabel} debe ser un número finito.`)
    .min(0, `${fieldLabel} no puede ser negativo.`)
    .max(9_999_999_999.99, `${fieldLabel} supera el máximo permitido.`)
    .optional();

export const listPropertiesQuerySchema: z.ZodType<ListPropertiesQuery> =
  z
    .strictObject(
      {
        page: z.coerce
          .number({
            error: "La página debe ser un número entero mayor o igual a 1.",
          })
          .int("La página debe ser un número entero mayor o igual a 1.")
          .min(1, "La página debe ser un número entero mayor o igual a 1.")
          .default(1),
        pageSize: z.coerce
          .number({
            error:
              "El tamaño de página debe ser un número entero entre 1 y 100.",
          })
          .int("El tamaño de página debe ser un número entero entre 1 y 100.")
          .min(1, "El tamaño de página debe ser un número entero entre 1 y 100.")
          .max(
            100,
            "El tamaño de página debe ser un número entero entre 1 y 100.",
          )
          .default(20),
        search: queryTextSchema("La búsqueda"),
        code: z
          .string({ error: "El código debe ser un texto." })
          .trim()
          .min(1, "El código no puede estar vacío.")
          .max(22, "El código no puede tener más de 22 caracteres.")
          .transform((value, context) => {
            const code = normalizePropertyCode(value);

            if (code === null) {
              context.addIssue({
                code: "custom",
                message:
                  "El código debe ser un número de captación, por ejemplo 0001 o HK-0001.",
              });
              return z.NEVER;
            }

            return code;
          })
          .optional(),
        status: propertyStatusSchema.optional(),
        propertyType: propertyTypeSchema.optional(),
        listingType: listingTypeSchema.optional(),
        state: queryTextSchema("El estado"),
        city: queryTextSchema("La ciudad"),
        neighborhood: queryTextSchema("El sector"),
        priceMin: queryPriceSchema("El precio mínimo"),
        priceMax: queryPriceSchema("El precio máximo"),
        bedroomsMin: queryCountSchema("La cantidad mínima de habitaciones"),
        bathroomsMin: queryCountSchema("La cantidad mínima de baños"),
        parkingSpacesMin: queryCountSchema(
          "La cantidad mínima de estacionamientos",
        ),
        agentId: z.coerce
          .number({
            error: "El ID del agente debe ser un número entero positivo.",
          })
          .int("El ID del agente debe ser un número entero positivo.")
          .positive("El ID del agente debe ser un número entero positivo.")
          .optional(),
        sortBy: z
          .enum(["createdAt", "updatedAt", "price", "title"], {
            error: "El campo de ordenamiento no es válido.",
          })
          .default("createdAt"),
        sortOrder: z
          .enum(["asc", "desc"], {
            error: "El orden debe ser asc o desc.",
          })
          .default("desc"),
      },
      { error: strictObjectError },
    )
    .refine(
      (query) =>
        query.priceMin === undefined ||
        query.priceMax === undefined ||
        query.priceMin <= query.priceMax,
      {
        message: "El precio mínimo no puede superar al precio máximo.",
        path: ["priceMax"],
      },
    );

export const createPropertySchema = z.strictObject(
  {
    agentId: agentIdSchema.optional(),
    photoBatchId: photoBatchIdSchema,
    coverUploadId: photoUploadIdSchema.optional(),
    title: createTextSchema("El título", 200),
    propertyType: propertyTypeSchema,
    listingType: listingTypeSchema,
    description: optionalTextSchema("La descripción", 2000),
    ownerName: createPersonNameSchema("nombre del propietario", 150),
    ownerPhone: phoneSchema,
    ownerEmail: emailSchema.nullable().optional(),
    address: createTextSchema("La dirección", 500),
    neighborhood: optionalTextSchema("El sector", 100),
    city: createTextSchema("La ciudad", 100),
    state: createTextSchema("El estado", 100),
    latitude: latitudeSchema,
    longitude: longitudeSchema,
    price: priceSchema,
    maintenanceFee: maintenanceFeeSchema,
    isNegotiable: z.boolean().optional(),
    bedrooms: createCountSchema("La cantidad de habitaciones"),
    bathrooms: createCountSchema("La cantidad de baños"),
    parkingSpaces: createCountSchema("La cantidad de puestos de estacionamiento"),
    squareMeters: squareMetersSchema,
    lotSquareMeters: optionalAreaSchema,
    yearBuilt: yearBuiltSchema.nullable().optional(),
    apartmentFloor: apartmentFloorSchema.nullable().optional(),
    hasWaterTank: optionalAmenitySchema,
    hasPowerPlant: optionalAmenitySchema,
    isFurnished: optionalAmenitySchema,
    allowsPets: optionalAmenitySchema,
    hasPool: optionalAmenitySchema,
    hasGym: optionalAmenitySchema,
    hasBalcony: optionalAmenitySchema,
    hasAirConditioning: optionalAmenitySchema,
    hasSecurity: optionalAmenitySchema,
    hasElevator: optionalAmenitySchema,
    videoUrl: videoUrlSchema,
    virtualTourUrl: virtualTourUrlSchema,
  },
  { error: strictObjectError },
);

export const updatePropertySchema = z
  .strictObject(
    {
      agentId: agentIdSchema.optional(),
      title: createTextSchema("El título", 200).optional(),
      propertyType: propertyTypeSchema.optional(),
      listingType: listingTypeSchema.optional(),
      status: propertyStatusSchema.optional(),
      description: optionalTextSchema("La descripción", 2000),
      ownerName: createPersonNameSchema("nombre del propietario", 150).optional(),
      ownerPhone: phoneSchema.optional(),
      ownerEmail: emailSchema.nullable().optional(),
      address: createTextSchema("La dirección", 500).optional(),
      neighborhood: optionalTextSchema("El sector", 100),
      city: createTextSchema("La ciudad", 100).optional(),
      state: createTextSchema("El estado", 100).optional(),
      latitude: latitudeSchema.optional(),
      longitude: longitudeSchema.optional(),
      price: priceSchema.optional(),
      maintenanceFee: maintenanceFeeSchema.optional(),
      isNegotiable: z.boolean().optional(),
      bedrooms: createCountSchema("La cantidad de habitaciones").optional(),
      bathrooms: createCountSchema("La cantidad de baños").optional(),
      parkingSpaces: createCountSchema(
        "La cantidad de puestos de estacionamiento",
      ).optional(),
      squareMeters: squareMetersSchema.optional(),
      lotSquareMeters: optionalAreaSchema,
      yearBuilt: yearBuiltSchema.nullable().optional(),
      apartmentFloor: apartmentFloorSchema.nullable().optional(),
      hasWaterTank: optionalAmenitySchema,
      hasPowerPlant: optionalAmenitySchema,
      isFurnished: optionalAmenitySchema,
      allowsPets: optionalAmenitySchema,
      hasPool: optionalAmenitySchema,
      hasGym: optionalAmenitySchema,
      hasBalcony: optionalAmenitySchema,
      hasAirConditioning: optionalAmenitySchema,
      hasSecurity: optionalAmenitySchema,
      hasElevator: optionalAmenitySchema,
      videoUrl: videoUrlSchema,
      virtualTourUrl: virtualTourUrlSchema,
    },
    { error: strictObjectError },
  )
  .refine((body) => Object.keys(body).length > 0, {
    message: "Debes enviar al menos un campo para actualizar.",
  })
  .refine(
    (body) =>
      (body.latitude === undefined) === (body.longitude === undefined),
    {
      message: "La latitud y la longitud deben actualizarse juntas.",
      path: ["longitude"],
    },
  );
