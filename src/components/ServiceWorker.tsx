"use client";

import { useEffect } from "react";

export function ServiceWorker() {
  useEffect(() => {
    if ("serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js").catch(() => {});
    // Mémorise si Cotiz est ouvert depuis l'application Android (Play Store)
    try {
      const depuisApp =
        new URLSearchParams(window.location.search).get("source") === "app" || document.referrer.startsWith("android-app://ci.cotiz.app");
      if (depuisApp) sessionStorage.setItem("cotiz-app", "1");
    } catch {}

    // Mise à jour automatique : si une nouvelle version est en ligne, on recharge
    // (au retour sur l'application, ou toutes les 5 minutes, jamais pendant une saisie)
    const ici = process.env.NEXT_PUBLIC_VERSION;
    if (!ici || ici === "local") return;
    let dernier = 0;
    const verifier = async () => {
      if (document.visibilityState !== "visible" || Date.now() - dernier < 60_000) return;
      dernier = Date.now();
      try {
        const r = await fetch("/api/version", { cache: "no-store" });
        const { v } = (await r.json()) as { v?: string };
        const saisie = document.activeElement && ["INPUT", "TEXTAREA", "SELECT"].includes(document.activeElement.tagName);
        const ouvert = document.querySelector("[role=dialog], .fixed.inset-0");
        if (v && v !== "local" && v !== ici && !saisie && !ouvert) window.location.reload();
      } catch {}
    };
    document.addEventListener("visibilitychange", verifier);
    const t = setInterval(verifier, 5 * 60_000);
    verifier();
    return () => { document.removeEventListener("visibilitychange", verifier); clearInterval(t); };
  }, []);
  return null;
}
