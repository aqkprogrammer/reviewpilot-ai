"use client";
import * as React from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Cpu, Gauge, History, Lightbulb, MessageSquareQuote, ScanText, Sparkles, Wand2 } from "lucide-react";
import { FeedbackSummary, SentimentAnalyzer } from "@/components/ai/analyzers";
import { InsightsPanel } from "@/components/ai/insights";
import { ReplyStudio } from "@/components/ai/reply-studio";
import { TemplateGenerator, UsageHistory } from "@/components/ai/templates-and-history";
import { QueryErrorState, ReadOnlyNotice, UpgradePrompt } from "@/components/billing/plan-gate";
import { OpenAIIcon } from "@/components/brand/brand-icons";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/controls";
import { PageHeader } from "@/components/ui/page-header";
import { Skeleton } from "@/components/ui/states";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { api } from "@/lib/api";
import { useOrg } from "@/lib/session";
import { formatNumber } from "@/lib/utils";

interface AIStatus { provider: string; model: string; configured: boolean; entitled: boolean; plan: string | null; used: number; limit: number; tokens: number }

export default function AIAssistantPage() {
  const { can, orgId } = useOrg();
  const qc = useQueryClient();
  const status = useQuery({ queryKey: ["ai", "status", orgId], queryFn: () => api.get<AIStatus>("/ai/status"), enabled: can("ai.use") });
  const onUsage = () => qc.invalidateQueries({ queryKey: ["ai", "status"] });

  if (!can("ai.use")) return <ReadOnlyNotice />;
  const s = status.data;
  const pct = s && s.limit ? Math.min(100, (s.used / s.limit) * 100) : 0;

  return (
    <div>
      <PageHeader title="AI Assistant" description="Draft replies, read sentiment and surface what customers keep telling you — in English, Hindi and Hinglish." />
      {status.isLoading ? (
        <Skeleton className="mb-6 h-24" />
      ) : status.error ? (
        <div className="mb-6"><QueryErrorState error={status.error} onRetry={() => status.refetch()} /></div>
      ) : s && (
        <Card className="relative mb-6 overflow-hidden p-5">
          <div className="pointer-events-none absolute -left-10 -top-20 size-56 rounded-full bg-primary/10 blur-3xl" aria-hidden />
          <div className="relative grid gap-5 md:grid-cols-[1.4fr_1fr] md:items-center">
            <div className="flex items-start gap-4">
              <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl border border-border bg-card shadow-sm">
                {s.configured ? <OpenAIIcon className="size-5 text-foreground" /> : <Cpu className="size-5 text-primary" />}
              </span>
              <div>
                <p className="text-[14px] font-semibold">{s.configured ? `OpenAI · ${s.model}` : "Offline heuristic engine"}</p>
                <p className="mt-0.5 text-[13px] leading-relaxed text-muted-foreground">
                  {s.configured
                    ? "Requests are sent server-side; your API key never reaches the browser."
                    : "No OpenAI key configured — using the offline heuristic engine. Replies are template-based; add OPENAI_API_KEY for model-written replies."}
                </p>
              </div>
            </div>
            {s.entitled ? (
              <div>
                <div className="mb-2 flex items-baseline justify-between text-[13px]">
                  <span className="flex items-center gap-1.5 text-muted-foreground"><Gauge className="size-3.5" />Monthly usage</span>
                  <span className="tabular"><span className="font-semibold text-foreground">{formatNumber(s.used)}</span><span className="text-muted-foreground"> / {formatNumber(s.limit)} requests</span></span>
                </div>
                <Progress value={pct} indicatorClassName={pct > 90 ? "bg-danger" : pct > 70 ? "bg-warning" : undefined} />
                <p className="mt-1.5 text-[11.5px] text-subtle-foreground">Resets on the 1st · {s.plan} plan</p>
              </div>
            ) : (
              <UpgradePrompt compact message={`AI features aren't included in the ${s.plan ?? "current"} plan. Upgrade to Growth for AI replies in three languages.`} />
            )}
          </div>
        </Card>
      )}

      <Tabs defaultValue="reply">
        <div className="-mx-4 mb-6 overflow-x-auto px-4 sm:mx-0 sm:px-0">
          <TabsList variant="underline" className="min-w-max">
            <TabsTrigger value="reply"><Wand2 /> Reply studio</TabsTrigger>
            <TabsTrigger value="insights"><Lightbulb /> Insights</TabsTrigger>
            <TabsTrigger value="summary"><Sparkles /> Feedback summary</TabsTrigger>
            <TabsTrigger value="sentiment"><ScanText /> Sentiment</TabsTrigger>
            <TabsTrigger value="templates"><MessageSquareQuote /> Templates</TabsTrigger>
            <TabsTrigger value="history"><History /> Usage & history</TabsTrigger>
          </TabsList>
        </div>
        <TabsContent value="reply"><ReplyStudio onUsage={onUsage} /></TabsContent>
        <TabsContent value="insights"><InsightsPanel canRefresh={can("ai.use")} /></TabsContent>
        <TabsContent value="summary"><FeedbackSummary onUsage={onUsage} /></TabsContent>
        <TabsContent value="sentiment"><SentimentAnalyzer onUsage={onUsage} /></TabsContent>
        <TabsContent value="templates"><TemplateGenerator onUsage={onUsage} /></TabsContent>
        <TabsContent value="history"><UsageHistory /></TabsContent>
      </Tabs>
    </div>
  );
}
