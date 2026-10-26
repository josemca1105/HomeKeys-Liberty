# HomeKeys Liberty Backend

Backend API for **HomeKeys Liberty**, built with Node.js, Express, TypeScript, PostgreSQL, and Prisma ORM.

Iteration 1 includes the backend foundation, database migrations, administrator seed, JWT authentication, token revocation, and administrator-managed user creation.

## Tech stack

- Node.js 20+
- Express 5
- TypeScript
- PostgreSQL
- Prisma ORM 6
- Zod
- JSON Web Tokens
- bcrypt

## Features

- Layered architecture: routes → controllers → services → repositories.
- Strict TypeScript configuration.
- English database schema, table names, column names, enums, and source identifiers.
- Spanish user-facing API messages.
- Administrator seed with idempotent execution.
- Secure password hashing with bcrypt and 12 salt rounds.
- One-hour JWT access tokens.
- JWT revocation through SHA-256 token hashes.
- ADMIN authorization for user creation.
- PARTNER as the default user role.
- Centralized validation and error handling.
- Helmet and CORS middleware.
- Postman collection for the main authentication flows.

## Project structure

```text
Back/
├── prisma/
│   ├── migrations/
│   ├── schema.prisma
│   ├── seed.example.ts
│   └── seed.ts # Local only; ignored by Git
├── postman/
│   └── homekeys-liberty-auth.postman_collection.json
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
├── .env.example
├── .gitignore
├── package.json
└── tsconfig.json
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
- User fields include `first_name`, `last_name`, `email`, `password_hash`, `phone`, `photo_url`, and `role`.
- Token fields include `token_hash`, `user_id`, and `expires_at`.
- Roles: `ADMIN` and `PARTNER`.
- Property categories: `House`, `Apartment`, and `Commercial`.
- Property listing types: `Sale` and `Rent`.
- Property statuses: `Active` and `Inactive`.

## Available scripts

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start the development server with file watching. |
| `npm run typecheck` | Run TypeScript checks without emitting files. |
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

## Postman collection

Import:

```text
postman/homekeys-liberty-auth.postman_collection.json
```

Then:

1. Set `adminEmail`, `adminPassword`, and `newUserPassword` using local values. The committed collection contains no real credentials.
2. Run **Login administrator**. The test script stores the JWT in `accessToken`.
3. Run the PARTNER and ADMIN user creation requests.
4. Run **Logout** last.

## Verification commands

```powershell
npm run typecheck
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

## Security notes

- Never commit `.env`, `prisma/seed.ts`, personal data, or real credentials.
- Keep private administrator data only in the ignored local seed; commit only `prisma/seed.example.ts`.
- Use a long, random `JWT_SECRET` for every real environment.
- Change bootstrap passwords before deployment.
- Password hashes and raw revoked tokens are never returned by the API.
- Only SHA-256 token hashes are stored for logout revocation.
- The `deepmerge-ts` npm override patches a transitive Prisma CLI vulnerability while preserving Prisma 6 compatibility. Re-run Prisma validation and `npm audit` before changing it.
