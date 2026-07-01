import type { MetadataRoute } from "next";
import { getReliabilityGuides } from "@/lib/reliability";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = "https://dascar.xyz";
  return [
    {
      url: base,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 1,
    },
    {
      url: `${base}/reliability`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.8,
    },
    ...getReliabilityGuides().map((g) => ({
      url: `${base}/reliability/${g.slug}`,
      lastModified: new Date(),
      changeFrequency: "monthly" as const,
      priority: 0.6,
    })),
  ];
}
