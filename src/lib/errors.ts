export const getErrorMessage = (error: unknown, fallback: string): string => {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  if (typeof error === 'object' && error !== null && 'message' in error) {
    const message = Reflect.get(error, 'message');
    if (typeof message === 'string' && message.trim()) {
      return message;
    }
  }

  return fallback;
};

export const getGraphQLErrorMessage = (error: unknown, fallback: string): string => {
  if (typeof error === 'object' && error !== null && 'graphQLErrors' in error) {
    const graphQLErrors = Reflect.get(error, 'graphQLErrors');
    if (Array.isArray(graphQLErrors)) {
      const firstError = graphQLErrors[0];
      if (typeof firstError === 'object' && firstError !== null && 'message' in firstError) {
        const message = Reflect.get(firstError, 'message');
        if (typeof message === 'string' && message.trim()) {
          return message;
        }
      }
    }
  }

  return getErrorMessage(error, fallback);
};

export interface MutationResult {
  success: boolean;
  message?: string | null;
}

export const requireMutationSuccess = <T extends MutationResult>(
  payload: T | null | undefined,
  fallback: string,
): T => {
  if (!payload?.success) {
    throw new Error(payload?.message?.trim() || fallback);
  }

  return payload;
};
