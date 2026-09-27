import { runWithDb } from "../db";
import { resolveRequestContext, type RequestContext } from "./http";

export async function withPageContext<T>(fn: (ctx: RequestContext) => T): Promise<T> {
  const ctx = await resolveRequestContext();
  return runWithDb(ctx.db, () => fn(ctx));
}
