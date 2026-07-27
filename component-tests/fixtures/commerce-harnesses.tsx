import React, { useState } from 'react';
// Shared Apollo harnesses for commerce component scenarios.
import { type MockedResponse } from '@apollo/client/testing';
import { MockedProvider } from '@apollo/client/testing/react';
import { Companies } from '../../src/components/admin/pages/Companies';
import { Plans } from '../../src/components/admin/pages/Plans';
import { Subscriptions } from '../../src/components/admin/pages/Subscriptions';
import {
  ADMIN_COMPANIES_QUERY,
  ADMIN_COMPANY_PAYMENT_HISTORY_QUERY,
  ADMIN_DELETE_PLAN_MUTATION,
  ADMIN_MANUAL_SUBSCRIPTION_MUTATION,
  ADMIN_PAYMENTS_QUERY,
  ADMIN_PLANS_QUERY,
  ADMIN_PROMO_CODES_QUERY,
  ADMIN_REQUEST_REFUND_MUTATION,
  ADMIN_SAVE_PROMO_CODE_MUTATION,
} from '../../src/lib/graphql';

type HarnessProps = { mocks?: MockedResponse[]; scenario?: 'loading' | 'error' | 'empty' | 'data' | 'actions' };

const companyVariables = {
  search: null, status: null, subscriptionStatus: null, dueDateFrom: null,
  dueDateTo: null, recurringDateFrom: null, recurringDateTo: null,
};

export function PlansHarness({ mocks = [], scenario }: HarnessProps) {
  const [toast, setToast] = useState('');
  const plan = {
    id: 'team', name: 'Team', description: 'For growing teams', basePriceCents: 2500,
    currency: 'USD', billingInterval: 'monthly', perEmployee: false, trialMonths: 1,
    employeeLimit: 50, features: ['Reports'], recommended: true, active: true, sortOrder: 1,
  };
  const scenarioMocks: MockedResponse[] = scenario ? [
    {
      request: { query: ADMIN_PLANS_QUERY, variables: { includeInactive: true, search: null, active: null } },
      maxUsageCount: scenario === 'actions' ? 3 : 1,
      ...(scenario === 'loading' ? { delay: 60_000, result: { data: { adminPlans: [] } } } :
        scenario === 'error' ? { error: new Error('plans unavailable') } :
        { result: { data: { adminPlans: scenario === 'empty' ? [] : [plan] } } }),
    },
    {
      request: { query: ADMIN_PROMO_CODES_QUERY, variables: { includeInactive: true, search: null, active: null, planId: null } },
      maxUsageCount: scenario === 'actions' ? 3 : 1,
      result: { data: { adminPromoCodes: [] } },
    },
    ...(scenario === 'data' ? [{
      request: { query: ADMIN_PLANS_QUERY, variables: { includeInactive: true, search: 'does-not-exist', active: null } },
      result: { data: { adminPlans: [plan] } },
    }] : []),
    ...(scenario === 'actions' ? [
      {
        request: {
          query: ADMIN_SAVE_PROMO_CODE_MUTATION,
          variables: { input: {
            code: 'SAVE20', name: '', discountType: 'percent', discountValue: 20, currency: 'USD',
            active: true, startsAt: null, endsAt: null, maxRedemptions: null, perEmailLimit: null,
            perCompanyLimit: null, firstTimeCustomerOnly: false, minimumAmountCents: null,
            appliesToPlanIds: ['team'], applicableBillingIntervals: [],
          } },
        },
        result: { data: { adminSavePromoCode: { success: true, message: null, promoCode: { id: 'promo-1', code: 'SAVE20' } } } },
      },
      {
        request: { query: ADMIN_DELETE_PLAN_MUTATION, variables: { id: 'team', reason: 'Retired after migration' } },
        result: { data: { adminDeletePlan: { success: true, message: null, deletedId: 'team' } } },
      },
    ] : []),
  ] : mocks;
  return (
    <MockedProvider mocks={scenarioMocks}>
      <>
        <Plans onToast={(type, message) => setToast(`${type}: ${message}`)} />
        <output aria-label="toast">{toast}</output>
      </>
    </MockedProvider>
  );
}

