import { Headset, MessageCircle, Phone } from "lucide-react";
import { SUPPORT_AFFICHE, SUPPORT_PHONE } from "@/lib/support";
import { WhatsAppIcon } from "./ui";

const wa = (texte: string) => `https://wa.me/225${SUPPORT_PHONE}?text=${encodeURIComponent(texte)}`;
/** Vrai SMS : ouvre l'application Messages du téléphone avec le texte prêt (« ?&body= » marche sur Android et iPhone) */
const sms = (texte: string) => `sms:+225${SUPPORT_PHONE}?&body=${encodeURIComponent(texte)}`;

/** Carte « Service client » : WhatsApp, SMS et appel */
export function ServiceClient({ sujet = "Bonjour, j’ai besoin d’aide avec Sikaklo." }: { sujet?: string }) {
  return (
    <div id="conseiller" className="carte scroll-mt-20 space-y-3.5 p-4">
      <div className="flex items-center gap-3">
        <span className="relative grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-emerald-500 to-emerald-800 text-white shadow-sm">
          <Headset size={21} />
          <span className="en-ligne absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full bg-green-500 ring-2 ring-white" />
        </span>
        <div className="min-w-0">
          <p className="flex flex-wrap items-center gap-2 font-bold">Parler à un conseiller <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[0.65rem] font-bold text-emerald-800">👤 Une vraie personne</span></p>
          <p className="text-xs text-stone-500">L’équipe Sikaklo vous répond, idéal pour <span className="surligne-vert font-semibold text-stone-700">un paiement ou un versement</span> · {SUPPORT_AFFICHE}</p>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-2">
        <a href={wa(sujet)} target="_blank" rel="noreferrer" className="flex flex-col items-center justify-center gap-1 rounded-2xl bg-[#1fa855] px-1 py-2.5 text-xs font-bold text-white hover:bg-[#178f47]">
          <WhatsAppIcon size={18} /> WhatsApp
        </a>
        <a href={sms(sujet)} className="flex flex-col items-center justify-center gap-1 rounded-2xl bg-sky-600 px-1 py-2.5 text-xs font-bold text-white hover:bg-sky-700">
          <MessageCircle size={17} strokeWidth={2} /> SMS
        </a>
        <a href={`tel:${SUPPORT_PHONE}`} className="flex flex-col items-center justify-center gap-1 rounded-2xl bg-white px-1 py-2.5 text-xs font-bold text-stone-800 shadow-sm ring-1 ring-stone-200">
          <Phone size={17} strokeWidth={1.9} /> Appeler
        </a>
      </div>
    </div>
  );
}

/** Petit lien « Besoin d'aide ? » */
export function LienAide({ sujet }: { sujet: string }) {
  return (
    <a href={wa(sujet)} target="_blank" rel="noreferrer" className="block text-center text-xs font-semibold text-emerald-700 underline">
      Besoin d’aide ? Contacter le service client
    </a>
  );
}
