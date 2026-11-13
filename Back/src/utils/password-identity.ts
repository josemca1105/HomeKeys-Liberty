import { normalizePasswordCandidate } from "./password-blocklist";

export interface PasswordIdentity {
  email?: string;
  firstName?: string;
  lastName?: string;
}

// Shorter candidates (for example a one-letter first name) would reject too
// many legitimate passwords.
const MIN_CANDIDATE_LENGTH = 3;

const buildIdentityCandidates = (identity: PasswordIdentity): string[] => {
  const candidates = new Set<string>();

  const add = (value: string | undefined): void => {
    if (value === undefined || value.trim().length === 0) {
      return;
    }

    const normalized = normalizePasswordCandidate(value);

    if (normalized.length >= MIN_CANDIDATE_LENGTH) {
      candidates.add(normalized);
    }
  };

  if (identity.email !== undefined) {
    const [localPart] = identity.email.split("@");
    add(localPart);
    add(identity.email);
  }

  add(identity.firstName);
  add(identity.lastName);

  if (identity.firstName !== undefined && identity.lastName !== undefined) {
    add(`${identity.firstName}${identity.lastName}`);
    add(`${identity.lastName}${identity.firstName}`);
  }

  return [...candidates];
};

const hasOnlyDigits = (value: string): boolean => {
  return value === "" || /^\d+$/.test(value);
};

/**
 * Rejects passwords that are built from the account identity: the email, its
 * local part, the first name, the last name or the full name, optionally
 * followed only by digits (for example "MariaGonzalez2026!").
 */
export const isPasswordBasedOnIdentity = (
  password: string,
  identity: PasswordIdentity,
): boolean => {
  const normalizedPassword = normalizePasswordCandidate(password);

  if (normalizedPassword.length === 0) {
    return false;
  }

  return buildIdentityCandidates(identity).some(
    (candidate) =>
      normalizedPassword === candidate ||
      (normalizedPassword.startsWith(candidate) &&
        hasOnlyDigits(normalizedPassword.slice(candidate.length))),
  );
};
