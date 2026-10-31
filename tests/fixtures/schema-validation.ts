import {
  buildSchema,
  getOperationAST,
  getVariableValues,
  parse,
  validate,
  type DocumentNode,
} from 'graphql';

/**
 * Checks a GraphQL request the way the backend would: the document against the
 * schema (fields, arguments, variable types) and the variables against their
 * declared types (an Int variable given 12.5 is refused, as the server does).
 * Returns the problems; an empty list means the server would accept it.
 *
 * Used by the schema spec and by both mocked GraphQL layers (e2e + component
 * tests) with tests/fixtures/superadmin-schema.graphql, so a mock can't accept
 * a request the real API refuses.
 */
export const createSchemaValidator = (sdl: string) => {
  const schema = buildSchema(sdl);
  const parseDocument = (query: string | DocumentNode): DocumentNode | string => {
    try {
      return typeof query === 'string' ? parse(query) : query;
    } catch (error) {
      return error instanceof Error ? error.message : String(error);
    }
  };
  /** The document alone: fields, arguments, variable types. */
  const document = (query: string | DocumentNode): string[] => {
    const parsed = parseDocument(query);
    if (typeof parsed === 'string') return [parsed];
    return validate(schema, parsed).map((error) => error.message);
  };
  /** A whole request: the document, then the variables against their declared types. */
  const request = (
    query: string | DocumentNode,
    variables: Record<string, unknown> | null | undefined = {},
    operationName?: string | null,
  ): string[] => {
    const parsed = parseDocument(query);
    if (typeof parsed === 'string') return [parsed];
    const errors = validate(schema, parsed).map((error) => error.message);
    if (errors.length) return errors;
    const operation = getOperationAST(parsed, operationName || undefined);
    if (!operation) return ['The document has no (single) operation to run.'];
    const coerced = getVariableValues(schema, operation.variableDefinitions ?? [], variables ?? {});
    return 'errors' in coerced && coerced.errors ? coerced.errors.map((error) => error.message) : [];
  };
  return { document, request };
};

export const operationNameOf = (query: string | DocumentNode): string => {
  try {
    const document = typeof query === 'string' ? parse(query) : query;
    return getOperationAST(document)?.name?.value || '(anonymous)';
  } catch {
    return '(unparsable)';
  }
};
