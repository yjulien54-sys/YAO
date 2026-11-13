/**
 * Agenda du planning (format iCalendar), à ajouter une fois dans Google Agenda ou le
 * Calendrier de l'iPhone : les horaires de l'agent apparaissent sur son téléphone et
 * se mettent à jour tout seuls.
 *   /api/planning/agenda?j=<jeton personnel>
 * Le jeton (long et secret) remplace le mot de passe ; le fondateur peut en créer un nouveau.
 * Heure de Côte d'Ivoire = heure UTC (pas de changement d'heure).
 */
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const echapper = (t: string) => t.replace(/\\/g, "\\\\").replace(/;/g, "\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
const dt = (jour: string, heure: string, plusUnJour = false) => {
  const d = new Date(`${jour}T${heure.slice(0, 5)}:00Z`);
  if (plusUnJour) d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
};
/** Les lignes iCalendar ne doivent pas dépasser 75 caractères */
const plier = (l: string) => l.length <= 74 ? l : l.match(/.{1,73}/g)!.join("\r\n ");

export async function GET(req: Request) {
  const jeton = new URL(req.url).searchParams.get("j") ?? "";
  if (!/^[0-9a-f]{36}$/.test(jeton) || !process.env.SUPABASE_SERVICE_ROLE_KEY) return new Response("Lien invalide", { status: 404 });
  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY);
  const { data: agent } = await sb.from("admins").select("email, nom, numero").eq("planning_jeton", jeton).maybeSingle();
  if (!agent) return new Response("Lien invalide", { status: 404 });

  const du = new Date(); du.setDate(du.getDate() - 30);
  const au = new Date(); au.setDate(au.getDate() + 120);
  const { data: creneaux } = await sb.from("planning_agents").select("id, jour, debut, fin, note, cree_le, modifie_le")
    .eq("email", agent.email.toLowerCase()).gte("jour", du.toISOString().slice(0, 10)).lte("jour", au.toISOString().slice(0, 10)).order("jour");

  const maintenant = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const lignes = [
    "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Cotiz//Planning//FR", "CALSCALE:GREGORIAN", "METHOD:PUBLISH",
    `X-WR-CALNAME:${echapper(`Cotiz · Planning ${agent.nom ?? ""}`.trim())}`, "X-WR-TIMEZONE:Africa/Abidjan",
    "REFRESH-INTERVAL;VALUE=DURATION:PT1H", "X-PUBLISHED-TTL:PT1H",
  ];
  for (const c of creneaux ?? []) {
    const nuit = c.fin.slice(0, 5) <= c.debut.slice(0, 5);
    lignes.push(
      "BEGIN:VEVENT",
      `UID:${c.id}@cotiz`,
      `DTSTAMP:${maintenant}`,
      `DTSTART:${dt(c.jour, c.debut)}`,
      `DTEND:${dt(c.jour, c.fin, nuit)}`,
      `SUMMARY:${echapper(`Cotiz · Service client${c.note ? ` (${c.note})` : ""}`)}`,
      `DESCRIPTION:${echapper(`Créneau de travail Cotiz pour ${agent.nom ?? agent.email}${agent.numero ? ` (n°${agent.numero})` : ""}.${c.note ? `\nNote : ${c.note}` : ""}\nAdmin : https://tontine-et-cotise.vercel.app/admin`)}`,
      `LAST-MODIFIED:${new Date(c.modifie_le ?? c.cree_le).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "")}`,
      "BEGIN:VALARM", "ACTION:DISPLAY", "DESCRIPTION:Ton service Cotiz commence dans 30 minutes", "TRIGGER:-PT30M", "END:VALARM",
      "END:VEVENT",
    );
  }
  lignes.push("END:VCALENDAR");
  return new Response(lignes.map(plier).join("\r\n") + "\r\n", {
    headers: { "Content-Type": "text/calendar; charset=utf-8", "Content-Disposition": 'inline; filename="cotiz-planning.ics"', "Cache-Control": "no-store" },
  });
}
