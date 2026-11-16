import { SITE } from "@/lib/site";
import type { MetadataRoute } from "next";

const site = SITE;

/** Ce que Google peut lire : les pages publiques. Les groupes et reçus portent « noindex » (aperçus WhatsApp autorisés, mais pas dans Google). */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: "*", allow: ["/", "/c/"], disallow: ["/admin", "/api/", "/profil", "/notifications", "/activite"] }],
    sitemap: `${site}/sitemap.xml`,
    host: site,
  };
}
