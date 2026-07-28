import { ApolloClient, InMemoryCache, HttpLink, ApolloLink } from '@apollo/client';

// Set via .env.local (dev) / .env.production (build). See .env.example.
// Vite inlines this at BUILD time — changing it requires a rebuild.
const GRAPHQL_URI = import.meta.env.VITE_GRAPHQL_URI || 'http://localhost:8000/graphql/';

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
  const token = localStorage.getItem('token');

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

const httpLink = new HttpLink({
  uri: GRAPHQL_URI,
  credentials: 'include', // Include cookies and auth headers
});

export const client = new ApolloClient({
    link: authLink.concat(httpLink),
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

