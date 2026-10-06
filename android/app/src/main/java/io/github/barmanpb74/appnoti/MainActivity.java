package io.github.barmanpb74.appnoti;

import android.os.Bundle;
import android.webkit.WebSettings;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    @Override
    public void onCreate(Bundle savedInstanceState) {
        // Plugin propio: recibe lo que se comparte desde YouTube Music (antes de crear el puente).
        registerPlugin(CompartidoPlugin.class);
        super.onCreate(savedInstanceState);
        // Endurecimiento de la WebView (docs/SEGURIDAD.md §3).
        // La app se sirve desde https://localhost, no desde file://, así que no necesita estos accesos.
        WebSettings ajustes = getBridge().getWebView().getSettings();
        ajustes.setAllowFileAccess(false);
        ajustes.setAllowContentAccess(false);
    }
}
