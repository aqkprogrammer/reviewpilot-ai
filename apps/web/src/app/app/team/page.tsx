"use client";
import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { differenceInCalendarDays, formatDistanceToNow } from "date-fns";
import { Check, Mail, MapPin, MoreHorizontal, RotateCw, ShieldCheck, Trash2, UserPlus, X } from "lucide-react";
import { toast } from "sonner";
import { QueryErrorState } from "@/components/billing/plan-gate";
import { Eyebrow, Monogram, Panel, ReadoutStrip } from "@/components/console/kit";
import { ControlledConfirm } from "@/components/settings/controlled-confirm";
import { InviteDialog } from "@/components/team/invite-dialog";
import { LocationPicker } from "@/components/team/location-picker";
import { MATRIX, ROLE_INFO, assignableRoles } from "@/components/team/roles";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Switch } from "@/components/ui/controls";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { PageHeader } from "@/components/ui/page-header";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { EmptyState, Skeleton } from "@/components/ui/states";
import { TBody, TD, TH, THead, TR, Table } from "@/components/ui/table";
import { Reveal, StatusDot } from "@/components/ui/tech";
import { api, errorMessage } from "@/lib/api";
import { meQueryKey, useOrg } from "@/lib/session";
import { cn } from "@/lib/utils";

interface Member { id: string; user_id: string; full_name: string; email: string; avatar_url: string | null; role: string; restrict_to_locations: boolean; location_ids: string[]; last_login_at: string | null; joined_at: string; is_you: boolean }
interface Invitation { id: string; email: string; role: string; location_ids: string[]; expires_at: string; created_at: string }

const ROLE_BADGE: Record<string, "primary" | "info" | "mint" | "neutral" | "amber"> = { owner: "primary", admin: "info", manager: "mint", staff: "neutral", analyst: "amber" };

