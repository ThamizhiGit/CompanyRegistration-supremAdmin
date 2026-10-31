import React from 'react';
// MockedProvider that first checks every mock against the backend schema.
import type { MockedResponse } from '@apollo/client/testing';
import { MockedProvider } from '@apollo/client/testing/react';
import schemaSdl from '../../tests/fixtures/superadmin-schema.graphql?raw';
import { createSchemaValidator, operationNameOf } from '../../tests/fixtures/schema-validation';

const { request: checkRequest } = createSchemaValidator(schemaSdl);

/**
 * Mocks only answer requests whose variables equal theirs, so a mock the real
 * API would refuse (a String where the schema wants an Int, 12.5 for an Int, a
 * missing required variable) means the page sends that request too.
 */
export const schemaProblemsOf = (mocks: ReadonlyArray<MockedResponse>): string[] =>
  mocks.flatMap((mock) => {
    const { query, variables } = mock.request;
    const values = typeof variables === 'function' ? {} : (variables as Record<string, unknown> | undefined);
    return checkRequest(query, values ?? {}).map((message) => `${operationNameOf(query)}: ${message}`);
  });

type Props = React.ComponentProps<typeof MockedProvider>;

export function SchemaMockedProvider({ mocks = [], ...props }: Props) {
  const problems = schemaProblemsOf(mocks);
  if (problems.length) {
    console.error(`Mocked GraphQL requests the backend schema would refuse:\n${problems.join('\n')}`);
    return (
      <pre role="alert" data-testid="schema-mock-error" className="whitespace-pre-wrap p-4 text-sm text-rose-700">
        {`Mocked GraphQL requests the backend schema would refuse:\n${problems.join('\n')}`}
      </pre>
    );
  }
  return <MockedProvider mocks={mocks} {...props} />;
}
