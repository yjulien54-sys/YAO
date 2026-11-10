/**
 * Vibration des touches, sur tous les téléphones.
 * - Android : API de vibration.
 * - iPhone (iOS 18 et plus) : l'iPhone n'autorise pas la vibration aux sites web, mais il vibre
 *   quand on bascule un interrupteur « switch » : on en bascule un, invisible, à chaque touche.
 */
type Type = "touche" | "ok" | "erreur";
const MOTIFS: Record<Type, number | number[]> = { touche: 25, ok: [20, 40, 30], erreur: [60, 50, 60, 50, 60] };

let label: HTMLLabelElement | null = null;
function interrupteurIOS() {
  if (label || typeof document === "undefined") return label;
  const input = document.createElement("input");
  input.type = "checkbox";
  input.setAttribute("switch", "");
  input.id = "cotiz-haptique";
  input.style.cssText = "position:fixed;opacity:0;pointer-events:none;width:1px;height:1px;left:-10px;top:-10px";
  label = document.createElement("label");
  label.htmlFor = input.id;
  label.style.cssText = "position:fixed;opacity:0;pointer-events:none;width:1px;height:1px;left:-10px;top:-10px";
  document.body.append(input, label);
  return label;
}

export function vibrer(type: Type = "touche") {
  try {
    if (typeof navigator !== "undefined" && "vibrate" in navigator && navigator.vibrate(MOTIFS[type])) return;
  } catch {}
  // iPhone : une petite vibration par bascule (deux pour une erreur)
  try {
    const l = interrupteurIOS();
    if (!l) return;
    l.click();
    if (type !== "touche") setTimeout(() => l.click(), 120);
    if (type === "erreur") setTimeout(() => l.click(), 240);
  } catch {}
}
