"use client";
import * as React from "react";
import { useMutation } from "@tanstack/react-query";
import { CircleAlert, Gauge, Heart, Lightbulb, ScanText } from "lucide-react";
import { toast } from "sonner";
import { UpgradePrompt } from "@/components/billing/plan-gate";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FormField } from "@/components/ui/form-field";
import { Textarea } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { EmptyState, Skeleton } from "@/components/ui/states";
import { ApiError, api, errorMessage } from "@/lib/api";
import { useOrg } from "@/lib/session";
import { ProviderNote, RatingPicker, SentimentBadge } from "./shared";

const onErr = (e: unknown) => { if (!(e instanceof ApiError && e.status === 402)) toast.error(errorMessage(e)); };

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
    <div className="grid gap-6 lg:grid-cols-[1.1fr_1fr]">
      <Card>
        <CardHeader><div><CardTitle>Analyze feedback</CardTitle><CardDescription>Classify sentiment and topics for any message, review or survey answer.</CardDescription></div></CardHeader>
        <CardContent className="space-y-4">
          <FormField label="Feedback text" htmlFor="s-text"><Textarea id="s-text" rows={6} value={text} onChange={(e) => setText(e.target.value)} placeholder="Paste customer feedback…" /></FormField>
          <FormField label="Rating (optional)">
            <div className="flex items-center gap-3"><RatingPicker value={rating ?? 0} onChange={setRating} />{rating && <button className="text-xs text-muted-foreground hover:text-foreground" onClick={() => setRating(null)}>Clear</button>}</div>
          </FormField>
          <Button disabled={text.trim().length < 3} loading={m.isPending} onClick={() => m.mutate()}><ScanText /> Analyze</Button>
        </CardContent>
      </Card>
      {m.error instanceof ApiError && m.error.status === 402 ? <UpgradePrompt message={m.error.message} /> : m.data ? (
        <Card>
          <CardHeader><CardTitle>Result</CardTitle><ProviderNote provider={m.data.provider} /></CardHeader>
          <CardContent className="space-y-5">
            <div className="flex items-center gap-3"><SentimentBadge value={m.data.sentiment} /><span className="text-xs text-muted-foreground tabular">score {score.toFixed(2)}</span></div>
            <div>
              <div className="relative h-2 rounded-full bg-[linear-gradient(90deg,var(--danger),var(--warning)_50%,var(--success))]">
                <span className="absolute top-1/2 size-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-[3px] border-card bg-foreground shadow-md" style={{ left: `${((score + 1) / 2) * 100}%` }} />
              </div>
              <div className="mt-1.5 flex justify-between text-[11px] text-subtle-foreground"><span>Negative</span><span>Neutral</span><span>Positive</span></div>
            </div>
            <p className="text-[13.5px] leading-relaxed text-foreground-soft">{m.data.summary}</p>
            <div className="flex flex-wrap gap-1.5">{m.data.topics.map((t) => <Badge key={t} variant="outline">{t.replace(/_/g, " ")}</Badge>)}</div>
          </CardContent>
        </Card>
      ) : (
        <Card className="border-dashed"><EmptyState icon={Gauge} title="No analysis yet" description="Results show sentiment on a −1 to +1 scale, plus the topics mentioned." /></Card>
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
    <div className="space-y-6">
      <Card className="flex flex-col gap-3 p-4 sm:flex-row sm:items-end">
        <FormField label="Period" className="sm:w-44">
          <Select value={days} onValueChange={setDays}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{[["7", "Last 7 days"], ["30", "Last 30 days"], ["90", "Last 90 days"], ["365", "Last 12 months"]].map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}</SelectContent>
          </Select>
        </FormField>
        <FormField label="Location" className="sm:w-60">
          <Select value={loc} onValueChange={setLoc}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="all">All locations</SelectItem>{locations.map((l) => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}</SelectContent>
          </Select>
        </FormField>
        <Button loading={m.isPending} onClick={() => m.mutate()} className="sm:ml-auto">Summarize reviews</Button>
      </Card>
      {m.error instanceof ApiError && m.error.status === 402 ? <UpgradePrompt message={m.error.message} /> : m.isPending ? (
        <div className="grid gap-4 md:grid-cols-3">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-56" />)}</div>
      ) : d ? (
        <>
          <Card className="p-5">
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <span className="text-[13px] font-semibold">Summary</span>
              <Badge size="sm" variant="outline">Based on {d.review_count} reviews</Badge>
              <ProviderNote provider={d.provider} />
            </div>
            <p className="text-[14px] leading-relaxed text-foreground-soft">{d.summary}</p>
          </Card>
          <div className="grid gap-4 md:grid-cols-3">
            <Column title="Recurring complaints" icon={CircleAlert} tone="text-danger-foreground bg-danger-soft" items={d.recurring_complaints} empty="No recurring complaints found." />
            <Column title="Positive highlights" icon={Heart} tone="text-success-foreground bg-success-soft" items={d.positive_highlights} empty="No repeated praise found yet." />
            <Column title="Recommendations" icon={Lightbulb} tone="text-warning-foreground bg-warning-soft" items={d.recommendations} empty="Nothing urgent to recommend." />
          </div>
        </>
      ) : (
        <Card className="border-dashed"><EmptyState icon={ScanText} title="Summarize what customers are saying" description="We read the actual review text for the period and surface themes with counts — no invented data." /></Card>
      )}
    </div>
  );
}

function Column({ title, icon: Icon, tone, items, empty }: { title: string; icon: React.ComponentType<{ className?: string }>; tone: string; items: { title: string; detail: string; count?: number }[]; empty: string }) {
  return (
    <Card>
      <CardHeader><CardTitle className="flex items-center gap-2"><span className={`flex size-7 items-center justify-center rounded-lg ${tone}`}><Icon className="size-3.5" /></span>{title}</CardTitle></CardHeader>
      <CardContent className="space-y-3">
        {items.length === 0 ? <p className="text-[13px] text-muted-foreground">{empty}</p> : items.map((i, k) => (
          <div key={k} className="rounded-xl border border-border p-3">
            <div className="flex items-start justify-between gap-2"><p className="text-[13px] font-medium">{i.title}</p>{!!i.count && <Badge size="sm" className="tabular">{i.count}</Badge>}</div>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{i.detail}</p>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
