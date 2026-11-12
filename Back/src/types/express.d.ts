import type { AuthSession } from "./auth";

declare global {
  namespace Express {
    interface Request {
      auth?: AuthSession;
      requestId?: string;
      validatedQuery?: unknown;
    }
  }
}

export {};
