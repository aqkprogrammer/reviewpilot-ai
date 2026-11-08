import type { MetadataRoute } from "next";
import { SOLUTIONS } from "@/components/marketing/solutions-data";
import { POSTS } from "@/components/marketing/blog-data";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  const staticRoutes: Array<[string, number, MetadataRoute.Sitemap[number]["changeFrequency"]]> = [
    ["", 1, "weekly"],
    ["/features", 0.9, "monthly"],
    ["/solutions", 0.8, "monthly"],
    ["/pricing", 0.9, "monthly"],
    ["/about", 0.5, "yearly"],
    ["/contact", 0.5, "yearly"],
    ["/blog", 0.7, "weekly"],
    ["/faq", 0.6, "monthly"],
    ["/privacy", 0.3, "yearly"],
    ["/terms", 0.3, "yearly"],
    ["/signup", 0.6, "yearly"],
    ["/login", 0.4, "yearly"],
  ];
  return [
    ...staticRoutes.map(([path, priority, changeFrequency]) => ({ url: `${SITE_URL}${path}`, lastModified: now, changeFrequency, priority })),
    ...SOLUTIONS.map((s) => ({ url: `${SITE_URL}/solutions/${s.slug}`, lastModified: now, changeFrequency: "monthly" as const, priority: 0.7 })),
    ...POSTS.map((p) => ({ url: `${SITE_URL}/blog/${p.slug}`, lastModified: new Date(p.date), changeFrequency: "yearly" as const, priority: 0.6 })),
  ];
}
