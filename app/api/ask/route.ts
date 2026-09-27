import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { answerQuestion } from "@/lib/engine/ask";

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { question?: string };
  if (!body.question?.trim()) {
    return NextResponse.json({ error: "question is required" }, { status: 400 });
  }
  return NextResponse.json(answerQuestion(getDb(), body.question.trim()));
}
