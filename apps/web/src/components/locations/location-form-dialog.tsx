"use client";
import * as React from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Info } from "lucide-react";
import { UpgradePrompt } from "@/components/billing/plan-gate";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { ApiError, api, errorMessage } from "@/lib/api";
import type { Location } from "@/lib/types";

const schema = z.object({
  name: z.string().min(2, "Name is required").max(160),
  address_line: z.string().max(300).optional(),
  city: z.string().max(120).optional(),
  state: z.string().max(120).optional(),
  postal_code: z.string().max(20).optional(),
  phone: z.string().max(32).optional(),
  google_review_url: z.union([z.literal(""), z.url("Enter a full URL starting with https://").refine((v) => v.startsWith("https://"), "Must start with https://")]).optional(),
});
type Values = z.infer<typeof schema>;

export function LocationFormDialog({ open, onOpenChange, location }: { open: boolean; onOpenChange: (o: boolean) => void; location?: Location | null }) {
  const qc = useQueryClient();
  const editing = !!location;
  const [limitError, setLimitError] = React.useState<string | null>(null);
  const defaults = React.useCallback(
    (): Values => ({
      name: location?.name ?? "", address_line: location?.address_line ?? "", city: location?.city ?? "", state: location?.state ?? "",
      postal_code: location?.postal_code ?? "", phone: location?.phone ?? "", google_review_url: location?.google_review_url ?? "",
    }),
    [location],
  );
  const form = useForm<Values>({ resolver: zodResolver(schema), defaultValues: defaults() });
  React.useEffect(() => { if (open) { form.reset(defaults()); setLimitError(null); } }, [open, defaults, form]);

  const save = useMutation({
    mutationFn: (v: Values) => {
      const body = Object.fromEntries(Object.entries(v).map(([k, val]) => [k, val === "" ? null : val]));
      return editing ? api.patch<Location>(`/locations/${location!.id}`, body) : api.post<Location>("/locations", { ...body, country: "IN" });
    },
    onSuccess: (l) => {
      toast.success(editing ? "Location updated" : `${l.name} added`);
      qc.invalidateQueries({ queryKey: ["locations"] });
      qc.invalidateQueries({ queryKey: ["location"] });
      onOpenChange(false);
    },
    onError: (e) => {
      if (e instanceof ApiError && e.status === 402) setLimitError(e.message);
      else if (e instanceof ApiError && e.status === 422) form.setError("google_review_url", { message: e.message.replace(/^google_review_url: /, "").replace(/^Value error, /, "") });
      else toast.error(errorMessage(e));
    },
  });
  const { register, formState: { errors } } = form;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="lg">
        <DialogHeader>
          <DialogTitle>{editing ? "Edit location" : "Add location"}</DialogTitle>
          <DialogDescription>Each location gets its own public feedback page, QR codes and analytics.</DialogDescription>
        </DialogHeader>
        {limitError ? (
          <div className="space-y-4">
            <UpgradePrompt compact message={limitError} />
            <DialogFooter><Button variant="outline" onClick={() => onOpenChange(false)}>Close</Button></DialogFooter>
          </div>
        ) : (
          <form onSubmit={form.handleSubmit((v) => save.mutate(v))} className="space-y-4" noValidate>
            <FormField label="Location name" htmlFor="l-name" required error={errors.name?.message}>
              <Input id="l-name" placeholder="Bandra West, Mumbai" invalid={!!errors.name} {...register("name")} />
            </FormField>
            <FormField label="Street address" htmlFor="l-addr"><Input id="l-addr" placeholder="12, Hill Road" {...register("address_line")} /></FormField>
            <div className="grid gap-4 sm:grid-cols-3">
              <FormField label="City" htmlFor="l-city"><Input id="l-city" {...register("city")} /></FormField>
              <FormField label="State" htmlFor="l-state"><Input id="l-state" {...register("state")} /></FormField>
              <FormField label="PIN code" htmlFor="l-pin"><Input id="l-pin" inputMode="numeric" {...register("postal_code")} /></FormField>
            </div>
            <FormField label="Phone" htmlFor="l-phone"><Input id="l-phone" placeholder="+91 22 1234 5678" {...register("phone")} /></FormField>
            <FormField
              label="Google review link"
              htmlFor="l-gurl"
              error={errors.google_review_url?.message}
              hint={
                <span className="flex gap-1.5">
                  <Info className="mt-px size-3.5 shrink-0" />
                  In Google Business Profile, open “Ask for reviews” and copy the link (g.page/r/… or search.google.com/local/writereview?placeid=…). Used until the Business Profile API is connected.
                </span>
              }
            >
              <Input id="l-gurl" placeholder="https://g.page/r/…/review" invalid={!!errors.google_review_url} {...register("google_review_url")} />
            </FormField>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
              <Button type="submit" loading={save.isPending}>{editing ? "Save changes" : "Add location"}</Button>
            </DialogFooter>
            {!editing && <p className="text-[11.5px] text-subtle-foreground">Location limits depend on your plan. <Link href="/app/subscription" className="underline">View plans</Link></p>}
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
