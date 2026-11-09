"use client";
import * as React from "react";
import { useMutation } from "@tanstack/react-query";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { CornerDownLeft, Lightbulb, RotateCw, Wand2 } from "lucide-react";
import { toast } from "sonner";
import { Panel } from "@/components/console/kit";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input, Textarea } from "@/components/ui/input";
import { Kbd } from "@/components/ui/tech";
import { UpgradePrompt } from "@/components/billing/plan-gate";
import { ApiError, api, errorMessage } from "@/lib/api";
import { AI_LANGS, AwaitingInput, ConsoleField, CopyButton, GeneratingState, OutputHeader, RatingPicker, Segmented, SentimentBadge, TONES } from "./shared";

interface ReplyOut { reply: string; explanation?: string; sentiment?: string; keywords?: string[]; follow_up?: string; provider: string }

export function ReplyStudio({ onUsage }: { onUsage: () => void }) {
  const reduce = useReducedMotion();
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
  const words = text.trim() ? text.trim().split(/\s+/).length : 0;

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]">
      <Panel label="Input · review" title="Review to answer" description="Paste any review — from Google, a message or a form — to draft an owner reply.">
        <form
          className="space-y-5"
          onSubmit={(e) => { e.preventDefault(); gen.mutate(); }}
          onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); gen.mutate(); } }}
        >
          <ConsoleField index="01" label="Review text" htmlFor="ai-text" aside={<span className="font-mono text-[10.5px] tabular text-subtle-foreground">{words} words</span>}>
            <Textarea id="ai-text" rows={6} value={text} onChange={(e) => setText(e.target.value)} placeholder="“Food was great but we waited 40 minutes on Saturday…”" className="leading-relaxed" />
          </ConsoleField>
          <div className="grid gap-5 sm:grid-cols-[auto_minmax(0,1fr)]">
            <ConsoleField index="02" label="Rating"><RatingPicker value={rating} onChange={setRating} /></ConsoleField>
            <ConsoleField index="03" label="Reviewer name" htmlFor="ai-name"><Input id="ai-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Optional" /></ConsoleField>
          </div>
          <ConsoleField index="04" label="Tone"><Segmented id="reply-tone" label="Tone" value={tone} onChange={setTone} options={TONES} /></ConsoleField>
          <ConsoleField index="05" label="Language"><Segmented id="reply-lang" label="Language" value={lang} onChange={setLang} options={AI_LANGS} /></ConsoleField>
          <div className="flex items-center gap-3 border-t border-border pt-5">
            <Button type="submit" size="lg" className="flex-1" loading={gen.isPending}><Wand2 /> {r ? "Generate again" : "Generate reply"}</Button>
            <span className="hidden items-center gap-1 text-subtle-foreground sm:flex" aria-hidden><Kbd>⌘</Kbd><Kbd><CornerDownLeft className="size-3" /></Kbd></span>
          </div>
        </form>
      </Panel>

      <div className="min-w-0">
        <AnimatePresence mode="wait" initial={false}>
          {gen.error instanceof ApiError && gen.error.status === 402 ? (
            <motion.div key="gate" initial={reduce ? false : { opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}><UpgradePrompt message={gen.error.message} /></motion.div>
          ) : gen.isPending ? (
            <motion.div key="busy" initial={reduce ? false : { opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <Card className="overflow-hidden"><OutputHeader label="Output · drafting" /><div className="p-5"><GeneratingState label="Drafting reply" /></div></Card>
            </motion.div>
          ) : r ? (
            <motion.div key={r.reply} initial={reduce ? false : { opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}>
              <Card className="overflow-hidden">
                <OutputHeader label="Output · suggested reply" provider={r.provider} />
                <div className="space-y-5 p-5">
                  <div className="relative rounded-lg border border-[color-mix(in_oklab,var(--primary)_28%,var(--border))] bg-primary-soft/40 p-4 pl-5 before:absolute before:inset-y-3 before:left-0 before:w-[2px] before:rounded-full before:bg-primary before:shadow-[0_0_8px_var(--primary)]">
                    <p className="whitespace-pre-wrap text-[14px] leading-relaxed text-foreground">{r.reply}</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <CopyButton text={r.reply} label="Copy reply" />
                    <Button variant="ghost" size="sm" onClick={() => gen.mutate()}><RotateCw /> Regenerate</Button>
                    <span className="ml-auto font-mono text-[10.5px] tabular text-subtle-foreground">{r.reply.length} chars</span>
                  </div>
                  <dl className="grid gap-px overflow-hidden rounded-lg border border-border bg-border sm:grid-cols-2">
                    <div className="bg-card p-3.5"><dt className="micro-label">Sentiment</dt><dd className="mt-2">{r.sentiment ? <SentimentBadge value={r.sentiment} /> : <span className="text-muted-foreground">—</span>}</dd></div>
                    <div className="bg-card p-3.5">
                      <dt className="micro-label">Keywords</dt>
                      <dd className="mt-2 flex flex-wrap gap-1">{r.keywords?.length ? r.keywords.map((k) => <span key={k} className="rounded-[4px] border border-border px-1.5 py-px font-mono text-[10.5px] text-foreground-soft">{k.replace(/_/g, " ")}</span>) : <span className="text-muted-foreground">—</span>}</dd>
                    </div>
                    {r.explanation && <div className="bg-card p-3.5 sm:col-span-2"><dt className="micro-label">Why this reply</dt><dd className="mt-1.5 text-[13px] leading-relaxed text-foreground-soft">{r.explanation}</dd></div>}
                  </dl>
                  {r.follow_up && (
                    <div className="flex gap-3 rounded-lg border border-[color-mix(in_oklab,var(--amber)_28%,transparent)] bg-amber-soft p-3.5">
                      <Lightbulb className="mt-0.5 size-4 shrink-0 text-amber" />
                      <div><p className="micro-label !text-amber">Recommended follow-up</p><p className="mt-1 text-[13px] leading-relaxed text-foreground-soft">{r.follow_up}</p></div>
                    </div>
                  )}
                  <p className="border-t border-border pt-3 text-[11.5px] text-subtle-foreground">Always review AI drafts before posting. Replies never include incentives or private customer details.</p>
                </div>
              </Card>
            </motion.div>
          ) : (
            <motion.div key="idle" className="h-full" initial={reduce ? false : { opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <AwaitingInput icon={Wand2} title="Your reply will appear here" description="Pick a tone and language — Hindi and Hinglish replies read naturally to Indian customers." />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
