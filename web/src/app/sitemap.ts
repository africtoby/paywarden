import type { MetadataRoute } from "next";

const SITE = "https://www.paywarden.me";

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  return [
    { url: `${SITE}/`, lastModified: now, changeFrequency: "weekly", priority: 1 },
    { url: `${SITE}/app`, lastModified: now, changeFrequency: "monthly", priority: 0.8 },
    { url: `${SITE}/app/runs`, lastModified: now, changeFrequency: "monthly", priority: 0.6 },
    { url: `${SITE}/app/payees`, lastModified: now, changeFrequency: "monthly", priority: 0.6 },
    { url: `${SITE}/app/assistant`, lastModified: now, changeFrequency: "monthly", priority: 0.6 },
    { url: `${SITE}/app/activity`, lastModified: now, changeFrequency: "monthly", priority: 0.5 },
  ];
}
