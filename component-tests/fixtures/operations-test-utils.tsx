import React, { type ReactNode } from 'react';
// Shared Apollo helpers for operations component scenarios.
import type { MockedResponse } from '@apollo/client/testing';
import { SchemaMockedProvider } from './schema-mocks';

export const apollo = (children: ReactNode, mocks: ReadonlyArray<MockedResponse>) => (
  <SchemaMockedProvider mocks={mocks}>
    {children}
  </SchemaMockedProvider>
);

export const delayed = <T,>(mock: T): T & { delay: number } => ({
  ...mock,
  delay: 60_000,
});
