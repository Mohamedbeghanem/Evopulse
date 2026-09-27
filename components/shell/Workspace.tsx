import type { ReactNode } from "react";

const WIDTH = {
  focused: "max-w-[840px]",
  operational: "max-w-[1120px]",
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
    <div className="flex min-h-0 flex-1">
      <div className={`min-w-0 flex-1 px-4 py-6 min-[900px]:px-7 ${WIDTH[mode]}`}>{children}</div>
      {inspector}
    </div>
  );
}
