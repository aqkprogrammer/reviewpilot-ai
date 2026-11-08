"use client";
import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Building2, Clock, LoaderCircle, LogOut, ShieldAlert, UserPlus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { InlineAlert } from "@/components/ui/states";
import { ApiError, api, setActiveOrgId } from "@/lib/api";
import { logout, meQueryKey, useMe } from "@/lib/session";
import { titleCase } from "@/lib/utils";
import { AuthHeading } from "./auth-shell";
import { StatusIcon } from "./recovery";

interface Preview { organization_name: string; role: string; email: string; expired: boolean }

export function InviteView() {
  const params = useSearchParams();
  const router = useRouter();
  const qc = useQueryClient();
  const token = params.get("token") ?? "";
  const me = useMe();
  const preview = useQuery({
    queryKey: ["invite", token],
    queryFn: () => api.get<Preview>(`/team/invitations/preview/${encodeURIComponent(token)}`, undefined, { orgId: null }),
    enabled: !!token,
    retry: false,
  });
  const [accepting, setAccepting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const next = `/invite?token=${encodeURIComponent(token)}`;

  if (!token || preview.isError) {
    return (
      <div>
        <StatusIcon icon={ShieldAlert} tone="danger" />
        <AuthHeading title="Invitation not found" description="This invitation link is invalid, was revoked, or has already been used. Ask your team admin to send a new one." />
        <Button asChild variant="outline" size="lg" className="w-full"><Link href="/login">Go to sign in</Link></Button>
      </div>
    );
  }
  if (preview.isLoading || me.isLoading) {
    return <div className="flex justify-center py-16"><LoaderCircle className="size-7 animate-spin text-primary" /></div>;
  }
  const inv = preview.data!;
  const signedIn = !!me.data;
  const mismatch = signedIn && me.data!.user.email.toLowerCase() !== inv.email.toLowerCase();

  const accept = async () => {
    setAccepting(true);
    setError(null);
    try {
      const res = await api.post<{ message: string }>("/team/invitations/accept", { token }, { orgId: null });
      setActiveOrgId(res.message);
      await qc.invalidateQueries({ queryKey: meQueryKey });
      toast.success(`You've joined ${inv.organization_name}`);
      router.replace("/app");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not accept the invitation.");
      setAccepting(false);
    }
  };

  return (
    <div>
      <StatusIcon icon={UserPlus} />
      <AuthHeading title={`Join ${inv.organization_name}`} description="You've been invited to collaborate on ReviewPilot AI." />
      <div className="mb-6 rounded-2xl border border-border bg-background-subtle p-4">
        <div className="flex items-center gap-3">
          <span className="flex size-10 items-center justify-center rounded-xl bg-[linear-gradient(135deg,var(--primary),var(--blue))] text-white"><Building2 className="size-5" /></span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[14px] font-semibold">{inv.organization_name}</p>
            <p className="truncate text-xs text-muted-foreground">Invited: {inv.email}</p>
          </div>
          <Badge variant="primary">{titleCase(inv.role)}</Badge>
        </div>
      </div>
      {inv.expired ? (
        <InlineAlert variant="warning" icon={Clock} title="This invitation has expired">Ask your team admin to resend it.</InlineAlert>
      ) : !signedIn ? (
        <div className="space-y-3">
          <Button asChild size="lg" className="w-full"><Link href={`/login?next=${encodeURIComponent(next)}&email=${encodeURIComponent(inv.email)}`}>Sign in to accept</Link></Button>
          <Button asChild variant="outline" size="lg" className="w-full"><Link href={`/signup?next=${encodeURIComponent(next)}&email=${encodeURIComponent(inv.email)}`}>Create an account with {inv.email}</Link></Button>
        </div>
      ) : mismatch ? (
        <div className="space-y-4">
          <InlineAlert variant="warning" icon={ShieldAlert} title="Signed in with a different email">
            You&apos;re signed in as {me.data!.user.email}, but this invitation was sent to {inv.email}.
          </InlineAlert>
          <Button variant="outline" size="lg" className="w-full" onClick={() => logout()}><LogOut /> Sign out and switch account</Button>
        </div>
      ) : (
        <div className="space-y-3">
          {error && <InlineAlert variant="danger" icon={ShieldAlert}>{error}</InlineAlert>}
          <Button size="lg" className="w-full" loading={accepting} onClick={accept}>Accept invitation</Button>
        </div>
      )}
    </div>
  );
}
