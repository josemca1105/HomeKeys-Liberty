import { z } from "zod";

export const createRequiredStringSchema = (
  requiredMessage: string,
  invalidTypeMessage: string,
): z.ZodString => {
  return z.string({
    error: (issue): string =>
      issue.input === undefined ? requiredMessage : invalidTypeMessage,
  });
};
