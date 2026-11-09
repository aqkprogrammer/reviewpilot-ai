"use client";
import * as React from "react";
import { useMutation } from "@tanstack/react-query";
import { motion, useReducedMotion } from "motion/react";
import { CircleAlert, Gauge, Heart, Lightbulb, ScanText, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { UpgradePrompt } from "@/components/billing/plan-gate";
import { Panel } from "@/components/console/kit";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Reveal } from "@/components/ui/tech";
import { ApiError, api, errorMessage } from "@/lib/api";
import { useOrg } from "@/lib/session";
import { cn } from "@/lib/utils";
import { AwaitingInput, ConsoleField, GeneratingState, OutputHeader, RatingPicker, SentimentBadge } from "./shared";

const onErr = (e: unknown) => { if (!(e instanceof ApiError && e.status === 402)) toast.error(errorMessage(e)); };

/** −1 … +1 scale with tick marks and an animated marker. */
function SentimentScale({ score }: { score: number }) {
  const reduce = useReducedMotion();
  const pct = ((Math.max(-1, Math.min(1, score)) + 1) / 2) * 100;
  return (
    <div>
      <div className="relative h-9">
        <div className="absolute inset-x-0 top-1/2 h-1.5 -translate-y-1/2 overflow-hidden rounded-full bg-[linear-gradient(90deg,var(--danger),var(--warning)_50%,var(--success))] opacity-80" />
        <div className="absolute inset-x-0 top-1/2 flex -translate-y-1/2 justify-between px-px" aria-hidden>
          {Array.from({ length: 21 }, (_, i) => <span key={i} className={cn("w-px bg-background/70", i % 5 === 0 ? "h-3.5" : "h-1.5")} />)}
        </div>
        <motion.span
          className="absolute top-1/2 flex -translate-x-1/2 -translate-y-1/2 flex-col items-center"
          initial={reduce ? false : { left: "50%" }}
          animate={{ left: `${pct}%` }}
          transition={{ type: "spring", stiffness: 160, damping: 22 }}
        >
          <span className="size-4 rounded-full border-[3px] border-card bg-foreground shadow-[0_0_0_1px_var(--border-strong),0_4px_12px_rgb(0_0_0/0.35)]" />
        </motion.span>
      </div>
      <div className="mt-1 flex justify-between font-mono text-[10px] uppercase tracking-[0.1em] text-subtle-foreground"><span>−1 Negative</span><span>0</span><span>Positive +1</span></div>
    </div>
  );
}

export function SentimentAnalyzer({ onUsage }: { onUsage: () => void }) {
  const [text, setText] = React.useState("");
  const [rating, setRating] = React.useState<number | null>(null);
  const m = useMutation({
    mutationFn: () => api.post<{ sentiment: string; score: number; topics: string[]; summary: string; provider: string }>("/ai/sentiment", { text, rating }),
    onSuccess: onUsage,
    onError: onErr,
  });
  const score = m.data?.score ?? 0;
  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
      <Panel label="Input · feedback" title="Analyze feedback" description="Classify sentiment and topics for any message, review or survey answer.">
        <div className="space-y-5">
          <ConsoleField index="01" label="Feedback text" htmlFor="s-text"><Textarea id="s-text" rows={6} value={text} onChange={(e) => setText(e.target.value)} placeholder="Paste customer feedback…" /></ConsoleField>
          <ConsoleField index="02" label="Rating (optional)" aside={rating ? <button type="button" className="font-mono text-[10.5px] uppercase tracking-[0.1em] text-muted-foreground hover:text-foreground" onClick={() => setRating(null)}>Clear</button> : null}>
            <RatingPicker value={rating ?? 0} onChange={setRating} />
          </ConsoleField>
          <div className="border-t border-border pt-5"><Button disabled={text.trim().length < 3} loading={m.isPending} onClick={() => m.mutate()}><ScanText /> Analyze</Button></div>
        </div>
      </Panel>
      {m.error instanceof ApiError && m.error.status === 402 ? <UpgradePrompt message={m.error.message} /> : m.isPending ? (
        <Card className="overflow-hidden"><OutputHeader label="Output · classifying" /><div className="p-5"><GeneratingState label="Classifying" /></div></Card>
      ) : m.data ? (
        <Card className="overflow-hidden">
          <OutputHeader label="Output · classification" provider={m.data.provider} />
          <div className="space-y-5 p-5">
            <div className="flex items-end justify-between gap-4">
              <div>
                <p className="micro-label">Score</p>
                <p className="mt-1 font-mono text-[32px] font-semibold leading-none tracking-[-0.04em] tabular">{score >= 0 ? "+" : "−"}{Math.abs(score).toFixed(2)}</p>
              </div>
              <SentimentBadge value={m.data.sentiment} />
            </div>
            <SentimentScale score={score} />
            <p className="border-t border-border pt-4 text-[13.5px] leading-relaxed text-foreground-soft">{m.data.summary}</p>
            {m.data.topics.length > 0 && (
              <div>
                <p className="micro-label mb-2">Topics detected</p>
                <div className="flex flex-wrap gap-1.5">{m.data.topics.map((t) => <span key={t} className="rounded-[5px] border border-border bg-background-subtle px-2 py-0.5 font-mono text-[11px] text-foreground-soft">{t.replace(/_/g, " ")}</span>)}</div>
              </div>
            )}
          </div>
        </Card>
      ) : (
        <AwaitingInput icon={Gauge} title="No analysis yet" description="Results show sentiment on a −1 to +1 scale, plus the topics mentioned." />
      )}
    </div>
  );
}

