"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCheck, CheckSquare, Copy, ExternalLink, MoreVertical, Square, Trash2 } from "lucide-react";
import { BarreSelection, MenuActions, type Action } from "@/components/MenuActions";
import { copier, useAppuiLong } from "@/lib/appuiLong";
import { Bell, CheckCircle2, Clock, Coins, MessageCircle, ShieldCheck, UserPlus, XCircle } from "lucide-react";
import { BottomNav } from "@/components/BottomNav";
import { IconBadge } from "@/components/icons";
import { Card, Header, Loading, Page, useRequireUser } from "@/components/ui";
import { montantsLisibles, useNotifications } from "@/lib/notifications";

const ICONE: Record<string, [typeof Bell, "vert" | "ambre" | "rouge" | "bleu" | "violet"]> = {
  paiement_declare: [Clock, "ambre"],
  paiement_confirme: [CheckCircle2, "vert"],
  paiement_refuse: [XCircle, "rouge"],
  demande_adhesion: [UserPlus, "bleu"],
  adhesion_acceptee: [UserPlus, "vert"],
  versement_a_valider: [ShieldCheck, "violet"],
  versement_valide: [CheckCircle2, "vert"],
  versement_refuse: [XCircle, "rouge"],
  paiement_groupe: [Coins, "vert"],
  message_groupe: [MessageCircle, "bleu"],
};

function ilYa(iso: string) {
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "à l’instant";
  if (s < 3600) return `il y a ${Math.floor(s / 60)} min`;
  if (s < 86400) return `il y a ${Math.floor(s / 3600)} h`;
  const j = Math.floor(s / 86400);
  return j === 1 ? "hier" : `il y a ${j} jours`;
}

export default function Notifications() {
  const ok = useRequireUser();
  const { liste, nonLues, dispo, marquerLue, marquerToutLu, supprimer, toutSupprimer } = useNotifications();
  const router = useRouter();
  const appuiLong = useAppuiLong();
  const [menu, setMenu] = useState<{ titre?: string; apercu?: string; actions: Action[] } | null>(null);
  const [selection, setSelection] = useState<number[] | null>(null); // null = pas en mode sélection
  const [info, setInfo] = useState("");
  if (!ok) return <Loading />;

  const flash = (t: string) => { setInfo(t); setTimeout(() => setInfo(""), 2200); };
  const basculer = (id: number) => setSelection((s) => (s ? (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]) : [id]));
  const menuGeneral = () => setMenu({ titre: "Notifications", actions: [
    { label: "Tout marquer comme lu", icone: CheckCheck, onClick: marquerToutLu, desactive: nonLues === 0 },
    { label: "Sélectionner", icone: CheckSquare, onClick: () => setSelection([]), desactive: !liste.length },
    { label: "Tout supprimer", icone: Trash2, danger: true, desactive: !liste.length, onClick: () => { if (confirm(`Supprimer les ${liste.length} notifications ?`)) toutSupprimer().then(() => flash("Notifications supprimées")); } },
  ] });

  return (
    <Page>
      <Header
        back="/groupes"
        title="Notifications"
        right={liste.length > 0 ? <button onClick={menuGeneral} aria-label="Options" className="grid h-9 w-9 place-items-center rounded-full text-stone-600 hover:bg-stone-100"><MoreVertical size={19} /></button> : undefined}
      />
      <div className="space-y-3 p-4 pb-28">
        {selection && <BarreSelection nombre={selection.length} total={liste.length} toutSelectionner={() => setSelection(liste.map((n) => n.id))} annuler={() => setSelection(null)}
          supprimer={() => { if (confirm(`Supprimer ${selection.length} notification${selection.length > 1 ? "s" : ""} ?`)) { supprimer(selection).then(() => flash("Supprimé")); setSelection(null); } }} />}
        {liste.length > 0 && !selection && <p className="px-1 text-xs text-stone-400">Astuce : restez appuyé sur une notification pour la copier ou la supprimer.</p>}
        {!dispo && <Card className="text-sm text-stone-500">Les notifications seront bientôt disponibles.</Card>}
        {dispo && liste.length === 0 && (
          <Card className="space-y-2 py-8 text-center">
            <Bell className="mx-auto text-stone-300" size={36} />
            <p className="text-sm text-stone-500">Aucune notification pour l’instant. Tu seras prévenu ici quand un paiement est confirmé, quand quelqu’un veut rejoindre ton groupe ou quand un versement est à valider.</p>
          </Card>
        )}
        {liste.length > 0 && (
          <Card className="divide-y divide-stone-100 overflow-hidden !p-0">
            {liste.map((n) => {
              const [I, ton] = ICONE[n.type] ?? [Bell, "vert"];
              const contenu = (
                <>
                  <IconBadge icon={I} ton={ton} taille="sm" />
                  <div className="min-w-0 flex-1">
                    <p className={`text-sm ${n.lue ? "font-semibold text-stone-700" : "font-bold text-stone-900"}`}>{n.titre}</p>
                    {n.texte && <p className="text-[0.8125rem] leading-snug text-stone-600">{montantsLisibles(n.texte)}</p>}
                    <p className="mt-0.5 text-xs text-stone-400">{ilYa(n.le)}</p>
                  </div>
                  {!n.lue && <span className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full bg-orange-500" aria-label="Non lue" />}
                </>
              );
              const choisie = !!selection?.includes(n.id);
              const cls = `flex items-start gap-3 px-4 py-3 transition hover:bg-stone-50 ${choisie ? "bg-emerald-100/60" : n.lue ? "" : "bg-emerald-50/40"}`;
              const actions = appuiLong(() => setMenu({ titre: n.titre, apercu: montantsLisibles(n.texte), actions: [
                ...(n.lien ? [{ label: "Ouvrir", icone: ExternalLink, onClick: () => { marquerLue(n.id); router.push(n.lien!); } }] : []),
                { label: "Copier le texte", icone: Copy, onClick: () => copier(`${n.titre}\n${montantsLisibles(n.texte)}`).then((ok) => flash(ok ? "Copié" : "Impossible de copier")) },
                ...(!n.lue ? [{ label: "Marquer comme lue", icone: CheckCheck, onClick: () => marquerLue(n.id) }] : []),
                { label: "Sélectionner", icone: CheckSquare, onClick: () => setSelection([n.id]) },
                { label: "Supprimer", icone: Trash2, danger: true, onClick: () => supprimer([n.id]).then(() => flash("Supprimé")) },
              ] }));
              if (selection) {
                return (
                  <button key={n.id} type="button" onClick={() => basculer(n.id)} className={`${cls} w-full text-left`}>
                    {choisie ? <CheckSquare size={20} className="mt-2 shrink-0 text-emerald-700" /> : <Square size={20} className="mt-2 shrink-0 text-stone-300" />}
                    {contenu}
                  </button>
                );
              }
              return n.lien ? (
                <Link key={n.id} href={n.lien} onClick={() => marquerLue(n.id)} className={cls} {...actions}>{contenu}</Link>
              ) : (
                <button key={n.id} type="button" onClick={() => marquerLue(n.id)} className={`${cls} w-full text-left`} {...actions}>{contenu}</button>
              );
            })}
          </Card>
        )}
      </div>
      {menu && <MenuActions titre={menu.titre} apercu={menu.apercu} actions={menu.actions} fermer={() => setMenu(null)} />}
      {info && <div className="fixed inset-x-0 bottom-24 z-[80] flex justify-center"><span className="notif-entre rounded-full bg-stone-900 px-4 py-2 text-sm font-semibold text-white shadow-lg">{info}</span></div>}
      <BottomNav />
    </Page>
  );
}
