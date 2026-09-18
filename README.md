# Tour Booking API

NestJS backend for a tour booking system (auth, categories, tours, tour schedules, bookings, payments, reviews, admin management). This repository currently contains only the base project scaffold — no business features are implemented yet.

## Stack

- [NestJS](https://nestjs.com/) 11 (Express platform)
- [TypeORM](https://typeorm.io/) + PostgreSQL
- class-validator / class-transformer for DTO validation
- Swagger (`/api-docs`) for API documentation
- Jest for unit and e2e tests

## Project setup

```bash
$ npm install
$ cp .env.example .env
# fill in .env: PORT, DB_HOST, DB_PORT, DB_USERNAME, DB_PASSWORD, DB_NAME

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

## Reference docs

- Functional spec / endpoint list: see the project's shared Google Sheet
- ERD: `tour_booking_erd_v2b.drawio` (Google Drive)
