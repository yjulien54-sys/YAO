package ci.cotiz.app;

import android.app.Activity;
import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;

/**
 * Ouvre une application de paiement (Wave…) installée sur le téléphone.
 * Appelée depuis Cotiz par un lien  cotiz://ouvrir?app=wave
 * Si l'application n'est pas installée, ouvre sa page sur le Play Store.
 */
public class OuvrirAppActivity extends Activity {

    private static String paquet(String app) {
        if ("wave".equals(app)) return "com.wave.personal";
        return null;
    }

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        Uri data = getIntent() != null ? getIntent().getData() : null;
        String pkg = paquet(data != null ? data.getQueryParameter("app") : null);
        if (pkg != null) {
            Intent lancer = getPackageManager().getLaunchIntentForPackage(pkg);
            try {
                if (lancer != null) {
                    lancer.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                    startActivity(lancer);
                } else {
                    Intent store = new Intent(Intent.ACTION_VIEW, Uri.parse("market://details?id=" + pkg));
                    store.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                    startActivity(store);
                }
            } catch (Exception e) {
                Intent web = new Intent(Intent.ACTION_VIEW, Uri.parse("https://play.google.com/store/apps/details?id=" + pkg));
                web.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                try { startActivity(web); } catch (Exception ignored) { }
            }
        }
        finish();
    }
}
