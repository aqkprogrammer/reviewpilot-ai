"use client";
import * as React from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ImagePlus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { InlineAlert } from "@/components/ui/states";
import { ApiError, api, errorMessage } from "@/lib/api";
import { useOrg } from "@/lib/session";
import { cn } from "@/lib/utils";
import { TechFrame } from "@/components/ui/tech";
import { choiceClass } from "@/components/dashboard/kit";
import { PatternQR, QRCardPreview, type QRTemplate } from "./qr-card-preview";
import type { QR } from "./types";

const HEX = /^#[0-9a-fA-F]{6}$/;
const schema = z.object({
  name: z.string().trim().min(2, "Name is required").max(160),
  location_id: z.string().min(1, "Choose a location"),
  template: z.enum(["classic", "minimal", "bold"]),
  foreground: z.string().regex(HEX, "Use a hex colour like #0b1218"),
  background: z.string().regex(HEX, "Use a hex colour like #ffffff"),
  card_headline: z.string().max(160).optional(),
  card_subtext: z.string().max(255).optional(),
});
type Values = z.infer<typeof schema>;

/** Print-safe ink colours (dark, high contrast) and paper colours. */
const FG_SWATCHES = ["#0b1218", "#000000", "#0e3a52", "#0b4f4a", "#1f3b2c", "#4a2a12"];
const BG_SWATCHES = ["#ffffff", "#f3f6f7", "#fbf7ee", "#eef8f3", "#eef4fb"];
const DEFAULT_FG = "#0b1218";
const DEFAULT_BRAND = "#0e9aa7";

