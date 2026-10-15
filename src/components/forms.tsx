'use client';

import { useFormStatus } from 'react-dom';
import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from 'react';

type Base = { name: string; label: ReactNode; error?: string; help?: ReactNode; required?: boolean };

function Wrap({ id, label, error, help, required, children }: Base & { id: string; children: ReactNode }) {
  return (
    <div>
      <label className="label" htmlFor={id}>
        {label}
        {required ? (
          <span className="text-red" aria-hidden="true">
            {' '}
            *
          </span>
        ) : null}
      </label>
      {children}
      {help && !error ? (
        <p className="help m-0" id={`${id}-help`}>
          {help}
        </p>
      ) : null}
      {error ? (
        <p className="error-text m-0" id={`${id}-error`}>
          {error}
        </p>
      ) : null}
    </div>
  );
}

const describedBy = (id: string, error?: string, help?: ReactNode) => (error ? `${id}-error` : help ? `${id}-help` : undefined);

export function TextField({ name, label, error, help, required, id, ...rest }: Base & InputHTMLAttributes<HTMLInputElement>) {
  const fid = id ?? `f-${name}`;
  return (
    <Wrap id={fid} name={name} label={label} error={error} help={help} required={required}>
      <input
        id={fid}
        name={name}
        className="field"
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(fid, error, help)}
        aria-required={required || undefined}
        {...rest}
      />
    </Wrap>
  );
}

export function TextArea({ name, label, error, help, required, id, ...rest }: Base & TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const fid = id ?? `f-${name}`;
  return (
    <Wrap id={fid} name={name} label={label} error={error} help={help} required={required}>
      <textarea
        id={fid}
        name={name}
        className="field"
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(fid, error, help)}
        aria-required={required || undefined}
        {...rest}
      />
    </Wrap>
  );
}

export function SelectField({
  name,
  label,
  error,
  help,
  required,
  id,
  children,
  ...rest
}: Base & SelectHTMLAttributes<HTMLSelectElement> & { children: ReactNode }) {
  const fid = id ?? `f-${name}`;
  return (
    <Wrap id={fid} name={name} label={label} error={error} help={help} required={required}>
      <select
        id={fid}
        name={name}
        className="field"
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(fid, error, help)}
        aria-required={required || undefined}
        {...rest}
      >
        {children}
      </select>
    </Wrap>
  );
}

export function Checkbox({ name, label, error, defaultChecked }: { name: string; label: ReactNode; error?: string; defaultChecked?: boolean }) {
  const id = `f-${name}`;
  return (
    <div>
      <label htmlFor={id} className="flex min-h-9 items-start gap-2.5 py-1.5">
        <input
          id={id}
          name={name}
          type="checkbox"
          defaultChecked={defaultChecked}
          className="mt-[3px] h-5 w-5 flex-none accent-[var(--teal)]"
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${id}-error` : undefined}
        />
        <span>{label}</span>
      </label>
      {error ? (
        <p className="error-text m-0" id={`${id}-error`}>
          {error}
        </p>
      ) : null}
    </div>
  );
}

export function SubmitButton({ children, pendingText, className = 'btn btn-primary' }: { children: ReactNode; pendingText: string; className?: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className={className} disabled={pending} aria-disabled={pending}>
      {pending ? pendingText : children}
    </button>
  );
}
