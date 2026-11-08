"use client";
import * as React from "react";
import Link from "next/link";
import { useMutation, useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { History, Megaphone, MessageSquareQuote } from "lucide-react";
import { toast } from "sonner";
import { ChartTooltip, axisProps, gridProps } from "@/components/app/chart-kit";
import { UpgradePrompt } from "@/components/billing/plan-gate";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FormField } from "@/components/ui/form-field";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { EmptyState, Skeleton } from "@/components/ui/states";
import { TBody, TD, TH, THead, TR, Table } from "@/components/ui/table";
import { ApiError, api, errorMessage } from "@/lib/api";
import { useOrg } from "@/lib/session";
import { titleCase } from "@/lib/utils";
import { AI_LANGS, CopyButton, ProviderNote, Segmented } from "./shared";

export function TemplateGenerator({ onUsage }: { onUsage: () => void }) {
  const [purpose, setPurpose] = React.useState("review_request");
  const [channel, setChannel] = React.useState("whatsapp");
  const [lang, setLang] = React.useState("en");
  const [tone, setTone] = React.useState("friendly");
  const m = useMutation({
    mutationFn: () => api.post<{ subject: string | null; body: string; notes?: string; provider: string }>("/ai/templates", { purpose, channel, language: lang, tone }),
    onSuccess: onUsage,
    onError: (e) => { if (!(e instanceof ApiError && e.status === 402)) toast.error(errorMessage(e)); },
  });
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card>
        <CardHeader><div><CardTitle>Message templates</CardTitle><CardDescription>Compliant copy for review requests and follow-ups. Every request asks for honest feedback and never offers incentives.</CardDescription></div></CardHeader>
        <CardContent className="space-y-4">
          <FormField label="Purpose">
            <Select value={purpose} onValueChange={setPurpose}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="review_request">Review request</SelectItem>
                <SelectItem value="follow_up">Follow-up reminder</SelectItem>
                <SelectItem value="thank_you">Thank-you message</SelectItem>
                <SelectItem value="service_recovery">Service recovery</SelectItem>
              </SelectContent>
            </Select>
          </FormField>
          <FormField label="Channel"><Segmented label="Channel" value={channel} onChange={setChannel} options={[{ value: "whatsapp", label: "WhatsApp" }, { value: "email", label: "Email" }, { value: "sms", label: "SMS" }]} /></FormField>
          <FormField label="Language"><Segmented label="Language" value={lang} onChange={setLang} options={AI_LANGS} /></FormField>
          <FormField label="Tone"><Segmented label="Tone" value={tone} onChange={setTone} options={[{ value: "friendly", label: "Friendly" }, { value: "professional", label: "Professional" }, { value: "warm", label: "Warm" }]} /></FormField>
          <Button loading={m.isPending} onClick={() => m.mutate()}><MessageSquareQuote /> Generate template</Button>
        </CardContent>
      </Card>
      {m.error instanceof ApiError && m.error.status === 402 ? <UpgradePrompt message={m.error.message} /> : m.data ? (
        <Card>
          <CardHeader><CardTitle>Template</CardTitle><ProviderNote provider={m.data.provider} /></CardHeader>
          <CardContent className="space-y-4">
            {channel === "whatsapp" ? (
              <div className="rounded-2xl bg-[#e7ddd3] p-4 dark:bg-[#0b141a]">
                <div className="ml-auto max-w-[90%] rounded-xl rounded-tr-sm bg-[#d9fdd3] px-3 py-2 text-[13.5px] leading-relaxed text-[#111b21] shadow-sm dark:bg-[#005c4b] dark:text-[#e9edef]">{m.data.body}</div>
              </div>
            ) : (
              <div className="rounded-xl border border-border bg-background-subtle p-4 text-[13.5px] leading-relaxed">
                {m.data.subject && <p className="mb-2 font-semibold">{m.data.subject}</p>}
                <p className="whitespace-pre-wrap text-foreground-soft">{m.data.body}</p>
              </div>
            )}
            <p className="text-xs text-muted-foreground">Placeholders: <code className="font-mono">{"{{name}}"}</code> and <code className="font-mono">{"{{link}}"}</code> are filled per customer. {m.data.notes}</p>
            <div className="flex flex-wrap gap-2">
              <CopyButton text={m.data.body} label="Copy message" />
              <Button variant="soft" size="sm" asChild><Link href="/app/campaigns/new"><Megaphone /> Use in a campaign</Link></Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card className="border-dashed"><EmptyState icon={MessageSquareQuote} title="No template yet" description="WhatsApp templates must be approved by Meta before sending — submit the generated text in Integrations." /></Card>
      )}
    </div>
  );
}

