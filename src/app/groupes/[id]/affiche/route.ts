// Affiche d'invitation du groupe (gardée en mémoire 1 heure par le serveur : WhatsApp la reçoit tout de suite)
import { createClient } from "@supabase/supabase-js";
import { dessinerInvitation, type InfosGroupe } from "@/lib/server/afficheGroupe";

export const runtime = "nodejs";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let g: InfosGroupe | null = null;
  if (/^[0-9a-f-]{36}$/i.test(id)) {
    const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
    const { data } = await sb.rpc("groupe_apercu", { g: id });
    g = (data as InfosGroupe | null) ?? null;
  }
  const img = await dessinerInvitation(g);
  return new Response(new Uint8Array(img.data), { headers: { "Content-Type": img.type, "Cache-Control": "public, max-age=600, s-maxage=3600, stale-while-revalidate=86400" } });
}
