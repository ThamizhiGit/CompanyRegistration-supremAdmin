import type { ErrorPolicy } from '@apollo/client';

declare module '@apollo/client' {
  namespace ApolloClient {
    namespace DeclareDefaultOptions {
      interface WatchQuery {
        errorPolicy: ErrorPolicy;
      }

      interface Query {
        errorPolicy: ErrorPolicy;
      }
    }
  }
}
