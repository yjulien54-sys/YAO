/**
 * Image d'aperçu de la cagnotte (celle que WhatsApp, Facebook… affichent quand on partage le lien).
 * Générée automatiquement pour chaque cagnotte : photo, logo Cotiz, titre, montant et jauge,
 * avec une bande de motifs aux couleurs de Cotiz.
 */
import { ImageResponse } from "next/og";
import sharp from "sharp";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { createClient } from "@supabase/supabase-js";
import { phraseMotif } from "@/lib/motif";

export const runtime = "nodejs";
export const alt = "Cagnotte Cotiz";
export const size = { width: 1200, height: 630 };
// JPEG léger (moins de 300 Ko) : au-delà, WhatsApp n'affiche pas l'aperçu
export const contentType = "image/jpeg";

type Infos = { nom: string; cause: string | null; message: string | null; description: string | null; photo: string | null; objectif: number | null; collecte: number; donateurs_nb: number; tresorier: string | null };

const fcfa = (n: number) => `${Math.round(n).toLocaleString("fr-FR").replace(/[  ]/g, " ")} F CFA`;
const VERT = "#009e60", ORANGE = "#f77f00", OR = "#f5c400";

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  let c: Infos | null = null;
  if (/^[a-z0-9-]{3,60}$/.test(slug)) {
    const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
    const { data } = await sb.rpc("cagnotte_publique", { s: slug, compter: false });
    c = (data as Infos | null) ?? null;
  }
  // Fichiers locaux : si l'un manque, l'image se fabrique quand même (police par défaut, sans logo)
  const lire = (chemin: string) => readFile(join(process.cwd(), chemin)).catch(() => null);
  const [icone, gras, moyen] = await Promise.all([lire("public/icons/icon-192.png"), lire("public/polices/PlusJakartaSans-ExtraBold.ttf"), lire("public/polices/PlusJakartaSans-Medium.ttf")]);
  const ops = (await Promise.all(["wave", "orange", "mtn", "moov"].map((n) => lire(`public/operateurs/${n}.png`))))
    .flatMap((b) => (b ? [`data:image/png;base64,${b.toString("base64")}`] : []));
  const logo = icone ? `data:image/png;base64,${icone.toString("base64")}` : null;
  const pct = c?.objectif ? Math.min(100, Math.round((c.collecte / c.objectif) * 100)) : null;
  const titre = c?.nom ?? "Cagnotte Cotiz";
  // Titre : plus il est long, plus il est petit (3 lignes maximum, jamais sur le montant)
  // Le motif : une phrase courte qui explique pourquoi on collecte (tirée du message du trésorier)
  const motifTexte = phraseMotif(c?.message ?? c?.description, 95);
  const taille = motifTexte
    ? (titre.length > 52 ? 34 : titre.length > 34 ? 40 : 50)
    : (titre.length > 70 ? 36 : titre.length > 52 ? 40 : titre.length > 34 ? 48 : 58);
  const lignesTitre = motifTexte ? 2 : 3;

  // Bande de motifs (inspirée du kente) : petits blocs vert, or, orange, noir
  const motif = Array.from({ length: 48 }, (_, k) => [VERT, OR, ORANGE, "#1c1917", VERT, ORANGE][k % 6]);

  const png = new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", background: "linear-gradient(135deg, #3a7a62 0%, #2f6b55 55%, #295f4c 100%)", fontFamily: "Jakarta", fontWeight: 500 }}>
        {/* Photo */}
        <div style={{ width: 560, height: "100%", display: "flex", position: "relative", background: "#2f6b55" }}>
          {c?.photo
            ? <img src={c.photo} alt="" width={560} height={630} style={{ width: 560, height: 630, objectFit: "cover" }} />
            : (
              <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>
                {logo ? <img src={logo} alt="" width={200} height={200} style={{ borderRadius: 48 }} /> : <span style={{ fontSize: 96, fontWeight: 800, color: "white" }}>Cotiz</span>}
              </div>
            )}
          <div style={{ position: "absolute", top: 0, right: 0, width: 12, height: "100%", display: "flex", flexDirection: "column" }}>
            {motif.slice(0, 18).map((col, k) => <div key={k} style={{ flex: 1, background: col }} />)}
          </div>
        </div>

        {/* Texte */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", padding: "48px 56px 0 52px", color: "white", position: "relative" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            {logo && <img src={logo} alt="" width={64} height={64} style={{ borderRadius: 16 }} />}
            <div style={{ display: "flex", flexDirection: "column" }}>
              <span style={{ fontSize: 38, fontWeight: 800, letterSpacing: -1 }}>Cotiz</span>
              <span style={{ fontSize: 18, color: "#d3eee2", letterSpacing: 3 }}>CAGNOTTE</span>
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", marginTop: 24 }}>
            {c?.cause && <span style={{ fontSize: 22, fontWeight: 700, color: ORANGE, letterSpacing: 3, textTransform: "uppercase" }}>{c.cause}</span>}
            <span style={{ fontSize: taille, fontWeight: 800, lineHeight: 1.1, letterSpacing: -1, marginTop: 8, maxHeight: taille * 1.1 * lignesTitre, overflow: "hidden" }}>{titre}</span>
            {motifTexte && <span style={{ fontSize: 23, lineHeight: 1.3, color: "#e3f3ec", marginTop: 12, maxHeight: 23 * 1.3 * 2, overflow: "hidden" }}>{motifTexte}</span>}
          </div>

          {c && (
            <div style={{ display: "flex", flexDirection: "column", marginTop: "auto", marginBottom: 40, paddingTop: 14 }}>
              <span style={{ fontSize: 44, fontWeight: 800, color: "white", letterSpacing: -1 }}>{fcfa(c.collecte)}</span>
              <span style={{ fontSize: 22, color: "#e3f3ec", marginTop: 2 }}>
                {c.objectif ? `collectés sur ${fcfa(c.objectif)}` : "collectés"} · {c.donateurs_nb} participant{c.donateurs_nb > 1 ? "s" : ""}
              </span>
              {pct != null && (
                <div style={{ display: "flex", marginTop: 18, width: "100%", height: 16, borderRadius: 999, background: "rgba(255,255,255,0.22)" }}>
                  <div style={{ width: `${Math.max(pct, 3)}%`, height: 16, borderRadius: 999, background: `linear-gradient(90deg, ${ORANGE}, ${OR})` }} />
                </div>
              )}
              <div style={{ display: "flex", alignItems: "center", marginTop: 26, gap: 16 }}>
                <div style={{ display: "flex", background: ORANGE, color: "white", fontSize: 26, fontWeight: 800, padding: "14px 34px", borderRadius: 999 }}>Participer</div>
                {ops.length === 4
                  ? <div style={{ display: "flex", gap: 10 }}>{ops.map((src, k) => <img key={k} src={src} alt="" width={50} height={50} style={{ borderRadius: 12, background: "white" }} />)}</div>
                  : <span style={{ fontSize: 20, color: "#e3f3ec" }}>Wave · Orange · MTN · Moov</span>}
              </div>
            </div>
          )}

          {/* Motifs en bas */}
          <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: 14, display: "flex" }}>
            {motif.slice(0, 24).map((col, k) => <div key={k} style={{ flex: 1, background: col }} />)}
          </div>
        </div>
      </div>
    ),
    { ...size, fonts: gras && moyen ? [{ name: "Jakarta", data: gras, weight: 800, style: "normal" }, { name: "Jakarta", data: moyen, weight: 500, style: "normal" }] : undefined },
  );
  const brut = Buffer.from(await png.arrayBuffer());
  try {
    const jpeg = await sharp(brut).jpeg({ quality: 78, mozjpeg: true, chromaSubsampling: "4:2:0" }).toBuffer();
    return new Response(new Uint8Array(jpeg), { headers: { "Content-Type": "image/jpeg", "Cache-Control": "public, max-age=600, s-maxage=600" } });
  } catch {
    return new Response(new Uint8Array(brut), { headers: { "Content-Type": "image/png", "Cache-Control": "public, max-age=600" } });
  }
}
