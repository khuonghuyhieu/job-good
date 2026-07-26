import { describe, expect, it } from 'vitest';

import { hashCreateKudoRequest } from './request-hash.js';

const receiverId = '10000000-0000-4000-8000-000000000001';
const coreValueId = '20000000-0000-4000-8000-000000000001';

describe('Create Kudo request hash', () => {
  it('is stable for the same semantic command', () => {
    expect(
      hashCreateKudoRequest({
        receiverId,
        points: 30,
        coreValueId,
        description: '  Thank you.  ',
      }),
    ).toBe(
      hashCreateKudoRequest({
        receiverId,
        points: 30,
        coreValueId,
        description: 'Thank you.',
      }),
    );
  });

  it('changes for every command-defining field', () => {
    const base = {
      receiverId,
      points: 30,
      coreValueId,
      description: 'Thank you.',
    };
    const hash = hashCreateKudoRequest(base);

    expect(
      new Set([
        hash,
        hashCreateKudoRequest({ ...base, receiverId: coreValueId }),
        hashCreateKudoRequest({ ...base, points: 40 }),
        hashCreateKudoRequest({ ...base, coreValueId: receiverId }),
        hashCreateKudoRequest({ ...base, description: 'Different.' }),
        hashCreateKudoRequest({
          ...base,
          attachmentIds: ['30000000-0000-4000-8000-000000000001'],
        }),
      ]).size,
    ).toBe(6);
  });
});
