package io.github.barmanpb74.appnoti;

import android.content.Intent;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * «Compartir → Marginalia» desde YouTube Music (F4, Share Intent).
 * Solo entra texto plano (ACTION_SEND text/plain, declarado en el manifiesto). El texto es de otra
 * app: aquí solo se recorta y se pasa tal cual; la app web lo valida (solo acepta IDs de YouTube
 * válidos, src/core/musica/enlaces.ts). No pide permisos.
 */
@CapacitorPlugin(name = "Compartido")
public class CompartidoPlugin extends Plugin {

    /** Más que suficiente para "texto + enlace" de Compartir; lo demás se corta. */
    private static final int MAXIMO = 2000;

    @Override
    protected void handleOnNewIntent(Intent intent) {
        super.handleOnNewIntent(intent);
        if (intent == null || !Intent.ACTION_SEND.equals(intent.getAction())) return;
        if (!"text/plain".equals(intent.getType())) return;
        CharSequence recibido = intent.getCharSequenceExtra(Intent.EXTRA_TEXT);
        if (recibido == null) return;
        String texto = recibido.toString();
        if (texto.length() > MAXIMO) texto = texto.substring(0, MAXIMO);
        JSObject datos = new JSObject();
        datos.put("texto", texto);
        // Si la app aún está arrancando, el aviso espera a que la parte web escuche.
        notifyListeners("compartido", datos, true);
        // Que una recreación de la actividad no lo vuelva a entregar.
        intent.setAction(Intent.ACTION_MAIN);
    }
}
