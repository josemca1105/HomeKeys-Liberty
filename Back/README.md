# HomeKeys Liberty Backend

Backend API for **HomeKeys Liberty**, built with Node.js, Express, TypeScript, PostgreSQL, and Prisma ORM.

Iteration 1 includes the backend foundation, database migrations, administrator seed, JWT authentication, token revocation, and administrator-managed user creation. This iteration adds user editing, self-service password changes, administrator-managed user deletion, and email-based password recovery.

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
- Automatic email invitations for administrator-created users, with a single-use activation link.
- Password policy with four character classes on every password defined through the API.
- Mandatory password change for accounts created or reset by an ADMIN.
- Password recovery by email through Gmail SMTP with single-use, 15-minute tokens.
- Per-IP, per-account and global rate limiting, with an optional Redis store for multiple instances.
- A configurable CORS allowlist and Express `trust proxy` setting.
- Hourly cleanup of expired revoked tokens.
- Centralized validation and error handling, including 413 payload responses.
- Automated HTTP integration tests with isolated Prisma test doubles.
- Helmet security headers.
- Postman collection for the main authentication and authorization flows.

## Project structure

```text
Back/
├── assets/
│   └── logo.png # Brand logo embedded in emails (versioned)
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
| `JWT_SECRET` | Random secret with at least 64 characters and high entropy. Generate it with a cryptographic random source; do not write a phrase or reuse an example. |
| `PORT` | HTTP port; normally `3000`. |
| `CORS_ORIGINS` | Comma-separated browser origins allowed to call the API. Defaults to `http://localhost:5173`. |
| `TRUST_PROXY` | Express `trust proxy` setting. Use `false` without a proxy, `1` behind one reverse proxy, or a comma-separated list of trusted proxy IPs/subnets. Defaults to `false`. |
| `RATE_LIMIT_REDIS_URL` | Optional `redis://` or `rediss://` URL. When set, rate limit counters are shared across instances; when empty, each process uses in-memory counters. |
| `SMTP_HOST` | SMTP server for recovery emails. Defaults to `smtp.gmail.com`. |
| `SMTP_PORT` | SMTP port. Defaults to `465`. |
| `SMTP_SECURE` | `true` for implicit TLS. Defaults to `true`. |
| `SMTP_USER` | SMTP account used to send recovery emails. |
| `SMTP_APP_PASSWORD` | Gmail app password for `SMTP_USER`. Never commit it. |
| `SMTP_FROM` | Optional sender header, for example `HomeKeys Liberty <user@example.com>`. |
| `PASSWORD_RESET_BASE_URL` | Frontend page that receives `?token=<token>` from recovery and invitation emails. |
| `APP_BASE_URL` | Frontend entry page used by the "Iniciar sesión" button in notice emails. |

Connection string format:

```text
postgresql://USER:PASSWORD@HOST:PORT/DATABASE?schema=public
```

Generate `JWT_SECRET` with a cryptographic random source:

```powershell
openssl rand -hex 32
```

Or, if OpenSSL is not available:

