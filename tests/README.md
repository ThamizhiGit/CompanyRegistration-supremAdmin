# Playwright E2E

The mocked project is self-contained:

```sh
npm run test:mocked
```

The read-only integration smoke requires a reachable backend and dedicated
supreme-admin credentials:

```sh
SUPREME_E2E_USERNAME=admin@example.com \
SUPREME_E2E_PASSWORD=secret \
SUPREME_E2E_GRAPHQL_URI=http://localhost:8000/graphql/ \
npm run test:integration
```

`SUPREME_E2E_GRAPHQL_URI` defaults to the local URL shown above. A full
`npm test` run requires both credential variables and runs the mocked E2E
project, integration smoke, and React component tests in sequence.

The integration smoke only reads data and navigates existing pages. It must
not create, edit, refund, or delete backend records.
