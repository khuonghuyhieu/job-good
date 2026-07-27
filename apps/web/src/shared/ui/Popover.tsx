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
    <div className="gj-popover relative inline-block font-gj" ref={rootRef}>
      <button
        ref={triggerRef}
        type="button"
        className="gj-popover__trigger relative grid min-h-11 min-w-11 cursor-pointer place-items-center rounded-full border border-gj-control-border bg-gj-surface text-gj-text focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-gj-focus"
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
          className="gj-popover__panel absolute end-0 z-30 mt-2 w-[min(22rem,calc(100vw-2rem))] rounded-gj-md border border-gj-border bg-gj-surface p-4 font-gj text-gj-text shadow-gj-popover max-mobile:fixed max-mobile:inset-x-4 max-mobile:top-[4.75rem] max-mobile:max-h-[calc(100vh-6rem)] max-mobile:w-auto max-mobile:overflow-auto"
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
