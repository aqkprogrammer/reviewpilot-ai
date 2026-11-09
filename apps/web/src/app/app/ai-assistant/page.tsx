"use client";
import * as React from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Tabs } from "radix-ui";
import { Cpu, History, Lightbulb, MessageSquareQuote, ScanText, Sparkles, Wand2 } from "lucide-react";
import { FeedbackSummary, SentimentAnalyzer } from "@/components/ai/analyzers";
import { InsightsPanel } from "@/components/ai/insights";
import { ReplyStudio } from "@/components/ai/reply-studio";
import { TemplateGenerator, UsageHistory } from "@/components/ai/templates-and-history";
import { QueryErrorState, ReadOnlyNotice, UpgradePrompt } from "@/components/billing/plan-gate";
import { OpenAIIcon } from "@/components/brand/brand-icons";
import { ConsoleTabsList, Eyebrow, IconTile } from "@/components/console/kit";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { Skeleton } from "@/components/ui/states";
import { AnimatedNumber, GridBackdrop, SegmentMeter, StatusDot } from "@/components/ui/tech";
import { api } from "@/lib/api";
import { useOrg } from "@/lib/session";
import { cn, formatNumber, titleCase } from "@/lib/utils";

interface AIStatus { provider: string; model: string; configured: boolean; entitled: boolean; plan: string | null; used: number; limit: number; tokens: number }

const TABS = [
  { value: "reply", label: "Reply studio", icon: Wand2 },
  { value: "insights", label: "Insights", icon: Lightbulb },
  { value: "summary", label: "Feedback summary", icon: Sparkles },
  { value: "sentiment", label: "Sentiment", icon: ScanText },
  { value: "templates", label: "Templates", icon: MessageSquareQuote },
  { value: "history", label: "Usage & history", icon: History },
];

function EngineConsole({ s }: { s: AIStatus }) {
  const pct = s.limit ? Math.min(100, (s.used / s.limit) * 100) : 0;
  const tone = pct > 90 ? "danger" : pct > 70 ? "warning" : "primary";
  const left = Math.max(0, s.limit - s.used);
  return (
    <Card className="relative overflow-hidden">
      <GridBackdrop light={s.configured} />
      <div className="relative grid lg:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)]">
        {/* Engine identity */}
        <div className="p-5 sm:p-6">
          <div className="flex items-start gap-4">
            <IconTile size={48} signal={s.configured}>{s.configured ? <OpenAIIcon /> : <Cpu />}</IconTile>
            <div className="min-w-0">
              <p className="flex items-center gap-2 font-mono text-[10.5px] uppercase tracking-[0.14em] text-subtle-foreground">
                <StatusDot tone={s.configured ? "live" : "warn"} pulse={s.configured} />
                {s.configured ? "Engine online" : "Fallback engine active"}
              </p>
              <h2 className="mt-1.5 text-[18px] font-semibold tracking-[-0.02em]">{s.configured ? `OpenAI · ${s.model}` : "Offline heuristic engine"}</h2>
              <p className="mt-1 max-w-xl text-[13px] leading-relaxed text-muted-foreground">
                {s.configured
                  ? "Requests are sent server-side; your API key never reaches the browser."
                  : "No OpenAI key configured — using the offline heuristic engine. Replies are template-based; add OPENAI_API_KEY for model-written replies."}
              </p>
            </div>
          </div>
          <dl className="mt-5 grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-border bg-border sm:grid-cols-4">
            {[
              ["Provider", s.provider === "openai" ? "OpenAI" : "Heuristic"],
              ["Model", s.model],
              ["API key", s.configured ? "Server-side" : "Not set"],
              ["Plan", s.plan ? titleCase(s.plan) : "—"],
            ].map(([l, v]) => (
              <div key={l} className="min-w-0 bg-card/90 px-3 py-2.5">
                <dt className="micro-label">{l}</dt>
                <dd className={cn("mt-1 truncate font-mono text-[12px]", l === "API key" && !s.configured ? "text-warning-foreground" : "text-foreground")}>{v}</dd>
              </div>
            ))}
          </dl>
        </div>
        {/* Usage meter */}
        <div className="border-t border-border bg-background-subtle/40 p-5 sm:p-6 lg:border-l lg:border-t-0">
          {s.entitled ? (
            <div className="flex h-full flex-col">
              <p className="micro-label">Monthly allowance</p>
              <div className="mt-3 flex items-baseline gap-2">
                <span className="text-[34px] font-semibold leading-none tracking-[-0.04em] tabular"><AnimatedNumber value={s.used} /></span>
                <span className="font-mono text-[13px] text-muted-foreground tabular">/ {formatNumber(s.limit)}</span>
                <span className="ml-auto font-mono text-[12px] tabular text-muted-foreground">{pct.toFixed(0)}%</span>
              </div>
              <SegmentMeter value={pct} segments={32} tone={tone} className="mt-4 w-full justify-between" />
              <dl className="mt-auto grid grid-cols-3 gap-3 pt-5">
                <div><dt className="micro-label">Remaining</dt><dd className="mt-1 font-mono text-[13px] tabular">{formatNumber(left)}</dd></div>
                <div><dt className="micro-label">Tokens</dt><dd className="mt-1 font-mono text-[13px] tabular">{s.tokens ? formatNumber(s.tokens) : "—"}</dd></div>
                <div><dt className="micro-label">Resets</dt><dd className="mt-1 font-mono text-[13px]">1st · monthly</dd></div>
              </dl>
            </div>
          ) : (
            <UpgradePrompt compact message={`AI features aren't included in the ${s.plan ?? "current"} plan. Upgrade to Growth for AI replies in three languages.`} />
          )}
        </div>
      </div>
    </Card>
  );
}

