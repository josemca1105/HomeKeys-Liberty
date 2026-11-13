import type { RequestHandler } from "express";

/**
 * Prevents browsers, proxies and CDNs from caching API responses.
 *
 * Every response of this API carries either authentication material
 * (tokens, password reset links) or personal data (names, emails, phones),
 * so it must never be written to any cache.
 */
export const noStore: RequestHandler = (_req, res, next): void => {
  res.setHeader("Cache-Control", "no-store, private");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");
  next();
};
