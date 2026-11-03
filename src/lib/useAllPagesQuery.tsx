import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useApolloClient, useQuery } from '@apollo/client/react';
import type { DocumentNode } from 'graphql';
import { AlertTriangle, ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';
import { useDebouncedValue } from './useDebouncedValue';

/**
 * The backend's largest admin page (MAX_ADMIN_PAGE_SIZE). Lists that still
 * need every row (plans, promo codes) and "Export all" read 200 rows at a time.
 */
export const ADMIN_LIST_PAGE_SIZE = 200;
/** Rows per screen page of the paged lists (companies, users, payments, activity). */
export const FEED_PAGE_SIZE = 50;
/** "Export all" stops here and says so: a bigger export needs a narrower filter. */
export const EXPORT_ROW_CAP = 5000;
/** Safety stop: 50 pages (10,000 rows). A server that ignores `offset` would otherwise loop forever. */
const MAX_PAGES = 50;

type FetchPolicy = 'cache-first' | 'cache-and-network' | 'network-only' | 'no-cache';

// ---------------------------------------------------------------------------
// Page loops that outlive a click (all-rows lists, exports) end on sign-out.
// ---------------------------------------------------------------------------
const sessionLoops = new Set<AbortController>();

/** An AbortController that sign-out aborts too; call `release` when done. */
export const startSessionLoop = () => {
  const controller = new AbortController();
  sessionLoops.add(controller);
  return { controller, release: () => { sessionLoops.delete(controller); } };
};

/** Abort every page loop still running (sign-out, expired session). */
export const abortAdminPageLoops = () => {
  sessionLoops.forEach((controller) => controller.abort());
  sessionLoops.clear();
};

const abortError = () => new DOMException('The request was cancelled.', 'AbortError');
export const isAbortError = (error: unknown) =>
  !!error && typeof error === 'object' && (error as { name?: string }).name === 'AbortError';

interface RestPages<TRow> {
  base?: unknown;
  version: number;
  rows: TRow[];
  loading: boolean;
  error: Error | null;
}

/**
 * Every row of a paged admin list (`limit` / `offset` arguments), for lists
 * that are small by nature and need all rows (plans, promo codes). The first
 * page is an ordinary Apollo query; when it comes back full the following
 * pages are read until a short one. The loop stops (and its requests are
 * aborted) when the variables change, the component unmounts or the admin
 * signs out. Big lists use `usePagedQuery` instead.
 *
 * - `rows`: all rows read so far (undefined until the first page arrives)
 * - `error`: the first page failed (nothing to show)
 * - `pageError`: a later page failed -- the list is incomplete and says so
 * - `refetch()`: reloads the first page and then the rest
 */
export function useAllPagesQuery<TRow, TVars extends Record<string, unknown>>(
  query: DocumentNode,
  field: string,
  options: { variables: TVars; skip?: boolean; fetchPolicy?: FetchPolicy },
) {
  const client = useApolloClient();
  const varsKey = JSON.stringify(options.variables);
  const variables = useMemo(
    () => ({ ...options.variables, limit: ADMIN_LIST_PAGE_SIZE, offset: 0 }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [varsKey],
  );
  const result = useQuery<Record<string, TRow[] | null | undefined>, Record<string, unknown>, any>(query, {
    variables: variables as Record<string, unknown>,
    skip: options.skip,
    fetchPolicy: options.fetchPolicy,
  });
  const firstPage = result.data?.[field] ?? undefined;
  const [version, setVersion] = useState(0);
  const [rest, setRest] = useState<RestPages<TRow>>({ version: 0, rows: [], loading: false, error: null });
  const full = !!firstPage && firstPage.length >= ADMIN_LIST_PAGE_SIZE;

  useEffect(() => {
    if (!firstPage || firstPage.length < ADMIN_LIST_PAGE_SIZE) return undefined;
    const { controller, release } = startSessionLoop();
    const { signal } = controller;
    setRest({ base: firstPage, version, rows: [], loading: true, error: null });
    // Rows read so far: kept (with the warning) when the loop stops early.
    const rows: TRow[] = [];
    (async () => {
      for (let page = 1; ; page += 1) {
        if (signal.aborted) throw abortError();
        if (page >= MAX_PAGES) {
          throw new Error(`The list is longer than ${MAX_PAGES * ADMIN_LIST_PAGE_SIZE} rows; narrow the search to see the rest.`);
        }
        const next = await client.query<Record<string, TRow[] | null | undefined>, Record<string, unknown>, any>({
          query,
          variables: { ...variables, offset: page * ADMIN_LIST_PAGE_SIZE },
          fetchPolicy: 'network-only',
          // A failed page must not read as "no more rows" (the app default is 'all').
          errorPolicy: 'none',
          // Never shared with an identical request of a loop that was
          // stopped: its abort would end this loop too, leaving the list on
          // "Loading more..." for good.
          context: { fetchOptions: { signal }, queryDeduplication: false },
        });
        // Variables changed / unmounted / signed out meanwhile: stop here.
        if (signal.aborted) throw abortError();
        if (next.error) throw next.error;
        const pageRows = next.data?.[field];
        if (!Array.isArray(pageRows)) throw new Error(`The server returned no ${field} list.`);
        rows.push(...pageRows);
        if (pageRows.length < ADMIN_LIST_PAGE_SIZE) return rows;
      }
    })()
      .then((rows) => {
        if (!signal.aborted) setRest({ base: firstPage, version, rows, loading: false, error: null });
      })
      .catch((err) => {
        // Only this loop's own stop is silent; any other abort is an error
        // (the list must not stay "loading" for ever).
        if (signal.aborted) return;
        setRest({ base: firstPage, version, rows: [...rows], loading: false, error: err instanceof Error ? err : new Error(String(err)) });
      })
      .finally(release);
    return () => {
      controller.abort();
      release();
    };
  }, [client, query, field, firstPage, variables, version]);

  const restApplies = full && rest.base === firstPage && rest.version === version;
  const loadedRows = useMemo(
    () => (firstPage ? (restApplies && rest.rows.length ? [...firstPage, ...rest.rows] : firstPage) : undefined),
    [firstPage, restApplies, rest.rows],
  );
  // (#234) The last complete list for these variables. While the same list is
  // read again (refetch after a save, a new first page), the rows past the
  // first page stay on screen until the new ones arrive, so a long list never
  // shrinks to one page; the first page is always the fresh one.
  const reloading = full && (!restApplies || rest.loading);
  const complete = !!loadedRows && !reloading && !(restApplies && rest.error);
  const [lastComplete, setLastComplete] = useState<{ key: string; rows: TRow[] } | null>(null);
  useEffect(() => {
    if (complete && loadedRows) setLastComplete({ key: varsKey, rows: loadedRows });
  }, [complete, loadedRows, varsKey]);
  const rows = useMemo(() => {
    if (!loadedRows || !reloading || !lastComplete || lastComplete.key !== varsKey) return loadedRows;
    if (lastComplete.rows.length <= loadedRows.length) return loadedRows;
    return [...loadedRows, ...lastComplete.rows.slice(loadedRows.length)];
  }, [loadedRows, reloading, lastComplete, varsKey]);

  const { refetch: refetchFirst } = result;
  const refetch = async (next?: Partial<TVars>) => {
    const answer = await refetchFirst(next as Record<string, unknown> | undefined);
    setVersion((value) => value + 1);
    return answer;
  };

  return {
    rows,
    loading: result.loading,
    error: result.error,
    pageError: restApplies ? rest.error : null,
    loadingMore: full && (!restApplies || rest.loading),
    refetch,
  };
}

// ---------------------------------------------------------------------------
// Paged feeds: one page at a time, filtered and sorted by the server
// ---------------------------------------------------------------------------
export interface FeedFacet {
  field?: string | null;
  value?: string | null;
  label?: string | null;
  count?: number | null;
}

export interface FeedSort {
  field: string;
  direction: 'asc' | 'desc';
}

interface Feed<TRow> {
  totalCount?: number | null;
  items?: TRow[] | null;
  facets?: FeedFacet[] | null;
  nextCursor?: string | null;
}

export type FeedVariables = { filter: Record<string, unknown>; sort?: FeedSort | null };

const cleanText = (values: Record<string, string | null | undefined>) =>
  Object.fromEntries(Object.entries(values).map(([key, value]) => [key, (value ?? '').trim() || null]));

/**
 * One page of a `{ totalCount, items, facets }` feed (adminCompaniesFeed,
 * adminUsersFeed, adminPaymentsFeed, adminUserActivityLogsFeed).
 *
 * - `filter`: sent as is (column filters, switches); a change goes to page 1.
 * - `textFilters`: typed text, sent once typing pauses (`debounceMs`): one
 *   request per search, not one per key.
 * - The rows on screen stay while the next page / filter loads (`refreshing`,
 *   from Apollo's previousData); Apollo cancels the request of variables that
 *   are no longer current and never shows its answer.
 */
export function usePagedQuery<TRow>(
  query: DocumentNode,
  field: string,
  options: {
    filter?: Record<string, unknown>;
    textFilters?: Record<string, string | null | undefined>;
    pageSize?: number;
    initialSort?: FeedSort | null;
    /** false for feeds without a `sort` argument (activity). */
    sortable?: boolean;
    skip?: boolean;
    fetchPolicy?: FetchPolicy;
    debounceMs?: number;
  } = {},
) {
  const pageSize = options.pageSize ?? FEED_PAGE_SIZE;
  const sortable = options.sortable ?? true;
  const textKey = JSON.stringify(cleanText(options.textFilters ?? {}));
  const debouncedTextKey = useDebouncedValue(textKey, options.debounceMs ?? 300);
  const filterKey = JSON.stringify(options.filter ?? {});
  const [sort, setSortState] = useState<FeedSort | null>(options.initialSort ?? null);
  const queryKey = `${filterKey}|${debouncedTextKey}|${JSON.stringify(sort)}`;
  // The page belongs to one filter/search/sort: a change starts at page 1
  // without first asking for the old page number.
  const [pageState, setPageState] = useState({ key: queryKey, page: 0 });
  const page = pageState.key === queryKey ? pageState.page : 0;
  const setPage = useCallback(
    (next: number) => setPageState({ key: queryKey, page: Math.max(0, Math.floor(next)) }),
    [queryKey],
  );
  const variables = useMemo<FeedVariables>(() => {
    const filter = {
      ...JSON.parse(filterKey),
      ...JSON.parse(debouncedTextKey),
      limit: pageSize,
      offset: page * pageSize,
    };
    return sortable ? { filter, sort } : { filter };
  }, [filterKey, debouncedTextKey, sort, page, pageSize, sortable]);

  const result = useQuery<Record<string, Feed<TRow> | null | undefined>, Record<string, unknown>, any>(query, {
    variables: variables as Record<string, unknown>,
    skip: options.skip,
    fetchPolicy: options.fetchPolicy,
    notifyOnNetworkStatusChange: true,
  });
  const current = result.data?.[field] ?? undefined;
  const previous = (result.previousData as Record<string, Feed<TRow> | null | undefined> | undefined)?.[field] ?? undefined;
  const feed: Feed<TRow> | undefined = current ?? previous;
  const totalCount = feed?.totalCount ?? 0;

  // Rows removed meanwhile (a delete, a refetch): a page past the end goes
  // back to the last page instead of showing an empty one.
  const lastPage = Math.max(0, Math.ceil(totalCount / pageSize) - 1);
  useEffect(() => {
    // (Only with a real count: a keyset feed may not send one.)
    if (current && typeof current.totalCount === 'number' && current.totalCount > 0 && page > lastPage) setPage(lastPage);
  }, [current, page, lastPage, setPage]);

  const { refetch: refetchQuery } = result;
  const refetch = useCallback(() => refetchQuery(), [refetchQuery]);

  return {
    rows: (feed?.items ?? undefined) as TRow[] | undefined,
    totalCount,
    facets: (feed?.facets ?? []) as FeedFacet[],
    page,
    setPage,
    pageSize,
    pageCount: Math.max(1, Math.ceil(totalCount / pageSize)),
    /** Keyset feeds (activity): pass as filter.cursor for the next page. */
    nextCursor: current ? current.nextCursor ?? null : null,
    sort,
    setSort: setSortState,
    /** Nothing to show yet (first load). */
    loading: result.loading && !feed,
    /** Rows on screen are being replaced (next page, new filter, refetch). */
    refreshing: result.loading && !!feed,
    /** Typed text not sent yet. */
    pending: textKey !== debouncedTextKey,
    error: result.error,
    refetch,
    variables,
  };
}

/**
 * Facet options of one field for a ColumnFilter: `value` is what the server
 * filters on ("" = not set), `label` what the admin reads.
 */
export const facetOptions = (
  facets: FeedFacet[],
  field: string,
  label?: (facet: FeedFacet) => string,
): Array<{ value: string; label: string; count: number }> =>
  facets
    .filter((facet) => facet.field === field)
    .map((facet) => ({
      value: facet.value ?? '',
      label: label ? label(facet) : facet.label || facet.value || '(empty)',
      count: facet.count ?? 0,
    }));

/**
 * "Export all" of a feed: reads every page of the current filter (200 at a
 * time, at most `cap` rows). `cancel()`, unmounting or signing out aborts it.
 */
export function useFeedExport<TRow>(query: DocumentNode, field: string, variables: FeedVariables) {
  const client = useApolloClient();
  const [exporting, setExporting] = useState(false);
  const running = useRef<ReturnType<typeof startSessionLoop> | null>(null);

  const cancel = useCallback(() => {
    running.current?.controller.abort();
  }, []);
  useEffect(() => cancel, [cancel]);

  const exportAll = useCallback(async (cap = EXPORT_ROW_CAP): Promise<{ rows: TRow[]; truncated: boolean; totalCount: number }> => {
    if (running.current) throw new Error('An export is already running.');
    const loop = startSessionLoop();
    running.current = loop;
    const { signal } = loop.controller;
    setExporting(true);
    try {
      const rows: TRow[] = [];
      let totalCount = 0;
      for (let page = 0; page < MAX_PAGES; page += 1) {
        if (signal.aborted) throw abortError();
        const answer = await client.query<Record<string, Feed<TRow> | null | undefined>, Record<string, unknown>, any>({
          query,
          variables: {
            ...variables,
            filter: { ...variables.filter, limit: ADMIN_LIST_PAGE_SIZE, offset: page * ADMIN_LIST_PAGE_SIZE },
          },
          fetchPolicy: 'network-only',
          errorPolicy: 'none',
          context: { fetchOptions: { signal }, queryDeduplication: false },
        });
        if (signal.aborted) throw abortError();
        if (answer.error) throw answer.error;
        const feed = answer.data?.[field];
        if (!feed || !Array.isArray(feed.items)) throw new Error(`The server returned no ${field} page.`);
        totalCount = feed.totalCount ?? totalCount;
        rows.push(...feed.items);
        if (rows.length >= cap) return { rows: rows.slice(0, cap), truncated: totalCount > cap, totalCount };
        if (feed.items.length < ADMIN_LIST_PAGE_SIZE || rows.length >= totalCount) break;
      }
      return { rows, truncated: rows.length < totalCount, totalCount };
    } finally {
      loop.release();
      running.current = null;
      setExporting(false);
    }
  }, [client, query, field, variables]);

  return { exportAll, exporting, cancel };
}

/** Pager under a paged list: "51–100 of 312 companies", previous / next. */
export const Pager: React.FC<{
  page: number;
  pageSize: number;
  totalCount: number;
  onPage: (page: number) => void;
  refreshing?: boolean;
  what?: string;
}> = ({ page, pageSize, totalCount, onPage, refreshing = false, what = 'rows' }) => {
  const pageCount = Math.max(1, Math.ceil(totalCount / pageSize));
  const first = totalCount ? page * pageSize + 1 : 0;
  const last = Math.min(totalCount, (page + 1) * pageSize);
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 px-1 py-2 text-sm text-slate-600" data-testid="pager">
      <span data-testid="pager-summary" className="inline-flex items-center gap-2">
        {totalCount ? `${first}–${last} of ${totalCount} ${what}` : `No ${what}`}
        {refreshing ? <Loader2 className="h-4 w-4 animate-spin text-slate-400" aria-label="Loading" /> : null}
      </span>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => onPage(page - 1)}
          disabled={page <= 0}
          className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-1 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
          aria-label="Previous page"
        >
          <ChevronLeft className="h-4 w-4" /> Previous
        </button>
        <span className="text-xs text-slate-500">
          Page {Math.min(page + 1, pageCount)} of {pageCount}
        </span>
        <button
          type="button"
          onClick={() => onPage(page + 1)}
          disabled={page + 1 >= pageCount}
          className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-1 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
          aria-label="Next page"
        >
          Next <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
};

/** Inline loading line: the page (header, filters) stays on screen while its list loads. */
export const InlineSpinner: React.FC<{ label: string }> = ({ label }) => (
  <div className="flex items-center gap-2 py-6 text-sm text-slate-500" role="status">
    <Loader2 className="h-4 w-4 animate-spin" /> {label}
  </div>
);

/** Says so when only part of a list could be loaded (or while the rest is still loading). */
export const PartialListWarning: React.FC<{
  error: Error | null | undefined;
  loadingMore: boolean;
  shown: number;
  what: string;
  onRetry?: () => void;
}> = ({ error, loadingMore, shown, what, onRetry }) => {
  if (error) {
    return (
      <p
        role="alert"
        className="flex flex-wrap items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800"
        data-testid="partial-list-warning"
      >
        <AlertTriangle className="h-4 w-4 flex-none" />
        Only the first {shown} {what} could be loaded: {error.message}
        {onRetry ? (
          <button type="button" onClick={onRetry} className="font-semibold text-amber-900 underline">
            Try again
          </button>
        ) : null}
      </p>
    );
  }
  if (loadingMore) {
    return (
      <p className="text-xs text-slate-500" data-testid="partial-list-loading">
        Loading more {what}… ({shown} so far)
      </p>
    );
  }
  return null;
};
