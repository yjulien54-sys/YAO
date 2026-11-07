"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { Button, Card, Field, Loading, Logo, inputClass } from "@/components/ui";
import { useStore } from "@/lib/store";

export default function AccueilPage() {
  return (
    <Suspense fallback={<Loading />}>
      <Accueil />
    </Suspense>
  );
}

function Accueil() {
  const { ready, user, login } = useStore();
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
      await login({ name: name.trim(), phone: phone.replace(/\D/g, "") });
      router.replace(suite);
    } catch (err) {
      setError("Connexion impossible : " + (err as Error).message);
      setBusy(false);
    }
  }

  if (!ready) return <Loading />;

  return (
    <div className="mx-auto min-h-dvh max-w-md bg-stone-50">
      <section className="relative overflow-hidden bg-gradient-to-br from-emerald-700 via-emerald-600 to-emerald-500 px-6 pb-16 pt-8 text-white">
        <div className="absolute -right-16 -top-16 h-56 w-56 rounded-full bg-orange-400/30 blur-2xl" />
        <Logo className="relative text-xl" />
        <h1 className="relative mt-10 text-[28px] font-extrabold leading-tight">
          Tes tontines et cotisations, <span className="text-orange-200">sans palabres.</span>
        </h1>
        <p className="relative mt-3 text-[15px] leading-relaxed text-emerald-50">
          Tontine, association, mutuelle, collecte pour des funérailles… Tout le monde voit qui a payé. Les relances
          partent toutes seules sur WhatsApp.
        </p>
        <ul className="relative mt-6 grid grid-cols-2 gap-2 text-[13px] font-medium">
          {["💸 Wave, Orange, MTN, Moov", "✅ Transparent pour tous", "📲 Relances WhatsApp", "🧾 Reçu pour chaque paiement"].map((t) => (
            <li key={t} className="rounded-xl bg-white/15 px-3 py-2 backdrop-blur">{t}</li>
          ))}
        </ul>
      </section>

      <div className="-mt-8 px-4 pb-10">
        <Card className="relative shadow-lg shadow-stone-900/5">
          <form onSubmit={continuer} className="space-y-4">
            <h2 className="text-lg font-bold">{suite.startsWith("/groupes/") ? "Rejoindre le groupe" : "Commencer"}</h2>
            <Field label="Ton nom">
              <input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} placeholder="ex : Yao Kouassi" autoComplete="name" />
            </Field>
            <Field label="Numéro de téléphone" hint="Le même numéro que celui donné au trésorier de ton groupe.">
              <div className="flex gap-2">
                <span className="grid place-items-center rounded-xl border border-stone-300 bg-stone-100 px-3 text-sm font-semibold text-stone-600">🇨🇮 +225</span>
                <input className={inputClass} value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="07 07 12 34 56" inputMode="tel" autoComplete="tel" />
              </div>
            </Field>
            {error && <p className="text-sm font-medium text-red-600">{error}</p>}
            <Button className="w-full" type="submit" disabled={busy}>{busy ? "Connexion…" : "Continuer"}</Button>
          </form>
        </Card>
        <p className="mt-6 text-center text-xs leading-relaxed text-stone-500">
          Cotiz ne garde jamais ton argent : les paiements passent par un opérateur agréé BCEAO et arrivent directement sur le compte du groupe.
        </p>
      </div>
    </div>
  );
}
