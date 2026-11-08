import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PlusMarks, ink } from "./primitives";
import { cn } from "@/lib/utils";

export function FinalCta({
  title = "Elevate your feedback management",
  body = "Start collecting genuine reviews on WhatsApp and QR today. Set up takes about ten minutes.",
}: {
  title?: string;
  body?: string;
}) {
  return (
    <section className="relative overflow-hidden px-5 pb-24 pt-24 sm:px-8 lg:px-12">
      <div className="bg-crosshair absolute inset-0" aria-hidden />
      <PlusMarks className="hidden md:block" points={[["20%", "30%"], ["80%", "30%"], ["10%", "75%"], ["90%", "75%"]]} />
      <div
        className="pointer-events-none absolute inset-x-0 bottom-0 h-56 bg-[radial-gradient(ellipse_50%_100%_at_30%_100%,rgba(214,58,240,0.32),transparent),radial-gradient(ellipse_50%_100%_at_70%_100%,rgba(124,92,255,0.32),transparent)] blur-2xl dark:opacity-60"
        aria-hidden
      />
      <div className="relative mx-auto max-w-2xl text-center">
        <h2 className={cn("text-balance text-[36px] font-semibold leading-[1.05] tracking-[-0.04em] sm:text-[52px]", ink)}>{title}</h2>
        <p className="mx-auto mt-5 max-w-lg text-[16px] leading-relaxed text-foreground-soft">{body}</p>
        <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Button asChild variant="gradient" size="xl" className="px-8">
            <Link href="/signup">
              Start Free <ArrowRight />
            </Link>
          </Button>
          <Button asChild variant="ghost" size="xl" className="rounded-full">
            <Link href="/contact">Talk to us</Link>
          </Button>
        </div>
        <p className="mt-5 text-[12.5px] text-muted-foreground">14-day free trial · Cancel anytime · Prices in INR</p>
      </div>
    </section>
  );
}
