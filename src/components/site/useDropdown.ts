'use client';

import { useEffect, useRef, useState } from 'react';

/** Mouse-driven screens wide enough for the desktop header (phones and touch screens keep tap-to-open). */
const canHover = () => typeof window !== 'undefined' && window.matchMedia('(hover: hover) and (pointer: fine) and (min-width: 768px)').matches;

/**
 * Header dropdowns ("Report Activity", "Admin"): open on click / Enter / Space, and also when the mouse rests on them
 * (owner, 2026-10-30), with a soft fade. Moving the mouse away closes them after a short pause, so the pointer can travel
 * from the button into the list. Escape or a click outside closes them; Escape returns focus to the button.
 */
export function useDropdown() {
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Set when the mouse opened the menu, so a click on the button right after keeps it open instead of closing it.
  const openedByHover = useRef(false);

  const cancelClose = () => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    closeTimer.current = null;
  };

  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (!wrap.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setOpen(false);
        button.current?.focus();
      }
    }
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  useEffect(() => cancelClose, []);

  const wrapProps = {
    ref: wrap,
    onMouseEnter: () => {
      if (!canHover()) return;
      cancelClose();
      if (!open) {
        openedByHover.current = true;
        setOpen(true);
      }
    },
    onMouseLeave: () => {
      if (!canHover()) return;
      cancelClose();
      closeTimer.current = setTimeout(() => {
        openedByHover.current = false;
        setOpen(false);
      }, 180);
    },
  };

  const buttonProps = {
    ref: button,
    type: 'button' as const,
    'aria-expanded': open,
    onClick: () => {
      if (openedByHover.current) {
        openedByHover.current = false;
        setOpen(true);
        return;
      }
      setOpen((o) => !o);
    },
  };

  /**
   * Phones: the list sits in the page flow and is simply shown or hidden. Desktop: it floats under the button and fades
   * and slides in; when closed it is invisible, so it is also out of the tab order and hidden from screen readers.
   */
  const panelClass = `md:transition md:duration-150 md:ease-out ${
    open ? 'flex md:visible md:translate-y-0 md:opacity-100' : 'hidden md:pointer-events-none md:invisible md:flex md:-translate-y-1 md:opacity-0'
  }`;

  const close = () => {
    cancelClose();
    openedByHover.current = false;
    setOpen(false);
  };

  return { open, close, wrapProps, buttonProps, panelClass };
}
