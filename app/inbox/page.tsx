import { InboxBoard } from "@/components/demo-loop/InboxBoard";
import { Workspace } from "@/components/shell/Workspace";
import { PageHeader } from "@/components/ui/chrome";
import { withPageContext } from "@/lib/auth/page";
import { availableDemoReplies, listInbox } from "@/lib/demo-loop/inbox";
import { outboundView } from "@/lib/outbound";

export const dynamic = "force-dynamic";

export default async function InboxPage() {
  const data = await withPageContext((ctx) => ({
    messages: listInbox(ctx.db),
    demoReplies: availableDemoReplies(ctx.db),
    outbound: outboundView(ctx.db),
    demoMode: ctx.mode === "demo",
  }));
  return (
    <Workspace mode="operational">
      <PageHeader kicker="Inbox" title="Replies close the loop.">
        <p>Incoming messages verify only actions aimed at the party that sent them. Outgoing drafts wait for your approval.</p>
      </PageHeader>
      <div className="mt-8">
        <InboxBoard {...JSON.parse(JSON.stringify(data))} />
      </div>
    </Workspace>
  );
}
