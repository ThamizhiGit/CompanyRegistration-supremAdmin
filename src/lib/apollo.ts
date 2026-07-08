import { ApolloClient, InMemoryCache, HttpLink, ApolloLink } from '@apollo/client';
import { ErrorLink } from '@apollo/client/link/error';

const STORAGE = window.sessionStorage;
const SESSION_TOKEN_KEY = 'token';
const SESSION_USERNAME_KEY = 'adminUsername';
const SESSION_EXPIRES_AT_KEY = 'adminExpiresAt';

// Use environment variable for GraphQL URI, fallback to local development URL
const GRAPHQL_URI = import.meta.env.VITE_GRAPHQL_URI || 'http://localhost:8000/graphql/';

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

  // Log for debugging
  console.log('GraphQL Request - Token:', token ? 'Present' : 'Missing', 'Headers:', operation.getContext().headers);

  return forward(operation);
});

const isAuthError = (message: string) => {
  const normalized = message.toLowerCase();
  return (
    normalized.includes('expired') ||
    normalized.includes('unauthorized') ||
    normalized.includes('unauthenticated') ||
    normalized.includes('authentication credentials') ||
    normalized.includes('invalid token')
  );
};

const logoutExpiredSession = () => {
  STORAGE.removeItem(SESSION_TOKEN_KEY);
  STORAGE.removeItem(SESSION_USERNAME_KEY);
  STORAGE.removeItem(SESSION_EXPIRES_AT_KEY);
  window.dispatchEvent(new Event('admin-session-expired'));
};

const errorLink = new ErrorLink(({ error }) => {
  if (!error) return;

  const graphQLErrors = (error as any).graphQLErrors || [];
  const networkError = (error as any).networkError;
  const statusCode = networkError?.statusCode || networkError?.response?.status;
  const hasGraphqlAuthError = graphQLErrors.some((graphQLError: any) => isAuthError(graphQLError.message || ''));
  const hasNetworkAuthError = statusCode === 401 || statusCode === 403 || isAuthError(error.message || '');

  if (hasGraphqlAuthError || hasNetworkAuthError) {
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
