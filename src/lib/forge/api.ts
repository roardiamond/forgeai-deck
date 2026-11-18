import { createServerFn } from "@tanstack/react-start";
import { authMiddleware } from "@/lib/auth/middleware";
import { getSql } from "@/lib/db";
import { parseForgePayload } from "@/lib/forge/parse";
import { FORGE_SYSTEM, REVISE_SYSTEM, forgeUserPrompt, reviseUserPrompt } from "@/lib/forge/prompts";
import type { ChatTurn, Outcome, OutcomeKind, OutcomeSummary } from "@/lib/forge/types";

const KINDS: OutcomeKind[] = ["report", "action", "document", "code", "insights"];
const MODEL = "gemini-2.5-flash";

type DbRow = {
  id: string;
  title: string;
  kind: string;
  source_name: string;
  source_excerpt: string;
  source_text?: string;
  result_markdown?: string;
  messages?: unknown;
  created_at: Date | string;
  updated_at: Date | string;
};

function isKind(value: unknown): value is OutcomeKind {
  return typeof value === "string" && KINDS.includes(value as OutcomeKind);
}

function isId(value: unknown): value is string {
  return typeof value === "string" && /^[0-9a-f-]{36}$/i.test(value);
}

function iso(value: Date | string): string {
  if (value instanceof Date) return value.toISOString();
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? new Date().toISOString() : parsed.toISOString();
}

function excerpt(source: string): string {
  return source.replace(/\s+/g, " ").trim().slice(0, 180);
}

function parseMessages(value: unknown): ChatTurn[] {
  let raw = value;
  if (typeof raw === "string") {
    try {
      raw = JSON.parse(raw);
    } catch {
      return [];
    }
  }
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const turn = item as Record<string, unknown>;
    if ((turn.role !== "user" && turn.role !== "assistant") || typeof turn.content !== "string") {
      return [];
    }
    return [
      {
        role: turn.role,
        content: turn.content,
        at: typeof turn.at === "string" ? turn.at : new Date().toISOString(),
      },
    ];
  });
}

function toSummary(row: DbRow): OutcomeSummary {
  return {
    id: row.id,
    title: row.title,
    kind: isKind(row.kind) ? row.kind : "report",
    sourceName: row.source_name ?? "",
    sourceExcerpt: row.source_excerpt,
    createdAt: iso(row.created_at),
    updatedAt: iso(row.updated_at),
  };
}

function toOutcome(row: DbRow): Outcome {
  return {
    ...toSummary(row),
    sourceText: row.source_text ?? "",
    resultMarkdown: row.result_markdown ?? "",
    messages: parseMessages(row.messages),
  };
}

async function callModel(messages: { role: "system" | "user"; content: string }[]): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("Add GEMINI_API_KEY to the .env file in the project root, then restart.");

  const system = messages.find((message) => message.role === "system")?.content ?? "";
  const user = messages
    .filter((message) => message.role === "user")
    .map((message) => message.content)
    .join("\n\n");

  let lastStatus = 0;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    let response: Response;
    try {
      response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-goog-api-key": apiKey,
          },
          body: JSON.stringify({
            systemInstruction: system ? { parts: [{ text: system }] } : undefined,
            contents: [{ role: "user", parts: [{ text: user }] }],
            generationConfig: {
              temperature: 0.3,
              maxOutputTokens: 4096,
              responseMimeType: "application/json",
            },
          }),
          signal: AbortSignal.timeout(50_000),
        },
      );
    } catch {
      if (attempt === 1) throw new Error("Could not reach Gemini. Try again.");
      continue;
    }

    if (response.ok) {
      const body = (await response.json()) as {
        candidates?: { content?: { parts?: { text?: string; thought?: boolean }[] } }[];
      };
      const parts = body.candidates?.[0]?.content?.parts ?? [];
      const text = parts
        .filter((part) => part.text && !part.thought)
        .map((part) => part.text)
        .join("")
        .trim();
      if (!text) throw new Error("Gemini returned an empty outcome. Try again.");
      return text;
    }

    lastStatus = response.status;
    if (response.status === 400 || response.status === 401 || response.status === 403) {
      throw new Error("That Gemini key was rejected. Check GEMINI_API_KEY in the .env file.");
    }
    if (response.status < 500 && response.status !== 429) break;
  }

  throw new Error(
    lastStatus === 429
      ? "Gemini is busy or out of quota. Wait a moment and forge again."
      : "Could not reach Gemini. Try again.",
  );
}

function readSource(input: { source?: unknown; sourceName?: unknown; kind?: unknown }) {
  const source = typeof input.source === "string" ? input.source.trim() : "";
  const sourceName = typeof input.sourceName === "string" ? input.sourceName.trim().slice(0, 180) : "";
  if (!isKind(input.kind)) throw new Error("Choose an outcome type.");
  if (source.length < 12) throw new Error("Add a bit more source data before forging.");
  if (source.length > 80_000) throw new Error("That source is too long. Keep it under 80,000 characters.");
  return { source, sourceName, kind: input.kind };
}

