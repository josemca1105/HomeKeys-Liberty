import { Prisma } from "@prisma/client";
import { prisma } from "../config/database";

const MAX_ATTEMPTS = 3;

const isSerializationFailure = (error: unknown): boolean => {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2034"
  );
};

// PostgreSQL aborts one of two concurrent serializable transactions with
// P2034. Retrying re-runs the invariant check against the committed state.
export const runSerializableTransaction = async <T>(
  operation: (transaction: Prisma.TransactionClient) => Promise<T>,
): Promise<T> => {
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    try {
      return await prisma.$transaction(operation, {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      });
    } catch (error) {
      if (attempt === MAX_ATTEMPTS || !isSerializationFailure(error)) {
        throw error;
      }
    }
  }

  throw new Error("Serializable transaction retry limit reached.");
};
