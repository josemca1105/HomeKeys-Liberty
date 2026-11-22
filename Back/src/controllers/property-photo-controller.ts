import {
  confirmPropertyPhoto,
  createPhotoUploadTarget,
  deletePropertyPhoto,
  getPropertyPhotoContent,
  reorderPropertyPhotos,
  setPropertyPhotoCover,
} from "../services/property-photo-service";
import { storeLocalUpload } from "../services/object-storage-service";
import type {
  ConfirmPropertyPhotoInput,
  CreatePhotoUploadTargetInput,
  ReorderPropertyPhotosInput,
} from "../types/property";
import type {
  PropertyIdParams,
  PropertyPhotoParams,
} from "../validators/property-validators";
import { getAuditActor, getAuditRequestContext } from "../utils/audit-context";
import { asyncHandler } from "../utils/async-handler";
import { requireSession } from "../utils/require-session";

export const createUploadUrl = asyncHandler(
  async (req, res): Promise<void> => {
    const session = requireSession(req);
    const propertyId = (req.validatedParams as PropertyIdParams).id;
    const input = req.body as CreatePhotoUploadTargetInput;
    const upload = await createPhotoUploadTarget(propertyId, input, session);

    res.status(200).json({
      success: true,
      message: "Enlace de subida creado exitosamente.",
      data: {
        upload: {
          url: upload.url,
          method: upload.method,
          headers: upload.headers,
          expiresAt: upload.expiresAt,
          storageKey: upload.key,
        },
      },
    });
  },
);

export const confirmUpload = asyncHandler(
  async (req, res): Promise<void> => {
    const session = requireSession(req);
    const propertyId = (req.validatedParams as PropertyIdParams).id;
    const input = req.body as ConfirmPropertyPhotoInput;
    const photo = await confirmPropertyPhoto(propertyId, input, session, {
      actor: getAuditActor(session),
      request: getAuditRequestContext(req),
    });

    res.status(201).json({
      success: true,
      message: "Fotografía agregada exitosamente.",
      data: { photo },
    });
  },
);

export const reorderPhotos = asyncHandler(
  async (req, res): Promise<void> => {
    const session = requireSession(req);
    const propertyId = (req.validatedParams as PropertyIdParams).id;
    const input = req.body as ReorderPropertyPhotosInput;
    const photos = await reorderPropertyPhotos(propertyId, input, session, {
      actor: getAuditActor(session),
      request: getAuditRequestContext(req),
    });

    res.status(200).json({
      success: true,
      message: "Fotografías reordenadas exitosamente.",
      data: { photos },
    });
  },
);

export const chooseCoverPhoto = asyncHandler(
  async (req, res): Promise<void> => {
    const session = requireSession(req);
    const params = req.validatedParams as PropertyPhotoParams;
    const photo = await setPropertyPhotoCover(
      params.id,
      params.photoId,
      session,
      {
        actor: getAuditActor(session),
        request: getAuditRequestContext(req),
      },
    );

    res.status(200).json({
      success: true,
      message: "Portada actualizada exitosamente.",
      data: { photo },
    });
  },
);

export const removePhoto = asyncHandler(
  async (req, res): Promise<void> => {
    const session = requireSession(req);
    const params = req.validatedParams as PropertyPhotoParams;
    const deletedId = await deletePropertyPhoto(
      params.id,
      params.photoId,
      session,
      {
        actor: getAuditActor(session),
        request: getAuditRequestContext(req),
      },
    );

    res.status(200).json({
      success: true,
      message: "Fotografía eliminada exitosamente.",
      data: { deletedId },
    });
  },
);

export const getPhotoContent = asyncHandler(
  async (req, res): Promise<void> => {
    const session = requireSession(req);
    const params = req.validatedParams as PropertyPhotoParams;
    const content = await getPropertyPhotoContent(
      params.id,
      params.photoId,
      session,
    );

    res.setHeader("Content-Type", content.mimeType);
    res.setHeader("Content-Length", content.sizeBytes.toString());
    res.setHeader("Content-Disposition", "inline");
    res.status(200).send(content.body);
  },
);

export const receiveLocalPhotoUpload = asyncHandler(
  async (req, res): Promise<void> => {
    const token = req.get("x-photo-upload-token");

    if (!token || token.length > 4096) {
      res.status(401).json({
        success: false,
        code: "PHOTO_UPLOAD_TOKEN_INVALID",
        message: "El enlace de subida no es válido o ya expiró.",
      });
      return;
    }

    const body = Buffer.isBuffer(req.body) ? req.body : Buffer.alloc(0);
    const contentType = req.get("content-type")?.split(";")[0]?.trim();

    await storeLocalUpload(token, body, contentType);
    res.status(204).send();
  },
);