export default function TeamPage() {
  const { can, orgId, membership, locations } = useOrg();
  const qc = useQueryClient();
  const manage = can("team.manage");
  const [inviting, setInviting] = React.useState(false);
  const [accessFor, setAccessFor] = React.useState<Member | null>(null);
  const [removing, setRemoving] = React.useState<Member | null>(null);
  const members = useQuery({ queryKey: ["team", "members", orgId], queryFn: () => api.get<Member[]>("/team/members") });
  const invites = useQuery({ queryKey: ["team", "invitations", orgId], queryFn: () => api.get<Invitation[]>("/team/invitations"), enabled: manage });
  const invalidate = () => { qc.invalidateQueries({ queryKey: ["team"] }); qc.invalidateQueries({ queryKey: meQueryKey }); };

  const update = useMutation({
    mutationFn: ({ id, body }: { id: string; body: Record<string, unknown> }) => api.patch(`/team/members/${id}`, body),
    onSuccess: () => { toast.success("Member updated"); invalidate(); },
    onError: (e) => toast.error(errorMessage(e)),
  });
  const resend = useMutation({ mutationFn: (id: string) => api.post(`/team/invitations/${id}/resend`), onSuccess: () => toast.success("Invitation resent"), onError: (e) => toast.error(errorMessage(e)) });
  const roles = assignableRoles(membership.role);
  const locName = (id: string) => locations.find((l) => l.id === id)?.name ?? "Unknown";
  const list = members.data ?? [];
  const scoped = list.filter((m) => m.restrict_to_locations && !["owner", "admin"].includes(m.role)).length;
  const roleKeys = Object.keys(ROLE_INFO);

  return (
    <div className="space-y-5">
      <PageHeader
        className="mb-0"
        eyebrow={<Eyebrow parts={["Manage", "Access control"]} />}
        title="Team members"
        description="Invite colleagues and control what each role can see and do. Permissions are enforced on the server."
        actions={manage && <Button onClick={() => setInviting(true)}><UserPlus /> Invite member</Button>}
      />

      {members.data && (
        <ReadoutStrip
          items={[
            { label: "Members", value: list.length, tone: "signal" },
            ...(manage ? [{ label: "Pending invites", value: invites.data?.length ?? "—", tone: invites.data?.length ? ("warn" as const) : ("muted" as const) }] : []),
            { label: "Location-scoped", value: scoped, tone: "muted" },
            { label: "Your role", value: ROLE_INFO[membership.role]?.label ?? membership.role },
          ]}
        />
      )}

      <Panel index="01" label="Roster" title="Members" flush actions={<span className="font-mono text-[10.5px] uppercase tracking-[0.12em] text-subtle-foreground">{list.length} seats used</span>}>
        {members.isLoading ? (
          <div className="space-y-3 p-5">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-12" />)}</div>
        ) : members.error ? (
          <QueryErrorState error={members.error} onRetry={() => members.refetch()} />
        ) : (
          <Table>
            <THead><TR className="hover:bg-transparent"><TH>Member</TH><TH>Role</TH><TH className="hidden md:table-cell">Location access</TH><TH className="hidden lg:table-cell">Last active</TH><TH className="w-12"><span className="sr-only">Actions</span></TH></TR></THead>
            <TBody>
              {list.map((m) => {
                const editable = manage && !m.is_you && (membership.role === "owner" || !["owner", "admin"].includes(m.role));
                const recent = !!m.last_login_at && Date.now() - new Date(m.last_login_at).getTime() < 24 * 60 * 60 * 1000;
                return (
                  <TR key={m.id}>
                    <TD>
                      <div className="flex items-center gap-3">
                        <Monogram name={m.full_name} src={m.avatar_url} size={32} />
                        <div className="min-w-0">
                          <p className="flex items-center gap-2 truncate font-medium text-foreground">{m.full_name}{m.is_you && <Badge size="sm" variant="primary" mono>You</Badge>}</p>
                          <p className="max-w-[200px] truncate text-xs text-muted-foreground sm:max-w-none">{m.email}</p>
                        </div>
                      </div>
                    </TD>
                    <TD>
                      {editable && roles.length ? (
                        <Select value={m.role} onValueChange={(role) => update.mutate({ id: m.id, body: { role } })}>
                          <SelectTrigger size="sm" className="w-32" aria-label={`Role for ${m.full_name}`}><SelectValue /></SelectTrigger>
                          <SelectContent>{Array.from(new Set([m.role, ...roles])).map((r) => <SelectItem key={r} value={r} disabled={!roles.includes(r)}>{ROLE_INFO[r]?.label ?? r}</SelectItem>)}</SelectContent>
                        </Select>
                      ) : (
                        <Badge variant={ROLE_BADGE[m.role] ?? "neutral"} mono size="sm">{ROLE_INFO[m.role]?.label ?? m.role}</Badge>
                      )}
                    </TD>
                    <TD className="hidden md:table-cell">
                      {["owner", "admin"].includes(m.role) || !m.restrict_to_locations ? (
                        <span className="font-mono text-[10.5px] uppercase tracking-[0.1em] text-muted-foreground">All locations</span>
                      ) : (
                        <div className="flex flex-wrap gap-1">{m.location_ids.map((id) => <Badge key={id} size="sm" variant="outline"><MapPin />{locName(id)}</Badge>)}</div>
                      )}
                    </TD>
                    <TD className="hidden lg:table-cell">
                      <span className="flex items-center gap-2 font-mono text-[11px] text-muted-foreground">
                        <StatusDot tone={recent ? "ok" : "idle"} label={recent ? "Active in the last 24 hours" : undefined} />
                        {m.last_login_at ? formatDistanceToNow(new Date(m.last_login_at), { addSuffix: true }) : "never"}
                      </span>
                    </TD>
                    <TD>
                      {editable && (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild><Button variant="ghost" size="icon-sm" aria-label={`Actions for ${m.full_name}`}><MoreHorizontal /></Button></DropdownMenuTrigger>
                          <DropdownMenuContent>
                            {!["owner", "admin"].includes(m.role) && <DropdownMenuItem onSelect={() => setAccessFor(m)}><MapPin /> Location access</DropdownMenuItem>}
                            <DropdownMenuItem destructive onSelect={() => setRemoving(m)}><Trash2 /> Remove from team</DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )}
                    </TD>
                  </TR>
                );
              })}
            </TBody>
          </Table>
        )}
      </Panel>

      {manage && (
        <Reveal>
          <Panel index="02" label="Queue" title="Pending invitations" description="Invitations expire after 7 days" flush>
            {invites.isLoading ? <div className="p-5"><Skeleton className="h-12" /></div> : !invites.data?.length ? (
              <EmptyState compact icon={Mail} title="No pending invitations" description="Invite managers and staff so they can reply to reviews and run campaigns." action={<Button variant="outline" size="sm" onClick={() => setInviting(true)}><UserPlus /> Invite member</Button>} />
            ) : (
              <ul className="divide-y divide-border">
                {invites.data.map((i) => {
                  const days = differenceInCalendarDays(new Date(i.expires_at), new Date());
                  const expired = new Date(i.expires_at) < new Date();
                  return (
                    <li key={i.id} className="flex flex-col gap-3 px-5 py-3.5 sm:flex-row sm:items-center">
                      <span className="flex size-8 shrink-0 items-center justify-center rounded-md border border-dashed border-border-strong text-muted-foreground"><Mail className="size-3.5" /></span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[13px] font-medium">{i.email}</p>
                        <p className="mt-0.5 flex flex-wrap items-center gap-x-2 font-mono text-[10.5px] uppercase tracking-[0.08em] text-subtle-foreground">
                          <span className="text-muted-foreground">{ROLE_INFO[i.role]?.label}</span>
                          <span>·</span>
                          {expired ? <span className="text-danger-foreground">Expired</span> : <span className={days <= 1 ? "text-warning-foreground" : undefined}>Expires in {days}d</span>}
                          {i.location_ids.length > 0 && <><span>·</span><span>{i.location_ids.length} location{i.location_ids.length > 1 ? "s" : ""}</span></>}
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm" loading={resend.isPending && resend.variables === i.id} onClick={() => resend.mutate(i.id)}><RotateCw /> Resend</Button>
                        <ConfirmDialog title="Revoke invitation?" description={`The link sent to ${i.email} will stop working.`} confirmLabel="Revoke" destructive
                          onConfirm={async () => { try { await api.delete(`/team/invitations/${i.id}`); toast.success("Invitation revoked"); invalidate(); } catch (e) { toast.error(errorMessage(e)); } }}
                          trigger={<Button variant="ghost" size="sm"><X /> Revoke</Button>} />
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </Panel>
        </Reveal>
      )}

      <Reveal>
        <Panel index={manage ? "03" : "02"} label="Policy" title="What each role can do" icon={ShieldCheck} flush description="Roles are checked on every API request — hiding a button is never the only protection.">
          <div className="overflow-x-auto scrollbar-thin">
            <table className="w-full min-w-[600px] border-collapse text-[13px]">
              <thead>
                <tr className="border-b border-border">
                  <th className="h-10 bg-background-subtle/60 px-5 text-left font-mono text-[10px] font-medium uppercase tracking-[0.12em] text-subtle-foreground">Capability</th>
                  {roleKeys.map((r) => (
                    <th key={r} className={cn("relative h-10 px-3 text-center font-mono text-[10px] font-medium uppercase tracking-[0.12em]", r === membership.role ? "bg-primary-soft text-primary" : "bg-background-subtle/60 text-subtle-foreground")}>
                      {r === membership.role && <span aria-hidden className="absolute inset-x-0 top-0 h-[2px] bg-primary shadow-[0_0_8px_var(--primary)]" />}
                      {ROLE_INFO[r].label}
                      {r === membership.role && <span className="sr-only"> (your role)</span>}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {MATRIX.map((row) => (
                  <tr key={row.label} className="border-b border-border transition-colors last:border-0 hover:bg-surface-hover/50">
                    <td className="px-5 py-2.5 text-foreground-soft">{row.label}</td>
                    {roleKeys.map((r) => (
                      <td key={r} className={cn("px-3 py-2.5 text-center", r === membership.role && "bg-primary-soft/50")}>
                        {row.roles.includes(r) ? (
                          <span className="inline-flex size-5 items-center justify-center rounded-[4px] bg-success-soft text-success-foreground" aria-label="Allowed"><Check className="size-3" strokeWidth={3} /></span>
                        ) : <span className="font-mono text-subtle-foreground/60" aria-label="Not allowed">·</span>}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      </Reveal>

      <InviteDialog open={inviting} onOpenChange={setInviting} />
      <ControlledConfirm
        open={!!removing}
        onOpenChange={(o) => !o && setRemoving(null)}
        destructive
        title={`Remove ${removing?.full_name ?? "member"}?`}
        description="They lose access to this organization immediately. You can invite them again later."
        confirmLabel="Remove member"
        onConfirm={async () => { if (!removing) return; try { await api.delete(`/team/members/${removing.id}`); toast.success("Member removed"); invalidate(); } catch (e) { toast.error(errorMessage(e)); } }}
      />
      <AccessDialog member={accessFor} onClose={() => setAccessFor(null)} onSave={(body) => accessFor && update.mutate({ id: accessFor.id, body }, { onSuccess: () => setAccessFor(null) })} saving={update.isPending} />
    </div>
  );
}

function AccessDialog({ member, onClose, onSave, saving }: { member: Member | null; onClose: () => void; onSave: (b: Record<string, unknown>) => void; saving: boolean }) {
  const [restrict, setRestrict] = React.useState(false);
  const [locs, setLocs] = React.useState<string[]>([]);
  React.useEffect(() => { if (member) { setRestrict(member.restrict_to_locations); setLocs(member.location_ids); } }, [member]);
  return (
    <Dialog open={!!member} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>Location access</DialogTitle><DialogDescription>Choose which locations {member?.full_name} can work with.</DialogDescription></DialogHeader>
        <div className="space-y-4">
          <label className="flex items-center justify-between gap-3 rounded-lg border border-border bg-background-subtle/60 px-4 py-3 text-[13px]">
            <span><span className="font-medium">Restrict to selected locations</span><span className="mt-0.5 block font-mono text-[10px] uppercase tracking-[0.1em] text-subtle-foreground">{restrict ? `${locs.length} selected` : "All locations"}</span></span>
            <Switch checked={restrict} onCheckedChange={setRestrict} />
          </label>
          {restrict && <LocationPicker value={locs} onChange={setLocs} />}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button loading={saving} disabled={restrict && !locs.length} onClick={() => onSave({ restrict_to_locations: restrict, location_ids: restrict ? locs : [] })}>Save access</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
