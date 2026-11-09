"use client";
import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AtSign, Ban, KeyRound, RotateCcw, ScrollText, ShieldCheck, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/controls";
import { Sheet, SheetBody, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/states";
import { errorMessage } from "@/lib/api";
import { useMe } from "@/lib/session";
import { cn, formatNumber } from "@/lib/utils";
import { BulkActionDialog } from "@/components/admin/bulk";
import { ReasonDialog } from "@/components/admin/reason-dialog";
import {
  BulkBar, ClearFilters, DataTable, FilterSelect, MiniStat, MobileCard, Pagination, Responsive, Row, RowMenu, SearchInput, SelectCell, SelectHead, SortNote, StatusTabs, Td, Th, Toolbar, useClientSort, useSelection,
} from "@/components/admin/table";
import { CopyId, DemoTag, EmptyLine, KeyValue, Monogram, Panel, SectionHeader, StatusPill, adminPost, relTime, shortDate, stamp, useAdmin, type AdminPage } from "@/components/admin/ui";

interface UserRow { id: string; email: string; full_name: string; avatar_url: string | null; platform_role: string; status: string; email_verified: boolean; last_login_at: string | null; created_at: string; organizations: number; is_seed?: boolean }
interface UserDetail {
  user: UserRow & { phone: string | null; timezone: string; locale: string; has_password: boolean };
  memberships: { organization_id: string; organization_name: string; role: string; organization_status: string; joined_at: string }[];
  active_sessions: number;
  audit: { id: string; action: string; created_at: string; ip_address: string | null }[];
}
type UserAction = "disable" | "reactivate" | "revoke-sessions";
const ACTION_COPY: Record<UserAction, { title: (n: string) => string; desc: string; label: string; toast: string }> = {
  disable: { title: (n) => `Disable ${n}?`, desc: "They are signed out everywhere and can't sign in until reactivated.", label: "Disable account", toast: "Account disabled and sessions revoked" },
  reactivate: { title: (n) => `Reactivate ${n}?`, desc: "They can sign in again immediately.", label: "Reactivate", toast: "Account reactivated" },
  "revoke-sessions": { title: (n) => `Revoke all sessions for ${n}?`, desc: "They will need to sign in again on every device.", label: "Revoke sessions", toast: "Sessions revoked" },
};

const isSuper = (u: { platform_role: string }) => u.platform_role === "platform_super_admin";

function UserDrawer({ userId, onClose, onAction }: { userId: string | null; onClose: () => void; onAction: (u: UserRow, a: UserAction) => void }) {
  const q = useAdmin<UserDetail>(`/users/${userId}`, undefined, { enabled: !!userId });
  const d = userId ? q.data : undefined;
  const admin = d ? isSuper(d.user) : false;
  return (
    <Sheet open={!!userId} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="sm:max-w-[520px]">
        <SheetHeader>
          <p className="micro-label mb-1">Identity · user profile</p>
          <SheetTitle>{d?.user.full_name ?? "User profile"}</SheetTitle>
          <SheetDescription>Account metadata, memberships and recent security activity.</SheetDescription>
        </SheetHeader>
        <SheetBody>
          {!d || d.user.id !== userId ? (
            <div className="space-y-3"><Skeleton className="h-16" /><Skeleton className="h-24" /><Skeleton className="h-40" /></div>
          ) : (
            <div className="space-y-6">
              <div className="flex items-center gap-3.5">
                <Monogram name={d.user.full_name} size={44} round />
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-2 text-[15px] font-semibold">{d.user.full_name} {admin && <ShieldCheck className="size-4 text-primary" aria-label="Super admin" />}</p>
                  <CopyId value={d.user.email} className="text-[12px]" />
                </div>
                <StatusPill status={d.user.status} />
              </div>
              <div className="grid grid-cols-4 gap-px overflow-hidden rounded-lg border border-border bg-border">
                {[
                  ["Sessions", formatNumber(d.active_sessions)],
                  ["Orgs", formatNumber(d.memberships.length)],
                  ["Last login", relTime(d.user.last_login_at)],
                  ["Joined", shortDate(d.user.created_at)],
                ].map(([k, v]) => (
                  <div key={k} className="bg-background-subtle px-3 py-2.5">
                    <p className="micro-label text-[9.5px]">{k}</p>
                    <p className="mt-1 truncate font-mono text-[12.5px] tabular text-foreground">{v}</p>
                  </div>
                ))}
              </div>
              <KeyValue items={[
                ["Role", admin ? <span key="r" className="text-primary">Super admin</span> : "User"],
                ["Email verified", d.user.email_verified ? <span key="v" className="text-success">Verified</span> : <span key="v" className="text-warning">Unverified</span>],
                ["Sign-in method", d.user.has_password ? "Password" : "Google only"],
                ["Phone", d.user.phone ?? "—"],
                ["Timezone", <span key="tz" className="font-mono text-[12px]">{d.user.timezone}</span>],
                ["Locale", <span key="l" className="font-mono text-[12px]">{d.user.locale}</span>],
              ]} />
              <section>
                <h3 className="micro-label mb-2">Organizations</h3>
                <ul className="divide-y divide-border rounded-lg border border-border">
                  {d.memberships.map((m) => (
                    <li key={m.organization_id} className="flex items-center gap-3 px-3 py-2.5 text-[13px]">
                      <Monogram name={m.organization_name} size={24} />
                      <Link href={`/admin/organizations/${m.organization_id}`} className="min-w-0 flex-1 truncate font-medium text-foreground hover:text-primary">{m.organization_name}</Link>
                      <span className="font-mono text-[10.5px] uppercase tracking-[0.08em] text-muted-foreground">{m.role}</span>
                      <StatusPill status={m.organization_status} dot={false} />
                    </li>
                  ))}
                  {!d.memberships.length && <li><EmptyLine className="py-5">No memberships</EmptyLine></li>}
                </ul>
              </section>
              <section>
                <h3 className="micro-label mb-2 flex items-center justify-between">Recent activity <Link href={`/admin/audit-logs?actor=${encodeURIComponent(d.user.email)}`} className="normal-case tracking-normal text-primary hover:underline">Full trail →</Link></h3>
                <ol className="relative space-y-0 border-l border-border pl-4">
                  {d.audit.map((a) => (
                    <li key={a.id} className="relative py-1.5">
                      <span aria-hidden className="absolute -left-[19.5px] top-3 size-1.5 rounded-full bg-border-strong" />
                      <div className="flex items-center justify-between gap-3">
                        <code className={cn("truncate font-mono text-[11.5px]", a.action.startsWith("admin.") ? "text-amber" : "text-primary")}>{a.action}</code>
                        <span className="shrink-0 font-mono text-[10.5px] text-subtle-foreground">{stamp(a.created_at, false)}</span>
                      </div>
                      {a.ip_address && <p className="font-mono text-[10.5px] text-subtle-foreground">ip {a.ip_address}</p>}
                    </li>
                  ))}
                  {!d.audit.length && <li className="py-2 text-[12.5px] text-muted-foreground">No recorded activity.</li>}
                </ol>
              </section>
            </div>
          )}
        </SheetBody>
        {d && d.user.id === userId && (
          <SheetFooter className="justify-between">
            {admin ? (
              <p className="font-mono text-[10.5px] uppercase tracking-[0.1em] text-subtle-foreground">Super admin accounts are protected</p>
            ) : (
              <>
                <Button variant="outline" size="sm" onClick={() => onAction(d.user, "revoke-sessions")}><KeyRound /> Revoke sessions</Button>
                {d.user.status === "disabled" ? (
                  <Button size="sm" onClick={() => onAction(d.user, "reactivate")}><RotateCcw /> Reactivate</Button>
                ) : (
                  <Button variant="danger" size="sm" onClick={() => onAction(d.user, "disable")}><Ban /> Disable account</Button>
                )}
              </>
            )}
          </SheetFooter>
        )}
      </SheetContent>
    </Sheet>
  );
}

function UsersInner() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const qc = useQueryClient();
  const me = useMe();
  const selectedUser = params.get("user");
  const [page, setPage] = React.useState(1);
  const [pageSize, setPageSize] = React.useState(25);
  const [q, setQ] = React.useState("");
  const [status, setStatus] = React.useState("");
  const [role, setRole] = React.useState("");
  const [verified, setVerified] = React.useState("");
  React.useEffect(() => setPage(1), [q, status, role, verified, pageSize]);
  const query = useAdmin<AdminPage<UserRow>>("/users", { page, page_size: pageSize, q, status, role, verified });
  const all = useAdmin<AdminPage<UserRow>>("/users", { page_size: 1 });
  const activeC = useAdmin<AdminPage<UserRow>>("/users", { page_size: 1, status: "active" });
  const disabledC = useAdmin<AdminPage<UserRow>>("/users", { page_size: 1, status: "disabled" });
  const d = query.data;
  const { sorted, sort, toggle } = useClientSort(d?.items, {
    name: (u) => u.full_name, status: (u) => u.status, role: (u) => u.platform_role, orgs: (u) => u.organizations, last_login: (u) => u.last_login_at, joined: (u) => u.created_at,
  });
  const ran = React.useRef(false);
  const sel = useSelection(sorted.map((u) => u.id));
  const selectedRows = sorted.filter((u) => sel.selected.has(u.id));
  const openUser = (id: string | null) => router.replace(id ? `${pathname}?user=${id}` : pathname, { scroll: false });

  const [single, setSingle] = React.useState<{ user: UserRow; action: UserAction } | null>(null);
  const [bulk, setBulk] = React.useState<null | UserAction>(null);
  const act = useMutation({
    mutationFn: (reason: string) => adminPost(`/users/${single!.user.id}/${single!.action}`, { reason }),
    onSuccess: () => { toast.success(ACTION_COPY[single!.action].toast); qc.invalidateQueries({ queryKey: ["admin"] }); setSingle(null); },
    onError: (e) => toast.error(errorMessage(e)),
  });

  const myId = me.data?.user.id;
  const skipFor = (u: UserRow, a: UserAction) => {
    if (u.id === myId) return "Your own account";
    if (isSuper(u)) return "Super admin — protected";
    if (a === "disable" && u.status === "disabled") return "Already disabled";
    if (a === "reactivate" && u.status !== "disabled") return "Already active";
    return null;
  };
  const menu = (u: UserRow) => [
    { label: "Open profile", icon: UserRound, onSelect: () => openUser(u.id) },
    { label: "Audit trail", icon: ScrollText, href: `/admin/audit-logs?actor=${encodeURIComponent(u.email)}` },
    { label: "Copy email", icon: AtSign, onSelect: () => { navigator.clipboard?.writeText(u.email); toast.success("Email copied"); } },
    ...(isSuper(u) ? [] : [
      "separator" as const,
      { label: "Revoke sessions…", icon: KeyRound, onSelect: () => setSingle({ user: u, action: "revoke-sessions" }) },
      u.status === "disabled"
        ? { label: "Reactivate…", icon: RotateCcw, onSelect: () => setSingle({ user: u, action: "reactivate" }) }
        : { label: "Disable…", icon: Ban, destructive: true, onSelect: () => setSingle({ user: u, action: "disable" }) },
    ]),
  ];
  const bulkEligible = bulk ? selectedRows.filter((u) => !skipFor(u, bulk)).length : 0;

  return (
    <>
      <SectionHeader title="Users" description="Every account on the platform. Disabling an account revokes all of its sessions immediately; super admin accounts are protected." meta={all.data ? `${formatNumber(all.data.total)} accounts` : undefined} />
      <StatusTabs
        id="user-status"
        className="mb-3 w-fit"
        value={status || "all"}
        onChange={(v) => setStatus(v === "all" ? "" : v)}
        items={[
          { value: "all", label: "All", count: all.data?.total },
          { value: "active", label: "Active", count: activeC.data?.total },
          { value: "disabled", label: "Disabled", count: disabledC.data?.total, tone: "danger" },
        ]}
      />
      <Panel flush>
        <Toolbar right={<SortNote sort={sort} />}>
          <SearchInput value={q} onChange={setQ} placeholder="Search name or email" />
          <FilterSelect value={role} onChange={setRole} placeholder="All roles" options={[{ value: "user", label: "Users" }, { value: "platform_super_admin", label: "Super admins" }]} />
          <FilterSelect value={verified} onChange={setVerified} placeholder="Any verification" options={[{ value: "true", label: "Verified email" }, { value: "false", label: "Unverified" }]} />
          <ClearFilters active={!!(q || role || verified)} onClear={() => { setQ(""); setRole(""); setVerified(""); }} />
        </Toolbar>
        <BulkBar count={sel.count} noun="users selected" onClear={sel.clear}>
          <Button size="xs" variant="danger-soft" onClick={() => setBulk("disable")}><Ban /> Disable</Button>
          <Button size="xs" variant="outline" onClick={() => setBulk("reactivate")}><RotateCcw /> Reactivate</Button>
          <Button size="xs" variant="outline" onClick={() => setBulk("revoke-sessions")}><KeyRound /> Revoke sessions</Button>
        </BulkBar>
        <Responsive
          table={
            <DataTable
              colSpan={9}
              minWidth={980}
              loading={query.isLoading}
              empty={!!d && d.items.length === 0}
              caption="Users"
              head={
                <>
                  <SelectHead all={sel.all} some={sel.some} onToggle={sel.toggleAll} />
                  <Th sortKey="name" sort={sort} onSort={toggle}>User</Th>
                  <Th sortKey="status" sort={sort} onSort={toggle}>Status</Th>
                  <Th sortKey="role" sort={sort} onSort={toggle}>Role</Th>
                  <Th align="right" sortKey="orgs" sort={sort} onSort={toggle}>Orgs</Th>
                  <Th>Email</Th>
                  <Th sortKey="last_login" sort={sort} onSort={toggle}>Last login</Th>
                  <Th sortKey="joined" sort={sort} onSort={toggle}>Joined</Th>
                  <Th srOnly>Actions</Th>
                </>
              }
            >
              {sorted.map((u) => (
                <Row key={u.id} selected={sel.selected.has(u.id)} onClick={() => openUser(u.id)}>
                  <SelectCell checked={sel.selected.has(u.id)} onToggle={() => sel.toggle(u.id)} label={`Select ${u.full_name}`} />
                  <Td>
                    <div className="flex items-center gap-3">
                      <Monogram name={u.full_name} size={28} round />
                      <div className="min-w-0">
                        <p className="flex items-center gap-2 truncate font-medium text-foreground">{u.full_name}<DemoTag show={!!u.is_seed} label="Seed" /></p>
                        <p className="truncate font-mono text-[10.5px] text-muted-foreground">{u.email}</p>
                      </div>
                    </div>
                  </Td>
                  <Td><StatusPill status={u.status} /></Td>
                  <Td>{isSuper(u) ? <span className="inline-flex items-center gap-1.5 font-mono text-[10.5px] uppercase tracking-[0.1em] text-primary"><ShieldCheck className="size-3.5" /> Super admin</span> : <span className="font-mono text-[10.5px] uppercase tracking-[0.1em] text-muted-foreground">User</span>}</Td>
                  <Td align="right" className="font-mono text-[12px]">{u.organizations}</Td>
                  <Td>{u.email_verified ? <span className="font-mono text-[10.5px] uppercase tracking-[0.1em] text-success">Verified</span> : <span className="font-mono text-[10.5px] uppercase tracking-[0.1em] text-warning">Unverified</span>}</Td>
                  <Td className="whitespace-nowrap font-mono text-[11.5px]">{relTime(u.last_login_at)}</Td>
                  <Td className="whitespace-nowrap font-mono text-[11.5px]">{shortDate(u.created_at)}</Td>
                  <Td align="right" onClick={(e) => e.stopPropagation()}><RowMenu items={menu(u)} label={`Actions for ${u.full_name}`} /></Td>
                </Row>
              ))}
            </DataTable>
          }
          cards={
            query.isLoading ? <div className="space-y-2 p-4">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-16" />)}</div>
            : !sorted.length ? <EmptyLine>No users match</EmptyLine>
            : sorted.map((u) => (
              <MobileCard key={u.id} selected={sel.selected.has(u.id)} onClick={() => openUser(u.id)}>
                <div className="flex items-start gap-3">
                  <span onClick={(e) => e.stopPropagation()} className="pt-1"><Checkbox checked={sel.selected.has(u.id)} onCheckedChange={() => sel.toggle(u.id)} aria-label={`Select ${u.full_name}`} /></span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="truncate text-[13.5px] font-medium text-foreground">{u.full_name}</p>
                      {isSuper(u) && <ShieldCheck className="size-3.5 text-primary" />}
                      <span className="ml-auto"><StatusPill status={u.status} /></span>
                    </div>
                    <p className="truncate font-mono text-[10.5px] text-muted-foreground">{u.email}</p>
                    <div className="mt-2.5 grid grid-cols-3 gap-2">
                      <MiniStat label="Orgs">{u.organizations}</MiniStat>
                      <MiniStat label="Login">{relTime(u.last_login_at)}</MiniStat>
                      <MiniStat label="Joined">{shortDate(u.created_at)}</MiniStat>
                    </div>
                  </div>
                  <span onClick={(e) => e.stopPropagation()}><RowMenu items={menu(u)} label={`Actions for ${u.full_name}`} /></span>
                </div>
              </MobileCard>
            ))
          }
        />
        {d && <Pagination page={d.page} pages={d.pages} total={d.total} onPage={setPage} label="users" pageSize={pageSize} onPageSize={setPageSize} />}
      </Panel>

      <UserDrawer userId={selectedUser} onClose={() => openUser(null)} onAction={(user, action) => setSingle({ user, action })} />

      {single && (
        <ReasonDialog
          open
          onOpenChange={(o) => !o && setSingle(null)}
          title={ACTION_COPY[single.action].title(single.user.full_name)}
          description={ACTION_COPY[single.action].desc}
          confirmLabel={ACTION_COPY[single.action].label}
          destructive={single.action !== "reactivate"}
          confirmText={single.action === "disable" ? single.user.email : undefined}
          loading={act.isPending}
          onConfirm={(r) => act.mutate(r)}
        />
      )}
      <BulkActionDialog
        open={bulk !== null}
        onOpenChange={(o) => { if (!o) { setBulk(null); if (ran.current) { sel.clear(); ran.current = false; } } }}
        title={bulk ? `${ACTION_COPY[bulk].label} · ${selectedRows.length} users` : ""}
        description={bulk ? `${ACTION_COPY[bulk].desc} Each account is processed individually and audited. Super admins and your own account are skipped.` : ""}
        destructive={bulk !== "reactivate"}
        phrase={bulk === "disable" ? `DISABLE ${bulkEligible}` : bulk === "revoke-sessions" ? `REVOKE ${bulkEligible}` : undefined}
        confirmLabel={bulk ? ACTION_COPY[bulk].label : ""}
        verb="Applying"
        targets={bulk ? selectedRows.map((u) => ({ id: u.id, label: u.full_name, sub: u.email, skip: skipFor(u, bulk) })) : []}
        run={(id, reason) => adminPost(`/users/${id}/${bulk}`, { reason })}
        onFinished={() => { qc.invalidateQueries({ queryKey: ["admin"] }); ran.current = true; }}
      />
    </>
  );
}

export default function UsersPage() {
  return (
    <React.Suspense fallback={<Skeleton className="h-96 rounded-xl" />}>
      <UsersInner />
    </React.Suspense>
  );
}
