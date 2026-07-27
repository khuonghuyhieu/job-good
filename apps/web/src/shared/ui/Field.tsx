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
    <div className={classNames('gj-field', className)}>
      <label className="gj-field__label" htmlFor={controlId}>
        {label}
        {required && (
          <span className="gj-field__required" aria-hidden="true">
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
        <p className="gj-field__hint" id={hintId}>
          {hint}
        </p>
      )}
      {error && (
        <p className="gj-field__error" id={errorId} role="alert">
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
  return {
    id: id ?? field?.controlId,
    'aria-describedby': describedBy ?? field?.describedBy,
    'aria-invalid': invalid ?? (field?.invalid || undefined),
    required: required ?? field?.required,
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
      className={classNames('gj-field-control', className)}
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
      className={classNames('gj-field-control', className)}
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
      className={classNames('gj-field-control', className)}
      {...useControlProps(id, describedBy, invalid, required)}
      {...props}
    />
  );
});
