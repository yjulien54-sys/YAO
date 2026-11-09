"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { Button, Card, Field, Loading, Logo, inputClass } from "@/components/ui";
import { useStore } from "@/lib/store";
import { BellRing, Check, Gift, Receipt, Repeat, ShieldCheck, Wallet } from "lucide-react";
import { IconBadge } from "@/components/icons";

const Drapeau = () => (
  <span className="inline-flex h-3 w-[18px] overflow-hidden rounded-[2px] ring-1 ring-black/10" aria-hidden>
    <span className="flex-1 bg-[#f77f00]" />
    <span className="flex-1 bg-white" />
    <span className="flex-1 bg-[#009e60]" />
  </span>
);

/** Connexion sécurisée par code SMS (à activer quand le fournisseur de SMS est branché dans Supabase) */
const CONNEXION_SMS = process.env.NEXT_PUBLIC_CONNEXION === "sms";

export default function AccueilPage() {
  return (
    <Suspense fallback={<Loading />}>
      <Accueil />
    </Suspense>
  );
}

function Accueil() {
  const { ready, user, login, envoyerCode, verifierCode } = useStore();
  const [etape, setEtape] = useState<"infos" | "code">("infos");
  const [code, setCode] = useState("");
  const router = useRouter();
  const suiteParam = useSearchParams().get("suite");
  const suite = suiteParam && suiteParam.startsWith("/") ? suiteParam : "/groupes";
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (ready && user) router.replace(suite);
  }, [ready, user, router, suite]);

  const telValide = phone.replace(/\D/g, "").length === 10;

  async function continuer(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return setError("Indique ton nom.");
    if (!telValide) return setError("Le numéro doit avoir 10 chiffres (ex : 07 07 12 34 56).");
    setError("");
    setBusy(true);
    try {
      if (CONNEXION_SMS) {
        await envoyerCode(phone);
        setEtape("code");
        setBusy(false);
        return;
      }
      await login({ name: name.trim(), phone: phone.replace(/\D/g, "") });
      router.replace(suite);
    } catch (err) {
      setError("Connexion impossible : " + (err as Error).message);
      setBusy(false);
    }
  }

  async function valider(e: React.FormEvent) {
    e.preventDefault();
    if (code.replace(/\D/g, "").length < 6) return setError("Entre le code à 6 chiffres reçu par SMS.");
    setError("");
    setBusy(true);
    try {
      await verifierCode({ name: name.trim(), phone: phone.replace(/\D/g, "") }, code.replace(/\D/g, ""));
      router.replace(suite);
    } catch (err) {
      setError("Code incorrect ou expiré : " + (err as Error).message);
      setBusy(false);
    }
  }

  if (!ready) return <Loading />;

  return (
    <div className="mx-auto min-h-dvh max-w-md bg-[#f7f5f0]">
      <section className="degrade-vert relative overflow-hidden px-6 pb-24 pt-8 text-white">
        <div className="motif absolute inset-0" />
        <div className="bande-kente absolute inset-x-0 bottom-0" />
        <div className="relative flex items-center justify-between">
          <Logo className="text-xl" />
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-xs font-semibold ring-1 ring-white/20"><Drapeau /> Côte d’Ivoire</span>
        </div>
        <h1 className="relative mt-9 text-[1.875rem] font-extrabold leading-[1.15] tracking-tight">
          Tes tontines et cotisations, <span className="text-orange-300">sans palabres.</span>
        </h1>
        <p className="relative mt-3 text-base leading-relaxed text-emerald-50/90">
          Tontine, association, mutuelle, collecte pour des funérailles… Tout le monde voit qui a payé, et les rappels partent sur WhatsApp.
        </p>

        {/* Aperçu flottant */}
        <div className="flotte relative mx-auto mt-7 w-[88%] rounded-3xl bg-white p-4 text-stone-900 shadow-2xl shadow-emerald-950/40">
          <div className="flex items-center gap-3">
            <IconBadge icon={Repeat} ton="orange" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-bold">Tontine des commerçantes</p>
              <p className="inline-flex items-center gap-1 text-xs text-stone-500">Tour 3 sur 10 · <Gift size={12} strokeWidth={1.75} /> Awa reçoit</p>
            </div>
          </div>
          <div className="mt-3 flex items-baseline justify-between">
            <span className="text-xl font-extrabold">400 000 F</span>
            <span className="text-xs text-stone-500">sur 500 000 F</span>
          </div>
          <div className="mt-1.5 h-2.5 overflow-hidden rounded-full bg-stone-200">
            <div className="h-full w-4/5 rounded-full bg-gradient-to-r from-orange-300 to-orange-500" />
          </div>
          <div className="mt-3 flex -space-x-2">
            {["AK", "MT", "FD", "SB", "AN"].map((x, i) => (
              <span key={x} className={`grid h-7 w-7 place-items-center rounded-full border-2 border-white text-[0.75rem] font-bold ${["bg-orange-100 text-orange-700", "bg-emerald-100 text-emerald-700", "bg-sky-100 text-sky-700", "bg-violet-100 text-violet-700", "bg-rose-100 text-rose-700"][i]}`}>
                {x}
              </span>
            ))}
            <span className="ml-3 inline-flex items-center gap-1 self-center pl-3 text-xs font-semibold text-emerald-700"><Check size={14} strokeWidth={2.25} /> 8 ont payé</span>
          </div>
        </div>
      </section>

      <ul className="-mt-10 grid grid-cols-2 gap-2 px-4 text-[0.875rem] font-semibold text-stone-700">
        {([[Wallet, "Wave, Orange, MTN, Moov"], [ShieldCheck, "Transparent pour tous"], [BellRing, "Rappels WhatsApp"], [Receipt, "Un reçu par paiement"]] as const).map(([I, t]) => (
          <li key={t} className="carte relative flex items-center gap-2.5 !rounded-2xl px-3 py-2.5 leading-tight">
            <IconBadge icon={I} taille="sm" />
            {t}
          </li>
        ))}
      </ul>

      <div className="mt-4 px-4 pb-10">
        <Card className="relative shadow-lg shadow-stone-900/5">
          {etape === "code" ? (
            <form onSubmit={valider} className="space-y-4">
              <h2 className="text-lg font-bold">Code de vérification</h2>
              <p className="text-sm text-stone-600">Nous avons envoyé un code à 6 chiffres par SMS au <b>+225 {phone}</b>.</p>
              <input
                className={`${inputClass} text-center text-2xl font-bold tracking-[0.5em]`}
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                inputMode="numeric"
                autoComplete="one-time-code"
                placeholder="••••••"
                autoFocus
              />
              {error && <p className="text-sm font-medium text-red-600">{error}</p>}
              <Button className="w-full" type="submit" disabled={busy}>{busy ? "Vérification…" : "Valider"}</Button>
              <div className="flex justify-between text-sm font-medium">
                <button type="button" onClick={() => { setEtape("infos"); setCode(""); setError(""); }} className="text-stone-500">Changer de numéro</button>
                <button type="button" disabled={busy} onClick={async () => { setError(""); try { await envoyerCode(phone); setError("Nouveau code envoyé."); } catch (er) { setError((er as Error).message); } }} className="text-emerald-700">Renvoyer le code</button>
              </div>
            </form>
          ) : (
          <form onSubmit={continuer} className="space-y-4">
            <h2 className="text-lg font-bold">{suite.startsWith("/groupes/") ? "Rejoindre le groupe" : "Commencer"}</h2>
            <Field label="Ton nom">
              <input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} placeholder="ex : Yao Kouassi" autoComplete="name" />
            </Field>
            <Field label="Numéro de téléphone" hint="Le même numéro que celui donné au trésorier de ton groupe.">
              <div className="flex gap-2">
                <span className="flex shrink-0 items-center gap-1.5 rounded-2xl border border-stone-200 bg-stone-50 px-3 text-sm font-semibold text-stone-600"><Drapeau /> +225</span>
                <input className={inputClass} value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="07 07 12 34 56" inputMode="tel" autoComplete="tel" />
              </div>
            </Field>
            {error && <p className="text-sm font-medium text-red-600">{error}</p>}
            <Button className="w-full" type="submit" disabled={busy}>{busy ? (CONNEXION_SMS ? "Envoi du code…" : "Connexion…") : CONNEXION_SMS ? "Recevoir mon code par SMS" : "Continuer"}</Button>
          </form>
          )}
        </Card>
        <p className="mt-6 text-center text-xs leading-relaxed text-stone-500">
          Cotiz ne garde jamais ton argent : les paiements passent par un opérateur agréé BCEAO et arrivent directement sur le compte du groupe.
        </p>
        <p className="mt-4 text-center text-xs text-stone-400">
          <a href="/confidentialite" className="underline">Confidentialité</a> · <a href="/suppression-compte" className="underline">Supprimer mon compte</a>
        </p>
      </div>
    </div>
  );
}
