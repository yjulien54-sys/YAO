/**
 * Fabrique l'affiche d'une cagnotte et la range dans le stockage (image toute prête).
 * WhatsApp la reçoit alors instantanément, au lieu d'attendre qu'elle soit dessinée.
 * Nécessite SUPABASE_SERVICE_ROLE_KEY (déjà dans Vercel) et la mise à jour SQL n°41.
 */
import { createClient } from "@supabase/supabase-js";
import { dessinerAffiche, type InfosAffiche } from "./afficheCagnotte";

type Cagnotte = InfosAffiche & { id: string; apercu?: string | null; apercu_le?: string | null };

export async function regenererAffiche(slug: string, force = false): Promise<string | null> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL, cle = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !cle || !/^[a-z0-9-]{3,60}$/.test(slug)) return null;
  const sb = createClient(url, cle, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data } = await sb.rpc("cagnotte_publique", { s: slug, compter: false });
  const c = data as Cagnotte | null;
  if (!c) return null;
  // Pas plus d'une fois par minute (évite les abus)
  if (!force && c.apercu && c.apercu_le && Date.now() - new Date(c.apercu_le).getTime() < 60_000) return c.apercu;

  const img = await dessinerAffiche(c);
  const dossier = `apercus/${c.id}`;
  const chemin = `${dossier}/${Date.now()}.${img.type === "image/jpeg" ? "jpg" : "png"}`;
  const { error } = await sb.storage.from("cagnottes").upload(chemin, img.data, { contentType: img.type, cacheControl: "31536000", upsert: true });
  if (error) { console.error("Affiche cagnotte : envoi impossible", error.message); return c.apercu ?? null; }
  const lien = sb.storage.from("cagnottes").getPublicUrl(chemin).data.publicUrl;
  const { error: e2 } = await sb.from("groups").update({ public_apercu: lien, public_apercu_le: new Date().toISOString() }).eq("id", c.id);
  if (e2) { console.error("Affiche cagnotte : enregistrement impossible (SQL n°41 ?)", e2.message); return lien; }
  // On efface les anciennes affiches de cette cagnotte
  const { data: anciens } = await sb.storage.from("cagnottes").list(dossier, { limit: 50 });
  const aSupprimer = (anciens ?? []).map((f) => `${dossier}/${f.name}`).filter((p) => p !== chemin);
  if (aSupprimer.length) await sb.storage.from("cagnottes").remove(aSupprimer);
  return lien;
}
