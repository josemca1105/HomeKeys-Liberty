import {
  createHmac,
  timingSafeEqual,
} from "node:crypto";
import { mkdir, readFile, stat, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { environment } from "../config/env";
import { AppError } from "../utils/app-error";

export const MAX_PHOTO_BYTES = 8 * 1024 * 1024;
export const MIN_PHOTOS_PER_PROPERTY = 5;
export const MAX_PHOTOS_PER_PROPERTY = 20;
export const PHOTO_UPLOAD_TTL_SECONDS = 10 * 60;
export const PHOTO_BATCH_TTL_MINUTES = 120;

export const PHOTO_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;

export type PhotoMimeType = (typeof PHOTO_MIME_TYPES)[number];

const MIME_EXTENSIONS: Record<PhotoMimeType, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

const EXTENSION_MIME_TYPES: Record<string, PhotoMimeType> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
};

export interface UploadTargetInput {
  key: string;
  mimeType: PhotoMimeType;
  sizeBytes: number;
  userId: number;
  propertyId: number;
}

export interface UploadTarget {
  key: string;
  url: string;
  method: "PUT";
  headers: Record<string, string>;
  expiresAt: Date;
}

export interface StoredObjectMetadata {
  key: string;
  mimeType: PhotoMimeType;
  sizeBytes: number;
}

export interface DownloadedObject extends StoredObjectMetadata {
  body: Buffer;
}

export interface ObjectStorage {
  createUploadTarget(input: UploadTargetInput): Promise<UploadTarget>;
  headObject(key: string): Promise<StoredObjectMetadata | null>;
  downloadObject(key: string): Promise<DownloadedObject>;
  putObject(
    key: string,
    body: Buffer,
    mimeType: PhotoMimeType,
  ): Promise<void>;
  deleteObject(key: string): Promise<void>;
}

const storageError = (): AppError =>
  new AppError({
    statusCode: 502,
    code: "PHOTO_STORAGE_UNAVAILABLE",
    message: "El almacenamiento de fotografías no está disponible.",
  });

export const photoExtension = (mimeType: PhotoMimeType): string => {
  return MIME_EXTENSIONS[mimeType];
};

const mimeTypeFromKey = (key: string): PhotoMimeType | null => {
  const extension = path.extname(key).slice(1).toLowerCase();
  return EXTENSION_MIME_TYPES[extension] ?? null;
};

const assertSafeStorageKey = (key: string): void => {
  if (
    !/^(?:properties\/\d+|property-photo-batches\/[0-9a-f-]{36})\/(?:uploads|photos)\/[a-zA-Z0-9/_-]+\.(jpg|jpeg|png|webp)$/.test(
      key,
    )
  ) {
    throw new AppError({
      statusCode: 400,
      code: "INVALID_PHOTO_STORAGE_KEY",
      message: "La clave de almacenamiento de la foto no es válida.",
    });
  }
};

const localUploadPayloadSchema = (() => {
  interface Payload {
    key: string;
    mimeType: PhotoMimeType;
    sizeBytes: number;
    userId: number;
    propertyId: number;
    expiresAt: number;
  }

  return {
    parse(value: unknown): Payload | null {
      if (typeof value !== "object" || value === null) {
        return null;
      }

      const payload = value as Record<string, unknown>;

      if (
        typeof payload.key !== "string" ||
        typeof payload.mimeType !== "string" ||
        !PHOTO_MIME_TYPES.includes(payload.mimeType as PhotoMimeType) ||
        typeof payload.sizeBytes !== "number" ||
        !Number.isInteger(payload.sizeBytes) ||
        payload.sizeBytes <= 0 ||
        typeof payload.userId !== "number" ||
        typeof payload.propertyId !== "number" ||
        typeof payload.expiresAt !== "number"
      ) {
        return null;
      }

      return payload as unknown as Payload;
    },
  };
})();

const signLocalUploadPayload = (payload: object): string => {
  const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = createHmac("sha256", environment.JWT_SECRET)
    .update(encoded)
    .digest("base64url");

  return `${encoded}.${signature}`;
};

const verifyLocalUploadToken = (
  token: string,
): ReturnType<typeof localUploadPayloadSchema.parse> => {
  const [encoded, signature] = token.split(".");

  if (!encoded || !signature) {
    return null;
  }

  const expected = createHmac("sha256", environment.JWT_SECRET)
    .update(encoded)
    .digest("base64url");
  const actualBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);

  if (
    actualBuffer.length !== expectedBuffer.length ||
    !timingSafeEqual(actualBuffer, expectedBuffer)
  ) {
    return null;
  }

  try {
    const payload = JSON.parse(
      Buffer.from(encoded, "base64url").toString("utf8"),
    ) as unknown;
    return localUploadPayloadSchema.parse(payload);
  } catch {
    return null;
  }
};

export class LocalObjectStorage implements ObjectStorage {
  private readonly rootDirectory: string;

