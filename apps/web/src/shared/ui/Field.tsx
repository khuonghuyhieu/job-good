import {
  createContext,
  forwardRef,
  type InputHTMLAttributes,
  type PropsWithChildren,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
  useContext,
  useId,
} from 'react';

import { classNames } from './class-names.js';

const controlClass =
  'gj-field-control min-h-11 w-full rounded-gj-sm border border-gj-control-border bg-gj-surface px-3 font-inherit text-gj-text transition duration-150 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-gj-focus disabled:cursor-not-allowed disabled:bg-gj-surface-subtle disabled:text-gj-text-muted aria-invalid:border-gj-danger aria-invalid:ring-2 aria-invalid:ring-gj-danger/10';

interface FieldContextValue {
  controlId: string;
  describedBy: string | undefined;
  invalid: boolean;
  required: boolean;
}

const FieldContext = createContext<FieldContextValue | null>(null);

interface FieldProps {
  id?: string;
  label: string;
  hint?: string;
  error?: string;
  required?: boolean;
  className?: string;
}

export function Field({
  id,
  label,
  hint,
  error,
  required = false,
  className,
  children,
}: PropsWithChildren<FieldProps>) {
  const generatedId = useId();
  const controlId = id ?? `field-${generatedId}`;
  const hintId = hint ? `${controlId}-hint` : undefined;
  const errorId = error ? `${controlId}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(' ') || undefined;

  return (
    <div
      className={classNames(
        'gj-field grid gap-2 font-gj text-gj-text',
        className,
      )}
    >
      <label
        className="gj-field__label text-gj-sm font-bold"
        htmlFor={controlId}
      >
        {label}
        {required && (
          <span
            className="gj-field__required text-gj-danger"
            aria-hidden="true"
          >
            {' '}
            *
          </span>
        )}
      </label>
      <FieldContext.Provider
        value={{
          controlId,
          describedBy,
          invalid: Boolean(error),
          required,
        }}
      >
        {children}
      </FieldContext.Provider>
      {hint && (
        <p
          className="gj-field__hint m-0 text-gj-xs leading-[1.45] text-gj-text-muted"
          id={hintId}
        >
          {hint}
        </p>
      )}
      {error && (
        <p
          className="gj-field__error m-0 text-gj-xs leading-[1.45] font-semibold text-gj-danger"
          id={errorId}
          role="alert"
        >
          {error}
        </p>
      )}
    </div>
  );
}

function useControlProps(
  id: string | undefined,
  describedBy: string | undefined,
  invalid: boolean | 'false' | 'true' | 'grammar' | 'spelling' | undefined,
  required: boolean | undefined,
) {
  const field = useContext(FieldContext);
  const combinedDescriptions = [field?.describedBy, describedBy]
    .flatMap((value) => value?.split(/\s+/) ?? [])
    .filter((value, index, values) => value && values.indexOf(value) === index)
    .join(' ');
  return {
    id: id ?? field?.controlId,
    'aria-describedby': combinedDescriptions || undefined,
    'aria-invalid': field?.invalid ? true : invalid,
    required: Boolean(field?.required || required),
  };
}

export const TextInput = forwardRef<
  HTMLInputElement,
  InputHTMLAttributes<HTMLInputElement>
>(function TextInput(
  {
    className,
    id,
    'aria-describedby': describedBy,
    'aria-invalid': invalid,
    required,
    ...props
  },
  ref,
) {
  return (
    <input
      ref={ref}
      className={classNames(controlClass, className)}
      {...useControlProps(id, describedBy, invalid, required)}
      {...props}
    />
  );
});

export const TextArea = forwardRef<
  HTMLTextAreaElement,
  TextareaHTMLAttributes<HTMLTextAreaElement>
>(function TextArea(
  {
    className,
    id,
    'aria-describedby': describedBy,
    'aria-invalid': invalid,
    required,
    ...props
  },
  ref,
) {
  return (
    <textarea
      ref={ref}
      className={classNames(controlClass, 'min-h-28 resize-y py-3', className)}
      {...useControlProps(id, describedBy, invalid, required)}
      {...props}
    />
  );
});

export const Select = forwardRef<
  HTMLSelectElement,
  SelectHTMLAttributes<HTMLSelectElement>
>(function Select(
  {
    className,
    id,
    'aria-describedby': describedBy,
    'aria-invalid': invalid,
    required,
    ...props
  },
  ref,
) {
  return (
    <select
      ref={ref}
      className={classNames(controlClass, className)}
      {...useControlProps(id, describedBy, invalid, required)}
      {...props}
    />
  );
});
