'use client';

import { useState, type FormEvent } from 'react';
import type { z } from 'zod';
import { fieldErrors, formToObject } from '@/lib/validation';

/**
 * Validates a form in the browser with the same Zod schema the server uses.
 * Invalid submissions are stopped before they reach the server and focus moves to the first error.
 */
export function useClientValidation(schema: z.ZodType) {
  const [errors, setErrors] = useState<Record<string, string> | null>(null);

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    const form = e.currentTarget;
    const result = schema.safeParse(formToObject(new FormData(form)));
    if (result.success) {
      setErrors(null);
      return;
    }
    e.preventDefault();
    const errs = fieldErrors(result.error);
    setErrors(errs);
    const first = Object.keys(errs)[0];
    const el = first ? (form.elements.namedItem(first) as HTMLElement | null) : null;
    if (el && 'focus' in el) el.focus();
  }

  return { clientErrors: errors, onSubmit, clearClientErrors: () => setErrors(null) };
}
