import express, { Router } from "express";
import { receiveLocalPhotoUpload } from "../controllers/property-photo-controller";
import { MAX_PHOTO_BYTES } from "../services/object-storage-service";

export const propertyPhotoUploadRoutes = Router();

// Local development replaces the R2 pre-signed URL with an HMAC-signed URL.
// The signature authorizes one upload until it expires; no session header is
// needed because the browser uploads directly to this endpoint.
propertyPhotoUploadRoutes.put(
  "/local-upload",
  express.raw({
    type: () => true,
    limit: MAX_PHOTO_BYTES,
  }),
  receiveLocalPhotoUpload,
);
