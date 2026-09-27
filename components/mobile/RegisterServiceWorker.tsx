"use client";

import { useEffect } from "react";

/** Registers the basic offline shell (public/sw.js). Scope is /m only. */
export function RegisterServiceWorker() {
  useEffect(() => {
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js", { scope: "/m" }).catch(() => {
      /* offline shell is best-effort; the app works without it */
    });
  }, []);
  return null;
}
