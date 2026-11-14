"use client";

/** Écran du trésorier : rendre sa collecte publique (photo, message, jauge) et partager le lien sur WhatsApp */
import { useCallback, useEffect, useState } from "react";
import { Camera, ExternalLink, Eye, Globe, Loader2 } from "lucide-react";
import { supabase } from "@/lib/supabase";

type Etat = { slug: string | null; actif: boolean; photo: string | null; montants: boolean; message: string | null; fin: string | null; vues: number };

export function CagnottePublique({ groupId, nom }: { groupId: string; nom: string }) {
  const [etat, setEtat] = useState<Etat | null | undefined>(undefined);
  const [message, setMessage] = useState("");
  const [montants, setMontants] = useState(true);
  const [fin, setFin] = useState("");
  const [photo, setPhoto] = useState<string | null>(null);
  const [envoi, setEnvoi] = useState(false);
  const [msg, setMsg] = useState("");

  const charger = useCallback(async () => {
    const { data, error } = await supabase.rpc("cagnotte_etat", { g: groupId });
    if (error) return setEtat(null);
    const e = data as Etat;
    setEtat(e); setMessage(e?.message ?? ""); setMontants(e?.montants ?? true); setFin(e?.fin ?? ""); setPhoto(e?.photo ?? null);
  }, [groupId]);
  useEffect(() => { charger(); }, [charger]);

  if (etat === undefined) return null;
  if (etat === null) return <p className="rounded-2xl bg-amber-50 p-3 text-sm text-amber-900">Pour publier ta cagnotte sur une belle page à partager, l’administrateur Cotiz doit faire la mise à jour n°37.</p>;

  const lien = etat.slug ? `${window.location.origin}/c/${etat.slug}` : "";
  const enregistrer = async (actif: boolean, nouvellePhoto: string | null = photo) => {
    setEnvoi(true); setMsg("");
    const { data, error } = await supabase.rpc("cagnotte_publier", { g: groupId, actif, montants, message: message || null, photo: nouvellePhoto ?? "", fin: fin || null });
    setEnvoi(false);
    if (error) return setMsg("Erreur : " + error.message);
    setMsg(actif ? "Ta cagnotte est en ligne : partage le lien sur WhatsApp !" : "La page publique est retirée.");
    setEtat({ ...etat, slug: data as string, actif, photo: nouvellePhoto, montants, message, fin: fin || null });
  };
  const choisirPhoto = async (f: File | undefined) => {
    if (!f) return;
    if (f.size > 30 * 1024 * 1024) return setMsg("Photo trop lourde (30 Mo maximum).");
    setEnvoi(true); setMsg("Photo en cours d’amélioration…");
    // Photo réduite (1600 px max) et embellie automatiquement : lumière, couleurs, netteté
    const prete = await preparerPhoto(f).catch(() => null);
    const fichier: Blob = prete ?? f;
    const ext = prete ? "jpg" : (f.name.split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "");
    if (!prete && !/^(jpe?g|png|webp)$/.test(ext)) { setEnvoi(false); return setMsg("Ce format de photo n’est pas lu par ce navigateur. Choisis une photo JPG ou PNG (ou fais une capture d’écran de la photo)."); }
    if (!prete && f.size > 4 * 1024 * 1024) { setEnvoi(false); return setMsg("Photo trop lourde pour ce téléphone : choisis une photo plus petite."); }
    const chemin = `${groupId}/couverture-${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from("cagnottes").upload(chemin, fichier, { upsert: false, contentType: prete ? "image/jpeg" : f.type || "image/jpeg", cacheControl: "31536000" });
    if (error) { setEnvoi(false); return setMsg("Erreur photo : " + (error.message.includes("row-level") || error.message.includes("policy") ? "colle la dernière version de COLLER-DANS-SUPABASE.sql dans Supabase (mise à jour n°37)." : error.message)); }
    const url = supabase.storage.from("cagnottes").getPublicUrl(chemin).data.publicUrl;
    setPhoto(url);
    // La photo est enregistrée tout de suite (page publiée ou non)
    const { error: e2 } = await supabase.rpc("cagnotte_publier", { g: groupId, actif: etat.actif, montants, message: message || null, photo: url, fin: fin || null });
    setEnvoi(false);
    if (e2) return setMsg("Erreur : " + e2.message);
    setEtat({ ...etat, photo: url });
    setMsg(prete ? "Photo ajoutée et embellie ✓" : "Photo ajoutée ✓");
  };
  const texte = `🙏 ${nom}\n\n${message || "Je vous invite à participer à cette cagnotte."}\n\nParticipe ici (Wave, Orange Money, MTN, Moov) 👇\n${lien}`;

  return (
    <div className="space-y-3">
      <div className="relative overflow-hidden rounded-2xl bg-stone-100" style={{ aspectRatio: "16 / 8" }}>
        {photo
          // eslint-disable-next-line @next/next/no-img-element
          ? <img src={photo} alt="" className="absolute inset-0 h-full w-full object-cover" />
          : <div className="degrade-vert absolute inset-0"><div className="motif absolute inset-0 opacity-30" /></div>}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
        <p className="absolute bottom-3 left-3 right-3 truncate text-lg font-extrabold text-white drop-shadow">{nom}</p>
        <label className="absolute right-3 top-3 inline-flex cursor-pointer items-center gap-1.5 rounded-full bg-white/90 px-3 py-1.5 text-xs font-bold text-stone-800 shadow">
          {envoi ? <Loader2 size={14} className="animate-spin" /> : <Camera size={14} />} {photo ? "Changer la photo" : "Ajouter une photo"}
          <input type="file" accept="image/*" className="hidden" onChange={(e) => choisirPhoto(e.target.files?.[0])} />
        </label>
      </div>
      <textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={3} maxLength={600} placeholder="Un mot pour ceux qui reçoivent le lien (ex : Soutenons la famille de Koffi pour les funérailles de sa maman…)" className="w-full resize-y rounded-[14px] border border-stone-300/80 bg-white px-3 py-3 text-base outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100" />
      <div className="grid grid-cols-2 gap-2">
        <label className="flex items-center gap-2 rounded-xl bg-stone-50 p-3 text-sm"><input type="checkbox" checked={montants} onChange={(e) => setMontants(e.target.checked)} className="h-4 w-4 accent-emerald-700" /> Afficher les montants des participants</label>
        <label className="text-xs font-semibold text-stone-600">Date de fin (facultatif)<input type="date" value={fin} onChange={(e) => setFin(e.target.value)} className="mt-1 w-full rounded-xl border border-stone-300/80 bg-white px-3 py-2 text-sm" /></label>
      </div>
      {etat.actif && lien ? (
        <div className="space-y-2 rounded-2xl bg-emerald-50 p-3 ring-1 ring-emerald-200">
          <p className="flex items-center gap-1.5 text-sm font-bold text-emerald-800"><Globe size={15} /> En ligne · <Eye size={14} /> {etat.vues} vue{etat.vues > 1 ? "s" : ""}</p>
          <p className="truncate rounded-lg bg-white px-2.5 py-2 text-xs text-stone-600 ring-1 ring-emerald-100">{lien}</p>
          <div className="grid grid-cols-3 gap-2">
            <a href={`https://wa.me/?text=${encodeURIComponent(texte)}`} target="_blank" rel="noopener" className="rounded-xl bg-[#1fa855] py-2.5 text-center text-sm font-bold text-white">WhatsApp</a>
            <a href={lien} target="_blank" rel="noopener" className="inline-flex items-center justify-center gap-1 rounded-xl bg-white py-2.5 text-sm font-bold text-emerald-800 ring-1 ring-emerald-200"><ExternalLink size={14} /> Voir</a>
            <button onClick={() => enregistrer(true)} disabled={envoi} className="rounded-xl bg-emerald-700 py-2.5 text-sm font-bold text-white disabled:opacity-50">Mettre à jour</button>
          </div>
          <button onClick={() => { if (confirm("Retirer la page publique ? Le lien ne marchera plus.")) enregistrer(false); }} className="text-xs text-stone-500 underline">Retirer la page publique</button>
        </div>
      ) : (
        <button onClick={() => enregistrer(true)} disabled={envoi} className="w-full rounded-2xl bg-gradient-to-r from-orange-500 to-orange-600 py-3.5 text-base font-extrabold text-white shadow-lg disabled:opacity-50">🌍 Publier ma cagnotte</button>
      )}
      <p className="text-xs text-stone-500">Toute personne qui a le lien voit la page (photo, jauge, prénoms des participants) et peut participer : elle entre directement dans la collecte. Les numéros de téléphone ne sont jamais affichés.</p>
      {msg && <p className={`text-sm font-medium ${msg.startsWith("Erreur") || msg.includes("lourde") ? "text-red-600" : "text-emerald-700"}`}>{msg}</p>}
    </div>
  );
}

