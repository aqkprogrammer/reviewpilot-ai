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
      <div className="relative flex items-center justify-center border-b border-border bg-[radial-gradient(circle_at_50%_40%,var(--primary-soft),transparent_70%)] p-6">
        <div className="rounded-2xl bg-white p-3 shadow-md ring-1 ring-black/5 transition group-hover:-translate-y-0.5">
          <QRPreviewImg id={qr.id} version={qr.foreground + qr.background} alt={`QR code for ${qr.name}`} className="size-32" />
        </div>
        <span className="absolute left-3 top-3 rounded-full bg-card/90 px-2 py-0.5 text-[10.5px] font-medium capitalize text-muted-foreground ring-1 ring-border backdrop-blur">{qr.template}</span>
      </div>
      <div className="flex flex-1 flex-col p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="truncate text-[14px] font-semibold">{qr.name}</p>
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
        <div className="mt-3 grid grid-cols-2 gap-2">
          <button onClick={onScans} className="rounded-lg bg-background-subtle px-3 py-2 text-left transition hover:bg-muted">
            <p className="text-lg font-semibold tabular leading-tight">{formatNumber(qr.scan_count)}</p>
            <p className="text-[11px] text-muted-foreground">total scans</p>
          </button>
          <div className="rounded-lg bg-background-subtle px-3 py-2">
            <p className="text-lg font-semibold tabular leading-tight">{formatNumber(qr.scans_7d)}</p>
            <p className="text-[11px] text-muted-foreground">last 7 days</p>
          </div>
        </div>
        <p className="mt-2.5 text-[11px] text-subtle-foreground">{qr.last_scanned_at ? `Last scan ${formatDistanceToNow(new Date(qr.last_scanned_at), { addSuffix: true })}` : "Not scanned yet"}</p>
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
        title="QR codes"
        description="Printable table cards and counter displays that bring customers to your feedback page."
        actions={canManage && <Button onClick={openNew}><Plus /> Create QR code</Button>}
      />
      <InlineAlert variant="primary" icon={ShieldCheck} title="Honest by design">
        Every scan leads to the same feedback page, where every customer — happy or not — gets an equal option to leave a public Google review. No gating, no incentives.
      </InlineAlert>
      {q.data && q.data.length > 0 && (
        <div className="flex flex-wrap gap-x-8 gap-y-2 text-[13px] text-muted-foreground">
          <span><span className="font-semibold tabular text-foreground">{q.data.length}</span> codes</span>
          <span><span className="font-semibold tabular text-foreground">{formatNumber(total)}</span> total scans</span>
          <span><span className="font-semibold tabular text-foreground">{formatNumber(week)}</span> scans this week</span>
        </div>
      )}
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
            <button onClick={openNew} className="flex min-h-[300px] flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed border-border text-muted-foreground transition hover:border-primary/40 hover:bg-primary-soft/30 hover:text-foreground">
              <span className="flex size-11 items-center justify-center rounded-full bg-primary-soft text-primary"><Plus className="size-5" /></span>
              <span className="text-[13px] font-medium">New QR code</span>
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
