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
    <section className="border-y border-border bg-background-subtle/50 px-5 py-10 sm:px-8 lg:px-12" aria-labelledby="trusted-heading">
      <div className="mx-auto max-w-6xl">
        <div className="flex flex-col items-center justify-between gap-2 text-center sm:flex-row sm:text-left">
          <h2 id="trusted-heading" className="text-[13px] font-medium text-foreground-soft">
            Built for the businesses that make up every Indian high street
          </h2>
          <p className="text-[11.5px] text-subtle-foreground">Sample brands shown for illustration</p>
        </div>
        <ul className="mt-7 grid grid-cols-2 items-center gap-x-6 gap-y-6 sm:grid-cols-3 lg:grid-cols-6">
          {sampleBrands.map((b) => (
            <li key={b.name} className="flex items-center justify-center gap-2 text-muted-foreground/80 grayscale transition hover:text-foreground">
              <b.icon className="size-4" aria-hidden />
              <span className={`text-[15px] ${b.font}`}>{b.name}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
