# Supreme Dashboard Test Commands

Run all commands from the `supremedashboard` directory.

## Prerequisites

Install dependencies:

```sh
npm install
```

Playwright starts the React application automatically on
`http://localhost:3001`.

The real-backend project requires:

- `SUPREME_E2E_USERNAME`
- `SUPREME_E2E_PASSWORD`
- `SUPREME_E2E_GRAPHQL_URI` — optional locally; defaults to
  `http://localhost:8000/graphql/`

## Main commands

| Command | Purpose |
|---|---|
| `npm test` | Run mocked E2E, real-backend integration, then component tests |
| `npm run test:e2e` | Run both E2E projects |
| `npm run test:mocked` | Run the 28 mocked E2E scenarios only |
| `npm run test:integration` | Run the read-only real-backend smoke |
| `npm run test:ct` | Run all React component tests |
| `npm run lint` | Run the TypeScript validation |

The full test command requires a reachable backend and credentials:

```sh
SUPREME_E2E_USERNAME=admin@example.com \
SUPREME_E2E_PASSWORD=secret \
SUPREME_E2E_GRAPHQL_URI=http://localhost:8000/graphql/ \
npm test
```

The integration smoke is read-only. It logs in, loads dashboard data, and
navigates existing administration pages without creating, editing, refunding,
or deleting records.

## Interactive commands

Open the mocked E2E suite in Playwright UI mode:

```sh
npm run test:ui
```

Debug the mocked E2E suite:

```sh
npm run test:debug
```

Open the component suite in Playwright UI mode:

```sh
npm run test:ct:ui
```

## Targeted test runs

Run one mocked E2E file:

```sh
npx playwright test tests/auth/authentication.spec.ts \
  --project=mocked-chromium
```

Run tests matching a title:

```sh
npx playwright test --project=mocked-chromium \
  --grep="password visibility"
```

Run one component test file:

```sh
npx playwright test component-tests/commerce/plans.spec.tsx \
  --config=playwright-ct.config.ts
```

List discovered E2E and component tests without running them:

```sh
npx playwright test --list
npx playwright test --config=playwright-ct.config.ts --list
```

## Generated results

Playwright writes reports and failure artifacts to:

- `playwright-report/`
- `test-results/`
- `playwright/.cache/`

These generated directories are ignored by Git.
