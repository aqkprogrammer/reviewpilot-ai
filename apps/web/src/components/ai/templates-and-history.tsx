"use client";
import * as React from "react";
import Link from "next/link";
import { useMutation, useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { History, Megaphone, MessageSquareQuote } from "lucide-react";
import { toast } from "sonner";
import { ChartTooltip, GradientDefs, axisProps, gridProps } from "@/components/app/chart-kit";
import { UpgradePrompt } from "@/components/billing/plan-gate";
import { Panel, ReadoutStrip } from "@/components/console/kit";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { EmptyState, Skeleton } from "@/components/ui/states";
import { TBody, TD, TH, THead, TR, Table } from "@/components/ui/table";
import { ApiError, api, errorMessage } from "@/lib/api";
import { useOrg } from "@/lib/session";
import { cn, formatNumber, titleCase } from "@/lib/utils";
import { AI_LANGS, AwaitingInput, ConsoleField, CopyButton, GeneratingState, OutputHeader, Segmented } from "./shared";

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
    <div className="grid gap-5 lg:grid-cols-2">
      <Panel label="Input · template brief" title="Message templates" description="Compliant copy for review requests and follow-ups. Every request asks for honest feedback and never offers incentives.">
        <div className="space-y-5">
          <ConsoleField index="01" label="Purpose">
            <Select value={purpose} onValueChange={setPurpose}>
              <SelectTrigger aria-label="Purpose"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="review_request">Review request</SelectItem>
                <SelectItem value="follow_up">Follow-up reminder</SelectItem>
                <SelectItem value="thank_you">Thank-you message</SelectItem>
                <SelectItem value="service_recovery">Service recovery</SelectItem>
              </SelectContent>
            </Select>
          </ConsoleField>
          <ConsoleField index="02" label="Channel"><Segmented id="tpl-channel" label="Channel" value={channel} onChange={setChannel} options={[{ value: "whatsapp", label: "WhatsApp" }, { value: "email", label: "Email" }, { value: "sms", label: "SMS" }]} /></ConsoleField>
          <ConsoleField index="03" label="Language"><Segmented id="tpl-lang" label="Language" value={lang} onChange={setLang} options={AI_LANGS} /></ConsoleField>
          <ConsoleField index="04" label="Tone"><Segmented id="tpl-tone" label="Tone" value={tone} onChange={setTone} options={[{ value: "friendly", label: "Friendly" }, { value: "professional", label: "Professional" }, { value: "warm", label: "Warm" }]} /></ConsoleField>
          <div className="border-t border-border pt-5"><Button loading={m.isPending} onClick={() => m.mutate()}><MessageSquareQuote /> Generate template</Button></div>
        </div>
      </Panel>
      {m.error instanceof ApiError && m.error.status === 402 ? <UpgradePrompt message={m.error.message} /> : m.isPending ? (
        <Card className="overflow-hidden"><OutputHeader label="Output · composing" /><div className="p-5"><GeneratingState label="Composing template" /></div></Card>
      ) : m.data ? (
        <Card className="overflow-hidden">
          <OutputHeader label={`Output · ${channel === "sms" ? "SMS" : titleCase(channel)} template`} provider={m.data.provider} />
          <div className="space-y-4 p-5">
            {channel === "whatsapp" ? (
              <div className="relative overflow-hidden rounded-lg border border-border bg-background-subtle p-4">
                <div aria-hidden className="pointer-events-none absolute inset-0 bg-dots opacity-40" />
                <p className="relative mb-3 text-center font-mono text-[10px] uppercase tracking-[0.12em] text-subtle-foreground">WhatsApp preview</p>
                <div className="relative ml-auto max-w-[88%] rounded-lg rounded-tr-sm border border-[color-mix(in_oklab,var(--mint)_30%,transparent)] bg-mint-soft px-3.5 py-2.5 text-[13.5px] leading-relaxed text-foreground">
                  <p className="whitespace-pre-wrap">{m.data.body}</p>
                </div>
              </div>
            ) : (
              <div className="overflow-hidden rounded-lg border border-border bg-background-subtle text-[13.5px] leading-relaxed">
                {m.data.subject && <p className="border-b border-border px-4 py-2.5"><span className="micro-label mr-2">Subject</span><span className="font-semibold">{m.data.subject}</span></p>}
                <p className="whitespace-pre-wrap px-4 py-3 text-foreground-soft">{m.data.body}</p>
              </div>
            )}
            <p className="text-xs leading-relaxed text-muted-foreground">Placeholders <code className="rounded bg-muted px-1 font-mono text-[11px] text-foreground">{"{{name}}"}</code> and <code className="rounded bg-muted px-1 font-mono text-[11px] text-foreground">{"{{link}}"}</code> are filled per customer. {m.data.notes}</p>
            <div className="flex flex-wrap gap-2">
              <CopyButton text={m.data.body} label="Copy message" />
              <Button variant="soft" size="sm" asChild><Link href="/app/campaigns/new"><Megaphone /> Use in a campaign</Link></Button>
            </div>
          </div>
        </Card>
      ) : (
        <AwaitingInput icon={MessageSquareQuote} title="No template yet" description="WhatsApp templates must be approved by Meta before sending — submit the generated text in Integrations." />
      )}
    </div>
  );
}