export default function AIAssistantPage() {
  const { can, orgId } = useOrg();
  const qc = useQueryClient();
  const [tab, setTab] = React.useState("reply");
  const status = useQuery({ queryKey: ["ai", "status", orgId], queryFn: () => api.get<AIStatus>("/ai/status"), enabled: can("ai.use") });
  const onUsage = () => qc.invalidateQueries({ queryKey: ["ai", "status"] });

  if (!can("ai.use")) return <ReadOnlyNotice />;
  const s = status.data;

  return (
    <div className="space-y-6">
      <PageHeader
        className="mb-0"
        eyebrow={<Eyebrow live={!!s?.configured} parts={["Intelligence", "Assistant console"]} />}
        title="AI Assistant"
        description="Draft replies, read sentiment and surface what customers keep telling you — in English, Hindi and Hinglish."
      />
      {status.isLoading ? (
        <Skeleton className="h-52 rounded-xl" />
      ) : status.error ? (
        <QueryErrorState error={status.error} onRetry={() => status.refetch()} />
      ) : s && <EngineConsole s={s} />}

      <Tabs.Root value={tab} onValueChange={setTab}>
        <ConsoleTabsList id="ai" value={tab} items={TABS} className="mb-6" />
        <Tabs.Content value="reply" className="outline-none data-[state=active]:animate-[fade-up_0.25s_ease-out]"><ReplyStudio onUsage={onUsage} /></Tabs.Content>
        <Tabs.Content value="insights" className="outline-none data-[state=active]:animate-[fade-up_0.25s_ease-out]"><InsightsPanel canRefresh={can("ai.use")} /></Tabs.Content>
        <Tabs.Content value="summary" className="outline-none data-[state=active]:animate-[fade-up_0.25s_ease-out]"><FeedbackSummary onUsage={onUsage} /></Tabs.Content>
        <Tabs.Content value="sentiment" className="outline-none data-[state=active]:animate-[fade-up_0.25s_ease-out]"><SentimentAnalyzer onUsage={onUsage} /></Tabs.Content>
        <Tabs.Content value="templates" className="outline-none data-[state=active]:animate-[fade-up_0.25s_ease-out]"><TemplateGenerator onUsage={onUsage} /></Tabs.Content>
        <Tabs.Content value="history" className="outline-none data-[state=active]:animate-[fade-up_0.25s_ease-out]"><UsageHistory /></Tabs.Content>
      </Tabs.Root>
    </div>
  );
}
