export type CreateKudoErrorCode =
  | 'CORE_VALUE_UNAVAILABLE'
  | 'IDEMPOTENCY_CONFLICT'
  | 'INSUFFICIENT_GIVING_BUDGET'
  | 'RESOURCE_NOT_FOUND'
  | 'SELF_RECOGNITION_NOT_ALLOWED'
  | 'UNAUTHENTICATED'
  | 'VALIDATION_ERROR';

export class CreateKudoRuleError extends Error {
  constructor(
    readonly status: number,
    readonly code: CreateKudoErrorCode,
    message: string,
    readonly fieldErrors?: Record<string, string>,
    readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'CreateKudoRuleError';
  }
}

export function validateCreateKudoFacts(input: {
  senderId: string;
  receiverId: string;
  points: number;
  description: string;
}): string {
  if (input.senderId === input.receiverId) {
    throw new CreateKudoRuleError(
      409,
      'SELF_RECOGNITION_NOT_ALLOWED',
      'An employee cannot give a Kudo to themselves.',
    );
  }
  if (
    !Number.isInteger(input.points) ||
    input.points < 10 ||
    input.points > 50
  ) {
    throw new CreateKudoRuleError(
      400,
      'VALIDATION_ERROR',
      'The Kudo request is invalid.',
      { points: 'Points must be an integer between 10 and 50.' },
    );
  }
  const description = input.description.trim();
  if (!description) {
    throw new CreateKudoRuleError(
      400,
      'VALIDATION_ERROR',
      'The Kudo request is invalid.',
      { description: 'Description is required.' },
    );
  }
  return description;
}
