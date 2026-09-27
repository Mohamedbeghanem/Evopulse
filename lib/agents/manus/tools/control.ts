/**
 * Ports of OpenManus `app/tool/terminate.py` and `app/tool/ask_human.py`.
 * ask_human does not block on stdin (there is none on a server): the question is recorded, the run
 * stops, and the UI asks the person. Their answer starts a follow-up run.
 */
import type { ManusTool } from "../tool";

export const TERMINATE = "terminate";
export const ASK_HUMAN = "ask_human";

export function terminateTool(): ManusTool {
  return {
    name: TERMINATE,
    description:
      "Terminate the interaction when the request is met OR if the assistant cannot proceed further with the task. When you have finished all the tasks, call this tool to end the work.",
    parameters: {
      status: { type: "string", description: "The finish status of the interaction.", enum: ["success", "failure"], required: true },
    },
    kind: "control",
    source: "native",
    available: true,
    async execute(args) {
      const status = args.status === "failure" ? "failure" : "success";
      return { status: "ok", output: `The interaction has been completed with status: ${status}`, data: { status } };
    },
  };
}

export function askHumanTool(): ManusTool {
  return {
    name: ASK_HUMAN,
    description: "Use this tool to ask the person for help or a missing detail. The run pauses until they answer.",
    parameters: {
      inquire: { type: "string", description: "The question you want to ask the person.", required: true },
    },
    kind: "control",
    source: "native",
    available: true,
    async execute(args) {
      const inquire = String(args.inquire || "").trim().slice(0, 500);
      if (!inquire) return { status: "failed", output: "ask_human needs a question.", error: "inquire is required" };
      return { status: "ok", output: `Question recorded for the person: ${inquire}`, data: { inquire } };
    },
  };
}
