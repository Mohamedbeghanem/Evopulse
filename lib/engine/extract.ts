import { z } from "zod";
import {
  addDays,
  atLocalHour,
  DECISION_DUE_ISO,
  DEMO_NOW_ISO,
  MESSAGE_ONE_ISO,
  nextWeekday,
  PROPOSAL_DUE_ISO,
} from "../clock";
import type { ExtractionResult } from "../types";

export const SEED_MESSAGE_ONE =
  "Send the revised 320,000 DZD proposal tomorrow and I'll give you my decision Friday.";

export const SEED_MESSAGE_TWO = "I'll sign today if you give me 10%.";

const ExtractedSchema = z.object({
  commitments: z.array(
    z.object({
      actor: z.enum(["company", "customer"]),
      action: z.string(),
      description: z.string(),
      deadline: z.string(),
      evidence: z.string(),
      confidence: z.number(),
    }),
  ),
  dependencies: z.array(
    z.object({
      dependentAction: z.string(),
      prerequisiteAction: z.string(),
      description: z.string(),
    }),
  ),
  amount: z.number().nullable(),
  currency: z.string().nullable(),
  requestedDiscountPct: z.number().nullable(),
});

function tomorrowFrom(iso: string): string {
  return addDays(iso, 1, 17, 0);
}

function fridayFrom(iso: string): string {
  return nextWeekday(iso, 5, 17);
}

function todayEnd(iso: string): string {
  return atLocalHour(iso, 17, 0);
}

function parseAmount(text: string): { amount: number | null; currency: string | null } {
  const match = text.replace(/,/g, "").match(/(\d+(?:\.\d+)?)\s*(DZD|USD|EUR|TND)?/i);
  if (!match) return { amount: null, currency: null };
  return { amount: Number(match[1]), currency: (match[2] || "DZD").toUpperCase() };
}

function parseDiscount(text: string): number | null {
  const match = text.match(/(\d+(?:\.\d+)?)\s*%/);
  return match ? Number(match[1]) : null;
}