export const listOutcomes = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }): Promise<OutcomeSummary[]> => {
    const sql = await getSql();
    const rows = await sql<DbRow>`
      select id, title, kind, source_name, source_excerpt, created_at, updated_at
      from outcomes
      where user_id = ${context.userId}
      order by updated_at desc
      limit 40
    `;
    return rows.map(toSummary);
  });

export const getOutcome = createServerFn({ method: "GET" })
  .validator((id: string) => {
    if (!isId(id)) throw new Error("That outcome could not be found.");
    return id;
  })
  .middleware([authMiddleware])
  .handler(async ({ data: id, context }): Promise<Outcome | null> => {
    const sql = await getSql();
    const rows = await sql<DbRow>`
      select id, title, kind, source_name, source_excerpt, source_text, result_markdown, messages, created_at, updated_at
      from outcomes
      where id = ${id} and user_id = ${context.userId}
    `;
    const row = rows[0];
    return row ? toOutcome(row) : null;
  });

export const forgeOutcome = createServerFn({ method: "POST" })
  .validator((input: { kind: string; source: string; sourceName: string }) => readSource(input))
  .middleware([authMiddleware])
  .handler(async ({ data, context }): Promise<Outcome> => {
    const raw = await callModel([
      { role: "system", content: FORGE_SYSTEM },
      { role: "user", content: forgeUserPrompt(data.kind, data.sourceName, data.source) },
    ]);
    const parsed = parseForgePayload(raw);
    const id = crypto.randomUUID();
    const sql = await getSql();
    const rows = await sql<DbRow>`
      insert into outcomes (
        id, user_id, title, kind, source_name, source_excerpt, source_text, result_markdown, messages
      ) values (
        ${id},
        ${context.userId},
        ${parsed.title},
        ${data.kind},
        ${data.sourceName},
        ${excerpt(data.source)},
        ${data.source},
        ${parsed.markdown},
        ${JSON.stringify([])}::jsonb
      )
      returning id, title, kind, source_name, source_excerpt, source_text, result_markdown, messages, created_at, updated_at
    `;
    const row = rows[0];
    if (!row) throw new Error("Could not save that outcome.");
    return toOutcome(row);
  });

export const reviseOutcome = createServerFn({ method: "POST" })
  .validator((input: { id: string; instruction: string }) => {
    if (!isId(input?.id)) throw new Error("Open an outcome before revising it.");
    const instruction = typeof input.instruction === "string" ? input.instruction.trim() : "";
    if (instruction.length < 2) throw new Error("Say what you want changed.");
    if (instruction.length > 2_000) throw new Error("Keep the revision note under 2,000 characters.");
    return { id: input.id, instruction };
  })
  .middleware([authMiddleware])
  .handler(async ({ data, context }): Promise<Outcome> => {
    const sql = await getSql();
    const existing = await sql<DbRow>`
      select id, title, kind, source_name, source_excerpt, source_text, result_markdown, messages, created_at, updated_at
      from outcomes
      where id = ${data.id} and user_id = ${context.userId}
    `;
    const current = existing[0];
    if (!current || !isKind(current.kind)) throw new Error("That outcome could not be found.");

    const prior = parseMessages(current.messages);
    const raw = await callModel([
      { role: "system", content: REVISE_SYSTEM },
      {
        role: "user",
        content: reviseUserPrompt({
          kind: current.kind,
          sourceName: current.source_name,
          source: current.source_text ?? "",
          markdown: current.result_markdown ?? "",
          instruction: data.instruction,
          history: prior,
        }),
      },
    ]);
    const parsed = parseForgePayload(raw);
    const turns: ChatTurn[] = [
      ...prior,
      { role: "user", content: data.instruction, at: new Date().toISOString() },
      {
        role: "assistant",
        content: parsed.note || "Revised the outcome.",
        at: new Date().toISOString(),
      },
    ];
    const saved = turns.slice(-16);

    const rows = await sql<DbRow>`
      update outcomes
      set title = ${parsed.title},
          result_markdown = ${parsed.markdown},
          messages = ${JSON.stringify(saved)}::jsonb,
          updated_at = now()
      where id = ${data.id} and user_id = ${context.userId}
      returning id, title, kind, source_name, source_excerpt, source_text, result_markdown, messages, created_at, updated_at
    `;
    const row = rows[0];
    if (!row) throw new Error("Could not save the revision.");
    return toOutcome(row);
  });

export const removeOutcome = createServerFn({ method: "POST" })
  .validator((id: string) => {
    if (!isId(id)) throw new Error("That outcome could not be found.");
    return id;
  })
  .middleware([authMiddleware])
  .handler(async ({ data: id, context }): Promise<{ deleted: boolean }> => {
    const sql = await getSql();
    const rows = await sql<{ id: string }>`
      delete from outcomes
      where id = ${id} and user_id = ${context.userId}
      returning id
    `;
    return { deleted: rows.length > 0 };
  });
