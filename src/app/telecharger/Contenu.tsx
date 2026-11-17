"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { detecterAppareil, GuideIPhone, type Appareil } from "@/components/InstallerIPhone";

const ETAPES = [
  "Touchez le bouton vert « Télécharger l’application ».",
  "Ouvrez le fichier sikaklo.apk une fois téléchargé (dans la notification ou dans « Téléchargements »).",
  "Si Android le demande, autorisez l’installation depuis cette source (Chrome ou Fichiers), puis revenez en arrière.",
  "Touchez « Installer », puis « Ouvrir » : Sikaklo apparaît avec son logo vert.",
];

export function Contenu() {
  const [a, setA] = useState<Appareil | null>(null);
  useEffect(() => setA(detecterAppareil()), []);
  const iphone = !!a?.ios;

  return (
    <main className="mx-auto min-h-dvh max-w-md bg-[#f7f5f0] lg:my-8 lg:min-h-0 lg:overflow-hidden lg:rounded-[2rem] lg:shadow-2xl lg:shadow-stone-900/10">
      <section className="degrade-vert relative overflow-hidden px-6 pb-10 pt-10 text-center text-white">
        <div className="motif absolute inset-0" />
        <div className="bande-kente absolute inset-x-0 bottom-0" />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/icons/logo.svg" alt="" width={88} height={88} className="relative mx-auto h-[88px] w-[88px] rounded-[22px] shadow-xl" />
        <h1 className="relative mt-5 text-2xl font-extrabold tracking-tight">{iphone ? "Sikaklo pour iPhone" : "Sikaklo pour Android"}</h1>
        <p className="relative mt-1 text-sm text-emerald-50/90">Tontines, associations et collectes · gratuit</p>
        {!iphone && (
          <>
            <a href="/app/sikaklo.apk" download="sikaklo.apk" className="relative mt-6 inline-flex w-full items-center justify-center rounded-2xl bg-white px-4 py-4 text-base font-extrabold text-emerald-800 shadow-lg">
              Télécharger l’application
            </a>
            <p className="relative mt-2 text-xs text-emerald-50/80">Fichier de 3,8 Mo · Android 5 ou plus récent</p>
          </>
        )}
        {iphone && a?.installee && <p className="relative mt-6 rounded-2xl bg-white/15 p-3 text-sm font-semibold">✅ Sikaklo est déjà installée sur cet iPhone.</p>}
      </section>

      <div className="space-y-4 p-5">
        {iphone && a && !a.installee && (
          <div className="carte p-4">
            <GuideIPhone appareil={a} />
          </div>
        )}
        {!iphone && (
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
        )}
        {!iphone && (
          <div className="carte p-4 text-sm leading-relaxed text-stone-700">
            <h2 className="font-bold">Vous avez un iPhone ?</h2>
            <p className="mt-2">Ouvrez <b>sikaklo.com</b> dans <b>Safari</b>, touchez <b>Partager</b>, puis <b>« Sur l’écran d’accueil »</b>.</p>
          </div>
        )}
        <p className="text-center text-xs text-stone-500">
          <Link href="/" className="underline">Ouvrir Sikaklo dans le navigateur</Link>
        </p>
      </div>
    </main>
  );
}
