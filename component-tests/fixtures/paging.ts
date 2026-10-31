// Node-safe (no ?raw import): spec files run their non-component imports in Node.
import { ADMIN_LIST_PAGE_SIZE } from '../../src/lib/useAllPagesQuery';

/** Variables of a list query's page (the pages ask for every row, 200 at a time). */
export const paged = <T extends Record<string, unknown>>(variables: T, page = 0) => ({
  ...variables,
  limit: ADMIN_LIST_PAGE_SIZE,
  offset: page * ADMIN_LIST_PAGE_SIZE,
});
