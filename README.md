# Tour Booking API

NestJS backend for a tour booking system (auth, categories, tours, tour schedules, bookings, payments, reviews, admin management). Currently implemented: register/activate/login/logout/refresh (see [Auth](#auth) below). Everything else on the roadmap (tours, bookings, payments, admin, ...) is not implemented yet.

## Stack

- [NestJS](https://nestjs.com/) 11 (Express platform)
- [TypeORM](https://typeorm.io/) + PostgreSQL
- `@nestjs/jwt` + `@nestjs/passport` for JWT auth — **pinned to the `11.x` line**: `12.x` ships ESM-only and breaks this project's CommonJS/ts-jest setup (`Must use import to load ES Module`). Do not bump past `11.x` without also moving the test setup to ESM.
- class-validator / class-transformer for DTO validation
- `nestjs-i18n` for i18n (en/vi) — translation files in `src/i18n/<lang>/*.json`; pick a language with `?lang=vi` or the `Accept-Language` header, falls back to `en`
- Swagger (`/api-docs`) for API documentation
- Jest for unit and e2e tests

## Project setup

```bash
$ npm install
$ cp .env.example .env
# fill in .env: PORT, DB_HOST, DB_PORT, DB_USERNAME, DB_PASSWORD, DB_NAME,
# JWT_SECRET (16+ chars), JWT_ACCESS_TOKEN_TTL_SECONDS, REFRESH_TOKEN_TTL_DAYS,
# ACTIVATION_TOKEN_TTL_HOURS — all validated at startup (src/config/env-validation.schema.ts);
# the app refuses to boot if any is missing/blank/invalid instead of failing silently later

$ docker compose up -d   # starts a local Postgres instance
```

## Compile and run the project

```bash
# development
$ npm run start

# watch mode
$ npm run start:dev

# production mode
$ npm run start:prod
```

## Database migrations

```bash
$ npm run migration:generate -- src/database/migrations/<Name>
$ npm run migration:run
$ npm run migration:revert
```

## Run tests

E2e tests run against a dedicated `tour_booking_test` database (separate from your dev database), configured via `.env.test`. Before running them the first time:

```bash
$ cp .env.test.example .env.test
# fill in .env.test the same way you filled in .env, using tour_booking_test as DB_NAME
```

`npm run test:e2e` automatically creates the test database and runs migrations against it (via a `pretest:e2e` hook) before each run.

```bash
# unit tests
$ npm run test

# e2e tests
$ npm run test:e2e

# test coverage
$ npm run test:cov
```

## Lint & format

```bash
$ npm run lint        # eslint --fix
$ npm run lint:check  # eslint, no fix (used in CI)
$ npm run format      # prettier --write
```

## CI

GitHub Actions (`.github/workflows/ci.yml`) runs on every push/PR to `master`/`main`:

- `lint-build-test`: install, lint check, build, unit tests
- `e2e`: spins up a Postgres service container, runs migrations, runs e2e tests

## Auth

Implemented so far:

- `POST /api/v1/auth/register` — body `{ email, password, fullName, phone }`, creates the user with `status: 'inactive'` and returns `{ id, email, fullName, role, status }` (`201`). Fails with `400 VALIDATION_ERROR` or `409 EMAIL_ALREADY_EXISTS` (checked case-insensitively). There is no mail infrastructure yet, so **outside production** the response also includes `activationToken` directly — use it against `GET /auth/activate` to test the flow locally. This field is omitted entirely when `NODE_ENV=production` (see `AuthService.register()`); a real deployment needs an actual mailer wired in before going live.
- `GET /api/v1/auth/activate?token=<token>` — sets `status: 'active'` and `emailVerifiedAt`, returns `{ status: 'ACTIVATED' }`. Fails with `400 TOKEN_INVALID_OR_EXPIRED` or `409 ALREADY_ACTIVATED`. A user cannot log in until activated (`login` returns `403 USER_INACTIVE` otherwise).
- `POST /api/v1/auth/login` — body `{ email, password }`, returns `{ accessToken, tokenType, expiresIn }` and sets an httpOnly `refresh_token` cookie. Fails with `401 INVALID_CREDENTIALS` (unknown email / OAuth-only account / wrong password) or `403 USER_INACTIVE`.
- `POST /api/v1/auth/logout` — requires `Authorization: Bearer <accessToken>`; revokes the session tied to the `refresh_token` cookie (so it can no longer be used to refresh) and clears the cookie. Returns `204`. Note: the access token itself is a short-lived, stateless JWT (`JWT_ACCESS_TOKEN_TTL_SECONDS`, 900s by default) and is **not** individually invalidated on logout — it keeps working until it naturally expires. Deactivating a user (`status != 'active'`) does immediately block that user's existing access tokens, since `JwtStrategy` re-checks status on every request.
- `POST /api/v1/auth/refresh` — no `Authorization` header needed, only the `refresh_token` cookie. Atomically rotates the session (old one revoked, a new one issued — safe under concurrent replay) and returns a fresh `{ accessToken, tokenType, expiresIn }` + a new `refresh_token` cookie. Fails with `401 REFRESH_TOKEN_INVALID` (missing/unknown cookie), `401 SESSION_REVOKED_OR_EXPIRED` (already used/logged out/expired — each refresh token is single-use), or `403 USER_INACTIVE`.

Social login (`AUTH-05`/`AUTH-06`) is not implemented yet.

## Reference docs

- Functional spec / endpoint list: see the project's shared Google Sheet
- ERD: `tour_booking_erd_v2b.drawio` (Google Drive)
