import Link from "next/link";
import { ArrowRight, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { WhatsAppIcon, GoogleIcon } from "@/components/brand/brand-icons";
import { ProductPreview } from "./product-preview";
import { Glow, PlusMarks, ink } from "./primitives";
import { cn } from "@/lib/utils";

export function Hero() {
  return (
    <section className="relative overflow-hidden px-5 pb-16 pt-14 sm:px-8 sm:pt-20 lg:px-12">
      <div className="bg-crosshair absolute inset-0" aria-hidden />
      <PlusMarks
        className="hidden md:block"
        points={[["14%", "88px"], ["86%", "88px"], ["22%", "352px"], ["78%", "352px"], ["8%", "528px"], ["92%", "528px"]]}
      />
      <div className="relative mx-auto max-w-6xl">
        <div className="mx-auto max-w-3xl text-center">
          <Link
            href="/features#whatsapp"
            className="group inline-flex items-center gap-2 rounded-full border border-[#e3d6fb] bg-card/80 py-1 pl-1 pr-3 text-[12.5px] font-medium text-foreground-soft shadow-xs backdrop-blur transition hover:border-[#cdb8f7] dark:border-border"
          >
            <span className="inline-flex items-center gap-1 rounded-full bg-[#e9fbe9] px-2 py-0.5 text-[11px] font-semibold text-[#128c4a] dark:bg-success-soft dark:text-success-foreground">
              <WhatsAppIcon className="size-3" /> New
            </span>
            WhatsApp-first review collection is here
            <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" />
          </Link>

          <h1 className={cn("mt-7 text-balance text-[44px] font-bold leading-[0.98] tracking-[-0.045em] sm:text-[64px] lg:text-[80px]", ink)}>
            Your Reputation Is Your Next <span className="text-gradient">Growth Engine.</span>
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-pretty text-[16px] leading-relaxed text-foreground-soft sm:text-[18px]">
            Collect authentic customer reviews, manage your online reputation, and turn customer feedback into business growth with AI.
          </p>
          <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Button asChild variant="gradient" size="xl" className="w-full px-8 sm:w-auto">
              <Link href="/signup">
                Start Free <ArrowRight />
              </Link>
            </Button>
            <Button asChild variant="outline" size="xl" className="w-full rounded-full bg-card/70 backdrop-blur sm:w-auto">
              <Link href="/features">Explore Features</Link>
            </Button>
          </div>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-[12.5px] text-muted-foreground">
            <span>14-day free trial</span>
            <span className="hidden size-1 rounded-full bg-border-strong sm:block" aria-hidden />
            <span className="inline-flex items-center gap-1.5"><GoogleIcon className="size-3.5" /> Works with Google Business Profile</span>
            <span className="hidden size-1 rounded-full bg-border-strong sm:block" aria-hidden />
            <span className="inline-flex items-center gap-1.5"><ShieldCheck className="size-3.5 text-success" /> No review gating, ever</span>
          </div>
        </div>

        <div className="relative mx-auto mt-16 max-w-5xl">
          <Glow className="-left-10 top-10 h-[420px] w-[520px]" />
          <Glow className="-right-10 top-24 h-[380px] w-[480px]" />
          <div className="relative">
            <ProductPreview />
          </div>
        </div>
      </div>
    </section>
  );
}
