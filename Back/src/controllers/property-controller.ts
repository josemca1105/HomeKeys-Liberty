import {
  createProperty,
  deleteProperty,
  getProperty,
  listProperties,
  updateProperty,
} from "../services/property-service";
import type {
  CreatePropertyInput,
  ListPropertiesQuery,
  UpdatePropertyInput,
} from "../types/property";
import type { PropertyIdParams } from "../validators/property-validators";
import { getAuditActor, getAuditRequestContext } from "../utils/audit-context";
import { asyncHandler } from "../utils/async-handler";
import { requireSession } from "../utils/require-session";

export const addProperty = asyncHandler(async (req, res): Promise<void> => {
  const session = requireSession(req);
  const input = req.body as CreatePropertyInput;
  const property = await createProperty(input, session, {
    actor: getAuditActor(session),
    request: getAuditRequestContext(req),
  });

  res.status(201).json({
    success: true,
    message: "Captación registrada exitosamente.",
    data: { property },
  });
});

export const getProperties = asyncHandler(
  async (req, res): Promise<void> => {
    const session = requireSession(req);
    const query = req.validatedQuery as ListPropertiesQuery;
    const { properties, pagination } = await listProperties(query, session);

    res.status(200).json({
      success: true,
      message: "Captaciones obtenidas exitosamente.",
      data: { properties, pagination },
    });
  },
);

export const getPropertyById = asyncHandler(
  async (req, res): Promise<void> => {
    const session = requireSession(req);
    const propertyId = (req.validatedParams as PropertyIdParams).id;
    const property = await getProperty(propertyId, session);

    res.status(200).json({
      success: true,
      message: "Captación obtenida exitosamente.",
      data: { property },
    });
  },
);

export const updatePropertyById = asyncHandler(
  async (req, res): Promise<void> => {
    const session = requireSession(req);
    const propertyId = (req.validatedParams as PropertyIdParams).id;
    const input = req.body as UpdatePropertyInput;
    const property = await updateProperty(propertyId, input, session, {
      actor: getAuditActor(session),
      request: getAuditRequestContext(req),
    });

    res.status(200).json({
      success: true,
      message: "Captación actualizada exitosamente.",
      data: { property },
    });
  },
);

export const removeProperty = asyncHandler(
  async (req, res): Promise<void> => {
    const session = requireSession(req);
    const propertyId = (req.validatedParams as PropertyIdParams).id;
    const deletedId = await deleteProperty(propertyId, session, {
      actor: getAuditActor(session),
      request: getAuditRequestContext(req),
    });

    res.status(200).json({
      success: true,
      message: "Captación eliminada exitosamente.",
      data: { deletedId },
    });
  },
);
