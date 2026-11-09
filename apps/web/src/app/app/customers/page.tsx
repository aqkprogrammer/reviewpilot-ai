"use client";
import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import { ChevronRight, Download, Plus, Search, SlidersHorizontal, Upload, UsersRound } from "lucide-react";
import { toast } from "sonner";
import { Pagination } from "@/components/app/pagination";
import { QueryErrorState, ReadOnlyNotice } from "@/components/billing/plan-gate";
import { Eyebrow, FilterChip, Monogram, ReadoutStrip } from "@/components/console/kit";
import { ConsentChips } from "@/components/customers/consent-chips";
import { CustomerFormDialog } from "@/components/customers/customer-form-dialog";
import { ImportDialog } from "@/components/customers/import-dialog";
import type { Customer } from "@/components/customers/types";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/page-header";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { EmptyState, Skeleton } from "@/components/ui/states";
import { TBody, TD, TH, THead, TR, Table } from "@/components/ui/table";
import { api, downloadFile, errorMessage } from "@/lib/api";
import { useOrg } from "@/lib/session";
import { cn, formatNumber } from "@/lib/utils";

interface PageData { items: Customer[]; total: number; page: number; page_size: number; pages: number }

const CONSENT_LABEL: Record<string, string> = { whatsapp: "WhatsApp consent", email: "Email consent", sms: "SMS consent", none: "No consent" };

function useDebounced<T>(v: T, ms = 300) {
  const [d, setD] = React.useState(v);
  React.useEffect(() => { const t = setTimeout(() => setD(v), ms); return () => clearTimeout(t); }, [v, ms]);
  return d;
}

