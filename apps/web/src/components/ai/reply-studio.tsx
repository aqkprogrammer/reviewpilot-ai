"use client";
import * as React from "react";
import { useMutation } from "@tanstack/react-query";
import { Lightbulb, Sparkles, Wand2 } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FormField } from "@/components/ui/form-field";
import { Input, Textarea } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/states";
import { UpgradePrompt } from "@/components/billing/plan-gate";
import { ApiError, api, errorMessage } from "@/lib/api";
import { AI_LANGS, CopyButton, ProviderNote, RatingPicker, Segmented, SentimentBadge, TONES } from "./shared";

interface ReplyOut { reply: string; explanation?: string; sentiment?: string; keywords?: string[]; follow_up?: string; provider: string }

export function ReplyStudio({ onUsage }: { onUsage: () => void }) {
  const [text, setText] = React.useState("");
  const [rating, setRating] = React.useState(4);
  const [name, setName] = React.useState("");
  const [tone, setTone] = React.useState("professional");
  const [lang, setLang] = React.useState("en");
  const gen = useMutation({
    mutationFn: () => api.post<ReplyOut>("/ai/reply", { review_text: text || null, rating, reviewer_name: name || null, tone, language: lang }),
    onSuccess: onUsage,
    onError: (e) => { if (!(e instanceof ApiError && e.status === 402)) toast.error(errorMessage(e)); },
  });
  const r = gen.data;
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card>
        <CardHeader><div><CardTitle>Review</CardTitle><CardDescription>Paste any review — from Google, a message or a form — to draft an owner reply.</CardDescription></div></CardHeader>
        <CardContent className="space-y-5">
          <FormField label="Review text" htmlFor="ai-text">
            <Textarea id="ai-text" rows={6} value={text} onChange={(e) => setText(e.target.value)} placeholder="“Food was great but we waited 40 minutes on Saturday…”" />
          </FormField>
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label="Rating"><RatingPicker value={rating} onChange={setRating} /></FormField>
            <FormField label="Reviewer name" htmlFor="ai-name"><Input id="ai-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Optional" /></FormField>
          </div>
          <FormField label="Tone"><Segmented label="Tone" value={tone} onChange={setTone} options={TONES} /></FormField>
          <FormField label="Language"><Segmented label="Language" value={lang} onChange={setLang} options={AI_LANGS} /></FormField>
          <Button className="w-full" size="lg" loading={gen.isPending} onClick={() => gen.mutate()}><Wand2 /> Generate reply</Button>
        </CardContent>
      </Card>
      <div>
        {gen.error instanceof ApiError && gen.error.status === 402 ? (
          <UpgradePrompt message={gen.error.message} />
        ) : gen.isPending ? (
          <Card className="space-y-3 p-6"><Skeleton className="h-4 w-32" /><Skeleton className="h-24" /><Skeleton className="h-4 w-3/4" /><Skeleton className="h-4 w-1/2" /></Card>
        ) : r ? (
          <Card className="overflow-hidden">
            <div className="flex items-center justify-between border-b border-border bg-background-subtle px-5 py-3">
              <span className="flex items-center gap-2 text-[13px] font-semibold"><Sparkles className="size-4 text-primary" />Suggested reply</span>
              <ProviderNote provider={r.provider} />
            </div>
            <CardContent className="space-y-5">
              <p className="whitespace-pre-wrap rounded-xl border border-primary/15 bg-primary-soft/30 p-4 text-[14px] leading-relaxed text-foreground">{r.reply}</p>
              <div className="flex flex-wrap items-center gap-2">
                <CopyButton text={r.reply} label="Copy reply" />
                <Button variant="ghost" size="sm" onClick={() => gen.mutate()}>Regenerate</Button>
              </div>
              <dl className="grid gap-4 text-[13px] sm:grid-cols-2">
                <div><dt className="text-xs text-muted-foreground">Sentiment</dt><dd className="mt-1"><SentimentBadge value={r.sentiment} /></dd></div>
                <div>
                  <dt className="text-xs text-muted-foreground">Keywords</dt>
                  <dd className="mt-1 flex flex-wrap gap-1">{r.keywords?.length ? r.keywords.map((k) => <Badge key={k} size="sm" variant="outline">{k.replace(/_/g, " ")}</Badge>) : <span className="text-muted-foreground">—</span>}</dd>
                </div>
                {r.explanation && <div className="sm:col-span-2"><dt className="text-xs text-muted-foreground">Why this reply</dt><dd className="mt-1 text-foreground-soft">{r.explanation}</dd></div>}
                {r.follow_up && (
                  <div className="sm:col-span-2 flex gap-2.5 rounded-xl bg-warning-soft p-3">
                    <Lightbulb className="mt-0.5 size-4 shrink-0 text-warning-foreground" />
                    <div><dt className="text-xs font-semibold text-foreground">Recommended follow-up</dt><dd className="mt-0.5 text-foreground-soft">{r.follow_up}</dd></div>
                  </div>
                )}
              </dl>
              <p className="text-[11.5px] text-subtle-foreground">Always review AI drafts before posting. Replies never include incentives or private customer details.</p>
            </CardContent>
          </Card>
        ) : (
          <Card className="flex h-full min-h-80 flex-col items-center justify-center border-dashed p-8 text-center">
            <span className="flex size-12 items-center justify-center rounded-2xl bg-[linear-gradient(135deg,var(--primary),var(--purple))] text-white shadow-glow"><Wand2 className="size-5" /></span>
            <p className="mt-4 text-[15px] font-semibold">Your reply will appear here</p>
            <p className="mt-1.5 max-w-xs text-[13px] text-muted-foreground">Pick a tone and language — Hindi and Hinglish replies read naturally to Indian customers.</p>
          </Card>
        )}
      </div>
    </div>
  );
}
