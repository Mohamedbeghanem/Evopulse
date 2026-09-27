import { AgentWorkspace } from "@/components/agent/AgentWorkspace";

export const dynamic = "force-dynamic";

export default async function AgentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <AgentWorkspace id={id} />;
}
