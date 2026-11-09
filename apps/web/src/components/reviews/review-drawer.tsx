"use client";
import * as React from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format, formatDistanceToNow } from "date-fns";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { toast } from "sonner";
import {
  CheckCircle2, Flag, HeartHandshake, Lightbulb, MapPin, RotateCcw, Save, Send, ShieldCheck, Sparkles, Wand2,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Avatar } from "@/components/ui/controls";
import { Textarea } from "@/components/ui/input";
import { Sheet, SheetBody, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { ErrorState, InlineAlert, Skeleton } from "@/components/ui/states";
import { Stars } from "@/components/ui/stars";
import { StatusDot } from "@/components/ui/tech";
import { StatusBadge } from "@/components/app/status-badge";
import { MonoTime, Segmented } from "@/components/dashboard/kit";
import { ApiError, api, errorMessage } from "@/lib/api";
import { useOrg } from "@/lib/session";
import { cn, titleCase } from "@/lib/utils";
import { SENTIMENT_VARIANT, TOPIC_LABELS, ratingTone, type ReviewDetail, type Suggestion } from "./types";

const TONES = ["professional", "friendly", "empathetic", "appreciative", "concise", "apologetic"] as const;
const LANGS = [
  { value: "en", label: "English" },
  { value: "hi", label: "Hindi" },
  { value: "hinglish", label: "Hinglish" },
];

const EVENT_TONE: Record<string, "ok" | "warn" | "error" | "signal" | "idle"> = {
  published: "ok", reply_published: "ok", reply_published_demo: "ok", demo_seeded: "idle", handled: "idle", reopened: "warn", flagged: "error", unflagged: "idle", publish_failed: "error", reply_failed: "error", created: "signal", synced: "signal", draft_saved: "signal", reply_saved: "signal",
};

function Section({ index, label, children, aside, className }: { index: string; label: string; children: React.ReactNode; aside?: React.ReactNode; className?: string }) {
  return (
    <section className={className}>
      <div className="mb-2.5 flex items-center justify-between gap-2">
        <h4 className="micro-label flex items-center gap-2"><span className="text-primary/80">{index}</span><span aria-hidden className="h-px w-3 bg-border-strong" />{label}</h4>
        {aside}
      </div>
      {children}
    </section>
  );
}

export function ReviewDrawer({ reviewId, onClose }: { reviewId: string | null; onClose: () => void }) {
  return (
    <Sheet open={!!reviewId} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="sm:max-w-[600px]">
        {reviewId ? <DrawerBody key={reviewId} reviewId={reviewId} /> : null}
      </SheetContent>
    </Sheet>
  );
}

function DrawerBody({ reviewId }: { reviewId: string }) {
  const { orgId, can } = useOrg();
  const qc = useQueryClient();
  const reduce = useReducedMotion();
  const canReply = can("reviews.reply");
  const key = ["review", orgId, reviewId];
  const q = useQuery({ queryKey: key, queryFn: () => api.get<ReviewDetail>(`/reviews/${reviewId}`) });
  const r = q.data;

  const draft = r?.replies.find((x) => x.status === "draft" || x.status === "failed");
  const [tone, setTone] = React.useState<string>("professional");
  const [lang, setLang] = React.useState("en");
  const [body, setBody] = React.useState("");
  const [suggestion, setSuggestion] = React.useState<Suggestion | null>(null);
  const [generationId, setGenerationId] = React.useState<string | null>(null);
  const initialised = React.useRef(false);

  React.useEffect(() => {
    if (!r || initialised.current) return;
    initialised.current = true;
    if (draft) {
      setBody(draft.body);
      if (draft.tone) setTone(draft.tone);
      if (draft.language) setLang(draft.language);
    } else if (r.rating <= 2) {
      setTone("empathetic");
    }
  }, [r, draft]);

  const refresh = (data: ReviewDetail) => {
    qc.setQueryData(key, data);
    qc.invalidateQueries({ queryKey: ["reviews"] });
    qc.invalidateQueries({ queryKey: ["analytics"] });
  };

  const suggest = useMutation({
    mutationFn: () => api.post<Suggestion>(`/reviews/${reviewId}/suggest`, { tone, language: lang }),
    onSuccess: (s) => {
      setSuggestion(s);
      setBody(s.reply);
      setGenerationId(s.generation_id);
    },
    onError: (e) => toast.error(e instanceof ApiError && e.code === "plan_limit_exceeded" ? e.message : `AI reply failed: ${errorMessage(e)}`),
  });
  const save = useMutation({
    mutationFn: () => api.put<ReviewDetail>(`/reviews/${reviewId}/reply`, { body, tone, language: lang, ai_generation_id: generationId }),
    onSuccess: (d) => { refresh(d); toast.success("Draft saved"); },
    onError: (e) => toast.error(errorMessage(e)),
  });
  const publish = useMutation({
    mutationFn: async () => {
      await api.put<ReviewDetail>(`/reviews/${reviewId}/reply`, { body, tone, language: lang, ai_generation_id: generationId });
      return api.post<ReviewDetail>(`/reviews/${reviewId}/reply/publish`);
    },
    onSuccess: (d) => {
      refresh(d);
      toast.success(d.publish_mode === "demo" ? "Reply recorded (demo review — not sent to Google)" : "Reply queued for publishing to Google");
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
  const action = useMutation({
    mutationFn: (path: "handled" | "reopen" | "flag") => api.post<ReviewDetail>(`/reviews/${reviewId}/${path}`),
    onSuccess: (d, path) => { refresh(d); toast.success(path === "handled" ? "Marked as handled" : path === "reopen" ? "Review reopened" : d.is_flagged ? "Flagged for follow-up" : "Flag removed"); },
    onError: (e) => toast.error(errorMessage(e)),
  });

  if (q.isError) return <div className="p-6"><ErrorState message={errorMessage(q.error)} onRetry={() => q.refetch()} /></div>;
  if (!r) {
    return (
      <div className="space-y-4 p-6">
        <Skeleton className="h-6 w-48" />
        <Skeleton className="h-24" />
        <Skeleton className="h-40" />
      </div>
    );
  }

  const negative = r.rating <= 2;
  const published = r.replies.find((x) => x.status === "published" || x.status === "pending_publish");
  const busy = suggest.isPending || save.isPending || publish.isPending;
  const rt = ratingTone(r.rating);
  const created = new Date(r.review_created_at);
  const words = body.trim() ? body.trim().split(/\s+/).length : 0;
  const showCompose = canReply && !published;
  const idx = (() => {
    let n = 1;
    const next = () => String(++n).padStart(2, "0");
    return { reply: r.platform_reply ? next() : "", compose: showCompose ? next() : "", history: next() };
  })();

  return (
    <>
      <SheetHeader className="relative overflow-hidden">
        <p className="micro-label mb-3 flex items-center gap-2">
          <StatusDot tone={r.response_status === "pending" ? "warn" : r.response_status === "responded" ? "ok" : "idle"} />
          Review · <span className="font-mono normal-case tracking-normal text-subtle-foreground">{r.id.slice(0, 8)}</span>
        </p>
        <div className="flex items-start gap-3">
          <Avatar name={r.reviewer_name ?? "Anonymous"} src={r.reviewer_photo_url} size={40} />
          <div className="min-w-0 flex-1">
            <SheetTitle className="text-[17px] tracking-[-0.015em]">{r.reviewer_name ?? "Anonymous reviewer"}</SheetTitle>
            <SheetDescription className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
              <Stars rating={r.rating} size={12} />
              <MonoTime>{format(created, "dd MMM yyyy · HH:mm")}</MonoTime>
              {r.location_name && <span className="inline-flex items-center gap-1 text-[12px]"><MapPin className="size-3" />{r.location_name}</span>}
            </SheetDescription>
          </div>
          <div className={cn("hidden rounded-lg border border-border px-2.5 py-1.5 text-center sm:block", rt.soft)}>
            <p className={cn("font-mono text-[18px] font-medium leading-none tabular", rt.text)}>{r.rating}.0</p>
            <p className="micro-label mt-1 !text-[9px]">Rating</p>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap gap-1.5">
          <StatusBadge status={r.response_status} />
          <Badge size="sm" variant={r.source === "demo" ? "amber" : "info"} mono>{r.source === "demo" ? "Demo data" : "Google"}</Badge>
          {r.sentiment && <Badge size="sm" variant={SENTIMENT_VARIANT[r.sentiment] ?? "neutral"} dot className="capitalize">{r.sentiment}</Badge>}
          {r.is_flagged && <Badge size="sm" variant="danger" mono><Flag /> Flagged</Badge>}
        </div>
      </SheetHeader>

      <SheetBody className="space-y-7">
        <Section index="01" label="Review">
          <blockquote className={cn("relative rounded-lg border border-border bg-background-subtle py-3.5 pl-5 pr-4 text-[14px] leading-relaxed text-foreground before:absolute before:inset-y-3 before:left-0 before:w-[2px] before:rounded-full", rt.quote)}>
            {r.comment || <span className="italic text-muted-foreground">The reviewer left a rating without text.</span>}
          </blockquote>
          {!!r.topics.length && (
            <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
              <span className="micro-label mr-1">Topics</span>
              {r.topics.map((t) => <Badge key={t} size="sm" variant="outline">{TOPIC_LABELS[t] ?? titleCase(t)}</Badge>)}
            </div>
          )}
        </Section>

        {r.platform_reply && (
          <Section index={idx.reply} label={`Owner reply ${r.source === "demo" ? "· demo" : "· on Google"}`}>
            <div className="rounded-lg border border-[color-mix(in_oklab,var(--primary)_25%,var(--border))] bg-primary-soft p-4 text-[13.5px] leading-relaxed text-foreground">
              {r.platform_reply}
              {r.platform_reply_at && <p className="mt-2"><MonoTime>Replied {formatDistanceToNow(new Date(r.platform_reply_at), { addSuffix: true })}</MonoTime></p>}
            </div>
          </Section>
        )}

        {canReply && !published && (
          <Section
            index={idx.compose}
            label="Compose reply"
            aside={suggestion && (
              <Badge size="sm" variant={suggestion.provider === "openai" ? "primary" : "neutral"} mono>
                <Sparkles /> {suggestion.provider === "openai" ? "OpenAI" : "Offline heuristic"}
              </Badge>
            )}
          >
            <div className="space-y-3">
              {negative && (
                <InlineAlert variant="warning" icon={HeartHandshake} title="Respond with empathy">
                  Acknowledge the experience, apologise sincerely and invite them to continue privately. Never argue or share visit details publicly.
                </InlineAlert>
              )}
              <div className="space-y-2">
                <p className="micro-label">Tone</p>
                <Segmented id={`tone-${reviewId}`} ariaLabel="Tone" size="sm" fill className="grid grid-cols-3" value={tone} onChange={setTone} options={TONES.map((t) => ({ value: t, label: titleCase(t) }))} />
              </div>
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div className="space-y-2">
                  <p className="micro-label">Language</p>
                  <Segmented id={`lang-${reviewId}`} ariaLabel="Language" size="sm" value={lang} onChange={setLang} options={LANGS} />
                </div>
                <Button variant={body ? "soft" : "primary"} size="sm" onClick={() => suggest.mutate()} loading={suggest.isPending}>
                  <Wand2 /> {body ? "Regenerate" : "Generate with AI"}
                </Button>
              </div>
              <div className={cn("relative rounded-lg transition", suggest.isPending && "tech-corners")}>
                <Textarea value={body} onChange={(e) => setBody(e.target.value)} rows={7} maxLength={4000} placeholder="Write a reply, or generate one with AI and edit it before publishing." aria-label="Reply text" className={cn("pb-8 font-[inherit]", suggest.isPending && "opacity-50")} />
                <div className="pointer-events-none absolute inset-x-3 bottom-2 flex items-center justify-between font-mono text-[10px] uppercase tracking-[0.1em] text-subtle-foreground">
                  <span>{draft && body === draft.body ? "Saved draft" : generationId ? "AI draft · editable" : body ? "Manual" : "Empty"}</span>
                  <span className="tabular">{words} w · {body.length}/4000</span>
                </div>
                {suggest.isPending && (
                  <span aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-full overflow-hidden rounded-lg">
                    <span className="absolute inset-x-0 h-10 bg-[linear-gradient(180deg,transparent,color-mix(in_oklab,var(--primary)_16%,transparent),transparent)] motion-safe:animate-[scan_1.6s_linear_infinite]" />
                  </span>
                )}
              </div>
              <AnimatePresence initial={false}>
                {suggestion && (
                  <motion.div
                    initial={reduce ? false : { opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.25 }}
                    className="space-y-2.5 rounded-lg border border-border bg-background-subtle/60 p-3.5 text-[12.5px]"
                  >
                    <p className="micro-label">Generation notes</p>
                    {suggestion.explanation && <p className="text-muted-foreground"><span className="font-medium text-foreground">Why this reply: </span>{suggestion.explanation}</p>}
                    {!!suggestion.keywords.length && (
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="text-muted-foreground">Keywords</span>
                        {suggestion.keywords.map((k) => <Badge key={k} size="sm" variant="mint">{TOPIC_LABELS[k] ?? titleCase(k)}</Badge>)}
                      </div>
                    )}
                    {suggestion.follow_up && (
                      <p className="flex gap-2 text-muted-foreground"><Lightbulb className="mt-0.5 size-3.5 shrink-0 text-amber" /><span><span className="font-medium text-foreground">Recommended follow-up: </span>{suggestion.follow_up}</span></p>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
              {r.publish_mode === "demo" && (
                <p className="flex items-center gap-2 font-mono text-[10.5px] uppercase tracking-[0.08em] text-amber"><StatusDot tone="warn" /> Demo review — publishing records the reply locally only</p>
              )}
              {r.publish_mode === "unavailable" && (
                <InlineAlert variant="info" title="Google isn't connected">
                  Connect Google Business Profile to publish replies. <Link href="/app/integrations" className="font-medium text-primary underline">Go to Integrations</Link>
                </InlineAlert>
              )}
              {draft?.status === "failed" && draft.publish_error && <InlineAlert variant="danger" title="Last publish attempt failed">{draft.publish_error}</InlineAlert>}
            </div>
          </Section>
        )}

        {published && (
          <InlineAlert variant={published.status === "published" ? "success" : "info"} icon={CheckCircle2} title={published.status === "published" ? "Reply published" : "Publishing to Google…"}>
            {published.status === "published" && published.published_at ? `Approved and published ${formatDistanceToNow(new Date(published.published_at), { addSuffix: true })}.` : "The reply will appear on Google once the API confirms it."}
          </InlineAlert>
        )}

        <Section index={idx.history} label="History">
          {!r.history.length ? (
            <p className="text-[12.5px] text-muted-foreground">No activity recorded yet.</p>
          ) : (
            <ol className="relative">
              {[...r.history].reverse().map((h, i, arr) => {
                const at = new Date(h.at);
                const t = EVENT_TONE[h.event] ?? (h.error ? "error" : "signal");
                return (
                  <li key={i} className="relative grid grid-cols-[86px_14px_minmax(0,1fr)] gap-x-3 pb-4 last:pb-0">
                    <div className="pt-px text-right">
                      <MonoTime className="block text-foreground-soft">{format(at, "dd MMM yy")}</MonoTime>
                      <MonoTime className="block">{format(at, "HH:mm:ss")}</MonoTime>
                    </div>
                    <div className="relative flex justify-center">
                      {i < arr.length - 1 && <span aria-hidden className="absolute top-3 h-[calc(100%+4px)] w-px bg-border" />}
                      <StatusDot tone={t} className="mt-1" />
                    </div>
                    <div className="min-w-0 text-[12.5px]">
                      <p className="font-medium text-foreground">{titleCase(h.event)}{h.by ? <span className="font-normal text-muted-foreground"> · {h.by}</span> : null}</p>
                      {(h.note || h.error) && <p className={cn("mt-0.5", h.error ? "text-danger-foreground" : "text-muted-foreground")}>{h.note ?? h.error}</p>}
                    </div>
                  </li>
                );
              })}
            </ol>
          )}
        </Section>
      </SheetBody>

      {canReply && (
        <SheetFooter className="flex-wrap justify-between gap-y-2 bg-background-subtle/50">
          <div className="flex gap-1">
            <Button variant="ghost" size="sm" onClick={() => action.mutate("flag")} disabled={action.isPending}><Flag className={cn(r.is_flagged && "text-danger")} /> {r.is_flagged ? "Unflag" : "Flag"}</Button>
            {r.response_status === "handled" ? (
              <Button variant="ghost" size="sm" onClick={() => action.mutate("reopen")} disabled={action.isPending}><RotateCcw /> Reopen</Button>
            ) : (
              <Button variant="ghost" size="sm" onClick={() => action.mutate("handled")} disabled={action.isPending}><CheckCircle2 /> Mark handled</Button>
            )}
          </div>
          {!published && (
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => save.mutate()} disabled={!body.trim() || busy} loading={save.isPending}><Save /> Save draft</Button>
              <ConfirmDialog
                title={r.publish_mode === "google" ? "Publish this reply on Google?" : "Publish this reply?"}
                description={r.publish_mode === "google" ? "Your reply will be posted publicly on Google under your business name." : "This is a demo review, so the reply is recorded in ReviewPilot only."}
                confirmLabel="Approve & publish"
                onConfirm={async () => { await publish.mutateAsync().catch(() => undefined); }}
                trigger={<Button size="sm" disabled={!body.trim() || busy || !r.can_publish}><ShieldCheck /> Approve & publish <Send className="opacity-70" /></Button>}
              />
            </div>
          )}
        </SheetFooter>
      )}
    </>
  );
}
