import { Avatar, Button, Popover, Text } from '../shared/ui/index.js';

interface AccountMenuProps {
  displayName: string;
  organizationName: string;
  avatarUrl?: string | null;
  logoutPending: boolean;
  onLogout: () => void;
}

export function AccountMenu({
  displayName,
  organizationName,
  avatarUrl,
  logoutPending,
  onLogout,
}: AccountMenuProps) {
  return (
    <div className="gj-account-menu">
      <Popover
        triggerLabel={`Open account menu for ${displayName}`}
        panelLabel="Account menu"
        trigger={
          <Avatar
            className="gj-account-menu__avatar border-0"
            name={displayName}
            src={avatarUrl ?? null}
          />
        }
      >
        <div className="gj-account-menu__panel grid min-w-60 gap-4 [&_.gj-button]:w-full">
          <div>
            <strong>{displayName}</strong>
            <Text size="small" muted>
              {organizationName}
            </Text>
          </div>
          <Button
            variant="secondary"
            pending={logoutPending}
            pendingLabel="Signing out…"
            onClick={onLogout}
          >
            Sign out
          </Button>
        </div>
      </Popover>
    </div>
  );
}
