"use client";
import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import { Download, Plus, Search, Upload, UsersRound } from "lucide-react";
import { toast } from "sonner";
import { Pagination } from "@/components/app/pagination";
import { QueryErrorState, ReadOnlyNotice } from "@/components/billing/plan-gate";
import { ConsentChips } from "@/components/customers/consent-chips";
import { CustomerFormDialog } from "@/components/customers/customer-form-dialog";
import { ImportDialog } from "@/components/customers/import-dialog";
import type { Customer } from "@/components/customers/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Avatar } from "@/components/ui/controls";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/page-header";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { EmptyState, Skeleton } from "@/components/ui/states";
import { TBody, TD, TH, THead, TR, Table } from "@/components/ui/table";
import { api, downloadFile, errorMessage } from "@/lib/api";
import { useOrg } from "@/lib/session";
import { formatNumber } from "@/lib/utils";

interface PageData { items: Customer[]; total: number; page: number; page_size: number; pages: number }

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
  const filtered = !!(dq || tag !== "all" || consent !== "all" || optedOut !== "all" || loc !== "all");

  return (
    <div>
      <PageHeader
        title="Customers"
        description="Contacts you can invite to share feedback. Consent is tracked per channel and opt-outs are always respected."
        actions={
          canManage && (
            <>
              <Button variant="outline" onClick={() => setImporting(true)}><Upload /> Import CSV</Button>
              <Button
                variant="outline"
                loading={exporting}
                onClick={async () => {
                  setExporting(true);
                  try { await downloadFile("/customers/export", undefined, "customers.csv"); } catch (e) { toast.error(errorMessage(e)); } finally { setExporting(false); }
                }}
              >
                <Download /> Export
              </Button>
              <Button onClick={() => setCreating(true)}><Plus /> Add customer</Button>
            </>
          )
        }
      />

      <Card className="overflow-hidden">
        <div className="flex flex-col gap-3 border-b border-border p-4 lg:flex-row lg:items-center">
          <div className="flex-1 lg:max-w-sm">
            <Input leading={<Search />} placeholder="Search name, email or phone" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search customers" />
          </div>
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
          {query.data && <p className="text-xs text-muted-foreground lg:ml-auto tabular">{formatNumber(query.data.total)} customers</p>}
        </div>

        {query.isLoading ? (
          <div className="divide-y divide-border">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="flex items-center gap-4 px-5 py-3.5">
                <Skeleton className="size-8 rounded-full" />
                <div className="flex-1 space-y-1.5"><Skeleton className="h-3.5 w-40" /><Skeleton className="h-3 w-56" /></div>
                <Skeleton className="h-6 w-24" />
              </div>
            ))}
          </div>
        ) : query.error ? (
          <QueryErrorState error={query.error} onRetry={() => query.refetch()} />
        ) : !query.data?.items.length ? (
          <EmptyState
            icon={UsersRound}
            title={filtered ? "No customers match these filters" : "No customers yet"}
            description={filtered ? "Try clearing a filter or searching for something else." : "Add customers manually or import a CSV. Customers who leave feedback on your public page can also be added automatically."}
            action={!filtered && canManage && (<><Button variant="outline" onClick={() => setImporting(true)}><Upload /> Import CSV</Button><Button onClick={() => setCreating(true)}><Plus /> Add customer</Button></>)}
          />
        ) : (
          <>
            <Table>
              <THead>
                <TR className="hover:bg-transparent">
                  <TH>Customer</TH>
                  <TH className="hidden md:table-cell">Phone</TH>
                  <TH>Consent</TH>
                  <TH className="hidden lg:table-cell">Tags</TH>
                  <TH className="hidden xl:table-cell">Location</TH>
                  <TH className="text-right">Requests</TH>
                  <TH className="hidden sm:table-cell text-right">Last contacted</TH>
                </TR>
              </THead>
              <TBody>
                {query.data.items.map((c) => (
                  <TR key={c.id} className="cursor-pointer" onClick={() => router.push(`/app/customers/${c.id}`)}>
                    <TD>
                      <Link href={`/app/customers/${c.id}`} className="flex items-center gap-3" onClick={(e) => e.stopPropagation()}>
                        <Avatar name={c.name ?? c.email ?? "?"} size={32} />
                        <span className="min-w-0">
                          <span className="block truncate font-medium text-foreground">{c.name ?? "Unnamed customer"}</span>
                          <span className="block truncate text-xs text-muted-foreground">{c.email ?? "No email"}</span>
                        </span>
                      </Link>
                    </TD>
                    <TD className="hidden md:table-cell font-mono text-xs tabular">{c.phone ?? "—"}</TD>
                    <TD><ConsentChips consents={c.consents} optedOut={!!c.opted_out_at} /></TD>
                    <TD className="hidden lg:table-cell">
                      <div className="flex flex-wrap gap-1">
                        {c.tags.slice(0, 3).map((t) => <Badge key={t} size="sm" variant="outline">{t}</Badge>)}
                        {c.tags.length > 3 && <Badge size="sm">+{c.tags.length - 3}</Badge>}
                      </div>
                    </TD>
                    <TD className="hidden xl:table-cell text-xs">{locName(c.location_id) ?? "—"}</TD>
                    <TD className="text-right tabular">{c.request_count}</TD>
                    <TD className="hidden sm:table-cell text-right text-xs text-muted-foreground">
                      {c.last_contacted_at ? formatDistanceToNow(new Date(c.last_contacted_at), { addSuffix: true }) : "Never"}
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
            <Pagination page={query.data.page} pages={query.data.pages} total={query.data.total} pageSize={query.data.page_size} onPage={setPage} />
          </>
        )}
      </Card>

      <CustomerFormDialog open={creating} onOpenChange={setCreating} />
      <ImportDialog open={importing} onOpenChange={setImporting} />
    </div>
  );
}