export default function CustomersPage() {
  const router = useRouter();
  const { can, orgId, locationId, locations } = useOrg();
  const [q, setQ] = React.useState("");
  const [tag, setTag] = React.useState("all");
  const [consent, setConsent] = React.useState("all");
  const [optedOut, setOptedOut] = React.useState("all");
  const [loc, setLoc] = React.useState<string>(locationId ?? "all");
  const [page, setPage] = React.useState(1);
  const [creating, setCreating] = React.useState(false);
  const [importing, setImporting] = React.useState(false);
  const [exporting, setExporting] = React.useState(false);
  const dq = useDebounced(q);
  React.useEffect(() => setLoc(locationId ?? "all"), [locationId]);
  React.useEffect(() => setPage(1), [dq, tag, consent, optedOut, loc]);

  const canRead = can("customers.read");
  const canManage = can("customers.manage");
  const query = useQuery({
    queryKey: ["customers", orgId, { dq, tag, consent, optedOut, loc, page }],
    queryFn: () =>
      api.get<PageData>("/customers", {
        q: dq || undefined,
        tag: tag === "all" ? undefined : tag,
        consent: consent === "all" ? undefined : consent,
        opted_out: optedOut === "all" ? undefined : optedOut === "yes",
        location_id: loc === "all" ? undefined : loc,
        page,
        page_size: 25,
      }),
    placeholderData: keepPreviousData,
    enabled: canRead,
  });
  const tags = useQuery({ queryKey: ["customers", "tags", orgId], queryFn: () => api.get<string[]>("/customers/tags"), enabled: canRead });
  const locName = (id: string | null) => locations.find((l) => l.id === id)?.name;

  if (!canRead) return <ReadOnlyNotice />;
  const chips = [
    dq && { key: "q", label: `“${dq}”`, clear: () => setQ("") },
    tag !== "all" && { key: "tag", label: `Tag · ${tag}`, clear: () => setTag("all") },
    consent !== "all" && { key: "consent", label: CONSENT_LABEL[consent], clear: () => setConsent("all") },
    optedOut !== "all" && { key: "opt", label: optedOut === "yes" ? "Opted out" : "Subscribed", clear: () => setOptedOut("all") },
    loc !== "all" && { key: "loc", label: locName(loc) ?? "Location", clear: () => setLoc("all") },
  ].filter(Boolean) as { key: string; label: string; clear: () => void }[];
  const filtered = chips.length > 0;
  const data = query.data;
  const pageItems = data?.items ?? [];
  const pageConsented = pageItems.filter((c) => !c.opted_out_at && Object.values(c.consents).some(Boolean)).length;
  const pageOptedOut = pageItems.filter((c) => c.opted_out_at).length;
  const from = data && data.total ? (data.page - 1) * data.page_size + 1 : 0;
  const to = data ? Math.min(data.total, data.page * data.page_size) : 0;

  const exportCsv = async () => {
    setExporting(true);
    try { await downloadFile("/customers/export", undefined, "customers.csv"); toast.success("Customer export downloaded"); } catch (e) { toast.error(errorMessage(e)); } finally { setExporting(false); }
  };

  return (
    <div className="space-y-5">
      <PageHeader
        className="mb-0"
        eyebrow={<Eyebrow parts={["Workspace", "Customer registry"]} />}
        title="Customers"
        description="Contacts you can invite to share feedback. Consent is tracked per channel and opt-outs are always respected."
        actions={
          canManage && (
            <>
              <Button variant="outline" onClick={() => setImporting(true)}><Upload /> Import CSV</Button>
              <Button variant="outline" loading={exporting} onClick={exportCsv}><Download /> Export</Button>
              <Button onClick={() => setCreating(true)}><Plus /> Add customer</Button>
            </>
          )
        }
      />

      <ReadoutStrip
        items={[
          { label: filtered ? "Matching records" : "Total records", value: data ? formatNumber(data.total) : "—", tone: "signal" },
          { label: "Showing", value: data ? (data.total ? `${formatNumber(from)}–${formatNumber(to)}` : "0") : "—" },
          { label: "Consent · page", value: data ? `${pageConsented} / ${pageItems.length}` : "—", tone: "ok", hint: "Customers on this page with consent recorded on at least one channel" },
          { label: "Opt-out · page", value: data ? String(pageOptedOut) : "—", tone: pageOptedOut ? "danger" : "muted" },
        ]}
      />

      <Card className="overflow-hidden">
        <div className="border-b border-border p-3 sm:p-4">
          <div className="flex flex-col gap-2.5 lg:flex-row lg:items-center">
            <div className="flex-1 lg:max-w-sm">
              <Input leading={<Search />} placeholder="Search name, email or phone" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search customers" />
            </div>
            <div className="flex items-center gap-2 text-subtle-foreground max-lg:hidden" aria-hidden><SlidersHorizontal className="size-3.5" /></div>
            <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
              <Select value={tag} onValueChange={setTag}>
                <SelectTrigger size="sm" className="sm:w-36" aria-label="Tag"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All tags</SelectItem>
                  {tags.data?.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={consent} onValueChange={setConsent}>
                <SelectTrigger size="sm" className="sm:w-44" aria-label="Consent"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Any consent</SelectItem>
                  <SelectItem value="whatsapp">WhatsApp consent</SelectItem>
                  <SelectItem value="email">Email consent</SelectItem>
                  <SelectItem value="sms">SMS consent</SelectItem>
                  <SelectItem value="none">No consent</SelectItem>
                </SelectContent>
              </Select>
              <Select value={optedOut} onValueChange={setOptedOut}>
                <SelectTrigger size="sm" className="sm:w-36" aria-label="Opt-out status"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All statuses</SelectItem>
                  <SelectItem value="no">Subscribed</SelectItem>
                  <SelectItem value="yes">Opted out</SelectItem>
                </SelectContent>
              </Select>
              {locations.length > 1 && (
                <Select value={loc} onValueChange={setLoc}>
                  <SelectTrigger size="sm" className="sm:w-48" aria-label="Location"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All locations</SelectItem>
                    {locations.map((l) => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              )}
            </div>
          </div>
          {filtered && (
            <div className="mt-3 flex flex-wrap items-center gap-1.5">
              <span className="micro-label mr-1">Filters</span>
              {chips.map((c) => <FilterChip key={c.key} label={c.label} onClear={c.clear} />)}
              <button type="button" className="ml-1 font-mono text-[10.5px] uppercase tracking-[0.1em] text-muted-foreground underline-offset-4 transition hover:text-foreground hover:underline" onClick={() => { setQ(""); setTag("all"); setConsent("all"); setOptedOut("all"); setLoc("all"); }}>
                Clear all
              </button>
            </div>
          )}
        </div>

        {query.isLoading ? (
          <div className="divide-y divide-border">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="flex items-center gap-4 px-5 py-3.5">
                <Skeleton className="size-8 rounded-md" />
                <div className="flex-1 space-y-1.5"><Skeleton className="h-3.5 w-40" /><Skeleton className="h-3 w-56" /></div>
                <Skeleton className="h-6 w-28" />
              </div>
            ))}
          </div>
        ) : query.error ? (
          <QueryErrorState error={query.error} onRetry={() => query.refetch()} />
        ) : !pageItems.length ? (
          <EmptyState
            icon={UsersRound}
            title={filtered ? "No customers match these filters" : "No customers yet"}
            description={filtered ? "Try clearing a filter or searching for something else." : "Add customers manually or import a CSV. Customers who leave feedback on your public page can also be added automatically."}
            action={!filtered && canManage && (<><Button variant="outline" onClick={() => setImporting(true)}><Upload /> Import CSV</Button><Button onClick={() => setCreating(true)}><Plus /> Add customer</Button></>)}
          />
        ) : (
          <div className={cn("transition-opacity", query.isFetching && !query.isLoading && "opacity-60")}>
            <Table>
              <THead>
                <TR className="hover:bg-transparent">
                  <TH>Customer</TH>
                  <TH className="hidden md:table-cell">Phone</TH>
                  <TH>Consent</TH>
                  <TH className="hidden lg:table-cell">Tags</TH>
                  <TH className="hidden xl:table-cell">Location</TH>
                  <TH className="hidden sm:table-cell text-right">Req.</TH>
                  <TH className="hidden sm:table-cell text-right">Last contact</TH>
                  <TH className="w-8 px-0"><span className="sr-only">Open</span></TH>
                </TR>
              </THead>
              <TBody>
                {pageItems.map((c) => (
                  <TR key={c.id} className="group cursor-pointer" onClick={() => router.push(`/app/customers/${c.id}`)}>
                    <TD>
                      <Link href={`/app/customers/${c.id}`} className="flex items-center gap-3 outline-none" onClick={(e) => e.stopPropagation()}>
                        <Monogram name={c.name ?? c.email ?? "?"} size={30} />
                        <span className="min-w-0">
                          <span className="block max-w-[120px] truncate font-medium text-foreground group-hover:text-primary sm:max-w-[240px]">{c.name ?? "Unnamed customer"}</span>
                          <span className="block max-w-[120px] truncate text-xs text-muted-foreground sm:max-w-[240px]">{c.email ?? "No email"}</span>
                        </span>
                      </Link>
                    </TD>
                    <TD className="hidden md:table-cell whitespace-nowrap font-mono text-[12px] tabular text-muted-foreground">{c.phone ?? "—"}</TD>
                    <TD><ConsentChips consents={c.consents} optedOut={!!c.opted_out_at} /></TD>
                    <TD className="hidden lg:table-cell">
                      <div className="flex flex-wrap gap-1">
                        {c.tags.slice(0, 3).map((t) => <span key={t} className="rounded-[4px] border border-border px-1.5 py-px font-mono text-[10.5px] text-muted-foreground">{t}</span>)}
                        {c.tags.length > 3 && <span className="rounded-[4px] bg-muted px-1.5 py-px font-mono text-[10.5px] text-muted-foreground">+{c.tags.length - 3}</span>}
                        {!c.tags.length && <span className="text-subtle-foreground">—</span>}
                      </div>
                    </TD>
                    <TD className="hidden xl:table-cell max-w-[200px] truncate text-xs">{locName(c.location_id) ?? <span className="text-subtle-foreground">—</span>}</TD>
                    <TD className="hidden sm:table-cell text-right font-mono tabular">{c.request_count || <span className="text-subtle-foreground">0</span>}</TD>
                    <TD className="hidden sm:table-cell whitespace-nowrap text-right font-mono text-[11.5px] text-muted-foreground">
                      {c.last_contacted_at ? formatDistanceToNow(new Date(c.last_contacted_at), { addSuffix: true }) : <span className="text-subtle-foreground">never</span>}
                    </TD>
                    <TD className="w-8 px-0 pr-3"><ChevronRight className="size-4 text-subtle-foreground opacity-0 transition group-hover:translate-x-0.5 group-hover:opacity-100" /></TD>
                  </TR>
                ))}
              </TBody>
            </Table>
            <Pagination page={data!.page} pages={data!.pages} total={data!.total} pageSize={data!.page_size} onPage={setPage} />
          </div>
        )}
      </Card>

      <CustomerFormDialog open={creating} onOpenChange={setCreating} />
      <ImportDialog open={importing} onOpenChange={setImporting} />
    </div>
  );
}