interface HistoryItem { id: string; kind: string; provider: string; model: string; tokens: number; success: boolean; created_at: string; output: Record<string, unknown> }

export function UsageHistory() {
  const { orgId } = useOrg();
  const usage = useQuery({ queryKey: ["ai", "usage", orgId], queryFn: () => api.get<{ months: { period: string; requests: number; failed: number; tokens: number }[]; daily: { date: string; requests: number }[] }>("/ai/usage") });
  const hist = useQuery({ queryKey: ["ai", "history", orgId], queryFn: () => api.get<HistoryItem[]>("/ai/history", { limit: 25 }) });
  const daily = usage.data?.daily ?? [];
  const total30 = daily.reduce((a, b) => a + b.requests, 0);
  const peak = daily.reduce((a, b) => (b.requests > a.requests ? b : a), { date: "", requests: 0 });
  const month = usage.data?.months?.[0]; // API returns newest period first
  return (
    <div className="space-y-5">
      {usage.data && (
        <ReadoutStrip
          items={[
            { label: "Requests · 30d", value: formatNumber(total30), tone: "signal" },
            { label: "Peak day", value: peak.requests ? `${peak.requests} · ${format(new Date(peak.date), "d MMM")}` : "—" },
            { label: month ? `${month.period} · failed` : "Failed", value: month ? formatNumber(month.failed) : "—", tone: month?.failed ? "warn" : "muted" },
            { label: month ? `${month.period} · tokens` : "Tokens", value: month ? formatNumber(month.tokens) : "—", tone: "muted", hint: "Heuristic requests use no tokens" },
          ]}
        />
      )}
      <Panel index="01" label="Telemetry" title="Requests — last 30 days" description="Every AI request counts toward your plan's monthly allowance">
        {usage.isLoading ? <Skeleton className="h-56" /> : !daily.length ? (
          <EmptyState compact icon={History} title="No AI usage yet" />
        ) : (
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={daily} margin={{ left: -8, right: 4, top: 8 }}>
                <GradientDefs id="ai-usage-bar" color="var(--chart-1)" />
                <CartesianGrid {...gridProps} />
                <XAxis dataKey="date" {...axisProps} minTickGap={20} tickFormatter={(d) => format(new Date(d), "d MMM")} />
                <YAxis {...axisProps} allowDecimals={false} width={30} />
                <Tooltip cursor={{ fill: "var(--muted)", opacity: 0.6 }} content={<ChartTooltip labelFormatter={(l) => format(new Date(String(l)), "d MMM yyyy")} />} />
                <Bar dataKey="requests" name="Requests" fill="url(#ai-usage-bar)" stroke="var(--chart-1)" strokeWidth={1} radius={[3, 3, 0, 0]} maxBarSize={18} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </Panel>
      <Panel index="02" label="Audit log" title="Recent generations" flush actions={hist.data?.length ? <span className="font-mono text-[10.5px] uppercase tracking-[0.12em] text-subtle-foreground">Last {hist.data.length}</span> : null}>
        {hist.isLoading ? <div className="p-5"><Skeleton className="h-40" /></div> : !hist.data?.length ? (
          <EmptyState compact icon={History} title="Nothing generated yet" />
        ) : (
          <Table>
            <THead><TR className="hover:bg-transparent"><TH>Type</TH><TH>Output</TH><TH className="hidden md:table-cell">Engine</TH><TH className="text-right">Tokens</TH><TH className="hidden sm:table-cell text-right">When</TH></TR></THead>
            <TBody>
              {hist.data.map((h) => (
                <TR key={h.id}>
                  <TD className="whitespace-nowrap">
                    <span className={cn("inline-flex items-center gap-1.5 font-mono text-[10.5px] uppercase tracking-[0.08em]", h.success ? "text-foreground-soft" : "text-danger-foreground")}>
                      <span className={cn("size-1.5 rounded-full", h.success ? "bg-primary shadow-[0_0_6px_var(--primary)]" : "bg-danger")} aria-label={h.success ? "Succeeded" : "Failed"} />
                      {h.kind.replace(/_/g, " ")}
                    </span>
                  </TD>
                  <TD className="max-w-[420px]"><p className="truncate text-xs">{String(h.output.reply ?? h.output.summary ?? h.output.body ?? h.output.sentiment ?? "—")}</p></TD>
                  <TD className="hidden md:table-cell font-mono text-[11px] text-muted-foreground">{h.provider === "openai" ? h.model : "heuristic"}</TD>
                  <TD className="text-right font-mono text-xs tabular">{h.tokens || <span className="text-subtle-foreground">—</span>}</TD>
                  <TD className="hidden sm:table-cell whitespace-nowrap text-right font-mono text-[11px] text-muted-foreground">{format(new Date(h.created_at), "d MMM · HH:mm")}</TD>
                </TR>
              ))}
            </TBody>
          </Table>
        )}
      </Panel>
    </div>
  );
}
