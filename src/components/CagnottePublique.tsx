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
    if (!f.type.startsWith("image/")) return setMsg("Choisis une photo (JPG, PNG…).");
    if (f.size > 25 * 1024 * 1024) return setMsg("Photo trop lourde (25 Mo maximum).");
    setEnvoi(true); setMsg("");
    // Photo réduite (1200 px, JPEG) : page rapide et aperçu WhatsApp qui s'affiche (WhatsApp ignore les images trop lourdes)
    const leger = await reduirePhoto(f).catch(() => null);
    if (!leger) { setEnvoi(false); return setMsg("Impossible de lire cette photo. Essaie une autre image."); }
    const chemin = `${groupId}/couverture-${Date.now()}.jpg`;
    const { error } = await supabase.storage.from("cagnottes").upload(chemin, leger, { upsert: true, contentType: "image/jpeg" });
    if (error) { setEnvoi(false); return setMsg("Erreur photo : " + error.message); }
    const url = supabase.storage.from("cagnottes").getPublicUrl(chemin).data.publicUrl;
    setPhoto(url);
    setEnvoi(false);
    if (etat.actif) enregistrer(true, url);
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

/** Réduit une photo du téléphone : 1200 px de large maximum, JPEG qualité 0,82 (souvent 150 à 300 Ko) */
async function reduirePhoto(f: File): Promise<Blob> {
  const url = URL.createObjectURL(f);
  try {
    const img = await new Promise<HTMLImageElement>((ok, ko) => { const i = new Image(); i.onload = () => ok(i); i.onerror = ko; i.src = url; });
    const echelle = Math.min(1, 1200 / Math.max(img.naturalWidth, 1));
    const c = document.createElement("canvas");
    c.width = Math.round(img.naturalWidth * echelle);
    c.height = Math.round(img.naturalHeight * echelle);
    const ctx = c.getContext("2d");
    if (!ctx) throw new Error("canvas");
    ctx.drawImage(img, 0, 0, c.width, c.height);
    return await new Promise<Blob>((ok, ko) => c.toBlob((b) => (b ? ok(b) : ko(new Error("jpeg"))), "image/jpeg", 0.82));
  } finally {
    URL.revokeObjectURL(url);
  }
}