```powershell
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

The API requires at least 64 characters, at least 16 distinct characters, and rejects placeholders such as `REPLACE_WITH...` or `CHANGE_ME...`. The value in `.env.example` is intentionally invalid, so the API will not start until you replace it.

Never commit the real `.env` file. It is excluded by `Back/.gitignore`; only `.env.example` should be committed.

### Rate limiting and reverse proxies

- If the API runs behind Nginx, a load balancer, Render, Railway or another reverse proxy, set `TRUST_PROXY` to the number of trusted hops or to a comma-separated list of trusted proxy IPs/subnets. Do not use `TRUST_PROXY=true` on the public internet: clients could forge `X-Forwarded-For` and bypass the limits.
- Without a correct `TRUST_PROXY`, every request appears to come from the proxy IP. The per-IP limits would then block the whole user base instead of one client.
- In-memory counters are per process and reset on restart. If the API runs more than one instance, set `RATE_LIMIT_REDIS_URL` so all instances share the counters.
- If Redis is temporarily unavailable, the limiters fail open (`passOnStoreError`) to keep the API available; monitor the "Rate limit Redis error" log messages.
- Global limits, per-account login limits, password change limits and administrator action limits are applied in addition to the per-IP limits.

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
- `429`: too many failed login attempts; the limits are 5 failures per 15 minutes per account and 30 per client IP.

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

Example with the default PARTNER role and no explicit password:

```json
{
  "firstName": "New",
  "lastName": "Partner",
  "email": "partner@example.com",
  "phone": "00000000",
  "photoUrl": null
}
```

The `password` field is optional and is never disclosed. When it is omitted, the API generates a random initial password internally; when it is sent explicitly, it must satisfy the password policy and only the ADMIN knows it (it is never emailed).

Every created account receives a branded welcome email with a single-use activation link (valid for 24 hours) that opens the page where the user defines their personal password. If the email cannot be delivered, the account is still created and `data.invitationSent` comes back as `false`; the ADMIN can resend the link through `POST /auth/forgot-password`.

To create another administrator, add:

```json
{
  "role": "ADMIN"
}
```

The only accepted roles are `ADMIN` and `PARTNER`. If `role` is omitted, the API assigns `PARTNER`.

Possible responses:

- `201`: user created successfully; `data.invitationSent` reports whether the welcome email was sent.
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

Security behavior: changing the password invalidates every session issued before the change, including sessions on other devices, and deletes any pending invitation or password recovery link. The JWT of the session that performed the change is also invalidated, so the response includes a fresh access token in `data.token`; the caller must replace its stored token with that value to stay signed in. This behavior is documented on purpose: the current session continues seamlessly while older sessions stop working immediately.

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
- `email` is normalized to lowercase and must stay unique; conflicts return `409 EMAIL_ALREADY_REGISTERED`. Changing the email also deletes every pending invitation or password recovery link, because those links were delivered to the previous address.
- `role` accepts only `ADMIN` or `PARTNER`.
- `password` is optional and allows an administrator to set a new password without knowing the current one. It is hashed with bcrypt, invalidates every session previously issued for that user, and deletes any pending invitation or password recovery link.
- Demoting the last `ADMIN` is blocked with `409 LAST_ADMIN_REQUIRED`; an `ADMIN` can demote itself whenever another `ADMIN` remains. The check and the update run in the same serializable transaction, so concurrent demotions cannot leave the system without administrators.
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

### Recover a forgotten password

```text
POST /api/v1/auth/forgot-password
```

Public endpoint. Body:

```json
{
  "email": "user@example.com"
}
```

When the email belongs to a registered user, the API stores a single-use recovery token and sends an email through Gmail SMTP with a link shaped as `{{PASSWORD_RESET_BASE_URL}}?token=<token>`. Only the SHA-256 hash of the token is stored; the raw token exists only inside the email.

The response is always the same generic message, whether the email exists or not, so the endpoint cannot be used to discover registered accounts:

```json
{
  "success": true,
  "message": "Si el correo está registrado, recibirás un mensaje para restablecer tu contraseña.",
  "data": {}
}
```

Requesting a new link invalidates the previous pending links of that user. Each link is valid for 15 minutes and can be used once.

Recovery emails use the branded HomeKeys Liberty template: table-based HTML with inline styles, a 600px card, a call-to-action button, a copyable fallback link, and a security notice. The logo travels inside the email as a CID attachment taken from `assets/logo.png`, so it renders even when the email client blocks remote images; if the file is missing, the email is still sent and a warning is logged. The reusable layout lives in `src/utils/email-template.ts` for future emails. The template forces light mode (`color-scheme: light only`) so clients with dark themes cannot render a half-inverted email.

Possible responses:

- `200`: generic acknowledgment (always).
- `400 VALIDATION_ERROR`: invalid email.
- `429 TOO_MANY_RESET_ATTEMPTS`: more than 5 requests in 15 minutes for the same email, or more than 20 per client IP.

### Reset a password

```text
POST /api/v1/auth/reset-password
```

Public endpoint. Body:

```json
{
  "token": "TOKEN_FROM_THE_RECOVERY_EMAIL",
  "newPassword": "Ejemplo#2026x"
}
```

`newPassword` must satisfy the password policy. On success the account password is replaced, the recovery token is marked as used, any other pending link is removed, and every session issued before the reset is closed: the user must sign in again with the new password. The token is consumed with a conditional update inside the same transaction that changes the password, so two concurrent requests using the same link cannot both apply a new password.

Possible responses:

- `200`: password reset successfully; the user signs in again.
- `400 VALIDATION_ERROR`: invalid body or password policy violation.
- `400 INVALID_RESET_TOKEN`: unknown token.
- `400 RESET_TOKEN_ALREADY_USED`: the link was already used.
- `400 RESET_TOKEN_EXPIRED`: the link expired; request a new one.
- `429 TOO_MANY_RESET_ATTEMPTS`: more than 10 requests in 15 minutes per client IP, or more than 5 for the same token.

## Mandatory password change

Accounts created by an ADMIN or reset by an ADMIN through `PATCH /users/:id` carry `mustChangePassword: true` in the `user` DTO. Until the user defines a personal password:

- `GET /users/me`, `PATCH /users/me/password`, and `POST /auth/logout` stay available so the frontend can render the mandatory change screen.
- Every other protected route answers `403 PASSWORD_CHANGE_REQUIRED` with "Debes cambiar tu contraseña para continuar."

The flag clears when the user defines a personal password through `PATCH /users/me/password`, the activation link, or the recovery link. Any protected route added in the future must include the `enforcePasswordChange` middleware to preserve this behavior.

Frontend contract: read `mustChangePassword` from the login response or `GET /users/me` and redirect to the change-password screen; receiving `403 PASSWORD_CHANGE_REQUIRED` means the same.

## Password policy

Every password defined through the API must satisfy this policy:

- At least 8 characters. There is no artificial upper cap; the technical limit is 72 UTF-8 bytes (bcrypt).
- At least one uppercase letter, one lowercase letter, one number, and one special character (any punctuation mark or symbol).
- Character classes are Unicode-aware: `ñ` and accented letters count as letters, not as special characters.
- The new password cannot be equal to the current one on `PATCH /api/v1/users/me/password`.

The policy applies wherever a password is defined: the optional `password` of `POST /users/add`, the `newPassword` of `PATCH /users/me/password`, the `newPassword` of `POST /auth/reset-password`, and the administrator `password` reset of `PATCH /users/:id`. Violations return `400 VALIDATION_ERROR` with a field-level message.

The policy is not retroactive: existing passwords keep working and are only replaced through a new change or reset. Initial passwords generated by the API are never disclosed and always satisfy the policy. Example of a valid password: `Ejemplo#2026x`.

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