  constructor(
    rootDirectory = path.resolve(
      process.cwd(),
      environment.LOCAL_STORAGE_DIR,
    ),
  ) {
    this.rootDirectory = path.resolve(rootDirectory);
  }

  private resolvePath(key: string): string {
    assertSafeStorageKey(key);
    const resolved = path.resolve(this.rootDirectory, key);

    if (!resolved.startsWith(`${this.rootDirectory}${path.sep}`)) {
      throw new AppError({
        statusCode: 400,
        code: "INVALID_PHOTO_STORAGE_KEY",
        message: "La clave de almacenamiento de la foto no es válida.",
      });
    }

    return resolved;
  }

  async createUploadTarget(input: UploadTargetInput): Promise<UploadTarget> {
    const expiresAt = new Date(
      Date.now() + PHOTO_UPLOAD_TTL_SECONDS * 1000,
    );
    const token = signLocalUploadPayload({
      key: input.key,
      mimeType: input.mimeType,
      sizeBytes: input.sizeBytes,
      userId: input.userId,
      propertyId: input.propertyId,
      expiresAt: expiresAt.getTime(),
    });

    return {
      key: input.key,
      url: "/api/v1/property-photos/local-upload",
      method: "PUT",
      headers: {
        "Content-Type": input.mimeType,
        "X-Photo-Upload-Token": token,
      },
      expiresAt,
    };
  }

  async receiveUpload(
    token: string,
    body: Buffer,
    contentType: string | undefined,
  ): Promise<void> {
    const payload = verifyLocalUploadToken(token);

    if (!payload || payload.expiresAt < Date.now()) {
      throw new AppError({
        statusCode: 401,
        code: "PHOTO_UPLOAD_TOKEN_INVALID",
        message: "El enlace de subida no es válido o ya expiró.",
      });
    }

    if (contentType !== payload.mimeType) {
      throw new AppError({
        statusCode: 400,
        code: "PHOTO_UPLOAD_TYPE_MISMATCH",
        message: "El tipo de archivo no coincide con el enlace de subida.",
      });
    }

    if (body.byteLength !== payload.sizeBytes) {
      throw new AppError({
        statusCode: 400,
        code: "PHOTO_UPLOAD_SIZE_MISMATCH",
        message: "El tamaño del archivo no coincide con el enlace de subida.",
      });
    }

    const targetPath = this.resolvePath(payload.key);
    await mkdir(path.dirname(targetPath), { recursive: true });
    await writeFile(targetPath, body);
  }

  async headObject(key: string): Promise<StoredObjectMetadata | null> {
    const mimeType = mimeTypeFromKey(key);

    if (!mimeType) {
      return null;
    }

    try {
      const file = await stat(this.resolvePath(key));
      return { key, mimeType, sizeBytes: file.size };
    } catch (error) {
      if (
        typeof error === "object" &&
        error !== null &&
        "code" in error &&
        error.code === "ENOENT"
      ) {
        return null;
      }

      throw storageError();
    }
  }

  async downloadObject(key: string): Promise<DownloadedObject> {
    const metadata = await this.headObject(key);

    if (!metadata) {
      throw new AppError({
        statusCode: 404,
        code: "PHOTO_OBJECT_NOT_FOUND",
        message: "La fotografía no existe en el almacenamiento.",
      });
    }

    try {
      return { ...metadata, body: await readFile(this.resolvePath(key)) };
    } catch {
      throw storageError();
    }
  }

  async putObject(
    key: string,
    body: Buffer,
    _mimeType: PhotoMimeType,
  ): Promise<void> {
    const targetPath = this.resolvePath(key);
    await mkdir(path.dirname(targetPath), { recursive: true });
    await writeFile(targetPath, body);
  }

  async deleteObject(key: string): Promise<void> {
    try {
      await unlink(this.resolvePath(key));
    } catch (error) {
      if (
        typeof error === "object" &&
        error !== null &&
        "code" in error &&
        error.code !== "ENOENT"
      ) {
        console.error("Failed to delete local photo object.", error);
      }
    }
  }
}

export class R2ObjectStorage implements ObjectStorage {
  private client: S3Client | null = null;

  private getClient(): S3Client {
    if (!this.client) {
      this.client = new S3Client({
        region: environment.S3_REGION,
        endpoint: environment.S3_ENDPOINT,
        forcePathStyle: true,
        credentials: {
          accessKeyId: environment.S3_ACCESS_KEY_ID,
          secretAccessKey: environment.S3_SECRET_ACCESS_KEY,
        },
      });
    }

    return this.client;
  }

