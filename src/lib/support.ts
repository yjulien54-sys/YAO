/** Service client Cotiz (modifiable via la variable NEXT_PUBLIC_SUPPORT_PHONE dans Vercel) */
export const SUPPORT_PHONE = (process.env.NEXT_PUBLIC_SUPPORT_PHONE ?? "0748565869").replace(/\D/g, "");
export const SUPPORT_AFFICHE = SUPPORT_PHONE.replace(/(\d{2})(?=\d)/g, "$1 ");
