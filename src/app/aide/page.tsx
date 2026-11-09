import type { Metadata } from "next";
import Link from "next/link";
import { ServiceClient } from "@/components/ServiceClient";
import { BottomNav } from "@/components/BottomNav";
import { Header, Page } from "@/components/ui";

export const metadata: Metadata = { title: "Aide — Cotiz" };

const FAQ: { q: string; r: string; id?: string }[] = [
  { q: "Comment créer une tontine ?", r: "Touche « Créer un groupe », choisis « Tontine », indique le montant, la fréquence et la date de la première échéance, puis ajoute les membres avec leur numéro. Tu deviens automatiquement le trésorier." },
  { q: "Comment inviter les membres ?", r: "Dans le groupe, touche « Inviter » : un message WhatsApp est prêt avec le lien du groupe. Le membre ouvre le lien, entre son nom et son numéro, puis touche « Rejoindre le groupe »." },
  { q: "Comment payer ma cotisation ?", r: "Dans le groupe, touche « Payer ma part », choisis le nombre de tours, puis « Ouvrir Wave et payer » : le numéro du trésorier est copié et Wave s’ouvre. Envoie le montant affiché, vérifie le nom du trésorier, valide, puis reviens et touche « J’ai envoyé »." },
  { q: "Qui reçoit l’argent ?", r: "L’argent est envoyé directement sur le numéro Mobile Money du trésorier. Cotiz ne touche jamais l’argent. Quand la caisse est complète, le trésorier la verse au bénéficiaire du tour et l’enregistre dans l’application." },
  { q: "Pourquoi mon paiement est « en attente » ?", r: "Le trésorier doit vérifier sur son téléphone qu’il a bien reçu l’argent, puis le confirmer. Tu peux le prévenir sur WhatsApp depuis l’écran de paiement. Personne ne peut se marquer « payé » tout seul." },
  { q: "Que peut faire le trésorier ?", r: "Le trésorier peut tout gérer : modifier le groupe, l’ordre de passage et le bénéficiaire, ajouter ou retirer des membres, nommer des co-gestionnaires, confirmer les paiements et verser la caisse." },
  { q: "Qu’est-ce qu’un co-gestionnaire ?", r: "Une personne de confiance choisie par le trésorier. Elle peut ajouter et modifier les membres et l’ordre des tours. Par sécurité, seul le trésorier confirme les paiements et verse l’argent." },
  { q: "Une personne peut-elle avoir plusieurs parts (bras) ?", r: "Oui. Dans une tontine, une même personne peut avoir 1, 2 ou 3 parts (on dit aussi « bras »). Elle cotise pour chaque part et reçoit la caisse autant de fois qu’elle a de parts." },
  { q: "Peut-on payer plusieurs tours en avance ?", r: "Oui. Sur l’écran de paiement, choisis le nombre de tours. Chaque part est attribuée au bon tour, et l’application affiche « Payé jusqu’au tour X »." },
  { q: "Comment fonctionnent les pénalités de retard ?", r: "Si une pénalité est prévue dans le groupe, elle s’ajoute automatiquement au montant dû quand l’échéance est dépassée. Pour une collecte (funérailles, mariage…), il n’y a jamais de pénalité." },
  { q: "Comment installer Cotiz sur iPhone ?", id: "iphone", r: "Ouvre tontine-et-cotise.vercel.app dans Safari, touche le bouton Partager (carré avec une flèche), puis « Sur l’écran d’accueil ». Cotiz apparaît avec son logo, comme une application." },
  { q: "Mes informations sont-elles protégées ?", r: "Seuls les membres de tes groupes voient tes informations. Cotiz ne te demande jamais ton code secret Mobile Money. Détails dans la politique de confidentialité." },
];

export default function Aide() {
  return (
    <Page>
      <Header title="Aide et service client" />
      <div className="space-y-5 p-4 pb-28">
        <ServiceClient />
        <section>
          <h2 className="mb-2 px-1 text-xs font-bold uppercase tracking-wide text-stone-500">Questions fréquentes</h2>
          <div className="carte divide-y divide-stone-100 overflow-hidden">
            {FAQ.map((f) => (
              <details key={f.q} id={f.id} className="group px-4 py-3 [&_summary::-webkit-details-marker]:hidden">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-sm font-bold">
                  {f.q}
                  <span className="text-lg leading-none text-stone-400 transition group-open:rotate-45">+</span>
                </summary>
                <p className="mt-2 text-sm leading-relaxed text-stone-600">{f.r}</p>
              </details>
            ))}
          </div>
        </section>
        <p className="text-center text-xs text-stone-500">
          Un souci avec un paiement dans un groupe ? Tu peux aussi contacter ton trésorier avec les boutons « Appeler » ou « Écrire » dans le groupe.
        </p>
        <p className="text-center text-xs text-stone-400">
          <Link href="/confidentialite" className="underline">Confidentialité</Link> · <Link href="/suppression-compte" className="underline">Supprimer mon compte</Link>
        </p>
      </div>
      <BottomNav />
    </Page>
  );
}
