"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { LogosOperateurs } from "@/components/LogosOperateurs";
import { DateNaissance } from "@/components/DateNaissance";
import { Suspense, useEffect, useState } from "react";
import { Button, Card, Field, Loading, Logo, inputClass } from "@/components/ui";
import { useStore } from "@/lib/store";
import { enregistrerNaissance } from "@/lib/verrou";
import { noterTentative } from "@/lib/tentatives";
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
  const { ready, user, login, envoyerCode, verifierCode, retrouverCompte } = useStore();
  const [etape, setEtape] = useState<"infos" | "code" | "retrouver">("infos");
  const [codeSecret, setCodeSecret] = useState("");
  const [code, setCode] = useState("");
  const router = useRouter();
  const suiteParam = useSearchParams().get("suite");
  const suite = suiteParam && suiteParam.startsWith("/") ? suiteParam : "/groupes";
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [naissance, setNaissance] = useState("");
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
    if (!naissance) return setError("Indique ta date de naissance.");
    setError("");
    setBusy(true);
    noterTentative(phone, name, "formulaire");
    try {
      if (CONNEXION_SMS) {
        try { await envoyerCode(phone); } catch (er) { noterTentative(phone, name, "erreur_envoi", (er as Error).message); throw er; }
        noterTentative(phone, name, "code_envoye");
        setEtape("code");
        setBusy(false);
        return;
      }
      await login({ name: name.trim(), phone: phone.replace(/\D/g, "") });
      await enregistrerNaissance(naissance);
      noterTentative(phone, name, "terminee");
      router.replace(suite);
    } catch (err) {
      if (!CONNEXION_SMS) noterTentative(phone, name, "erreur", (err as Error).message);
      setError("Connexion impossible : " + (err as Error).message);
      setBusy(false);
    }
  }

  // Nouveau téléphone : numéro + date de naissance + code secret
  async function retrouver(e: React.FormEvent) {
    e.preventDefault();
    if (!telValide) return setError("Le numéro doit avoir 10 chiffres (ex : 07 07 12 34 56).");
    if (!naissance) return setError("Indique ta date de naissance.");
    if (!/^\d{4}$/.test(codeSecret)) return setError("Ton code secret a 4 chiffres.");
    setError("");
    setBusy(true);
    const r = await retrouverCompte(phone, naissance, codeSecret);
    if (r.ok) return router.replace(suite);
    setBusy(false);
    setCodeSecret("");
    setError(
      r.raison === "bloquee" ? "Trop d’essais pour ce numéro. Réessaie dans une heure ou contacte le service client."
      : r.raison === "faux" ? `Numéro, date de naissance ou code incorrect.${r.restants !== undefined ? ` Encore ${r.restants} essai${r.restants > 1 ? "s" : ""}.` : ""}`
      : r.raison === "indisponible" ? "Cette fonction n’est pas encore activée. Contacte le service client."
      : r.raison === "reseau" ? "Pas de connexion. Réessaie quand tu as du réseau."
      : "Une erreur est survenue. Réessaie ou contacte le service client."
    );
  }

  async function valider(e: React.FormEvent) {
    e.preventDefault();
    if (code.replace(/\D/g, "").length < 6) return setError("Entre le code à 6 chiffres reçu par SMS.");
    setError("");
    setBusy(true);
    try {
      await verifierCode({ name: name.trim(), phone: phone.replace(/\D/g, "") }, code.replace(/\D/g, ""));
      await enregistrerNaissance(naissance);
      noterTentative(phone, name, "terminee");
      router.replace(suite);
    } catch (err) {
      noterTentative(phone, name, "code_refuse", (err as Error).message);
      setError("Code incorrect ou expiré : " + (err as Error).message);
      setBusy(false);
    }
  }

  if (!ready) return <Loading />;

  return (
    <div className="mx-auto min-h-dvh max-w-md bg-[#f7f5f0] lg:grid lg:max-w-none lg:grid-cols-2">
      <section className="degrade-vert relative overflow-hidden px-6 pb-24 pt-8 text-white lg:sticky lg:top-0 lg:flex lg:h-dvh lg:flex-col lg:justify-center lg:px-[8%] lg:pb-12">
        <div className="motif absolute inset-0" />
        <div className="bande-kente absolute inset-x-0 bottom-0" />
        <div className="relative flex items-center justify-between lg:absolute lg:inset-x-[8%] lg:top-8">
          <Logo className="text-xl" />
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-xs font-semibold ring-1 ring-white/20"><Drapeau /> Côte d’Ivoire</span>
        </div>
        <h1 className="relative mt-9 text-[1.875rem] font-extrabold leading-[1.15] tracking-tight lg:mt-0 lg:text-[2.75rem]">
          Tes tontines et cotisations, <span className="text-orange-300">sans palabres.</span>
        </h1>
        <p className="relative mt-3 text-base leading-relaxed text-emerald-50/90 lg:max-w-lg lg:text-lg">
          Tontine, association, mutuelle, collecte pour des funérailles… Tout le monde voit qui a payé, et les rappels partent sur WhatsApp.
        </p>

        {/* Aperçu flottant */}
        <div className="flotte relative mx-auto mt-7 w-[88%] max-w-sm rounded-3xl lg:mx-0 lg:mt-10 bg-white p-4 text-stone-900 shadow-2xl shadow-emerald-950/40">
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

      <div className="lg:flex lg:min-h-dvh lg:flex-col lg:justify-center lg:px-10 lg:py-10">
      <div className="lg:mx-auto lg:w-full lg:max-w-md">
      <ul className="-mt-10 grid grid-cols-2 gap-2 px-4 lg:mt-0 lg:px-0 text-[0.875rem] font-semibold text-stone-700">
        {([[Wallet, "Wave, Orange, MTN, Moov"], [ShieldCheck, "Transparent pour tous"], [BellRing, "Rappels WhatsApp"], [Receipt, "Un reçu par paiement"]] as const).map(([I, t]) => (
          <li key={t} className="carte relative flex items-center gap-2.5 !rounded-2xl px-3 py-2.5 leading-tight">
            <IconBadge icon={I} taille="sm" />
            {t}
          </li>
        ))}
      </ul>
      <p className="mt-3 flex items-center justify-center gap-2 px-4 text-xs font-semibold text-stone-500 lg:px-0">Payez avec <LogosOperateurs taille={26} /></p>

      <div className="mt-4 px-4 pb-10 lg:px-0 lg:pb-0">
        <Card className="relative shadow-lg shadow-stone-900/5">
          {etape === "retrouver" ? (
            <form onSubmit={retrouver} className="space-y-4">
              <h2 className="text-lg font-bold">Retrouver mon compte</h2>
              <p className="text-sm text-stone-600">Nouveau téléphone ? Tape les informations de ton compte Cotiz : tu retrouves tous tes groupes.</p>
              <Field label="Numéro de téléphone">
                <div className="flex gap-2">
                  <span className="flex shrink-0 items-center gap-1.5 rounded-2xl border border-stone-200 bg-stone-50 px-3 text-sm font-semibold text-stone-600"><Drapeau /> +225</span>
                  <input className={inputClass} value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="07 07 12 34 56" inputMode="tel" autoComplete="tel" />
                </div>
              </Field>
              <Field label="Date de naissance">
                <DateNaissance value={naissance} onChange={setNaissance} />
              </Field>
              <Field label="Code secret Cotiz (4 chiffres)">
                <input
                  type="password"
                  className={`${inputClass} text-center text-xl font-bold tracking-[0.6em]`}
                  value={codeSecret}
                  onChange={(e) => setCodeSecret(e.target.value.replace(/\D/g, "").slice(0, 4))}
                  inputMode="numeric"
                  autoComplete="off"
                  placeholder="••••"
                  aria-label="Code secret"
                />
              </Field>
              {error && <p className="text-sm font-medium text-red-600">{error}</p>}
              <Button className="w-full" type="submit" disabled={busy}>{busy ? "Vérification…" : "Retrouver mon compte"}</Button>
              <button type="button" onClick={() => { setEtape("infos"); setError(""); }} className="w-full text-sm font-semibold text-stone-500">Je n’ai pas encore de compte</button>
            </form>
          ) : etape === "code" ? (
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
            <Field label="Date de naissance" hint="Elle sert à récupérer ton code secret si tu l’oublies.">
              <DateNaissance value={naissance} onChange={setNaissance} />
            </Field>
            <Field label="Numéro de téléphone" hint="Le même numéro que celui donné au trésorier de ton groupe.">
              <div className="flex gap-2">
                <span className="flex shrink-0 items-center gap-1.5 rounded-2xl border border-stone-200 bg-stone-50 px-3 text-sm font-semibold text-stone-600"><Drapeau /> +225</span>
                <input className={inputClass} value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="07 07 12 34 56" inputMode="tel" autoComplete="tel" />
              </div>
            </Field>
            {error && <p className="text-sm font-medium text-red-600">{error}</p>}
            <Button className="w-full" type="submit" disabled={busy}>{busy ? (CONNEXION_SMS ? "Envoi du code…" : "Connexion…") : CONNEXION_SMS ? "Recevoir mon code par SMS" : "Continuer"}</Button>
            <button type="button" onClick={() => { setEtape("retrouver"); setError(""); }} className="w-full rounded-2xl border border-emerald-200 bg-emerald-50 py-3 text-sm font-bold text-emerald-800">
              J’ai déjà un compte (nouveau téléphone)
            </button>
          </form>
          )}
        </Card>
        <p className="mt-6 text-center text-xs leading-relaxed text-stone-500">
          Cotiz ne touche jamais à ton argent : tu paies directement le trésorier de ton groupe par Wave, Orange Money, MTN ou Moov, et tout le monde voit qui a payé.
        </p>
        <p className="mt-4 text-center text-xs text-stone-400">
          <a href="/cgu" className="underline">Conditions d’utilisation</a> · <a href="/confidentialite" className="underline">Confidentialité</a> · <a href="/mentions-legales" className="underline">Mentions légales</a>
        </p>
      </div>
      </div>
      </div>
    </div>
  );
}
