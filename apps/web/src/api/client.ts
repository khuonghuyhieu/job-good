import { parseBrowserConfig } from '@good-job/config/browser';

import { toApiClientError } from './error-adapter.js';

const config = parseBrowserConfig(import.meta.env);

export async function apiRequest<T>(
  path: string,
  init?: RequestInit,
): Promise<T> {
  try {
    const response = await fetch(new URL(path, config.VITE_API_URL), {
      ...init,
      headers: {
        accept: 'application/json',
        ...init?.headers,
      },
    });

    if (!response.ok) {
      throw await toApiClientError(response);
    }
    return (await response.json()) as T;
  } catch (error: unknown) {
    if (error instanceof Error) {
      throw error;
    }
    throw new Error('The request failed.');
  }
}
