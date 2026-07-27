import { type ReactNode, useEffect, useId, useRef, useState } from 'react';

interface PopoverProps {
  triggerLabel: string;
  trigger: ReactNode;
  children: ReactNode;
  panelLabel: string;
}

export function Popover({
  triggerLabel,
  trigger,
  children,
  panelLabel,
}: PopoverProps) {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handlePointerDown = (event: PointerEvent) => {
      if (
        event.target instanceof Node &&
        !rootRef.current?.contains(event.target)
      ) {
        setOpen(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      setOpen(false);
      triggerRef.current?.focus();
    };
    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open]);

  return (
    <div className="gj-popover" ref={rootRef}>
      <button
        ref={triggerRef}
        type="button"
        className="gj-popover__trigger"
        aria-label={triggerLabel}
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        onClick={() => setOpen((current) => !current)}
        onKeyDown={(event) => {
          if (event.key === 'ArrowDown' && !open) {
            event.preventDefault();
            setOpen(true);
            requestAnimationFrame(() => {
              panelRef.current
                ?.querySelector<HTMLElement>(
                  'button, a[href], input, [tabindex]:not([tabindex="-1"])',
                )
                ?.focus();
            });
          }
        }}
      >
        <span aria-hidden="true">{trigger}</span>
      </button>
      {open && (
        <div
          ref={panelRef}
          className="gj-popover__panel"
          id={panelId}
          role="dialog"
          aria-label={panelLabel}
        >
          {children}
        </div>
      )}
    </div>
  );
}
