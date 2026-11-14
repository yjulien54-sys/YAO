import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Numéro de la version en ligne : sert à recharger l'application quand une nouvelle version sort
  env: { NEXT_PUBLIC_VERSION: process.env.VERCEL_GIT_COMMIT_SHA ?? "local" },
  // Fichiers lus au moment de fabriquer l'image d'aperçu des cagnottes (polices et logo)
  outputFileTracingIncludes: {
    "/c/[slug]/opengraph-image": ["./public/polices/*.ttf", "./public/icons/icon-192.png"],
  },
};

export default nextConfig;
