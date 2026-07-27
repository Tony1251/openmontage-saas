import axios, { AxiosError } from 'axios';

const baseURL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000';

export const api = axios.create({ baseURL, timeout: 60_000 });

export class ApiError extends Error {
  constructor(public code: string, message: string, public status: number) {
    super(message);
  }
}

api.interceptors.response.use(
  (r) => r,
  (err: AxiosError<{ error?: string; message?: string }>) => {
    const data = err.response?.data;
    throw new ApiError(data?.error ?? 'unknown', data?.message ?? err.message, err.response?.status ?? 0);
  },
);

export async function withAuth<T>(getToken: () => Promise<string | null>, fn: (token: string) => Promise<T>): Promise<T> {
  const token = await getToken();
  if (!token) throw new ApiError('unauthorized', 'Not signed in', 401);
  api.defaults.headers.common.Authorization = `Bearer ${token}`;
  return fn(token);
}
