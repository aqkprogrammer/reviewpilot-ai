"use client";
import * as React from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Sparkles, Tag, ListChecks, Gauge, Languages, Check } from "lucide-react";
import { Stars } from "@/components/ui/stars";
import { GoogleIcon } from "@/components/brand/brand-icons";
import { Eyebrow, Section, SectionIndex, SampleTag } from "./primitives";
import { cn } from "@/lib/utils";

const TONES = ["Professional", "Friendly", "Empathetic", "Appreciative", "Concise", "Apologetic"] as const;
const LANGS = [
  { id: "en", label: "English" },
  { id: "hi", label: "हिन्दी" },
  { id: "hinglish", label: "Hinglish" },
] as const;
type Tone = (typeof TONES)[number];
type Lang = (typeof LANGS)[number]["id"];

const REPLIES: Record<Lang, Record<Tone, string>> = {
  en: {
    Professional:
      "Thank you for your feedback. We're sorry for the 40-minute wait and the lack of updates during your Saturday dinner. We are reviewing our weekend kitchen staffing so this doesn't happen again, and we'd welcome the chance to serve you better.",
    Friendly:
      "Thanks for coming in and for being honest with us! We're glad you enjoyed the food, and really sorry about the long wait — that's not the Saturday night we want for you. We're adding hands in the kitchen on weekends. Hope to see you again soon!",
    Empathetic:
      "We're truly sorry. Waiting 40 minutes without an update is frustrating, especially on a night out. Thank you for telling us — we've shared this with our team and are changing how we keep guests informed during busy hours.",
    Appreciative:
      "Thank you for taking the time to share this — feedback like yours helps us improve. We're happy the food hit the mark, and we're working on faster service for weekend evenings.",
    Concise: "Thanks for the feedback. Sorry about the wait — we're adding weekend kitchen staff to fix it.",
    Apologetic:
      "Please accept our sincere apologies for the long wait and for not keeping you updated. You deserved better. We'd welcome the chance to make it right — please ask for our manager on your next visit.",
  },
  hi: {
    Professional:
      "आपकी प्रतिक्रिया के लिए धन्यवाद। शनिवार को 40 मिनट की प्रतीक्षा और कोई जानकारी न मिलने के लिए हमें खेद है। हम सप्ताहांत पर किचन स्टाफ़ की समीक्षा कर रहे हैं ताकि ऐसा दोबारा न हो।",
    Friendly:
      "आने और सच बताने के लिए शुक्रिया! खुशी है कि खाना पसंद आया, पर लंबे इंतज़ार के लिए माफ़ी चाहते हैं। वीकेंड पर हम किचन में और लोग जोड़ रहे हैं — फिर ज़रूर आइए!",
    Empathetic:
      "हमें सच में खेद है। बिना किसी अपडेट के 40 मिनट इंतज़ार करना निराशाजनक होता है। आपकी बात हमने टीम तक पहुँचा दी है और व्यस्त समय में मेहमानों को जानकारी देने का तरीका बदल रहे हैं।",
    Appreciative:
      "अपना अनुभव साझा करने के लिए धन्यवाद — आपकी प्रतिक्रिया से हमें बेहतर बनने में मदद मिलती है। खुशी है कि खाना अच्छा लगा; वीकेंड पर सर्विस तेज़ करने पर काम कर रहे हैं।",
    Concise: "प्रतिक्रिया के लिए धन्यवाद। इंतज़ार के लिए खेद है — वीकेंड पर किचन स्टाफ़ बढ़ा रहे हैं।",
    Apologetic:
      "लंबे इंतज़ार और अपडेट न देने के लिए हम दिल से क्षमा चाहते हैं। आप बेहतर अनुभव के हक़दार थे। अगली बार आएँ तो मैनेजर से ज़रूर मिलें — हम इसकी भरपाई करना चाहेंगे।",
  },
  hinglish: {
    Professional:
      "Feedback ke liye thank you. Saturday ko 40 minute wait aur koi update na milne ke liye hum maafi chahte hain. Weekend ke liye kitchen staffing review kar rahe hain taaki aisa dobara na ho.",
    Friendly:
      "Aane aur honestly batane ke liye thanks! Khushi hai ki khana pasand aaya, par itne lambe wait ke liye sorry. Weekends pe kitchen mein extra log add kar rahe hain — phir zaroor aaiye!",
    Empathetic:
      "Humein sach mein afsos hai. Bina update ke 40 minute wait karna frustrating hota hai. Aapki baat team tak pahuncha di hai, aur busy time mein guests ko update dene ka tareeka badal rahe hain.",
    Appreciative:
      "Apna experience share karne ke liye shukriya — aise feedback se hum better bante hain. Khana accha laga, yeh sunke khushi hui; weekend service fast karne pe kaam chal raha hai.",
    Concise: "Feedback ke liye thanks. Wait ke liye sorry — weekend pe kitchen staff badha rahe hain.",
    Apologetic:
      "Lambe wait aur update na dene ke liye dil se sorry. Aap behtar experience deserve karte the. Next visit pe manager se zaroor miliye — hum ise theek karna chahenge.",
  },
};

