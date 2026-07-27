import { useSession } from '../../app/session/session-context.js';
import { Avatar, Card, Eyebrow, Heading, Text } from '../../shared/ui/index.js';

export function UserSummaryWidget() {
  const session = useSession();
  if (session.status !== 'authenticated') return null;

  const { user, organization } = session.currentUser;
  return (
    <Card
      as="section"
      className="overflow-hidden p-0"
      aria-labelledby="dashboard-user-name"
    >
      <div
        className="h-24 bg-[radial-gradient(circle_at_18%_20%,var(--color-gj-orange),transparent_32%),radial-gradient(circle_at_78%_30%,var(--color-gj-cyan),transparent_28%),linear-gradient(135deg,var(--color-gj-brand-700),var(--color-gj-primary-600))]"
        aria-hidden="true"
      />
      <div className="-mt-12 grid justify-items-center gap-2 px-5 pb-6 text-center">
        <Avatar
          name={user.displayName}
          src={user.avatarUrl}
          size="profile"
          className="border-4 border-white shadow-gj-card"
        />
        <Heading id="dashboard-user-name" level={2} className="text-gj-xl">
          {user.displayName}
        </Heading>
        <Text size="small">{user.team?.name ?? 'Team not assigned'}</Text>
        <Eyebrow className="text-gj-brand-600">{organization.name}</Eyebrow>
      </div>
    </Card>
  );
}
