/**
 * Port of OpenManus `app/tool/tool_collection.py`.
 * EvoPulse differences: tools that are not available (not configured, toggled off, or deliberately
 * unsupported) are never handed to the model, and executing a name outside the collection is refused.
 */
import type { ManusTool, ManusToolContext, ManusToolOutcome, ManusToolSpec } from "./tool";
import { toSpec } from "./tool";

export class ToolCollection {
  private readonly toolMap = new Map<string, ManusTool>();

  constructor(...tools: ManusTool[]) {
    this.addTools(...tools);
  }

  /** Add a tool. Like OpenManus, a duplicate name is skipped (first registration wins). */
  addTool(tool: ManusTool): this {
    if (!this.toolMap.has(tool.name)) this.toolMap.set(tool.name, tool);
    return this;
  }

  addTools(...tools: ManusTool[]): this {
    for (const tool of tools) this.addTool(tool);
    return this;
  }

  get(name: string): ManusTool | undefined {
    return this.toolMap.get(name);
  }

  all(): ManusTool[] {
    return [...this.toolMap.values()];
  }

  available(): ManusTool[] {
    return this.all().filter((tool) => tool.available);
  }

  /** Model-facing tool list: available tools only. */
  toParams(): ManusToolSpec[] {
    return this.available().map(toSpec);
  }

  async execute(name: string, args: Record<string, unknown>, ctx: ManusToolContext): Promise<ManusToolOutcome> {
    const tool = this.toolMap.get(name);
    if (!tool || !tool.available) {
      return {
        status: "failed",
        output: `Tool ${name} is not available to this agent.`,
        error: tool?.unavailableReason || `Unknown or disabled tool: ${name}`,
      };
    }
    try {
      return await tool.execute(args || {}, ctx);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Tool failed.";
      return { status: "failed", output: `Tool ${name} failed: ${message}`, error: message };
    }
  }
}
