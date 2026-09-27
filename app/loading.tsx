import { LoadingState } from "@/components/ui/chrome";
import { Workspace } from "@/components/shell/Workspace";

export default function Loading() {
  return (
    <Workspace>
      <LoadingState />
    </Workspace>
  );
}