/** Deterministic extractor. Always works offline for the seeded scenario. */
export function extractHeuristic(
  text: string,
  occurredAt = MESSAGE_ONE_ISO,
  now = DEMO_NOW_ISO,
): ExtractionResult {
  const trimmed = text.trim();
  const { amount, currency } = parseAmount(trimmed);
  const requestedDiscountPct = parseDiscount(trimmed);
  const lower = trimmed.toLowerCase();

  const isSeedOne =
    /revised/.test(lower) &&
    /proposal/.test(lower) &&
    /decision/.test(lower) &&
    /friday/.test(lower);

  const isSeedTwo = /sign/.test(lower) && requestedDiscountPct !== null;

  if (isSeedOne) {
    const useCanonical = /320/.test(trimmed) && occurredAt.startsWith("2026-09-23");
    return {
      commitments: [
        {
          actor: "company",
          action: "send_revised_proposal",
          description: "Send the revised 320,000 DZD proposal",
          deadline: useCanonical ? PROPOSAL_DUE_ISO : tomorrowFrom(occurredAt),
          evidence: trimmed,
          confidence: 0.94,
        },
        {
          actor: "customer",
          action: "provide_decision",
          description: "Customer gives a decision on Friday",
          deadline: useCanonical ? DECISION_DUE_ISO : fridayFrom(occurredAt),
          evidence: trimmed,
          confidence: 0.92,
        },
      ],
      dependencies: [
        {
          dependentAction: "provide_decision",
          prerequisiteAction: "send_revised_proposal",
          description: "Customer decision depends on the revised proposal",
        },
      ],
      amount: amount ?? 320000,
      currency: currency ?? "DZD",
      requestedDiscountPct: null,
      model: "heuristic-v1",
      source: "heuristic",
      evidence: trimmed,
    };
  }

  if (isSeedTwo) {
    return {
      commitments: [
        {
          actor: "customer",
          action: "sign_if_discount",
          description: `Customer will sign today if granted ${requestedDiscountPct}% discount`,
          deadline: todayEnd(now),
          evidence: trimmed,
          confidence: 0.9,
        },
      ],
      dependencies: [],
      amount: amount ?? 320000,
      currency: currency ?? "DZD",
      requestedDiscountPct,
      model: "heuristic-v1",
      source: "heuristic",
      evidence: trimmed,
    };
  }

  const commitments: ExtractionResult["commitments"] = [];
  if (/\b(send|prepare|deliver|share)\b/.test(lower) && /\b(proposal|quote|invoice|file)\b/.test(lower)) {
    commitments.push({
      actor: "company",
      action: "send_document",
      description: trimmed.slice(0, 140),
      deadline: /tomorrow/.test(lower) ? tomorrowFrom(occurredAt) : fridayFrom(occurredAt),
      evidence: trimmed,
      confidence: 0.62,
    });
  }
  if (/\b(i'll|i will|we will)\b/.test(lower) && /\b(decision|confirm|sign|pay)\b/.test(lower)) {
    commitments.push({
      actor: "customer",
      action: "customer_follow_through",
      description: trimmed.slice(0, 140),
      deadline: /friday/.test(lower) ? fridayFrom(occurredAt) : todayEnd(now),
      evidence: trimmed,
      confidence: 0.6,
    });
  }

  return {
    commitments,
    dependencies:
      commitments.length === 2
        ? [
            {
              dependentAction: commitments[1].action,
              prerequisiteAction: commitments[0].action,
              description: "Inferred dependency between the two extracted promises",
            },
          ]
        : [],
    amount,
    currency,
    requestedDiscountPct,
    model: "heuristic-v1",
    source: "heuristic",
    evidence: trimmed,
  };
}

type ChatMessage = { role: "system" | "user"; content: string };

async function callChat(messages: ChatMessage[]): Promise<string | null> {
  const openai = process.env.OPENAI_API_KEY;
  const groq = process.env.GROQ_API_KEY;
  const gemini = process.env.GEMINI_API_KEY;

  if (openai || groq) {
    const url = groq
      ? "https://api.groq.com/openai/v1/chat/completions"
      : "https://api.openai.com/v1/chat/completions";
    const key = groq || openai;
    const model = groq ? process.env.GROQ_MODEL || "llama-3.3-70b-versatile" : process.env.OPENAI_MODEL || "gpt-4o-mini";
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        temperature: 0,
        response_format: { type: "json_object" },
        messages,
      }),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    return data.choices?.[0]?.message?.content ?? null;
  }

  if (gemini) {
    const model = process.env.GEMINI_MODEL || "gemini-2.0-flash";
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${gemini}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: `${messages[0].content}\n\n${messages[1].content}` }] }],
          generationConfig: { temperature: 0, responseMimeType: "application/json" },
        }),
      },
    );
    if (!res.ok) return null;
    const data = (await res.json()) as { candidates?: { content?: { parts?: { text?: string }[] } }[] };
    return data.candidates?.[0]?.content?.parts?.[0]?.text ?? null;
  }

  return null;
}

export async function extractCommitments(
  text: string,
  occurredAt = MESSAGE_ONE_ISO,
  now = DEMO_NOW_ISO,
): Promise<ExtractionResult> {
  const fallback = extractHeuristic(text, occurredAt, now);

  const prompt: ChatMessage[] = [
    {
      role: "system",
      content:
        "Extract business commitments from a message. Return JSON only matching this shape: " +
        '{"commitments":[{"actor":"company|customer","action":"snake_case","description":"","deadline":"ISO-8601","evidence":"quote","confidence":0.0}],' +
        '"dependencies":[{"dependentAction":"","prerequisiteAction":"","description":""}],' +
        '"amount":null,"currency":null,"requestedDiscountPct":null}. ' +
        "actor company means OUR promise. actor customer means THEIR promise. " +
        "Resolve relative dates using occurredAt. Do not invent facts not in the text.",
    },
    {
      role: "user",
      content: JSON.stringify({ text, occurredAt, now }),
    },
  ];

  try {
    const raw = await callChat(prompt);
    if (!raw) return fallback;
    const parsed = ExtractedSchema.safeParse(JSON.parse(raw));
    if (!parsed.success || parsed.data.commitments.length === 0) return fallback;
    const model =
      process.env.GROQ_API_KEY ? "groq" : process.env.OPENAI_API_KEY ? "openai" : process.env.GEMINI_API_KEY ? "gemini" : "ai";
    return {
      ...parsed.data,
      model,
      source: "ai",
      evidence: text,
    };
  } catch {
    return fallback;
  }
}
