import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const allowIndex = process.env.NEXT_PUBLIC_ALLOW_INDEXING === "true";
  return {
    rules: {
      userAgent: "*",
      allow: allowIndex ? "/" : undefined,
      disallow: allowIndex ? undefined : "/"
    }
  };
}
