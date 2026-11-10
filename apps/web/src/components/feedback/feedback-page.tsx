"use client";
import * as React from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { motion, useReducedMotion } from "motion/react";
import { toast } from "sonner";
import { ArrowUpRight, CircleCheck, Globe, Lock, MapPin, MessageSquareText, Phone, SearchX, Star } from "lucide-react";
import { GoogleIcon } from "@/components/brand/brand-icons";
import { LogoMark } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/controls";
import { FormField } from "@/components/ui/form-field";
import { Input, Textarea } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/states";
import { ApiError, api, errorMessage } from "@/lib/api";
import { cn } from "@/lib/utils";
import { STRINGS, type Lang } from "./strings";

export interface PublicLocation {
  business_name: string;
  location_name: string;
  slug: string;
  logo_url: string | null;
  brand_color: string;
  address: string | null;
  phone: string | null;
  website: string | null;
  industry: string;
  has_google_link: boolean;
  languages: string[];
  default_language: string;
  content: Record<string, { headline: string; subheadline: string; google_cta: string; google_note: string; private_title: string; private_note: string }>;
  is_demo: boolean;
  /** False when the business has Agency white-label with attribution hidden. */
  show_attribution?: boolean;
  footer_text?: string | null;
}

const FALLBACK_BRAND = "#0e9aa7";
const FIELD = "bg-card shadow-[inset_0_1px_2px_rgb(11_18_24/0.05)] focus-visible:bg-card";


/** Readable text colour (near-black or white) on top of a brand colour. */
function onColor(hex: string) {
  const n = parseInt(hex.slice(1), 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return lum > 0.4 ? "#0b1218" : "#ffffff";
}

/** Forces light tokens and applies the business brand colour inside the page. */
export function brandVars(color: string): React.CSSProperties {
  const c = /^#[0-9a-fA-F]{6}$/.test(color) ? color : FALLBACK_BRAND;
  return {
    ["--primary" as string]: c,
    ["--primary-hover" as string]: `color-mix(in oklab, ${c} 86%, black)`,
    ["--primary-soft" as string]: `color-mix(in oklab, ${c} 9%, white)`,
    ["--primary-soft-foreground" as string]: `color-mix(in oklab, ${c} 80%, black)`,
    ["--primary-foreground" as string]: onColor(c),
    ["--ring" as string]: c,
    ["--glow" as string]: `0 0 0 1px color-mix(in oklab, ${c} 35%, transparent), 0 6px 22px -8px color-mix(in oklab, ${c} 45%, transparent)`,
  };
}

export function FeedbackShell({ children, color = FALLBACK_BRAND }: { children: React.ReactNode; color?: string }) {
  const c = /^#[0-9a-fA-F]{6}$/.test(color) ? color : FALLBACK_BRAND;
  return (
    <div className="feedback-light relative min-h-dvh overflow-x-clip bg-background text-foreground" style={brandVars(c)}>
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-[3px] bg-[var(--primary)]" />
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-[340px] bg-tech-grid [background-size:28px_28px] [mask-image:linear-gradient(to_bottom,#000,transparent)]" />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-72"
        style={{ background: `radial-gradient(80% 100% at 50% 0%, color-mix(in oklab, ${c} 14%, transparent), transparent 70%)` }}
      />
      <div className="relative mx-auto w-full max-w-[540px] px-4 pb-10 pt-5">{children}</div>
    </div>
  );
}

function LangSwitch({ lang, onChange }: { lang: Lang; onChange: (l: Lang) => void }) {
  return (
    <div className="inline-flex h-8 items-center rounded-md border border-border-strong bg-card p-0.5 text-[12px] font-medium shadow-xs" role="group" aria-label="Language">
      {(["en", "hi"] as const).map((l) => (
        <button
          key={l}
          onClick={() => onChange(l)}
          aria-pressed={lang === l}
          lang={l}
          className={cn(
            "h-full rounded-[5px] px-3 transition focus-visible:outline-none focus-visible:ring-[1.5px] focus-visible:ring-ring",
            lang === l ? "bg-[var(--primary)] text-[var(--primary-foreground)]" : "text-muted-foreground hover:text-foreground",
          )}
        >
          {l === "en" ? "English" : "हिंदी"}
        </button>
      ))}
    </div>
  );
}

function StarInput({ value, onChange, labels }: { value: number | null; onChange: (v: number | null) => void; labels: readonly string[] }) {
  const [hover, setHover] = React.useState<number | null>(null);
  const shown = hover ?? value ?? 0;
  return (
    <div>
      <div className="flex items-center gap-1.5" role="radiogroup" onMouseLeave={() => setHover(null)}>
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={value === n}
            aria-label={`${n} — ${labels[n - 1]}`}
            onMouseEnter={() => setHover(n)}
            onClick={() => onChange(value === n ? null : n)}
            className="rounded-md p-1 transition hover:scale-110 focus-visible:outline-2 focus-visible:outline-[var(--primary)]"
          >
            <Star className={cn("size-8 transition-colors", n <= shown ? "fill-[#f5a524] text-[#f5a524]" : "fill-transparent text-border-strong")} strokeWidth={1.5} />
          </button>
        ))}
      </div>
      <p className="mt-1 h-4 font-mono text-[10.5px] uppercase tracking-[0.12em] text-muted-foreground">{shown ? labels[shown - 1] : ""}</p>
    </div>
  );
}

