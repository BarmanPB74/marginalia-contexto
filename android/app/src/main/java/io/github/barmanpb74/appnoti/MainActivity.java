package io.github.barmanpb74.appnoti;

import android.os.Bundle;
import android.webkit.WebSettings;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    @Override
    public void onCreate(Bundle savedInstanceState) {
        // Plugins propios de seguridad (ADR-014): clave en Android Keystore y bloqueo con huella/PIN.
        registerPlugin(BovedaPlugin.class);
        registerPlugin(BloqueoPlugin.class);
        super.onCreate(savedInstanceState);
        // Endurecimiento de la WebView (docs/SEGURIDAD.md §3).
        // La app se sirve desde https://localhost, no desde file://, así que no necesita estos accesos.
        WebSettings ajustes = getBridge().getWebView().getSettings();
        ajustes.setAllowFileAccess(false);
        ajustes.setAllowContentAccess(false);
        // Legibilidad (ADR-016): la WebView ignora por defecto el tamaño de letra del teléfono.
        // Se aplica la escala que eligió la persona en Ajustes de Android (de 85 % a 200 %).
        float escala = getResources().getConfiguration().fontScale;
        ajustes.setTextZoom(Math.round(Math.max(0.85f, Math.min(2.0f, escala)) * 100));
    }
}
