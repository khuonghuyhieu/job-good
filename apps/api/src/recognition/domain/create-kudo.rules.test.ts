import { describe, expect, it } from 'vitest';

import {
  CreateKudoRuleError,
  validateCreateKudoFacts,
} from './create-kudo.rules.js';

const senderId = '10000000-0000-4000-8000-000000000001';
const receiverId = '10000000-0000-4000-8000-000000000002';

describe('Create Kudo domain rules', () => {
  it('trims and accepts valid recognition facts', () => {
    expect(
      validateCreateKudoFacts({
        senderId,
        receiverId,
        points: 10,
        description: '  Thank you.  ',
      }),
    ).toBe('Thank you.');
    expect(
      validateCreateKudoFacts({
        senderId,
        receiverId,
        points: 50,
        description: 'Excellent work.',
      }),
    ).toBe('Excellent work.');
  });

  it.each([9, 51, 10.5])('rejects invalid points: %s', (points) => {
    expect(() =>
      validateCreateKudoFacts({
        senderId,
        receiverId,
        points,
        description: 'Thank you.',
      }),
    ).toThrow(CreateKudoRuleError);
  });

  it('rejects self-giving and blank descriptions', () => {
    expect(() =>
      validateCreateKudoFacts({
        senderId,
        receiverId: senderId,
        points: 10,
        description: 'Thank you.',
      }),
    ).toThrow(/cannot give a Kudo to themselves/u);
    try {
      validateCreateKudoFacts({
        senderId,
        receiverId,
        points: 10,
        description: '   ',
      });
      throw new Error('Expected blank description validation to fail.');
    } catch (error: unknown) {
      expect(error).toBeInstanceOf(CreateKudoRuleError);
      expect((error as CreateKudoRuleError).fieldErrors).toEqual({
        description: 'Description is required.',
      });
    }
  });
});
