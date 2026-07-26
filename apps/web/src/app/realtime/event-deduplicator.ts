export class EventDeduplicator {
  private readonly ids = new Set<string>();

  constructor(private readonly maximumSize = 500) {}

  accept(eventId: string): boolean {
    if (this.ids.has(eventId)) return false;
    this.ids.add(eventId);
    while (this.ids.size > this.maximumSize) {
      const oldest = this.ids.values().next().value as string | undefined;
      if (!oldest) break;
      this.ids.delete(oldest);
    }
    return true;
  }

  clear(): void {
    this.ids.clear();
  }
}
