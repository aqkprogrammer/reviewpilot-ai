"use client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Archive, Copy, MoreHorizontal, Pause, Play, Rocket } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { api, errorMessage } from "@/lib/api";
import type { Campaign } from "./shared";

export function useCampaignAction() {
  const qc = useQueryClient();
  const router = useRouter();
  return useMutation({
    mutationFn: ({ id, action }: { id: string; action: "pause" | "resume" | "duplicate" | "archive" | "launch" }) => api.post<Campaign>(`/campaigns/${id}/${action}`),
    onSuccess: (c, { action }) => {
      qc.invalidateQueries({ queryKey: ["campaigns"] });
      qc.invalidateQueries({ queryKey: ["campaign", c.id] });
      const msg = { pause: "Campaign paused", resume: "Campaign resumed", duplicate: "Campaign duplicated as draft", archive: "Campaign archived", launch: "Campaign launched" }[action];
      toast.success(msg);
      if (action === "duplicate") router.push(`/app/campaigns/${c.id}`);
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
}

export function CampaignActions({ campaign, variant = "menu" }: { campaign: Campaign; variant?: "menu" | "buttons" }) {
  const m = useCampaignAction();
  const run = (action: "pause" | "resume" | "duplicate" | "archive" | "launch") => m.mutate({ id: campaign.id, action });
  const canPause = campaign.status === "active" || campaign.status === "scheduled";
  const canResume = campaign.status === "paused";
  const canLaunch = campaign.status === "draft";
  const archive = (
    <ConfirmDialog
      title={`Archive “${campaign.name}”?`}
      description="Archived campaigns stop sending reminders and are hidden from the list. Request history and analytics are kept."
      confirmLabel="Archive campaign"
      destructive
      onConfirm={async () => { await m.mutateAsync({ id: campaign.id, action: "archive" }).catch(() => undefined); }}
      trigger={variant === "menu" ? <DropdownMenuItem destructive onSelect={(e) => e.preventDefault()}><Archive /> Archive</DropdownMenuItem> : <Button variant="ghost" size="sm" disabled={campaign.status === "archived"}><Archive /> Archive</Button>}
    />
  );

  if (variant === "buttons") {
    return (
      <div className="flex flex-wrap gap-2">
        {canLaunch && <Button size="sm" onClick={() => run("launch")} loading={m.isPending}><Rocket /> Launch</Button>}
        {canPause && <Button variant="outline" size="sm" onClick={() => run("pause")} loading={m.isPending}><Pause /> Pause</Button>}
        {canResume && <Button size="sm" onClick={() => run("resume")} loading={m.isPending}><Play /> Resume</Button>}
        <Button variant="outline" size="sm" onClick={() => run("duplicate")} disabled={m.isPending}><Copy /> Duplicate</Button>
        {campaign.status !== "archived" && archive}
      </div>
    );
  }
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon-sm" aria-label={`Actions for ${campaign.name}`} onClick={(e) => e.stopPropagation()}><MoreHorizontal /></Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent onClick={(e) => e.stopPropagation()}>
        {canLaunch && <DropdownMenuItem onSelect={() => run("launch")}><Rocket /> Launch</DropdownMenuItem>}
        {canPause && <DropdownMenuItem onSelect={() => run("pause")}><Pause /> Pause</DropdownMenuItem>}
        {canResume && <DropdownMenuItem onSelect={() => run("resume")}><Play /> Resume</DropdownMenuItem>}
        <DropdownMenuItem onSelect={() => run("duplicate")}><Copy /> Duplicate</DropdownMenuItem>
        {campaign.status !== "archived" && (<><DropdownMenuSeparator />{archive}</>)}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
