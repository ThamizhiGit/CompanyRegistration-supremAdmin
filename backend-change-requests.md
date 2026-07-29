# Backend Change Requests (from latest frontend scope)

## 1) Companies
- `adminCompanies` query must support filters:
  - `search`
  - `status`
  - `subscriptionStatus`
  - `dueDateFrom`, `dueDateTo`
  - `recurringDateFrom`, `recurringDateTo`
  - pagination (`limit`, `offset`)
- Company payload must include:
  - `subscriptionStatus`
  - `subscriptionDueDate`
  - `subscriptionRecurringDate`
  - `paymentSummary` (latest status, lastPaymentAt, nextDueDate, totalPaid, outstanding)
- Add company detail update mutation:
  - `adminUpdateCompanyDetail(input: CompanyUpdateInput)`
  - returns updated company + audit metadata
- Add company payment history query:
  - `adminCompanyPaymentHistory(companyId, from, to, status, limit, offset)`
  - include payment intent/reference, amount, status, deniedReason, dueDate, recurringDate, gateway snapshot fields

## 2) Subscriptions / Payments
- `adminPayments` query must support:
  - `status`
  - `companyId`
  - `dateFrom`, `dateTo`
  - `search` (company or email)
- Payment payload must include:
  - `deniedReason`
  - `manualSource`
  - `gatewayMethod`
  - `gatewayRefReceiverMedium`
  - `gatewayRefSenderMedium`
  - `gatewayPayload` (full raw payload JSON)
  - `lastUpdatedBy`
- Add/update mutation for payment actions:
  - `adminUpdatePaymentStatus(paymentIntentId, status, reason?)`
  - `adminRefundPayment(input: PaymentRefundInput)` with reason and optional amount
- Add manual subscription processing mutation:
  - `adminProcessManualSubscription(input: ManualSubscriptionInput)`
  - input includes companyId, source, method, refReceiverMedium, refSenderMedium, payload JSON, note

## 3) Packages
- `adminModules` query must support filters:
  - `search`
  - `active`
  - `offerActive`
  - `currency`
  - `priceMin`, `priceMax`
  - `limit`, `offset`
- Package payload should include:
  - `usersCount`
  - `updatedAt`
  - `updatedBy`
- Add package detail query:
  - `adminModuleDetail(moduleId)` returning users list + change log
- Add/update package offer/test offer mutation:
  - `adminSetModuleOffer(...)` or `adminApplyTestOffer(...)` for preview-safe test flow

## 4) Users
- `adminUsers` query currently remains list/search but should include:
  - `isActive`, `role`, `isCompanyAdmin`, `company`, `location` (for edit form prefill)
- Add user update mutation:
  - `adminUpdateUser(input: UserUpdateInput)`
  - fields: email, firstName, lastName, isActive, isCompanyAdmin, locationId, companyId
- Return updated object + success message

## 5) Infrastructure
- Add finance/infrastructure query:
  - `adminInfrastructureOverview(period)` with
    - `incomeTotal`
    - `expenseTotal`
    - `netIncome`
    - `pendingPayouts`
    - `failedPayouts`
  - optional trend arrays for charts/tables

## 6) User activity logs
- Add activity log query:
  - `adminUserActivityLogs(input: ActivityFilterInput)` with
    - `from`, `to`, `actor`, `action`, `companyId`, `userId`, `targetType`
    - pagination
- Log should return:
  - `id`, `actorName`, `action`, `targetType`, `targetId`, `details`, `createdAt`, `ipAddress`, `userAgent`

## 7) Shared model / behavior
- Add audit logging for:
  - company detail updates
  - package updates/offers
  - user updates
  - payment status updates
  - refunds
  - manual subscription actions
- Keep super-admin auth guard for all new queries/mutations
- Add indexes for performant filtering:
  - company: `(subscription_status, due_date, recurring_date, is_active)`
  - payment: `(company_id, created_at, status)`
  - module: `(active, offer_active, updated_at)`
  - user: `(company_id, is_active)`
  - audit log: `(created_at, actor_id, action)`
