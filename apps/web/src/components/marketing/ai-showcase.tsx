"use client";
import * as React from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Sparkles, Tag, ListChecks, Gauge, Languages } from "lucide-react";
import { Stars } from "@/components/ui/stars";
import { GoogleIcon } from "@/components/brand/brand-icons";
import { Section, SectionHeading } from "./primitives";
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

  return (
    <Section id="ai-assistant" className="overflow-hidden">
      <div className="grid items-center gap-12 lg:grid-cols-[0.9fr_1.1fr]">
        <div>
          <SectionHeading
            align="left"
            eyebrow="AI Review Assistant"
            title="Replies that sound like you, in the language your customers speak"
            description="Pick a tone, pick a language, and ReviewPilot drafts a thoughtful reply from the review itself — with sentiment, key themes and a suggested follow-up for your team. You approve every word before it goes live."
          />
          <ul className="mt-8 space-y-3 text-[14px] text-foreground-soft">
            {[
              "Negative reviews get calm, empathetic drafts that never argue or reveal private details",
              "English, Hindi and Hinglish, matched to how the customer wrote",
              "Auto-publish stays off unless an owner explicitly enables it",
            ].map((t) => (
              <li key={t} className="flex gap-3">
                <span className="mt-2 size-1.5 shrink-0 rounded-full bg-primary" aria-hidden />
                {t}
              </li>
            ))}
          </ul>
        </div>

        <div className="relative">
          <div className="absolute -inset-6 -z-10 rounded-[32px] bg-[radial-gradient(ellipse_at_top_right,rgba(214,58,240,0.14),transparent_60%),radial-gradient(ellipse_at_bottom_left,rgba(106,76,255,0.14),transparent_60%)]" aria-hidden />
          <div className="rounded-[24px] border border-border bg-card p-5 shadow-lg sm:p-6">
            <div className="flex items-start gap-3 rounded-2xl bg-background-subtle p-4">
              <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-[#fff1e0] text-[12px] font-semibold text-[#b45309]">VA</div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-[13.5px] font-semibold text-foreground">Vikram A.</p>
                  <GoogleIcon className="size-4" />
                </div>
                <Stars rating={3} size={12} className="mt-0.5" />
                <p className="mt-2 text-[13.5px] leading-relaxed text-foreground-soft">
                  Food was good but we waited 40 minutes for our order and nobody updated us. Not what I expected for a Saturday dinner.
                </p>
              </div>
            </div>

            <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Reply tone">
                {TONES.map((t) => (
                  <button
                    key={t}
                    role="radio"
                    aria-checked={tone === t}
                    onClick={() => setTone(t)}
                    className={cn(
                      "rounded-full border px-3 py-1 text-[12.5px] font-medium transition",
                      tone === t ? "border-primary bg-primary text-white shadow-glow" : "border-border text-foreground-soft hover:border-border-strong",
                    )}
                  >
                    {t}
                  </button>
                ))}
              </div>
              <div className="inline-flex items-center gap-0.5 rounded-lg border border-border bg-muted/70 p-0.5" role="radiogroup" aria-label="Reply language">
                <Languages className="mx-1.5 size-3.5 text-muted-foreground" aria-hidden />
                {LANGS.map((l) => (
                  <button
                    key={l.id}
                    role="radio"
                    aria-checked={lang === l.id}
                    onClick={() => setLang(l.id)}
                    className={cn("rounded-md px-2.5 py-1 text-[12px] font-medium transition", lang === l.id ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}
                  >
                    {l.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-4 rounded-2xl border border-primary/20 bg-primary-soft/40 p-4">
              <p className="flex items-center gap-1.5 text-[12px] font-semibold text-primary-soft-foreground">
                <Sparkles className="size-3.5" /> Suggested reply · {tone}
              </p>
              <AnimatePresence mode="wait">
                <motion.p
                  key={`${tone}-${lang}`}
                  lang={lang === "hi" ? "hi" : "en"}
                  initial={{ opacity: 0, filter: "blur(4px)" }}
                  animate={{ opacity: 1, filter: "blur(0px)" }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.3 }}
                  className="mt-2 min-h-[96px] text-[14px] leading-relaxed text-foreground"
                >
                  {REPLIES[lang][tone]}
                </motion.p>
              </AnimatePresence>
            </div>

            <dl className="mt-4 grid gap-3 sm:grid-cols-3">
              <div className="rounded-xl border border-border p-3">
                <dt className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wider text-subtle-foreground"><Gauge className="size-3" /> Sentiment</dt>
                <dd className="mt-1.5 text-[13px] font-semibold text-warning-foreground">Mixed · 0.42</dd>
              </div>
              <div className="rounded-xl border border-border p-3">
                <dt className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wider text-subtle-foreground"><Tag className="size-3" /> Keywords</dt>
                <dd className="mt-1.5 flex flex-wrap gap-1">
                  {["wait time", "food", "updates"].map((k) => (
                    <span key={k} className="rounded-md bg-muted px-1.5 py-0.5 text-[11px] text-foreground-soft">{k}</span>
                  ))}
                </dd>
              </div>
              <div className="rounded-xl border border-border p-3">
                <dt className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wider text-subtle-foreground"><ListChecks className="size-3" /> Follow-up</dt>
                <dd className="mt-1.5 text-[12px] leading-snug text-foreground-soft">Review Saturday kitchen staffing</dd>
              </div>
            </dl>
          </div>
        </div>
      </div>
    </Section>
  );
}
