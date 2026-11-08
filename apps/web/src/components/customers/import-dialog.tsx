"use client";
import * as React from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { CheckCircle2, FileSpreadsheet, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/controls";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { FormField } from "@/components/ui/form-field";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { InlineAlert } from "@/components/ui/states";
import { api, errorMessage } from "@/lib/api";
import { useOrg } from "@/lib/session";
import { cn, formatNumber } from "@/lib/utils";

interface ImportResult { created: number; updated: number; skipped: number; errors: string[] }

export function ImportDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const { locations } = useOrg();
  const qc = useQueryClient();
  const [file, setFile] = React.useState<File | null>(null);
  const [consent, setConsent] = React.useState(false);
  const [locationId, setLocationId] = React.useState("none");
  const [result, setResult] = React.useState<ImportResult | null>(null);
  const [drag, setDrag] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);

  const reset = () => { setFile(null); setConsent(false); setResult(null); setLocationId("none"); };

  const run = useMutation({
    mutationFn: () => {
      const fd = new FormData();
      fd.append("file", file as File);
      const qs = new URLSearchParams({ consent_confirmed: String(consent) });
      if (locationId !== "none") qs.set("location_id", locationId);
      return api.post<ImportResult>(`/customers/import?${qs}`, fd);
    },
    onSuccess: (r) => {
      setResult(r);
      qc.invalidateQueries({ queryKey: ["customers"] });
      toast.success(`Imported ${r.created} new, ${r.updated} updated`);
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  return (
    <Dialog open={open} onOpenChange={(o) => { onOpenChange(o); if (!o) reset(); }}>
      <DialogContent size="lg">
        <DialogHeader>
          <DialogTitle>Import customers from CSV</DialogTitle>
          <DialogDescription>Columns: <span className="font-mono text-xs">name, email, phone, tags, preferred_language</span>. Existing customers are matched by email or phone.</DialogDescription>
        </DialogHeader>
        {result ? (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-3">
              {([["Created", result.created, "text-success-foreground"], ["Updated", result.updated, "text-blue"], ["Skipped", result.skipped, "text-warning-foreground"]] as const).map(([l, v, c]) => (
                <div key={l} className="rounded-xl border border-border p-4">
                  <p className="text-xs text-muted-foreground">{l}</p>
                  <p className={cn("mt-1 text-2xl font-semibold tabular", c)}>{formatNumber(v)}</p>
                </div>
              ))}
            </div>
            {result.errors.length > 0 && (
              <div className="max-h-48 overflow-y-auto rounded-xl border border-border bg-background-subtle p-3 scrollbar-thin">
                <p className="mb-2 text-xs font-semibold text-foreground">Rows needing attention</p>
                <ul className="space-y-1 font-mono text-[11.5px] text-muted-foreground">{result.errors.map((e) => <li key={e}>{e}</li>)}</ul>
              </div>
            )}
            {!consent && <InlineAlert variant="info" icon={CheckCircle2}>Contacts were imported without consent. Record consent on each profile before sending review requests.</InlineAlert>}
            <DialogFooter><Button onClick={() => onOpenChange(false)}>Done</Button></DialogFooter>
          </div>
        ) : (
          <div className="space-y-4">
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
              onDragLeave={() => setDrag(false)}
              onDrop={(e) => { e.preventDefault(); setDrag(false); const f = e.dataTransfer.files[0]; if (f) setFile(f); }}
              className={cn("flex w-full flex-col items-center justify-center rounded-xl border border-dashed px-6 py-8 text-center transition", drag ? "border-primary bg-primary-soft/40" : "border-border-strong hover:border-primary/50 hover:bg-muted/40")}
            >
              {file ? (
                <>
                  <FileSpreadsheet className="size-7 text-primary" />
                  <p className="mt-2 text-sm font-medium">{file.name}</p>
                  <p className="text-xs text-muted-foreground">{(file.size / 1024).toFixed(1)} KB · click to replace</p>
                </>
              ) : (
                <>
                  <Upload className="size-6 text-muted-foreground" />
                  <p className="mt-2 text-sm font-medium">Drop a CSV here or click to browse</p>
                  <p className="text-xs text-muted-foreground">UTF-8, up to 5 MB / 10,000 rows</p>
                </>
              )}
            </button>
            <input ref={inputRef} type="file" accept=".csv,text/csv" className="sr-only" aria-label="CSV file" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
            <FormField label="Assign to location">
              <Select value={locationId} onValueChange={setLocationId}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No specific location</SelectItem>
                  {locations.map((l) => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </FormField>
            <label className="flex items-start gap-3 rounded-xl border border-border bg-background-subtle p-4 text-[13px]">
              <Checkbox checked={consent} onCheckedChange={(c) => setConsent(c === true)} className="mt-0.5" />
              <span>
                <span className="font-semibold">These customers agreed to receive service messages</span>
                <span className="mt-0.5 block text-xs leading-relaxed text-muted-foreground">
                  Only tick this if you collected explicit consent (e.g. a signed form or opt-in checkbox). Consent will be recorded for WhatsApp (if phone) and email, with you as the person confirming it. Leave unticked to import contacts only.
                </span>
              </span>
            </label>
            <DialogFooter>
              <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
              <Button disabled={!file} loading={run.isPending} onClick={() => run.mutate()}>Import</Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
