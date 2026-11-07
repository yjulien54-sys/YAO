import { NextResponse } from "next/server";

/**
 * Lien de vérification entre l'application Android (Play Store) et le site.
 * Variables Vercel : ANDROID_PACKAGE (ex : app.vercel.tontine_et_cotise.twa)
 * et ANDROID_SHA256 (empreinte(s) SHA-256 du certificat, séparées par des virgules).
 */
export const dynamic = "force-dynamic";

export function GET() {
  // Valeurs publiques de l'application Cotiz (clé d'envoi). Ajouter dans ANDROID_SHA256 l'empreinte
  // « Clé de signature d'application » affichée par la Play Console (Intégrité de l'application).
  const pkg = process.env.ANDROID_PACKAGE ?? "ci.cotiz.app";
  const fps = [
    "81:3E:D3:FC:79:54:DF:F5:63:57:6E:25:91:6B:3D:64:7E:B8:A2:D1:7B:DF:A4:24:14:96:9A:FA:9F:5E:2C:70",
    ...(process.env.ANDROID_SHA256 ?? "").split(",").map((s) => s.trim()).filter(Boolean),
  ];
  const body = pkg && fps.length
    ? [{ relation: ["delegate_permission/common.handle_all_urls"], target: { namespace: "android_app", package_name: pkg, sha256_cert_fingerprints: fps } }]
    : [];
  return NextResponse.json(body);
}
