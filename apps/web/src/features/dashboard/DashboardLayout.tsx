import type { ReactNode } from 'react';

export function DashboardLayout({
  personal,
  primary,
  feed,
  community,
}: {
  personal: ReactNode;
  primary: ReactNode;
  feed: ReactNode;
  community: ReactNode;
}) {
  return (
    <div
      className="gj-dashboard mx-auto grid w-full max-w-[96rem] grid-cols-[minmax(13.5rem,0.72fr)_minmax(0,1.75fr)_minmax(15rem,0.86fr)] items-start gap-x-7 gap-y-6 max-tablet:grid-cols-2 max-tablet:gap-6 max-mobile:grid-cols-1 max-mobile:gap-5"
      data-testid="dashboard-layout"
    >
      <aside
        className="gj-dashboard__personal row-span-2 grid min-w-0 gap-5 self-start max-tablet:order-2 max-tablet:col-span-2 max-tablet:grid-cols-3 max-mobile:col-span-1 max-mobile:grid-cols-1"
        aria-label="Your recognition summary"
      >
        {personal}
      </aside>
      <section
        className="gj-dashboard__primary col-start-2 row-start-1 grid min-w-0 gap-6 max-tablet:order-1 max-tablet:col-span-2 max-tablet:col-start-auto max-tablet:row-start-auto max-mobile:col-span-1"
        aria-label="Give recognition"
      >
        {primary}
      </section>
      <section
        className="gj-dashboard__feed col-start-2 row-start-2 min-w-0 max-tablet:order-3 max-tablet:col-span-2 max-tablet:col-start-auto max-tablet:row-start-auto max-mobile:col-span-1"
        aria-label="Recognition activity"
      >
        {feed}
      </section>
      <aside
        className="gj-dashboard__community col-start-3 row-span-2 row-start-1 grid min-w-0 gap-5 self-start max-tablet:order-4 max-tablet:col-span-2 max-tablet:col-start-auto max-tablet:row-start-auto max-tablet:grid-cols-2 max-tablet:[&>*:first-child]:col-span-2 max-mobile:col-span-1 max-mobile:grid-cols-1 max-mobile:[&>*:first-child]:col-span-1"
        aria-label="Community highlights"
      >
        {community}
      </aside>
    </div>
  );
}
