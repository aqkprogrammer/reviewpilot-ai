"use client";
import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";
import { BarChart3, Copy, Download, FileImage, FileText, MapPin, MoreHorizontal, Pencil, Plus, QrCode, ScanLine, ShieldCheck, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState, ErrorState, InlineAlert, Skeleton } from "@/components/ui/states";
import { QREditor } from "@/components/qr/qr-editor";
import { QRPreviewImg } from "@/components/qr/qr-preview-img";
import { ScansSheet } from "@/components/qr/scans-sheet";
import type { QR } from "@/components/qr/types";
import { api, downloadFile, errorMessage } from "@/lib/api";
import { useOrg } from "@/lib/session";
import { formatNumber } from "@/lib/utils";
import { AnimatedNumber, StatusDot, TechFrame } from "@/components/ui/tech";

function QRTile({ qr, canManage, onEdit, onScans }: { qr: QR; canManage: boolean; onEdit: () => void; onScans: () => void }) {
  const qc = useQueryClient();
  const [busy, setBusy] = React.useState<string | null>(null);
  const del = useMutation({
    mutationFn: () => api.delete(`/qr-codes/${qr.id}`),
    onSuccess: () => { toast.success("QR code deleted"); qc.invalidateQueries({ queryKey: ["qr-codes"] }); },
    onError: (e) => toast.error(errorMessage(e)),
  });
  const download = async (format: "png" | "svg" | "pdf") => {
    setBusy(format);
    try {
      await downloadFile(`/qr-codes/${qr.id}/download`, { format }, `qr-${qr.code}.${format}`);
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(null);
    }
  };
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(qr.scan_url);
      toast.success("Scan link copied");
    } catch {
      toast.error("Couldn't copy — select the link manually");
    }
  };
  return (
    <Card className="card-hover group flex flex-col overflow-hidden">
      <div className="relative flex items-center justify-center overflow-hidden border-b border-border bg-background-subtle p-6">
        <div aria-hidden className="pointer-events-none absolute inset-0 bg-tech-grid-fade opacity-80" />
        <TechFrame className="relative rounded-lg bg-white p-3 shadow-md ring-1 ring-border transition duration-300 group-hover:-translate-y-0.5">
          <QRPreviewImg id={qr.id} version={qr.foreground + qr.background} alt={`QR code for ${qr.name}`} className="size-32" />
        </TechFrame>
        <span className="absolute left-3 top-3 rounded-[5px] border border-border bg-card/90 px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-[0.1em] text-muted-foreground backdrop-blur">{qr.template}</span>
        <span className="absolute right-3 top-3 font-mono text-[10px] uppercase tracking-[0.1em] text-subtle-foreground">/{qr.code}</span>
      </div>
      <div className="flex flex-1 flex-col p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="truncate text-[14px] font-semibold text-foreground">{qr.name}</p>
            <p className="mt-0.5 flex items-center gap-1 truncate text-xs text-muted-foreground"><MapPin className="size-3 shrink-0" />{qr.location_name}</p>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild><Button variant="ghost" size="icon-sm" aria-label={`More actions for ${qr.name}`}><MoreHorizontal /></Button></DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem onSelect={onScans}><BarChart3 /> Scan analytics</DropdownMenuItem>
              <DropdownMenuItem onSelect={copy}><Copy /> Copy scan link</DropdownMenuItem>
              {canManage && <DropdownMenuItem onSelect={onEdit}><Pencil /> Edit design</DropdownMenuItem>}
              {canManage && (
                <>
                  <DropdownMenuSeparator />
                  <ConfirmDialog
                    destructive
                    title={`Delete “${qr.name}”?`}
                    description="Printed copies will stop working and redirect to the ReviewPilot homepage. Scan history is kept for analytics."
                    confirmLabel="Delete QR code"
                    onConfirm={async () => { await del.mutateAsync().catch(() => undefined); }}
                    trigger={<DropdownMenuItem destructive onSelect={(e) => e.preventDefault()}><Trash2 /> Delete</DropdownMenuItem>}
                  />
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        <div className="mt-3 grid grid-cols-2 overflow-hidden rounded-lg border border-border">
          <button onClick={onScans} className="px-3 py-2 text-left outline-none transition hover:bg-surface-hover focus-visible:bg-surface-hover" aria-label={`Scan analytics for ${qr.name}`}>
            <p className="micro-label !text-[9.5px]">Total scans</p>
            <p className="mt-1 font-mono text-[17px] font-medium tabular leading-tight text-foreground">{formatNumber(qr.scan_count)}</p>
          </button>
          <div className="border-l border-border px-3 py-2">
            <p className="micro-label !text-[9.5px]">Last 7 days</p>
            <p className="mt-1 font-mono text-[17px] font-medium tabular leading-tight text-foreground">{formatNumber(qr.scans_7d)}</p>
          </div>
        </div>
        <p className="mt-2.5 flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.08em] text-subtle-foreground">
          <StatusDot tone={qr.last_scanned_at ? "live" : "idle"} />
          {qr.last_scanned_at ? `Last scan ${formatDistanceToNow(new Date(qr.last_scanned_at), { addSuffix: true })}` : "Not scanned yet"}
        </p>
        <div className="mt-auto pt-4">
          <DropdownMenu>
            <DropdownMenuTrigger asChild><Button variant="outline" size="sm" className="w-full" loading={!!busy}><Download /> Download</Button></DropdownMenuTrigger>
            <DropdownMenuContent align="center" className="w-56">
              <DropdownMenuLabel>Download as</DropdownMenuLabel>
              <DropdownMenuItem onSelect={() => download("pdf")}><FileText /> Printable card (PDF)</DropdownMenuItem>
              <DropdownMenuItem onSelect={() => download("png")}><FileImage /> PNG image</DropdownMenuItem>
              <DropdownMenuItem onSelect={() => download("svg")}><QrCode /> SVG vector</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </Card>
  );
}

function QRCodesInner() {
  const router = useRouter();
  const params = useSearchParams();
  const { orgId, locationId, can } = useOrg();
  const canManage = can("campaigns.manage");
  const [editing, setEditing] = React.useState<QR | null>(null);
  const [editorOpen, setEditorOpen] = React.useState(false);
  const [scansFor, setScansFor] = React.useState<QR | null>(null);

  React.useEffect(() => {
    if (params.get("new") === "1" && canManage) {
      setEditing(null);
      setEditorOpen(true);
      router.replace("/app/qr-codes", { scroll: false });
    }
  }, [params, canManage, router]);

  const q = useQuery({ queryKey: ["qr-codes", orgId, locationId], queryFn: () => api.get<QR[]>("/qr-codes", { location_id: locationId }) });
  const total = q.data?.reduce((a, x) => a + x.scan_count, 0) ?? 0;
  const week = q.data?.reduce((a, x) => a + x.scans_7d, 0) ?? 0;
  const openNew = () => { setEditing(null); setEditorOpen(true); };

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Collection · Offline touchpoints"
        title="QR codes"
        description="Printable table cards and counter displays that bring customers to your feedback page."
        actions={canManage && <Button onClick={openNew}><Plus /> Create QR code</Button>}
      />
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
        <div className="grid grid-cols-3 gap-px overflow-hidden rounded-xl border border-border bg-border shadow-sm">
          {([["Codes", q.data?.length], ["Total scans", total], ["Scans · 7 days", week]] as const).map(([l, val]) => (
            <div key={l} className="bg-card px-4 py-3.5">
              <p className="micro-label !text-[10px]">{l}</p>
              <p className="mt-1.5 text-[22px] font-semibold leading-none tracking-[-0.03em] tabular">{q.data ? <AnimatedNumber value={val ?? 0} format={(n) => formatNumber(Math.round(n))} /> : "—"}</p>
            </div>
          ))}
        </div>
        <InlineAlert variant="primary" icon={ShieldCheck} title="Honest by design" className="h-full">
          Every scan leads to the same feedback page, where every customer — happy or not — gets an equal option to leave a public Google review. No gating, no incentives.
        </InlineAlert>
      </div>
      {q.isError ? (
        <Card><ErrorState message={errorMessage(q.error)} onRetry={() => q.refetch()} /></Card>
      ) : q.isLoading ? (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-[380px] rounded-xl" />)}</div>
      ) : !q.data?.length ? (
        <Card>
          <EmptyState icon={ScanLine} title="Create your first QR code" description="Design a branded table card in seconds. Download it as a print-ready PDF, PNG or SVG." action={canManage && <Button size="sm" onClick={openNew}><Plus /> Create QR code</Button>} />
        </Card>
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
          {q.data.map((x) => (
            <QRTile key={x.id} qr={x} canManage={canManage} onEdit={() => { setEditing(x); setEditorOpen(true); }} onScans={() => setScansFor(x)} />
          ))}
          {canManage && (
            <button onClick={openNew} className="group relative flex min-h-[300px] flex-col items-center justify-center gap-3 overflow-hidden rounded-xl border border-dashed border-border-strong text-muted-foreground outline-none transition hover:border-[color-mix(in_oklab,var(--primary)_50%,transparent)] hover:text-foreground focus-visible:ring-[1.5px] focus-visible:ring-ring">
              <span aria-hidden className="pointer-events-none absolute inset-0 bg-tech-grid-fade opacity-60" />
              <span className="tech-corners relative flex size-11 items-center justify-center rounded-lg border border-border-strong bg-card-elevated text-primary transition group-hover:shadow-glow"><Plus className="size-5" /></span>
              <span className="relative text-[13px] font-medium">New QR code</span>
              <span className="micro-label relative">PDF · PNG · SVG</span>
            </button>
          )}
        </div>
      )}
      <QREditor open={editorOpen} onOpenChange={setEditorOpen} qr={editing} />
      <ScansSheet qr={scansFor} onClose={() => setScansFor(null)} />
    </div>
  );
}

export default function QRCodesPage() {
  return (
    <React.Suspense fallback={<Skeleton className="h-96" />}>
      <QRCodesInner />
    </React.Suspense>
  );
}
