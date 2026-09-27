"use client";

import { useEffect, useState, type ReactNode } from "react";
import { Inspector } from "./Inspector";

export function Workspace({
  children,
  inspector,
  inspectorTitle,
  inspectorOpen,
  onInspectorClose,
}: {
  children: ReactNode;
  inspector?: ReactNode;
  inspectorTitle?: string;
  inspectorOpen?: boolean;
  onInspectorClose?: () => void;
}) {
  const [open, setOpen] = useState(Boolean(inspector && inspectorOpen !== false));

  useEffect(() => {
    setOpen(Boolean(inspector && inspectorOpen !== false));
  }, [inspector, inspectorOpen]);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
        onInspectorClose?.();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onInspectorClose]);

  return (
    <div className={`grid min-h-0 flex-1 ${open && inspector ? "xl:grid-cols-[minmax(0,1fr)_22.5rem]" : ""}`}>
      <div className="min-w-0 px-6 py-8 lg:px-10">{children}</div>
      {inspector ? (
        <Inspector
          title={inspectorTitle}
          open={open}
          onClose={() => {
            setOpen(false);
            onInspectorClose?.();
          }}
        >
          {inspector}
        </Inspector>
      ) : null}
    </div>
  );
}