interface SummaryOut {
  summary: string; review_count: number; provider: string;
  recurring_complaints: { title: string; detail: string; count?: number }[];
  positive_highlights: { title: string; detail: string; count?: number }[];
  recommendations: { title: string; detail: string }[];
}

export function FeedbackSummary({ onUsage }: { onUsage: () => void }) {
  const { locations, locationId } = useOrg();
  const [days, setDays] = React.useState("30");
  const [loc, setLoc] = React.useState(locationId ?? "all");
  const m = useMutation({
    mutationFn: () => api.post<SummaryOut>("/ai/summary", { days: Number(days), location_id: loc === "all" ? null : loc }),
    onSuccess: onUsage,
    onError: onErr,
  });
  const d = m.data;
  return (
    <div className="space-y-5">
      <Card className="flex flex-col gap-4 p-4 sm:flex-row sm:items-end">
        <ConsoleField index="01" label="Period" className="sm:w-48">
          <Select value={days} onValueChange={setDays}>
            <SelectTrigger aria-label="Period"><SelectValue /></SelectTrigger>
            <SelectContent>{[["7", "Last 7 days"], ["30", "Last 30 days"], ["90", "Last 90 days"], ["365", "Last 12 months"]].map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}</SelectContent>
          </Select>
        </ConsoleField>
        <ConsoleField index="02" label="Location" className="sm:w-64">
          <Select value={loc} onValueChange={setLoc}>
            <SelectTrigger aria-label="Location"><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="all">All locations</SelectItem>{locations.map((l) => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}</SelectContent>
          </Select>
        </ConsoleField>
        <Button loading={m.isPending} onClick={() => m.mutate()} className="sm:ml-auto"><Sparkles /> Summarize reviews</Button>
      </Card>
      {m.error instanceof ApiError && m.error.status === 402 ? <UpgradePrompt message={m.error.message} /> : m.isPending ? (
        <GeneratingState label="Reading reviews" />
      ) : d ? (
        <>
          <Reveal>
            <Card className="overflow-hidden">
              <OutputHeader label={`Summary · ${d.review_count} reviews`} provider={d.provider} />
              <p className="p-5 text-[14.5px] leading-relaxed text-foreground">{d.summary}</p>
            </Card>
          </Reveal>
          <div className="grid gap-5 md:grid-cols-3">
            <Column index="A" title="Recurring complaints" icon={CircleAlert} tone="text-danger-foreground" items={d.recurring_complaints} empty="No recurring complaints found." />
            <Column index="B" title="Positive highlights" icon={Heart} tone="text-success-foreground" items={d.positive_highlights} empty="No repeated praise found yet." />
            <Column index="C" title="Recommendations" icon={Lightbulb} tone="text-amber" items={d.recommendations} empty="Nothing urgent to recommend." />
          </div>
        </>
      ) : (
        <AwaitingInput icon={ScanText} title="Summarize what customers are saying" description="We read the actual review text for the period and surface themes with counts — no invented data." />
      )}
    </div>
  );
}

function Column({ index, title, icon: Icon, tone, items, empty }: { index: string; title: string; icon: React.ComponentType<{ className?: string }>; tone: string; items: { title: string; detail: string; count?: number }[]; empty: string }) {
  return (
    <Reveal className="min-w-0">
      <Card className="h-full overflow-hidden">
        <div className="flex items-center gap-2 border-b border-border px-4 py-3">
          <Icon className={cn("size-4", tone)} />
          <h3 className="text-[13.5px] font-semibold">{title}</h3>
          <span className="ml-auto font-mono text-[10.5px] text-subtle-foreground">{index} · {String(items.length).padStart(2, "0")}</span>
        </div>
        {items.length === 0 ? <p className="p-4 text-[13px] text-muted-foreground">{empty}</p> : (
          <ul className="divide-y divide-border">
            {items.map((i, k) => (
              <li key={k} className="px-4 py-3.5">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-[13px] font-medium leading-snug">{i.title}</p>
                  {!!i.count && <span className={cn("shrink-0 font-mono text-[11px] tabular", tone)}>×{i.count}</span>}
                </div>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{i.detail}</p>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </Reveal>
  );
}
