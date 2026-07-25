const businessMonthFormatters = new Map<string, Intl.DateTimeFormat>();

function formatterFor(timeZone: string): Intl.DateTimeFormat {
  const existing = businessMonthFormatters.get(timeZone);
  if (existing) {
    return existing;
  }

  const formatter = new Intl.DateTimeFormat('en-US-u-ca-gregory-nu-latn', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
  });
  businessMonthFormatters.set(timeZone, formatter);
  return formatter;
}

export function resolveBusinessMonth(
  timeZone: string,
  instant = new Date(),
): string {
  if (Number.isNaN(instant.getTime())) {
    throw new RangeError('The business-month instant is invalid.');
  }

  const parts = formatterFor(timeZone).formatToParts(instant);
  const year = parts.find((part) => part.type === 'year')?.value;
  const month = parts.find((part) => part.type === 'month')?.value;
  if (!year || !month) {
    throw new RangeError('The business month could not be resolved.');
  }
  return `${year}-${month}`;
}
