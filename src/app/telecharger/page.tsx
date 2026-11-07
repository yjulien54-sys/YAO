import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Télécharger Cotiz pour Android",
  description: "Installe l'application Cotiz sur ton téléphone Android.",
};

const ETAPES = [
  "Touche le bouton vert « Télécharger l’application ».",
  "Ouvre le fichier cotiz.apk une fois téléchargé (dans la notification ou dans « Téléchargements »).",
  "Si Android le demande, autorise l’installation depuis cette source (Chrome ou Fichiers), puis reviens en arrière.",
  "Touche « Installer », puis « Ouvrir » : Cotiz apparaît avec son logo vert.",
];

export default function Telecharger() {
  return (
    <main className="mx-auto min-h-dvh max-w-md bg-[#f7f5f0]">
      <section className="degrade-vert relative overflow-hidden px-6 pb-10 pt-10 text-center text-white">
        <div className="motif absolute inset-0 opacity-60" />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/icons/logo.svg" alt="" width={88} height={88} className="relative mx-auto h-[88px] w-[88px] rounded-[22px] shadow-xl" />
        <h1 className="relative mt-5 text-2xl font-extrabold tracking-tight">Cotiz pour Android</h1>
        <p className="relative mt-1 text-sm text-emerald-50/90">Tontines, associations et collectes · version 1.0.1</p>
        <a
          href="/app/cotiz.apk"
          download="cotiz.apk"
          className="relative mt-6 inline-flex w-full items-center justify-center rounded-2xl bg-white px-4 py-4 text-base font-extrabold text-emerald-800 shadow-lg"
        >
          Télécharger l’application
        </a>
        <p className="relative mt-2 text-xs text-emerald-50/80">Fichier de 3,8 Mo · Android 5 ou plus récent</p>
      </section>

      <div className="space-y-4 p-5">
        <div className="carte p-4">
          <h2 className="font-bold">Comment l’installer</h2>
          <ol className="mt-3 space-y-3">
            {ETAPES.map((e, i) => (
              <li key={i} className="flex gap-3 text-sm leading-relaxed text-stone-700">
                <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-emerald-600 text-xs font-bold text-white">{i + 1}</span>
                {e}
              </li>
            ))}
          </ol>
        </div>
        <div className="carte p-4 text-sm leading-relaxed text-stone-700">
          <h2 className="font-bold">Sur iPhone</h2>
          <p className="mt-2">
            Ouvre <b>tontine-et-cotise.vercel.app</b> dans Safari, touche <b>Partager</b>, puis <b>« Sur l’écran d’accueil »</b>.
          </p>
        </div>
        <p className="text-center text-xs text-stone-500">
          Bientôt sur le Google Play Store. · <Link href="/" className="underline">Ouvrir Cotiz dans le navigateur</Link>
        </p>
      </div>
    </main>
  );
}
