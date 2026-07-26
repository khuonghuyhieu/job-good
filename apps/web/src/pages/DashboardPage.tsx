import { Feed } from '../features/feed/Feed.js';
import { GiveKudoComposer } from '../features/give-kudo/GiveKudoComposer.js';

export function DashboardPage() {
  return (
    <div className="dashboard-stack">
      <GiveKudoComposer />
      <Feed />
    </div>
  );
}
