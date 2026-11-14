"use client";

import { useParams, useRouter } from "next/navigation";
import { CagnottePublique } from "@/components/CagnottePublique";
import { useEffect, useState } from "react";
import { ArrowDown, ArrowUp, Gift, HandHeart, Settings2, ShieldCheck, Trash2, UserCog, Users } from "lucide-react";
import { IconBadge } from "@/components/icons";
import { Avatar, Button, Card, Field, Header, Loading, Page, inputClass, useRequireUser } from "@/components/ui";
import { dateLongue, fcfa, telAffiche } from "@/lib/format";
import { ADD_POLICY_LABEL, FREQUENCES, ROLE_LABEL, droits } from "@/lib/logic";
import { useMe, useStore } from "@/lib/store";
import type { AddPolicy, Frequency, Member, PenaltyDestination } from "@/lib/types";
import { ChoixPenalites } from "@/components/ChoixPenalites";

export default function Parametres() {
  const ok = useRequireUser();
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { getGroup, loaded, userId, updateGroup, updateMember, removeMember, setOrder, deleteGroup } = useStore();
  const g = getGroup(id);
  const me = useMe(g);
  const [toast, setToast] = useState("");
  const [busy, setBusy] = useState(false);

  // Formulaire d'informations
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [penalty, setPenalty] = useState("");
  const [frequency, setFrequency] = useState<Frequency>("mensuelle");
  const [startDate, setStartDate] = useState("");
  const [target, setTarget] = useState("");
  const [ordre, setOrdre] = useState<string[]>([]);
  const [destination, setDestination] = useState<PenaltyDestination>("beneficiaire");
  const [cause, setCause] = useState("");
  const [edition, setEdition] = useState<{ id: string; name: string; phone: string } | null>(null);

  useEffect(() => {
    if (!g) return;
    setName(g.name);
    setDescription(g.description ?? "");
    setAmount(String(g.amount));
    setPenalty(String(g.penalty));
    setFrequency(g.frequency);
    setStartDate(g.startDate.slice(0, 10));
    setTarget(String(g.target ?? ""));
    setOrdre(g.order);
    setDestination(g.penaltyDestination);
    setCause(g.donCause ?? "");
  }, [g]);

  if (!ok || !loaded) return <Loading />;
  if (!g)
    return (
      <Page>
        <Header back="/groupes" title="Paramètres" />
        <p className="p-6 text-center text-stone-500">Groupe introuvable.</p>
      </Page>
    );

  const d = droits(g, me, userId);
  const flash = (t: string) => {
    setToast(t);
    setTimeout(() => setToast(""), 2500);
  };
  const agir = async (fn: () => Promise<void>, ok: string) => {
    setBusy(true);
    try {
      await fn();
      flash(ok);
    } catch (e) {
      flash("Erreur : " + (e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  if (!d.gestionnaire)
    return (
      <Page>
        <Header back={`/groupes/${g.id}`} title="Paramètres" />
        <div className="p-6 text-center text-sm text-stone-600">
          <IconBadge icon={ShieldCheck} ton="gris" taille="xl" className="mx-auto mb-3" />
          Seuls le trésorier et les co-gestionnaires peuvent modifier ce groupe.
        </div>
      </Page>
    );

  const membre = (mid: string) => g.members.find((m) => m.id === mid);
  const ordreModifie = ordre.join() !== g.order.join();
  const deplacer = (i: number, dir: -1 | 1) =>
    setOrdre((o) => {
      const j = i + dir;
      if (j < 0 || j >= o.length) return o;
      const n = [...o];
      [n[i], n[j]] = [n[j], n[i]];
      return n;
    });
  const mettreAuTour = (i: number) =>
    setOrdre((o) => {
      const n = [...o];
      const [x] = n.splice(i, 1);
      n.splice(g.currentRound - 1, 0, x);
      return n;
    });

  return (
    <Page>
      <Header back={`/groupes/${g.id}`} title="Paramètres du groupe" />
      <div className="space-y-4 p-4">
        {/* Cagnotte publique (collectes) */}
        {g.type === "collecte" && d.gestionnaire && (
          <div id="cagnotte" className="scroll-mt-20"><Card className="space-y-3 ring-2 ring-orange-200">
            <p className="flex items-center gap-2 font-bold"><span className="grid h-8 w-8 place-items-center rounded-xl bg-orange-100 text-base">🌍</span>Cagnotte publique à partager</p>
            <p className="text-sm text-stone-600">Une belle page avec photo, jauge et participants : envoie-la sur WhatsApp, même à ceux qui n’ont pas Cotiz.</p>
            <CagnottePublique groupId={g.id} nom={g.name} cause={g.donCause} />
          </Card></div>
        )}

        {/* Informations */}
        <Card className="space-y-3">
          <p className="flex items-center gap-2 font-bold"><IconBadge icon={Settings2} taille="sm" />Informations</p>
          <Field label="Nom du groupe">
            <input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} />
          </Field>
          <Field label="Description">
            <textarea className={inputClass} rows={2} value={description} onChange={(e) => setDescription(e.target.value)} />
          </Field>
          {g.type === "collecte" ? (
            <div className="grid grid-cols-2 gap-3">
              <Field label="Objectif (F CFA)">
                <input className={inputClass} inputMode="numeric" value={target} onChange={(e) => setTarget(e.target.value.replace(/\D/g, ""))} />
              </Field>
              <Field label="Date limite">
                <input type="date" className={inputClass} value={startDate} onChange={(e) => setStartDate(e.target.value)} />
              </Field>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Cotisation (F CFA)">
                  <input className={inputClass} inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value.replace(/\D/g, ""))} />
                </Field>
                <Field label="Pénalité de retard">
                  <input className={inputClass} inputMode="numeric" value={penalty} onChange={(e) => setPenalty(e.target.value.replace(/\D/g, ""))} />
                </Field>
              </div>
              <Field label="Fréquence">
                <select className={inputClass} value={frequency} onChange={(e) => setFrequency(e.target.value as Frequency)}>
                  {FREQUENCES.map((f) => (
                    <option key={f.id} value={f.id}>{f.label}</option>
                  ))}
                </select>
              </Field>
              <Field label="Date de la 1ère échéance" hint="Les échéances suivantes sont calculées à partir de cette date.">
                <input type="date" className={inputClass} value={startDate} onChange={(e) => setStartDate(e.target.value)} />
              </Field>
            </>
          )}
          <Button
            className="w-full"
            disabled={busy || !name.trim()}
            onClick={() =>
              agir(
                () =>
                  updateGroup(g.id, {
                    name,
                    description,
                    startDate,
                    ...(g.type === "collecte"
                      ? { target: Number(target) || null }
                      : { amount: Number(amount) || 0, penalty: Number(penalty) || 0, frequency }),
                  }),
                "Informations enregistrées"
              )
            }
          >
            Enregistrer les informations
          </Button>
        </Card>

        {/* Ordre des tours */}
        {g.type === "tontine" && g.tirageFait && (
          <Card className="space-y-1">
            <p className="flex items-center gap-2 font-bold"><IconBadge icon={Gift} taille="sm" />Ordre de passage</p>
            <p className="text-xs text-stone-600">
              L’ordre a été tiré au sort le {dateLongue(g.tirageFait)} par {g.tiragePar ?? "le trésorier"}. Pour la transparence, il ne peut plus être modifié.
            </p>
          </Card>
        )}

        {g.type === "tontine" && !g.tirageFait && (
          <Card className="space-y-3">
            <div>
              <p className="flex items-center gap-2 font-bold"><IconBadge icon={Gift} ton="orange" taille="sm" />Ordre de passage</p>
              <p className="mt-1 text-xs text-stone-500">
                Change qui reçoit à chaque tour. Le tour en cours est le tour {g.currentRound} : la personne à cette position reçoit {fcfa(g.amount * g.members.length)}.
              </p>
            </div>
            <div className="divide-y divide-stone-100 rounded-2xl ring-1 ring-stone-200">
              {ordre.map((mid, i) => {
                const m = membre(mid);
                const r = i + 1;
                const passe = r < g.currentRound;
                const actuel = r === g.currentRound;
                return (
                  <div key={mid} className={`flex items-center gap-2 px-3 py-2 ${actuel ? "bg-emerald-50" : ""}`}>
                    <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-full text-xs font-bold ${actuel ? "bg-emerald-600 text-white" : passe ? "bg-stone-200 text-stone-500" : "bg-stone-100 text-stone-700"}`}>{r}</span>
                    <span className={`min-w-0 flex-1 truncate text-sm font-semibold ${passe ? "text-stone-400" : ""}`}>
                      {m?.name ?? "—"} {actuel && <span className="text-xs font-semibold text-emerald-700">· reçoit ce tour</span>}
                    </span>
                    {!passe && !actuel && (
                      <button onClick={() => mettreAuTour(i)} className="rounded-lg bg-emerald-50 px-2 py-1 text-[0.8125rem] font-bold text-emerald-700 ring-1 ring-emerald-200">
                        Ce tour
                      </button>
                    )}
                    <button aria-label="Monter" onClick={() => deplacer(i, -1)} disabled={i === 0} className="rounded-lg p-1.5 text-stone-500 hover:bg-stone-100 disabled:opacity-30"><ArrowUp size={16} /></button>
                    <button aria-label="Descendre" onClick={() => deplacer(i, 1)} disabled={i === ordre.length - 1} className="rounded-lg p-1.5 text-stone-500 hover:bg-stone-100 disabled:opacity-30"><ArrowDown size={16} /></button>
                  </div>
                );
              })}
            </div>
            {ordreModifie && (
              <div className="grid grid-cols-2 gap-2">
                <Button variant="secondary" onClick={() => setOrdre(g.order)}>Annuler</Button>
                <Button disabled={busy} onClick={() => agir(() => setOrder(g.id, ordre), "Ordre de passage enregistré")}>Enregistrer l’ordre</Button>
              </div>
            )}
          </Card>
        )}

        {/* Membres */}
        <Card className="space-y-3">
          <p className="flex items-center gap-2 font-bold"><IconBadge icon={Users} ton="bleu" taille="sm" />Membres ({g.members.length})</p>
          <div className="divide-y divide-stone-100 rounded-2xl ring-1 ring-stone-200">
            {g.members.map((m: Member) => (
              <div key={m.id} className="space-y-2 px-3 py-3">
                {edition?.id === m.id ? (
                  <div className="space-y-2">
                    <input className={inputClass} value={edition.name} onChange={(e) => setEdition({ ...edition, name: e.target.value })} />
                    <input className={inputClass} inputMode="tel" value={edition.phone} onChange={(e) => setEdition({ ...edition, phone: e.target.value })} />
                    <div className="grid grid-cols-2 gap-2">
                      <Button variant="secondary" className="!py-2" onClick={() => setEdition(null)}>Annuler</Button>
                      <Button
                        className="!py-2"
                        disabled={busy || !edition.name.trim()}
                        onClick={() => agir(async () => { await updateMember(m.id, { name: edition.name, phone: edition.phone }); setEdition(null); }, "Membre modifié")}
                      >
                        Enregistrer
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-3">
                    <Avatar name={m.name} size={36} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold">{m.name}</p>
                      <p className="text-xs text-stone-500">{telAffiche(m.phone)} · {ROLE_LABEL[m.role]}</p>
                    </div>
                    <button onClick={() => setEdition({ id: m.id, name: m.name, phone: telAffiche(m.phone) })} className="rounded-lg bg-stone-100 px-2.5 py-1.5 text-xs font-semibold text-stone-700">Modifier</button>
                  </div>
                )}
                {edition?.id !== m.id && m.role !== "tresorier" && (
                  <div className="flex flex-wrap gap-2 pl-12">
                    {d.tresorier && (
                      <button
                        disabled={busy}
                        onClick={() =>
                          agir(
                            () => updateMember(m.id, { role: m.role === "gestionnaire" ? "membre" : "gestionnaire" }),
                            m.role === "gestionnaire" ? `${m.name} n’est plus co-gestionnaire` : `${m.name} est co-gestionnaire`
                          )
                        }
                        className="inline-flex items-center gap-1 rounded-lg bg-sky-50 px-2.5 py-1 text-xs font-semibold text-sky-700 ring-1 ring-sky-100"
                      >
                        <UserCog size={13} /> {m.role === "gestionnaire" ? "Retirer co-gestionnaire" : "Nommer co-gestionnaire"}
                      </button>
                    )}
                    <button
                      disabled={busy}
                      onClick={() => {
                        if (confirm(`Retirer ${m.name} du groupe ? Ses paiements déjà enregistrés restent dans l’historique.`))
                          agir(() => removeMember(m.id), `${m.name} a été retiré(e)`);
                      }}
                      className="inline-flex items-center gap-1 rounded-lg bg-red-50 px-2.5 py-1 text-xs font-semibold text-red-600 ring-1 ring-red-100"
                    >
                      <Trash2 size={13} /> Retirer
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </Card>

        {/* Utilisation des pénalités */}
        {d.tresorier && g.type !== "collecte" && (
          <Card className="space-y-3">
            <p className="flex items-center gap-2 font-bold"><IconBadge icon={HandHeart} taille="sm" />À quoi servent les pénalités ?</p>
            <ChoixPenalites valeur={destination} cause={cause} onChange={setDestination} onCause={setCause} disabled={busy} />
            {(destination !== g.penaltyDestination || (destination === "don" && cause !== (g.donCause ?? ""))) && (
              <Button
                className="w-full"
                disabled={busy || (destination === "don" && !cause.trim())}
                onClick={() => agir(() => updateGroup(g.id, { penaltyDestination: destination, donCause: destination === "don" ? cause : null }), "Utilisation des pénalités enregistrée")}
              >
                Enregistrer
              </Button>
            )}
          </Card>
        )}

        {/* Qui peut ajouter */}
        {d.tresorier && (
          <Card className="space-y-2">
            <p className="flex items-center gap-2 font-bold"><IconBadge icon={ShieldCheck} taille="sm" />Qui peut ajouter des membres ?</p>
            {(Object.keys(ADD_POLICY_LABEL) as AddPolicy[]).map((v) => (
              <label key={v} className={`flex cursor-pointer items-center gap-3 rounded-2xl border-2 p-3 text-sm font-semibold transition ${g.addPolicy === v ? "border-emerald-500 bg-emerald-50/50" : "border-stone-200"}`}>
                <input
                  type="radio"
                  name="policy"
                  checked={g.addPolicy === v}
                  disabled={busy}
                  onChange={() => agir(() => updateGroup(g.id, { addPolicy: v }), "Réglage enregistré")}
                  className="h-4 w-4 accent-emerald-600"
                />
                {ADD_POLICY_LABEL[v]}
              </label>
            ))}
            <p className="text-xs text-stone-500">Seul le trésorier confirme les paiements, verse la caisse et change le numéro de réception.</p>
          </Card>
        )}

        {/* Zone sensible */}
        {userId && g.createdBy === userId && (
          <Card className="space-y-2 border-red-200" >
            <span id="supprimer" />
            <p className="font-bold text-red-700">Supprimer le groupe</p>
            <p className="text-xs text-stone-600">Le groupe, ses membres et tout son historique seront effacés pour tout le monde. Cette action est définitive.</p>
            <Button
              variant="secondary"
              className="w-full !text-red-600 !ring-red-200"
              disabled={busy}
              onClick={() => {
                const saisie = prompt(`Pour confirmer, écris le nom du groupe : ${g.name}`);
                if (saisie?.trim() === g.name.trim())
                  agir(async () => {
                    await deleteGroup(g.id);
                    router.replace("/groupes");
                  }, "Groupe supprimé");
                else if (saisie !== null) flash("Le nom ne correspond pas");
              }}
            >
              <Trash2 size={16} /> Supprimer définitivement
            </Button>
          </Card>
        )}
      </div>
      {toast && (
        <div className="fixed inset-x-0 bottom-6 z-20 mx-auto w-fit max-w-[90%] rounded-full bg-stone-900 px-4 py-2.5 text-sm font-medium text-white shadow-lg">{toast}</div>
      )}
    </Page>
  );
}
