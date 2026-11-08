"use client";
import * as React from "react";
import { Bar, BarChart, Cell, ResponsiveContainer, XAxis, YAxis, Tooltip } from "recharts";
import { BadgeCheck, Calculator, TrendingUp } from "lucide-react";
import { Section, SectionHeading } from "./primitives";
import { Stars } from "@/components/ui/stars";

const ratings = [
  { r: "5★", v: 268, c: "#10b981" },
  { r: "4★", v: 91, c: "#2563ff" },
  { r: "3★", v: 28, c: "#f59e0b" },
  { r: "2★", v: 14, c: "#fb923c" },
  { r: "1★", v: 11, c: "#f43f5e" },
];

const locations = [
  { name: "Koramangala", rating: 4.7, reviews: 182, response: "98%", trend: "+0.2" },
  { name: "Indiranagar", rating: 4.5, reviews: 141, response: "94%", trend: "+0.1" },
  { name: "HSR Layout", rating: 4.2, reviews: 89, response: "81%", trend: "+0.4" },
];

export function AnalyticsShowcase() {
  return (
    <Section id="analytics" className="bg-background-subtle/40">
      <SectionHeading
        eyebrow="Review Analytics"
        title="Know exactly where you stand — and why"
        description="Ratings, volume, response times and campaign performance across every location. Verified Google data and our own measured metrics are always labelled separately, with clear definitions."
      />
      <div className="mt-14 grid gap-4 lg:grid-cols-5">
        <div className="rounded-[20px] border border-border bg-card p-5 shadow-sm lg:col-span-2">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[14px] font-semibold text-foreground">Rating distribution</p>
              <p className="mt-0.5 text-[12px] text-muted-foreground">412 Google reviews · sample data</p>
            </div>
            <span className="inline-flex items-center gap-1 rounded-full bg-blue-soft px-2 py-0.5 text-[10.5px] font-medium text-blue">
              <BadgeCheck className="size-3" /> Verified source
            </span>
          </div>
          <div className="mt-4 flex items-end gap-3">
            <p className="text-[40px] font-semibold leading-none tracking-tight text-foreground tabular">4.6</p>
            <div className="pb-1">
              <Stars rating={4.6} size={14} />
              <p className="mt-1 text-[12px] text-success-foreground">+0.3 vs last quarter</p>
            </div>
          </div>
          <div className="mt-4 h-[180px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={ratings} layout="vertical" margin={{ left: -10, right: 8 }}>
                <XAxis type="number" hide />
                <YAxis type="category" dataKey="r" tickLine={false} axisLine={false} tick={{ fontSize: 12, fill: "var(--muted-foreground)" }} width={44} />
                <Tooltip cursor={{ fill: "var(--muted)" }} contentStyle={{ borderRadius: 10, border: "1px solid var(--border)", background: "var(--popover)", fontSize: 12 }} formatter={(v) => [`${v} reviews`, ""]} />
                <Bar dataKey="v" radius={[0, 6, 6, 0]} barSize={14}>
                  {ratings.map((d) => (
                    <Cell key={d.r} fill={d.c} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="flex flex-col gap-4 lg:col-span-3">
          <div className="rounded-[20px] border border-border bg-card shadow-sm">
            <div className="flex items-center justify-between px-5 pt-5">
              <p className="text-[14px] font-semibold text-foreground">Location comparison</p>
              <span className="text-[12px] text-muted-foreground">Last 90 days · sample</span>
            </div>
            <div className="mt-3 overflow-x-auto">
              <table className="w-full text-[13px]">
                <thead>
                  <tr className="border-y border-border text-left text-[11px] uppercase tracking-wider text-subtle-foreground">
                    <th className="px-5 py-2.5 font-semibold">Location</th>
                    <th className="px-3 py-2.5 font-semibold">Rating</th>
                    <th className="px-3 py-2.5 font-semibold">Reviews</th>
                    <th className="px-3 py-2.5 font-semibold">Responded</th>
                    <th className="px-5 py-2.5 text-right font-semibold">Trend</th>
                  </tr>
                </thead>
                <tbody>
                  {locations.map((l) => (
                    <tr key={l.name} className="border-b border-border last:border-0">
                      <td className="px-5 py-3 font-medium text-foreground">{l.name}</td>
                      <td className="px-3 py-3 tabular text-foreground-soft">{l.rating}</td>
                      <td className="px-3 py-3 tabular text-foreground-soft">{l.reviews}</td>
                      <td className="px-3 py-3 tabular text-foreground-soft">{l.response}</td>
                      <td className="px-5 py-3 text-right">
                        <span className="inline-flex items-center gap-1 text-success-foreground"><TrendingUp className="size-3.5" />{l.trend}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-[20px] border border-border bg-card p-5 shadow-sm">
              <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-subtle-foreground">
                <BadgeCheck className="size-3.5 text-blue" /> Verified Google data
              </p>
              <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">Review count, star ratings and reply status synced from your connected Google Business Profile.</p>
            </div>
            <div className="rounded-[20px] border border-border bg-card p-5 shadow-sm">
              <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-subtle-foreground">
                <Calculator className="size-3.5 text-primary" /> Measured by ReviewPilot
              </p>
              <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">Requests sent, delivered, page opens and Google link clicks — never presented as reviews posted.</p>
            </div>
          </div>
        </div>
      </div>
    </Section>
  );
}