interface HistoryItem { id: string; kind: string; provider: string; model: string; tokens: number; success: boolean; created_at: string; output: Record<string, unknown> }

export function UsageHistory() {
  const { orgId } = useOrg();
  const usage = useQuery({ queryKey: ["ai", "usage", orgId], queryFn: () => api.get<{ months: { period: string; requests: number; failed: number; tokens: number }[]; daily: { date: string; requests: number }[] }>("/ai/usage") });
  const hist = useQuery({ queryKey: ["ai", "history", orgId], queryFn: () => api.get<HistoryItem[]>("/ai/history", { limit: 25 }) });
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader><div><CardTitle>Requests — last 30 days</CardTitle><CardDescription>Every AI request counts toward your plan's monthly allowance</CardDescription></div></CardHeader>
        <CardContent>
          {usage.isLoading ? <Skeleton className="h-56" /> : !usage.data?.daily.length ? (
            <EmptyState compact icon={History} title="No AI usage yet" />
          ) : (
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={usage.data.daily}>
                  <CartesianGrid {...gridProps} />
                  <XAxis dataKey="date" {...axisProps} tickFormatter={(d) => format(new Date(d), "d MMM")} />
                  <YAxis {...axisProps} allowDecimals={false} width={30} />
                  <Tooltip cursor={{ fill: "var(--muted)" }} content={<ChartTooltip labelFormatter={(l) => format(new Date(String(l)), "d MMM yyyy")} />} />
                  <Bar dataKey="requests" name="Requests" fill="var(--chart-1)" radius={[4, 4, 0, 0]} maxBarSize={22} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardContent>
      </Card>
      <Card className="overflow-hidden">
        <CardHeader className="pb-4"><CardTitle>Recent generations</CardTitle></CardHeader>
        {hist.isLoading ? <div className="p-5"><Skeleton className="h-40" /></div> : !hist.data?.length ? (
          <EmptyState compact icon={History} title="Nothing generated yet" />
        ) : (
          <Table>
            <THead><TR className="hover:bg-transparent"><TH>Type</TH><TH>Output</TH><TH className="hidden md:table-cell">Engine</TH><TH className="text-right">Tokens</TH><TH className="hidden sm:table-cell text-right">When</TH></TR></THead>
            <TBody>
              {hist.data.map((h) => (
                <TR key={h.id}>
                  <TD><Badge size="sm" variant={h.success ? "primary" : "danger"}>{titleCase(h.kind)}</Badge></TD>
                  <TD className="max-w-[420px]"><p className="truncate text-xs">{String(h.output.reply ?? h.output.summary ?? h.output.body ?? h.output.sentiment ?? "—")}</p></TD>
                  <TD className="hidden md:table-cell text-xs">{h.provider === "openai" ? h.model : "Heuristic"}</TD>
                  <TD className="text-right tabular text-xs">{h.tokens || "—"}</TD>
                  <TD className="hidden sm:table-cell text-right text-xs text-muted-foreground">{format(new Date(h.created_at), "d MMM, HH:mm")}</TD>
                </TR>
              ))}
            </TBody>
          </Table>
        )}
      </Card>
    </div>
  );
}
