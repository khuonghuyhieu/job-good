import {
  ColleaguesWidget,
  FeaturedRewardsWidget,
} from '../features/dashboard/CommunityWidgets.js';
import { DashboardLayout } from '../features/dashboard/DashboardLayout.js';
import { QuickNotificationsWidget } from '../features/dashboard/QuickNotificationsWidget.js';
import { UserSummaryWidget } from '../features/dashboard/UserSummaryWidget.js';
import { Feed } from '../features/feed/Feed.js';
import { GiveKudoComposer } from '../features/give-kudo/GiveKudoComposer.js';
import { DashboardPointsSummary } from '../features/wallet/DashboardPointsSummary.js';

export function DashboardPage() {
  return (
    <DashboardLayout
      personal={
        <>
          <UserSummaryWidget />
          <DashboardPointsSummary />
        </>
      }
      primary={
        <>
          <header className="grid gap-2">
            <p className="m-0 text-gj-xs font-extrabold tracking-[0.12em] text-gj-primary-600 uppercase">
              Good Job community
            </p>
            <h1 className="m-0 text-gj-3xl leading-tight font-extrabold tracking-[-0.03em] text-gj-brand-700">
              What’s worth celebrating?
            </h1>
            <p className="m-0 text-gj-sm text-gj-text-secondary">
              Recognize meaningful work and celebrate your colleagues.
            </p>
          </header>
          <GiveKudoComposer showBudgetSummary={false} compact />
        </>
      }
      feed={<Feed />}
      community={
        <>
          <QuickNotificationsWidget />
          <ColleaguesWidget />
          <FeaturedRewardsWidget />
        </>
      }
    />
  );
}
