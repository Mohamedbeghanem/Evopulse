"use client";

import { useCallback, useEffect, useState } from "react";

const KEY = "evopulse.nav.collapsed";

/** Desktop icon-only sidebar preference (per browser). Mobile drawer always shows labels. */
export function useNavCollapsed() {
  const [collapsed, setCollapsed] = useState(false);
  useEffect(() => {
    try {
      setCollapsed(window.localStorage.getItem(KEY) === "1");
    } catch {
      /* storage unavailable */
    }
  }, []);
  const toggle = useCallback(() => {
    setCollapsed((value) => {
      const next = !value;
      try {
        window.localStorage.setItem(KEY, next ? "1" : "0");
      } catch {
        /* ignore */
      }
      return next;
    });
  }, []);
  return { collapsed, toggle };
}

/** Shared icon sizing so both navs stay consistent. */
export const NAV_ICON = { className: "h-4 w-4 shrink-0", strokeWidth: 1.75, "aria-hidden": true } as const;