function luminance(hex: string) {
  if (!HEX.test(hex)) return 0;
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function ColorField({ label, value, onChange, swatches, error }: { label: string; value: string; onChange: (v: string) => void; swatches: string[]; error?: string }) {
  return (
    <FormField label={label} error={error}>
      <div className="flex items-center gap-2">
        <label className="relative size-10 shrink-0 cursor-pointer overflow-hidden rounded-lg border border-border-strong shadow-xs focus-within:ring-[1.5px] focus-within:ring-ring" style={{ background: HEX.test(value) ? value : "#fff" }}>
          <input type="color" value={HEX.test(value) ? value : "#000000"} onChange={(e) => onChange(e.target.value)} className="absolute inset-0 cursor-pointer opacity-0" aria-label={`${label} picker`} />
        </label>
        <Input value={value} onChange={(e) => onChange(e.target.value)} className="font-mono uppercase tracking-[0.06em]" maxLength={7} aria-label={`${label} hex`} invalid={!!error} />
      </div>
      <div className="mt-2 flex gap-1.5" role="group" aria-label={`${label} presets`}>
        {swatches.map((s) => (
          <button key={s} type="button" onClick={() => onChange(s)} aria-pressed={value.toLowerCase() === s} className={cn("size-6 rounded-[5px] border border-border-strong transition hover:scale-110", value.toLowerCase() === s && "ring-[1.5px] ring-primary ring-offset-2 ring-offset-popover")} style={{ background: s }} aria-label={`Use ${s}`} />
        ))}
      </div>
    </FormField>
  );
}

function TemplateThumb({ template, brand }: { template: QRTemplate; brand: string }) {
  const bold = template === "bold";
  return (
    <div className="mx-auto flex aspect-[105/148] w-14 flex-col items-center gap-1 overflow-hidden rounded-md p-1.5 shadow-xs ring-1 ring-border" style={{ background: bold ? brand : "#ffffff" }}>
      {!bold && <div className="-mx-1.5 -mt-1.5 mb-0.5 h-0.5 self-stretch" style={{ background: brand }} />}
      {template === "classic" && <div className="h-0.5 w-6 rounded-full bg-[#0b1218]/60" />}
      <div className={cn("h-1 rounded-full", template === "minimal" ? "w-9" : "w-8", bold ? "bg-white" : "bg-[#0b1218]")} />
      <div className={cn("h-0.5 w-7 rounded-full", bold ? "bg-white/60" : "bg-[#7d8b95]")} />
      <div className={cn("mt-0.5 flex w-full flex-1 items-center justify-center rounded", bold && "bg-white")}>
        <PatternQR fg="#0b1218" bg="#ffffff" seed={template} className="size-8" />
      </div>
    </div>
  );
}

export function QREditor({ open, onOpenChange, qr }: { open: boolean; onOpenChange: (o: boolean) => void; qr: QR | null }) {
  const { orgId, locations, locationId, membership } = useOrg();
  // The printable card uses the organisation's brand colour (same as the PDF renderer).
  const orgDetail = useQuery({ queryKey: ["organization", orgId], queryFn: () => api.get<{ brand_color?: string | null }>("/organizations/current"), enabled: open, staleTime: 60_000 });
  const brand = orgDetail.data?.brand_color && HEX.test(orgDetail.data.brand_color) ? orgDetail.data.brand_color : DEFAULT_BRAND;
  const qc = useQueryClient();
  const [logoFile, setLogoFile] = React.useState<File | null>(null);
  const [logoPreview, setLogoPreview] = React.useState<string | null>(null);
  const [apiError, setApiError] = React.useState<string | null>(null);
  const fileRef = React.useRef<HTMLInputElement>(null);

  const form = useForm<Values>({ resolver: zodResolver(schema) });
  const { register, setValue, control, reset, handleSubmit, formState: { errors } } = form;
  const v = useWatch({ control }) as Values;

  React.useEffect(() => {
    if (!open) return;
    setApiError(null);
    setLogoFile(null);
    setLogoPreview(qr?.logo_url ?? null);
    reset(qr ? {
      name: qr.name, location_id: qr.location_id, template: qr.template as QRTemplate, foreground: qr.foreground, background: qr.background,
      card_headline: qr.card_headline ?? "", card_subtext: qr.card_subtext ?? "",
    } : {
      name: "Table card", location_id: locationId ?? locations[0]?.id ?? "", template: "classic", foreground: DEFAULT_FG, background: "#ffffff",
      card_headline: "How was your visit?", card_subtext: "Scan to share honest feedback",
    });
  }, [open, qr, reset, locationId, locations]);

  const save = useMutation({
    mutationFn: async (values: Values) => {
      const payload = { ...values, card_headline: values.card_headline || null, card_subtext: values.card_subtext || null };
      const saved = qr ? await api.patch<QR>(`/qr-codes/${qr.id}`, payload) : await api.post<QR>("/qr-codes", payload);
      if (logoFile) {
        const fd = new FormData();
        fd.append("file", logoFile);
        return api.post<QR>(`/qr-codes/${saved.id}/logo`, fd);
      }
      if (qr?.logo_url && !logoPreview) return api.delete<QR>(`/qr-codes/${saved.id}/logo`);
      return saved;
    },
    onSuccess: () => {
      toast.success(qr ? "QR code updated" : "QR code created");
      qc.invalidateQueries({ queryKey: ["qr-codes"] });
      onOpenChange(false);
    },
    onError: (e) => {
      const msg = e instanceof ApiError ? e.message.replace(/^[a-z_]+: (Value error, )?/, "") : errorMessage(e);
      setApiError(msg);
    },
  });

  const onPickLogo = (f: File | undefined) => {
    if (!f) return;
    if (!["image/png", "image/jpeg", "image/webp"].includes(f.type)) return toast.error("Use a PNG, JPEG or WebP image");
    if (f.size > 2 * 1024 * 1024) return toast.error("Logo must be under 2 MB");
    setLogoFile(f);
    setLogoPreview(URL.createObjectURL(f));
  };

  const lowContrast = HEX.test(v.foreground ?? "") && HEX.test(v.background ?? "") && Math.abs(luminance(v.foreground) - luminance(v.background)) < 0.4;
  const loc = locations.find((l) => l.id === v.location_id);
  const org = membership.organization;

  const fg = HEX.test(v.foreground ?? "") ? v.foreground : DEFAULT_FG;
  const bg = HEX.test(v.background ?? "") ? v.background : "#ffffff";
  const contrast = HEX.test(v.foreground ?? "") && HEX.test(v.background ?? "") ? Math.abs(luminance(v.foreground) - luminance(v.background)) : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="xl" className="p-0">
        <form onSubmit={handleSubmit((vals) => { setApiError(null); save.mutate(vals); })} className="grid md:grid-cols-[minmax(0,1fr)_340px]">
          <div className="space-y-6 p-5 sm:p-6">
            <DialogHeader>
              <p className="micro-label">QR · {qr ? `Edit ${qr.code}` : "New code"}</p>
              <DialogTitle>{qr ? "Edit QR code" : "Create QR code"}</DialogTitle>
              <DialogDescription>Scanning always leads every customer to the same feedback page, with an equal option to review you on Google.</DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField label="Name" htmlFor="qr-name" error={errors.name?.message} required>
                <Input id="qr-name" {...register("name")} invalid={!!errors.name} />
              </FormField>
              <FormField label="Location" error={errors.location_id?.message} required>
                <Select value={v.location_id} onValueChange={(x) => setValue("location_id", x, { shouldValidate: true })} disabled={!!qr}>
                  <SelectTrigger aria-label="Location"><SelectValue placeholder="Choose location" /></SelectTrigger>
                  <SelectContent>{locations.map((l) => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}</SelectContent>
                </Select>
              </FormField>
            </div>
            <div>
              <p className="micro-label mb-2.5">Card template</p>
              <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Template">
                {(["classic", "minimal", "bold"] as const).map((t) => (
                  <button key={t} type="button" role="radio" aria-checked={v.template === t} onClick={() => setValue("template", t)} className={cn("p-2.5", choiceClass(v.template === t))}>
                    <TemplateThumb template={t} brand={brand} />
                    <p className={cn("mt-2 text-center font-mono text-[10.5px] uppercase tracking-[0.1em]", v.template === t ? "text-primary" : "text-muted-foreground")}>{t}</p>
                  </button>
                ))}
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <ColorField label="Foreground" value={v.foreground ?? ""} onChange={(x) => setValue("foreground", x, { shouldValidate: true })} swatches={FG_SWATCHES} error={errors.foreground?.message} />
              <ColorField label="Background" value={v.background ?? ""} onChange={(x) => setValue("background", x, { shouldValidate: true })} swatches={BG_SWATCHES} error={errors.background?.message} />
            </div>
            {lowContrast && <InlineAlert variant="warning" title="Low contrast">Phones may struggle to scan this. Use a dark foreground on a light background.</InlineAlert>}
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField label="Card headline" htmlFor="qr-headline"><Input id="qr-headline" {...register("card_headline")} maxLength={160} /></FormField>
              <FormField label="Card subtext" htmlFor="qr-subtext"><Input id="qr-subtext" {...register("card_subtext")} maxLength={255} /></FormField>
            </div>
            <div>
              <p className="micro-label mb-2.5">Centre logo <span className="normal-case tracking-normal">· optional · PNG/JPEG/WebP · max 2 MB</span></p>
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex size-12 items-center justify-center overflow-hidden rounded-lg border border-dashed border-border-strong bg-background-subtle">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  {logoPreview ? <img src={logoPreview} alt="Logo preview" className="size-full object-contain p-1" /> : <ImagePlus className="size-5 text-subtle-foreground" />}
                </div>
                <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={(e) => onPickLogo(e.target.files?.[0])} />
                <Button type="button" variant="outline" size="sm" onClick={() => fileRef.current?.click()}>{logoPreview ? "Replace" : "Upload logo"}</Button>
                {logoPreview && <Button type="button" variant="ghost" size="sm" onClick={() => { setLogoFile(null); setLogoPreview(null); if (fileRef.current) fileRef.current.value = ""; }}><Trash2 /> Remove</Button>}
              </div>
            </div>
            {apiError && <InlineAlert variant="danger" title="Couldn't save">{apiError}</InlineAlert>}
          </div>
          <div className="relative flex flex-col overflow-hidden border-t border-border bg-background-subtle p-5 sm:p-6 md:border-l md:border-t-0">
            <div aria-hidden className="pointer-events-none absolute inset-0 bg-tech-grid-fade" />
            <div className="relative mb-4 flex items-center justify-between pr-8">
              <p className="micro-label">Print preview · A6</p>
              <p className="font-mono text-[10px] uppercase tracking-[0.1em] text-subtle-foreground">105 × 148 mm</p>
            </div>
            <TechFrame className="relative mx-auto w-full max-w-[240px] [container-type:inline-size]">
              <QRCardPreview
                template={v.template ?? "classic"} business={org.name} location={loc?.name ?? ""} headline={v.card_headline} subtext={v.card_subtext}
                fg={fg} bg={bg} brand={brand}
                qr={<PatternQR fg={fg} bg={bg} seed={qr?.code ?? "new"} logo={logoPreview} className="size-full" />}
              />
            </TechFrame>
            <dl className="relative mt-5 grid grid-cols-3 gap-2 border-t border-border pt-3">
              {[["Ink", fg], ["Paper", bg], ["Contrast", contrast == null ? "—" : contrast >= 0.4 ? "Pass" : "Low"]].map(([k, val]) => (
                <div key={k}>
                  <dt className="font-mono text-[9.5px] uppercase tracking-[0.12em] text-subtle-foreground">{k}</dt>
                  <dd className={cn("mt-0.5 flex items-center gap-1.5 font-mono text-[11px] uppercase", k === "Contrast" && contrast != null && (contrast >= 0.4 ? "text-success-foreground" : "text-warning-foreground"))}>
                    {k !== "Contrast" && <span className="size-2.5 rounded-[2px] border border-border-strong" style={{ background: val }} />}{val}
                  </dd>
                </div>
              ))}
            </dl>
            <p className="relative mt-3 text-[11px] text-muted-foreground">Design preview — the scannable code is generated when you save.</p>
            <DialogFooter className="relative mt-auto pt-6">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
              <Button type="submit" loading={save.isPending}>{qr ? "Save changes" : "Create QR code"}</Button>
            </DialogFooter>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
