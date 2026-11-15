import type { MetadataRoute } from "next";

const site = process.env.NEXT_PUBLIC_SITE_URL ?? "https://tontine-et-cotise.vercel.app";

/** Ce que Google peut lire : les pages publiques. Les espaces privés (groupes, profil, admin) restent cachés. */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: "*", allow: ["/", "/c/"], disallow: ["/admin", "/api/", "/groupes", "/profil", "/notifications", "/activite", "/r/"] }],
    sitemap: `${site}/sitemap.xml`,
    host: site,
  };
}
