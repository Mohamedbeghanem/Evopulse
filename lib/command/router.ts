import type { DatabaseSync } from "node:sqlite";
import { getMeta } from "../db";
import { id, IDS } from "../ids";
import { loadSession, saveSession, type CommandSession } from "./session";
import type { CommandIntent, CommandResult, ScenarioParameters, TimeScope } from "./types";
import { runIntent } from "./handlers";

const ENTITY_PATTERNS: { pattern: RegExp; id: string }[] = [
  { pattern: /atlas supply|\bsupplier\b/, id: IDS.supplier },
  { pattern: /sh-?\s*204|\bshipment\b/, id: IDS.shipment },
  { pattern: /order a|oran fresh|\boran\b/, id: IDS.orderA },
  { pattern: /order b|constantine/, id: IDS.orderB },
  { pattern: /order c|s[eé]tif/, id: IDS.orderC },
  { pattern: /320\s*k|320,?000|opportunity/, id: IDS.opportunity },
];

export class CommandRouter {
  constructor(private readonly db: DatabaseSync) {}

  validate(message: string): { ok: boolean; error?: string } {
    if (!message.trim()) return { ok: false, error: "message is required" };
    return { ok: true };
  }

  classifyIntent(message: string, session?: Pick<CommandSession, "lastIntent">): CommandIntent {
    const q = normalize(message);
    if (!q) return "UNKNOWN";
    if (/fix everything|authorized to fix|execute safe/.test(q)) return "EXECUTION";
    if (/what can you handle|handle safely|safe now|safely/.test(q)) return "POLICY";
    if (/why did you block|why .*block|blocked the 10|10% discount/.test(q) && /why|block/.test(q)) return "POLICY";
    if (/why did you do|why did you\b/.test(q)) return "STATUS";
    if (/^why\??$/.test(q) && session?.lastIntent === "BUSINESS_CHANGES") return "CAUSAL_EXPLANATION";
    if (/protect everything|protect this week|at risk this week/.test(q)) return "GOAL";
    if (/what if|another \d+|days? late|days? later|simulate/.test(q)) return "SIMULATION";
    if (/850|why .*at risk|connected to this risk|why is .*risk/.test(q)) return "CAUSAL_EXPLANATION";
    if (/about to miss|coming next|future risk/.test(q)) return "FUTURE_RISK";
    if (/monitoring|are you watching/.test(q)) return "STATUS";
    if (/what changed|changed today|meaningful changes/.test(q)) return "BUSINESS_CHANGES";
    if (/needs me|need me|attention|needs you/.test(q)) return "ATTENTION";
    if (/last time|what did we do|histor/.test(q)) return "HISTORY";
    if (/business state|how are we|status of the business/.test(q)) return "STATUS";
    if (/^show (me )?the plan|current plan/.test(q)) return "PLAN";
    return "UNKNOWN";
  }

  extractEntities(message: string, session?: Pick<CommandSession, "lastEntityIds" | "lastIntent">): string[] {
    const q = normalize(message);
    const found: string[] = [];
    for (const entry of ENTITY_PATTERNS) {
      if (entry.pattern.test(q) && !found.includes(entry.id)) found.push(entry.id);
    }
    if (found.length === 0 && session && (session.lastIntent === "CAUSAL_EXPLANATION" || session.lastIntent === "SIMULATION" || session.lastIntent === "BUSINESS_CHANGES")) {
      return session.lastEntityIds.length ? session.lastEntityIds : [IDS.shipment];
    }
    return found;
  }

  extractTimeScope(message: string): TimeScope {
    const q = normalize(message);
    if (/next 24 hours|next day/.test(q)) return "next_24_hours";
    if (/tomorrow/.test(q)) return "tomorrow";
    if (/this week/.test(q)) return "this_week";
    if (/this month/.test(q)) return "this_month";
    if (/today/.test(q)) return "today";
    return "unspecified";
  }

  extractScenarioParameters(message: string, entities: string[]): ScenarioParameters | null {
    const q = normalize(message);
    if (!/what if|days? late|days? later|simulate|another/.test(q)) return null;
    const matched = q.match(/(\d+)\s*days?/);
    const days = matched ? Number(matched[1]) : 3;
    const targetId = entities.find((item) => item === IDS.shipment || item === IDS.supplier) ? IDS.shipment : IDS.shipment;
    return { targetId, days };
  }

  route(message: string, sessionId?: string): CommandResult {
    const now = getMeta(this.db, "demo_now");
    const check = this.validate(message);
    if (!check.ok) {
      return emptyResult(now, "UNKNOWN", check.error || "message is required");
    }
    const session = loadSession(this.db, sessionId, now);
    const intent = this.classifyIntent(message, session);
    const entities = this.extractEntities(message, session);
    const timeScope = this.extractTimeScope(message);
    const scenario = this.extractScenarioParameters(message, entities.length ? entities : session.lastEntityIds);
    const result = runIntent(this.db, {
      message: message.trim(),
      intent,
      entities,
      timeScope,
      scenario,
      session,
      now,
    });
    session.lastIntent = result.intent;
    if (entities.length) session.lastEntityIds = entities;
    const warningId = typeof result.data.warningId === "string" ? result.data.warningId : session.lastWarningId;
    const exceptionId = typeof result.data.exceptionId === "string" ? result.data.exceptionId : session.lastExceptionId;
    const goalId = typeof result.data.goalId === "string" ? result.data.goalId : session.lastGoalId;
    session.lastWarningId = warningId;
    session.lastExceptionId = exceptionId;
    session.lastGoalId = goalId;
    saveSession(this.db, session, now);
    result.session = { id: session.id, lastIntent: result.intent };
    result.commandId = result.commandId || id("cmd");
    return result;
  }

  returnStructuredResult(result: CommandResult): CommandResult {
    return result;
  }
}

export function normalize(message: string): string {
  return message.toLowerCase().replace(/[’']/g, "'").replace(/\s+/g, " ").trim();
}

function emptyResult(now: string, intent: CommandIntent, summary: string): CommandResult {
  return {
    commandId: id("cmd"),
    intent,
    understoodAs: summary,
    answerType: "SUMMARY",
    status: "FAILED",
    summary,
    data: {},
    evidence: [],
    actions: [],
    links: [],
    sourceSystems: [],
    generatedAt: now,
    assumptions: [],
    warnings: [],
    approvalRequired: false,
    session: { id: "", lastIntent: intent },
  };
}
