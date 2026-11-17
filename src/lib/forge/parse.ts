export type ForgePayload = {
  title: string;
  markdown: string;
  note: string;
};

function clean(value: string, max: number): string {
  return value.replace(/\s+/g, " ").trim().slice(0, max);
}

function headingFrom(text: string): string {
  const match = text.match(/^#\s+(.+)$/m);
  return clean(match?.[1] ?? "Outcome", 120);
}

export function parseForgePayload(raw: string): ForgePayload {
  const text = raw.trim();
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const body = (fenced?.[1] ?? text).trim();
  const start = body.indexOf("{");
  const end = body.lastIndexOf("}");

  if (start >= 0 && end > start) {
    try {
      const parsed = JSON.parse(body.slice(start, end + 1)) as Record<string, unknown>;
      const markdown = typeof parsed.markdown === "string" ? parsed.markdown.trim() : "";
      if (markdown) {
        return {
          title: clean(typeof parsed.title === "string" ? parsed.title : "Outcome", 120) || "Outcome",
          markdown,
          note: clean(typeof parsed.note === "string" ? parsed.note : "", 280),
        };
      }
    } catch {
      // Fall through and treat the model text as the document.
    }
  }

  return {
    title: headingFrom(text),
    markdown: text,
    note: "",
  };
}
