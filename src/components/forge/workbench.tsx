import {
  ChartColumn,
  FileText,
  FolderTree,
  ListChecks,
  LoaderCircle,
  ScrollText,
  Trash2,
  Upload,
} from "lucide-react";
import { Link } from "@tanstack/react-router";
import { useEffect, useRef, useState, type ChangeEvent, type KeyboardEvent, type ReactNode } from "react";
import { CopyButton, MarkdownView } from "@/components/forge/markdown-view";
import { Mark } from "@/components/forge/mark";
import { Button } from "@/components/ui/button";
import { forgeOutcome, getOutcome, listOutcomes, removeOutcome, reviseOutcome } from "@/lib/forge/api";
import { SAMPLES, type Sample } from "@/lib/forge/samples";
import { OUTCOME_KINDS, kindLabel, type Outcome, type OutcomeKind, type OutcomeSummary } from "@/lib/forge/types";
import { GROK_PROVIDERS, signIn } from "@/lib/auth/client";
import { UserButton } from "@/lib/auth/gates";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { cn } from "@/lib/utils";

const ICONS: Record<OutcomeKind, ReactNode> = {
  report: <FileText className="size-4" />,
  action: <ListChecks className="size-4" />,
  document: <ScrollText className="size-4" />,
  code: <FolderTree className="size-4" />,
  insights: <ChartColumn className="size-4" />,
};

const QUICK_REVISIONS = [
  "Tighten this. Cut repetition and keep only what someone can act on.",
  "Add owners, effort, and a this-week sequence where they are missing.",
  "Expand the risks and the parts that are still ambiguous.",
];

function formatWhen(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "";
  const minutes = Math.round((Date.now() - then) / 60000);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 14) return `${days}d ago`;
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function messageOf(error: unknown): string {
  if (error instanceof Error && error.message) {
    if (error.message === "Unauthorized") return "Sign in to forge and keep the outcome.";
    return error.message;
  }
  return "Something went wrong. Try again.";
}

