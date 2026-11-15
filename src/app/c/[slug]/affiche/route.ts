// Affiche dessinée à la demande (secours si l'affiche toute prête n'existe pas encore)
import { createClient } from "@supabase/supabase-js";
import { dessinerAffiche, type InfosAffiche } from "@/lib/server/afficheCagnotte";

export const runtime = "nodejs";

export async function GET(_: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  let c: InfosAffiche | null = null;
  if (/^[a-z0-9-]{3,60}$/.test(slug)) {
    const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
    const { data } = await sb.rpc("cagnotte_publique", { s: slug, compter: false });
    c = (data as InfosAffiche | null) ?? null;
  }
  const img = await dessinerAffiche(c);
  return new Response(new Uint8Array(img.data), { headers: { "Content-Type": img.type, "Cache-Control": "public, max-age=300, s-maxage=3600, stale-while-revalidate=86400" } });
}
