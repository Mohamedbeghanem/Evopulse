/**
 * OpenManus tools that EvoPulse deliberately does not run: PythonExecute, Bash, StrReplaceEditor,
 * BrowserUseTool (+ Crawl4ai). They execute arbitrary code, touch the server filesystem, or drive a
 * browser session — none of which is safe inside a multi-tenant business app or on serverless.
 *
 * They exist only as honest, clearly labelled stubs: `available: false`, never handed to the model,
 * and `execute` refuses. There is no toggle that turns them on, because there is no safe implementation
 * behind them. (If one is ever added it must be admin-only, off by default, and never on serverless.)
 */
import type { ManusTool } from "../tool";

export function isServerless(env: NodeJS.ProcessEnv = process.env): boolean {
  return Boolean(env.VERCEL || env.AWS_LAMBDA_FUNCTION_NAME || env.NETLIFY || env.K_SERVICE || env.FUNCTIONS_WORKER_RUNTIME);
}

const STUBS: { name: string; openManus: string; description: string; why: string }[] = [
  {
    name: "python_execute",
    openManus: "PythonExecute",
    description: "Execute Python code.",
    why: "Not available in EvoPulse: arbitrary code execution is not sandboxed here.",
  },
  {
    name: "bash",
    openManus: "Bash",
    description: "Run shell commands.",
    why: "Not available in EvoPulse: shell access on the server is never given to the agent.",
  },
  {
    name: "str_replace_editor",
    openManus: "StrReplaceEditor",
    description: "View and edit files.",
    why: "Not available in EvoPulse: the agent works on business records through tools, not on files.",
  },
  {
    name: "browser_use",
    openManus: "BrowserUseTool",
    description: "Drive a web browser.",
    why: "Not available in EvoPulse: no sandboxed browser runtime is shipped.",
  },
];

export function unavailableTools(env: NodeJS.ProcessEnv = process.env): ManusTool[] {
  const serverless = isServerless(env);
  return STUBS.map((stub) => ({
    name: stub.name,
    description: `${stub.description} (OpenManus ${stub.openManus})`,
    parameters: {},
    kind: "unavailable" as const,
    source: "native" as const,
    available: false,
    unavailableReason: serverless ? `${stub.why} Never enabled on serverless.` : stub.why,
    async execute() {
      return { status: "unavailable" as const, output: stub.why, error: stub.why };
    },
  }));
}
