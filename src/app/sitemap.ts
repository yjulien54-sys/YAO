import { SITE } from "@/lib/site";
import type { MetadataRoute } from "next";

const site = SITE;

/** Plan du site pour Google (pages publiques) */
export default function sitemap(): MetadataRoute.Sitemap {
  const maintenant = new Date();
  return [
    { url: `${site}/`, lastModified: maintenant, changeFrequency: "weekly", priority: 1 },
    { url: `${site}/telecharger`, lastModified: maintenant, changeFrequency: "monthly", priority: 0.8 },
    { url: `${site}/aide`, lastModified: maintenant, changeFrequency: "monthly", priority: 0.7 },
    { url: `${site}/cgu`, lastModified: maintenant, changeFrequency: "yearly", priority: 0.3 },
    { url: `${site}/confidentialite`, lastModified: maintenant, changeFrequency: "yearly", priority: 0.3 },
    { url: `${site}/mentions-legales`, lastModified: maintenant, changeFrequency: "yearly", priority: 0.3 },
  ];
}
