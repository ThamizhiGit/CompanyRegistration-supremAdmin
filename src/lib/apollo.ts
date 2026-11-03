import { ApolloClient, InMemoryCache, HttpLink, ApolloLink } from '@apollo/client';
import { CombinedGraphQLErrors, ServerError, ServerParseError } from '@apollo/client/errors';
import { ErrorLink } from '@apollo/client/link/error';
import { abortAdminPageLoops } from './useAllPagesQuery';

const STORAGE = window.sessionStorage;
const SESSION_TOKEN_KEY = 'token';
const SESSION_USERNAME_KEY = 'adminUsername';
const SESSION_EXPIRES_AT_KEY = 'adminExpiresAt';

// Set via .env.local (dev) / .env.production (build). See .env.example.
// Vite inlines this at BUILD time — changing it requires a rebuild.
const GRAPHQL_URI = import.meta.env.VITE_GRAPHQL_URI || 'http://localhost:8000/graphql/';
const GRAPHQL_DEBUG = import.meta.env.DEV && import.meta.env.VITE_GRAPHQL_DEBUG === '1';

if (import.meta.env.PROD && !import.meta.env.VITE_GRAPHQL_URI) {
  console.error(
    '[config] VITE_GRAPHQL_URI is not set for this build. ' +
    'Falling back to http://localhost:8000/graphql/, which will fail in the browser. ' +
    'Set it in .env.production or as a BUILD-time env var on your host, then rebuild.'
  );
}

console.log('Connecting to GraphQL at:', GRAPHQL_URI);

// Auth link to add the super-admin token if present in localStorage.
// The admin API expects the raw token in X-SuperAdmin-Authorization (no "Bearer" prefix).
const authLink = new ApolloLink((operation, forward) => {
  const token = STORAGE.getItem(SESSION_TOKEN_KEY);

  operation.setContext(({ headers }: { headers?: Record<string, string> }) => ({
    headers: {
      ...headers,
      ...(token ? { 'X-SuperAdmin-Authorization': token } : {})
    }
  }));

  if (GRAPHQL_DEBUG) {
    console.debug('GraphQL Request - Token:', token ? 'Present' : 'Missing');
  }

  return forward(operation);
});

// The backend marks every super-admin auth failure with this code. Older
// backends sent only the message: the exact messages are still accepted, but
// never a word inside another message (a "promo code expired" error must not
// sign the admin out).
const UNAUTHENTICATED_CODE = 'UNAUTHENTICATED';
const LEGACY_AUTH_MESSAGES = new Set(['authentication required', 'token expired', 'invalid token']);

const isAuthGraphQLError = (graphQLError: { message?: string; extensions?: Record<string, unknown> }) =>
  graphQLError.extensions?.code === UNAUTHENTICATED_CODE
  || LEGACY_AUTH_MESSAGES.has((graphQLError.message || '').trim().toLowerCase());

/** True when `error` (Apollo 4) says the super-admin session is gone. */
export const isSessionError = (error: unknown) => {
  if (CombinedGraphQLErrors.is(error)) return error.errors.some(isAuthGraphQLError);
  if (ServerError.is(error) || ServerParseError.is(error)) return error.statusCode === 401 || error.statusCode === 403;
  return false;
};

const logoutExpiredSession = () => {
  // Page loops (all-rows lists, exports) must not keep reading as nobody.
  abortAdminPageLoops();
  STORAGE.removeItem(SESSION_TOKEN_KEY);
  STORAGE.removeItem(SESSION_USERNAME_KEY);
  STORAGE.removeItem(SESSION_EXPIRES_AT_KEY);
  window.dispatchEvent(new Event('admin-session-expired'));
};

const errorLink = new ErrorLink(({ error }) => {
  if (!error) return;
  if (isSessionError(error)) {
    logoutExpiredSession();
  }
});

const httpLink = new HttpLink({
  uri: GRAPHQL_URI,
  credentials: 'include', // Include cookies and auth headers
});

export const client = new ApolloClient({
    link: errorLink.concat(authLink).concat(httpLink),
    cache: new InMemoryCache({
        resultCaching: false
    }),
    defaultOptions: {
        watchQuery: {
            errorPolicy: 'all',
            fetchPolicy: 'cache-and-network',
        },
        query: {
            errorPolicy: 'all',
            fetchPolicy: 'cache-first',
        },
    },
});
