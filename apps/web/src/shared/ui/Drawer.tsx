import { type ReactNode, useId, useRef } from 'react';
import { createPortal } from 'react-dom';

import { classNames } from './class-names.js';
import { useDialogAccessibility } from './use-dialog-accessibility.js';

interface DrawerProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  side?: 'left' | 'right';
  closeLabel?: string;
}

export function Drawer({
  open,
  onClose,
  title,
  children,
  side = 'right',
  closeLabel = 'Close panel',
}: DrawerProps) {
  const titleId = useId();
  const drawerRef = useRef<HTMLDivElement>(null);
  useDialogAccessibility({ open, containerRef: drawerRef, onClose });

  if (!open) return null;

  return createPortal(
    <div
      className={classNames('gj-overlay', `gj-overlay--drawer-${side}`)}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <aside
        ref={drawerRef}
        className="gj-dialog gj-drawer"
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
      </aside>
    </div>,
    document.body,
  );
}
