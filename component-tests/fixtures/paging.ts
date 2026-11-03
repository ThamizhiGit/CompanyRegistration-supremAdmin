// Node-safe (no ?raw import): spec files run their non-component imports in Node.
import { ADMIN_LIST_PAGE_SIZE, FEED_PAGE_SIZE } from '../../src/lib/useAllPagesQuery';

/** Variables of an all-rows list query's page (plans, promo codes: 200 at a time). */
export const paged = <T extends Record<string, unknown>>(variables: T, page = 0) => ({
  ...variables,
  limit: ADMIN_LIST_PAGE_SIZE,
  offset: page * ADMIN_LIST_PAGE_SIZE,
});

/**
 * Variables of one page of a feed query (companies, users, payments,
 * activity): `{ filter: {...filter, limit, offset}, sort }`. Pass `sort`
 * (null included) for the feeds that take one; activity has none.
 */
export const feedVariables = (
  filter: Record<string, unknown>,
  options: { page?: number; pageSize?: number; sort?: unknown } = {},
) => {
  const pageSize = options.pageSize ?? FEED_PAGE_SIZE;
  return {
    filter: { ...filter, limit: pageSize, offset: (options.page ?? 0) * pageSize },
    ...('sort' in options ? { sort: options.sort } : {}),
  };
};

/** A feed answer: `{ [field]: { totalCount, facets, items } }` (+ nextCursor for activity). */
export const feedResult = (
  field: string,
  items: unknown[],
  extra: { totalCount?: number; facets?: unknown[]; nextCursor?: string | null } = {},
) => ({
  data: {
    [field]: {
      totalCount: extra.totalCount ?? items.length,
      facets: extra.facets ?? [],
      items,
      ...('nextCursor' in extra ? { nextCursor: extra.nextCursor } : {}),
    },
  },
});

/** Variables of one page of adminCompaniesFeed, as the Companies page sends them. */
export const companyFeedVariables = (filter: Record<string, unknown> = {}, page = 0, pageSize?: number) => feedVariables(
  {
    subscriptionStatus: [], planId: [], gateway: [], dueDateFrom: null, dueDateTo: null,
    recurringDateFrom: null, recurringDateTo: null, search: null, ...filter,
  },
  { page, pageSize, sort: { field: 'createdAt', direction: 'desc' } },
);

/** Variables of one page of adminPaymentsFeed, as the Subscriptions page sends them. */
export const paymentFeedVariables = (filter: Record<string, unknown> = {}, page = 0, pageSize?: number) => feedVariables(
  {
    companyId: null, status: [], planId: [], gateway: [], amountMin: null, amountMax: null,
    dueOnly: null, dateFrom: null, dateTo: null, search: null, ...filter,
  },
  { page, pageSize, sort: { field: 'createdAt', direction: 'desc' } },
);
