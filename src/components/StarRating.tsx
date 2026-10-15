'use client';

import { useState } from 'react';

/** 1–5 star rating built on native radio buttons (arrow keys work, screen readers announce it). */
export function StarRating({ name, legend, help, error }: { name: string; legend: string; help?: string; error?: string }) {
  const [value, setValue] = useState(0);
  return (
    <fieldset role="radiogroup" aria-label={legend} className="m-0 border-0 p-0" aria-describedby={help ? `${name}-help` : undefined}>
      <legend className="label">{legend}</legend>
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map((n) => (
          <label
            key={n}
            className="relative flex h-11 w-11 cursor-pointer items-center justify-center rounded-lg has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-[var(--focus)]"
          >
            <input
              type="radio"
              name={name}
              value={n}
              aria-label={`${n} ${n === 1 ? 'star' : 'stars'}`}
              checked={value === n}
              onChange={() => setValue(n)}
              className="absolute inset-0 m-0 cursor-pointer opacity-0"
            />
            <svg
              width="30"
              height="30"
              viewBox="0 0 24 24"
              strokeWidth="1.6"
              strokeLinejoin="round"
              aria-hidden="true"
              className={`stroke-star-line ${n <= value ? 'fill-star' : 'fill-none'}`}
            >
              <path d="m12 2.8 2.8 5.7 6.3.9-4.6 4.4 1.1 6.2L12 17l-5.6 3 1.1-6.2L2.9 9.4l6.3-.9Z" />
            </svg>
          </label>
        ))}
      </div>
      {help ? (
        <p id={`${name}-help`} className="help m-0">
          {help}
        </p>
      ) : null}
      {error ? <p className="error-text m-0">{error}</p> : null}
    </fieldset>
  );
}
