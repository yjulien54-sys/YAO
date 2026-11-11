"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bell } from "lucide-react";
import { useNotifications } from "@/lib/notifications";
import { useStore } from "@/lib/store";

/** Cloche des notifications : un point orange s'affiche quand il y a du nouveau */
export function Cloche() {
  const { nonLues } = useNotifications();
  const { userId } = useStore();
  const chemin = usePathname();
  if (!userId || chemin === "/notifications") return null;
  return (
    <Link href="/notifications" aria-label={`Notifications${nonLues ? ` (${nonLues} non lues)` : ""}`} className="relative shrink-0 rounded-full p-2 text-emerald-700 hover:bg-emerald-50">
      <Bell size={22} strokeWidth={1.9} />
      {nonLues > 0 && <span aria-hidden className="point-notif absolute right-[7px] top-[7px] h-[10px] w-[10px] rounded-full bg-orange-500 ring-2 ring-[#f7f5f0]" />}
    </Link>
  );
}
