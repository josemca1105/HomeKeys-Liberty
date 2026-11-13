import jwt from "jsonwebtoken";
import { Role } from "@prisma/client";
import { environment } from "../config/env";
import type { AuthTokenPayload } from "../types/auth";

const TOKEN_EXPIRATION_SECONDS = 60 * 60;

// Marks this token as an access token so it can never be confused with a
// future refresh token or any other token the API issues.
const ACCESS_TOKEN_TYPE = "access";

export const generateAuthToken = (userId: number, role: Role): string => {
  return jwt.sign(
    { role, issuedAtMs: Date.now(), tokenType: ACCESS_TOKEN_TYPE },
    environment.JWT_SECRET,
    {
      algorithm: "HS256",
      issuer: environment.JWT_ISSUER,
      audience: environment.JWT_AUDIENCE,
      subject: userId.toString(),
      expiresIn: TOKEN_EXPIRATION_SECONDS,
    },
  );
};

export const verifyAuthToken = (token: string): AuthTokenPayload => {
  const decodedToken = jwt.verify(token, environment.JWT_SECRET, {
    algorithms: ["HS256"],
    issuer: environment.JWT_ISSUER,
    audience: environment.JWT_AUDIENCE,
  });

  if (typeof decodedToken === "string") {
    throw new Error("Invalid token payload.");
  }

  const userId = Number(decodedToken.sub);
  const hasValidUserId = Number.isInteger(userId) && userId > 0;
  const hasValidRole =
    decodedToken.role === Role.ADMIN || decodedToken.role === Role.PARTNER;
  const hasValidTokenType = decodedToken.tokenType === ACCESS_TOKEN_TYPE;

  if (
    !hasValidUserId ||
    !hasValidRole ||
    !hasValidTokenType ||
    typeof decodedToken.iat !== "number" ||
    typeof decodedToken.exp !== "number"
  ) {
    throw new Error("Invalid token payload.");
  }

  // issuedAtMs gives millisecond precision so a token can be compared against
  // passwordChangedAt without the one-second ambiguity of the iat claim.
  const issuedAtMs =
    typeof decodedToken.issuedAtMs === "number"
      ? decodedToken.issuedAtMs
      : decodedToken.iat * 1000;

  return {
    userId,
    role: decodedToken.role,
    issuedAt: new Date(issuedAtMs),
    expiresAt: new Date(decodedToken.exp * 1000),
  };
};
