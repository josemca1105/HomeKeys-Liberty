export const PROPERTY_CODE_MIN_DIGITS = 4;
export const PROPERTY_CODE_PREFIX = "HK-";

export const formatPropertyCode = (sequence: bigint | number): string => {
  return `${PROPERTY_CODE_PREFIX}${sequence
    .toString()
    .padStart(PROPERTY_CODE_MIN_DIGITS, "0")}`;
};

// Accepts the practical forms a person may type: 1, 0001, HK-1 or hk-0001.
// Returns null for anything that is not a positive numeric sequence.
export const normalizePropertyCode = (value: string): string | null => {
  const normalized = value.trim().toUpperCase();
  const match = /^(?:HK-?)?(\d{1,18})$/.exec(normalized);

  if (!match?.[1]) {
    return null;
  }

  const sequence = BigInt(match[1]);

  if (sequence <= 0n) {
    return null;
  }

  return formatPropertyCode(sequence);
};
