import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/" },
    sitemap: "https://dascar.xyz/sitemap.xml",
    host: "https://dascar.xyz",
  };
}
