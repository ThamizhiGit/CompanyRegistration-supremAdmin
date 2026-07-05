import React, { ReactNode } from 'react';
import { ApolloProvider } from '@apollo/client/react';
import { client } from '../lib/apollo';

interface GraphQLProviderProps {
    children: ReactNode;
}

/**
 * GraphQLProvider Component
 * 
 * Provides the Apollo Client context to the application.
 * Centrally manages the GraphQL connection and client configuration.
 */
export const GraphQLProvider: React.FC<GraphQLProviderProps> = ({ children }) => {
    return (
        <ApolloProvider client={client}>
            {children}
        </ApolloProvider>
    );
};

export default GraphQLProvider;
