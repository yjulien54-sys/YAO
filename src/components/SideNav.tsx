"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Activity, Bell, CircleUser, Headset, House, Plus } from "lucide-react";
import { useNotifications } from "@/lib/notifications";
import { SUPPORT_AFFICHE } from "@/lib/support";

const ONGLETS = [
  { href: "/groupes", label: "Accueil", icon: House },
  { href: "/activite", label: "Activité", icon: Activity },
  { href: "/notifications", label: "Notifications", icon: Bell },
  { href: "/aide", label: "Aide et service client", icon: Headset },
  { href: "/profil", label: "Profil", icon: CircleUser },
];

/** Menu latéral, affiché uniquement sur ordinateur */
export function SideNav() {
  const path = usePathname();
  const { nonLues, dispo } = useNotifications();
  return (
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-stone-200 bg-white lg:flex">
      <div className="relative overflow-hidden px-5 pb-5 pt-6">
        <Link href="/groupes" className="inline-flex items-center gap-2.5 text-xl font-extrabold tracking-tight text-stone-900">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/icons/logo.svg" alt="" width={36} height={36} className="h-9 w-9 rounded-xl shadow-sm" />
          Cotiz
        </Link>
      </div>
      <div className="bande-kente mx-5 rounded-full" />
      <nav className="mt-5 flex-1 space-y-1 px-3">
        {ONGLETS.map(({ href, label, icon: Icon }) => {
          const actif = path === href || (href === "/groupes" && path.startsWith("/groupes/"));
          return (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-3 rounded-2xl px-3 py-2.5 text-[0.95rem] font-semibold transition ${actif ? "bg-emerald-50 text-emerald-800" : "text-stone-600 hover:bg-stone-50"}`}
            >
              <Icon size={20} strokeWidth={actif ? 2.1 : 1.75} />
              <span className="flex-1">{label}</span>
              {href === "/notifications" && dispo && nonLues > 0 && <span className="rounded-full bg-orange-500 px-1.5 text-xs font-bold text-white">{nonLues}</span>}
            </Link>
          );
        })}
        <Link
          href="/groupes/nouveau"
          className="mt-4 flex items-center justify-center gap-2 rounded-[14px] bg-emerald-700 px-3 py-3 text-sm font-bold text-white hover:bg-emerald-800"
        >
          <Plus size={18} strokeWidth={2} /> Créer un groupe
        </Link>
      </nav>
      <div className="border-t border-stone-100 p-4 text-xs text-stone-500">
        Service client : <b className="text-stone-700">{SUPPORT_AFFICHE}</b>
      </div>
    </aside>
  );
}
