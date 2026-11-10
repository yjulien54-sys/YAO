"use client";

import Link from "next/link";
import { Bell } from "lucide-react";
import { useNotifications } from "@/lib/notifications";

/** Cloche des notifications, avec le nombre de notifications non lues */
export function Cloche() {
  const { nonLues, dispo } = useNotifications();
  if (!dispo) return null;
  return (
    <Link href="/notifications" aria-label={`Notifications${nonLues ? ` (${nonLues} non lues)` : ""}`} className="relative rounded-full p-2 text-emerald-700 hover:bg-emerald-50">
      <Bell size={22} strokeWidth={1.9} />
      {nonLues > 0 && (
        <span className="absolute right-0.5 top-0.5 grid h-[18px] min-w-[18px] place-items-center rounded-full bg-orange-500 px-1 text-[0.65rem] font-bold text-white ring-2 ring-[#f7f5f0]">
          {nonLues > 9 ? "9+" : nonLues}
        </span>
      )}
    </Link>
  );
}
