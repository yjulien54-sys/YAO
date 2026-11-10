"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { initiales } from "@/lib/format";
import { useStore } from "@/lib/store";
import { SideNav } from "./SideNav";
import type { MemberStatus } from "@/lib/types";

export function Logo({ className = "" }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2 font-extrabold tracking-tight ${className}`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/icons/logo.svg" alt="" width={32} height={32} className="h-8 w-8 rounded-[10px] shadow-sm" />
      Cotiz
    </span>
  );
}

export function Header({ title, back, right }: { title?: string; back?: string; right?: React.ReactNode }) {
  return (
    <header className="sticky top-0 z-10 flex items-center gap-3 border-b border-stone-200/60 bg-[#f7f5f0]/85 px-4 py-3 backdrop-blur-md lg:px-0 lg:py-5">
      {back ? (
        <Link href={back} aria-label="Retour" className="-ml-1 rounded-full p-1.5 text-stone-600 hover:bg-stone-100">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </Link>
      ) : (
        <Logo className="text-lg text-stone-900" />
      )}
      {title && <h1 className="flex-1 truncate text-base font-bold text-stone-900">{title}</h1>}
      {!title && <div className="flex-1" />}
      {right}
    </header>
  );
}

export function Page({ children, large }: { children: React.ReactNode; large?: boolean }) {
  const [entree, setEntree] = useState("");
  useEffect(() => {
    try {
      const sens = sessionStorage.getItem("cotiz:glisse");
      if (!sens) return;
      setEntree(sens === "gauche" ? "entre-droite" : "entre-gauche");
      const t = setTimeout(() => sessionStorage.removeItem("cotiz:glisse"), 500);
      return () => clearTimeout(t);
    } catch {}
  }, []);
  return (
    <div className="mx-auto min-h-dvh max-w-md overflow-x-hidden bg-[#f7f5f0] pb-24 shadow-xl shadow-stone-900/5 lg:max-w-none lg:pb-10 lg:pl-64 lg:shadow-none">
      <SideNav />
      <div className={`lg:mx-auto ${large ? "lg:max-w-5xl" : "lg:max-w-3xl"} lg:px-6 ${entree}`}>{children}</div>
    </div>
  );
}

export function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`carte p-4 ${className}`}>{children}</div>;
}

export function Progress({ value, className = "" }: { value: number; className?: string }) {
  return (
    <div className={`h-2 w-full overflow-hidden rounded-full bg-stone-100 ${className}`}>
      <div
        className="h-full rounded-full bg-orange-500 transition-all duration-700"
        style={{ width: `${Math.round(value * 100)}%` }}
      />
    </div>
  );
}

const STATUS: Record<MemberStatus, { label: string; cls: string }> = {
  paye: { label: "Payé", cls: "bg-emerald-50 text-emerald-700 ring-emerald-200" },
  a_confirmer: { label: "À confirmer", cls: "bg-sky-50 text-sky-700 ring-sky-200" },
  attente: { label: "En attente", cls: "bg-amber-50 text-amber-700 ring-amber-200" },
  retard: { label: "En retard", cls: "bg-red-50 text-red-700 ring-red-200" },
};

export function StatusBadge({ status }: { status: MemberStatus }) {
  const s = STATUS[status];
  return <span className={`rounded-md px-2 py-0.5 text-xs font-semibold ring-1 ring-inset ${s.cls}`}>{s.label}</span>;
}

const AVATAR_COLORS = ["bg-orange-100 text-orange-700", "bg-emerald-100 text-emerald-700", "bg-sky-100 text-sky-700", "bg-violet-100 text-violet-700", "bg-rose-100 text-rose-700", "bg-amber-100 text-amber-800"];

export function Avatar({ name, size = 40 }: { name: string; size?: number }) {
  const c = AVATAR_COLORS[[...name].reduce((s, ch) => s + ch.charCodeAt(0), 0) % AVATAR_COLORS.length];
  return (
    <span className={`grid shrink-0 place-items-center rounded-full font-bold ${c}`} style={{ width: size, height: size, fontSize: size * 0.36 }}>
      {initiales(name)}
    </span>
  );
}

type BtnProps = React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "secondary" | "ghost" | "whatsapp" };

const VARIANTS = {
  primary: "bg-emerald-700 text-white shadow-sm hover:bg-emerald-800 disabled:bg-stone-300 disabled:shadow-none",
  secondary: "bg-white text-stone-800 ring-1 ring-stone-300/80 hover:bg-stone-50",
  ghost: "text-stone-600 hover:bg-stone-100",
  whatsapp: "bg-[#1fa855] text-white shadow-sm hover:bg-[#178f47]",
};

export const btnClass = (variant: keyof typeof VARIANTS = "primary", extra = "") =>
  `inline-flex items-center justify-center gap-2 rounded-[14px] px-4 py-3.5 text-[0.9rem] font-bold transition active:scale-[0.98] disabled:cursor-not-allowed ${VARIANTS[variant]} ${extra}`;

export function Button({ variant = "primary", className = "", ...props }: BtnProps) {
  return <button className={btnClass(variant, className)} {...props} />;
}

export function WhatsAppIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M17.5 14.4c-.3-.1-1.7-.8-2-.9-.3-.1-.5-.1-.7.1-.2.3-.8.9-.9 1.1-.2.2-.3.2-.6.1-.3-.1-1.2-.5-2.3-1.4-.9-.8-1.4-1.7-1.6-2-.2-.3 0-.5.1-.6l.4-.5c.1-.2.2-.3.3-.5.1-.2 0-.4 0-.5l-.9-2.2c-.2-.6-.5-.5-.7-.5h-.6c-.2 0-.5.1-.8.4-.3.3-1 1-1 2.4s1 2.8 1.2 3c.1.2 2 3.1 4.9 4.3.7.3 1.2.5 1.7.6.7.2 1.3.2 1.8.1.6-.1 1.7-.7 1.9-1.4.2-.7.2-1.2.2-1.4-.1-.1-.3-.2-.5-.3zM12 2a10 10 0 00-8.6 15.1L2 22l5-1.3A10 10 0 1012 2zm0 18.2c-1.5 0-3-.4-4.3-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1112 20.2z" />
    </svg>
  );
}

export const inputClass =
  "w-full rounded-[14px] border border-stone-300/80 bg-white px-4 py-3 text-base text-stone-900 outline-none transition placeholder:text-stone-400 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100";

export function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-semibold text-stone-700">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-stone-500">{hint}</span>}
    </label>
  );
}

/** Redirige vers l'accueil si personne n'est connecté. */
export function useRequireUser() {
  const { ready, user } = useStore();
  const router = useRouter();
  const pathname = usePathname();
  useEffect(() => {
    if (ready && !user) router.replace(`/?suite=${encodeURIComponent(pathname + window.location.search)}`);
  }, [ready, user, router, pathname]);
  return ready && !!user;
}

export function Loading() {
  return (
    <Page>
      <div className="grid min-h-dvh place-items-center">
        <div className="flex flex-col items-center gap-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/icons/logo.svg" alt="" width={72} height={72} className="h-[72px] w-[72px] animate-pulse rounded-[20px] shadow-lg" />
          <p className="text-sm font-semibold text-stone-500">Cotiz</p>
        </div>
      </div>
    </Page>
  );
}
