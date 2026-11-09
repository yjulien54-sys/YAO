"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Megaphone } from "lucide-react";
import { supabase } from "@/lib/supabase";

type Annonce = { id: string; titre: string; texte?: string | null; lien?: string | null; bouton?: string | null; couleur: "vert" | "orange" | "bleu" | "sombre" };

// Annonces par défaut (si la table n'existe pas encore ou est vide)
const DEFAUT: Annonce[] = [
  { id: "d1", titre: "Bienvenue sur Cotiz", texte: "Tontines, associations et collectes : tout le monde voit qui a payé.", couleur: "vert" },
  { id: "d2", titre: "Cotiz sur ton téléphone", texte: "Installe l’application Android en quelques secondes.", lien: "/telecharger", bouton: "Télécharger", couleur: "sombre" },
];

const FOND = {
  vert: "degrade-vert text-white",
  orange: "degrade-or text-white",
  bleu: "bg-gradient-to-br from-sky-500 to-blue-700 text-white",
  sombre: "bg-gradient-to-br from-stone-800 to-stone-950 text-white",
};

/** Bandeau d'annonces qui défile (publicités, nouveautés, mises à jour) */
export function Annonces() {
  const [liste, setListe] = useState<Annonce[]>(DEFAUT);
  const [i, setI] = useState(0);

  useEffect(() => {
    try {
      const c = sessionStorage.getItem("cotiz:annonces");
      if (c) setListe(JSON.parse(c));
    } catch {}
    supabase
      .from("annonces")
      .select("id, titre, texte, lien, bouton, couleur")
      .order("ordre")
      .limit(8)
      .then(({ data, error }) => {
        if (!error && data && data.length) {
          setListe(data as Annonce[]);
          try {
            sessionStorage.setItem("cotiz:annonces", JSON.stringify(data));
          } catch {}
        }
      });
  }, []);

  useEffect(() => {
    if (liste.length < 2) return;
    const t = setInterval(() => setI((x) => (x + 1) % liste.length), 5000);
    return () => clearInterval(t);
  }, [liste.length]);

  if (!liste.length) return null;
  const a = liste[i % liste.length];
  const externe = a.lien?.startsWith("http");
  const contenu = (
    <div className={`relative overflow-hidden rounded-3xl p-4 shadow-md ${FOND[a.couleur] ?? FOND.vert}`}>
      <div className="motif pointer-events-none absolute inset-0 opacity-40" />
      <div className="relative flex items-center gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-white/15 ring-1 ring-white/25">
          <Megaphone size={19} strokeWidth={1.9} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-extrabold">{a.titre}</p>
          {a.texte && <p className="line-clamp-2 text-xs text-white/85">{a.texte}</p>}
        </div>
        {a.lien && a.bouton && <span className="shrink-0 rounded-full bg-white px-3 py-1.5 text-xs font-bold text-stone-900">{a.bouton}</span>}
      </div>
      {liste.length > 1 && (
        <div className="relative mt-3 flex justify-center gap-1.5">
          {liste.map((x, j) => (
            <button
              key={x.id}
              aria-label={`Annonce ${j + 1}`}
              onClick={(e) => {
                e.preventDefault();
                setI(j);
              }}
              className={`h-1.5 rounded-full transition-all ${j === i % liste.length ? "w-5 bg-white" : "w-1.5 bg-white/45"}`}
            />
          ))}
        </div>
      )}
    </div>
  );
  if (!a.lien) return contenu;
  return externe ? (
    <a href={a.lien} target="_blank" rel="noreferrer">{contenu}</a>
  ) : (
    <Link href={a.lien}>{contenu}</Link>
  );
}
