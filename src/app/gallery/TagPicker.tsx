'use client';

import { useId, useState } from 'react';

export type TagOption = { id: string; name: string };

/**
 * "Who's in this photo?" on the gallery upload form (owner, 2026-11-24). Ticked members are asked to approve the photo
 * before it goes live. Sends `tags` (one value per member) with the form.
 */
export function TagPicker({ members, selfId }: { members: TagOption[]; selfId: string }) {
  const [q, setQ] = useState('');
  const [chosen, setChosen] = useState<string[]>([]);
  const id = useId();
  const needle = q.trim().toLowerCase();
  const shown = members.filter((m) => !needle || m.name.toLowerCase().includes(needle));
  const toggle = (mid: string) => setChosen((c) => (c.includes(mid) ? c.filter((x) => x !== mid) : [...c, mid]));
  const nameOf = (mid: string) => members.find((m) => m.id === mid)?.name ?? '';

  return (
    <fieldset className="m-0 flex min-w-0 flex-col gap-2 border-0 p-0 md:col-span-2">
      <legend className="label">Who’s in this photo? (optional)</legend>
      <p id={`${id}-help`} className="help m-0">
        Tag the members in the photo. Each of them is asked to approve it, and it appears in the gallery and on their profiles only once they all have.
      </p>
      {chosen.length ? (
        <ul className="m-0 flex list-none flex-wrap gap-2 p-0" aria-label="Tagged members">
          {chosen.map((mid) => (
            <li key={mid}>
              <button
                type="button"
                className="bg-teal-tint text-teal-hover min-h-11 cursor-pointer rounded-full border-0 px-3 text-sm font-semibold"
                onClick={() => toggle(mid)}
              >
                {nameOf(mid)} <span aria-hidden="true">×</span>
                <span className="sr-only"> (remove tag)</span>
              </button>
              <input type="hidden" name="tags" value={mid} />
            </li>
          ))}
        </ul>
      ) : null}
      <label className="sr-only" htmlFor={`${id}-q`}>
        Find a member to tag
      </label>
      <input
        id={`${id}-q`}
        type="search"
        className="field"
        placeholder="Find a member to tag"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        aria-describedby={`${id}-help`}
      />
      <div className="border-line max-h-[220px] overflow-y-auto rounded-xl border p-2" role="group" aria-label="Members">
        {shown.length === 0 ? (
          <p className="text-ink-muted m-0 p-2 text-sm">No member matches “{q}”.</p>
        ) : (
          shown.map((m) => (
            <label key={m.id} className="flex min-h-11 cursor-pointer items-center gap-2 rounded-lg px-2 text-[15px]">
              <input type="checkbox" className="h-5 w-5" checked={chosen.includes(m.id)} onChange={() => toggle(m.id)} />
              {m.name}
              {m.id === selfId ? <span className="text-ink-muted text-sm">(you)</span> : null}
            </label>
          ))
        )}
      </div>
    </fieldset>
  );
}