  async createUploadTarget(input: UploadTargetInput): Promise<UploadTarget> {
    try {
      const url = await getSignedUrl(
        this.getClient(),
        new PutObjectCommand({
          Bucket: environment.S3_BUCKET,
          Key: input.key,
          ContentType: input.mimeType,
          ContentLength: input.sizeBytes,
        }),
        { expiresIn: PHOTO_UPLOAD_TTL_SECONDS },
      );

      return {
        key: input.key,
        url,
        method: "PUT",
        headers: {
          "Content-Type": input.mimeType,
        },
        expiresAt: new Date(Date.now() + PHOTO_UPLOAD_TTL_SECONDS * 1000),
      };
    } catch (error) {
      console.error("Failed to create R2 upload target.", error);
      throw storageError();
    }
  }

  async headObject(key: string): Promise<StoredObjectMetadata | null> {
    try {
      const result = await this.getClient().send(
        new HeadObjectCommand({
          Bucket: environment.S3_BUCKET,
          Key: key,
        }),
      );

      const mimeType = mimeTypeFromKey(key);
      return {
        key,
        mimeType: mimeType ?? (result.ContentType as PhotoMimeType),
        sizeBytes: result.ContentLength ?? 0,
      };
    } catch (error) {
      if (
        typeof error === "object" &&
        error !== null &&
        "$metadata" in error &&
        (error as { $metadata?: { httpStatusCode?: number } }).$metadata
          ?.httpStatusCode === 404
      ) {
        return null;
      }

      throw storageError();
    }
  }

  async downloadObject(key: string): Promise<DownloadedObject> {
    try {
      const result = await this.getClient().send(
        new GetObjectCommand({
          Bucket: environment.S3_BUCKET,
          Key: key,
        }),
      );

      if (!result.Body) {
        throw new Error("R2 object body is empty.");
      }

      const mimeType = mimeTypeFromKey(key);

      if (!mimeType) {
        throw storageError();
      }

      const body = Buffer.from(await result.Body.transformToByteArray());
      return {
        key,
        mimeType,
        sizeBytes: body.byteLength,
        body,
      };
    } catch {
      throw storageError();
    }
  }

  async putObject(
    key: string,
    body: Buffer,
    mimeType: PhotoMimeType,
  ): Promise<void> {
    try {
      await this.getClient().send(
        new PutObjectCommand({
          Bucket: environment.S3_BUCKET,
          Key: key,
          Body: body,
          ContentType: mimeType,
        }),
      );
    } catch {
      throw storageError();
    }
  }

  async deleteObject(key: string): Promise<void> {
    try {
      await this.getClient().send(
        new DeleteObjectCommand({
          Bucket: environment.S3_BUCKET,
          Key: key,
        }),
      );
    } catch (error) {
      console.error("Failed to delete R2 photo object.", error);
    }
  }
}

export class InMemoryObjectStorage implements ObjectStorage {
  private readonly objects = new Map<
    string,
    { body: Buffer; mimeType: PhotoMimeType }
  >();

  async createUploadTarget(input: UploadTargetInput): Promise<UploadTarget> {
    return {
      key: input.key,
      url: `https://uploads.test/${input.key}`,
      method: "PUT",
      headers: { "Content-Type": input.mimeType },
      expiresAt: new Date(Date.now() + PHOTO_UPLOAD_TTL_SECONDS * 1000),
    };
  }

  async headObject(key: string): Promise<StoredObjectMetadata | null> {
    const object = this.objects.get(key);

    return object
      ? { key, mimeType: object.mimeType, sizeBytes: object.body.byteLength }
      : null;
  }

  async downloadObject(key: string): Promise<DownloadedObject> {
    const object = this.objects.get(key);

    if (!object) {
      throw storageError();
    }

    return {
      key,
      mimeType: object.mimeType,
      sizeBytes: object.body.byteLength,
      body: Buffer.from(object.body),
    };
  }

  async putObject(
    key: string,
    body: Buffer,
    mimeType: PhotoMimeType,
  ): Promise<void> {
    this.objects.set(key, { body: Buffer.from(body), mimeType });
  }

  async deleteObject(key: string): Promise<void> {
    this.objects.delete(key);
  }

  reset(): void {
    this.objects.clear();
  }
}

let storageOverride: ObjectStorage | null = null;
let defaultStorage: ObjectStorage | null = null;

export const setObjectStorageForTesting = (
  storage: ObjectStorage | null,
): void => {
  storageOverride = storage;
};

export const getObjectStorage = (): ObjectStorage => {
  if (storageOverride) {
    return storageOverride;
  }

  if (!defaultStorage) {
    defaultStorage =
      environment.STORAGE_DRIVER === "r2"
        ? new R2ObjectStorage()
        : new LocalObjectStorage();
  }

  return defaultStorage;
};

export const storeLocalUpload = async (
  token: string,
  body: Buffer,
  contentType: string | undefined,
): Promise<void> => {
  const storage = getObjectStorage();

  if (!(storage instanceof LocalObjectStorage)) {
    throw new AppError({
      statusCode: 404,
      code: "LOCAL_UPLOAD_NOT_AVAILABLE",
      message: "La subida local no está habilitada.",
    });
  }

  await storage.receiveUpload(token, body, contentType);
};
