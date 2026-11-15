"use client";

/**
 * Relancer tous les retardataires d'un coup, directement sur LEUR numéro
 * (même s'ils ne sont pas encore inscrits sur Sikaklo : le trésorier a déjà leur numéro).
 *  - SMS : un seul SMS envoyé à tout le monde en une fois (application Messages du téléphone).
 *  - WhatsApp : la conversation de chaque personne s'ouvre directement avec son message
 *    personnalisé ; on envoie, on revient, et Sikaklo passe tout seul à la personne suivante.
 * (L'envoi 100 % automatique sans rien toucher demandera WhatsApp Business, payant.)
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { Check, CheckCircle2, ChevronRight, MessageCircle, Send, Users } from "lucide-react";
import { contexte, messageModele } from "@/lib/messages";
import { normaliserTel, telAffiche } from "@/lib/format";
import { waLink } from "@/lib/whatsapp";
import type { Group, Member } from "@/lib/types";
import { WhatsAppIcon } from "./ui";

const estIOS = () => typeof navigator !== "undefined" && /iPhone|iPad|iPod/i.test(navigator.userAgent);

export function RelanceGroupee({ group, membres, fermer, messageGroupe }: { group: Group; membres: Member[]; fermer: () => void; messageGroupe: () => void }) {
  const avecNumero = useMemo(() => membres.filter((m) => m.phone && m.phone.replace(/\D/g, "").length >= 8), [membres]);
  const [choisis, setChoisis] = useState<string[]>(() => avecNumero.map((m) => m.id));
  const [envoyes, setEnvoyes] = useState<string[]>([]);
  const [enCours, setEnCours] = useState<string | null>(null); // la personne dont WhatsApp vient de s'ouvrir
  const enCoursRef = useRef<string | null>(null);
  enCoursRef.current = enCours;
  const origine = typeof window !== "undefined" ? window.location.origin : "";

  const texte = (m: Member) => messageModele(contexte(group, "relance", origine, m));
  const liste = avecNumero.filter((m) => choisis.includes(m.id));
  const prochain = liste.find((m) => !envoyes.includes(m.id));

  // Retour dans Sikaklo après WhatsApp : la personne est marquée « relancée »
  useEffect(() => {
    const retour = () => {
      if (document.visibilityState !== "visible" || !enCoursRef.current) return;
      const id = enCoursRef.current;
      setEnvoyes((e) => (e.includes(id) ? e : [...e, id]));
      setEnCours(null);
    };
    document.addEventListener("visibilitychange", retour);
    return () => document.removeEventListener("visibilitychange", retour);
  }, []);

  const ouvrirWhatsApp = (m: Member) => {
    setEnCours(m.id);
    window.open(waLink(texte(m), m.phone), "_blank", "noopener");
  };

  // Un seul SMS pour tout le monde (message sans prénom)
  const sms = () => {
    const nums = liste.map((m) => "+" + normaliserTel(m.phone));
    const corps = messageModele(contexte(group, "relance", origine));
    const lien = estIOS() ? `sms://open?addresses=${nums.join(",")}&body=${encodeURIComponent(corps)}` : `sms:${nums.join(",")}?body=${encodeURIComponent(corps)}`;
    window.location.href = lien;
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center bg-black/40 backdrop-blur-[2px] lg:items-center" onClick={fermer}>
      <div className="feuille flex max-h-[92dvh] w-full max-w-md flex-col rounded-t-[28px] bg-white shadow-2xl lg:rounded-[28px]" onClick={(e) => e.stopPropagation()}>
        <div className="px-4 pt-3">
          <div className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-stone-200" />
          <div className="flex items-start gap-3">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-[#25D366] text-white shadow"><WhatsAppIcon size={22} /></span>
            <div className="min-w-0 flex-1">
              <p className="font-bold">Relancer {liste.length} personne{liste.length > 1 ? "s" : ""}</p>
              <p className="text-xs text-stone-500">Directement sur leur numéro, même s’ils ne sont pas encore inscrits sur Sikaklo.</p>
            </div>
            <button onClick={fermer} aria-label="Fermer" className="grid h-8 w-8 place-items-center rounded-full bg-stone-100 text-stone-500">✕</button>
          </div>
        </div>

        {/* Les personnes à relancer (toutes cochées d'office) */}
        <div className="mt-3 min-h-0 flex-1 overflow-y-auto px-4">
          <div className="divide-y divide-stone-100 rounded-2xl ring-1 ring-stone-200">
            {avecNumero.map((m) => {
              const pris = choisis.includes(m.id), fait = envoyes.includes(m.id);
              return (
                <div key={m.id} className={`flex items-center gap-3 px-3 py-2.5 ${fait ? "bg-emerald-50/60" : ""}`}>
                  <button type="button" onClick={() => setChoisis(pris ? choisis.filter((x) => x !== m.id) : [...choisis, m.id])} aria-label={pris ? "Retirer" : "Ajouter"}
                    className={`grid h-6 w-6 shrink-0 place-items-center rounded-md border-2 ${pris ? "border-emerald-600 bg-emerald-600 text-white" : "border-stone-300"}`}>{pris && <Check size={13} strokeWidth={3} />}</button>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold">{m.name}</span>
                    <span className="block text-xs tabular-nums text-stone-500">{telAffiche(m.phone)}{!m.profileId && " · pas encore inscrit"}</span>
                  </span>
                  {fait ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-1 text-[0.7rem] font-bold text-emerald-800"><CheckCircle2 size={12} /> Relancé</span>
                  ) : (
                    <button type="button" disabled={!pris} onClick={() => ouvrirWhatsApp(m)} className="inline-flex items-center gap-1 rounded-full bg-[#25D366]/15 px-2.5 py-1.5 text-xs font-bold text-[#128C7E] disabled:opacity-30">
                      <WhatsAppIcon size={14} /> Envoyer
                    </button>
                  )}
                </div>
              );
            })}
          </div>
          {membres.length > avecNumero.length && <p className="mt-2 text-xs text-amber-700">{membres.length - avecNumero.length} membre(s) sans numéro valable : ajoutez leur numéro dans Réglages.</p>}
        </div>

        {/* Actions */}
        <div className="space-y-2 border-t border-stone-100 p-4">
          {prochain ? (
            <button type="button" onClick={() => ouvrirWhatsApp(prochain)} className="flex w-full items-center gap-3 rounded-2xl bg-[#25D366] px-4 py-3 text-left text-white shadow-[0_8px_20px_-10px_rgba(37,211,102,0.9)]">
              <WhatsAppIcon size={22} />
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-extrabold">WhatsApp à {prochain.name.split(/\s+/)[0]}</span>
                <span className="block text-[0.7rem] text-white/85">{envoyes.filter((id) => choisis.includes(id)).length + 1} sur {liste.length} · son message personnalisé est prêt</span>
              </span>
              <ChevronRight size={20} />
            </button>
          ) : liste.length > 0 ? (
            <p className="flex items-center justify-center gap-2 rounded-2xl bg-emerald-50 py-3 text-sm font-bold text-emerald-800"><CheckCircle2 size={17} /> Tout le monde a été relancé</p>
          ) : null}
          <div className="grid grid-cols-2 gap-2">
            <button type="button" disabled={!liste.length} onClick={sms} className="inline-flex items-center justify-center gap-1.5 rounded-2xl bg-sky-600 py-3 text-xs font-bold text-white disabled:opacity-40">
              <MessageCircle size={15} /> SMS à tous ({liste.length})
            </button>
            <button type="button" onClick={() => { fermer(); messageGroupe(); }} className="inline-flex items-center justify-center gap-1.5 rounded-2xl bg-stone-100 py-3 text-xs font-bold text-stone-700">
              <Users size={15} /> Message au groupe
            </button>
          </div>
          <p className="flex items-start gap-1.5 text-[0.7rem] leading-snug text-stone-400"><Send size={11} className="mt-0.5 shrink-0" /> WhatsApp s’ouvre directement sur le numéro de chaque personne : touchez Envoyer, revenez dans Sikaklo, et la personne suivante est prête.</p>
        </div>
      </div>
    </div>
  );
}
