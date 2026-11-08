"use client";
import * as React from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format, formatDistanceToNow } from "date-fns";
import { toast } from "sonner";
import {
  CheckCircle2, Flag, HeartHandshake, History, Lightbulb, MapPin, RotateCcw, Save, Send, Sparkles, Wand2,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Avatar } from "@/components/ui/controls";
import { Textarea } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetBody, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { ErrorState, InlineAlert, Skeleton } from "@/components/ui/states";
import { Stars } from "@/components/ui/stars";
import { StatusBadge } from "@/components/app/status-badge";
import { ApiError, api, errorMessage } from "@/lib/api";
import { useOrg } from "@/lib/session";
import { cn, titleCase } from "@/lib/utils";
import { SENTIMENT_STYLE, TOPIC_LABELS, type ReviewDetail, type Suggestion } from "./types";

const TONES = ["professional", "friendly", "empathetic", "appreciative", "concise", "apologetic"] as const;
const LANGS = [
  { value: "en", label: "English" },
  { value: "hi", label: "Hindi" },
  { value: "hinglish", label: "Hinglish" },
];

export function ReviewDrawer({ reviewId, onClose }: { reviewId: string | null; onClose: () => void }) {
  return (
    <Sheet open={!!reviewId} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="sm:max-w-[560px]">
        {reviewId ? <DrawerBody key={reviewId} reviewId={reviewId} /> : null}
      </SheetContent>
    </Sheet>
  );
}

