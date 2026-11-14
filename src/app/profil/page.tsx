"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { CalendarDays, ChevronRight, Globe, Download, Fingerprint, Headset, FileText, HelpCircle, KeyRound, Landmark, LogOut, Pencil, Share2, ShieldCheck, Smartphone, Trash2 } from "lucide-react";
import { aEmpreinte, activerEmpreinte, desactiverEmpreinte, empreinteDisponible, enregistrerNaissance, etatCode, type Etat } from "@/lib/verrou";
import { DateNaissance } from "@/components/DateNaissance";
import { supabase } from "@/lib/supabase";
import { ClavierCode } from "@/components/ClavierCode";
import { dateLongue } from "@/lib/format";
import { BottomNav } from "@/components/BottomNav";
import { IconBadge } from "@/components/icons";
import { Avatar, Button, Card, Field, Header, Loading, Page, inputClass, useRequireUser } from "@/components/ui";
import { telAffiche } from "@/lib/format";
import { useStore } from "@/lib/store";
import { waLink } from "@/lib/whatsapp";
import { SUPPORT_AFFICHE } from "@/lib/support";


function Ligne({ href, icon, label, detail, externe, onClick }: { href?: string; icon: Parameters<typeof IconBadge>[0]["icon"]; label: string; detail?: string; externe?: boolean; onClick?: () => void }) {
  const contenu = (
    <>
      <IconBadge icon={icon} ton="gris" taille="sm" />
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold">{label}</span>
        {detail && <span className="block truncate text-xs text-stone-500">{detail}</span>}
      </span>
      <ChevronRight size={18} className="text-stone-400" />
    </>
  );
  const cls = "flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-stone-50";
  if (onClick) return <button onClick={onClick} className={cls}>{contenu}</button>;
  if (externe) return <a href={href} target="_blank" rel="noreferrer" className={cls}>{contenu}</a>;
  return <Link href={href!} className={cls}>{contenu}</Link>;
}

