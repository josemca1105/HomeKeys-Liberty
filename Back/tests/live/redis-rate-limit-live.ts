/**
 * Live verification for the Redis-backed rate limiter.
 *
 * Proves three things that the in-memory suite cannot:
 * 1. Two limiter instances with the same Redis prefix share counters, which is
 *    what happens when several API instances run behind a load balancer.
 * 2. The limiter writes keys with a TTL to Redis.
 * 3. `passOnStoreError` fails open when Redis is unavailable.
 *
 * It is excluded from `npm test` because it needs a real Redis server. Run a
 * local one with Docker and then execute the script:
 *   docker run --rm -p 6379:6379 redis:7
 *   $env:RATE_LIMIT_REDIS_URL="redis://localhost:6379"
 *   npx tsx tests/live/redis-rate-limit-live.ts
 */
import assert from "node:assert/strict";
import express, { type Express } from "express";
import { rateLimit } from "express-rate-limit";
import { RedisStore, type RedisReply } from "rate-limit-redis";
import { createClient } from "redis";
import request from "supertest";

const REDIS_URL = process.env.RATE_LIMIT_REDIS_URL ?? "redis://localhost:6379";
const RUN_ID = `${Date.now()}-${Math.floor(Math.random() * 100000)}`;
const SHARED_PREFIX = `rl:live:${RUN_ID}:`;
const WINDOW_MS = 60 * 1000;

const client = createClient({ url: REDIS_URL });
client.on("error", (error) => {
  console.error("Redis client error.", error);
});

type SendCommand = (...args: string[]) => Promise<RedisReply>;

const createStore = (sendCommand: SendCommand): RedisStore => {
  return new RedisStore({
    prefix: SHARED_PREFIX,
    sendCommand,
  });
};

const createApp = (store: RedisStore): Express => {
  const app = express();

  app.use(
    rateLimit({
      windowMs: WINDOW_MS,
      limit: 2,
      standardHeaders: "draft-8",
      legacyHeaders: false,
      passOnStoreError: true,
      store,
      handler: (_req, res): void => {
        res.status(429).json({ code: "LIMITED" });
      },
    }),
  );

  app.get("/probe", (_req, res): void => {
    res.status(200).json({ ok: true });
  });

  return app;
};

const run = async (): Promise<void> => {
  await client.connect();

  try {
    const sendCommand: SendCommand = (...args) =>
      client.sendCommand(args) as unknown as Promise<RedisReply>;

    // Two separate limiters with the same prefix simulate two API instances.
    const instanceA = createApp(createStore(sendCommand));
    const instanceB = createApp(createStore(sendCommand));

    assert.equal((await request(instanceA).get("/probe")).status, 200);
    assert.equal((await request(instanceA).get("/probe")).status, 200);

    const sharedResponse = await request(instanceB).get("/probe");
    assert.equal(
      sharedResponse.status,
      429,
      "The second instance must see the counter shared through Redis",
    );

    const keys = await client.keys(`${SHARED_PREFIX}*`);
    assert.equal(keys.length > 0, true, "The limiter must write keys to Redis");
    const ttl = await client.ttl(keys[0] as string);
    assert.equal(ttl > 0, true, "The limiter key must expire with the window");

    // A store that cannot reach Redis must not block requests.
    const failingApp = createApp(
      createStore(async () => {
        throw new Error("Redis unavailable");
      }),
    );
    const failOpenResponse = await request(failingApp).get("/probe");
    assert.equal(
      failOpenResponse.status,
      200,
      "passOnStoreError must let requests through when Redis fails",
    );

    console.log("Redis rate-limit integration check passed.");
  } finally {
    const keys = await client.keys(`${SHARED_PREFIX}*`);

    if (keys.length > 0) {
      await client.del(keys);
    }

    await client.quit();
  }
};

void run().catch((error: unknown): void => {
  console.error("Redis rate-limit integration check failed.", error);
  process.exit(1);
});
