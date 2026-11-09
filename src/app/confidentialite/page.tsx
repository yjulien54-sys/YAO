import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "Politique de confidentialité — Cotiz" };

const MAJ = "9 novembre 2026";

export default function Confidentialite() {
  return (
    <main className="mx-auto min-h-dvh max-w-2xl bg-white px-5 py-8 text-base leading-relaxed text-stone-800">
      <Link href="/" className="text-sm font-semibold text-emerald-700">← Retour à Cotiz</Link>
      <h1 className="mt-4 text-2xl font-extrabold">Politique de confidentialité</h1>
      <p className="text-sm text-stone-500">Dernière mise à jour : {MAJ}</p>

      <h2 className="mt-6 text-lg font-bold">1. Qui sommes-nous ?</h2>
      <p>Cotiz est une application qui aide les tontines, associations et familles de Côte d’Ivoire à suivre leurs cotisations en toute transparence.</p>

      <h2 className="mt-6 text-lg font-bold">2. Données que nous collectons</h2>
      <ul className="list-disc pl-5">
        <li><b>Ton nom et ton numéro de téléphone</b>, que tu saisis pour utiliser l’application.</li>
        <li><b>Les groupes</b> que tu crées ou rejoins (nom, montant des cotisations, échéances, membres).</li>
        <li><b>Les paiements déclarés ou confirmés</b> (montant, date, moyen de paiement, référence de transaction si tu la saisis) et les versements enregistrés par le trésorier.</li>
      </ul>
      <p>Nous ne collectons <b>ni ton code secret Mobile Money, ni tes identifiants Wave, Orange Money, MTN ou Moov</b>. Les paiements se font dans ton application de paiement, en dehors de Cotiz.</p>

      <h2 className="mt-6 text-lg font-bold">3. Pourquoi nous utilisons ces données</h2>
      <ul className="list-disc pl-5">
        <li>Afficher à chaque membre d’un groupe qui a payé, combien il y a dans la caisse et qui est le bénéficiaire.</li>
        <li>Permettre au trésorier de confirmer les paiements et d’enregistrer les versements.</li>
        <li>Préparer des messages de rappel que <b>tu choisis</b> d’envoyer sur WhatsApp.</li>
      </ul>
      <p>Nous ne vendons pas tes données et nous ne les utilisons pas pour de la publicité.</p>

      <h2 className="mt-6 text-lg font-bold">4. Qui peut voir tes données ?</h2>
      <p>Uniquement les <b>membres des groupes dont tu fais partie</b>. Les autres utilisateurs de Cotiz ne voient rien de tes groupes.</p>

      <h2 className="mt-6 text-lg font-bold">5. Hébergement et sécurité</h2>
      <p>Les données sont hébergées par notre prestataire Supabase, dans des centres de données sécurisés. L’accès est protégé par des règles qui limitent chaque utilisateur à ses propres groupes. Les messages de rappel peuvent être rédigés à l’aide d’un service d’intelligence artificielle, qui reçoit seulement les informations nécessaires au message (prénom, nom du groupe, montant, date).</p>

      <h2 className="mt-6 text-lg font-bold">Journal des actions (traçabilité)</h2>
      <p>Pour la sécurité de tous et pour régler les litiges, chaque action importante (création ou modification d’un groupe, ajout ou retrait d’un membre, paiement, versement, acceptation du règlement) est enregistrée avec sa date, son auteur et son contenu. Ce journal n’est accessible qu’à l’équipe de Cotiz, uniquement pour la sécurité, la lutte contre la fraude et l’assistance.</p>

      <h2 className="mt-6 text-lg font-bold">6. Durée de conservation</h2>
      <p>Tes données sont conservées tant que ton compte existe. L’historique des paiements d’un groupe est conservé pour la transparence du groupe, même si un membre quitte l’application.</p>

      <h2 className="mt-6 text-lg font-bold">7. Tes droits et la suppression de ton compte</h2>
      <p>Tu peux demander l’accès, la correction ou la suppression de tes données. Pour supprimer ton compte, rends-toi sur la page <Link href="/suppression-compte" className="font-semibold text-emerald-700 underline">Supprimer mon compte</Link>.</p>

      <h2 className="mt-6 text-lg font-bold">8. Contact</h2>
      <p>Pour toute question, écris-nous à l’adresse e-mail indiquée sur la fiche de Cotiz dans Google Play.</p>
    </main>
  );
}
