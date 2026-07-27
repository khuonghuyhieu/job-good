import { AppLogo } from './AppLogo.js';
import { ErrorState, LoadingState } from '../shared/ui/index.js';

interface SystemStatePageProps {
  state: 'loading' | 'error';
  title: string;
  description: string;
  actionLabel?: string;
  actionPending?: boolean;
  onAction?: () => void;
}

export function SystemStatePage({
  state,
  title,
  description,
  actionLabel,
  actionPending = false,
  onAction,
}: SystemStatePageProps) {
  return (
    <main className="gj-system-state grid min-h-screen place-content-center place-items-center gap-8 bg-gj-canvas bg-gj-system-state p-6">
      <AppLogo />
      <section
        className="gj-system-state__surface w-full max-w-[30rem] [&_.gj-feedback]:min-h-56 [&_.gj-feedback]:content-center [&_.gj-feedback]:justify-items-center [&_.gj-feedback]:border [&_.gj-feedback]:border-gj-border [&_.gj-feedback]:bg-gj-surface [&_.gj-feedback]:p-8 [&_.gj-feedback]:text-center [&_.gj-feedback]:shadow-gj-card"
        aria-label={title}
      >
        {state === 'loading' ? (
          <LoadingState title={title} description={description} />
        ) : (
          <ErrorState
            title={title}
            description={description}
            actionPending={actionPending}
            {...(actionLabel ? { actionLabel } : {})}
            {...(onAction ? { onAction } : {})}
          />
        )}
      </section>
    </main>
  );
}
