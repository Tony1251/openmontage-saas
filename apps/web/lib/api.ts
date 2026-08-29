import axios, { AxiosError } from 'axios';

const baseURL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000';

export const api = axios.create({ baseURL, timeout: 60_000 });

export class ApiError extends Error {
  constructor(public code: string, message: string, public status: number) {
    super(message);
  }
}

// Structured 402 body from docs/PRICING.md §5.1.
export class InsufficientCreditsError extends ApiError {
  constructor(
    message: string,
    public credits_required: number,
    public credits_available: number,
  ) {
    super('insufficient_credits', message, 402);
  }
}

interface ApiErrorBody {
  code?: string;
  error?: string;
  message?: string;
  credits_required?: number;
  credits_available?: number;
}

api.interceptors.response.use(
  (r) => r,
  (err: AxiosError<ApiErrorBody>) => {
    const data = err.response?.data;
    const status = err.response?.status ?? 0;
    const code = data?.code ?? data?.error ?? 'unknown';
    const message = data?.message ?? err.message;

    if (status === 402 && code === 'insufficient_credits') {
      throw new InsufficientCreditsError(
        message,
        data?.credits_required ?? 0,
        data?.credits_available ?? 0,
      );
    }
    throw new ApiError(code, message, status);
  },
);

export async function withAuth<T>(getToken: () => Promise<string | null>, fn: (token: string) => Promise<T>): Promise<T> {
  const token = await getToken();
  if (!token) throw new ApiError('unauthorized', 'Not signed in', 401);
  api.defaults.headers.common.Authorization = `Bearer ${token}`;
  return fn(token);
}
