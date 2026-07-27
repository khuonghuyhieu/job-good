import { type ReactNode, useId, useRef } from 'react';
import { createPortal } from 'react-dom';

import { useDialogAccessibility } from './use-dialog-accessibility.js';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
  closeLabel?: string;
  closeOnBackdrop?: boolean;
}

export function Modal({
  open,
  onClose,
  title,
  children,
  footer,
  closeLabel = 'Close dialog',
  closeOnBackdrop = true,
}: ModalProps) {
  const titleId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  useDialogAccessibility({ open, containerRef: dialogRef, onClose });

  if (!open) return null;

  return createPortal(
    <div
      className="gj-overlay gj-overlay--center"
      onMouseDown={(event) => {
        if (closeOnBackdrop && event.target === event.currentTarget) onClose();
      }}
    >
      <div
        ref={dialogRef}
        className="gj-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
      >
        <header className="gj-dialog__header">
          <h2 className="gj-dialog__title" id={titleId}>
            {title}
          </h2>
          <button
            type="button"
            className="gj-dialog__close"
            aria-label={closeLabel}
            onClick={onClose}
          >
            <span aria-hidden="true">×</span>
          </button>
        </header>
        {children}
        {footer && <footer className="gj-dialog__footer">{footer}</footer>}
      </div>
    </div>,
    document.body,
  );
}
