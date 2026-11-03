# HomeKeys Liberty Backend

Backend API for **HomeKeys Liberty**, built with Node.js, Express, TypeScript, PostgreSQL, and Prisma ORM.

Iteration 1 includes the backend foundation, database migrations, administrator seed, JWT authentication, token revocation, and administrator-managed user creation. This iteration adds user editing, self-service password changes, and administrator-managed user deletion.

## Tech stack

- Node.js 20+
- Express 5
- TypeScript
- PostgreSQL
- Prisma ORM 6
- Zod
- JSON Web Tokens
- bcrypt
- express-rate-limit
- Node.js test runner and Supertest

## Features

- Layered architecture: routes → controllers → services → repositories.
- Strict TypeScript configuration.
- English database schema, table names, column names, enums, and source identifiers.
- Spanish user-facing API messages.
- Administrator seed with idempotent execution.
- Secure password hashing with bcrypt and 12 salt rounds.
- Bcrypt work for unknown emails to reduce login timing differences.
- One-hour JWT access tokens.
- JWT revocation through SHA-256 token hashes.
- Current user and role revalidation against PostgreSQL on protected routes.
- ADMIN authorization for user creation and PARTNER as the default role.
- ADMIN user listing and profile lookup, with PARTNER limited to its own profile.
- ADMIN user editing and deletion with last-admin, self-deletion, and property-relation protections.
- Self-service password change with bcrypt verification and invalidation of previous sessions.
- Login rate limiting and a configurable CORS allowlist.
- Hourly cleanup of expired revoked tokens.
- Centralized validation and error handling, including 413 payload responses.
- Automated HTTP integration tests with isolated Prisma test doubles.
- Helmet security headers.
- Postman collection for the main authentication and authorization flows.

## Project structure

```text
Back/
├── prisma/
│   ├── migrations/
│   ├── schema.prisma
│   ├── seed.example.ts
│   └── seed.ts # Local only; ignored by Git
├── postman/
│   └── homekeys-liberty-api.postman_collection.json
├── src/
│   ├── config/
│   ├── controllers/
│   ├── middleware/
│   ├── repositories/
│   ├── routes/
│   ├── services/
│   ├── types/
│   ├── utils/
│   ├── validators/
│   ├── app.ts
│   └── server.ts
├── tests/
│   ├── helpers/
│   ├── live/
│   ├── auth.spec.ts
│   ├── security.spec.ts
│   └── user-profile.spec.ts
├── .env.example
├── .gitignore
├── package.json
├── tsconfig.json
└── tsconfig.test.json
```

## Requirements

Before starting, install:

- Node.js 20 or newer.
- npm.
- PostgreSQL.
- A PostgreSQL database for HomeKeys Liberty.

## Environment variables

All commands below must be run from `Back`.

Create the local environment file:

```powershell
Copy-Item .env.example .env
```

Configure these variables in `.env`:

| Variable | Description |
| --- | --- |
| `DATABASE_URL` | PostgreSQL connection string. |
| `JWT_SECRET` | Random secret with at least 32 characters. |
| `PORT` | HTTP port; normally `3000`. |
| `CORS_ORIGINS` | Comma-separated browser origins allowed to call the API. Defaults to `http://localhost:5173`. |

Connection string format:

```text
postgresql://USER:PASSWORD@HOST:PORT/DATABASE?schema=public
```

Never commit the real `.env` file. It is excluded by `Back/.gitignore`; only `.env.example` should be committed.

## Installation and database setup

On a fresh clone, create the private local seed without overwriting an existing one:

```powershell
if (-not (Test-Path "prisma/seed.ts")) {
  Copy-Item "prisma/seed.example.ts" "prisma/seed.ts"
}
```

Complete every empty administrator value in `prisma/seed.ts`. This file contains private local data and is ignored by Git. Only `prisma/seed.example.ts` is intended for version control.

Then run:

```powershell
npm install
npx prisma migrate dev
npx prisma db seed
npm run dev
```

`npm install` automatically runs `prisma generate` through the `postinstall` script.

The migration command applies the migrations included in `prisma/migrations`. For a non-interactive deployment, use:

```powershell
npx prisma migrate deploy
```

The API runs by default at:

```text
http://localhost:3000/api/v1
```

## Administrator seed

The repository includes only `prisma/seed.example.ts`, with empty values and a guard that prevents accidental execution with incomplete data. Keep all real names, email addresses, phone numbers, and passwords exclusively in the ignored `prisma/seed.ts` file.

The seed is idempotent: running it again does not duplicate accounts or overwrite existing passwords. Use strong local bootstrap passwords and change them before a shared or production deployment.

## Database conventions

The current physical database schema is entirely in English:

- Tables: `users`, `properties`, `photos`, `revoked_tokens`, and `password_reset_tokens`.
- User fields include `first_name`, `last_name`, `email`, `password_hash`, `phone`, `photo_url`, `role`, and `password_changed_at`.
- Token fields include `token_hash`, `user_id`, and `expires_at`.
- Roles: `ADMIN` and `PARTNER`.
- Property categories: `House`, `Apartment`, and `Commercial`.
- Property listing types: `Sale` and `Rent`.
- Property statuses: `Active` and `Inactive`.

## Available scripts

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start the development server with file watching. |
| `npm run typecheck` | Run TypeScript checks for production and test sources. |
| `npm test` | Run the automated HTTP integration suite. |
| `npm run build` | Compile the application into `dist`. |
| `npm start` | Start the compiled application. |
| `npm run prisma:generate` | Regenerate Prisma Client. |
| `npm run prisma:migrate` | Run Prisma Migrate in development mode. |
| `npm run db:seed` | Run the administrator seed. |

## API endpoints

### Login

```text
POST /api/v1/auth/login
```

Request:

```json
{
  "email": "admin@example.com",
  "password": "YOUR_LOCAL_PASSWORD"
}
```

A successful response returns a JWT and safe user information. Password hashes are never exposed.

Possible responses:

- `200`: authenticated successfully.
- `400`: invalid request body.
- `401`: invalid credentials.
- `429`: too many failed login attempts; the current limit is 10 failures per 15 minutes per client.

### List all users

```text
GET /api/v1/users
Authorization: Bearer <token>
```

Only ADMIN users can access this endpoint. The response contains `data.users`, ordered by `createdAt` from newest to oldest. Password hashes and token data are never included.

Possible responses:

- `200`: user list returned successfully.
- `401`: missing, invalid, expired, or revoked token.
- `403`: authenticated user is not an administrator.

### Get the current authenticated user

```text
GET /api/v1/users/me
Authorization: Bearer <token>
```

Available to both `ADMIN` and `PARTNER`. The response uses the same safe `data.user` structure and automatically reflects the role currently stored in PostgreSQL.

Possible responses:

- `200`: current user profile returned successfully.
- `401`: missing, invalid, expired, or revoked token.

### Get a user by ID

```text
GET /api/v1/users/:id
Authorization: Bearer <token>
```

Access rules:

- Only `ADMIN` can read arbitrary users through this endpoint.
- `PARTNER` must use `GET /api/v1/users/me` to read its own profile.

Possible responses:

- `200`: user profile returned successfully.
- `400 VALIDATION_ERROR`: `:id` is not a positive integer.
- `401`: missing, invalid, expired, or revoked token.
- `403 ADMIN_REQUIRED`: authenticated user is not an administrator.
- `404 USER_NOT_FOUND`: ADMIN requested a nonexistent ID.

### Create a user

```text
POST /api/v1/users/add
Authorization: Bearer <token>
```

Only ADMIN users can access this endpoint.

Example with the default PARTNER role:

```json
{
  "firstName": "New",
  "lastName": "Partner",
  "email": "partner@example.com",
  "password": "REPLACE_WITH_A_STRONG_PASSWORD",
  "phone": "00000000",
  "photoUrl": null
}
```

To create another administrator, add:

```json
{
  "role": "ADMIN"
}
```

The only accepted roles are `ADMIN` and `PARTNER`. If `role` is omitted, the API assigns `PARTNER`.

Possible responses:

- `201`: user created successfully.
- `400`: validation error.
- `401`: missing, invalid, expired, or revoked token.
- `403`: authenticated user is not an administrator.
- `409`: email already registered.

Additional security responses:

- `403 CORS_ORIGIN_DENIED`: the browser origin is not present in `CORS_ORIGINS`.
- `413 PAYLOAD_TOO_LARGE`: the JSON body exceeds 10 KB.
- `401 INVALID_SESSION`: the token is valid, but its user no longer exists.

Protected routes read the current role from PostgreSQL. Changing an administrator to PARTNER therefore removes administrative access even for JWTs issued before the role change.

### Change my password

```text
PATCH /api/v1/users/me/password
Authorization: Bearer <token>
```

Available to both `ADMIN` and `PARTNER`. The body is strict and must contain exactly:

```json
{
  "currentPassword": "CURRENT_PASSWORD",
  "newPassword": "A_NEW_STRONG_PASSWORD"
}
```

Validation rules:

- `currentPassword` is mandatory and is verified against the stored bcrypt hash.
- `newPassword` requires at least 8 characters and cannot exceed 72 UTF-8 bytes.
- `newPassword` cannot be equal to `currentPassword`.
- Unknown fields are rejected with `400 VALIDATION_ERROR`.
- Only the bcrypt hash is stored; hashes are never returned.

