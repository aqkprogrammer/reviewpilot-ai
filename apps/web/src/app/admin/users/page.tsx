"use client";
import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Ban, KeyRound, RotateCcw, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar } from "@/components/ui/controls";
import { Sheet, SheetBody, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/states";
import { errorMessage } from "@/lib/api";
import { titleCase } from "@/lib/utils";
import { ReasonDialog } from "@/components/admin/reason-dialog";
import { DataTable, FilterBar, FilterSelect, KeyValue, Pagination, Panel, Row, SearchInput, SectionHeader, StatusPill, Td, Th, adminPost, relTime, shortDate, useAdmin, type AdminPage } from "@/components/admin/ui";

interface UserRow { id: string; email: string; full_name: string; avatar_url: string | null; platform_role: string; status: string; email_verified: boolean; last_login_at: string | null; created_at: string; organizations: number }
interface UserDetail {
  user: UserRow & { phone: string | null; timezone: string; locale: string; has_password: boolean };
  memberships: { organization_id: string; organization_name: string; role: string; organization_status: string; joined_at: string }[];
  active_sessions: number;
  audit: { id: string; action: string; created_at: string; ip_address: string | null }[];
}

function UserDrawer({ userId, onClose }: { userId: string | null; onClose: () => void }) {
  const qc = useQueryClient();
  const q = useAdmin<UserDetail>(`/users/${userId}`, undefined, { enabled: !!userId });
  const [action, setAction] = React.useState<null | "disable" | "reactivate" | "revoke-sessions">(null);
  const act = useMutation({
    mutationFn: (reason: string) => adminPost(`/users/${userId}/${action}`, { reason }),
    onSuccess: () => {
      toast.success(action === "disable" ? "Account disabled and sessions revoked" : action === "reactivate" ? "Account reactivated" : "Sessions revoked");
      qc.invalidateQueries({ queryKey: ["admin"] });
      setAction(null);
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
  const d = q.data;
  const isAdmin = d?.user.platform_role === "platform_super_admin";
  return (
    <Sheet open={!!userId} onOpenChange={(o) => !o && onClose()}>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>User profile</SheetTitle>
          <SheetDescription>Account metadata, memberships and recent security activity.</SheetDescription>
        </SheetHeader>
        <SheetBody>
          {!d ? (
            <div className="space-y-3"><Skeleton className="h-14" /><Skeleton className="h-40" /><Skeleton className="h-40" /></div>
          ) : (
            <div className="space-y-6">
              <div className="flex items-center gap-3.5">
                <Avatar name={d.user.full_name} src={d.user.avatar_url} size={48} />
                <div className="min-w-0">
                  <p className="flex items-center gap-2 text-[15px] font-semibold">{d.user.full_name} {isAdmin && <ShieldCheck className="size-4 text-[#7eaaff]" />}</p>
                  <p className="truncate text-[13px] text-muted-foreground">{d.user.email}</p>
                </div>
                <span className="ml-auto"><StatusPill status={d.user.status} /></span>
              </div>
              <KeyValue items={[
                ["Role", isAdmin ? "Super Admin" : "User"], ["Email verified", d.user.email_verified ? "Yes" : "No"], ["Sign-in method", d.user.has_password ? "Password" : "Google only"],
                ["Active sessions", d.active_sessions], ["Last login", relTime(d.user.last_login_at)], ["Joined", shortDate(d.user.created_at)], ["Phone", d.user.phone ?? "—"], ["Timezone", d.user.timezone],
              ]} />
              <div>
                <h3 className="mb-2 font-mono text-[10.5px] uppercase tracking-[0.12em] text-subtle-foreground">Organizations</h3>
                <ul className="divide-y divide-border rounded-xl border border-border">
                  {d.memberships.map((m) => (
                    <li key={m.organization_id} className="flex items-center justify-between gap-3 px-4 py-2.5 text-[13px]">
                      <Link href={`/admin/organizations/${m.organization_id}`} className="font-medium text-foreground hover:underline">{m.organization_name}</Link>
                      <span className="flex items-center gap-2 text-muted-foreground">{titleCase(m.role)} <StatusPill status={m.organization_status} /></span>
                    </li>
                  ))}
                  {!d.memberships.length && <li className="px-4 py-3 text-[13px] text-muted-foreground">No memberships.</li>}
                </ul>
              </div>
              <div>
                <h3 className="mb-2 font-mono text-[10.5px] uppercase tracking-[0.12em] text-subtle-foreground">Recent activity</h3>
                <ul className="space-y-2">
                  {d.audit.map((a) => (
                    <li key={a.id} className="flex items-center justify-between gap-3 text-[12.5px]">
                      <span className="font-mono text-foreground-soft">{a.action}</span>
                      <span className="text-subtle-foreground">{a.ip_address ?? ""} · {relTime(a.created_at)}</span>
                    </li>
                  ))}
                  {!d.audit.length && <li className="text-[13px] text-muted-foreground">No recorded activity.</li>}
                </ul>
              </div>
            </div>
          )}
        </SheetBody>
        {d && !isAdmin && (
          <SheetFooter>
            <Button variant="outline" size="sm" onClick={() => setAction("revoke-sessions")}><KeyRound /> Revoke sessions</Button>
            {d.user.status === "disabled" ? (
              <Button size="sm" onClick={() => setAction("reactivate")}><RotateCcw /> Reactivate</Button>
            ) : (
              <Button variant="danger" size="sm" onClick={() => setAction("disable")}><Ban /> Disable account</Button>
            )}
          </SheetFooter>
        )}
        {d && (
          <ReasonDialog
            open={action !== null}
            onOpenChange={(o) => !o && setAction(null)}
            title={action === "disable" ? `Disable ${d.user.full_name}?` : action === "reactivate" ? `Reactivate ${d.user.full_name}?` : "Revoke all sessions?"}
            description={action === "disable" ? "They are signed out everywhere and can't sign in until reactivated." : action === "reactivate" ? "They can sign in again immediately." : "They will need to sign in again on every device."}
            confirmLabel={action === "disable" ? "Disable account" : action === "reactivate" ? "Reactivate" : "Revoke sessions"}
            destructive={action !== "reactivate"}
            confirmText={action === "disable" ? d.user.email : undefined}
            loading={act.isPending}
            onConfirm={(r) => act.mutate(r)}
          />
        )}
      </SheetContent>
    </Sheet>
  );
}

function UsersInner() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const selected = params.get("user");
  const [page, setPage] = React.useState(1);
  const [q, setQ] = React.useState("");
  const [status, setStatus] = React.useState("");
  const [role, setRole] = React.useState("");
  React.useEffect(() => setPage(1), [q, status, role]);
  const query = useAdmin<AdminPage<UserRow>>("/users", { page, page_size: 25, q, status, role });
  const d = query.data;
  const open = (id: string | null) => router.replace(id ? `${pathname}?user=${id}` : pathname, { scroll: false });
  return (
    <>
      <SectionHeader eyebrow="Identity" title="Users" description="Every account on the platform. Disabling an account revokes all of its sessions immediately." />
      <Panel flush bodyClassName="mt-0">
        <FilterBar>
          <SearchInput value={q} onChange={setQ} placeholder="Search name or email" />
          <FilterSelect value={status} onChange={setStatus} placeholder="All statuses" options={opts2(["active", "disabled"])} />
          <FilterSelect value={role} onChange={setRole} placeholder="All roles" options={[{ value: "user", label: "Users" }, { value: "platform_super_admin", label: "Super Admins" }]} />
        </FilterBar>
        <DataTable colSpan={6} loading={query.isLoading} empty={d && d.items.length === 0} head={<><Th>User</Th><Th>Status</Th><Th>Role</Th><Th align="right">Orgs</Th><Th>Last login</Th><Th>Joined</Th></>}>
          {d?.items.map((u) => (
            <Row key={u.id} onClick={() => open(u.id)}>
              <Td>
                <div className="flex items-center gap-3">
                  <Avatar name={u.full_name} src={u.avatar_url} size={30} />
                  <div className="min-w-0">
                    <p className="truncate font-medium text-foreground">{u.full_name}</p>
                    <p className="truncate text-[11.5px] text-muted-foreground">{u.email}{!u.email_verified && " · unverified"}</p>
                  </div>
                </div>
              </Td>
              <Td><StatusPill status={u.status} /></Td>
              <Td>{u.platform_role === "platform_super_admin" ? <span className="inline-flex items-center gap-1 text-[#7eaaff]"><ShieldCheck className="size-3.5" /> Super Admin</span> : "User"}</Td>
              <Td align="right">{u.organizations}</Td>
              <Td>{relTime(u.last_login_at)}</Td>
              <Td>{shortDate(u.created_at)}</Td>
            </Row>
          ))}
        </DataTable>
        {d && <Pagination page={d.page} pages={d.pages} total={d.total} onPage={setPage} label="users" />}
      </Panel>
      <UserDrawer userId={selected} onClose={() => open(null)} />
    </>
  );
}

const opts2 = (v: string[]) => v.map((x) => ({ value: x, label: titleCase(x) }));

export default function UsersPage() {
  return (
    <React.Suspense fallback={<Skeleton className="h-96 rounded-2xl" />}>
      <UsersInner />
    </React.Suspense>
  );
}
