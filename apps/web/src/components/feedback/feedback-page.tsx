"use client";
import * as React from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { motion, useReducedMotion } from "framer-motion";
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
}

/** Forces light tokens and applies the business brand colour inside the page. */
export function brandVars(color: string): React.CSSProperties {
  const c = /^#[0-9a-fA-F]{6}$/.test(color) ? color : "#6a4cff";
  return {
    ["--primary" as string]: c,
    ["--primary-hover" as string]: `color-mix(in oklab, ${c} 86%, black)`,
    ["--primary-soft" as string]: `color-mix(in oklab, ${c} 10%, white)`,
    ["--primary-soft-foreground" as string]: `color-mix(in oklab, ${c} 80%, black)`,
    ["--ring" as string]: c,
  };
}

export function FeedbackShell({ children, color = "#6a4cff" }: { children: React.ReactNode; color?: string }) {
  return (
    <div className="feedback-light min-h-dvh bg-[#f6f5fb] text-[#16112b]" style={brandVars(color)}>
      <div
        className="pointer-events-none fixed inset-x-0 top-0 h-64"
        style={{ background: `radial-gradient(120% 100% at 50% 0%, color-mix(in oklab, ${color} 22%, transparent), transparent 70%)` }}
        aria-hidden
      />
      <div className="relative mx-auto w-full max-w-[480px] px-4 pb-10 pt-5">{children}</div>
    </div>
  );
}

