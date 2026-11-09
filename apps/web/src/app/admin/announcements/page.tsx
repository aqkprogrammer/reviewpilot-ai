"use client";
import * as React from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Eye, EyeOff, Info, Megaphone, OctagonAlert, Pencil, Plus, Trash2, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState, Skeleton } from "@/components/ui/states";
import { errorMessage } from "@/lib/api";
import { cn, titleCase } from "@/lib/utils";
import { AnnouncementDialog, BannerPreview, type AnnouncementRow } from "@/components/admin/announcement-dialog";
import { ControlledConfirm } from "@/components/admin/reason-dialog";
import { DataTable, MobileCard, Responsive, Row, RowMenu, SearchInput, SortNote, StatusTabs, Td, Th, Toolbar, useClientSort } from "@/components/admin/table";
import { EmptyLine, Panel, SectionHeader, StatusPill, adminDelete, adminPost, relTime, shortDate, useAdmin } from "@/components/admin/ui";

const lifecycle = (a: AnnouncementRow) => {
  if (!a.published_at) return "draft";
  if (a.ends_at && new Date(a.ends_at) < new Date()) return "expired";
  if (a.starts_at && new Date(a.starts_at) > new Date()) return "scheduled";
  return "published";
};
const LEVEL_ICON = { info: Info, warning: TriangleAlert, critical: OctagonAlert } as const;

