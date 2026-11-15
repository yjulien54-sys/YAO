/* eslint-disable @next/next/no-img-element */
/**
 * Affiche d'invitation d'un groupe : l'image qui apparaît quand on partage le lien d'un groupe
 * (tontine, association, collecte). Nom du groupe, cotisation, nombre de membres, trésorier,
 * dans le style propre au groupe (le même à chaque partage).
 */
import { ImageResponse } from "next/og";
import sharp from "sharp";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { parFrequence } from "@/lib/logic";
import { THEMES, themePour } from "@/lib/themesAffiche";
import type { Group } from "@/lib/types";

export type InfosGroupe = { id: string; nom: string; type: Group["type"]; montant: number | null; frequence: Group["frequency"]; membres: number; tresorier: string | null; theme: number | null; objectif: number | null };

const TYPE: Record<Group["type"], string> = { tontine: "TONTINE", association: "ASSOCIATION", collecte: "COLLECTE" };
const fcfa = (n: number) => `${Math.round(n).toLocaleString("fr-FR").replace(/[  ]/g, " ")} F`;
// Initiales parlantes : on saute « Tontine », « des », « de »… (« Tontine des amies de Man-Grédan » → « AM »)
const VIDES = new Set(["tontine", "association", "collecte", "cagnotte", "groupe", "mutuelle", "des", "de", "du", "la", "le", "les", "et", "pour", "au", "aux", "d", "l"]);
const initiales = (n: string) => n.trim().split(/[\s'’]+/).filter((m) => m && !VIDES.has(m.toLowerCase())).slice(0, 2).map((m) => m[0]?.toUpperCase()).join("") || n.trim()[0]?.toUpperCase() || "C";

export async function dessinerInvitation(g: InfosGroupe | null): Promise<{ data: Buffer; type: "image/jpeg" | "image/png" }> {
  const lire = (chemin: string) => readFile(join(process.cwd(), chemin)).catch(() => null);
  const [icone, gras, moyen] = await Promise.all([lire("public/icons/icon-192.png"), lire("public/polices/PlusJakartaSans-ExtraBold.ttf"), lire("public/polices/PlusJakartaSans-Medium.ttf")]);
  const ops = (await Promise.all(["wave", "orange", "mtn", "moov"].map((n) => lire(`public/operateurs/${n}.png`)))).flatMap((b) => (b ? [`data:image/png;base64,${b.toString("base64")}`] : []));
  const logo = icone ? `data:image/png;base64,${icone.toString("base64")}` : null;
  const t = THEMES[themePour(g?.id, g?.theme)];
  const motif = Array.from({ length: 30 }, (_, k) => t.motif[k % t.motif.length]);
  const nom = g?.nom ?? "Votre groupe Cotiz";
  const taille = nom.length > 48 ? 46 : nom.length > 30 ? 54 : 64;
  const montant = g?.type === "collecte"
    ? (g.objectif ? `Objectif ${fcfa(g.objectif)}` : "Participation libre")
    : g?.montant ? `${fcfa(g.montant)} / ${parFrequence(g.frequence)}` : null;
  const membres = g?.membres ?? 0;
  const pastilles: [string, string][] = [["#fde7d0", "#c2410c"], ["#dbeafe", "#1d4ed8"], ["#ede9fe", "#6d28d9"], ["#dcfce7", "#047857"]];

  const png = new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", background: t.fond, color: t.texte, fontFamily: "Jakarta", fontWeight: 500, position: "relative" }}>
        <div style={{ position: "absolute", right: -140, top: -160, width: 560, height: 560, borderRadius: 999, background: "rgba(255,255,255,0.07)", display: "flex" }} />
        <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 14, display: "flex", flexDirection: "column" }}>
          {motif.slice(0, 15).map((c, k) => <div key={k} style={{ flex: 1, background: c }} />)}
        </div>

        {/* Texte */}
        <div style={{ display: "flex", flexDirection: "column", padding: "56px 0 0 74px", width: 720 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            {logo && <img src={logo} alt="" width={64} height={64} style={{ borderRadius: 16 }} />}
            <div style={{ display: "flex", flexDirection: "column" }}>
              <span style={{ fontSize: 38, fontWeight: 800, letterSpacing: -1 }}>Cotiz</span>
              <span style={{ fontSize: 18, color: t.etiquette, letterSpacing: 3 }}>INVITATION</span>
            </div>
          </div>
          <span style={{ marginTop: 40, fontSize: 24, fontWeight: 800, letterSpacing: 4, color: t.accent }}>{TYPE[g?.type ?? "tontine"]}</span>
          <span style={{ marginTop: 6, fontSize: taille, fontWeight: 800, lineHeight: 1.06, letterSpacing: -1.5, maxHeight: taille * 1.06 * 3, overflow: "hidden" }}>{nom}</span>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 12, marginTop: 24 }}>
            {montant && <div style={{ display: "flex", padding: "10px 20px", borderRadius: 999, background: t.piste, fontSize: 24, fontWeight: 800 }}>{montant}</div>}
            {membres > 0 && <div style={{ display: "flex", padding: "10px 20px", borderRadius: 999, background: t.piste, fontSize: 24, fontWeight: 800 }}>{membres} membre{membres > 1 ? "s" : ""}</div>}
          </div>
          {g?.tresorier && <span style={{ marginTop: 18, fontSize: 22, color: t.texte2 }}>Trésorier : {g.tresorier}</span>}
          <div style={{ display: "flex", alignItems: "center", gap: 16, marginTop: "auto", marginBottom: 54 }}>
            <div style={{ display: "flex", background: t.bouton, color: t.boutonTexte, fontSize: 28, fontWeight: 800, padding: "16px 36px", borderRadius: 999 }}>Rejoindre le groupe</div>
            {ops.length === 4 && <div style={{ display: "flex", gap: 8 }}>{ops.map((src, k) => <img key={k} src={src} alt="" width={46} height={46} style={{ borderRadius: 12, background: "white" }} />)}</div>}
          </div>
        </div>

        {/* Carte du groupe */}
        <div style={{ position: "absolute", right: 64, top: 110, width: 360, display: "flex", flexDirection: "column", alignItems: "center", background: "white", borderRadius: 36, padding: "40px 30px", color: "#1c1917", boxShadow: "0 30px 60px rgba(0,0,0,0.3)" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 132, height: 132, borderRadius: 40, background: t.pastille, color: t.texte, fontSize: 56, fontWeight: 800, border: "6px solid #f5f5f4" }}>{initiales(nom)}</div>
          <div style={{ display: "flex", alignItems: "center", marginTop: 28 }}>
            {pastilles.map(([bg, fg], k) => (
              <div key={k} style={{ display: "flex", width: 52, height: 52, borderRadius: 999, background: bg, border: "4px solid white", marginLeft: k ? -14 : 0, alignItems: "center", justifyContent: "center" }}>
                <div style={{ display: "flex", width: 18, height: 18, borderRadius: 999, background: fg }} />
              </div>
            ))}
            {membres > 4 && <div style={{ display: "flex", width: 52, height: 52, borderRadius: 999, background: "#1c1917", color: "white", border: "4px solid white", marginLeft: -14, alignItems: "center", justifyContent: "center", fontSize: 18, fontWeight: 800 }}>+{Math.min(99, membres - 4)}</div>}
          </div>
          <span style={{ marginTop: 22, fontSize: 22, fontWeight: 800, color: "#0b3d2c", textAlign: "center" }}>Chacun voit qui a payé</span>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 14, padding: "8px 16px", borderRadius: 999, background: "#dcfce7", color: "#047857", fontSize: 19, fontWeight: 800 }}>
            <div style={{ display: "flex", width: 12, height: 12, borderRadius: 999, background: "#009e60" }} />Transparent et sécurisé
          </div>
        </div>

        <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: 14, display: "flex" }}>
          {motif.map((c, k) => <div key={k} style={{ flex: 1, background: c }} />)}
        </div>
      </div>
    ),
    { width: 1200, height: 630, fonts: gras && moyen ? [{ name: "Jakarta", data: gras, weight: 800, style: "normal" }, { name: "Jakarta", data: moyen, weight: 500, style: "normal" }] : undefined },
  );
  const brut = Buffer.from(await png.arrayBuffer());
  try {
    return { data: await sharp(brut).jpeg({ quality: 82, mozjpeg: true, chromaSubsampling: "4:2:0" }).toBuffer(), type: "image/jpeg" };
  } catch {
    return { data: brut, type: "image/png" };
  }
}
