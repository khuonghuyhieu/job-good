import { type ReactNode, useId, useRef } from 'react';
import { createPortal } from 'react-dom';

import { classNames } from './class-names.js';
import { useDialogAccessibility } from './use-dialog-accessibility.js';

const overlayPlacement = {
  modal: 'gj-overlay--center place-items-center',
  left: 'gj-overlay--drawer-left justify-items-start p-0',
  right: 'gj-overlay--drawer-right justify-items-end p-0',
} as const;

interface DialogSurfaceProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
  closeLabel: string;
  variant: 'modal' | 'drawer';
  side?: 'left' | 'right';
  closeOnBackdrop?: boolean;
}

export function DialogSurface({
  open,
  onClose,
  title,
  children,
  footer,
  closeLabel,
  variant,
  side = 'right',
  closeOnBackdrop = true,
}: DialogSurfaceProps) {
  const titleId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  useDialogAccessibility({ open, containerRef: dialogRef, onClose });

  if (!open) return null;

  const isDrawer = variant === 'drawer';

  return createPortal(
    <div
      className={classNames(
        'gj-overlay fixed inset-0 z-40 grid bg-gj-overlay p-4',
        isDrawer ? overlayPlacement[side] : overlayPlacement.modal,
      )}
      onMouseDown={(event) => {
        if (closeOnBackdrop && event.target === event.currentTarget) onClose();
      }}
    >
      <div
        ref={dialogRef}
        className={classNames(
          'gj-dialog relative max-h-[min(85vh,50rem)] w-full max-w-xl overflow-auto rounded-gj-lg bg-gj-surface p-6 font-gj text-gj-text shadow-gj-popover',
          isDrawer &&
            'gj-drawer h-full max-h-none w-full max-w-md rounded-none',
        )}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
      >
        <header className="gj-dialog__header mb-4 flex items-start justify-between gap-4">
          <h2 className="gj-dialog__title m-0 text-gj-xl" id={titleId}>
            {title}
          </h2>
          <button
            type="button"
            className="gj-dialog__close min-h-11 min-w-11 cursor-pointer rounded-full border border-gj-control-border bg-gj-surface text-gj-text focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-gj-focus"
            aria-label={closeLabel}
            onClick={onClose}
          >
            <span aria-hidden="true">×</span>
          </button>
        </header>
        {children}
        {footer && (
          <footer className="gj-dialog__footer mt-6 flex justify-end gap-3">
            {footer}
          </footer>
        )}
      </div>
    </div>,
    document.body,
  );
}