export default function AnnouncementsPage() {
  const qc = useQueryClient();
  const q = useAdmin<AnnouncementRow[]>("/announcements");
  const [editing, setEditing] = React.useState<AnnouncementRow | null>(null);
  const [open, setOpen] = React.useState(false);
  const [deleting, setDeleting] = React.useState<AnnouncementRow | null>(null);
  const [preview, setPreview] = React.useState<AnnouncementRow | null>(null);
  const [tab, setTab] = React.useState("all");
  const [search, setSearch] = React.useState("");
  const done = (msg: string) => { toast.success(msg); qc.invalidateQueries({ queryKey: ["admin", "/announcements"] }); };
  const publish = useMutation({
    mutationFn: ({ id, on }: { id: string; on: boolean }) => adminPost(`/announcements/${id}/publish?publish=${on}`),
    onSuccess: (_, v) => done(v.on ? "Published" : "Unpublished"),
    onError: (e) => toast.error(errorMessage(e)),
  });
  const rows = (q.data ?? []).filter((a) => (tab === "all" || lifecycle(a) === tab) && (!search || `${a.title} ${a.body}`.toLowerCase().includes(search.toLowerCase())));
  const { sorted, sort, toggle } = useClientSort(rows, { title: (a) => a.title, level: (a) => ({ critical: 0, warning: 1, info: 2 })[a.level], status: (a) => lifecycle(a), created: (a) => a.created_at });
  const count = (s: string) => (q.data ?? []).filter((a) => s === "all" || lifecycle(a) === s).length;
  const audience = (a: AnnouncementRow) => (a.audience === "all" ? "Everyone" : a.audience === "plans" ? `Plans · ${a.plan_codes.map(titleCase).join(", ")}` : `${a.organization_ids.length} organization${a.organization_ids.length === 1 ? "" : "s"}`);
  const menu = (a: AnnouncementRow) => [
    { label: "Preview banner", icon: Eye, onSelect: () => setPreview(a) },
    { label: "Edit", icon: Pencil, onSelect: () => { setEditing(a); setOpen(true); } },
    { label: a.published_at ? "Unpublish" : "Publish now", icon: a.published_at ? EyeOff : Megaphone, onSelect: () => publish.mutate({ id: a.id, on: !a.published_at }) },
    "separator" as const,
    { label: "Delete…", icon: Trash2, destructive: true, onSelect: () => setDeleting(a) },
  ];
  const empty = <EmptyState compact icon={Megaphone} title={q.data?.length ? "Nothing in this view" : "No announcements yet"} description="Let customers know about maintenance, launches or policy changes." action={<Button size="sm" onClick={() => { setEditing(null); setOpen(true); }}><Plus /> New announcement</Button>} />;

  return (
    <>
      <SectionHeader title="Announcements" description="In-app banners for all users, selected organizations or plan tiers. Publishing, edits and deletion are audited." actions={<Button size="sm" onClick={() => { setEditing(null); setOpen(true); }}><Plus /> New announcement</Button>} meta={q.data ? `${q.data.length} total` : undefined} />
      <StatusTabs id="ann" className="mb-3 w-fit" value={tab} onChange={setTab} items={["all", "published", "scheduled", "draft", "expired"].map((s) => ({ value: s, label: titleCase(s), count: q.data ? count(s) : undefined }))} />
      <Panel flush>
        <Toolbar right={<SortNote sort={sort} />}><SearchInput value={search} onChange={setSearch} placeholder="Search title or message" /></Toolbar>
        <Responsive
          table={
            <DataTable colSpan={7} minWidth={920} loading={q.isLoading} empty={q.data && !sorted.length ? empty : false} caption="Announcements"
              head={<><Th sortKey="title" sort={sort} onSort={toggle}>Announcement</Th><Th sortKey="level" sort={sort} onSort={toggle}>Level</Th><Th>Audience</Th><Th sortKey="status" sort={sort} onSort={toggle}>Status</Th><Th>Window</Th><Th sortKey="created" sort={sort} onSort={toggle}>Created</Th><Th srOnly>Actions</Th></>}>
              {sorted.map((a) => {
                const Icon = LEVEL_ICON[a.level] ?? Info;
                return (
                  <Row key={a.id} onClick={() => setPreview(a)}>
                    <Td className="max-w-[360px]">
                      <div className="flex items-start gap-2.5">
                        <Icon className={cn("mt-0.5 size-4 shrink-0", a.level === "critical" ? "text-danger" : a.level === "warning" ? "text-warning" : "text-ice")} />
                        <div className="min-w-0"><p className="truncate font-medium text-foreground">{a.title}</p><p className="truncate text-[12px] text-muted-foreground">{a.body}</p></div>
                      </div>
                    </Td>
                    <Td><StatusPill status={a.level} dot={false} /></Td>
                    <Td className="text-[12.5px]">{audience(a)}</Td>
                    <Td><StatusPill status={lifecycle(a)} /></Td>
                    <Td className="whitespace-nowrap font-mono text-[11px]">{a.starts_at || a.ends_at ? `${shortDate(a.starts_at)} → ${shortDate(a.ends_at)}` : "Open-ended"}</Td>
                    <Td className="whitespace-nowrap font-mono text-[11px]">{relTime(a.created_at)}</Td>
                    <Td align="right" onClick={(e) => e.stopPropagation()}><RowMenu items={menu(a)} label={`Actions for ${a.title}`} /></Td>
                  </Row>
                );
              })}
            </DataTable>
          }
          cards={
            q.isLoading ? <div className="space-y-2 p-4"><Skeleton className="h-16" /><Skeleton className="h-16" /></div>
            : !sorted.length ? <EmptyLine>No announcements in this view</EmptyLine>
            : sorted.map((a) => (
              <MobileCard key={a.id} onClick={() => setPreview(a)}>
                <div className="flex items-center gap-2"><p className="min-w-0 flex-1 truncate text-[13.5px] font-medium text-foreground">{a.title}</p><StatusPill status={lifecycle(a)} /><span onClick={(e) => e.stopPropagation()}><RowMenu items={menu(a)} /></span></div>
                <p className="truncate font-mono text-[10.5px] uppercase text-subtle-foreground">{a.level} · {audience(a)}</p>
              </MobileCard>
            ))
          }
        />
      </Panel>

      {preview && (
        <Panel className="mt-4" title="Banner preview" description={`${preview.title} · ${audience(preview)}`} actions={<Button variant="ghost" size="xs" onClick={() => setPreview(null)}>Close</Button>}>
          <BannerPreview level={preview.level} title={preview.title} body={preview.body} dismissible={preview.dismissible} />
          <p className="mt-2 font-mono text-[10.5px] uppercase tracking-[0.1em] text-subtle-foreground">{preview.dismissible ? "Users can dismiss" : "Not dismissible"} · {lifecycle(preview)}</p>
        </Panel>
      )}

      <AnnouncementDialog open={open} onOpenChange={setOpen} initial={editing} />
      <ControlledConfirm
        open={!!deleting}
        onOpenChange={(o) => !o && setDeleting(null)}
        title={`Delete “${deleting?.title ?? ""}”?`}
        description="It disappears for all users immediately. This can't be undone."
        confirmLabel="Delete"
        destructive
        onConfirm={async () => { try { await adminDelete(`/announcements/${deleting!.id}`); done("Announcement deleted"); setPreview(null); } catch (e) { toast.error(errorMessage(e)); } }}
      />
    </>
  );
}
