import { apiErrorSchema } from '@good-job/contracts';

export class ApiClientError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code: string,
    readonly requestId?: string,
  ) {
    super(message);
    this.name = 'ApiClientError';
  }
}

export async function toApiClientError(
  response: Response,
): Promise<ApiClientError> {
  const body: unknown = await response.json().catch(() => null);
  const parsed = apiErrorSchema.safeParse(body);

  if (parsed.success) {
    return new ApiClientError(
      parsed.data.message,
      response.status,
      parsed.data.code,
      parsed.data.requestId,
    );
  }

  return new ApiClientError(
    'The service could not complete the request.',
    response.status,
    'UNEXPECTED_RESPONSE',
  );
}
