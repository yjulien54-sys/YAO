import type { Metadata } from "next";
import Link from "next/link";
import { ACompleter, DocumentLegal, type Article } from "@/components/DocumentLegal";
import { SUPPORT_AFFICHE } from "@/lib/support";

export const metadata: Metadata = { title: "Conditions générales d’utilisation — Cotiz" };

const ARTICLES: Article[] = [
  {
    id: "objet",
    titre: "Objet",
    contenu: (
      <>
        <p>
          Les présentes conditions générales d’utilisation (ci-après les « CGU ») ont pour objet de définir les conditions dans lesquelles l’Éditeur met à
          disposition l’application Cotiz, accessible à l’adresse <b>tontine-et-cotise.vercel.app</b> et via l’application mobile Android, ainsi que les droits et
          obligations des personnes qui l’utilisent.
        </p>
        <p>L’utilisation de Cotiz implique l’acceptation pleine et entière des présentes CGU. Si vous n’acceptez pas ces conditions, vous devez renoncer à utiliser le service.</p>
      </>
    ),
  },
  {
    id: "definitions",
    titre: "Définitions",
    contenu: (
      <ul>
        <li><b>Éditeur</b> : la personne qui exploite Cotiz, identifiée dans les <Link href="/mentions-legales">mentions légales</Link>.</li>
        <li><b>Utilisateur</b> : toute personne qui utilise Cotiz, qu’elle soit gestionnaire ou membre d’un groupe.</li>
        <li><b>Groupe</b> : une tontine, une association, une mutuelle ou une collecte (funérailles, mariage, baptême…) créée dans Cotiz.</li>
        <li><b>Trésorier</b> : l’Utilisateur qui crée un Groupe et en assure la gestion. Il reçoit les cotisations sur le numéro de paiement qu’il indique.</li>
        <li><b>Co-gestionnaire</b> : un membre à qui le Trésorier confie des droits de gestion.</li>
        <li><b>Membre</b> : une personne inscrite dans un Groupe, qui s’engage à verser des cotisations.</li>
        <li><b>Tour</b> : une période de cotisation à l’issue de laquelle un bénéficiaire reçoit la cagnotte.</li>
        <li><b>Opérateur de paiement</b> : Wave, Orange Money, MTN Mobile Money, Moov Money ou tout autre service agréé utilisé pour envoyer l’argent.</li>
      </ul>
    ),
  },
  {
    id: "service",
    titre: "Description du service",
    contenu: (
      <>
        <p>Cotiz est un outil de <b>gestion et de suivi</b> des cotisations. Il permet notamment :</p>
        <ul>
          <li>de créer un Groupe, d’y inviter des membres et de fixer le montant, la fréquence et l’ordre des tours ;</li>
          <li>d’afficher à tous les membres qui a payé, ce qui reste dû et qui est le prochain bénéficiaire ;</li>
          <li>de déclarer un paiement, que le Trésorier confirme ensuite, et d’obtenir un reçu ;</li>
          <li>d’organiser un tirage au sort public de l’ordre des tours ;</li>
          <li>de préparer des messages de rappel, envoyés par l’Utilisateur lui-même sur WhatsApp ;</li>
          <li>d’enregistrer un règlement intérieur, des pénalités de retard et une reconnaissance de dette.</li>
        </ul>
        <p>L’Éditeur peut faire évoluer les fonctionnalités à tout moment, notamment pour améliorer la sécurité ou le confort d’utilisation.</p>
      </>
    ),
  },
  {
    id: "fonds",
    titre: "Rôle de Cotiz dans les paiements",
    contenu: (
      <>
        <p className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-900">
          <b className="text-emerald-900">Cotiz ne détient pas, ne garde pas et ne transfère pas l’argent des Utilisateurs.</b> Cotiz n’est ni une banque, ni un
          établissement de paiement, ni un établissement de monnaie électronique.
        </p>
        <p>
          Les cotisations sont envoyées directement par chaque Membre au Trésorier, au moyen de l’Opérateur de paiement de son choix. Ces opérations sont
          soumises aux conditions de l’Opérateur concerné. Cotiz se limite à enregistrer les informations déclarées par les Utilisateurs afin d’assurer la
          transparence au sein du Groupe.
        </p>
        <p>
          Les éventuels frais facturés par les Opérateurs de paiement restent à la charge de l’Utilisateur qui effectue l’opération, sauf décision contraire
          du Groupe.
        </p>
      </>
    ),
  },
  {
    id: "acces",
    titre: "Accès au service et compte",
    contenu: (
      <>
        <p>
          L’accès à Cotiz est gratuit, hors coût de la connexion Internet. L’Utilisateur s’identifie avec son nom et son numéro de téléphone. Lorsque la
          vérification par SMS est activée, un code à usage unique lui est envoyé.
        </p>
        <p>L’Utilisateur s’engage à :</p>
        <ul>
          <li>fournir un nom et un numéro de téléphone exacts, dont il est le titulaire ;</li>
          <li>ne pas se faire passer pour une autre personne ;</li>
          <li>préserver la confidentialité de son téléphone et des codes reçus ;</li>
          <li>avertir sans délai le service client en cas d’utilisation frauduleuse de son compte.</li>
        </ul>
        <p>Le service est réservé aux personnes majeures ou, à défaut, utilisant Cotiz avec l’accord de leur représentant légal.</p>
      </>
    ),
  },
  {
    id: "gestionnaires",
    titre: "Obligations du Trésorier et des Co-gestionnaires",
    contenu: (
      <>
        <p>Le Trésorier et les Co-gestionnaires s’engagent à :</p>
        <ul>
          <li>indiquer un numéro de paiement dont ils sont titulaires et le maintenir à jour ;</li>
          <li>confirmer de bonne foi les paiements effectivement reçus, et uniquement ceux-là ;</li>
          <li>verser la cagnotte au bénéficiaire prévu, dans les délais convenus par le Groupe ;</li>
          <li>n’ajouter au Groupe que des personnes qui ont donné leur accord.</li>
        </ul>
        <p>
          Toute modification du numéro de paiement est signalée à l’ensemble des membres. Le Trésorier reste <b>seul responsable</b> de la gestion des fonds
          qu’il reçoit, conformément aux règles fixées par le Groupe.
        </p>
      </>
    ),
  },
  {
    id: "membres",
    titre: "Obligations des Membres",
    contenu: (
      <ul>
        <li>verser les cotisations aux échéances prévues, y compris après avoir reçu la cagnotte ;</li>
        <li>ne déclarer un paiement qu’après l’avoir réellement effectué, et saisir une référence exacte ;</li>
        <li>respecter le règlement intérieur du Groupe qu’il a accepté ;</li>
        <li>utiliser les fonctions de rappel et de messagerie avec courtoisie.</li>
      </ul>
    ),
  },
  {
    id: "engagements",
    titre: "Règlement, pénalités et reconnaissance de dette",
    contenu: (
      <>
        <p>
          Le Groupe peut adopter un règlement intérieur et prévoir des pénalités de retard ainsi que leur destination (bénéficiaire du tour, caisse de
          solidarité, récompense ou don). Ces règles sont fixées par le Groupe et n’engagent que ses membres.
        </p>
        <p>
          L’acceptation du règlement et la reconnaissance de dette générée par Cotiz sont horodatées et conservées. Elles peuvent servir d’élément de preuve
          entre les membres. Cotiz n’intervient pas dans le recouvrement des sommes dues et n’est pas partie aux engagements pris entre les membres.
        </p>
      </>
    ),
  },
  {
    id: "interdits",
    titre: "Utilisations interdites",
    contenu: (
      <>
        <p>Il est strictement interdit d’utiliser Cotiz pour :</p>
        <ul>
          <li>organiser une escroquerie, un système pyramidal ou toute activité illicite ;</li>
          <li>blanchir de l’argent ou financer une activité illégale ;</li>
          <li>collecter des données sur d’autres personnes sans leur accord ;</li>
          <li>perturber le fonctionnement du service, contourner ses protections ou en extraire massivement les données.</li>
        </ul>
        <p>L’Éditeur se réserve le droit de signaler aux autorités compétentes tout comportement manifestement illicite.</p>
      </>
    ),
  },
  {
    id: "donnees",
    titre: "Données personnelles",
    contenu: (
      <p>
        Le traitement des données personnelles est décrit dans la <Link href="/confidentialite">politique de confidentialité</Link>, conformément à la loi
        ivoirienne n° 2013-450 du 19 juin 2013 relative à la protection des données à caractère personnel.
      </p>
    ),
  },
  {
    id: "securite",
    titre: "Sécurité et traçabilité",
    contenu: (
      <p>
        Pour protéger les Groupes, les actions importantes (paiements, confirmations, versements, changement de numéro, ajout ou retrait de membres) sont
        enregistrées dans un journal horodaté. Un paiement confirmé ne peut pas être effacé : il peut seulement être corrigé par une nouvelle opération
        visible de tous.
      </p>
    ),
  },
  {
    id: "responsabilite",
    titre: "Responsabilité",
    contenu: (
      <>
        <p>L’Éditeur met tout en œuvre pour assurer la disponibilité et la sécurité du service, dans le cadre d’une obligation de moyens.</p>
        <p>La responsabilité de l’Éditeur ne saurait être engagée :</p>
        <ul>
          <li>en cas de défaut de paiement d’un membre, de détournement par un Trésorier ou de litige entre membres ;</li>
          <li>en cas d’erreur dans les informations saisies par les Utilisateurs ;</li>
          <li>en cas d’incident chez un Opérateur de paiement, un opérateur téléphonique ou un hébergeur ;</li>
          <li>en cas d’interruption temporaire du service pour maintenance ou en cas de force majeure.</li>
        </ul>
      </>
    ),
  },
  {
    id: "suspension",
    titre: "Suspension et suppression du compte",
    contenu: (
      <>
        <p>
          L’Éditeur peut suspendre ou supprimer, après avertissement lorsque cela est possible, le compte d’un Utilisateur qui ne respecte pas les présentes
          CGU.
        </p>
        <p>
          L’Utilisateur peut supprimer son compte à tout moment depuis la page <Link href="/suppression-compte">Supprimer mon compte</Link>. L’historique des
          paiements des Groupes est conservé pour garantir la transparence envers les autres membres.
        </p>
      </>
    ),
  },
  {
    id: "propriete",
    titre: "Propriété intellectuelle",
    contenu: (
      <p>
        Le nom Cotiz, le logo, les textes, les illustrations et le code de l’application sont protégés. Toute reproduction ou utilisation sans autorisation
        écrite de l’Éditeur est interdite.
      </p>
    ),
  },
  {
    id: "modification",
    titre: "Modification des CGU",
    contenu: (
      <p>
        L’Éditeur peut modifier les présentes CGU. Les Utilisateurs en sont informés dans l’application. La poursuite de l’utilisation de Cotiz après cette
        information vaut acceptation des nouvelles conditions.
      </p>
    ),
  },
  {
    id: "droit",
    titre: "Droit applicable et litiges",
    contenu: (
      <>
        <p>Les présentes CGU sont soumises au droit ivoirien.</p>
        <p>
          En cas de difficulté, l’Utilisateur est invité à contacter d’abord le service client afin de rechercher une solution amiable. À défaut d’accord, le
          litige sera porté devant les juridictions compétentes d’Abidjan.
        </p>
      </>
    ),
  },
  {
    id: "contact",
    titre: "Contact",
    contenu: (
      <ul>
        <li>Service client : <b>{SUPPORT_AFFICHE}</b> (appel ou WhatsApp)</li>
        <li>E-mail : <ACompleter>adresse e-mail de contact</ACompleter></li>
        <li>Adresse : <ACompleter>adresse postale de l’entreprise</ACompleter></li>
      </ul>
    ),
  },
];

export default function CGU() {
  return (
    <DocumentLegal
      actuel="/cgu"
      titre="Conditions générales d’utilisation"
      chapeau="Les règles d’utilisation de Cotiz : ce que fait le service, ce qu’il ne fait pas, et les engagements de chacun."
      version="1.0"
      maj="10 novembre 2026"
      articles={ARTICLES}
    />
  );
}
