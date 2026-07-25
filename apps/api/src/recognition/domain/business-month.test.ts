import { describe, expect, it } from 'vitest';

import { resolveBusinessMonth } from './business-month.js';

describe('organization business-month resolver', () => {
  it('uses the organization timezone at a month boundary', () => {
    const instant = new Date('2026-07-31T18:00:00.000Z');

    expect(resolveBusinessMonth('UTC', instant)).toBe('2026-07');
    expect(resolveBusinessMonth('Asia/Ho_Chi_Minh', instant)).toBe('2026-08');
  });

  it('can resolve the previous month west of UTC', () => {
    const instant = new Date('2026-08-01T00:30:00.000Z');

    expect(resolveBusinessMonth('UTC', instant)).toBe('2026-08');
    expect(resolveBusinessMonth('America/Los_Angeles', instant)).toBe(
      '2026-07',
    );
  });

  it('uses IANA timezone daylight-saving rules', () => {
    expect(
      resolveBusinessMonth(
        'America/New_York',
        new Date('2026-03-01T04:30:00.000Z'),
      ),
    ).toBe('2026-02');
  });

  it('rejects invalid timezones and instants', () => {
    expect(() => resolveBusinessMonth('Not/A_Timezone', new Date())).toThrow(
      RangeError,
    );
    expect(() => resolveBusinessMonth('UTC', new Date('invalid'))).toThrow(
      RangeError,
    );
  });
});