/**
 * Prépare une photo de couverture, gratuitement, sur le téléphone :
 * 1. réduit à 1600 px maximum (page rapide, aperçu WhatsApp qui s'affiche) ;
 * 2. embellit automatiquement : lumière corrigée (photos trop sombres ou trop claires),
 *    balance des blancs douce, contraste et couleurs un peu plus vifs, légère netteté.
 */
async function preparerPhoto(f: File): Promise<Blob> {
  const bitmap = await createImageBitmap(f, { imageOrientation: "from-image" } as ImageBitmapOptions);
  const echelle = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
  const w = Math.max(1, Math.round(bitmap.width * echelle)), h = Math.max(1, Math.round(bitmap.height * echelle));
  const c = document.createElement("canvas");
  c.width = w; c.height = h;
  const ctx = c.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("canvas");
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close?.();
  const img = ctx.getImageData(0, 0, w, h);
  const d = img.data;
  // Mesures (1 pixel sur 16) : histogramme de chaque couleur et de la luminosité
  const hR = new Uint32Array(256), hG = new Uint32Array(256), hB = new Uint32Array(256), hL = new Uint32Array(256);
  let n = 0;
  for (let i = 0; i < d.length; i += 64) {
    hR[d[i]]++; hG[d[i + 1]]++; hB[d[i + 2]]++;
    hL[Math.round(0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2])]++; n++;
  }
  const pct = (h: Uint32Array, p: number) => { let s = 0; for (let k = 0; k < 256; k++) { s += h[k]; if (s >= n * p) return k; } return 255; };
  // Niveaux de chaque couleur (noir et blanc à 0,5 % / 99,5 %), corrigés avec modération : enlève les dominantes (photo jaune, bleue…) sans exagérer
  const niveaux = [hR, hG, hB].map((h) => { const lo = pct(h, 0.005), hi = pct(h, 0.995); return { lo: Math.min(lo, 40), et: Math.max(115, hi - Math.min(lo, 40)) }; });
  const noirL = Math.min(pct(hL, 0.005), 40), etL = Math.max(115, pct(hL, 0.995) - noirL);
  // On garde 40 % de l'ambiance d'origine (ne pas « tuer » un coucher de soleil)
  const MELANGE = 0.6;
  const norm = (v: number, c: number) => MELANGE * ((v - niveaux[c].lo) / niveaux[c].et) + (1 - MELANGE) * ((v - noirL) / etL);
  // Lumière : médiane ramenée vers un niveau agréable
  const med = pct(hL, 0.5);
  const medNorm = Math.min(0.85, Math.max(0.12, (med - noirL) / etL));
  const gamma = Math.min(1.4, Math.max(0.55, Math.log(0.47) / Math.log(medNorm)));
  const courbe = new Float32Array(1025);
  for (let k = 0; k <= 1024; k++) {
    let x = Math.pow(k / 1024, gamma);
    x = x + 0.1 * (x - 0.5) * (1 - Math.abs(2 * x - 1)); // contraste doux en « S »
    courbe[k] = Math.min(1, Math.max(0, x)) * 255;
  }
  const appliquer = (v: number, c: number) => courbe[Math.round(Math.min(1, Math.max(0, norm(v, c))) * 1024)];
  const SAT = 1.06;
  for (let i = 0; i < d.length; i += 4) {
    let R = appliquer(d[i], 0), G = appliquer(d[i + 1], 1), B = appliquer(d[i + 2], 2);
    const L = 0.299 * R + 0.587 * G + 0.114 * B;
    R = L + (R - L) * SAT; G = L + (G - L) * SAT; B = L + (B - L) * SAT;
    d[i] = R; d[i + 1] = G; d[i + 2] = B;
  }
  ctx.putImageData(img, 0, 0);
  // Légère netteté : on superpose une version adoucie en mode « soustraction » via un second canevas
  const flou = document.createElement("canvas");
  flou.width = w; flou.height = h;
  const fctx = flou.getContext("2d");
  if (fctx && "filter" in fctx) {
    fctx.filter = "blur(1px)";
    fctx.drawImage(c, 0, 0);
    const a = ctx.getImageData(0, 0, w, h), fb = fctx.getImageData(0, 0, w, h);
    const A = a.data, F = fb.data;
    for (let i = 0; i < A.length; i += 4) {
      A[i] = A[i] + 0.35 * (A[i] - F[i]);
      A[i + 1] = A[i + 1] + 0.35 * (A[i + 1] - F[i + 1]);
      A[i + 2] = A[i + 2] + 0.35 * (A[i + 2] - F[i + 2]);
    }
    ctx.putImageData(a, 0, 0);
  }
  return await new Promise<Blob>((ok, ko) => c.toBlob((x) => (x ? ok(x) : ko(new Error("jpeg"))), "image/jpeg", 0.85));
}
