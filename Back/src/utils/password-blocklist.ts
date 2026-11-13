/**
 * Local blocklist of passwords that are common, predictable or tied to the
 * product. It is intentionally small and lives in code so no external service
 * is required to validate a password.
 *
 * The normalization removes accents, case and separators, so entries are
 * stored as lowercase alphanumeric strings. A future enhancement can replace
 * this list with a breach-corpus check (for example, HIBP k-anonymity) without
 * changing the callers.
 */

// Exact normalized values that are commonly used as passwords.
const COMMON_PASSWORDS = new Set([
  "123456789012",
  "1234567890123",
  "12345678901234",
  "123456789012345",
  "1234567890123456",
  "12345678901234567",
  "123456789012345678",
  "1q2w3e4r5t6y",
  "1qaz2wsx3edc",
  "asdfghjkl",
  "asdfghjklzxcv",
  "asdfghjkl1234",
  "iloveyou1234",
  "letmein1234",
  "qazwsxedcrfv",
  "qwertyuiop",
  "qwertyuiopasdf",
  "qwertyuiop1234",
  "welcome12345",
  "bienvenido123",
  "contraseña123",
  "contrasena123",
  "homekeysliberty",
  "homekeys2026",
]);

// Base words that are rejected whenever the rest of the password is only
// digits, for example "Password2026!" or "Homekeys1234!".
const COMMON_PASSWORD_BASES = [
  "123456",
  "123456789",
  "987654321",
  "admin",
  "administrador",
  "administrator",
  "asdfgh",
  "barquisimeto",
  "barcelona",
  "beisbol",
  "bienvenida",
  "bienvenido",
  "caracas",
  "clave",
  "contrasena",
  "contrasenna",
  "futbol",
  "homekeys",
  "homekeysliberty",
  "iloveyou",
  "inmobiliaria",
  "letmein",
  "liberty",
  "madrid",
  "maracaibo",
  "margarita",
  "password",
  "passw0rd",
  "pssword",
  "p4ssword",
  "pa55word",
  "qwerty",
  "root",
  "usuario",
  "valencia",
  "venezuela",
  "welcome",
  "zxcvbn",
];

/**
 * Lowercases, strips diacritics and removes every character that is not a
 * basic Latin letter or digit. Two passwords that differ only in case,
 * accents or separators therefore share the same normalized form.
 */
export const normalizePasswordCandidate = (value: string): string => {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
};

const hasOnlyDigits = (value: string): boolean => {
  return value === "" || /^\d+$/.test(value);
};

export const isCommonPassword = (password: string): boolean => {
  const normalized = normalizePasswordCandidate(password);

  if (normalized.length === 0) {
    return false;
  }

  if (COMMON_PASSWORDS.has(normalized)) {
    return true;
  }

  return COMMON_PASSWORD_BASES.some(
    (base) =>
      normalized.startsWith(base) &&
      hasOnlyDigits(normalized.slice(base.length)),
  );
};
