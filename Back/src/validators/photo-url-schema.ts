import { z } from "zod";

const PHOTO_URL_MAX_LENGTH = 2048;

const isPrivateIpv4 = (hostname: string): boolean => {
  const parts = hostname.split(".");

  if (parts.length !== 4) {
    return false;
  }

  const octets = parts.map((part) => Number(part));

  if (
    octets.some(
      (octet) => !Number.isInteger(octet) || octet < 0 || octet > 255,
    )
  ) {
    return false;
  }

  const first = octets[0];
  const second = octets[1];

  if (first === undefined || second === undefined) {
    return false;
  }

  return (
    first === 0 ||
    first === 10 ||
    first === 127 ||
    (first === 100 && second >= 64 && second <= 127) ||
    (first === 169 && second === 254) ||
    (first === 172 && second >= 16 && second <= 31) ||
    (first === 192 && second === 168) ||
    (first === 198 && (second === 18 || second === 19)) ||
    first >= 224
  );
};

const isPrivateIpv6 = (hostname: string): boolean => {
  const normalized = hostname.replace(/^\[|\]$/g, "").toLowerCase();

  return (
    normalized === "::" ||
    normalized === "::1" ||
    normalized.startsWith("fc") ||
    normalized.startsWith("fd") ||
    normalized.startsWith("fe80:") ||
    normalized.startsWith("ff")
  );
};

const isIpv6Literal = (hostname: string): boolean => {
  return hostname.startsWith("[") && hostname.endsWith("]");
};

const isPrivateHostname = (hostname: string): boolean => {
  const normalized = hostname.toLowerCase();

  return (
    normalized === "localhost" ||
    normalized.endsWith(".localhost") ||
    normalized.endsWith(".local") ||
    normalized.endsWith(".internal") ||
    isPrivateIpv4(normalized) ||
    (isIpv6Literal(normalized) && isPrivateIpv6(normalized))
  );
};

const parseUrl = (value: string): URL | null => {
  try {
    return new URL(value);
  } catch {
    return null;
  }
};

export const photoUrlSchema = z
  .string({ error: "La URL de la foto debe ser un texto." })
  .trim()
  .max(
    PHOTO_URL_MAX_LENGTH,
    `La URL de la foto no puede tener más de ${PHOTO_URL_MAX_LENGTH} caracteres.`,
  )
  .url("Debes ingresar una URL válida para la foto.")
  .refine((value) => {
    const url = parseUrl(value);
    return url !== null && (url.protocol === "http:" || url.protocol === "https:");
  }, "La URL de la foto debe usar http o https.")
  .refine((value) => {
    const url = parseUrl(value);
    return url !== null && url.username === "" && url.password === "";
  }, "La URL de la foto no puede incluir credenciales.")
  .refine((value) => {
    const url = parseUrl(value);
    return url === null || !isPrivateHostname(url.hostname);
  }, "La URL de la foto no puede apuntar a una dirección privada o local.")
  .nullable()
  .optional();
