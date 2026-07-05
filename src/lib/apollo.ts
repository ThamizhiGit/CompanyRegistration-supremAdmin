import { ApolloClient, InMemoryCache, HttpLink, ApolloLink } from '@apollo/client';

// Use environment variable for GraphQL URI, fallback to local development URL
const GRAPHQL_URI = import.meta.env.VITE_GRAPHQL_URI || 'http://localhost:8000/graphql/';

console.log('Connecting to GraphQL at:', GRAPHQL_URI);

// Auth link to add JWT token if present in localStorage
const authLink = new ApolloLink((operation, forward) => {
  const token = localStorage.getItem('token');

  operation.setContext(({ headers }) => ({
    headers: {
      ...headers,
      Authorization: token ? `Bearer ${token}` : ''
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

