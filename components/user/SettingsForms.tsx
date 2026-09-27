"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button, Input } from "@/components/ui/primitives";
import type { ConnectorView } from "@/lib/integrations/service";
import type { PublicUser, PublicWorkspace, WorkspaceRole } from "@/lib/auth/types";

export function ProfileForm({ user }: { user: PublicUser }) {
  const router = useRouter();
  return (
    <form
      className="max-w-md space-y-4"
      action={async (form) => {
        await fetch("/api/profile", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: form.get("name") }),
        });
        router.refresh();
      }}
    >
      <label className="block space-y-1.5">
        <span className="text-sm text-sand">Name</span>
        <Input name="name" defaultValue={user.name} />
      </label>
      <p className="text-sm text-mute">{user.email}</p>
      <Button type="submit">Save profile</Button>
    </form>
  );
}

export function WorkspaceForm({ workspace }: { workspace: PublicWorkspace }) {
  const router = useRouter();
  return (
    <form
      className="max-w-md space-y-4"
      action={async (form) => {
        await fetch("/api/workspace", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: form.get("name"),
            currency: form.get("currency"),
            timezone: form.get("timezone"),
            logo: form.get("logo"),
            agent_name: form.get("agent_name"),
            interaction_density: form.get("interaction_density"),
            notification_preference: form.get("notification_preference"),
          }),
        });
        router.refresh();
      }}
    >
      <label className="block space-y-1.5">
        <span className="text-sm text-sand">Business name</span>
        <Input name="name" defaultValue={workspace.name} />
      </label>
      <label className="block space-y-1.5">
        <span className="text-sm text-sand">Logo URL</span>
        <Input name="logo" defaultValue={workspace.logo} />
      </label>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block space-y-1.5">
          <span className="text-sm text-sand">Currency</span>
          <Input name="currency" defaultValue={workspace.currency} />
        </label>
        <label className="block space-y-1.5">
          <span className="text-sm text-sand">Timezone</span>
          <Input name="timezone" defaultValue={workspace.timezone} />
        </label>
      </div>
      <label className="block space-y-1.5">
        <span className="text-sm text-sand">Agent name</span>
        <Input name="agent_name" defaultValue={workspace.agentName} />
      </label>
      <label className="block space-y-1.5">
        <span className="text-sm text-sand">Interaction density</span>
        <Input name="interaction_density" defaultValue={workspace.interactionDensity} />
      </label>
      <label className="block space-y-1.5">
        <span className="text-sm text-sand">Notification preference</span>
        <Input name="notification_preference" defaultValue={workspace.notificationPreference} />
      </label>
      <p className="text-sm text-mute">Policy, verification, and approval requirements cannot be turned off here.</p>
      <Button type="submit">Save workspace</Button>
    </form>
  );
}

export function TeamForm({
  members,
}: {
  members: { user_id: string; email: string; name: string; role: WorkspaceRole }[];
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  async function add(form: FormData) {
    const res = await fetch("/api/team", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: form.get("email"), role: form.get("role") }),
    });
    const data = (await res.json()) as { error?: string };
    if (!res.ok) setError(data.error || "Could not add member.");
    else {
      setError(null);
      router.refresh();
    }
  }

  return (
    <div className="space-y-6">
      <ul className="space-y-2">
        {members.map((member) => (
          <li key={member.user_id} className="flex justify-between rounded-md border border-hairline px-3 py-2">
            <span>
              {member.name} <span className="text-mute">{member.email}</span>
            </span>
            <span className="font-mono text-[11px] uppercase text-mute">{member.role}</span>
          </li>
        ))}
      </ul>
      <form action={(form) => void add(form)} className="flex flex-col gap-3 sm:flex-row">
        <Input name="email" type="email" placeholder="teammate@business.com" required />
        <Input name="role" defaultValue="member" />
        <Button type="submit">Add</Button>
      </form>
      {error ? <p className="text-sm text-miss">{error}</p> : null}
    </div>
  );
}

export function IntegrationsPanel({ connectors }: { connectors: ConnectorView[] }) {
  const router = useRouter();
  return (
    <ul className="space-y-2">
      {connectors.map((item) => (
        <li key={item.id} className="flex items-center justify-between rounded-md border border-hairline px-3 py-3">
          <div>
            <p>{item.name}</p>
            <p className="text-sm text-sand">
              {item.category} · {item.status.replaceAll("_", " ")}
            </p>
          </div>
          {item.status === "AVAILABLE" ? (
            <Button
              variant="ghost"
              onClick={async () => {
                await fetch("/api/integrations", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ connectorId: item.id }),
                });
                router.refresh();
              }}
            >
              Connect
            </Button>
          ) : (
            <span className="font-mono text-[10px] uppercase text-mute">{item.status.replaceAll("_", " ")}</span>
          )}
        </li>
      ))}
    </ul>
  );
}
