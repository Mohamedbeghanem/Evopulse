import type { ReactNode } from "react";

const WIDTH = {
  focused: "max-w-[840px]",
  operational: "max-w-[1140px]",
  canvas: "max-w-none",
};

export function Workspace({
  mode = "operational",
  inspector,
  children,
}: {
  mode?: keyof typeof WIDTH;
  inspector?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className={`flex min-h-0 flex-1 ${inspector ? "lg:pr-0" : ""}`}>
      <div className={`min-w-0 flex-1 px-4 py-6 lg:px-8 ${WIDTH[mode]}`}>{children}</div>
      {inspector}
    </div>
  );
}
