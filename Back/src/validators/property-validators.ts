import { z } from "zod";
import {
  createPersonNameSchema,
  emailSchema,
  phoneSchema,
} from "./common-schemas";
import { strictObjectError } from "./password-schema";
import { createPublicUrlSchema } from "./photo-url-schema";
import { createRequiredStringSchema } from "./string-schema";

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

export const createPropertySchema = z.strictObject(
  {
    agentId: agentIdSchema.optional(),
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
