import { randomInt } from "node:crypto";
import bcrypt from "bcrypt";

const SALT_ROUNDS = 12;

const TEMPORARY_PASSWORD_LENGTH = 16;
// Ambiguous characters (0/O/l/1) are excluded so temporary passwords can be
// read aloud and transcribed without confusion.
const UPPERCASE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ";
const LOWERCASE_CHARS = "abcdefghijkmnopqrstuvwxyz";
const DIGIT_CHARS = "23456789";
const SPECIAL_CHARS = "!@#$%&*+-=?";
const ALL_CHARS =
  UPPERCASE_CHARS + LOWERCASE_CHARS + DIGIT_CHARS + SPECIAL_CHARS;

const pickRandomChar = (charset: string): string => {
  return charset.charAt(randomInt(charset.length));
};

const swapChars = (
  chars: string[],
  firstIndex: number,
  secondIndex: number,
): void => {
  const first = chars[firstIndex];
  const second = chars[secondIndex];

  if (first === undefined || second === undefined) {
    return;
  }

  chars[firstIndex] = second;
  chars[secondIndex] = first;
};

// Cryptographically random 16-character password with at least one character
// of every class required by the password policy (uppercase, lowercase, digit
// and special character).
export const generateTemporaryPassword = (): string => {
  const chars = [
    pickRandomChar(UPPERCASE_CHARS),
    pickRandomChar(LOWERCASE_CHARS),
    pickRandomChar(DIGIT_CHARS),
    pickRandomChar(SPECIAL_CHARS),
  ];

  for (
    let index = chars.length;
    index < TEMPORARY_PASSWORD_LENGTH;
    index += 1
  ) {
    chars.push(pickRandomChar(ALL_CHARS));
  }

  for (let index = chars.length - 1; index > 0; index -= 1) {
    swapChars(chars, index, randomInt(index + 1));
  }

  return chars.join("");
};

export const hashPassword = async (password: string): Promise<string> => {
  return bcrypt.hash(password, SALT_ROUNDS);
};

export const comparePassword = async (
  password: string,
  passwordHash: string,
): Promise<boolean> => {
  return bcrypt.compare(password, passwordHash);
};