User management endpoints add these codes: `INVALID_CURRENT_PASSWORD`, `SESSION_INVALIDATED`, `ADMIN_REQUIRED`, `USER_NOT_FOUND`, `EMAIL_ALREADY_REGISTERED`, `LAST_ADMIN_REQUIRED`, `SELF_DELETION_NOT_ALLOWED`, and `USER_HAS_PROPERTIES`. Password recovery adds `INVALID_RESET_TOKEN`, `RESET_TOKEN_EXPIRED`, `RESET_TOKEN_ALREADY_USED`, and `TOO_MANY_RESET_ATTEMPTS`. The mandatory password change adds `PASSWORD_CHANGE_REQUIRED`.

## Postman collection

Import:

```text
postman/homekeys-liberty-api.postman_collection.json
```

The collection keeps a single `Login` request and adds `Change my password`, `Update user`, `Delete user`, `Forgot password`, and `Reset password` next to the read-only and creation requests. Set `loginEmail`, `loginPassword`, `newUserPassword`, `targetUserId`, and `resetToken` using local values; tokens and IDs are stored in collection variables by the test scripts. The collection never contains real credentials.

Suggested order: `Login`, `Create user` (stores the new ID in `targetUserId`), `Update user`, `Delete user`, `Change my password`, `Logout`. `Change my password` rotates the password of the authenticated user: on success it stores the returned token in `accessToken` and copies `newUserPassword` into `loginPassword` so `Login` keeps working. To run `Update user` or `Delete user` against another account, set `targetUserId` manually. `Forgot password` sends a real recovery email to `loginEmail`; copy the token from the received link into `resetToken` before running `Reset password`, which also copies `newUserPassword` into `loginPassword` on success.

The role-specific scenarios are covered by `npm test`; the Postman collection intentionally keeps one login contract for frontend consumers.

These requests can create, modify, and delete users in the target database. Run them only against a local development database and remove manual test data when necessary.

## Testing the user flows from Postman

Prerequisites: the API running locally (`npm run dev`) with SMTP configured in `.env`, and these collection variables set with local values: `loginEmail` (an ADMIN seed account), `loginPassword`, and `newUserPassword` (policy-compliant, for example `Ejemplo#2026x`). Leave `targetUserId` and `resetToken` empty; the tests and the steps below fill them in.

