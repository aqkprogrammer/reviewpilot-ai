"use client";
import * as React from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Megaphone, MoreHorizontal, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { EmptyState } from "@/components/ui/states";
import { errorMessage } from "@/lib/api";
import { titleCase } from "@/lib/utils";
import { AnnouncementDialog, type AnnouncementRow } from "@/components/admin/announcement-dialog";
import { ControlledConfirm } from "@/components/admin/reason-dialog";
import { DataTable, Panel, Row, SectionHeader, StatusPill, Td, Th, adminDelete, adminPost, relTime, shortDate, useAdmin } from "@/components/admin/ui";

export default function AnnouncementsPage() {
  const qc = useQueryClient();
  const q = useAdmin<AnnouncementRow[]>("/announcements");
  const [editing, setEditing] = React.useState<AnnouncementRow | null>(null);
  const [open, setOpen] = React.useState(false);
  const [deleting, setDeleting] = React.useState<AnnouncementRow | null>(null);
  const done = (msg: string) => { toast.success(msg); qc.invalidateQueries({ queryKey: ["admin", "/announcements"] }); };
  const publish = useMutation({
    mutationFn: ({ id, on }: { id: string; on: boolean }) => adminPost(`/announcements/${id}/publish?publish=${on}`),
    onSuccess: (_, v) => done(v.on ? "Published" : "Unpublished"),
    onError: (e) => toast.error(errorMessage(e)),
  });
  const status = (a: AnnouncementRow) => {
    if (!a.published_at) return "draft";
    if (a.ends_at && new Date(a.ends_at) < new Date()) return "expired";
    if (a.starts_at && new Date(a.starts_at) > new Date()) return "scheduled";
    return "published";
  };
  return (
    <>
      <SectionHeader eyebrow="Engagement" title="Announcements" description="In-app banners for all users, selected organizations or plan tiers." actions={<Button size="sm" onClick={() => { setEditing(null); setOpen(true); }}><Plus /> New announcement</Button>} />
      <Panel flush bodyClassName="mt-0">
        <DataTable colSpan={6} loading={q.isLoading}
          empty={q.data && !q.data.length ? <EmptyState compact icon={Megaphone} title="No announcements yet" description="Let customers know about maintenance, launches or policy changes." action={<Button size="sm" onClick={() => setOpen(true)}><Plus /> New announcement</Button>} /> : false}
          head={<><Th>Announcement</Th><Th>Level</Th><Th>Audience</Th><Th>Status</Th><Th>Window</Th><Th /></>}>
          {q.data?.map((a) => (
            <Row key={a.id}>
              <Td><p className="font-medium text-foreground">{a.title}</p><p className="max-w-md truncate text-[12px] text-muted-foreground">{a.body}</p></Td>
              <Td><StatusPill status={a.level} /></Td>
              <Td>{a.audience === "all" ? "Everyone" : a.audience === "plans" ? `Plans: ${a.plan_codes.map(titleCase).join(", ")}` : `${a.organization_ids.length} organization(s)`}</Td>
              <Td><StatusPill status={status(a)} /></Td>
              <Td className="text-[12px]">{a.starts_at || a.ends_at ? `${shortDate(a.starts_at)} → ${shortDate(a.ends_at)}` : `Since ${relTime(a.published_at ?? a.created_at)}`}</Td>
              <Td align="right">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild><Button variant="ghost" size="icon-xs" aria-label="Actions"><MoreHorizontal /></Button></DropdownMenuTrigger>
                  <DropdownMenuContent>
                    <DropdownMenuItem onSelect={() => { setEditing(a); setOpen(true); }}>Edit</DropdownMenuItem>
                    <DropdownMenuItem onSelect={() => publish.mutate({ id: a.id, on: !a.published_at })}>{a.published_at ? "Unpublish" : "Publish now"}</DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem destructive onSelect={() => setDeleting(a)}>Delete</DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </Td>
            </Row>
          ))}
        </DataTable>
      </Panel>
      <AnnouncementDialog open={open} onOpenChange={setOpen} initial={editing} />
      <ControlledConfirm
        open={!!deleting}
        onOpenChange={(o) => !o && setDeleting(null)}
        title={`Delete “${deleting?.title ?? ""}”?`}
        description="It disappears for all users immediately. This can't be undone."
        confirmLabel="Delete"
        destructive
        onConfirm={async () => { try { await adminDelete(`/announcements/${deleting!.id}`); done("Announcement deleted"); } catch (e) { toast.error(errorMessage(e)); } }}
      />
    </>
  );
}
