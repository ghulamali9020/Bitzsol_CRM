"use client";

import { useEffect } from "react";

/**
 * Locks page scroll while a modal/popup is open, and restores the previous
 * overflow value when it closes. Without this, the page behind a `fixed`
 * overlay can still scroll on wheel/touch, which is what made popups feel
 * like they needed to be scrolled into view.
 *
 * Pass `active` for popups that render conditionally inside a larger view
 * (e.g. a page with an inline delete-confirm dialog); dedicated modal
 * components that are only ever mounted while open can omit it.
 */
export function useLockBodyScroll(active: boolean = true) {
  useEffect(() => {
    if (!active) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [active]);
}