export function Workbench() {
  const { user, isPending } = useCurrentUserState();
  const fileRef = useRef<HTMLInputElement>(null);
  const [kind, setKind] = useState<OutcomeKind>("document");
  const [source, setSource] = useState("");
  const [sourceName, setSourceName] = useState("");
  const [history, setHistory] = useState<OutcomeSummary[]>([]);
  const [current, setCurrent] = useState<Outcome | null>(null);
  const [forging, setForging] = useState(false);
  const [revising, setRevising] = useState(false);
  const [instruction, setInstruction] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [signInAsk, setSignInAsk] = useState(false);
  const selected = OUTCOME_KINDS.find((item) => item.id === kind) ?? OUTCOME_KINDS[0];
  const busy = forging || revising;

  useEffect(() => {
    if (!user?.id) return;
    let cancelled = false;
    listOutcomes()
      .then((rows) => {
        if (!cancelled) setHistory(rows);
      })
      .catch(() => {
        if (!cancelled) setHistory([]);
      });
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  function loadSample(sample: Sample) {
    setSource(sample.body);
    setSourceName(sample.label);
    setKind(sample.kind);
    setError(null);
    setSignInAsk(false);
  }

  function onFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    const allowed = /\.(txt|csv|md|markdown)$/i.test(file.name);
    if (!allowed) {
      setError("Upload a .txt, .csv, or .md file.");
      return;
    }
    if (file.size > 500_000) {
      setError("That file is too large. Keep uploads under 500 KB.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setSource(typeof reader.result === "string" ? reader.result : "");
      setSourceName(file.name);
      setError(null);
    };
    reader.readAsText(file);
  }

  async function forge() {
    if (busy || isPending) return;
    if (!user) {
      setSignInAsk(true);
      return;
    }
    setError(null);
    setForging(true);
    try {
      const outcome = await forgeOutcome({
        data: { kind, source, sourceName },
      });
      setCurrent(outcome);
      setHistory((items) => [outcome, ...items.filter((item) => item.id !== outcome.id)]);
      setInstruction("");
    } catch (caught) {
      setError(messageOf(caught));
    } finally {
      setForging(false);
    }
  }

  async function revise(text: string) {
    if (!current || busy || isPending) return;
    const instructionText = text.trim();
    if (!user) {
      setSignInAsk(true);
      return;
    }
    if (instructionText.length < 2) {
      setError("Say what you want changed.");
      return;
    }
    setError(null);
    setRevising(true);
    try {
      const outcome = await reviseOutcome({
        data: { id: current.id, instruction: instructionText },
      });
      setCurrent(outcome);
      setHistory((items) => [outcome, ...items.filter((item) => item.id !== outcome.id)]);
      setInstruction("");
    } catch (caught) {
      setError(messageOf(caught));
    } finally {
      setRevising(false);
    }
  }

  async function openHistory(id: string) {
    if (busy) return;
    setError(null);
    try {
      const outcome = await getOutcome({ data: id });
      if (!outcome) {
        setError("That outcome is no longer available.");
        return;
      }
      setCurrent(outcome);
      setKind(outcome.kind);
      setSource(outcome.sourceText);
      setSourceName(outcome.sourceName);
    } catch (caught) {
      setError(messageOf(caught));
    }
  }

  async function remove(id: string) {
    if (busy) return;
    try {
      await removeOutcome({ data: id });
      setHistory((items) => items.filter((item) => item.id !== id));
      if (current?.id === id) setCurrent(null);
    } catch (caught) {
      setError(messageOf(caught));
    }
  }

  function onSourceKey(event: KeyboardEvent<HTMLTextAreaElement>) {
    if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
      event.preventDefault();
      void forge();
    }
  }

  return (
    <div className="flex min-h-dvh flex-col lg:h-dvh lg:overflow-hidden">
      <header className="flex items-center justify-between gap-4 border-b border-line px-4 py-3 sm:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <Mark />
          <div className="min-w-0">
            <div className="text-base font-semibold tracking-tight">ForgeAI</div>
            <p className="hidden truncate text-sm text-muted sm:block">
              Turn any data into a clear, professional outcome.
            </p>
          </div>
        </div>
        <div className="shrink-0">
          {isPending ? (
            <div className="size-8 animate-pulse rounded-full bg-surface-2" />
          ) : user ? (
            <UserButton />
          ) : (
            <Link
              to="/login"
              className="focus-ring inline-flex h-11 items-center rounded-sm px-3 text-sm font-medium text-fg"
            >
              Sign in
            </Link>
          )}
        </div>
      </header>

      <div className="flex min-h-0 min-w-0 flex-1 flex-col lg:flex-row">
        <aside className="hidden w-72 shrink-0 flex-col border-r border-line lg:flex">
          <div className="px-4 pt-5 pb-2 text-xs font-medium tracking-wide text-muted">History</div>
          <HistoryList
            items={history}
            activeId={current?.id ?? null}
            onOpen={openHistory}
            onRemove={remove}
            session={isPending ? "pending" : user ? "in" : "out"}
          />
        </aside>

        <div className="grid min-h-0 min-w-0 flex-1 lg:grid-cols-2">
          <section className="scroll-thin min-w-0 border-b border-line px-4 py-5 sm:px-6 lg:overflow-y-auto lg:border-r lg:border-b-0">
            {history.length > 0 ? (
              <div className="mb-5 lg:hidden">
                <div className="mb-2 text-xs font-medium tracking-wide text-muted">History</div>
                <div className="scroll-thin flex gap-2 overflow-x-auto pb-1">
                  {history.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => void openHistory(item.id)}
                      className={cn(
                        "focus-ring min-w-40 shrink-0 rounded-md px-3 py-2 text-left",
                        item.id === current?.id ? "bg-surface-2" : "bg-surface",
                      )}
                    >
                      <span className="block truncate text-sm font-medium">{item.title}</span>
                      <span className="mt-1 block text-xs text-muted">{kindLabel(item.kind)}</span>
                    </button>
                  ))}
                </div>
              </div>
            ) : null}

            <div className="rounded-xl bg-surface p-4 shadow-hairline">
              <div className="flex items-center justify-between gap-3">
                <h1 className="text-lg font-semibold tracking-tight">Source</h1>
                <span className="text-xs text-muted tabular-nums">{source.length.toLocaleString()} chars</span>
              </div>
              <p className="mt-1 text-sm text-pretty text-muted">
                Paste a brief, notes, a log, or a CSV. Or drop in a .txt, .csv, or .md file.
              </p>
              <textarea
                value={source}
                onChange={(event) => setSource(event.target.value)}
                onKeyDown={onSourceKey}
                placeholder="Paste the raw data here."
                aria-label="Source data"
                className="focus-ring mt-4 min-h-56 w-full resize-y rounded-sm bg-bg px-3 py-3 text-sm leading-relaxed text-fg outline-none placeholder:text-muted"
              />
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <input
                  ref={fileRef}
                  type="file"
                  accept=".txt,.csv,.md,.markdown,text/plain,text/csv,text/markdown"
                  className="sr-only"
                  onChange={onFile}
                />
                <Button variant="secondary" size="sm" onClick={() => fileRef.current?.click()}>
                  <Upload className="size-4" />
                  Upload
                </Button>
                {sourceName ? <span className="truncate text-xs text-muted">{sourceName}</span> : null}
                {source ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setSource("");
                      setSourceName("");
                    }}
                  >
                    Clear
                  </Button>
                ) : null}
              </div>
              <div className="mt-4 grid gap-2 sm:grid-cols-2">
                {SAMPLES.map((sample) => (
                  <button
                    key={sample.id}
                    type="button"
                    onClick={() => loadSample(sample)}
                    className="focus-ring press rounded-sm bg-bg px-3 py-3 text-left"
                  >
                    <span className="block text-sm font-medium">{sample.label}</span>
                    <span className="mt-1 block text-xs text-muted">{sample.blurb}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-4 rounded-xl bg-surface p-4 shadow-hairline">
              <h2 className="text-lg font-semibold tracking-tight">Outcome</h2>
              <p className="mt-1 text-sm text-muted">{selected.hint}</p>
              <div className="mt-4 flex min-w-0 gap-2 overflow-x-auto pb-1">
                {OUTCOME_KINDS.map((item) => {
                  const active = item.id === kind;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      aria-pressed={active}
                      onClick={() => setKind(item.id)}
                      className={cn(
                        "focus-ring press inline-flex h-11 shrink-0 items-center gap-2 rounded-sm px-3 text-sm font-medium",
                        active ? "bg-accent text-accent-fg" : "bg-bg text-muted",
                      )}
                    >
                      {ICONS[item.id]}
                      {item.label}
                    </button>
                  );
                })}
              </div>
              {error ? (
                <p role="alert" className="mt-4 text-sm text-danger">
                  {error}
                </p>
              ) : null}
              <div className="mt-4">
                {signInAsk && !isPending && !user ? (
                  <div className="grid gap-2">
                    <p className="text-sm text-muted">Sign in to forge this and keep it in your history.</p>
                    {GROK_PROVIDERS.map((provider) => (
                      <Button
                        key={provider.providerId}
                        variant="secondary"
                        onClick={() => signIn(provider.providerId, { callbackURL: "/" })}
                      >
                        Continue with {provider.label}
                      </Button>
                    ))}
                  </div>
                ) : (
                  <Button className="w-full sm:w-auto" disabled={busy || isPending} onClick={() => void forge()}>
                    {forging ? <LoaderCircle className="size-4 animate-spin" /> : null}
                    {forging ? "Forging" : "Forge outcome"}
                  </Button>
                )}
              </div>
              <p className="mt-3 text-xs text-muted">Ctrl or Cmd + Enter from the source box.</p>
            </div>
          </section>

          <section className="scroll-thin safe-b flex min-h-80 min-w-0 flex-col px-4 py-5 sm:px-6 lg:min-h-0 lg:overflow-y-auto">
            {forging && !current ? <OutcomeSkeleton /> : null}
            {!current && !forging ? (
              <div className="grid flex-1 content-center">
                <h2 className="text-2xl font-semibold tracking-tight text-balance">Nothing forged yet.</h2>
                <p className="mt-3 max-w-prose text-sm text-pretty leading-relaxed text-muted">
                  A report, an action plan, a proposal, a code map, or an insight brief will land here. Copy it,
                  then ask for a revision without starting over.
                </p>
              </div>
            ) : null}
            {current ? (
              <article className="flex flex-1 flex-col">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-xs font-medium text-muted">{kindLabel(current.kind)}</div>
                    <h2 className="mt-1 text-2xl font-semibold tracking-tight text-balance">{current.title}</h2>
                  </div>
                  <CopyButton text={current.resultMarkdown} label="Copy all" variant="secondary" />
                </div>
                {revising ? (
                  <p className="mt-4 text-sm text-muted">Revising the outcome…</p>
                ) : null}
                <div className={cn("mt-5", revising && "opacity-60")}>
                  <MarkdownView source={current.resultMarkdown} />
                </div>
                {current.messages.length > 0 ? (
                  <ol className="mt-6 grid gap-2">
                    {current.messages.map((turn, index) => (
                      <li
                        key={`${turn.at}-${index}`}
                        className={cn(
                          "rounded-md px-3 py-2 text-sm",
                          turn.role === "user" ? "bg-surface text-fg" : "text-muted",
                        )}
                      >
                        <span className="mb-1 block text-xs font-medium text-muted">
                          {turn.role === "user" ? "You" : "ForgeAI"}
                        </span>
                        {turn.content}
                      </li>
                    ))}
                  </ol>
                ) : null}
                <div className="mt-6 rounded-xl bg-surface p-3 shadow-hairline">
                  <label htmlFor="revise" className="text-sm font-medium">
                    Revise
                  </label>
                  <textarea
                    id="revise"
                    value={instruction}
                    onChange={(event) => setInstruction(event.target.value)}
                    onKeyDown={(event) => {
                      if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
                        event.preventDefault();
                        void revise(instruction);
                      }
                    }}
                    placeholder="Ask for a change. Shorter, a timeline, a different structure."
                    className="focus-ring mt-2 min-h-20 w-full resize-y rounded-sm bg-bg px-3 py-3 text-sm leading-relaxed text-fg outline-none placeholder:text-muted"
                  />
                  <div className="mt-2 flex flex-wrap gap-2">
                    {QUICK_REVISIONS.map((prompt) => (
                      <Button
                        key={prompt}
                        variant="ghost"
                        size="sm"
                        disabled={busy}
                        onClick={() => void revise(prompt)}
                      >
                        {prompt.split(".")[0]}
                      </Button>
                    ))}
                  </div>
                  <div className="mt-3">
                    <Button disabled={busy || instruction.trim().length < 2} onClick={() => void revise(instruction)}>
                      {revising ? <LoaderCircle className="size-4 animate-spin" /> : null}
                      {revising ? "Revising" : "Apply revision"}
                    </Button>
                  </div>
                </div>
              </article>
            ) : null}
          </section>
        </div>
      </div>
    </div>
  );
}

