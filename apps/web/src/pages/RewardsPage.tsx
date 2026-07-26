import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';

import { getRewards, rewardsQueryKey } from '../features/rewards/api.js';
import { RedemptionHistory } from '../features/rewards/RedemptionHistory.js';

export function RewardsPage() {
  const rewards = useQuery({ queryKey: rewardsQueryKey, queryFn: getRewards });
  return (
    <section className="rewards-page">
      <header>
        <p className="eyebrow">Reward Points</p>
        <h1>Reward Catalog</h1>
        <p>Redeem the Reward Points you have earned from committed Kudos.</p>
      </header>
      {rewards.isPending ? (
        <p role="status">Loading rewards…</p>
      ) : rewards.isError ? (
        <div role="alert">
          <p>The Reward Catalog is temporarily unavailable.</p>
          <button type="button" onClick={() => void rewards.refetch()}>
            Retry catalog
          </button>
        </div>
      ) : rewards.data.items.length === 0 ? (
        <p>No active rewards are available right now.</p>
      ) : (
        <ul className="reward-grid">
          {rewards.data.items.map((reward) => (
            <li key={reward.id} className="reward-card">
              <h2>{reward.name}</h2>
              <p>{reward.description ?? 'More details coming soon.'}</p>
              <strong>{reward.costPoints} Reward Points</strong>
              <Link to={`/rewards/${reward.id}`}>View reward</Link>
            </li>
          ))}
        </ul>
      )}
      <RedemptionHistory />
    </section>
  );
}
