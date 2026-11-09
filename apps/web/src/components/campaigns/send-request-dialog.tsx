"use client";
import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Check, Mail, MessageSquare, Search, Send } from "lucide-react";
import { WhatsAppIcon } from "@/components/brand/brand-icons";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { FormField } from "@/components/ui/form-field";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { InlineAlert } from "@/components/ui/states";
import { Avatar } from "@/components/ui/controls";
import { ApiError, api, errorMessage } from "@/lib/api";
import { useOrg } from "@/lib/session";
import { cn } from "@/lib/utils";
import { choiceClass } from "@/components/dashboard/kit";

interface CustomerLite { id: string; name: string | null; email: string | null; phone: string | null; consents: Record<string, boolean>; opted_out_at: string | null }

const CHANNELS = [
  { value: "whatsapp", label: "WhatsApp", icon: WhatsAppIcon },
  { value: "email", label: "Email", icon: Mail },
  { value: "sms", label: "SMS", icon: MessageSquare },
] as const;

export function SendRequestDialog({ trigger }: { trigger: React.ReactNode }) {
  const { orgId, locations, locationId } = useOrg();
  const qc = useQueryClient();
  const [open, setOpen] = React.useState(false);
  const [search, setSearch] = React.useState("");
  const [customer, setCustomer] = React.useState<CustomerLite | null>(null);
  const [loc, setLoc] = React.useState<string>("");
  const [channel, setChannel] = React.useState<string>("whatsapp");
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (open) setLoc(locationId ?? locations[0]?.id ?? "");
  }, [open, locationId, locations]);

  const customers = useQuery({
    queryKey: ["customers", "picker", orgId, search],
    queryFn: () => api.get<{ items: CustomerLite[] }>("/customers", { q: search, page_size: 6 }),
    enabled: open,
  });

  const send = useMutation({
    mutationFn: () => api.post("/review-requests", { customer_id: customer!.id, location_id: loc, channel }),
    onSuccess: () => {
      toast.success(`Review request queued for ${customer?.name ?? "customer"}`);
      qc.invalidateQueries({ queryKey: ["review-requests"] });
      setOpen(false);
      setCustomer(null);
      setSearch("");
    },
    onError: (e) => setError(e instanceof ApiError && e.code === "plan_limit_exceeded" ? `${e.message}` : errorMessage(e)),
  });

  const consentFor = (c: CustomerLite, ch: string) => !c.opted_out_at && !!c.consents?.[ch];

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); setError(null); }}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent size="md">
        <DialogHeader>
          <p className="micro-label">Outreach · One-off</p>
          <DialogTitle>Send a review request</DialogTitle>
          <DialogDescription>Ask one customer for honest feedback. Only customers who agreed to be contacted on a channel can be messaged there.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <FormField label="Customer" required>
            <Input leading={<Search />} placeholder="Search by name, email or phone" value={search} onChange={(e) => setSearch(e.target.value)} aria-label="Search customers" />
            <ul className="mt-2 max-h-52 space-y-1 overflow-y-auto scrollbar-thin" role="listbox" aria-label="Customers">
              {customers.data?.items.map((c) => (
                <li key={c.id}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={customer?.id === c.id}
                    onClick={() => { setCustomer(c); setError(null); }}
                    className={cn("flex w-full items-center gap-3 px-3 py-2", choiceClass(customer?.id === c.id), customer?.id !== c.id && "border-transparent bg-transparent")}
                  >
                    <Avatar name={c.name} size={28} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13px] font-medium">{c.name ?? "Unnamed"}</span>
                      <span className="block truncate font-mono text-[10.5px] text-subtle-foreground">{c.phone ?? c.email}</span>
                    </span>
                    {c.opted_out_at ? <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-danger-foreground">Opted out</span> : customer?.id === c.id && <Check className="size-4 text-primary" />}
                  </button>
                </li>
              ))}
              {customers.data && !customers.data.items.length && <li className="px-3 py-4 text-center text-[13px] text-muted-foreground">No customers found. Add them on the Customers page.</li>}
            </ul>
          </FormField>
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label="Location" required>
              <Select value={loc} onValueChange={setLoc}>
                <SelectTrigger><SelectValue placeholder="Choose location" /></SelectTrigger>
                <SelectContent>{locations.map((l) => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}</SelectContent>
              </Select>
            </FormField>
            <FormField label="Channel" required>
              <div className="grid grid-cols-3 gap-1.5">
                {CHANNELS.map((c) => {
                  const ok = customer ? consentFor(customer, c.value) : true;
                  return (
                    <button
                      key={c.value}
                      type="button"
                      onClick={() => { setChannel(c.value); setError(null); }}
                      aria-pressed={channel === c.value}
                      className={cn("flex h-12 flex-col items-center justify-center gap-0.5 font-mono text-[10px] uppercase tracking-[0.08em]", choiceClass(channel === c.value), channel === c.value ? "text-foreground" : "text-muted-foreground", !ok && "opacity-50")}
                    >
                      <c.icon className="size-4" />
                      {c.label}
                    </button>
                  );
                })}
              </div>
            </FormField>
          </div>
          {customer && !consentFor(customer, channel) && (
            <InlineAlert variant="warning" title="No consent on this channel">
              {customer.opted_out_at ? "This customer opted out of all messages." : `${customer.name ?? "This customer"} hasn't agreed to receive ${channel} messages. Record consent on their profile first.`}
            </InlineAlert>
          )}
          {error && <InlineAlert variant="danger" title="Couldn't send">{error}</InlineAlert>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={() => send.mutate()} loading={send.isPending} disabled={!customer || !loc}><Send /> Send request</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
