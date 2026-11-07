"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button, Card, Field, Header, Loading, Page, inputClass, useRequireUser } from "@/components/ui";
import { fcfa } from "@/lib/format";
import { useStore } from "@/lib/store";
import { HandCoins, Repeat, Users, type LucideIcon } from "lucide-react";
import { IconBadge } from "@/components/icons";
import type { Frequency, GroupType } from "@/lib/types";

const TYPES: { id: GroupType; icon: LucideIcon; ton: "orange" | "bleu" | "violet"; titre: string; desc: string }[] = [
  { id: "tontine", icon: Repeat, ton: "orange", titre: "Tontine", desc: "Chacun cotise, un membre ramasse à chaque tour" },
  { id: "association", icon: Users, ton: "bleu", titre: "Association", desc: "Cotisation régulière pour une caisse commune" },
  { id: "collecte", icon: HandCoins, ton: "violet", titre: "Collecte", desc: "Funérailles, mariage, baptême, projet…" },
];

const today = () => new Date().toISOString().slice(0, 10);

export default function NouveauGroupe() {
  const ok = useRequireUser();
  const { createGroup } = useStore();
  const router = useRouter();
  const [type, setType] = useState<GroupType>("tontine");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("10000");
  const [frequency, setFrequency] = useState<Frequency>("mensuelle");
  const [startDate, setStartDate] = useState(today());
  const [penalty, setPenalty] = useState("500");
  const [target, setTarget] = useState("300000");
  const [shuffle, setShuffle] = useState(true);
  const [members, setMembers] = useState([{ name: "", phone: "" }, { name: "", phone: "" }]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  if (!ok) return <Loading />;

  const setMember = (i: number, k: "name" | "phone", v: string) =>
    setMembers((ms) => ms.map((m, j) => (j === i ? { ...m, [k]: v } : m)));

  const nbMembres = members.filter((m) => m.name.trim()).length + 1;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return setError("Donne un nom au groupe.");
    if (type !== "collecte" && !(Number(amount) > 0)) return setError("Indique le montant de la cotisation.");
    setBusy(true);
    setError("");
    try {
    const id = await createGroup({
      name,
      type,
      description,
      amount: Number(amount),
      frequency,
      startDate,
      penalty: Number(penalty) || 0,
      target: Number(target) || undefined,
      members,
      shuffle,
    });
    router.replace(`/groupes/${id}`);
    } catch (err) {
      setError("Impossible de créer le groupe : " + (err as Error).message);
      setBusy(false);
    }
  }

  return (
    <Page>
      <Header back="/groupes" title="Nouveau groupe" />
      <form onSubmit={submit} className="space-y-5 p-4">
        <div className="grid gap-2">
          {TYPES.map((t) => (
            <button
              type="button"
              key={t.id}
              onClick={() => setType(t.id)}
              className={`flex items-center gap-3 rounded-2xl border-2 bg-white p-3 text-left transition ${type === t.id ? "border-emerald-500 bg-emerald-50/50" : "border-stone-200"}`}
            >
              <IconBadge icon={t.icon} ton={t.ton} />
              <span>
                <span className="block font-bold">{t.titre}</span>
                <span className="block text-xs text-stone-500">{t.desc}</span>
              </span>
            </button>
          ))}
        </div>

        <Card className="space-y-4">
          <Field label="Nom du groupe">
            <input className={inputClass} value={name} onChange={(e) => setName(e.target.value)}
              placeholder={type === "tontine" ? "ex : Tontine des commerçantes d'Adjamé" : type === "association" ? "ex : Mutuelle du quartier Riviera 2" : "ex : Mariage de Christelle & Ulrich"} />
          </Field>
          <Field label="Description (facultatif)">
            <textarea className={inputClass} rows={2} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Règles, but de la caisse…" />
          </Field>

          {type === "collecte" ? (
            <>
              <Field label="Objectif à atteindre (F CFA)">
                <input className={inputClass} inputMode="numeric" value={target} onChange={(e) => setTarget(e.target.value.replace(/\D/g, ""))} />
              </Field>
              <Field label="Date limite">
                <input type="date" className={inputClass} value={startDate} onChange={(e) => setStartDate(e.target.value)} />
              </Field>
            </>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Cotisation (F CFA)">
                  <input className={inputClass} inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value.replace(/\D/g, ""))} />
                </Field>
                <Field label="Fréquence">
                  <select className={inputClass} value={frequency} onChange={(e) => setFrequency(e.target.value as Frequency)}>
                    <option value="mensuelle">Chaque mois</option>
                    <option value="hebdomadaire">Chaque semaine</option>
                  </select>
                </Field>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field label="1ère échéance">
                  <input type="date" className={inputClass} value={startDate} onChange={(e) => setStartDate(e.target.value)} />
                </Field>
                <Field label="Pénalité de retard">
                  <input className={inputClass} inputMode="numeric" value={penalty} onChange={(e) => setPenalty(e.target.value.replace(/\D/g, ""))} />
                </Field>
              </div>
            </>
          )}
        </Card>

        <Card className="space-y-3">
          <div>
            <h3 className="font-bold">Membres</h3>
            <p className="text-xs text-stone-500">Tu es ajouté automatiquement comme trésorier. Tu pourras aussi inviter par lien WhatsApp.</p>
          </div>
          {members.map((m, i) => (
            <div key={i} className="grid grid-cols-[1fr_9rem] gap-2">
              <input className={inputClass} placeholder={`Nom du membre ${i + 1}`} value={m.name} onChange={(e) => setMember(i, "name", e.target.value)} />
              <input className={inputClass} placeholder="07 00 00 00 00" inputMode="tel" value={m.phone} onChange={(e) => setMember(i, "phone", e.target.value)} />
            </div>
          ))}
          <button type="button" onClick={() => setMembers((ms) => [...ms, { name: "", phone: "" }])} className="text-sm font-semibold text-emerald-700">
            + Ajouter un membre
          </button>
          {type === "tontine" && (
            <label className="flex items-center gap-2 pt-1 text-sm">
              <input type="checkbox" checked={shuffle} onChange={(e) => setShuffle(e.target.checked)} className="h-4 w-4 accent-emerald-600" />
              Tirer au sort l’ordre de passage
            </label>
          )}
        </Card>

        {type !== "collecte" && Number(amount) > 0 && (
          <p className="rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-800 ring-1 ring-emerald-200">
            {type === "tontine"
              ? <>Avec {nbMembres} membres, chaque bénéficiaire recevra <b>{fcfa(Number(amount) * nbMembres)}</b> par tour, sur {nbMembres} tours.</>
              : <>Avec {nbMembres} membres, la caisse recevra <b>{fcfa(Number(amount) * nbMembres)}</b> par {frequency === "mensuelle" ? "mois" : "semaine"}.</>}
          </p>
        )}

        {error && <p className="text-sm font-medium text-red-600">{error}</p>}
        <Button type="submit" className="w-full" disabled={busy}>{busy ? "Création…" : "Créer le groupe"}</Button>
      </form>
    </Page>
  );
}
