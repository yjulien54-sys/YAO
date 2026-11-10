import type { Metadata } from "next";
import Link from "next/link";
import { ACompleter, DocumentLegal, type Article } from "@/components/DocumentLegal";
import { SUPPORT_AFFICHE } from "@/lib/support";

export const metadata: Metadata = { title: "Politique de confidentialité — Cotiz" };

const ARTICLES: Article[] = [
  {
    id: "responsable",
    titre: "Responsable du traitement",
    contenu: (
      <p>
        Le responsable du traitement des données est l’Éditeur de Cotiz, identifié dans les <Link href="/mentions-legales">mentions légales</Link>. Cotiz aide
        les tontines, associations et familles de Côte d’Ivoire à suivre leurs cotisations en toute transparence.
      </p>
    ),
  },
  {
    id: "collecte",
    titre: "Données collectées",
    contenu: (
      <>
        <ul>
          <li><b>Identité</b> : votre nom et votre numéro de téléphone.</li>
          <li><b>Groupes</b> : nom, montant et fréquence des cotisations, échéances, membres, ordre des tours.</li>
          <li><b>Opérations</b> : paiements déclarés ou confirmés (montant, date, moyen de paiement, référence de transaction), versements, pénalités.</li>
          <li><b>Engagements</b> : acceptation du règlement intérieur et reconnaissances de dette, avec leur date.</li>
          <li><b>Données techniques</b> : journal de sécurité des actions importantes.</li>
        </ul>
        <p className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-900">
          Nous ne collectons <b className="text-emerald-900">jamais</b> votre code secret Mobile Money ni vos identifiants Wave, Orange Money, MTN ou Moov.
        </p>
      </>
    ),
  },
  {
    id: "finalites",
    titre: "Finalités et bases légales",
    contenu: (
      <ul>
        <li>Fournir le service : afficher qui a payé, la caisse et le bénéficiaire (exécution des CGU).</li>
        <li>Permettre au trésorier de confirmer les paiements et d’enregistrer les versements (exécution des CGU).</li>
        <li>Préparer les messages de rappel que vous choisissez d’envoyer (exécution des CGU).</li>
        <li>Assurer la sécurité, prévenir la fraude et traiter les litiges (intérêt légitime).</li>
        <li>Répondre aux obligations légales et aux demandes des autorités (obligation légale).</li>
      </ul>
    ),
  },
  {
    id: "destinataires",
    titre: "Destinataires des données",
    contenu: (
      <>
        <p>
          Vos données sont visibles uniquement par les <b>membres des groupes dont vous faites partie</b>. Les autres utilisateurs de Cotiz ne voient rien de vos
          groupes. Nous ne vendons pas vos données et ne les utilisons pas à des fins publicitaires.
        </p>
        <p>Nos prestataires techniques y ont accès dans la stricte limite de leur mission :</p>
        <ul>
          <li>Supabase (hébergement de la base de données et authentification) ;</li>
          <li>Vercel (hébergement du site) ;</li>
          <li>un service d’intelligence artificielle, qui reçoit seulement les éléments utiles à la rédaction d’un rappel (prénom, nom du groupe, montant, date) ;</li>
          <li>un prestataire d’envoi de SMS, lorsque la vérification par code est activée.</li>
        </ul>
      </>
    ),
  },
  {
    id: "transferts",
    titre: "Transferts hors de Côte d’Ivoire",
    contenu: (
      <p>
        Certains prestataires hébergent les données hors de Côte d’Ivoire. Ces transferts sont encadrés conformément à la loi n° 2013-450 et aux exigences de
        l’ARTCI, avec des garanties de sécurité adaptées.
      </p>
    ),
  },
  {
    id: "securite",
    titre: "Sécurité",
    contenu: (
      <ul>
        <li>Connexions chiffrées (HTTPS) ;</li>
        <li>règles d’accès qui limitent chaque utilisateur à ses propres groupes ;</li>
        <li>paiements confirmés impossibles à effacer ;</li>
        <li>alerte à tous les membres en cas de changement du numéro qui reçoit l’argent ;</li>
        <li>journal horodaté des actions importantes, consultable uniquement par l’équipe Cotiz pour la sécurité et l’assistance.</li>
      </ul>
    ),
  },
  {
    id: "conservation",
    titre: "Durée de conservation",
    contenu: (
      <p>
        Vos données sont conservées tant que votre compte est actif. L’historique des paiements d’un groupe est conservé pour la transparence envers ses
        membres, même après votre départ, puis archivé pendant la durée nécessaire au règlement d’éventuels litiges.
      </p>
    ),
  },
  {
    id: "droits",
    titre: "Vos droits",
    contenu: (
      <>
        <p>Vous disposez d’un droit d’accès, de rectification, d’opposition et de suppression de vos données.</p>
        <ul>
          <li>Supprimer votre compte : page <Link href="/suppression-compte">Supprimer mon compte</Link> ;</li>
          <li>Toute autre demande : service client au <b>{SUPPORT_AFFICHE}</b> ou par e-mail à <ACompleter>adresse e-mail de contact</ACompleter>.</li>
        </ul>
        <p>Vous pouvez également saisir l’ARTCI si vous estimez que vos droits ne sont pas respectés.</p>
      </>
    ),
  },
  {
    id: "modification",
    titre: "Modification de la politique",
    contenu: <p>Cette politique peut évoluer. Toute modification importante vous sera signalée dans l’application.</p>,
  },
];

export default function Confidentialite() {
  return (
    <DocumentLegal
      actuel="/confidentialite"
      titre="Politique de confidentialité"
      chapeau="Quelles données Cotiz utilise, pourquoi, qui peut les voir, et comment exercer vos droits."
      version="2.0"
      maj="10 novembre 2026"
      articles={ARTICLES}
    />
  );
}
