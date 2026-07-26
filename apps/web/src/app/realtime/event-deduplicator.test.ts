import { describe, expect, it } from 'vitest';

import { EventDeduplicator } from './event-deduplicator.js';

describe('realtime event deduplication', () => {
  it('accepts each retained event once and evicts with a bound', () => {
    const dedupe = new EventDeduplicator(2);
    expect(dedupe.accept('one')).toBe(true);
    expect(dedupe.accept('one')).toBe(false);
    expect(dedupe.accept('two')).toBe(true);
    expect(dedupe.accept('three')).toBe(true);
    expect(dedupe.accept('one')).toBe(true);
  });

  it('clears protected event history on session change', () => {
    const dedupe = new EventDeduplicator();
    expect(dedupe.accept('event')).toBe(true);
    dedupe.clear();
    expect(dedupe.accept('event')).toBe(true);
  });
});