Security behavior: changing the password invalidates every session issued before the change, including sessions on other devices. The JWT of the session that performed the change is also invalidated, so the response includes a fresh access token in `data.token`; the caller must replace its stored token with that value to stay signed in. This behavior is documented on purpose: the current session continues seamlessly while older sessions stop working immediately.

Possible responses:

- `200`: password updated; `data.user` plus the fresh `data.token`.
- `400 VALIDATION_ERROR`: invalid body, invalid new password, or same password.
- `401 INVALID_CURRENT_PASSWORD`: `currentPassword` does not match.
- `401`: missing, invalid, expired, or revoked token.

### Update a user

```text
PATCH /api/v1/users/:id
Authorization: Bearer <token>
```

Only `ADMIN` users can access this endpoint. `ADMIN` can edit any user, including itself. The body is strict, partial, and must contain at least one field:

```json
{
  "firstName": "New",
  "lastName": "Partner",
  "email": "partner@example.com",
  "phone": "00000000",
  "photoUrl": null,
  "role": "PARTNER",
  "password": "OPTIONAL_NEW_PASSWORD"
}
```

Validation rules:

- Accepted fields: `firstName`, `lastName`, `email`, `phone`, `photoUrl`, `role`, and `password`. Unknown fields are rejected, including `id`, `createdAt`, and `updatedAt`.
- `email` is normalized to lowercase and must stay unique; conflicts return `409 EMAIL_ALREADY_REGISTERED`.
- `role` accepts only `ADMIN` or `PARTNER`.
- `password` is optional and allows an administrator to set a new password without knowing the current one. It is hashed with bcrypt and invalidates every session previously issued for that user.
- Demoting the last `ADMIN` is blocked with `409 LAST_ADMIN_REQUIRED`; an `ADMIN` can demote itself whenever another `ADMIN` remains.
- When an `ADMIN` resets its own password through this endpoint, the response also includes a fresh `data.token` so the current session continues.

Possible responses:

- `200`: user updated successfully.
- `400 VALIDATION_ERROR`: invalid body or invalid field values.
- `401`: missing, invalid, expired, or revoked token.
- `403 ADMIN_REQUIRED`: authenticated user is not an administrator.
- `404 USER_NOT_FOUND`: nonexistent ID.
- `409 EMAIL_ALREADY_REGISTERED`: the new email belongs to another user.
- `409 LAST_ADMIN_REQUIRED`: the change would leave the system without administrators.

### Delete a user

```text
DELETE /api/v1/users/:id
Authorization: Bearer <token>
```

Only `ADMIN` users can access this endpoint.

Deletion rules:

- An `ADMIN` cannot delete itself: `409 SELF_DELETION_NOT_ALLOWED`.
- The last `ADMIN` cannot be deleted: `409 LAST_ADMIN_REQUIRED`. This check runs before the self-deletion check, so a sole administrator deleting itself receives `LAST_ADMIN_REQUIRED`.
- A user with registered properties cannot be deleted: `409 USER_HAS_PROPERTIES`. Property data is never removed automatically; reassign or delete those properties first after an explicit product decision.
- Users without relations are deleted in a single transaction that also removes their `revoked_tokens` and `password_reset_tokens` rows.

Possible responses:

- `200`: user deleted; `data.deletedId` contains the removed ID.
- `401`: missing, invalid, expired, or revoked token.
- `403 ADMIN_REQUIRED`: authenticated user is not an administrator.
- `404 USER_NOT_FOUND`: nonexistent ID.
- `409 SELF_DELETION_NOT_ALLOWED`: the target is the authenticated administrator.
- `409 LAST_ADMIN_REQUIRED`: the target is the last administrator.
- `409 USER_HAS_PROPERTIES`: the target still owns properties.

### Logout

```text
POST /api/v1/auth/logout
Authorization: Bearer <token>
```

The API stores only the token's SHA-256 hash in `revoked_tokens`, together with its user ID and expiration date. Reusing the token after logout returns `401`.

## Error responses

Errors use a consistent structure:

```json
{
  "success": false,
  "code": "VALIDATION_ERROR",
  "message": "Por favor revisa los datos ingresados.",
  "errors": [
    {
      "field": "email",
      "message": "Debes ingresar un correo electrónico válido."
    }
  ]
}
```

Unexpected errors return a generic Spanish message without exposing SQL queries, stack traces, tokens, or credentials.

