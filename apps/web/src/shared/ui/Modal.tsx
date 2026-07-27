import type { ReactNode } from 'react';

import { DialogSurface } from './DialogSurface.js';

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
  return (
    <DialogSurface
      open={open}
      onClose={onClose}
      title={title}
      footer={footer}
      closeLabel={closeLabel}
      closeOnBackdrop={closeOnBackdrop}
      variant="modal"
    >
      {children}
    </DialogSurface>
  );
}
