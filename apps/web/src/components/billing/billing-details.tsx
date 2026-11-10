"use client";
import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Landmark } from "lucide-react";
import { toast } from "sonner";
import { Panel } from "@/components/console/kit";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { InlineAlert, Skeleton } from "@/components/ui/states";
import { api, errorMessage } from "@/lib/api";
import { useOrg } from "@/lib/session";
import { QueryErrorState } from "./plan-gate";

interface Details { legal_name?: string; gstin?: string | null; email?: string | null; address_line?: string | null; city?: string | null; postal_code?: string | null; state_code?: string | null }
interface Out { details: Details; states: Record<string, string>; seller_registered: boolean }

const GSTIN = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;
const schema = z.object({
  legal_name: z.string().min(2, "Enter the registered business name").max(200),
  gstin: z.string().trim().toUpperCase().refine((v) => !v || GSTIN.test(v), "15 characters, e.g. 27ABCDE1234F1Z5").optional(),
  email: z.union([z.literal(""), z.email("Enter a valid email")]).optional(),
  address_line: z.string().max(300).optional(),
  city: z.string().max(120).optional(),
  postal_code: z.string().max(12).optional(),
  state_code: z.string().optional(),
});
type Values = z.infer<typeof schema>;

/** GST billing details printed on every future invoice (issued invoices are never altered). */
export function BillingDetailsPanel() {
  const { orgId } = useOrg();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["billing-details", orgId], queryFn: () => api.get<Out>("/subscriptions/billing-details") });
  const form = useForm<Values>({ resolver: zodResolver(schema) });
  React.useEffect(() => {
    const d = q.data?.details;
    if (d) form.reset({ legal_name: d.legal_name ?? "", gstin: d.gstin ?? "", email: d.email ?? "", address_line: d.address_line ?? "", city: d.city ?? "", postal_code: d.postal_code ?? "", state_code: d.state_code ?? "" });
  }, [q.data, form]);
  const save = useMutation({
    mutationFn: (v: Values) => api.put<Out>("/subscriptions/billing-details", Object.fromEntries(Object.entries(v).map(([k, x]) => [k, x === "" ? null : x]))),
    onSuccess: () => { toast.success("Billing details saved — used on future invoices"); qc.invalidateQueries({ queryKey: ["billing-details"] }); },
    onError: (e) => toast.error(errorMessage(e)),
  });
  if (q.isLoading) return <Skeleton className="h-64 rounded-xl" />;
  if (q.error) return <QueryErrorState error={q.error} onRetry={() => q.refetch()} />;
  const { register, watch, setValue, formState: { errors, isDirty } } = form;
  const gstin = (watch("gstin") ?? "").toUpperCase();
  const derived = GSTIN.test(gstin) ? gstin.slice(0, 2) : null;
  const states = Object.entries(q.data!.states);
  return (
    <Panel index="03" label="Invoicing" title={<><Landmark className="size-4 text-primary" />GST billing details</>} description="Printed on future invoices. Adding your GSTIN lets you claim input tax credit; the state decides CGST + SGST or IGST.">
      <form onSubmit={form.handleSubmit((v) => save.mutate(v))} className="space-y-4" noValidate>
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label="Legal business name" htmlFor="bd-name" error={errors.legal_name?.message} required><Input id="bd-name" invalid={!!errors.legal_name} {...register("legal_name")} /></FormField>
          <FormField label="GSTIN" htmlFor="bd-gstin" error={errors.gstin?.message} hint="Optional — leave blank if not GST-registered.">
            <Input id="bd-gstin" className="font-mono uppercase" maxLength={15} invalid={!!errors.gstin} {...register("gstin")} placeholder="27ABCDE1234F1Z5" />
          </FormField>
          <FormField label="Billing email" htmlFor="bd-email" error={errors.email?.message}><Input id="bd-email" type="email" {...register("email")} /></FormField>
          <FormField label="State (place of supply)" hint={derived ? "Taken from your GSTIN" : undefined}>
            <Select value={derived ?? watch("state_code") ?? ""} onValueChange={(v) => setValue("state_code", v, { shouldDirty: true })} disabled={!!derived}>
              <SelectTrigger aria-label="State"><SelectValue placeholder="Select state" /></SelectTrigger>
              <SelectContent>{states.map(([code, name]) => <SelectItem key={code} value={code}>{name} ({code})</SelectItem>)}</SelectContent>
            </Select>
          </FormField>
          <FormField label="Address" htmlFor="bd-addr" className="sm:col-span-2"><Input id="bd-addr" {...register("address_line")} /></FormField>
          <FormField label="City" htmlFor="bd-city"><Input id="bd-city" {...register("city")} /></FormField>
          <FormField label="PIN code" htmlFor="bd-pin"><Input id="bd-pin" className="font-mono" inputMode="numeric" {...register("postal_code")} /></FormField>
        </div>
        {!q.data!.seller_registered && (
          <InlineAlert variant="info" icon={Landmark}>This server has no supplier GSTIN configured yet, so invoices are issued as plain invoices rather than GST tax invoices.</InlineAlert>
        )}
        <div className="flex justify-end gap-2 border-t border-border pt-4">
          {isDirty && <Button type="button" variant="ghost" onClick={() => form.reset()}>Discard</Button>}
          <Button type="submit" disabled={!isDirty} loading={save.isPending}>Save billing details</Button>
        </div>
      </form>
    </Panel>
  );
}
