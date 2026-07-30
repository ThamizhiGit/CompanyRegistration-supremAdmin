# Supreme Dashboard

## Super-Admin User Manual

**Audience:** Authorized super-admin operators  
**Edition:** 1.0  
**Last verified:** 29 July 2026  
**Application scope:** Supreme Dashboard browser interface

> **Purpose.** This manual explains how to operate the Supreme Dashboard safely. It covers the screens and controls available to a signed-in super administrator. It does not contain installation, programming, API, or deployment instructions.

---

## Contents

1. [About this manual](#1-about-this-manual)
2. [Access and session behavior](#2-access-and-session-behavior)
3. [Workspace and navigation](#3-workspace-and-navigation)
4. [Dashboard](#4-dashboard)
5. [Plans and promo codes](#5-plans-and-promo-codes)
6. [Companies and Company 360](#6-companies-and-company-360)
7. [Subscriptions and payments](#7-subscriptions-and-payments)
8. [Users and user activity](#8-users-and-user-activity)
9. [Accounts and infrastructure](#9-accounts-and-infrastructure)
10. [Expense administration](#10-expense-administration)
11. [Monthly and annual reports](#11-monthly-and-annual-reports)
12. [Search, filters, sorting, export, and print](#12-search-filters-sorting-export-and-print)
13. [Common operating workflows](#13-common-operating-workflows)
14. [Safe operation and audit reasons](#14-safe-operation-and-audit-reasons)
15. [Troubleshooting](#15-troubleshooting)
16. [Reachable features and known UI limitations](#16-reachable-features-and-known-ui-limitations)
17. [Quick-reference glossary](#17-quick-reference-glossary)

---

## 1. About this manual

### 1.1 What Supreme Dashboard is

Supreme Dashboard is the browser-based operations console for platform-wide administration. A super-admin operator can review commercial and financial health, manage plans and promo codes, inspect companies, administer subscriptions and payments, maintain cross-company users, record expenses, and produce period reports.

The interface is intended for trusted operators. Many actions affect customer access, billing records, pricing, or financial reporting. Use a named super-admin account, verify the target record before saving, and enter an audit reason that explains the business event.

### 1.2 What this manual covers

This manual documents the currently reachable interface:

| Navigation area | Primary purpose |
|---|---|
| Dashboard | Review platform totals and payment-status distribution. |
| Plans | Maintain pricing plans and checkout promo codes. |
| Companies | Search companies, edit plan/subscription details, and open Company 360. |
| Subscriptions | Review payments and perform payment, due-date, suspension, resumption, and manual-payment actions. |
| Users | Search and edit users across companies and review activity for a selected user. |
| Accounts | Review infrastructure finances, administer expenses, and generate monthly or annual reports. |

### 1.3 Roles and responsibility

The signed-in identity is displayed as **Super Admin**. The interface does not provide a lower-privilege operator mode. Your organization should therefore control who receives credentials and which procedures require a second reviewer.

Recommended responsibilities are:

- **Commercial operations:** plans, promo codes, companies, and subscriptions.
- **Finance operations:** payments, refunds, expenses, infrastructure totals, and reports.
- **Identity operations:** user status and company-admin role changes.
- **Review or approval:** high-impact changes such as refunds, suspensions, plan deletion, and paid-expense transitions.

The application may permit one person to perform all of these actions. That technical ability is not a substitute for your organization’s approval policy.

### 1.4 Conventions used in this manual

- **Select** means click or tap.
- **Save** means submit the current dialog or form to the service.
- **Current result set** means the records returned to and displayed by the current screen. Some filters do not search beyond that set.
- A **toast** is the short success or error message shown after an action.
- Money shown in the interface is formatted as currency. Confirm the currency before approving or comparing values.
- Screenshots were captured from a seeded documentation environment. Names, dates, identifiers, and amounts are illustrative; use the values in your authorized environment when performing an action.

---

## 2. Access and session behavior

### 2.1 Before signing in

You need:

- the Supreme Dashboard address for your environment;
- an active super-admin username;
- the matching password; and
- browser access to the dashboard and its service.

Do not share credentials or store them in a shared browser profile. Use the environment intended for the action; production changes cannot be undone simply by switching back to a test environment.

### 2.2 Sign in

![Supreme Dashboard sign-in page with username and password fields](screenshots/01-login.png)

*Figure 1. Sign-in page for a Supreme Dashboard super administrator.*

1. Open the dashboard address.
2. Enter your **Username** and **Password**.
3. Use the eye control if you need to verify the password characters.
4. Select **Sign In**.
5. Confirm that the dashboard opens and that your username appears in the account area.

The username and password cannot be blank. The dashboard removes leading and trailing spaces from the username, but not from the password.

Possible sign-in messages include:

| Message or behavior | Meaning and response |
|---|---|
| Enter your username and password | Complete both fields. |
| Login failed / check your credentials | Re-enter the credentials and verify the intended environment. |
| This super admin account is inactive | Ask an authorized identity administrator to review the account. |
| Authentication returned an empty response | The service did not return a usable authentication result; retry once, then escalate. |
| Immediate return to sign-in | The session may already be expired or rejected by the service. |

### 2.3 Session expiration

The dashboard keeps the authenticated session in the current browser tab. When the service supplies an expiration time, the application tracks it internally and ends the session when it expires. The current interface does not display the remaining time.

Important session behavior:

- The session is tab-scoped. A separately opened tab may require another sign-in.
- Closing the tab ends access to that tab’s stored session.
- When the expiration time is reached, the dashboard clears the session and returns to sign-in.
- A rejected or expired authorization response can also end the session automatically.
- The selected navigation page is not remembered. Refreshing an authenticated tab returns to **Dashboard**.

A session expiring during a multi-step financial change may leave you uncertain whether the service accepted the action. In that case, sign in again and verify the record before repeating anything.

### 2.4 Sign out

Use either of these controls:

- Select **Settings** in the left navigation, then **Sign out**.
- Open the account menu in the upper-right corner, then select **Sign Out**.

Sign out when:

- leaving the workstation;
- handing the browser to another person;
- finishing work in a shared or temporary environment; or
- switching between test and production identities.

### 2.5 Account menu

The account menu displays:

- your username;
- the **Super Admin** access label;
- **View Profile**, which expands a small username/access summary; and
- **Sign Out**.

The profile view is informational. The current interface does not provide profile editing or password changes.

---

## 3. Workspace and navigation

### 3.1 Main navigation

The left navigation contains:

1. Dashboard
2. Plans
3. Companies
4. Subscriptions
5. Users
6. Accounts

Select an item to replace the main content. The application does not use page-specific browser addresses, so the browser Back button is not a reliable way to move between these areas.

### 3.2 Desktop navigation

On desktop:

- use the arrow control beside the navigation panel to collapse or expand it;
- when collapsed, icons remain available and their labels appear as control titles;
- the **Settings** control sits at the bottom; and
- the page content scrolls independently within the main area.

### 3.3 Mobile or narrow-screen navigation

![Supreme Dashboard mobile navigation drawer showing the six destinations](screenshots/21-mobile-navigation.png)

*Figure 2. Mobile navigation drawer with the available administration destinations.*

On a narrow screen:

1. Select the menu control in the header.
2. Choose a destination from the slide-out navigation.
3. The navigation closes after a destination is chosen.

You can also close it with the close control, the shaded page overlay, or the **Escape** key. Wide tables may require horizontal scrolling. For payment and company work, a desktop-width browser is recommended because more columns and action controls are visible at once.

### 3.4 Keyboard behavior

The interface includes keyboard focus behavior for menus and dialogs:

- **Escape** closes the mobile navigation and open account/settings menus.
- Tab focus is kept inside the open mobile navigation until it is closed.
- Filter popovers and other overlays can usually be dismissed with **Escape** or a click outside.

Before activating an icon-only action from the keyboard, confirm its visible tooltip or accessible label, such as **View**, **Edit**, or **View Activity**.

### 3.5 Messages and unsaved work

Administrative actions report results through short success or error toasts. A toast normally disappears automatically and can be dismissed early.

Do not treat a closed dialog as proof that an action succeeded. Look for the success toast and confirm that the updated value appears after the list refreshes. Closing a create or edit form without saving discards the changes in that form.

---

## 4. Dashboard

### 4.1 Purpose

The Dashboard gives a concise platform-wide snapshot. Use it for operational awareness and anomaly detection, not as the only source for reconciliation.

![Dashboard with company, user, payment, revenue, expense, and payment-status summaries](screenshots/02-dashboard-overview.png)

*Figure 3. Dashboard overview and payment-status breakdown.*

### 4.2 Summary cards

The dashboard can show:

| Card | Interpretation |
|---|---|
| Companies | Total company count returned by the service. |
| Users | Total user count across companies. |
| Payments | Total payment count. |
| Gross Revenue | Gross revenue value supplied by the service. |
| Total Expenses | Total expense value; older services may return no value, in which case the UI displays zero. |
| Net Revenue | Net value supplied by the service, or gross revenue minus total expenses when net is absent. |

Net Revenue uses a positive or negative color treatment. Always review the date and reporting scope established by your organization; the card itself does not expose a date-range selector.

### 4.3 Payment Status Breakdown

When status data is available, the table shows:

- payment status;
- number of payments in that status; and
- total amount for that status.

Typical statuses include **succeeded**, **pending**, and **failed**. Additional service-defined statuses may appear.

### 4.4 Daily dashboard check

For a routine start-of-day review:

1. Record or compare the company and user totals against the previous operational checkpoint.
2. Review gross revenue, expenses, and net revenue for unexpected movement.
3. Scan failed and pending payment counts and amounts.
4. Open **Subscriptions** to investigate individual overdue, pending, or failed items.
5. Open **Accounts** when the net movement appears expense-driven.

### 4.5 Dashboard limitations

- There is no date filter or manual refresh button on this page.
- Dashboard totals depend on the service’s reporting scope.
- A missing expenses value is treated as zero for display compatibility.
- A missing net value is calculated in the browser.
- The status breakdown is a summary; use Subscriptions for individual payment records.

---

## 5. Plans and promo codes

### 5.1 Purpose and tabs

The **Plans & Pricing** area contains two tabs:

- **Plans** for recurring product/pricing definitions.
- **Promo Codes** for controlled discounts.

Changing pricing can affect future checkout and billing behavior. Confirm the intended environment, currency, interval, and activation state before saving.

### 5.2 Browse plans

![Plans page in board view showing Free and Premium plan cards](screenshots/03-plans-list.png)

*Figure 4. Plans board view with search, filters, export, print, and plan actions.*

The Plans tab supports:

- plan search;
- active/inactive status filtering;
- card and table views;
- sortable table fields;
- spreadsheet-compatible export;
- browser printing;
- create, edit, and delete actions.

Card view is useful for product comparison. Table view is better for scanning identifiers, prices, intervals, status, and actions.

### 5.3 Create a plan

1. Open **Plans** and remain on the **Plans** tab.
2. Select **Create Plan**.
3. Enter a stable **Plan ID** and a clear **Name**.
4. Enter price and currency values.
5. Select **Monthly** or **Yearly** billing.
6. Configure per-employee pricing, trial months, employee limit, features, recommendation, active state, and sort order as required.
7. Review the full form.
8. Select **Create** or **Save**.
9. Confirm the success toast and locate the plan in the refreshed list.

The Plan ID and name are required. Leave an employee limit blank only when the product definition is intended to be unlimited.

### 5.4 Edit a plan

![Edit Plan dialog with pricing, interval, limits, description, and features](screenshots/03b-plan-edit-form.png)

*Figure 5. Plan editor with commercial settings and feature definitions.*

1. Locate the plan in card or table view.
2. Select its edit action.
3. Make the required changes.
4. Recheck price, currency, billing interval, active state, and feature list.
5. Save and confirm the success toast.

For a price change, record the commercial approval outside the dashboard if your organization requires it. The current edit form does not ask for a change reason.

### 5.5 Delete a plan

1. Locate the exact plan.
2. Select its delete action.
3. Enter a meaningful reason in the browser prompt.
4. Submit the prompt.
5. Confirm the success toast and that the plan no longer appears.

Do not delete a plan merely to stop new sales if historical subscriptions still reference it. Prefer deactivation when business policy permits. The interface requires a deletion reason, but the service decides whether deletion is allowed.

### 5.6 Plan fallback warning

If plan data cannot be loaded or the result is empty, the interface can display built-in **Free** and **Premium** plan cards. These are fallback display values; they are not proof that matching plan records exist in the service.

When you suspect fallback data:

- do not rely on the cards for reconciliation;
- retry or confirm service availability;
- verify existing subscriptions independently; and
- do not assume that save or delete actions will work.

### 5.7 Browse promo codes

![Promo Codes tab listing discount, applicability, limits, window, status, and actions](screenshots/04-promo-codes-list.png)

*Figure 6. Promo Codes list and its primary controls.*

Open the **Promo Codes** tab to:

- search by code or descriptive fields;
- filter visible values;
- create a promo code;
- edit an existing code; and
- deactivate a code with a required reason.

### 5.8 Create or edit a promo code

![Create Promo Code dialog with discount and applicability controls](screenshots/05-promo-code-create-form.png)

*Figure 7. Promo-code form for discount, validity, redemption limits, and plan scope.*

1. Select **Create Promo Code**, or use the edit action for an existing code.
2. Enter a recognizable code and optional description.
3. Choose the discount type:
   - **Percent:** value must be from 1 through 100.
   - **Fixed amount:** value must be greater than zero.
4. Configure start/end dates and active state.
5. Set any total, per-email, and per-company redemption limits.
6. Set a minimum purchase value if required.
7. Select at least one applicable paid plan.
8. Select monthly and/or yearly applicability.
9. Enable the first-time-customer restriction when required.
10. Save and confirm the success toast.

Codes are normalized to uppercase after a successful save. Check that the start time, end time, plan scope, and billing interval express the promotion agreement.

### 5.9 Deactivate a promo code

1. Find the code.
2. Select its deactivate action.
3. Enter a specific reason, such as the campaign end, abuse response, or correction.
4. Submit and confirm the success toast.

Deactivation is the available removal workflow in the current Promo Codes UI. Review active customer commitments before ending a promotion.

---

## 6. Companies and Company 360

### 6.1 Companies list

Use **Companies** to review cross-platform company records. The list supports:

![Companies page with search, filters, plan and subscription columns, and row actions](screenshots/06-companies-list.png)

*Figure 8. Companies list with subscription context and record actions.*

- free-text search across company, email, and payment-related text;
- column filters;
- three-state sorting;
- export and print;
- edit; and
- Company 360 view.

The table includes commercial and subscription context such as plan, effective status, due/recurring dates, and latest gateway information when supplied.

### 6.2 Effective versus recorded status

The list can derive an effective status from the latest payment:

- latest payment **succeeded** → effective status **active**;
- another latest-payment status → that payment status;
- no latest-payment status → recorded subscription status, or **trial** when none exists.

Company 360’s Subscription tab shows both effective and recorded context. When they differ, investigate payment timing and service processing before changing the record.

### 6.3 Edit company details

![Edit Company dialog with plan, subscription status, dates, and status-change reason](screenshots/06b-company-edit-form.png)

*Figure 9. Company editor with plan, status, billing dates, and audit reason.*

1. Search for and verify the company.
2. Select **Edit**.
3. Update the company name, plan, subscription status, billing dates, or multi-location setting as authorized.
4. If the subscription status changed, enter a business reason.
5. Review the plan/status synchronization hints.
6. Save.
7. Confirm the success toast and reopen Company 360 to verify the result.

Available subscription statuses are:

| Status | Intended interpretation |
|---|---|
| Trial | Temporary access before paid activation. |
| Active | Paid or approved subscription access. |
| Pending | Payment or approval remains in progress. |
| Past due | Payment is overdue or needs attention. |
| Suspended | Access is temporarily blocked or limited. |
| Failed | The latest subscription payment failed. |
| Refunded | The subscription payment was refunded. |
| Canceled | Subscription access is canceled. |

### 6.4 Plan and date rules

The interface applies these operator guardrails:

- Selecting the Free plan clears billing dates and uses Active status.
- Moving from Free to Premium initially uses Trial status.
- Paid subscription statuses are associated with the Premium plan.
- Trial, Active, Pending, and Past due Premium subscriptions require both due and recurring dates.
- The recurring date must be later than the due date.
- Changing status requires a reason before saving.

These checks improve data quality. They do not replace service-side approval, validation, or audit storage.

### 6.5 Open Company 360

1. Locate the company.
2. Select its view action.
3. Use the tabs:
   - **Overview**
   - **Subscription**
   - **Payment History**

Company 360 is the preferred place to gather context before changing a company or refunding a payment.

### 6.6 Company 360: Overview

Overview presents company identity and operating context, including:

![Company 360 Overview tab with company identity and latest payment panels](screenshots/07-company-360-overview.png)

*Figure 10. Company 360 Overview for identity, plan, employee, and latest-payment context.*

- company and contact information;
- assigned plan;
- multi-location model;
- employee count; and
- latest-payment details when available.

Use it to confirm you have the correct company before moving to payment or subscription actions.

### 6.7 Company 360: Subscription

Subscription presents:

![Company 360 Subscription tab with effective and recorded status and billing dates](screenshots/08-company-360-subscription.png)

*Figure 11. Company 360 Subscription tab with status and schedule context.*

- effective status;
- recorded status;
- trial end;
- next billing information;
- due date; and
- recurring date.

If the status and dates are inconsistent, do not “correct” one field in isolation. Review the payment history and the business event that should have produced the state.

### 6.8 Company 360: Payment History

The Payment History tab supports:

![Company 360 Payment History tab with filters and payment rows](screenshots/09-company-360-payment-history.png)

*Figure 12. Company 360 Payment History with status and date-range filters.*

- payment-status filtering;
- a date range, including common date presets;
- payment detail;
- payment-status update;
- refund request;
- gateway detail; and
- manual subscription action.

Select a payment to open its details. Confirm payment intent, amount, currency, customer, status, and gateway context before using an action.

### 6.9 Request a refund

![Payment Detail dialog showing transaction information and refund controls](screenshots/10-company-payment-detail.png)

*Figure 13. Company payment detail and refund-request controls.*

1. Open the correct company and **Payment History**.
2. Select the exact payment.
3. Confirm payment intent, original amount, currency, and status.
4. Enter a refund reason.
5. For a partial refund, enter the refund amount in the displayed major currency unit, such as dollars.
6. Submit the refund request.
7. Confirm the success toast.
8. Refresh or reopen the payment and verify the resulting status and amount.

The interface converts the entered amount to the service’s minor unit. Always verify decimal placement. A blank amount can represent a full refund request, depending on service behavior. A refund request is not necessarily a completed gateway refund; follow your organization’s reconciliation procedure.

### 6.10 Manual subscription action in Company 360

The payment detail can submit a manual action using:

- source;
- payment method;
- receiver medium;
- sender medium; and
- reason or notes.

Use this only to record a real, independently verified event. Include identifiers such as check number or settlement reference when available, and never store full card data or passwords in free-text fields.

---

## 7. Subscriptions and payments

### 7.1 Purpose

The **Subscriptions & Payments** page is the main cross-company payment work queue. It combines payment records with company names when a valid company link is available and removes duplicate rows with the same payment-intent ID.

### 7.2 Find a payment

Use the search box for company, plan, email, payment, status, or gateway text. You can also:

![Subscriptions and Payments page with search, column filters, exports, and payment rows](screenshots/11-subscriptions-list.png)

*Figure 14. Cross-company Subscriptions and Payments work queue.*

- open the filter row;
- choose values for visible columns;
- sort table columns;
- enable the overdue-only control for non-succeeded overdue rows; and
- export or print the current list.

Search first by payment intent or company/email when handling a customer case. Avoid selecting a row based only on a similar company name.

### 7.3 View payment detail

![Subscription Payment Detail dialog with company, payment, billing, and gateway information](screenshots/12-subscription-payment-detail.png)

*Figure 15. Read-only subscription payment detail for case investigation.*

Select the view action to inspect:

- payment intent;
- company and payer details;
- plan;
- amount and currency;
- payment and subscription status;
- dates;
- gateway reference information; and
- failure or denial context when supplied.

Use view mode for fact gathering. Use edit mode only when an approved operational change is required.

### 7.4 Change payment status

![Subscription payment action dialog with payment status, due date, suspension, resume, and manual-payment controls](screenshots/12b-subscription-payment-actions.png)

*Figure 16. Subscription action workspace for approved payment and company changes.*

1. Open the payment’s edit action.
2. Review the original status and payment intent.
3. Select the intended status.
4. Submit the status change.
5. Confirm the success toast.
6. Verify the refreshed row and the linked company state.

Changing a payment status can affect how a company appears elsewhere. Do not use it to imitate a gateway success unless the settlement has been independently confirmed.

### 7.5 Change a subscription due date

1. Open edit mode for a payment linked to the company.
2. Enter a valid due date and time.
3. Enter the reason for the change.
4. Submit.
5. Confirm the success toast and recheck the company.

A payment row without a company ID cannot perform company-level actions. In that case, correct the upstream linkage through the approved data process rather than choosing another company.

### 7.6 Suspend a company

1. Open edit mode for a payment linked to the company.
2. Select a suspension scope:

| Scope | Operational meaning |
|---|---|
| `billing_only` | Restrict billing-related operation. |
| `feature_limited` | Limit platform features. |
| `full_access_block` | Block full access. |

3. Enter a specific reason.
4. Optionally enter an end date/time.
5. Submit.
6. Confirm the success toast and verify the company state.

Use the least disruptive scope that satisfies the approved action. Confirm communications and escalation ownership before applying a full-access block.

### 7.7 Resume a company

1. Open edit mode for a linked payment.
2. Enter the reason access should be restored.
3. Submit **Resume Company**.
4. Verify the success toast and company status.

Resumption does not guarantee that unrelated payment failures or past-due dates have been corrected. Review those items separately.

### 7.8 Record a manual payment

Manual payment methods currently include **PayPal**, **check**, and **cash**.

![Manual Payment section with method, receiver, sender, reason, and note fields](screenshots/12c-subscription-manual-payment.png)

*Figure 17. Manual-payment entry for a verified offline payment.*

1. Confirm the funds or instrument using the approved external evidence.
2. Open the linked payment in edit mode.
3. Select the manual payment method.
4. Enter receiver and sender references when available.
5. Enter the required reason.
6. Add an optional administrative note without sensitive payment credentials.
7. Submit.
8. Confirm the success toast and verify the refreshed record.

Never use manual payment to bypass a declined electronic payment. The entry should match a real received payment and your organization’s reconciliation records.

### 7.9 Overdue review

For a focused overdue queue:

1. Open **Subscriptions**.
2. Enable the overdue-only control.
3. Add status, due-date, company, or plan filters as needed.
4. Open each result and confirm the due date and current payment state.
5. Decide whether to contact, adjust the due date, suspend, or take no action according to policy.
6. Export the reviewed set if a working file is required.

---

## 8. Users and user activity

### 8.1 Users list

The Users page covers users across companies. Search accepts name, email, or username. Column filters can narrow:

![Users page with search, column filters, roles, statuses, and actions](screenshots/13-users-list.png)

*Figure 18. Cross-tenant Users list and record actions.*

- name;
- email;
- username;
- company;
- location;
- role; and
- active state.

The list does not provide user creation or deletion.

### 8.2 Edit a user

![Edit User dialog with identity, company-admin role, active state, and reason](screenshots/14b-user-edit-form.png)

*Figure 19. User editor for profile, authority, active state, and change reason.*

1. Find the user by a unique identifier such as email or username.
2. Confirm company and location.
3. Select **Edit User**.
4. Update the permitted fields:
   - first name;
   - last name;
   - email;
   - username;
   - company-admin role; and
   - active state.
5. Save.
6. Confirm the success toast and recheck the row.

Role or active-state changes can remove access or elevate authority. Use a verified request and consider a second review for company-admin promotion.

### 8.3 View activity for a user

![User Activity dialog listing dated actions and event details](screenshots/14-user-activity.png)

*Figure 20. Activity history scoped to a selected user.*

1. Locate the user.
2. Select **View Activity**.
3. Review the dialog’s formatted summary, actor, target, company, and detail fields.
4. Close the dialog when finished.

The activity dialog is filtered to the selected user using the event’s user or direct target identifiers. It is useful for case investigation but is not a complete platform-wide audit console.

### 8.4 Activity interpretation

When reviewing an event:

- **Actor** is the identity recorded as performing the action.
- **Target** is the object or user affected.
- **Company** provides tenant context.
- **Details** can contain structured or serialized information.

Treat blank fields as unavailable, not as proof that no actor or target existed. Preserve event identifiers and timestamps in any escalation.

### 8.5 Global activity-log limitation

A standalone, filterable activity-log screen exists as an internal component, but it is not linked from the current Supreme Dashboard navigation. Operators can view activity for an individual user only through **Users → View Activity**. Do not expect a separate **Activity Log** destination.

---

## 9. Accounts and infrastructure

### 9.1 Accounts tabs

Accounts contains:

1. **Overview**
2. **Expenses**
3. **Monthly Reports**
4. **Annual Reports**

Use Overview for a high-level financial pulse, Expenses for the operational expense ledger, and Reports for time-bucketed output.

### 9.2 Infrastructure Overview

The Overview tab displays infrastructure finance. Select one of:

![Accounts Overview tab showing infrastructure income, expense, net, pending balance, and daily trend](screenshots/15-accounts-overview-infrastructure.png)

*Figure 21. Accounts infrastructure overview for the selected reporting period.*

- 7 days;
- 30 days;
- 90 days; or
- all time.

The summary includes:

- income;
- expense;
- net;
- pending balance;
- failed refund count; and
- daily trend rows.

### 9.3 Interpret infrastructure values

- **Income** is the service-supplied inflow for the selected period.
- **Expense** is the service-supplied outflow.
- **Net** is income minus expense or the corresponding service value.
- **Pending balance** represents unsettled value according to the service.
- **Failed refunds** indicate refund attempts or records requiring attention.

Use the daily trend to identify when a change occurred. Then investigate individual payment or expense records in the relevant areas.

### 9.4 Reconciliation check

1. Select the intended period.
2. Compare income, expense, net, and pending balance with your finance checkpoint.
3. Review the daily trend for spikes or gaps.
4. Investigate expense-driven variance in **Expenses**.
5. Investigate income, pending, or refund variance in **Subscriptions** and Company 360.
6. Export a Monthly or Annual Report when a shareable period table is required.

---

## 10. Expense administration

### 10.1 Expense list

The Expenses tab supports:

![Expenses tab with totals, search, filters, pagination, and expense rows](screenshots/16-expenses-list.png)

*Figure 22. Expense work queue and visible-page summaries.*

- server-assisted search;
- sorting by date, total, or status;
- page sizes of 10, 20, or 50;
- previous/next paging;
- filters on the records loaded for the current page;
- visible-page summary counts and totals;
- create, view, edit, and status actions.

The expense list is paginated. A column filter can exclude rows only from the loaded page and should not be treated as a global ledger query.

### 10.2 Create an expense

![Create Expense dialog with basic fields, line item, tax, and calculated totals](screenshots/17-expense-create-form.png)

*Figure 23. Expense creation form with a representative line item.*

1. Open **Accounts → Expenses**.
2. Select **Create Expense**.
3. Complete the required basics:
   - title;
   - category;
   - vendor;
   - expense date;
   - currency; and
   - at least one line item.
4. Add optional project, service, invoice, due-date, link, tags, notes, and metadata fields as applicable.
5. Enter tax as a non-negative major-unit amount.
6. Review line-item quantity, unit price, and computed totals.
7. Select the intended initial status.
8. Save.
9. Confirm the success toast and locate the record.

The interface uses monetary input in the displayed major unit and converts it for storage. Verify decimal placement and currency.

### 10.3 Categories and line types

Expense categories include:

- hosting;
- service;
- integration;
- LLM; and
- other.

Line-item types include:

- hosting;
- service;
- integration;
- LLM;
- custom; and
- other.

An LLM line requires:

- provider;
- model;
- non-negative input-token count; and
- non-negative output-token count.

### 10.4 Line-item rules

For every line item:

- label is required;
- quantity must be greater than zero;
- unit price cannot be negative;
- unit and notes are optional; and
- remove unused empty line rows before saving.

The form calculates subtotal, non-negative tax, and total. Confirm the computed total against the invoice or receipt.

### 10.5 Duplicate warning

The form checks for a possible duplicate against the currently loaded expense page. It compares combinations of title, vendor, category, date, total, and first-line label.

Because the check covers only records already loaded in the current result set:

- search by vendor and date before entering a recurring invoice;
- check adjacent pages when appropriate;
- use invoice numbers consistently; and
- do not assume that the absence of a warning proves uniqueness.

### 10.6 View and edit an expense

![Expense Detail dialog showing reference, status, vendor, dates, totals, and line items](screenshots/16b-expense-detail.png)

*Figure 24. Read-only expense detail used for evidence review.*

Use **View** to inspect:

- reference and status;
- vendor/category;
- dates and totals;
- line items;
- optional metadata and references.

Use **Edit** to correct permitted fields. After saving, verify the list and reopen details. Preserve original evidence according to your finance policy; editing a record is not a replacement for retaining the invoice.

![Edit Expense dialog with expanded optional details and line-item fields](screenshots/18-expense-edit-form.png)

*Figure 25. Expense editor with optional references, metadata, and line-item values.*

### 10.7 Expense status workflow

The interface permits these transitions:

| Current status | Allowed next status |
|---|---|
| Draft | Pending, Rejected, Archived |
| Pending | Approved, Rejected, Archived |
| Approved | Paid, Archived |
| Paid | Archived |
| Rejected | Draft, Archived |
| Archived | Draft |

Recommended interpretation:

- **Draft:** entry is incomplete or under preparation.
- **Pending:** ready for review.
- **Approved:** approved for payment or recognition.
- **Paid:** settlement is confirmed.
- **Rejected:** declined or returned for correction.
- **Archived:** removed from the active workflow while retained as a record.

### 10.8 Expense approval safety

Before moving an expense to Approved or Paid:

1. Match vendor, invoice number, date, currency, and amount.
2. Review every line item and tax.
3. Confirm the evidence link or retained source document.
4. Check for duplicates beyond the visible page.
5. Confirm approval or settlement outside the dashboard when your policy requires it.
6. Change the status and recheck the result.

The current status controls do not ask the operator for a reason. Record approval evidence in the authorized external workflow and ensure the service’s audit record meets organizational requirements.

---

## 11. Monthly and annual reports

### 11.1 Monthly Reports

![Monthly Reports tab with year, month, grouping, summary cards, and daily rows](screenshots/19-monthly-accounts-report.png)

*Figure 26. Monthly account report grouped day by day.*

1. Open **Accounts → Monthly Reports**.
2. Enter the year.
3. Select the month.
4. Choose:
   - **Day wise**, or
   - **Week wise**.
5. Select **Refresh** when you want to explicitly reload.
6. Review income, expense, net, and pending balance.
7. Sort the detail rows if needed.
8. Select **Excel** or **PDF** for output.

### 11.2 Annual Reports

![Annual Reports tab with year, grouping, summary cards, and monthly rows](screenshots/20-annual-accounts-report.png)

*Figure 27. Annual account report grouped month by month.*

1. Open **Accounts → Annual Reports**.
2. Enter the year.
3. Choose:
   - **Month wise**, or
   - **Week wise**.
4. Refresh and review the summary and rows.
5. Export or print as required.

### 11.3 Report table

The table supports three-state sorting for:

- period label;
- income;
- expense; and
- net.

Selecting a heading cycles through ascending, descending, and unsorted states.

### 11.4 Excel output

The **Excel** button downloads a spreadsheet-compatible `.xls` file containing the report totals and visible sorted detail rows. It is HTML-formatted content with an `.xls` filename. Spreadsheet software may display a format warning; open it only when it came from the dashboard you intended to use.

### 11.5 PDF output

The button labeled **PDF** opens a browser print view. It does not directly generate a PDF file.

To save a PDF:

1. Allow the dashboard to open a new window.
2. In the browser print dialog, choose **Save as PDF**.
3. Review page size, orientation, margins, and row fit.
4. Save with a controlled filename.
5. Open the saved PDF and verify the reporting period and totals before sharing.

If nothing opens, allow pop-ups for the dashboard and try once more.

---

## 12. Search, filters, sorting, export, and print

### 12.1 Search

Search behavior differs by page:

| Page | Typical search scope |
|---|---|
| Plans | Plan identifiers and names returned by the plan query. |
| Promo Codes | Code and descriptive promo fields in the returned list. |
| Companies | Company, email, and payment-related text; search is included in the company request. |
| Subscriptions | Company, email, payment, status, plan, and gateway text. |
| Users | Name, email, and username. |
| Expenses | Search is included in the paginated expense request. |

Use exact identifiers—payment intent, username, email, invoice number—when possible.

### 12.2 Column filters

The filter control can:

- show distinct values and counts;
- search within filter options;
- select more than one value;
- include blank values;
- clear selections; and
- close with Escape or an outside click.

Most column filters operate on records already returned to the page. They may not search an unrequested server page.

### 12.3 Sorting

Many tables use a three-state cycle:

1. ascending;
2. descending;
3. no explicit sort.

Sorting commonly applies to the current result set. Expenses also send selected sort settings with the paginated request.

### 12.4 Clear filters before escalation

If a record seems missing:

1. Clear the free-text search.
2. Clear all selected column filters.
3. Disable overdue-only or other special toggles.
4. Return to the first expense page when relevant.
5. Refresh the report or reopen the navigation page.
6. Search again using a unique identifier.

### 12.5 Exports

Plans, Companies, Subscriptions, and account reports support spreadsheet-compatible export. The exported content reflects the list prepared by that screen, which may be searched, filtered, sorted, or paginated.

Before exporting:

- confirm all intended rows are present;
- note active filters;
- check whether the page is paginated;
- verify currency and reporting period; and
- use an approved storage location.

Exports can contain customer and financial data. Apply your organization’s handling and retention rules.

### 12.6 Printing

Print actions open a new browser window and then the print dialog. Allow pop-ups for the dashboard. Verify the new window’s title and contents before selecting a physical printer or **Save as PDF**.

---

## 13. Common operating workflows

### 13.1 Investigate a failed customer payment

1. On **Dashboard**, note the failed count/amount.
2. Open **Subscriptions** and filter status to failed.
3. Search by company, payer email, or payment intent.
4. Open payment detail and review denial/failure and gateway fields.
5. Open **Companies**, locate the company, and review Company 360 Subscription and Payment History.
6. Decide whether the case requires no action, customer follow-up, due-date adjustment, manual payment recording, suspension, or escalation.
7. Enter a specific reason for any company-level action.
8. Verify the resulting payment and company status.

### 13.2 Change a company from Free to Premium

1. Verify the approved plan and commercial terms.
2. Open **Companies** and find the exact company.
3. Review Company 360 for current status and recent payment.
4. Select **Edit**.
5. Choose Premium.
6. Confirm the intended Trial or paid status.
7. Enter valid due and recurring dates, with recurring later than due.
8. Enter a status-change reason when status changes.
9. Save and verify Company 360.

### 13.3 Apply a temporary company suspension

1. Confirm the approved scope and restoration condition.
2. Open **Subscriptions** and find a linked payment for the company.
3. Open edit mode.
4. Select the least disruptive suspension scope.
5. Enter the incident, policy, or billing reason.
6. Enter an end date if the suspension is time-bound.
7. Submit and verify the company.
8. Record the follow-up owner and resumption checkpoint outside the dashboard.

### 13.4 Record an offline payment

1. Verify the funds using bank, check, cash-register, or PayPal evidence.
2. Find the linked company/payment in **Subscriptions**.
3. Open edit mode and choose the correct manual method.
4. Add sender/receiver references.
5. Enter a reason that identifies the real transaction.
6. Submit once.
7. Verify the refreshed record and include it in reconciliation.

### 13.5 Launch a limited promo code

1. Confirm the campaign approval and eligibility rules.
2. Open **Plans → Promo Codes**.
3. Create the code and description.
4. Choose percent or fixed amount and enter a valid value.
5. Set exact validity dates.
6. Set redemption limits and minimum purchase if required.
7. Select paid plans and billing intervals.
8. Enable first-time-only when applicable.
9. Save and verify the uppercase code and active state.
10. After the campaign, deactivate the code with a reason.

### 13.6 Review and approve an expense

1. Open **Accounts → Expenses**.
2. Search by vendor, invoice, date, or expense reference.
3. View the record and match it to source evidence.
4. Confirm line items, tax, currency, and total.
5. Search for duplicates beyond the current page.
6. Move Draft to Pending, then Pending to Approved according to your approval policy.
7. Move Approved to Paid only after settlement is confirmed.
8. Verify each status change.

### 13.7 Produce a month-end report

1. Complete payment and expense reconciliation.
2. Open **Accounts → Monthly Reports**.
3. Select the year, month, and Day wise or Week wise grouping.
4. Refresh.
5. Review totals against the finance checkpoint.
6. Sort detail rows as needed.
7. Export Excel for analysis.
8. Use PDF → browser **Save as PDF** for a fixed presentation copy.
9. Open both files and verify period, totals, and row completeness.

---

## 14. Safe operation and audit reasons

### 14.1 Why reasons matter

Reasons provide the business context that raw field changes cannot. They help reviewers answer:

- Who requested the action?
- What event justified it?
- Which evidence supports it?
- Was it temporary or permanent?
- What should happen next?

The interface requires reasons for plan deletion, promo deactivation, company subscription-status changes, due-date changes, suspension, resumption, refunds, and manual payment/subscription actions.

### 14.2 Write a useful reason

A useful reason is concise, specific, and free of secrets.

Good examples:

- `Approved by Finance ticket FIN-4821; bank transfer settled 2026-02-18.`
- `Customer requested cancellation in case CS-1934; access ends after current term.`
- `Temporary billing-only suspension under overdue policy; review 2026-03-01.`

Weak examples:

- `admin update`
- `fix`
- `requested`

Never include passwords, full card numbers, secret tokens, or private authentication data.

### 14.3 High-impact action checklist

Before saving:

- verify production versus test;
- confirm the exact company, user, payment, plan, or expense;
- compare stable identifiers, not only display names;
- review amount, currency, date/time, and current status;
- obtain required approval;
- enter the audit reason;
- avoid beginning a sensitive multi-step action after a long idle period; and
- avoid double-clicking or retrying while the first request is still pending.

After saving:

- look for a success toast;
- verify the refreshed record;
- reopen detail when the action is financial or access-related;
- confirm related screens when state is shared;
- retain the external approval/evidence; and
- escalate discrepancies before repeating the action.

### 14.4 Backend authority

The dashboard provides operator controls and client-side checks, while the connected service is responsible for authorization, final validation, persistence, payment processing, and audit records. A success toast means the submitted operation reported success; it does not replace external settlement, customer communication, or compliance evidence.

---

## 15. Troubleshooting

### 15.1 Sign-in fails

1. Confirm both fields are complete.
2. Re-enter the username without accidental spaces.
3. Confirm Caps Lock and password-manager selection.
4. Verify that you opened the correct environment.
5. If the account is reported inactive, contact the authorized identity administrator.
6. If several operators are affected, report the environment, time, and visible message to support.

Do not repeatedly retry a credential that may be locked or revoked.

### 15.2 Session expired

Expected behavior is a return to sign-in with an expiration message.

1. Sign in again.
2. Navigate back to the relevant record.
3. Verify whether the previous action was applied.
4. Repeat only if the record proves it was not applied.

### 15.3 Page is empty

- Clear search and filters.
- Confirm you are on the expected tab.
- For Expenses, return to the first page.
- Wait briefly for loading to finish.
- Navigate away and back once.
- If Plans shows only Free and Premium, consider the fallback-data warning.
- Capture the exact error message and time before escalation.

### 15.4 Record cannot be found

- Search by a stable identifier.
- Clear every filter.
- Check alternative screens: company in Companies, payment in Subscriptions, expense in Accounts.
- Remember that client-side filters may cover only the returned records.
- For paginated expenses, inspect other pages or change page size.

### 15.5 Save or action fails

1. Read the toast.
2. Correct required fields, dates, or reasons.
3. Confirm the record is linked to a company for company-level subscription actions.
4. Check that recurring date is later than due date where required.
5. For promo codes, confirm the discount and plan-scope rules.
6. For expenses, inspect each line item and the duplicate warning.
7. Retry once only after correcting the cause.
8. Escalate with record identifiers, time, action, and message.

### 15.6 Export downloads no file

- Confirm data is visible.
- Check the browser download indicator.
- Allow downloads for the site.
- Clear filters if they produced an empty set.
- For Expenses, remember there is no dedicated export control in the current tab.

### 15.7 Print or PDF does nothing

- Allow pop-ups for the dashboard.
- Retry once.
- Look for a new browser tab or window behind the current window.
- For report PDF, use **Save as PDF** in the print dialog.
- If the print window is blank, close it and refresh the report before retrying.

### 15.8 Totals differ between screens

Possible causes include:

- different reporting periods;
- effective versus recorded subscription status;
- pending or failed payment state;
- incomplete expense posting;
- current-page filtering;
- delayed service updates; or
- a derived dashboard value when a service field is absent.

Record both screen names, selected periods/filters, values, and time. Do not force a corrective mutation until the source of the difference is known.

### 15.9 What to include in an escalation

- environment and dashboard address;
- your username, but never your password;
- date/time and timezone;
- navigation page and tab;
- company/user/payment/expense identifiers;
- filters and reporting period;
- exact visible message;
- expected versus actual result; and
- whether a success toast appeared.

---

## 16. Reachable features and known UI limitations

### 16.1 Reachability map

| Feature | Current UI reachability |
|---|---|
| Dashboard summary | Reachable from main navigation. |
| Plans and Promo Codes | Reachable from Plans. |
| Companies and Company 360 | Reachable from Companies. |
| Subscriptions & Payments | Reachable from main navigation. |
| Users and selected-user activity | Reachable from Users. |
| Infrastructure overview | Reachable from Accounts → Overview. |
| Expenses | Reachable from Accounts → Expenses. |
| Monthly/Annual Reports | Reachable from Accounts tabs. |
| Standalone global User Activity Log | Implemented component, but not mounted in current navigation. |

### 16.2 Known limitations

- Navigation is not represented by unique browser URLs.
- Refreshing returns the signed-in view to Dashboard.
- A new browser tab may not share the signed-in session.
- The application tracks session expiry but does not show a visible countdown.
- Forgot, Privacy Policy, Terms of Service, and Support Portal links on the sign-in page do not currently open implemented workflows.
- The account profile is view-only.
- Plans may show built-in Free/Premium fallback cards when live plan data is unavailable.
- Many column filters operate only on records already returned by the service.
- Expense column filters and duplicate checks cover the currently loaded page.
- Expense status changes do not collect a reason in the current UI.
- Report **PDF** uses the browser print dialog; it is not a direct PDF download.
- Spreadsheet exports use HTML content with an `.xls` filename.
- Print and PDF actions require pop-ups.
- Company-level subscription actions require a payment row linked to a company ID.
- Selected-user activity is available, but the standalone global activity-log screen is not.
- Some additional internal data operations exist without a reachable operator screen. Their presence does not make them available in this UI.

### 16.3 Operator response to a limitation

Do not bypass the interface through browser developer tools or improvised data changes. Use the authorized support, finance, or service-administration process and provide the evidence listed in the troubleshooting section.

---

## 17. Quick-reference glossary

| Term | Meaning in this manual |
|---|---|
| Company 360 | Company detail workspace with Overview, Subscription, and Payment History. |
| Effective status | Company state derived from latest payment when available, otherwise recorded subscription status. |
| Recorded status | Subscription status stored for the company and shown separately in Company 360. |
| Payment intent | Stable payment identifier used to distinguish payment records. |
| Pending balance | Unsettled value reported for the selected financial period. |
| Promo code | A controlled percent or fixed-amount discount with scope and limits. |
| Audit reason | Business explanation entered for a sensitive administrative action. |
| Manual payment | An externally verified PayPal, check, or cash payment recorded by an operator. |
| Suspension scope | Degree of restriction: billing-only, feature-limited, or full-access block. |
| Current result set | Records returned to the current screen; it may not include every server record. |
| Toast | Short success or error message after an action. |

### Operator close-out checklist

- Confirm all submitted actions show the intended final state.
- Complete any external approval, communication, or reconciliation record.
- Store exports only in approved locations.
- Remove downloaded customer data when retention is no longer justified.
- Sign out before leaving the workstation.

---

**Document title:** Supreme Dashboard — Super-Admin User Manual  
**Document type:** Operator user manual  
**Excluded scope:** Developer setup, source architecture, API implementation, deployment, and test engineering
