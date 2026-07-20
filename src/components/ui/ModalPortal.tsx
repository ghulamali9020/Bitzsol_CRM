"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

/**
 * Portals modal content directly onto document.body. Popups render deep
 * inside view components whose ancestors sometimes carry a lingering
 * `transform` (e.g. a fill-mode animation left at its end keyframe) or a
 * `filter`. Either establishes a new containing block for `position: fixed`
 * descendants, trapping the modal inside that ancestor's box instead of the
 * real viewport. Portaling to body sidesteps that regardless of what any
 * ancestor does.
 */
export function ModalPortal({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);
  if (!mounted) return null;
  return createPortal(children, document.body);
}
