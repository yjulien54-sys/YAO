import { NextResponse } from "next/server";

/**
 * Lien de vérification entre l'application Android (Play Store) et le site.
 * Variables Vercel : ANDROID_PACKAGE (ex : app.vercel.tontine_et_cotise.twa)
 * et ANDROID_SHA256 (empreinte(s) SHA-256 du certificat, séparées par des virgules).
 */
export const dynamic = "force-dynamic";

export function GET() {
  const pkg = process.env.ANDROID_PACKAGE;
  const fps = (process.env.ANDROID_SHA256 ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  const body = pkg && fps.length
    ? [{ relation: ["delegate_permission/common.handle_all_urls"], target: { namespace: "android_app", package_name: pkg, sha256_cert_fingerprints: fps } }]
    : [];
  return NextResponse.json(body);
}
