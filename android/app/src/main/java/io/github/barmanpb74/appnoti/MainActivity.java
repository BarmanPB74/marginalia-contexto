package io.github.barmanpb74.appnoti;

import android.os.Bundle;
import android.webkit.WebSettings;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    @Override
    public void onCreate(Bundle savedInstanceState) {
        // Plugin propio: recibe lo que se comparte desde YouTube Music (antes de crear el puente).
        registerPlugin(CompartidoPlugin.class);
        // Plugin propio: controla la app de Spotify del teléfono (ADR-013).
        registerPlugin(SpotifyPlugin.class);
        // Plugins propios de seguridad (ADR-014): clave en Android Keystore y bloqueo con huella/PIN.
        registerPlugin(BovedaPlugin.class);
        registerPlugin(BloqueoPlugin.class);
        super.onCreate(savedInstanceState);
        // Endurecimiento de la WebView (docs/SEGURIDAD.md §3).
        // La app se sirve desde https://localhost, no desde file://, así que no necesita estos accesos.
        WebSettings ajustes = getBridge().getWebView().getSettings();
        ajustes.setAllowFileAccess(false);
        ajustes.setAllowContentAccess(false);
    }
}