export default function ProfilPage() {
  const ok = useRequireUser();
  const { user, userId, groups, loaded, logout, updateProfile } = useStore();
  const [etatC, setEtatC] = useState<Etat | null>(null);
  const [changerCode, setChangerCode] = useState(false);
  const [naissance, setNaissance] = useState("");
  const [msgCode, setMsgCode] = useState("");
  const [bioDispo, setBioDispo] = useState(false);
  const [bioActive, setBioActive] = useState(false);
  useEffect(() => {
    if (userId) etatCode(userId).then(setEtatC);
  }, [userId, changerCode]);
  useEffect(() => {
    empreinteDisponible().then(setBioDispo);
    if (userId) setBioActive(aEmpreinte(userId));
  }, [userId]);
  const [edition, setEdition] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [msg, setMsg] = useState("");
  if (!ok || !loaded) return <Loading />;

  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const partage = waLink(`Bonjour 👋\n\nJe gère mes tontines avec *Cotiz* : chacun voit qui a payé, les retards sont calculés tout seuls et les relances partent sur WhatsApp en 1 clic. Fini le cahier et les palabres 😄\n\nC’est gratuit 👉 ${origin}\nCrée ton groupe, puis touche « Inviter » pour l’envoyer à tes membres.`);

  return (
    <Page>
      <Header title="Profil" />
      <div className="space-y-4 p-4 pb-28">
        <Card>
          {!edition ? (
            <div className="flex items-center gap-3">
              <Avatar name={user!.name} size={56} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-lg font-extrabold">{user!.name}</p>
                <p className="text-sm text-stone-500">{telAffiche(user!.phone)}</p>
                <p className="text-xs text-stone-400">{groups.length} groupe{groups.length > 1 ? "s" : ""}</p>
              </div>
              <button
                onClick={() => {
                  setName(user!.name);
                  setPhone(telAffiche(user!.phone));
                  setEdition(true);
                }}
                className="inline-flex items-center gap-1 rounded-xl bg-stone-100 px-3 py-2 text-sm font-semibold text-stone-700"
              >
                <Pencil size={14} /> Modifier
              </button>
            </div>
          ) : (
            <form
              className="space-y-3"
              onSubmit={async (e) => {
                e.preventDefault();
                if (!name.trim() || phone.replace(/\D/g, "").length !== 10) return setMsg("Nom et numéro à 10 chiffres obligatoires.");
                try {
                  await updateProfile({ name, phone });
                  setEdition(false);
                  setMsg("Profil mis à jour");
                } catch (err) {
                  setMsg("Erreur : " + (err as Error).message);
                }
              }}
            >
              <Field label="Ton nom"><input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} /></Field>
              <Field label="Ton numéro" hint="Le numéro sur lequel tes membres t’envoient l’argent si tu es trésorier."><input className={inputClass} inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} /></Field>
              <div className="grid grid-cols-2 gap-2">
                <Button type="button" variant="secondary" onClick={() => setEdition(false)}>Annuler</Button>
                <Button type="submit">Enregistrer</Button>
              </div>
            </form>
          )}
          {msg && <p className="mt-2 text-sm font-medium text-emerald-700">{msg}</p>}
        </Card>

        <div>
          <h2 className="mb-2 px-1 text-xs font-bold uppercase tracking-wide text-stone-500">Application</h2>
          <Card className="divide-y divide-stone-100 !p-0">
            <Ligne href="/telecharger" icon={Download} label="Télécharger l’application Android" detail="Installe Cotiz sur ton téléphone" />
            <Ligne href="/aide#iphone" icon={Smartphone} label="Installer sur iPhone" detail="Ajoute Cotiz sur l’écran d’accueil" />
            <Ligne href={partage} externe icon={Share2} label="Partager Cotiz" detail="Envoie l’application à tes proches sur WhatsApp" />
          </Card>
        </div>

        <div>
          <h2 className="mb-2 px-1 text-xs font-bold uppercase tracking-wide text-stone-500">Sécurité</h2>
          <Card className="divide-y divide-stone-100 !p-0">
            <Ligne
              icon={KeyRound}
              label={etatC?.defini ? "Changer mon code secret" : "Créer mon code secret"}
              detail={etatC?.modifieLe ? `Dernière modification : ${dateLongue(etatC.modifieLe)}` : "Le code à 4 chiffres demandé à l’ouverture de Cotiz"}
              onClick={() => setChangerCode(true)}
            />
            {etatC && etatC.naissance === false && (
              <div className="space-y-2 p-4">
                <p className="flex items-center gap-2 text-sm font-bold"><CalendarDays size={18} className="text-emerald-700" /> Ajouter ma date de naissance</p>
                <p className="text-xs text-stone-500">Elle est demandée, avec ton code, pour te connecter sur un autre téléphone ou un ordinateur.</p>
                <DateNaissance value={naissance} onChange={setNaissance} />
                <Button className="w-full" disabled={!naissance} onClick={async () => {
                  await enregistrerNaissance(naissance);
                  setEtatC({ ...etatC, naissance: true });
                  setMsgCode("Date de naissance enregistrée.");
                }}>Enregistrer</Button>
              </div>
            )}
            {process.env.NEXT_PUBLIC_GOOGLE === "on" && (
              <Ligne
                icon={Globe}
                label="Lier mon compte Google"
                detail="Pour te connecter aussi avec Google, sur n’importe quel appareil"
                onClick={async () => {
                  const { error } = await supabase.auth.linkIdentity({ provider: "google", options: { redirectTo: `${window.location.origin}/profil` } });
                  if (error) setMsgCode("Google n’a pas pu être lié : " + error.message);
                }}
              />
            )}
            {bioDispo && (
              <Ligne
                icon={Fingerprint}
                label={bioActive ? "Désactiver l’empreinte" : "Activer l’empreinte"}
                detail={bioActive ? "Activée sur ce téléphone" : "Entrer aussi avec ton doigt, en plus du code"}
                onClick={async () => {
                  if (!userId) return;
                  if (bioActive) {
                    desactiverEmpreinte(userId);
                    setBioActive(false);
                    return setMsgCode("Empreinte désactivée sur ce téléphone.");
                  }
                  if (!etatC?.defini) return setMsgCode("Crée d’abord ton code secret.");
                  try {
                    await activerEmpreinte(userId, user!.name, user!.phone);
                    setBioActive(true);
                    setMsgCode("Empreinte activée.");
                  } catch {
                    setMsgCode("L’empreinte n’a pas pu être activée.");
                  }
                }}
              />
            )}
          </Card>
          {msgCode && <p className="mt-2 px-1 text-sm font-medium text-emerald-700">{msgCode}</p>}
        </div>

        <div>
          <h2 className="mb-2 px-1 text-xs font-bold uppercase tracking-wide text-stone-500">Aide</h2>
          <Card className="divide-y divide-stone-100 !p-0">
            <Ligne href="/aide" icon={Headset} label="Service client" detail={`WhatsApp ou appel · ${SUPPORT_AFFICHE}`} />
            <Ligne href="/aide" icon={HelpCircle} label="Questions fréquentes" detail="Paiements, trésorier, rappels…" />
            <Ligne href="/cgu" icon={FileText} label="Conditions d’utilisation" />
            <Ligne href="/confidentialite" icon={ShieldCheck} label="Confidentialité" />
            <Ligne href="/mentions-legales" icon={Landmark} label="Mentions légales" />
          </Card>
        </div>

        <div>
          <h2 className="mb-2 px-1 text-xs font-bold uppercase tracking-wide text-stone-500">Compte</h2>
          <Card className="divide-y divide-stone-100 !p-0">
            <Ligne
              icon={LogOut}
              label="Se déconnecter"
              onClick={() => confirm("Attention : ton compte est enregistré sur ce téléphone. Si tu te déconnectes, tu ne pourras PAS revenir sur ce compte : tu devras en créer un nouveau et rouvrir le lien de chaque groupe. Te déconnecter quand même ?") && logout()}
            />
            <Ligne href="/suppression-compte" icon={Trash2} label="Supprimer mon compte" />
          </Card>
        </div>
        <p className="text-center text-xs text-stone-400">Cotiz · version 1.1</p>
      </div>
      {changerCode && userId && (
        <div className="fixed inset-0 z-50 mx-auto max-w-md">
          <div className="relative h-full">
            <ClavierCode
              uid={userId}
              defini={!!etatC?.defini}
              changement={!!etatC?.defini}
              naissanceConnue={etatC?.naissance}
              nom={user?.name}
              tel={user?.phone}
              onFermer={() => setChangerCode(false)}
              onOk={() => {
                setChangerCode(false);
                setMsgCode(etatC?.defini ? "Ton code secret a été changé." : "Ton code secret est créé.");
              }}
            />
          </div>
        </div>
      )}
      <BottomNav />
    </Page>
  );
}
