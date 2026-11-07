import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Cotiz — Tontines & cotisations",
    short_name: "Cotiz",
    description: "Tontines, associations et collectes, en toute transparence.",
    start_url: "/groupes",
    display: "standalone",
    background_color: "#f7f5f0",
    id: "/",
    theme_color: "#009e60",
    lang: "fr",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    categories: ["finance", "productivity", "social"],
    orientation: "portrait",
  };
}
