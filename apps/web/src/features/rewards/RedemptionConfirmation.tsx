import { useRef } from 'react';
import { createPortal } from 'react-dom';

import { Button, Eyebrow, Heading } from '../../shared/ui/index.js';
import { useDialogAccessibility } from '../../shared/ui/use-dialog-accessibility.js';

interface RedemptionConfirmationProps {
  open: boolean;
  rewardName: string;
  costPoints: number;
  currentBalance: number;
  pending: boolean;
  checking: boolean;
  errorMessage?: string | undefined;
  onClose: () => void;
  onConfirm: () => void;
}

export function RedemptionConfirmation({
  open,
  rewardName,
  costPoints,
  currentBalance,
  pending,
  checking,
  errorMessage,
  onClose,
  onConfirm,
}: RedemptionConfirmationProps) {
  const dialog = useRef<HTMLDivElement>(null);
  const closeIfSafe = () => {
    if (!pending && !checking) onClose();
  };
  useDialogAccessibility({
    open,
    containerRef: dialog,
    onClose: closeIfSafe,
  });

  if (!open) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-40 grid place-items-center bg-gj-overlay p-4 max-mobile:items-end max-mobile:p-0"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) closeIfSafe();
      }}
    >
      <div
        ref={dialog}
        className="confirmation-dialog max-h-[85vh] w-full max-w-lg overflow-auto rounded-gj-lg bg-white p-6 shadow-gj-popover max-mobile:max-h-[92vh] max-mobile:rounded-b-none"
        role="dialog"
        aria-modal="true"
        aria-labelledby="redeem-title"
        tabIndex={-1}
      >
        <Eyebrow>Reward Points</Eyebrow>
        <Heading id="redeem-title" level={2} className="mt-2">
          {checking ? 'Check redemption result' : 'Confirm redemption'}
        </Heading>
        <p className="mt-4">
          Redeem {rewardName} for {costPoints} Reward Points?
        </p>
        <div className="grid grid-cols-2 gap-3 rounded-gj-md bg-gj-surface-subtle p-4">
          <span className="text-gj-sm text-gj-text-secondary">
            Current balance
            <strong className="block text-gj-lg text-gj-brand-700">
              {currentBalance}
            </strong>
          </span>
          <span className="text-gj-sm text-gj-text-secondary">
            Expected balance
            <strong className="block text-gj-lg text-gj-brand-700">
              {currentBalance - costPoints}
            </strong>
          </span>
        </div>
        <p className="text-gj-xs text-gj-text-muted">
          The server will confirm your latest balance before committing.
        </p>
        {checking && (
          <div
            className="mb-4 rounded-gj-sm bg-gj-warning-subtle p-4 text-gj-sm text-gj-warning"
            role="status"
          >
            The previous result is unknown. Checking reuses the same safe
            request and cannot start another logical redemption.
          </div>
        )}
        {errorMessage && (
          <p
            className="rounded-gj-sm bg-gj-danger-subtle p-4 text-gj-sm text-gj-danger"
            role="alert"
          >
            {errorMessage}
          </p>
        )}
        <div className="flex justify-end gap-3 max-mobile:flex-col-reverse">
          <Button
            type="button"
            pending={pending}
            pendingLabel={checking ? 'Checking redemption…' : 'Redeeming…'}
            onClick={onConfirm}
          >
            {checking ? 'Check redemption result' : 'Confirm redemption'}
          </Button>
          <Button
            variant="secondary"
            type="button"
            disabled={pending || checking}
            onClick={closeIfSafe}
          >
            Cancel
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
