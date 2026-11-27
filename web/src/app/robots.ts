import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/", disallow: "/confirm" },
    sitemap: "https://www.paywarden.me/sitemap.xml",
    host: "https://www.paywarden.me",
  };
}