export function AiShowcase() {
  const [tone, setTone] = React.useState<Tone>("Empathetic");
  const [lang, setLang] = React.useState<Lang>("en");
  const reduce = useReducedMotion();

  return (
    <Section id="ai-assistant" className="overflow-hidden">
      <div className="grid items-center gap-12 lg:grid-cols-12 lg:gap-14">
        <div className="lg:order-2 lg:col-span-5">
          <div className="flex items-center gap-4">
            <SectionIndex n={5} total={9} />
            <Eyebrow>AI review assistant</Eyebrow>
          </div>
          <h2 className="mt-5 text-balance text-[32px] font-semibold leading-[1.04] tracking-[-0.038em] text-foreground sm:text-[42px]">
            Replies that sound like you, in the language your customers speak
          </h2>
          <p className="mt-5 text-pretty text-[15px] leading-relaxed text-muted-foreground">
            Pick a tone, pick a language, and ReviewPilot drafts a thoughtful reply from the review itself — with sentiment, key themes and a suggested follow-up for your team. You approve every word before it goes live.
          </p>
          <ul className="mt-8 divide-y divide-border border-y border-border">
            {[
              "Negative reviews get calm, empathetic drafts that never argue or reveal private details",
              "English, Hindi and Hinglish, matched to how the customer wrote",
              "Auto-publish stays off unless an owner explicitly enables it",
            ].map((t, i) => (
              <li key={t} className="flex gap-4 py-3.5 text-[14px] leading-relaxed text-foreground-soft">
                <span className="mt-0.5 font-mono text-[10.5px] text-primary">{String(i + 1).padStart(2, "0")}</span>
                {t}
              </li>
            ))}
          </ul>
        </div>

        <div className="relative lg:order-1 lg:col-span-7">
          <div className="pointer-events-none absolute -inset-10 bg-[radial-gradient(closest-side,color-mix(in_oklab,var(--cyan)_12%,transparent),transparent)]" aria-hidden />
          <div className="tech-corners relative rounded-xl border border-border-strong bg-card/85 shadow-lg hairline-top">
            <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-2.5 sm:px-5">
              <span className="micro-label">Reply studio · try it</span>
              <SampleTag>Sample review</SampleTag>
            </div>
            <div className="p-4 sm:p-5">
              <div className="flex items-start gap-3 rounded-lg border border-border bg-background-subtle p-4">
                <div className="flex size-9 shrink-0 items-center justify-center rounded-md border border-border-strong bg-card font-mono text-[11px] text-foreground-soft">VA</div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-[13.5px] font-semibold text-foreground">Vikram A.</p>
                    <GoogleIcon className="size-4" />
                  </div>
                  <Stars rating={3} size={12} className="mt-1" />
                  <p className="mt-2 text-[13.5px] leading-relaxed text-foreground-soft">
                    Food was good but we waited 40 minutes for our order and nobody updated us. Not what I expected for a Saturday dinner.
                  </p>
                </div>
              </div>

              <div className="mt-5 grid gap-4 sm:grid-cols-[1fr_auto] sm:items-end">
                <div>
                  <p className="micro-label mb-2" id="ai-tone-label">Tone</p>
                  <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-labelledby="ai-tone-label">
                    {TONES.map((t) => (
                      <button
                        key={t}
                        role="radio"
                        aria-checked={tone === t}
                        onClick={() => setTone(t)}
                        className={cn(
                          "inline-flex h-7 items-center gap-1 rounded-md border px-2.5 text-[12px] font-medium transition focus-visible:outline-none focus-visible:ring-[1.5px] focus-visible:ring-ring",
                          tone === t
                            ? "border-[color-mix(in_oklab,var(--primary)_55%,transparent)] bg-primary-soft text-primary shadow-[0_0_14px_-4px_var(--primary)]"
                            : "border-border text-foreground-soft hover:border-border-strong hover:text-foreground",
                        )}
                      >
                        {tone === t && <Check className="size-3" />}
                        {t}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="micro-label mb-2" id="ai-lang-label">
                    <Languages className="mr-1 inline size-3 -translate-y-px" aria-hidden /> Language
                  </p>
                  <div className="inline-flex items-center gap-0.5 rounded-md border border-border bg-background-subtle p-0.5" role="radiogroup" aria-labelledby="ai-lang-label">
                    {LANGS.map((l) => (
                      <button
                        key={l.id}
                        role="radio"
                        aria-checked={lang === l.id}
                        onClick={() => setLang(l.id)}
                        className={cn(
                          "relative h-6 rounded-[5px] px-2.5 text-[12px] font-medium transition focus-visible:outline-none focus-visible:ring-[1.5px] focus-visible:ring-ring",
                          lang === l.id ? "text-foreground" : "text-muted-foreground hover:text-foreground",
                        )}
                      >
                        {lang === l.id && <motion.span layoutId="ai-lang" className="absolute inset-0 rounded-[5px] border border-border-strong bg-card" transition={{ type: "spring", stiffness: 420, damping: 36 }} />}
                        <span className="relative">{l.label}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="relative mt-5 overflow-hidden rounded-lg border border-[color-mix(in_oklab,var(--primary)_26%,transparent)] bg-primary-soft p-4 before:absolute before:inset-y-0 before:left-0 before:w-[2px] before:bg-primary">
                <div className="flex items-center justify-between gap-2">
                  <p className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.12em] text-primary">
                    <Sparkles className="size-3.5" /> Suggested reply · {tone}
                  </p>
                  <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-subtle-foreground">{lang === "hinglish" ? "HI-LATN" : lang.toUpperCase()}</span>
                </div>
                <AnimatePresence mode="wait">
                  <motion.p
                    key={`${tone}-${lang}`}
                    lang={lang === "hi" ? "hi" : "en"}
                    initial={reduce ? false : { opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={reduce ? undefined : { opacity: 0 }}
                    transition={{ duration: 0.25 }}
                    className="mt-2.5 min-h-[96px] text-[14px] leading-relaxed text-foreground"
                    aria-live="polite"
                  >
                    {REPLIES[lang][tone]}
                  </motion.p>
                </AnimatePresence>
              </div>

              <dl className="mt-4 grid divide-y divide-border rounded-lg border border-border sm:grid-cols-3 sm:divide-x sm:divide-y-0">
                <div className="p-3">
                  <dt className="micro-label flex items-center gap-1.5"><Gauge className="size-3" /> Sentiment</dt>
                  <dd className="mt-1.5 font-mono text-[13px] text-amber">Mixed · 0.42</dd>
                </div>
                <div className="p-3">
                  <dt className="micro-label flex items-center gap-1.5"><Tag className="size-3" /> Keywords</dt>
                  <dd className="mt-1.5 flex flex-wrap gap-1">
                    {["wait time", "food", "updates"].map((k) => (
                      <span key={k} className="rounded-[4px] border border-border bg-background-subtle px-1.5 py-0.5 font-mono text-[10.5px] text-foreground-soft">{k}</span>
                    ))}
                  </dd>
                </div>
                <div className="p-3">
                  <dt className="micro-label flex items-center gap-1.5"><ListChecks className="size-3" /> Follow-up</dt>
                  <dd className="mt-1.5 text-[12.5px] leading-snug text-foreground-soft">Review Saturday kitchen staffing</dd>
                </div>
              </dl>
            </div>
          </div>
        </div>
      </div>
    </Section>
  );
}
