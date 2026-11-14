import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Fichiers lus au moment de fabriquer l'image d'aperçu des cagnottes (polices et logo)
  outputFileTracingIncludes: {
    "/c/[slug]/opengraph-image": ["./src/app/c/[slug]/polices/*.ttf", "./public/icons/icon-192.png"],
  },
};

export default nextConfig;
