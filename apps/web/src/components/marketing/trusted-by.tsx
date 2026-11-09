import { UtensilsCrossed, Stethoscope, Scissors, BedDouble, Car, GraduationCap } from "lucide-react";

const sampleBrands = [
  { name: "Saffron Table", icon: UtensilsCrossed, font: "font-semibold tracking-tight" },
  { name: "BrightSmile", icon: Stethoscope, font: "font-bold tracking-[-0.04em]" },
  { name: "LUMEN", icon: Scissors, font: "font-medium tracking-[0.25em]" },
  { name: "Konkan Bay", icon: BedDouble, font: "font-semibold italic" },
  { name: "AutoNest", icon: Car, font: "font-bold tracking-tight" },
  { name: "Vidya Academy", icon: GraduationCap, font: "font-medium" },
];

export function TrustedBy() {
  return (
    <section className="px-5 py-12 sm:px-8 lg:px-12" aria-labelledby="trusted-heading">
      <div className="mx-auto grid max-w-6xl items-center gap-8 lg:grid-cols-12">
        <div className="lg:col-span-3">
          <h2 id="trusted-heading" className="text-[14px] font-medium leading-snug text-foreground-soft">
            Built for the businesses that make up every Indian high street
          </h2>
          <p className="mt-2 font-mono text-[10px] uppercase tracking-[0.14em] text-amber/90">Sample brands shown for illustration</p>
        </div>
        <ul className="grid grid-cols-2 border-l border-t border-border sm:grid-cols-3 lg:col-span-9 lg:grid-cols-6">
          {sampleBrands.map((b) => (
            <li
              key={b.name}
              className="group flex h-16 items-center justify-center gap-2 border-b border-r border-border text-subtle-foreground transition-colors duration-300 hover:bg-surface-hover/40 hover:text-foreground-soft"
            >
              <b.icon className="size-3.5 transition-colors group-hover:text-primary" aria-hidden />
              <span className={`text-[14px] ${b.font}`}>{b.name}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
