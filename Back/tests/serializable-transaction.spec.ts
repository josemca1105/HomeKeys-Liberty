import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import { Prisma } from "@prisma/client";
import { prisma } from "../src/config/database";
import { runSerializableTransaction } from "../src/repositories/serializable-transaction";

type TransactionOperation = (
  transaction: Prisma.TransactionClient,
) => Promise<unknown>;

type TransactionFunction = typeof prisma.$transaction;

const originalTransaction = prisma.$transaction;

const replaceTransaction = (implementation: unknown): void => {
  (prisma as unknown as { $transaction: unknown }).$transaction =
    implementation;
};

describe("Serializable transaction retry", () => {
  afterEach(() => {
    (prisma as unknown as { $transaction: TransactionFunction }).$transaction =
      originalTransaction;
  });

  it("retries after a serialization failure", async () => {
    let attempts = 0;

    replaceTransaction(async (operation: TransactionOperation) => {
      attempts += 1;

      if (attempts === 1) {
        throw new Prisma.PrismaClientKnownRequestError(
          "serialization failure",
          {
            code: "P2034",
            clientVersion: "6.19.3",
          },
        );
      }

      return operation({} as Prisma.TransactionClient);
    });

    const result = await runSerializableTransaction(
      async () => "completed",
    );

    assert.equal(result, "completed");
    assert.equal(attempts, 2);
  });

  it("does not retry a non-serialization error", async () => {
    let attempts = 0;

    replaceTransaction(async () => {
      attempts += 1;
      throw new Error("boom");
    });

    await assert.rejects(
      () => runSerializableTransaction(async () => "never"),
      /boom/,
    );
    assert.equal(attempts, 1);
  });
});
