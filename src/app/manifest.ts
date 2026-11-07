import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Cotiz — Tontines & cotisations",
    short_name: "Cotiz",
    description: "Tontines, associations et collectes, en toute transparence.",
    start_url: "/groupes",
    display: "standalone",
    background_color: "#fafaf9",
    theme_color: "#2563eb",
    lang: "fr",
    icons: [{ src: "/favicon.ico", sizes: "any", type: "image/x-icon" }],
  };
}
