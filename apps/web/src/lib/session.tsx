"use client";
/**
 * Session + tenant context for the business app and admin console.
 * The server is the source of truth for every permission check; these helpers
 * only shape navigation and UI affordances.
 */
import * as React from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import type { Permission } from "@reviewpilot/shared-types";
import { ApiError, api, getActiveOrgId, setActiveOrgId } from "./api";
import type { Location, Me, Membership } from "./types";

export const meQueryKey = ["auth", "me"] as const;

export function useMe(opts?: { enabled?: boolean }) {
  return useQuery({
    queryKey: meQueryKey,
    queryFn: () => api.get<Me>("/auth/me", undefined, { orgId: null }),
    staleTime: 60_000,
    retry: false,
    enabled: opts?.enabled ?? true,
  });
}

interface OrgCtx {
  me: Me;
  membership: Membership;
  orgId: string;
  can: (p: Permission) => boolean;
  switchOrg: (id: string) => void;
  locationId: string | null; // global location filter ("all" = null)
  setLocationId: (id: string | null) => void;
  locations: Location[];
}

const OrgContext = React.createContext<OrgCtx | null>(null);

export function useOrg() {
  const ctx = React.useContext(OrgContext);
  if (!ctx) throw new Error("useOrg must be used inside <OrgProvider>");
  return ctx;
}

export function useCan(p: Permission) {
  return useOrg().can(p);
}

/** Resolves the active organization; redirects to /login or /onboarding when needed. */
export function OrgProvider({ children, fallback }: { children: React.ReactNode; fallback: React.ReactNode }) {
  const router = useRouter();
  const qc = useQueryClient();
  const meQuery = useMe();
  const [orgId, setOrgId] = React.useState<string | null>(null);
  const [locationId, setLocationIdState] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (meQuery.error instanceof ApiError && meQuery.error.status === 401) {
      router.replace(`/login?next=${encodeURIComponent(window.location.pathname + window.location.search)}`);
    }
  }, [meQuery.error, router]);

  React.useEffect(() => {
    const me = meQuery.data;
    if (!me) return;
    if (me.memberships.length === 0) {
      router.replace(me.user.platform_role === "platform_super_admin" ? "/admin" : "/onboarding");
      return;
    }
    const stored = getActiveOrgId();
    const chosen = me.memberships.find((m) => m.organization.id === stored) ?? me.memberships[0];
    setActiveOrgId(chosen.organization.id);
    setOrgId(chosen.organization.id);
    if (!chosen.organization.onboarding_completed && chosen.role === "owner") router.replace("/onboarding");
    try {
      setLocationIdState(localStorage.getItem(`rp_loc_${chosen.organization.id}`) || null);
    } catch {}
  }, [meQuery.data, router]);

  const locationsQuery = useQuery({
    queryKey: ["locations", orgId],
    queryFn: () => api.get<Location[]>("/locations"),
    enabled: !!orgId,
  });

  const switchOrg = React.useCallback(
    (id: string) => {
      setActiveOrgId(id);
      setOrgId(id);
      setLocationIdState(null);
      qc.removeQueries({ predicate: (q) => q.queryKey[0] !== "auth" });
      router.push("/app");
    },
    [qc, router],
  );

  const setLocationId = React.useCallback(
    (id: string | null) => {
      setLocationIdState(id);
      try {
        if (orgId) id ? localStorage.setItem(`rp_loc_${orgId}`, id) : localStorage.removeItem(`rp_loc_${orgId}`);
      } catch {}
    },
    [orgId],
  );

  const me = meQuery.data;
  const membership = me?.memberships.find((m) => m.organization.id === orgId);
  if (!me || !membership || !orgId) return <>{fallback}</>;

  const value: OrgCtx = {
    me,
    membership,
    orgId,
    can: (p) => membership.permissions.includes(p),
    switchOrg,
    locationId,
    setLocationId,
    locations: locationsQuery.data ?? [],
  };
  return <OrgContext.Provider value={value}>{children}</OrgContext.Provider>;
}

export async function logout() {
  try {
    await api.post("/auth/logout", undefined, { orgId: null });
  } finally {
    setActiveOrgId(null);
    window.location.href = "/login";
  }
}
