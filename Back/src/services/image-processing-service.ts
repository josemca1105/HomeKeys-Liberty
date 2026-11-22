import sharp from "sharp";
import { AppError } from "../utils/app-error";

const MAX_IMAGE_DIMENSION = 2560;
const MAX_INPUT_PIXELS = 100_000_000;
const SUPPORTED_INPUT_FORMATS = new Set(["jpeg", "png", "webp"]);

export interface ProcessedImage {
  body: Buffer;
  width: number;
  height: number;
  mimeType: "image/webp";
}

const invalidImageError = (): AppError =>
  new AppError({
    statusCode: 422,
    code: "INVALID_PHOTO_IMAGE",
    message: "El archivo no es una imagen válida o no pudo procesarse.",
  });

// Sharp decodes the actual file instead of trusting its extension or declared
// MIME type. The output strips EXIF/GPS metadata and always uses WebP.
export const processPropertyImage = async (
  input: Buffer,
): Promise<ProcessedImage> => {
  try {
    const source = sharp(input, {
      failOn: "error",
      limitInputPixels: MAX_INPUT_PIXELS,
    });
    const metadata = await source.metadata();

    if (
      metadata.format === undefined ||
      !SUPPORTED_INPUT_FORMATS.has(metadata.format)
    ) {
      throw invalidImageError();
    }

    const output = await sharp(input, {
      failOn: "error",
      limitInputPixels: MAX_INPUT_PIXELS,
    })
      .rotate()
      .resize({
        width: MAX_IMAGE_DIMENSION,
        height: MAX_IMAGE_DIMENSION,
        fit: "inside",
        withoutEnlargement: true,
      })
      .webp({ quality: 82 })
      .toBuffer({ resolveWithObject: true });

    if (output.info.width <= 0 || output.info.height <= 0) {
      throw invalidImageError();
    }

    return {
      body: output.data,
      width: output.info.width,
      height: output.info.height,
      mimeType: "image/webp",
    };
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }

    throw invalidImageError();
  }
};