User management endpoints add these codes: `INVALID_CURRENT_PASSWORD`, `SESSION_INVALIDATED`, `ADMIN_REQUIRED`, `USER_NOT_FOUND`, `EMAIL_ALREADY_REGISTERED`, `LAST_ADMIN_REQUIRED`, `SELF_DELETION_NOT_ALLOWED`, and `USER_HAS_PROPERTIES`.

## Postman collection

Import:

```text
postman/homekeys-liberty-api.postman_collection.json
```

The collection keeps a single `Login` request and adds `Change my password`, `Update user`, and `Delete user` next to the read-only and creation requests. Set `loginEmail`, `loginPassword`, `newUserPassword`, and `targetUserId` using local values; tokens and IDs are stored in collection variables by the test scripts. The collection never contains real credentials.

Suggested order: `Login`, `Create user` (stores the new ID in `targetUserId`), `Update user`, `Delete user`, `Change my password`, `Logout`. `Change my password` rotates the password of the authenticated user: on success it stores the returned token in `accessToken` and copies `newUserPassword` into `loginPassword` so `Login` keeps working. To run `Update user` or `Delete user` against another account, set `targetUserId` manually.

The role-specific scenarios are covered by `npm test`; the Postman collection intentionally keeps one login contract for frontend consumers.

These requests can create, modify, and delete users in the target database. Run them only against a local development database and remove manual test data when necessary.

## Automated tests

```powershell
npm test
```

The suite uses Supertest and isolated Prisma test doubles. It does not modify PostgreSQL or require personal seed data. Covered behavior includes ADMIN and PARTNER authorization, current-role revalidation, deleted accounts, logout revocation, duplicate emails, CORS, login rate limiting, bcrypt byte limits, payload limits, expired-token cleanup, user editing, password changes with previous-session invalidation, deletion guards (last ADMIN, self-deletion, users with properties), token cleanup on deletion, and password hash exclusion from every response.

There is also a live check for the user management flows against a real PostgreSQL database using temporary users that are removed at the end. It is not part of `npm test` and can be run with:

```powershell
npx tsx tests/live/user-management-live.ts
```

## Verification commands

```powershell
npm run typecheck
npm test
npm run build
npx prisma validate
npx prisma migrate status
npm audit
```

## Troubleshooting Prisma types

If VSCode reports an error such as:

```text
Module '"@prisma/client"' has no exported member 'Role'.
```

run:

```powershell
npm run prisma:generate
npm run typecheck
```

If the terminal checks pass but VSCode still shows the error:

1. Open the command palette with `Ctrl+Shift+P`.
2. Run **TypeScript: Restart TS Server**.
3. If necessary, run **TypeScript: Select TypeScript Version**.
4. Select **Use Workspace Version**.

This forces VSCode to use the generated Prisma Client and the TypeScript installation from `Back/node_modules`.

## Migration notes

This iteration includes one schema change, kept in its own migration:

```text
prisma/migrations/20261103003201_add_user_password_changed_at/
```

It adds the nullable `users.password_changed_at` timestamp used as the session-invalidation boundary: any JWT issued before that instant is rejected with `401 SESSION_INVALIDATED`. Stateless JWTs cannot revoke unknown outstanding tokens, so this security field is required to close previous sessions after a password change. Apply it with `npx prisma migrate deploy` on environments that do not run `migrate dev`.

## Security notes

- Never commit `.env`, `prisma/seed.ts`, personal data, or real credentials.
- Keep private administrator data only in the ignored local seed; commit only `prisma/seed.example.ts`.
- Use a long, random `JWT_SECRET` for every real environment.
- Change bootstrap passwords before deployment.
- Password hashes and raw revoked tokens are never returned by the API.
- Only SHA-256 token hashes are stored for logout revocation.
- Expired revoked tokens are removed at startup and every hour.
- Protected routes verify the account and current role in PostgreSQL instead of trusting only JWT claims.
- Login attempts are rate limited and browser origins are restricted by `CORS_ORIGINS`.
- New passwords are limited to 72 UTF-8 bytes to prevent silent bcrypt truncation.
- Changing a password invalidates every previously issued session. JWTs carry an `issuedAtMs` claim with millisecond precision that is compared against `users.password_changed_at` during authentication. Responses that change the caller's own password include a fresh `data.token` so the current session continues while older sessions stop working immediately.
- The last ADMIN can be neither deleted nor demoted, an ADMIN cannot delete itself, and users with properties are blocked with `409 USER_HAS_PROPERTIES` so real estate data is never removed without an explicit product decision.
- User deletion cleans `revoked_tokens` and `password_reset_tokens` rows in the same transaction.
- The `deepmerge-ts` npm override patches a transitive Prisma CLI vulnerability while preserving Prisma 6 compatibility. Re-run Prisma validation and `npm audit` before changing it.
