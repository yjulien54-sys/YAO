import type { NextConfig } from "next";

// En-têtes de sécurité envoyés avec chaque page
const prod = process.env.NODE_ENV === "production";
const CSP = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${prod ? "" : " 'unsafe-eval'"}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "media-src 'self' blob: https:",
  "font-src 'self' data:",
  "connect-src 'self' https://*.supabase.co wss://*.supabase.co",
  "worker-src 'self'",
  "manifest-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self' https:",
  "frame-ancestors 'none'",
  ...(prod ? ["upgrade-insecure-requests"] : []),
].join("; ");
const ENTETES = [
  { key: "Content-Security-Policy", value: CSP },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(self), microphone=(self), geolocation=(), payment=(), usb=(), interest-cohort=()" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin-allow-popups" },
];

const nextConfig: NextConfig = {
  poweredByHeader: false, // ne pas annoncer la technologie utilisée
  productionBrowserSourceMaps: false, // pas de code source lisible en production
  async headers() {
    return [
      { source: "/:path*", headers: ENTETES },
      // Les réponses de l'API ne sont jamais gardées en cache
      { source: "/api/:path*", headers: [{ key: "Cache-Control", value: "no-store" }] },
    ];
  },
  // Numéro de la version en ligne : sert à recharger l'application quand une nouvelle version sort
  env: { NEXT_PUBLIC_VERSION: process.env.VERCEL_GIT_COMMIT_SHA ?? "local" },
  // Fichiers lus au moment de fabriquer l'image d'aperçu des cagnottes (polices et logo)
  outputFileTracingIncludes: {
    "/c/[slug]/opengraph-image": ["./public/polices/*.ttf", "./public/icons/icon-192.png", "./public/operateurs/*.png"],
    "/c/[slug]/affiche": ["./public/polices/*.ttf", "./public/icons/icon-192.png", "./public/operateurs/*.png"],
    "/c/[slug]": ["./public/polices/*.ttf", "./public/icons/icon-192.png", "./public/operateurs/*.png"],
    "/api/cagnotte/affiche": ["./public/polices/*.ttf", "./public/icons/icon-192.png", "./public/operateurs/*.png"],
    "/groupes/[id]/affiche": ["./public/polices/*.ttf", "./public/icons/icon-192.png", "./public/operateurs/*.png"],
    "/opengraph-image": ["./public/polices/*.ttf", "./public/icons/icon-512.png", "./public/icons/icon-192.png", "./public/operateurs/*.png"],
  },
  // Ancien lien de téléchargement de l'application Android
  async redirects() {
    return [{ source: "/app/cotiz.apk", destination: "/app/sikaklo.apk", permanent: false }];
  },
};

export default nextConfig;
