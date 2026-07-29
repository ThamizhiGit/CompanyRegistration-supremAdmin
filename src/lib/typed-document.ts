import type { DocumentNode, OperationVariables, TypedDocumentNode } from '@apollo/client';

/**
 * Temporary typed-document bridge for the dashboard's handwritten operations.
 *
 * Replace this helper with schema-generated TypedDocumentNode artifacts when the
 * backend schema is available to the frontend build.
 */
export const typedDocument = <
  TData,
  TVariables extends OperationVariables = OperationVariables,
>(document: DocumentNode): TypedDocumentNode<TData, TVariables> =>
  document as TypedDocumentNode<TData, TVariables>;
