import type { DatabaseSync } from "node:sqlite";
import { projectAttention } from "../attention";
import { getControlDb } from "../auth/control-db";
import { getMeta } from "../db";
import { id } from "../ids";

export const NOTIFICATION_CATEGORIES = ["NEEDS_YOU", "NEEDS_APPROVAL", "MONITORING", "HANDLED"] as const;
export type NotificationCategory = (typeof NOTIFICATION_CATEGORIES)[number];

export type NotificationRecord = {
  id: string;
  workspace_id: string;
  user_id: string | null;
  category: NotificationCategory;
  title: string;
  body: string;
  href: string;
  situation_id: string | null;
  dedupe_key: string;
  read_at: string | null;
  created_at: string;
};

function categoryFromClassification(value: string): NotificationCategory {
  if (value === "NEEDS_APPROVAL" || value === "BLOCKED") return "NEEDS_APPROVAL";
  if (value === "MONITORING" || value === "AUTO_HANDLED") return "MONITORING";
  if (value === "HANDLED") return "HANDLED";
  return "NEEDS_YOU";
}

export const NotificationService = {
  list(workspaceId: string): NotificationRecord[] {
    return getControlDb()
      .prepare("SELECT * FROM notifications WHERE workspace_id = ? ORDER BY created_at DESC")
      .all(workspaceId) as NotificationRecord[];
  },

  syncFromAttention(workspaceId: string, db: DatabaseSync) {
    const now = getMeta(db, "demo_now", new Date().toISOString());
    const attention = projectAttention(db, now);
    const items = [...attention.needsMe, ...attention.watching, ...attention.handled];
    const ts = new Date().toISOString();
    const control = getControlDb();
    for (const item of items) {
      const category = categoryFromClassification(item.classification);
      const dedupe = `${item.id}:${category}`;
      control
        .prepare(
          `INSERT INTO notifications
            (id, workspace_id, user_id, category, title, body, href, situation_id, dedupe_key, read_at, created_at)
           VALUES (?, ?, NULL, ?, ?, ?, ?, ?, ?, NULL, ?)
           ON CONFLICT(workspace_id, dedupe_key) DO UPDATE SET
             title = excluded.title,
             body = excluded.body,
             href = excluded.href`,
        )
        .run(
          id("ntf"),
          workspaceId,
          category,
          item.title,
          item.summary,
          item.href,
          item.sourceExceptionId || item.id,
          dedupe,
          ts,
        );
    }
    return this.list(workspaceId);
  },

  markRead(workspaceId: string, notificationId: string) {
    getControlDb()
      .prepare("UPDATE notifications SET read_at = ? WHERE id = ? AND workspace_id = ?")
      .run(new Date().toISOString(), notificationId, workspaceId);
    return this.list(workspaceId);
  },

  dailyPulse(workspaceId: string, db: DatabaseSync, agentName = "Pulse") {
    const notifications = this.syncFromAttention(workspaceId, db);
    const needsYou = notifications.filter((item) => item.category === "NEEDS_YOU" || item.category === "NEEDS_APPROVAL");
    const monitoring = notifications.filter((item) => item.category === "MONITORING");
    const handled = notifications.filter((item) => item.category === "HANDLED");
    return {
      greeting: "Good morning.",
      agentName,
      line: "Your business is running.",
      needsYou: needsYou.length,
      monitoring: monitoring.length,
      handled: handled.length,
      highlights: [...needsYou, ...monitoring].slice(0, 4),
    };
  },
};