Account activation and password recovery share `POST /auth/reset-password`, so the `Reset password` request serves both purposes.

### Flow 1: create a user and activate with the emailed token

| Step | Request | What happens | What to verify |
| --- | --- | --- | --- |
| 1 | `Login` | The ADMIN signs in | `200`; `accessToken`, `currentUserId`, and `currentUserRole` are stored |
| 2 | `Create user` (body without `password`) | The user is created and the welcome email is sent | `201`, `data.invitationSent: true`, `data.user.mustChangePassword: true`, no `temporaryPassword`; the test stores the id in `targetUserId` |
| 3 | The new user's mailbox | "Bienvenido a HomeKeys Liberty - Activa tu cuenta" arrives | Press "Activar mi cuenta" and copy the `token=` value from the link |
| 4 | Paste it into the `resetToken` collection variable | — | — |
| 5 | `Reset password` (`token: {{resetToken}}`, `newPassword: {{newUserPassword}}`) | The user defines a personal password | `200` "Contraseña restablecida exitosamente." |
| 6 | `Login` with the new user's email and password | The user signs in | `200` and `data.user.mustChangePassword: false` |

### Flow 2: mandatory password change (password set by the ADMIN)

1. `Create user` with `"password": "{{newUserPassword}}"` added to the body (it must satisfy the password policy).
2. `Login` as that user with that password → `200` and `data.user.mustChangePassword: true`.
3. `Get all users`, `Update user`, or `Delete user` → `403 PASSWORD_CHANGE_REQUIRED` ("Debes cambiar tu contraseña para continuar.").
4. `Get current user` → still `200`, so the frontend can render the change screen.
5. `Change my password` (`currentPassword: {{newUserPassword}}` and a policy-compliant `newPassword`) → `200`; use the fresh `accessToken` from the response.
6. `Get all users` with that token → `200` again (access restored).

### Flow 3: forgot password

1. `Forgot password` with the user's email → always the same generic `200`, whether the account exists or not.
2. Open the received "Restablece tu contraseña" email and copy the `token=` value.
3. Paste it into `resetToken` and run `Reset password` with a new password → `200`; every previous session is closed and the user signs in with the new password.

### Flow 4: manage the created user

`Update user` and `Delete user` use `{{targetUserId}}`, which `Create user` captures automatically. Deleting a user with properties answers `409 USER_HAS_PROPERTIES`.

Notes:

- `newUserPassword` must satisfy the password policy and differ from the current password, or the request returns `400 VALIDATION_ERROR`.
- `Reset password` and `Change my password` copy `newUserPassword` into `loginPassword` on success, which is convenient when the tested user is the same one configured in `loginEmail`.
- Rate limits: `login` allows 5 failures per account and 30 per client IP every 15 minutes; `forgot-password` allows 5 requests per email and 20 per client IP; `reset-password` allows 10 requests per client IP and 5 per token. Password changes allow 5 failures per user every 15 minutes.
- Reusing an activation or recovery link returns `400 RESET_TOKEN_ALREADY_USED`; links older than their validity return `400 RESET_TOKEN_EXPIRED`.
- Welcome emails never contain passwords; when the ADMIN sets an explicit password, the ADMIN communicates it through their own channel.

## Automated tests

```powershell
npm test
```

The suite uses Supertest and isolated Prisma test doubles. It does not modify PostgreSQL, require personal seed data, or send real emails: outgoing mail is captured by a test double. Covered behavior includes ADMIN and PARTNER authorization, current-role revalidation, deleted accounts, logout revocation, duplicate emails, CORS, per-account login, password change and password recovery rate limiting, bcrypt byte limits, payload limits, expired-token cleanup, user editing, password changes with previous-session invalidation, deletion guards (last ADMIN, concurrent last-ADMIN demotion, self-deletion, users with properties), token cleanup on deletion, password hash exclusion from every response, password policy enforcement, the generic single-use recovery flow, email invitations with activation links, and the mandatory password change with its `PASSWORD_CHANGE_REQUIRED` blocking.

There are also live checks against a real PostgreSQL database using temporary users that are removed at the end. They are not part of `npm test` and can be run with:

```powershell
npx tsx tests/live/user-management-live.ts
npx tsx tests/live/password-reset-live.ts
npx tsx tests/live/invitation-live.ts
```

The password recovery and invitation live checks additionally deliver real branded emails through the Gmail SMTP account configured in `.env` (the invitation check uses plus-addressed mailboxes so everything arrives at the same inbox for visual review).

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

