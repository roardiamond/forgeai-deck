export const OUTCOME_KINDS = [
  {
    id: "report",
    label: "Report",
    hint: "Findings, evidence, and what they imply.",
  },
  {
    id: "action",
    label: "Action plan",
    hint: "Owners, sequence, and this week.",
  },
  {
    id: "document",
    label: "Document",
    hint: "A proposal, brief, SOP, or spec.",
  },
  {
    id: "code",
    label: "Code map",
    hint: "Diagnosis or a starter folder and files.",
  },
  {
    id: "insights",
    label: "Insights",
    hint: "What the numbers say, and what to do.",
  },
] as const;

export type OutcomeKind = (typeof OUTCOME_KINDS)[number]["id"];

export type ChatTurn = {
  role: "user" | "assistant";
  content: string;
  at: string;
};

export type Outcome = {
  id: string;
  title: string;
  kind: OutcomeKind;
  sourceName: string;
  sourceExcerpt: string;
  sourceText: string;
  resultMarkdown: string;
  messages: ChatTurn[];
  createdAt: string;
  updatedAt: string;
};

export type OutcomeSummary = {
  id: string;
  title: string;
  kind: OutcomeKind;
  sourceName: string;
  sourceExcerpt: string;
  createdAt: string;
  updatedAt: string;
};

export function kindLabel(kind: string): string {
  return OUTCOME_KINDS.find((item) => item.id === kind)?.label ?? "Outcome";
}
