import type { Metadata } from "next";
import Link from "next/link";
import { ACompleter, DocumentLegal, type Article } from "@/components/DocumentLegal";
import { SUPPORT_AFFICHE } from "@/lib/support";

export const metadata: Metadata = { title: "Mentions légales — Cotiz" };

const ARTICLES: Article[] = [
  {
    id: "editeur",
    titre: "Éditeur du service",
    contenu: (
      <ul>
        <li>Nom commercial : <b>Cotiz</b></li>
        <li>Raison sociale : <ACompleter>nom de l’entreprise</ACompleter></li>
        <li>Forme juridique : <ACompleter>entreprise individuelle, SARL…</ACompleter></li>
        <li>RCCM : <ACompleter>numéro d’immatriculation au registre du commerce</ACompleter></li>
        <li>Numéro de compte contribuable : <ACompleter>numéro figurant sur la DFE</ACompleter></li>
        <li>Siège : <ACompleter>adresse</ACompleter>, Abidjan, Côte d’Ivoire</li>
        <li>Téléphone : <b>{SUPPORT_AFFICHE}</b></li>
        <li>E-mail : <ACompleter>adresse e-mail de contact</ACompleter></li>
      </ul>
    ),
  },
  {
    id: "publication",
    titre: "Directeur de la publication",
    contenu: <p><ACompleter>nom et prénom du responsable</ACompleter>, en qualité de <ACompleter>gérant / fondateur</ACompleter>.</p>,
  },
  {
    id: "hebergement",
    titre: "Hébergement",
    contenu: (
      <>
        <p>Le site et l’application sont hébergés par :</p>
        <ul>
          <li><b>Vercel Inc.</b> (site web) — vercel.com</li>
          <li><b>Supabase Inc.</b> (base de données et authentification) — supabase.com</li>
        </ul>
      </>
    ),
  },
  {
    id: "activite",
    titre: "Nature de l’activité",
    contenu: (
      <p>
        Cotiz est un service numérique de gestion et de suivi de tontines, d’associations et de collectes. <b>Cotiz ne collecte pas et ne détient pas de
        fonds</b> : les paiements sont réalisés directement entre les utilisateurs par l’intermédiaire d’opérateurs agréés (Wave, Orange Money, MTN Mobile
        Money, Moov Money). Voir les <Link href="/cgu">conditions générales d’utilisation</Link>.
      </p>
    ),
  },
  {
    id: "donnees",
    titre: "Données personnelles",
    contenu: (
      <>
        <p>
          Les données personnelles sont traitées conformément à la loi n° 2013-450 du 19 juin 2013 relative à la protection des données à caractère
          personnel, sous le contrôle de l’ARTCI (Autorité de Régulation des Télécommunications/TIC de Côte d’Ivoire).
        </p>
        <ul>
          <li>Déclaration ou autorisation ARTCI : <ACompleter>numéro de récépissé</ACompleter></li>
          <li>Détails : <Link href="/confidentialite">politique de confidentialité</Link></li>
        </ul>
      </>
    ),
  },
  {
    id: "propriete",
    titre: "Propriété intellectuelle",
    contenu: (
      <p>
        L’ensemble des éléments de Cotiz (nom, logo, charte graphique, textes, code) est la propriété exclusive de l’Éditeur. Les marques des opérateurs de
        paiement citées (Wave, Orange Money, MTN, Moov) appartiennent à leurs propriétaires respectifs et ne sont mentionnées qu’à titre d’information.
      </p>
    ),
  },
  {
    id: "signalement",
    titre: "Signaler un abus",
    contenu: (
      <p>
        Pour signaler une fraude, un contenu illicite ou l’usurpation de votre numéro, contactez le service client au <b>{SUPPORT_AFFICHE}</b>. Votre
        signalement sera traité dans les meilleurs délais.
      </p>
    ),
  },
];

export default function MentionsLegales() {
  return (
    <DocumentLegal
      actuel="/mentions-legales"
      titre="Mentions légales"
      chapeau="Qui édite Cotiz, qui l’héberge, et comment nous contacter."
      version="1.0"
      maj="10 novembre 2026"
      articles={ARTICLES}
    />
  );
}
