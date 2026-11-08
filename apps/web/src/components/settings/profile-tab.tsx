"use client";
import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import { KeyRound, Laptop, MailCheck, Monitor, Smartphone } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar } from "@/components/ui/controls";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { InlineAlert, Skeleton } from "@/components/ui/states";
import { api, errorMessage } from "@/lib/api";
import { meQueryKey, useOrg } from "@/lib/session";

interface Session { id: string; created_at: string; last_used_at: string | null; expires_at: string; ip_address: string | null; user_agent: string | null; current: boolean }

function device(ua: string | null) {
  const u = (ua ?? "").toLowerCase();
  const os = u.includes("iphone") ? "iPhone" : u.includes("android") ? "Android" : u.includes("mac os") ? "macOS" : u.includes("windows") ? "Windows" : u.includes("linux") ? "Linux" : "Unknown device";
  const br = u.includes("edg/") ? "Edge" : u.includes("chrome") ? "Chrome" : u.includes("firefox") ? "Firefox" : u.includes("safari") ? "Safari" : ua ? "Browser" : "";
  return { label: [br, os].filter(Boolean).join(" on "), icon: u.includes("iphone") || u.includes("android") ? Smartphone : u ? Laptop : Monitor };
}

export function ProfileTab() {
  const { me } = useOrg();
  const qc = useQueryClient();
  const [name, setName] = React.useState(me.user.full_name);
  const [phone, setPhone] = React.useState(me.user.phone ?? "");
  const [pw, setPw] = React.useState({ current: "", next: "", confirm: "" });
  const [pwErr, setPwErr] = React.useState<string | null>(null);
  const sessions = useQuery({ queryKey: ["auth", "sessions"], queryFn: () => api.get<Session[]>("/auth/sessions", undefined, { orgId: null }) });

  const profile = useMutation({
    mutationFn: () => api.patch("/auth/me", { full_name: name, phone: phone || null }, { orgId: null }),
    onSuccess: () => { toast.success("Profile updated"); qc.invalidateQueries({ queryKey: meQueryKey }); },
    onError: (e) => toast.error(errorMessage(e)),
  });
  const changePw = useMutation({
    mutationFn: () => api.post("/auth/change-password", { current_password: me.user.has_password ? pw.current : null, new_password: pw.next }, { orgId: null }),
    onSuccess: () => { toast.success("Password changed. Other sessions were signed out."); setPw({ current: "", next: "", confirm: "" }); qc.invalidateQueries({ queryKey: ["auth"] }); },
    onError: (e) => setPwErr(errorMessage(e)),
  });
  const resend = useMutation({ mutationFn: () => api.post("/auth/resend-verification", undefined, { orgId: null }), onSuccess: () => toast.success("Verification email sent"), onError: (e) => toast.error(errorMessage(e)) });
  const revoke = useMutation({ mutationFn: (id: string) => api.delete(`/auth/sessions/${id}`, { orgId: null }), onSuccess: () => { toast.success("Session signed out"); sessions.refetch(); }, onError: (e) => toast.error(errorMessage(e)) });

  const submitPw = (e: React.FormEvent) => {
    e.preventDefault();
    if (pw.next.length < 8 || !/[A-Za-z]/.test(pw.next) || !/\d/.test(pw.next)) return setPwErr("Use at least 8 characters with letters and numbers.");
    if (pw.next !== pw.confirm) return setPwErr("Passwords don't match.");
    setPwErr(null);
    changePw.mutate();
  };

  return (
    <div className="space-y-6">
      {!me.user.email_verified && (
        <InlineAlert variant="info" icon={MailCheck} title="Verify your email" action={<Button size="sm" variant="outline" loading={resend.isPending} onClick={() => resend.mutate()}>Resend link</Button>}>
          We sent a verification link to {me.user.email}. Verification protects your account and is required for some integrations.
        </InlineAlert>
      )}
      <Card>
        <CardHeader><div><CardTitle>Your profile</CardTitle><CardDescription>Visible to teammates in your organizations</CardDescription></div></CardHeader>
        <CardContent>
          <form onSubmit={(e) => { e.preventDefault(); profile.mutate(); }} className="space-y-4">
            <div className="flex items-center gap-4">
              <Avatar name={me.user.full_name} src={me.user.avatar_url} size={52} />
              <div>
                <p className="flex items-center gap-2 text-[13px] font-medium">{me.user.email}{me.user.email_verified ? <Badge size="sm" variant="success" dot>Verified</Badge> : <Badge size="sm" variant="warning" dot>Unverified</Badge>}</p>
                <p className="text-xs text-muted-foreground">Email changes require contacting support.</p>
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField label="Full name" htmlFor="p-name"><Input id="p-name" value={name} onChange={(e) => setName(e.target.value)} /></FormField>
              <FormField label="Phone" htmlFor="p-phone"><Input id="p-phone" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+91" /></FormField>
            </div>
            <div className="flex justify-end"><Button type="submit" size="sm" disabled={name.trim().length < 2} loading={profile.isPending}>Save profile</Button></div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><div><CardTitle className="flex items-center gap-2"><KeyRound className="size-4 text-muted-foreground" />{me.user.has_password ? "Change password" : "Set a password"}</CardTitle><CardDescription>{me.user.has_password ? "Changing your password signs out every other session." : "You signed up with Google. Add a password to also sign in with email."}</CardDescription></div></CardHeader>
        <CardContent>
          <form onSubmit={submitPw} className="grid gap-4 sm:grid-cols-3" noValidate>
            {me.user.has_password && <FormField label="Current password" htmlFor="pw-cur"><Input id="pw-cur" type="password" autoComplete="current-password" value={pw.current} onChange={(e) => setPw({ ...pw, current: e.target.value })} /></FormField>}
            <FormField label="New password" htmlFor="pw-new"><Input id="pw-new" type="password" autoComplete="new-password" value={pw.next} onChange={(e) => setPw({ ...pw, next: e.target.value })} /></FormField>
            <FormField label="Confirm new password" htmlFor="pw-conf"><Input id="pw-conf" type="password" autoComplete="new-password" value={pw.confirm} onChange={(e) => setPw({ ...pw, confirm: e.target.value })} /></FormField>
            {pwErr && <p className="text-xs font-medium text-danger-foreground sm:col-span-3" role="alert">{pwErr}</p>}
            <div className="flex justify-end sm:col-span-3"><Button type="submit" size="sm" disabled={!pw.next} loading={changePw.isPending}>Update password</Button></div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><div><CardTitle>Active sessions</CardTitle><CardDescription>Devices currently signed in to your account</CardDescription></div></CardHeader>
        <CardContent>
          {sessions.isLoading ? <Skeleton className="h-24" /> : (
            <ul className="divide-y divide-border rounded-xl border border-border">
              {sessions.data?.map((s) => {
                const d = device(s.user_agent);
                return (
                  <li key={s.id} className="flex items-center gap-3 px-4 py-3">
                    <d.icon className="size-4 text-muted-foreground" />
                    <div className="min-w-0 flex-1">
                      <p className="flex items-center gap-2 truncate text-[13px] font-medium">{d.label || "Unknown device"}{s.current && <Badge size="sm" variant="success" dot>This device</Badge>}</p>
                      <p className="text-xs text-muted-foreground">{s.ip_address ?? "Unknown IP"} · active {s.last_used_at ? formatDistanceToNow(new Date(s.last_used_at), { addSuffix: true }) : "—"}</p>
                    </div>
                    {!s.current && <Button size="xs" variant="outline" loading={revoke.isPending && revoke.variables === s.id} onClick={() => revoke.mutate(s.id)}>Sign out</Button>}
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