function OutcomeSkeleton() {
  return (
    <div className="grid gap-3" aria-hidden="true">
      <div className="h-4 w-24 animate-pulse rounded-sm bg-surface-2" />
      <div className="h-8 w-2/3 animate-pulse rounded-sm bg-surface-2" />
      <div className="mt-4 h-4 w-full animate-pulse rounded-sm bg-surface" />
      <div className="h-4 w-11/12 animate-pulse rounded-sm bg-surface" />
      <div className="h-4 w-4/5 animate-pulse rounded-sm bg-surface" />
      <div className="mt-4 h-28 animate-pulse rounded-md bg-surface" />
    </div>
  );
}

function HistoryList({
  items,
  activeId,
  session,
  onOpen,
  onRemove,
}: {
  items: OutcomeSummary[];
  activeId: string | null;
  session: "pending" | "in" | "out";
  onOpen: (id: string) => void;
  onRemove: (id: string) => void;
}) {
  if (session === "pending") {
    return <div className="mx-4 mt-2 h-16 animate-pulse rounded-md bg-surface" />;
  }
  if (session === "out") {
    return (
      <p className="px-4 py-3 text-sm text-pretty text-muted">
        Sign in and the outcomes you forge stay in this list.
      </p>
    );
  }
  if (items.length === 0) {
    return <p className="px-4 py-3 text-sm text-pretty text-muted">Forged outcomes show up here.</p>;
  }
  return (
    <ul className="scroll-thin flex flex-1 flex-col gap-1 overflow-y-auto px-3 pb-4">
      {items.map((item) => (
        <li key={item.id} className="flex items-stretch">
          <button
            type="button"
            onClick={() => onOpen(item.id)}
            className={cn(
              "focus-ring min-w-0 flex-1 rounded-l-md px-3 py-3 text-left",
              item.id === activeId ? "bg-surface-2" : "hover:bg-surface",
            )}
          >
            <span className="block truncate text-sm font-medium">{item.title}</span>
            <span className="mt-1 block text-xs text-muted">
              {kindLabel(item.kind)} · {formatWhen(item.updatedAt)}
            </span>
          </button>
          <button
            type="button"
            aria-label={`Delete ${item.title}`}
            onClick={() => onRemove(item.id)}
            className="focus-ring press rounded-r-md px-3 text-muted hover:bg-surface-2 hover:text-fg"
          >
            <Trash2 className="size-4" />
          </button>
        </li>
      ))}
    </ul>
  );
}
