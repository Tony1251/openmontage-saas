import { toast } from 'sonner';

interface ApiErrorResponse {
  error?: string;
  message?: string;
  detail?: string;
}

/**
 * Type guard for API error responses.
 */
export function isApiError(error: unknown): error is { code: string; message: string; status: number } {
  if (!error || typeof error !== 'object') return false;
  const e = error as Record<string, unknown>;
  return typeof e.code === 'string' && typeof e.message === 'string' && typeof e.status === 'number';
}

/**
 * Extract a human-readable error message from any error shape.
 */
export function getErrorMessage(error: unknown): string {
  if (typeof error === 'string') return error;
  if (!error || typeof error !== 'object') return 'An unexpected error occurred';

  const e = error as Record<string, unknown>;

  // Axios-style error
  if (typeof e.message === 'string') {
    // Check for nested response data
    if (e.response && typeof e.response === 'object') {
      const resp = e.response as Record<string, unknown>;
      if (resp.data && typeof resp.data === 'object') {
        const data = resp.data as ApiErrorResponse;
        return data.detail || data.message || data.error || String(e.message);
      }
    }
    return e.message;
  }

  // ApiError class
  if (typeof e.code === 'string' && typeof e.status === 'number') {
    return String(e.message || e.code);
  }

  // Error instance
  if (e instanceof Error) return e.message;

  // Fallback
  try {
    return JSON.stringify(error);
  } catch {
    return 'An unexpected error occurred';
  }
}

/**
 * Handle an API error and show appropriate toast notification.
 * Returns the error message for further processing.
 */
export function handleApiError(error: unknown): string {
  const message = getErrorMessage(error);
  const code = isApiError(error) ? error.code : 'error';

  // Map status codes to toast types
  const status = isApiError(error) ? error.status : 0;

  if (status === 401) {
    toast.error('Authentication required', {
      description: 'Please sign in to continue.',
    });
  } else if (status === 403) {
    toast.error('Access denied', {
      description: 'You do not have permission to perform this action.',
    });
  } else if (status === 404) {
    toast.error('Not found', {
      description: 'The requested resource was not found.',
    });
  } else if (status === 409) {
    toast.error('Conflict', {
      description: message,
    });
  } else if (status === 429) {
    toast.error('Rate limit exceeded', {
      description: 'Please wait a moment and try again.',
    });
  } else if (status >= 500) {
    toast.error('Server error', {
      description: 'Something went wrong on our end. Please try again later.',
    });
  } else {
    toast.error(code, {
      description: message,
    });
  }

  return message;
}