function GoogleOption({ slug, t, qr, content, hasLink, lang, emphasise }: { slug: string; t: string | null; qr: string | null; content: PublicLocation["content"][string]; hasLink: boolean; lang: Lang; emphasise?: boolean }) {
  const s = STRINGS[lang];
  const [busy, setBusy] = React.useState(false);
  const open = async () => {
    setBusy(true);
    // Open the tab synchronously so pop-up blockers allow it, then point it at Google.
    const win = window.open("", "_blank");
    try {
      const { url } = await api.post<{ url: string }>(`/public/locations/${encodeURIComponent(slug)}/google-click`, { t, qr }, { orgId: null });
      if (win) {
        win.opener = null;
        win.location.href = url;
      } else {
        window.location.href = url;
      }
    } catch (err) {
      win?.close();
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };
  return (
    <section
      className={cn(
        "overflow-hidden rounded-xl border bg-card shadow-sm",
        emphasise ? "border-[color-mix(in_oklab,var(--primary)_40%,var(--border))] shadow-[0_0_0_3px_color-mix(in_oklab,var(--primary)_10%,transparent)]" : "border-border-strong",
      )}
      aria-labelledby="google-title"
    >
      <div className="flex items-center justify-between border-b border-border px-5 py-2.5">
        <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-subtle-foreground">{s.optionPublic}</span>
        <GoogleIcon className="size-3.5" />
      </div>
      <div className="p-5">
        <div className="flex items-start gap-3.5">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-lg border border-border bg-card shadow-xs">
            <GoogleIcon className="size-5" />
          </span>
          <div className="min-w-0">
            <h2 id="google-title" className="text-[16px] font-semibold leading-snug tracking-[-0.01em]">{content.google_cta}</h2>
            <p className="mt-1 text-[13px] leading-relaxed text-muted-foreground">{content.google_note}</p>
          </div>
        </div>
        {hasLink ? (
          <Button size="lg" className="mt-5 w-full" loading={busy} onClick={open}>
            {busy ? s.googleOpening : content.google_cta} {!busy && <ArrowUpRight />}
          </Button>
        ) : (
          <p className="mt-5 rounded-lg border border-dashed border-border-strong bg-background px-4 py-3 text-[13px] text-muted-foreground">{s.noGoogle}</p>
        )}
      </div>
    </section>
  );
}

export function FeedbackPage({ slug }: { slug: string }) {
  const params = useSearchParams();
  const reduce = useReducedMotion();
  const t = params.get("t");
  const qr = params.get("qr");
  // Spam heuristic: time from mount to submit (set in an effect — render must stay pure).
  const loadedAt = React.useRef(0);
  React.useEffect(() => { loadedAt.current = Date.now(); }, []);
  const [lang, setLang] = React.useState<Lang>("en");
  const [langTouched, setLangTouched] = React.useState(false);

  const q = useQuery({
    queryKey: ["public-location", slug],
    queryFn: () => api.get<PublicLocation>(`/public/locations/${encodeURIComponent(slug)}`, { t }, { orgId: null }),
    retry: (n, err) => !(err instanceof ApiError && err.status < 500) && n < 2,
    staleTime: Infinity,
  });

  React.useEffect(() => {
    if (q.data && !langTouched) setLang(q.data.default_language === "hi" ? "hi" : "en");
  }, [q.data, langTouched]);
  React.useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  // Form state
  const [rating, setRating] = React.useState<number | null>(null);
  const [message, setMessage] = React.useState("");
  const [name, setName] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [phone, setPhone] = React.useState("");
  const [contact, setContact] = React.useState(false);
  const [privacy, setPrivacy] = React.useState(false);
  const [honeypot, setHoneypot] = React.useState("");
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [submitting, setSubmitting] = React.useState(false);
  const [sent, setSent] = React.useState(false);

  if (q.isLoading) {
    return (
      <FeedbackShell>
        <Skeleton className="mx-auto mt-12 size-16 rounded-xl" />
        <Skeleton className="mx-auto mt-5 h-6 w-48" />
        <Skeleton className="mt-10 h-44 rounded-xl" />
        <Skeleton className="mt-4 h-80 rounded-xl" />
      </FeedbackShell>
    );
  }
  if (q.isError || !q.data) {
    const s = STRINGS[lang];
    return (
      <FeedbackShell>
        <div className="mt-24 flex flex-col items-center text-center">
          <span className="flex size-14 items-center justify-center rounded-xl border border-border-strong bg-card shadow-sm"><SearchX className="size-6 text-muted-foreground" /></span>
          <p className="mt-6 font-mono text-[10px] uppercase tracking-[0.16em] text-subtle-foreground">Error · 404</p>
          <h1 className="mt-2 text-xl font-semibold tracking-[-0.02em]">{s.notFoundTitle}</h1>
          <p className="mt-2 max-w-xs text-sm text-muted-foreground">{s.notFoundBody}</p>
          {!(q.error instanceof ApiError && q.error.status === 404) && <Button variant="outline" className="mt-6" onClick={() => q.refetch()}>Try again</Button>}
        </div>
      </FeedbackShell>
    );
  }

  const loc = q.data;
  const s = STRINGS[lang];
  const content = loc.content[lang] ?? loc.content.en;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (message.trim().length < 3) errs.message = s.errMessage;
    if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) errs.email = s.errEmail;
    if (!privacy) errs.privacy = s.errPrivacy;
    setErrors(errs);
    if (Object.keys(errs).length) return;
    setSubmitting(true);
    try {
      await api.post(
        `/public/locations/${encodeURIComponent(slug)}/feedback`,
        {
          rating, message: message.trim(), name: name.trim() || null, email: email.trim() || null, phone: phone.trim() || null,
          consent_contact: contact, privacy_accepted: privacy, language: lang, t, qr, website: honeypot || null, elapsed_ms: Date.now() - loadedAt.current,
        },
        { orgId: null },
      );
      setSent(true);
      window.scrollTo({ top: 0, behavior: reduce ? "auto" : "smooth" });
    } catch (err) {
      if (err instanceof ApiError && err.code === "validation_error") setErrors({ form: err.message });
      else toast.error(errorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  const reset = () => {
    setSent(false);
    setRating(null);
    setMessage("");
    setPrivacy(false);
    setContact(false);
    loadedAt.current = Date.now();
  };

  const appear = reduce ? {} : { initial: { opacity: 0, y: 12 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.45, ease: [0.22, 1, 0.36, 1] as const } };

  return (
    <FeedbackShell color={loc.brand_color}>
      <div className="flex items-center justify-between gap-3">
        <span className="min-w-0 truncate font-mono text-[10px] uppercase tracking-[0.16em] text-subtle-foreground">
          {s.feedbackLabel} <span className="text-border-strong">/</span> {loc.location_name}
        </span>
        <LangSwitch lang={lang} onChange={(l) => { setLang(l); setLangTouched(true); }} />
      </div>
      {loc.is_demo && (
        <div className="mt-4 flex items-center justify-center gap-2 rounded-md border border-[color-mix(in_oklab,var(--amber)_30%,transparent)] bg-amber-soft px-3 py-1.5 font-mono text-[10.5px] uppercase tracking-[0.12em] text-amber">
          <span className="size-1.5 rounded-full bg-current" aria-hidden /> {s.demo}
        </div>
      )}

      <motion.header className="mt-8 flex flex-col items-center text-center" {...appear}>
        <span className="relative flex size-16 items-center justify-center overflow-hidden rounded-xl border border-border-strong bg-card text-2xl font-semibold text-[var(--primary)] shadow-md">
          {loc.logo_url ? <img src={loc.logo_url} alt={`${loc.business_name} logo`} className="size-full object-cover" /> : loc.business_name[0]}
        </span>
        <p className="mt-5 inline-flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.16em] text-[var(--primary)]">
          <span className="size-1.5 rounded-full bg-[var(--primary)]" aria-hidden />
          {loc.business_name}
        </p>
        <h1 className="mt-3 text-balance text-[27px] font-semibold leading-[1.12] tracking-[-0.035em]" lang={lang}>{sent ? s.thanksTitle : content.headline}</h1>
        <p className="mt-3 max-w-sm text-pretty text-[14.5px] leading-relaxed text-muted-foreground" lang={lang}>
          {sent ? s.thanksBody.replace("{business}", loc.business_name) : content.subheadline}
        </p>
        <p className="mt-4 inline-flex max-w-xs items-start gap-1.5 text-balance text-[12px] leading-relaxed text-subtle-foreground">
          <MapPin className="mt-0.5 size-3.5 shrink-0" aria-hidden />
          {loc.address ?? loc.location_name}
        </p>
      </motion.header>

      <div className="mt-8 space-y-4" lang={lang}>
        {sent ? (
          <motion.div {...appear} className="space-y-4">
            <section className="relative overflow-hidden rounded-xl border border-[color-mix(in_oklab,var(--mint)_30%,transparent)] bg-mint-soft p-5 text-center before:absolute before:inset-x-0 before:top-0 before:h-[2px] before:bg-mint">
              <CircleCheck className="mx-auto size-8 text-mint" />
              <p className="mt-3 text-[14px] leading-relaxed text-foreground-soft">{s.thanksGoogle}</p>
            </section>
            <GoogleOption slug={slug} t={t} qr={qr} content={content} hasLink={loc.has_google_link} lang={lang} emphasise />
            <button onClick={reset} className="mx-auto block font-mono text-[11px] uppercase tracking-[0.12em] text-muted-foreground underline-offset-4 hover:text-foreground hover:underline">{s.another}</button>
          </motion.div>
        ) : (
          <>
            <motion.div {...appear}>
              <GoogleOption slug={slug} t={t} qr={qr} content={content} hasLink={loc.has_google_link} lang={lang} />
            </motion.div>
            <div className="flex items-center gap-3 font-mono text-[10px] uppercase tracking-[0.18em] text-subtle-foreground" aria-hidden>
              <span className="h-px flex-1 bg-border-strong" />
              {s.or}
              <span className="h-px flex-1 bg-border-strong" />
            </div>
            <motion.section {...appear} className="overflow-hidden rounded-xl border border-border-strong bg-card shadow-sm" aria-labelledby="private-title">
              <div className="flex items-center justify-between border-b border-border px-5 py-2.5">
                <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-subtle-foreground">{s.optionPrivate}</span>
                <Lock className="size-3.5 text-subtle-foreground" />
              </div>
              <div className="p-5">
                <div className="flex items-start gap-3.5">
                  <span className="flex size-11 shrink-0 items-center justify-center rounded-lg border border-[color-mix(in_oklab,var(--primary)_25%,transparent)] bg-[var(--primary-soft)] text-[var(--primary)]"><MessageSquareText className="size-5" /></span>
                  <div>
                    <h2 id="private-title" className="text-[16px] font-semibold leading-snug tracking-[-0.01em]">{content.private_title}</h2>
                    <p className="mt-1 text-[13px] leading-relaxed text-muted-foreground">{content.private_note}</p>
                  </div>
                </div>
                <form onSubmit={submit} className="mt-6 space-y-4" noValidate>
                  {errors.form && <p className="rounded-lg border border-[color-mix(in_oklab,var(--danger)_25%,transparent)] bg-danger-soft px-3 py-2 text-[13px] text-danger-foreground" role="alert">{errors.form}</p>}
                  <div>
                    <p className="mb-1.5 text-[12.5px] font-medium text-foreground-soft">{s.rateOptional}</p>
                    <StarInput value={rating} onChange={setRating} labels={s.ratingLabels} />
                  </div>
                  <FormField label={s.message} htmlFor="fb-message" error={errors.message} required>
                    <Textarea id="fb-message" rows={4} value={message} onChange={(e) => setMessage(e.target.value)} placeholder={s.messagePlaceholder} maxLength={3000} invalid={!!errors.message} className={FIELD} />
                  </FormField>
                  <FormField label={`${s.name} (${s.optional})`} htmlFor="fb-name">
                    <Input id="fb-name" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} className={FIELD} />
                  </FormField>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <FormField label={`${s.email} (${s.optional})`} htmlFor="fb-email" error={errors.email}>
                      <Input id="fb-email" type="email" autoComplete="email" inputMode="email" value={email} onChange={(e) => setEmail(e.target.value)} invalid={!!errors.email} className={FIELD} />
                    </FormField>
                    <FormField label={`${s.phone} (${s.optional})`} htmlFor="fb-phone">
                      <Input id="fb-phone" type="tel" autoComplete="tel" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} className={FIELD} />
                    </FormField>
                  </div>
                  {/* Honeypot: hidden from people and assistive tech. */}
                  <div aria-hidden className="absolute -left-[9999px] h-px w-px overflow-hidden">
                    <label htmlFor="fb-website">Website</label>
                    <input id="fb-website" name="website" tabIndex={-1} autoComplete="off" value={honeypot} onChange={(e) => setHoneypot(e.target.value)} />
                  </div>
                  <div className="space-y-3 border-t border-border pt-4">
                    <label className="flex cursor-pointer items-start gap-2.5 text-[13px] leading-relaxed text-foreground-soft">
                      <Checkbox className="mt-0.5" checked={contact} onCheckedChange={(v) => setContact(v === true)} />
                      {s.contact}
                    </label>
                    <div>
                      <label className="flex cursor-pointer items-start gap-2.5 text-[13px] leading-relaxed text-foreground-soft">
                        <Checkbox className="mt-0.5" checked={privacy} onCheckedChange={(v) => setPrivacy(v === true)} aria-invalid={!!errors.privacy} />
                        <span>{s.privacy} <Link href="/privacy" target="_blank" className="font-medium text-[var(--primary)] underline-offset-2 hover:underline">{s.privacyLink}</Link>.</span>
                      </label>
                      {errors.privacy && <p className="mt-1.5 text-xs font-medium text-danger-foreground" role="alert">{errors.privacy}</p>}
                    </div>
                  </div>
                  <Button type="submit" size="lg" variant="secondary" className="w-full" loading={submitting}>{s.send}</Button>
                </form>
              </div>
            </motion.section>
          </>
        )}
      </div>

      {(loc.phone || loc.website) && (
        <div className="mt-6 flex justify-center gap-2">
          {loc.phone && <a href={`tel:${loc.phone}`} className="inline-flex h-8 items-center gap-1.5 rounded-md border border-border-strong bg-card px-3 text-[12px] text-foreground-soft transition-colors hover:border-[var(--primary)]"><Phone className="size-3.5" />{s.callUs}</a>}
          {loc.website && <a href={loc.website} target="_blank" rel="noreferrer" className="inline-flex h-8 items-center gap-1.5 rounded-md border border-border-strong bg-card px-3 text-[12px] text-foreground-soft transition-colors hover:border-[var(--primary)]"><Globe className="size-3.5" />{s.website}</a>}
        </div>
      )}
      <footer className="mt-10 flex flex-wrap items-center justify-center gap-x-2 gap-y-1 border-t border-border pt-5 text-center font-mono text-[10px] uppercase tracking-[0.12em] text-subtle-foreground">
        {loc.footer_text && <span className="w-full normal-case tracking-normal text-[11px] text-muted-foreground">{loc.footer_text}</span>}
        {loc.show_attribution !== false && <><LogoMark size={14} /> {s.poweredBy} <span className="text-border-strong">·</span></>}
        <Link href="/privacy" className="hover:text-foreground">{s.privacyLink}</Link>
      </footer>
    </FeedbackShell>
  );
}