function DrawerBody({ reviewId }: { reviewId: string }) {
  const { orgId, can } = useOrg();
  const qc = useQueryClient();
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

  return (
    <>
      <SheetHeader>
        <div className="flex items-start gap-3">
          <Avatar name={r.reviewer_name ?? "Anonymous"} src={r.reviewer_photo_url} size={40} />
          <div className="min-w-0 flex-1">
            <SheetTitle>{r.reviewer_name ?? "Anonymous reviewer"}</SheetTitle>
            <SheetDescription className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <Stars rating={r.rating} size={13} />
              <span>{format(new Date(r.review_created_at), "d MMM yyyy, h:mm a")}</span>
              {r.location_name && <span className="inline-flex items-center gap-1"><MapPin className="size-3" />{r.location_name}</span>}
            </SheetDescription>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap gap-1.5">
          <StatusBadge status={r.response_status} />
          <Badge size="sm" variant={r.source === "demo" ? "outline" : "info"}>{r.source === "demo" ? "Demo data" : "Google"}</Badge>
          {r.sentiment && <span className={cn("inline-flex h-5 items-center rounded-full px-2 text-[11px] font-medium capitalize", SENTIMENT_STYLE[r.sentiment])}>{r.sentiment}</span>}
          {r.is_flagged && <Badge size="sm" variant="danger"><Flag /> Flagged</Badge>}
        </div>
      </SheetHeader>

      <SheetBody className="space-y-6">
        <section>
          <blockquote className="rounded-xl border border-border bg-background-subtle p-4 text-[14px] leading-relaxed text-foreground">
            {r.comment || <span className="italic text-muted-foreground">The reviewer left a rating without text.</span>}
          </blockquote>
          {!!r.topics.length && (
            <div className="mt-2.5 flex flex-wrap gap-1.5">
              {r.topics.map((t) => <Badge key={t} size="sm" variant="neutral">{TOPIC_LABELS[t] ?? titleCase(t)}</Badge>)}
            </div>
          )}
        </section>

        {r.platform_reply && (
          <section>
            <h4 className="mb-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-subtle-foreground">Owner reply {r.source === "demo" ? "(demo)" : "on Google"}</h4>
            <div className="rounded-xl border border-primary/20 bg-primary-soft/40 p-4 text-[13.5px] leading-relaxed">
              {r.platform_reply}
              {r.platform_reply_at && <p className="mt-2 text-[11px] text-muted-foreground">Replied {formatDistanceToNow(new Date(r.platform_reply_at), { addSuffix: true })}</p>}
            </div>
          </section>
        )}

        {canReply && !published && (
          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-[13px] font-semibold">Compose reply</h4>
              {suggestion && (
                <Badge size="sm" variant={suggestion.provider === "openai" ? "primary" : "neutral"}>
                  <Sparkles /> {suggestion.provider === "openai" ? "OpenAI" : "Offline heuristic"}
                </Badge>
              )}
            </div>
            {negative && (
              <InlineAlert variant="warning" icon={HeartHandshake} title="Respond with empathy">
                Acknowledge the experience, apologise sincerely and invite them to continue privately. Never argue or share visit details publicly.
              </InlineAlert>
            )}
            <div className="grid grid-cols-2 gap-2">
              <Select value={tone} onValueChange={setTone}>
                <SelectTrigger size="sm" aria-label="Tone"><SelectValue /></SelectTrigger>
                <SelectContent>{TONES.map((t) => <SelectItem key={t} value={t}>{titleCase(t)}</SelectItem>)}</SelectContent>
              </Select>
              <Select value={lang} onValueChange={setLang}>
                <SelectTrigger size="sm" aria-label="Language"><SelectValue /></SelectTrigger>
                <SelectContent>{LANGS.map((l) => <SelectItem key={l.value} value={l.value}>{l.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="relative">
              <Textarea value={body} onChange={(e) => setBody(e.target.value)} rows={6} maxLength={4000} placeholder="Write a reply, or generate one with AI and edit it before publishing." aria-label="Reply text" className={cn(suggest.isPending && "opacity-50")} />
              <span className="pointer-events-none absolute bottom-2 right-3 text-[11px] tabular text-subtle-foreground">{body.length}/4000</span>
            </div>
            <Button variant="soft" size="sm" onClick={() => suggest.mutate()} loading={suggest.isPending} className="w-full">
              <Wand2 /> {body ? "Regenerate with AI" : "Generate with AI"}
            </Button>
            {suggestion && (
              <div className="space-y-2.5 rounded-xl border border-border p-3.5 text-[12.5px]">
                {suggestion.explanation && <p className="text-muted-foreground"><span className="font-medium text-foreground">Why this reply: </span>{suggestion.explanation}</p>}
                {!!suggestion.keywords.length && (
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-muted-foreground">Keywords:</span>
                    {suggestion.keywords.map((k) => <Badge key={k} size="sm" variant="purple">{TOPIC_LABELS[k] ?? titleCase(k)}</Badge>)}
                  </div>
                )}
                {suggestion.follow_up && (
                  <p className="flex gap-2 text-muted-foreground"><Lightbulb className="mt-0.5 size-3.5 shrink-0 text-warning" /><span><span className="font-medium text-foreground">Recommended follow-up: </span>{suggestion.follow_up}</span></p>
                )}
              </div>
            )}
            {r.publish_mode === "demo" && <p className="text-[12px] text-muted-foreground">Demo review: publishing records the reply locally — nothing is sent to Google.</p>}
            {r.publish_mode === "unavailable" && (
              <InlineAlert variant="info" title="Google isn't connected">
                Connect Google Business Profile to publish replies. <Link href="/app/integrations" className="font-medium text-primary underline">Go to Integrations</Link>
              </InlineAlert>
            )}
            {draft?.status === "failed" && draft.publish_error && <InlineAlert variant="danger" title="Last publish attempt failed">{draft.publish_error}</InlineAlert>}
          </section>
        )}

        {published && (
          <InlineAlert variant={published.status === "published" ? "success" : "info"} icon={CheckCircle2} title={published.status === "published" ? "Reply published" : "Publishing to Google…"}>
            {published.status === "published" && published.published_at ? `Approved and published ${formatDistanceToNow(new Date(published.published_at), { addSuffix: true })}.` : "The reply will appear on Google once the API confirms it."}
          </InlineAlert>
        )}

        <section>
          <h4 className="mb-3 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-subtle-foreground"><History className="size-3.5" /> History</h4>
          <ol className="relative space-y-3 border-l border-border pl-4">
            {[...r.history].reverse().map((h, i) => (
              <li key={i} className="relative text-[12.5px]">
                <span className="absolute -left-[21px] top-1 size-2.5 rounded-full border-2 border-card bg-primary" />
                <p className="font-medium text-foreground">{titleCase(h.event)}{h.by ? <span className="font-normal text-muted-foreground"> · {h.by}</span> : null}</p>
                {(h.note || h.error) && <p className="text-muted-foreground">{h.note ?? h.error}</p>}
                <p className="text-[11px] text-subtle-foreground">{format(new Date(h.at), "d MMM yyyy, h:mm a")}</p>
              </li>
            ))}
          </ol>
        </section>
      </SheetBody>

      {canReply && (
        <SheetFooter className="flex-wrap justify-between">
          <div className="flex gap-1.5">
            <Button variant="ghost" size="sm" onClick={() => action.mutate("flag")} disabled={action.isPending}><Flag /> {r.is_flagged ? "Unflag" : "Flag"}</Button>
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
                trigger={<Button size="sm" disabled={!body.trim() || busy || !r.can_publish}><Send /> Publish</Button>}
              />
            </div>
          )}
        </SheetFooter>
      )}
    </>
  );
}