export function CompaniesHarness({ mocks = [], scenario }: HarnessProps) {
  const [toast, setToast] = useState('');
  const company = {
    id: 7, company: 'Acme Labs', planId: 'premium', planName: 'Premium', employeeCount: 12,
    createdAt: '2026-01-01T00:00:00.000Z', isMultiLocationEnabled: false, subscriptionStatus: 'active',
    subscriptionDueDate: '2026-08-01T12:00:00.000Z', subscriptionRecurringDate: '2026-09-01T12:00:00.000Z',
    latestPaymentStatus: 'succeeded', latestPaymentIntentId: 'pi_acme', latestPaymentEmail: 'billing@acme.test',
    latestPaymentFinalAmountCents: 2500, latestPaymentCurrency: 'USD', latestPaymentGatewayMethod: 'card',
    latestPaymentGatewayStatus: 'settled',
  };
  const payment = {
    paymentIntentId: 'pi_acme', email: 'billing@acme.test', planId: 'premium', planName: 'Premium',
    employeeCountSnapshot: 12, originalAmountCents: 2500, finalAmountCents: 2500, status: 'succeeded',
    amount: 2500, currency: 'USD', companyId: 7, companyName: 'Acme Labs', source: 'portal',
    createdAt: '2026-01-02T00:00:00.000Z', dueDate: '2026-08-01T12:00:00.000Z',
    recurringDate: '2026-09-01T12:00:00.000Z', deniedReason: null, gatewayMethod: 'card',
    gatewayRefReceiverMedium: 'merchant-7', gatewayRefSenderMedium: 'customer-7',
    gatewayPayload: '{}', paymentGatewayStatus: 'settled',
  };
  const scenarioMocks: MockedResponse[] = scenario ? [
    {
      request: { query: ADMIN_COMPANIES_QUERY, variables: companyVariables },
      maxUsageCount: scenario === 'actions' ? 3 : 1,
      ...(scenario === 'loading' ? { delay: 60_000, result: { data: { adminCompanies: [] } } } :
        scenario === 'error' ? { error: new Error('company service unavailable') } :
        { result: { data: { adminCompanies: scenario === 'empty' ? [] : [company] } } }),
    },
    ...(scenario === 'data' ? [{
      request: { query: ADMIN_COMPANIES_QUERY, variables: { ...companyVariables, search: 'missing' } },
      result: { data: { adminCompanies: [company] } },
    }] : []),
    ...(scenario === 'actions' ? [
      {
        request: { query: ADMIN_COMPANY_PAYMENT_HISTORY_QUERY, variables: { companyId: 7, dateFrom: null, dateTo: null, status: null } },
        maxUsageCount: 3,
        result: { data: { adminCompanyPaymentHistory: [payment] } },
      },
      {
        request: { query: ADMIN_REQUEST_REFUND_MUTATION, variables: { paymentIntentId: 'pi_acme', reason: 'Duplicate charge', amount: 1000 } },
        result: { data: { adminRequestRefund: { success: true, message: 'queued' } } },
      },
      {
        request: {
          query: ADMIN_MANUAL_SUBSCRIPTION_MUTATION,
          variables: {
            companyId: 7, subscriptionId: 'pi_acme', source: 'portal', paymentMethod: 'card',
            receiverMedium: 'merchant-7', senderMedium: 'customer-7',
            gatewayPayload: JSON.stringify({ paymentIntentId: 'pi_acme', method: 'card', reason: 'Bank verified', source: 'portal' }),
            reason: 'Bank verified',
          },
        },
        result: { data: { adminManualSubscription: { success: true, message: 'recorded' } } },
      },
    ] : []),
  ] : mocks;
  return (
    <MockedProvider mocks={scenarioMocks}>
      <>
        <Companies onToast={(type, message) => setToast(`${type}: ${message}`)} />
        <output aria-label="toast">{toast}</output>
      </>
    </MockedProvider>
  );
}

export function SubscriptionsHarness({ mocks = [], scenario }: HarnessProps) {
  const [toast, setToast] = useState('');
  const payment = {
    paymentIntentId: 'pi_42', email: 'pay@orbit.test', planId: 'premium', planName: 'Premium',
    employeeCountSnapshot: 20, originalAmountCents: 5000, finalAmountCents: 5000,
    trialEndsAt: '2026-08-15T00:00:00.000Z', amount: 5000, currency: 'USD', status: 'pending',
    companyId: 42, companyName: 'Orbit Works', source: 'portal', deniedReason: null,
    createdAt: '2026-07-01T00:00:00.000Z', updatedAt: '2026-07-02T00:00:00.000Z',
    dueDate: '2026-08-01T10:00:00.000Z', recurringDate: '2026-09-01T10:00:00.000Z',
    gatewayMethod: 'paypal', gatewayRefReceiverMedium: 'merchant@orbit.test',
    gatewayRefSenderMedium: 'payer@orbit.test', paymentGatewayStatus: 'pending',
  };
  const scenarioMocks: MockedResponse[] = scenario ? [
    {
      request: { query: ADMIN_PAYMENTS_QUERY, variables: { status: null, companyId: null, dateFrom: null, dateTo: null, search: null } },
      ...(scenario === 'loading' ? { delay: 60_000, result: { data: { adminPayments: [] } } } :
        scenario === 'error' ? { error: new Error('payments unavailable') } :
        { result: { data: { adminPayments: scenario === 'empty' ? [] : [payment] } } }),
    },
    ...(scenario === 'data' ? [{
      request: { query: ADMIN_PAYMENTS_QUERY, variables: { status: null, companyId: null, dateFrom: null, dateTo: null, search: 'unknown' } },
      result: { data: { adminPayments: [payment] } },
    }] : []),
    { request: { query: ADMIN_COMPANIES_QUERY, variables: companyVariables }, result: { data: { adminCompanies: scenario === 'empty' ? [] : [{ id: 42, company: 'Orbit Works' }] } } },
  ] : mocks;
  return (
    <MockedProvider mocks={scenarioMocks}>
      <>
        <Subscriptions onToast={(type, message) => setToast(`${type}: ${message}`)} />
        <output aria-label="toast">{toast}</output>
      </>
    </MockedProvider>
  );
}
