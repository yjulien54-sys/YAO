// Numéro de la version actuellement en ligne (comparé par l'application pour se mettre à jour toute seule)
export const dynamic = "force-dynamic";
export function GET() {
  return Response.json({ v: process.env.VERCEL_GIT_COMMIT_SHA ?? "local" }, { headers: { "Cache-Control": "no-store" } });
}
