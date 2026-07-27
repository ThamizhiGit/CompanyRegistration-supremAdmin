import React, { type ReactNode } from 'react';
// Shared Apollo helpers for operations component scenarios.
import type { MockedResponse } from '@apollo/client/testing';
import { MockedProvider } from '@apollo/client/testing/react';

export const apollo = (children: ReactNode, mocks: ReadonlyArray<MockedResponse>) => (
  <MockedProvider mocks={mocks}>
    {children}
  </MockedProvider>
);

export const delayed = <T,>(mock: T): T & { delay: number } => ({
  ...mock,
  delay: 60_000,
});
