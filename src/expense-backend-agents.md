# Expense Backend Parallel Agent Prompts

## Track A — Data Model / Persistence
Implement `expenses` and `expense_line_items` schema, indexes, constraints, and migration scripts per contract.

## Track B — GraphQL Schema & Resolvers
Implement `adminExpenses`, `adminExpenseById`, mutations and input objects using the shared contract.

## Track C — Domain Logic & Validation
Implement calculations, status transitions, line-item validation (LLM-only rules), and payload normalization.

## Track D — Security + Audit
Add super-admin guard, audit writes, and standardized error payloads.

## Track E — API Tests
Add contract tests for query/list/create/update/status and unauthorized / invalid cases.

Use the expense tab contract currently implemented in frontend files.