This project keeps every schema change in its own migration:

```text
prisma/migrations/20261103003201_add_user_password_changed_at/
prisma/migrations/20261105020528_add_user_must_change_password/
```

The first one adds the nullable `users.password_changed_at` timestamp used as the session-invalidation boundary: any JWT issued before that instant is rejected with `401 SESSION_INVALIDATED`. Stateless JWTs cannot revoke unknown outstanding tokens, so this security field is required to close previous sessions after a password change.

The second one adds `users.must_change_password`, the flag behind the mandatory password change for invited or ADMIN-reset accounts. Apply both with `npx prisma migrate deploy` on environments that do not run `migrate dev`.

The password recovery and invitation flows need no other migrations: they reuse the `password_reset_tokens` table created by the initial schema.

## Security notes

- Never commit `.env`, `prisma/seed.ts`, personal data, or real credentials.
- Keep private administrator data only in the ignored local seed; commit only `prisma/seed.example.ts`.
- Use a long, random `JWT_SECRET` for every real environment. The API rejects values shorter than 64 characters, low-diversity values, leading/trailing whitespace and known placeholders, so a copied `.env.example` cannot start by accident.
- Change bootstrap passwords before deployment.
- Password hashes and raw revoked tokens are never returned by the API.
- Only SHA-256 token hashes are stored for logout revocation.
- Expired revoked tokens are removed at startup and every hour.
- Protected routes verify the account and current role in PostgreSQL instead of trusting only JWT claims.
- Login attempts are rate limited per account and per IP; password changes, administrator mutations, forgot-password and reset-password have dedicated limits; a global API limit covers the remaining routes. Browser origins are restricted by `CORS_ORIGINS`, and `TRUST_PROXY` controls how client IPs are derived behind a reverse proxy. Set `RATE_LIMIT_REDIS_URL` to share the counters across multiple instances.
- New passwords are limited to 72 UTF-8 bytes to prevent silent bcrypt truncation.
- Temporary passwords are generated with `node:crypto` randomness, include at least one character of every policy class, exclude ambiguous characters (`0/O/l/1`), are shown only once in the creation response, and are stored only as bcrypt hashes.
- The password policy applies only to newly defined passwords; existing passwords are never forced to rotate.
- Changing a password invalidates every previously issued session. JWTs carry an `issuedAtMs` claim with millisecond precision that is compared against `users.password_changed_at` during authentication. Responses that change the caller's own password include a fresh `data.token` so the current session continues while older sessions stop working immediately.
- Changing a password or email deletes any pending invitation or password recovery link in the same transaction, so a previously delivered link cannot be reused after an administrator remediates an account.
- The last ADMIN can be neither deleted nor demoted, an ADMIN cannot delete itself, and users with properties are blocked with `409 USER_HAS_PROPERTIES` so real estate data is never removed without an explicit product decision. The last-ADMIN check and the mutation run in the same serializable transaction, with automatic retry on PostgreSQL serialization failures, so concurrent demotions or deletions cannot leave the system without an administrator.
- User deletion cleans `revoked_tokens` and `password_reset_tokens` rows in the same transaction.
- Password recovery answers with the same generic response whether the email exists or not, preventing user enumeration. Recovery tokens are 32 random bytes, stored only as SHA-256 hashes, valid for 15 minutes, single-use, and invalidated when a new link is requested.
- User accounts never expose a password anywhere: initial passwords are generated internally, invitation and notice emails carry only links, and explicit ADMIN passwords travel through their own channel. Invitation tokens are single-use and valid for 24 hours.
- Accounts created or reset by an ADMIN must define a personal password before using the API (`403 PASSWORD_CHANGE_REQUIRED`), and administrator password resets notify the affected user by email without including the new password.
- A successful password reset closes every session issued before the reset through `users.password_changed_at`; the user signs in again with the new password.
- Recovery emails never include passwords, only the one-time link. SMTP secrets live exclusively in the ignored `.env` file and must never be committed; rotate the Gmail app password if it is ever exposed.
- Failed SMTP delivery is logged server-side and never changes the generic HTTP response.
- Expired revoked tokens and expired password reset tokens are removed at startup and every hour.
- The `deepmerge-ts` npm override patches a transitive Prisma CLI vulnerability while preserving Prisma 6 compatibility. Re-run Prisma validation and `npm audit` before changing it.
