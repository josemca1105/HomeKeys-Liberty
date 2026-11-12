import pino from "pino";
import { environment } from "./env";

export const createLogger = () => {
  return pino({
    level: process.env.NODE_ENV === "test" ? "silent" : environment.LOG_LEVEL,
    redact: {
      paths: [
        "req.headers.authorization",
        "req.headers.cookie",
        "req.body.password",
        "req.body.currentPassword",
        "req.body.newPassword",
        "req.body.token",
        "req.body.resetToken",
        'res.headers["set-cookie"]',
      ],
      censor: "[REDACTED]",
    },
  });
};
