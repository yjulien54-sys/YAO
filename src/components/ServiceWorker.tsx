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
  }, []);
  return null;
}
