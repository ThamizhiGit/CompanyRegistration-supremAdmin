import React, { useEffect, useMemo, useState } from 'react';
import { useApolloClient, useQuery } from '@apollo/client/react';
import type { DocumentNode } from 'graphql';
import { AlertTriangle } from 'lucide-react';

/**
 * The backend's largest admin page (MAX_ADMIN_PAGE_SIZE). Without a `limit`
 * the admin lists return their default page of 50 rows, so every list past 50
 * companies / payments / users / plans / promo codes was silently cut off.
 */
export const ADMIN_LIST_PAGE_SIZE = 200;
/** Safety stop: 50 pages (10,000 rows). A server that ignores `offset` would otherwise loop forever. */
const MAX_PAGES = 50;

type FetchPolicy = 'cache-first' | 'cache-and-network' | 'network-only' | 'no-cache';

interface RestPages<TRow> {
  base?: unknown;
  version: number;
  rows: TRow[];
  loading: boolean;
  error: Error | null;
}

/**
 * Every row of a paged admin list (`limit` / `offset` arguments). The first
 * page is an ordinary Apollo query (loading, error, cache as before); when it
 * comes back full the following pages are read until a short one.
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
    let cancelled = false;
    setRest({ base: firstPage, version, rows: [], loading: true, error: null });
    (async () => {
      const rows: TRow[] = [];
      for (let page = 1; ; page += 1) {
        if (page >= MAX_PAGES) {
          throw new Error(`The list is longer than ${MAX_PAGES * ADMIN_LIST_PAGE_SIZE} rows; narrow the search to see the rest.`);
        }
        const next = await client.query<Record<string, TRow[] | null | undefined>, Record<string, unknown>, any>({
          query,
          variables: { ...variables, offset: page * ADMIN_LIST_PAGE_SIZE },
          fetchPolicy: 'network-only',
          // A failed page must not read as "no more rows" (the app default is 'all').
          errorPolicy: 'none',
        });
        if (next.error) throw next.error;
        const pageRows = next.data?.[field];
        if (!Array.isArray(pageRows)) throw new Error(`The server returned no ${field} list.`);
        rows.push(...pageRows);
        if (pageRows.length < ADMIN_LIST_PAGE_SIZE) return rows;
      }
    })()
      .then((rows) => {
        if (!cancelled) setRest({ base: firstPage, version, rows, loading: false, error: null });
      })
      .catch((err) => {
        if (!cancelled) {
          setRest({ base: firstPage, version, rows: [], loading: false, error: err instanceof Error ? err : new Error(String(err)) });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [client, query, field, firstPage, variables, version]);

  const restApplies = full && rest.base === firstPage && rest.version === version;
  const rows = useMemo(
    () => (firstPage ? (restApplies && rest.rows.length ? [...firstPage, ...rest.rows] : firstPage) : undefined),
    [firstPage, restApplies, rest.rows],
  );

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