function LangSwitch({ lang, onChange }: { lang: Lang; onChange: (l: Lang) => void }) {
  return (
    <div className="inline-flex h-8 items-center rounded-full border border-[#e4e1ef] bg-white/90 p-0.5 text-[12px] font-medium shadow-xs backdrop-blur" role="group" aria-label="Language">
      {(["en", "hi"] as const).map((l) => (
        <button key={l} onClick={() => onChange(l)} aria-pressed={lang === l} lang={l} className={cn("h-full rounded-full px-3 transition", lang === l ? "bg-[var(--primary)] text-white" : "text-[#6e6a86] hover:text-[#16112b]")}>
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
            className="rounded-lg p-1 transition hover:scale-110 focus-visible:outline-2 focus-visible:outline-[var(--primary)]"
          >
            <Star className={cn("size-8 transition-colors", n <= shown ? "fill-[#f5a524] text-[#f5a524]" : "fill-transparent text-[#d4d1e3]")} strokeWidth={1.6} />
          </button>
        ))}
      </div>
      <p className="mt-1 h-4 text-[12px] text-[#6e6a86]">{shown ? labels[shown - 1] : ""}</p>
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
    <section className={cn("rounded-3xl border bg-white p-5 shadow-[0_1px_2px_rgb(22_17_43/0.04),0_12px_32px_-16px_rgb(22_17_43/0.18)]", emphasise ? "border-[color-mix(in_oklab,var(--primary)_35%,white)]" : "border-[#ebe8f4]")} aria-labelledby="google-title">
      <div className="flex items-start gap-3.5">
        <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl border border-[#ebe8f4] bg-white shadow-xs"><GoogleIcon className="size-5" /></span>
        <div className="min-w-0">
          <h2 id="google-title" className="text-[15.5px] font-semibold leading-snug">{content.google_cta}</h2>
          <p className="mt-1 text-[13px] leading-relaxed text-[#6e6a86]">{content.google_note}</p>
        </div>
      </div>
      {hasLink ? (
        <Button size="lg" className="mt-4 w-full rounded-2xl" loading={busy} onClick={open}>
          {busy ? s.googleOpening : content.google_cta} {!busy && <ArrowUpRight />}
        </Button>
      ) : (
        <p className="mt-4 rounded-2xl bg-[#f6f5fb] px-4 py-3 text-[13px] text-[#6e6a86]">{s.noGoogle}</p>
      )}
    </section>
  );
}

export function FeedbackPage({ slug }: { slug: string }) {
  const params = useSearchParams();
  const reduce = useReducedMotion();
  const t = params.get("t");
  const qr = params.get("qr");
  const loadedAt = React.useRef(Date.now());
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
        <Skeleton className="mx-auto mt-8 size-16 rounded-2xl" />
        <Skeleton className="mx-auto mt-4 h-6 w-48" />
        <Skeleton className="mt-8 h-40 rounded-3xl" />
        <Skeleton className="mt-4 h-72 rounded-3xl" />
      </FeedbackShell>
    );
  }
  if (q.isError || !q.data) {
    const s = STRINGS[lang];
    return (
      <FeedbackShell>
        <div className="mt-24 flex flex-col items-center text-center">
          <span className="flex size-14 items-center justify-center rounded-2xl border border-[#ebe8f4] bg-white shadow-sm"><SearchX className="size-6 text-[#6e6a86]" /></span>
          <h1 className="mt-5 text-xl font-semibold">{s.notFoundTitle}</h1>
          <p className="mt-2 max-w-xs text-sm text-[#6e6a86]">{s.notFoundBody}</p>
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
      {loc.is_demo && (
        <div className="mb-4 rounded-full border border-[#e9dcff] bg-[#f5efff] px-3 py-1 text-center text-[11.5px] font-medium text-[#6b3fd6]">{s.demo}</div>
      )}
      <div className="flex justify-end"><LangSwitch lang={lang} onChange={(l) => { setLang(l); setLangTouched(true); }} /></div>

      <motion.header className="mt-4 flex flex-col items-center text-center" {...appear}>
        <span className="flex size-16 items-center justify-center overflow-hidden rounded-2xl border border-white bg-white text-2xl font-semibold text-[var(--primary)] shadow-[0_10px_30px_-12px_rgb(22_17_43/0.35)]">
          {loc.logo_url ? <img src={loc.logo_url} alt={`${loc.business_name} logo`} className="size-full object-cover" /> : loc.business_name[0]}
        </span>
        <p className="mt-4 text-[13px] font-semibold uppercase tracking-[0.12em] text-[var(--primary)]">{loc.business_name}</p>
        <h1 className="mt-2 text-balance text-[26px] font-semibold leading-tight tracking-[-0.03em]" lang={lang}>{sent ? s.thanksTitle : content.headline}</h1>
        <p className="mt-2 max-w-sm text-pretty text-[14px] leading-relaxed text-[#6e6a86]" lang={lang}>
          {sent ? s.thanksBody.replace("{business}", loc.business_name) : content.subheadline}
        </p>
        <p className="mt-3 max-w-xs text-balance text-[12px] leading-relaxed text-[#8a86a3]">
          <MapPin className="mr-1 inline size-3.5 -translate-y-px" aria-hidden />
          {loc.address ?? loc.location_name}
        </p>
      </motion.header>

      <div className="mt-7 space-y-4" lang={lang}>
        {sent ? (
          <motion.div {...appear} className="space-y-4">
            <section className="rounded-3xl border border-[#d6f2e6] bg-[#effbf5] p-5 text-center">
              <CircleCheck className="mx-auto size-8 text-[#059669]" />
              <p className="mt-3 text-[14px] leading-relaxed text-[#1f4d3b]">{s.thanksGoogle}</p>
            </section>
            <GoogleOption slug={slug} t={t} qr={qr} content={content} hasLink={loc.has_google_link} lang={lang} emphasise />
            <button onClick={reset} className="mx-auto block text-[13px] font-medium text-[#6e6a86] underline-offset-4 hover:text-[#16112b] hover:underline">{s.another}</button>
          </motion.div>
        ) : (
          <>
            <motion.div {...appear}>
              <GoogleOption slug={slug} t={t} qr={qr} content={content} hasLink={loc.has_google_link} lang={lang} />
            </motion.div>
            <motion.section {...appear} className="rounded-3xl border border-[#ebe8f4] bg-white p-5 shadow-[0_1px_2px_rgb(22_17_43/0.04),0_12px_32px_-16px_rgb(22_17_43/0.18)]" aria-labelledby="private-title">
              <div className="flex items-start gap-3.5">
                <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-[var(--primary-soft)] text-[var(--primary)]"><MessageSquareText className="size-5" /></span>
                <div>
                  <h2 id="private-title" className="text-[15.5px] font-semibold leading-snug">{content.private_title}</h2>
                  <p className="mt-1 flex items-start gap-1.5 text-[13px] leading-relaxed text-[#6e6a86]"><Lock className="mt-0.5 size-3.5 shrink-0" />{content.private_note}</p>
                </div>
              </div>
              <form onSubmit={submit} className="mt-5 space-y-4" noValidate>
                {errors.form && <p className="rounded-xl bg-danger-soft px-3 py-2 text-[13px] text-danger-foreground" role="alert">{errors.form}</p>}
                <div>
                  <p className="mb-1.5 text-[13px] font-medium text-[#3a3555]">{s.rateOptional}</p>
                  <StarInput value={rating} onChange={setRating} labels={s.ratingLabels} />
                </div>
                <FormField label={s.message} htmlFor="fb-message" error={errors.message} required>
                  <Textarea id="fb-message" rows={4} value={message} onChange={(e) => setMessage(e.target.value)} placeholder={s.messagePlaceholder} maxLength={3000} invalid={!!errors.message} />
                </FormField>
                <FormField label={`${s.name} (${s.optional})`} htmlFor="fb-name">
                  <Input id="fb-name" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} />
                </FormField>
                <div className="grid gap-4 sm:grid-cols-2">
                  <FormField label={`${s.email} (${s.optional})`} htmlFor="fb-email" error={errors.email}>
                    <Input id="fb-email" type="email" autoComplete="email" inputMode="email" value={email} onChange={(e) => setEmail(e.target.value)} invalid={!!errors.email} />
                  </FormField>
                  <FormField label={`${s.phone} (${s.optional})`} htmlFor="fb-phone">
                    <Input id="fb-phone" type="tel" autoComplete="tel" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
                  </FormField>
                </div>
                {/* Honeypot: hidden from people and assistive tech. */}
                <div aria-hidden className="absolute -left-[9999px] h-px w-px overflow-hidden">
                  <label htmlFor="fb-website">Website</label>
                  <input id="fb-website" name="website" tabIndex={-1} autoComplete="off" value={honeypot} onChange={(e) => setHoneypot(e.target.value)} />
                </div>
                <label className="flex cursor-pointer items-start gap-2.5 text-[13px] leading-relaxed text-[#3a3555]">
                  <Checkbox className="mt-0.5" checked={contact} onCheckedChange={(v) => setContact(v === true)} />
                  {s.contact}
                </label>
                <div>
                  <label className="flex cursor-pointer items-start gap-2.5 text-[13px] leading-relaxed text-[#3a3555]">
                    <Checkbox className="mt-0.5" checked={privacy} onCheckedChange={(v) => setPrivacy(v === true)} aria-invalid={!!errors.privacy} />
                    <span>{s.privacy} <Link href="/privacy" target="_blank" className="font-medium text-[var(--primary)] underline-offset-2 hover:underline">{s.privacyLink}</Link>.</span>
                  </label>
                  {errors.privacy && <p className="mt-1.5 text-xs font-medium text-danger-foreground" role="alert">{errors.privacy}</p>}
                </div>
                <Button type="submit" size="lg" variant="secondary" className="w-full rounded-2xl" loading={submitting}>{s.send}</Button>
              </form>
            </motion.section>
          </>
        )}
      </div>

      {(loc.phone || loc.website) && (
        <div className="mt-6 flex justify-center gap-2">
          {loc.phone && <a href={`tel:${loc.phone}`} className="inline-flex h-8 items-center gap-1.5 rounded-full border border-[#ebe8f4] bg-white px-3 text-[12px] text-[#3a3555] hover:border-[#d8d5e8]"><Phone className="size-3.5" />{s.callUs}</a>}
          {loc.website && <a href={loc.website} target="_blank" rel="noreferrer" className="inline-flex h-8 items-center gap-1.5 rounded-full border border-[#ebe8f4] bg-white px-3 text-[12px] text-[#3a3555] hover:border-[#d8d5e8]"><Globe className="size-3.5" />{s.website}</a>}
        </div>
      )}
      <footer className="mt-8 flex items-center justify-center gap-1.5 text-[11.5px] text-[#9a97b0]">
        <LogoMark size={14} /> {s.poweredBy} · <Link href="/privacy" className="hover:text-[#16112b]">{s.privacyLink}</Link>
      </footer>
    </FeedbackShell>
  );
}
