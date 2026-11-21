import { z } from "zod";

const PUBLIC_URL_MAX_LENGTH = 2048;

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

export interface PublicUrlSchemaOptions {
  maxLength?: number;
  httpsOnly?: boolean;
}

// Shared validation for externally hosted media links. The backend never
// downloads these URLs; the rules prevent unsafe schemes, credentials and
// private hosts from reaching the browser contract.
export const createPublicUrlSchema = (
  urlLabel: string,
  options: PublicUrlSchemaOptions = {},
): z.ZodString => {
  const maxLength = options.maxLength ?? PUBLIC_URL_MAX_LENGTH;
  const protocols = options.httpsOnly ? ["https:"] : ["http:", "https:"];

  return z
    .string({ error: `${urlLabel} debe ser un texto.` })
    .trim()
    .max(
      maxLength,
      `${urlLabel} no puede tener más de ${maxLength} caracteres.`,
    )
    .url(`Debes ingresar una URL válida para ${urlLabel.toLowerCase()}.`)
    .refine((value) => {
      const url = parseUrl(value);
      return url !== null && protocols.includes(url.protocol);
    }, `${urlLabel} debe usar ${protocols.map((protocol) => protocol.slice(0, -1)).join(" o ")}.`)
    .refine((value) => {
      const url = parseUrl(value);
      return url !== null && url.username === "" && url.password === "";
    }, `${urlLabel} no puede incluir credenciales.`)
    .refine((value) => {
      const url = parseUrl(value);
      return url === null || !isPrivateHostname(url.hostname);
    }, `${urlLabel} no puede apuntar a una dirección privada o local.`);
};

export const photoUrlSchema = createPublicUrlSchema("La URL de la foto")
  .nullable()
  .optional();
