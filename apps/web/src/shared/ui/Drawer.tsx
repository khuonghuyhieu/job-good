import type { ReactNode } from 'react';

import { DialogSurface } from './DialogSurface.js';

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
  return (
    <DialogSurface
      open={open}
      onClose={onClose}
      title={title}
      closeLabel={closeLabel}
      variant="drawer"
      side={side}
    >
      {children}
    </DialogSurface>
  );
}
