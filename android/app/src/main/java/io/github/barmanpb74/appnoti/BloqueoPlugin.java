package io.github.barmanpb74.appnoti;

import static androidx.biometric.BiometricManager.Authenticators.BIOMETRIC_WEAK;
import static androidx.biometric.BiometricManager.Authenticators.DEVICE_CREDENTIAL;

import android.os.Build;
import androidx.biometric.BiometricManager;
import androidx.biometric.BiometricPrompt;
import androidx.core.content.ContextCompat;
import androidx.fragment.app.FragmentActivity;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * Bloqueo opcional de la app (ADR-014, auditoría F5 · H7): huella, rostro o el PIN/patrón del
 * propio teléfono, con el diálogo oficial de Android (BiometricPrompt). La app no ve ni guarda
 * nada biométrico: Android solo responde «sí» o «no».
 */
@CapacitorPlugin(name = "Bloqueo")
public class BloqueoPlugin extends Plugin {

    // Débil + credencial del teléfono: la única combinación que funciona en todas las versiones
    private static final int AUTENTICADORES = BIOMETRIC_WEAK | DEVICE_CREDENTIAL;

    @PluginMethod
    public void disponible(PluginCall call) {
        int estado = BiometricManager.from(getContext()).canAuthenticate(AUTENTICADORES);
        JSObject r = new JSObject();
        r.put("disponible", estado == BiometricManager.BIOMETRIC_SUCCESS);
        call.resolve(r);
    }

    @PluginMethod
    public void autenticar(PluginCall call) {
        String titulo = limitar(call.getString("titulo", "Marginalia"));
        String subtitulo = limitar(call.getString("subtitulo", ""));
        getBridge().executeOnMainThread(() -> {
            BiometricPrompt.PromptInfo info = new BiometricPrompt.PromptInfo.Builder()
                .setTitle(titulo)
                .setSubtitle(subtitulo)
                .setAllowedAuthenticators(AUTENTICADORES)
                .build();
            BiometricPrompt dialogo = new BiometricPrompt(
                (FragmentActivity) getActivity(),
                ContextCompat.getMainExecutor(getContext()),
                new BiometricPrompt.AuthenticationCallback() {
                    @Override
                    public void onAuthenticationSucceeded(BiometricPrompt.AuthenticationResult resultado) {
                        call.resolve();
                    }

                    @Override
                    public void onAuthenticationError(int codigo, CharSequence mensaje) {
                        boolean cancelado = codigo == BiometricPrompt.ERROR_USER_CANCELED
                            || codigo == BiometricPrompt.ERROR_NEGATIVE_BUTTON
                            || codigo == BiometricPrompt.ERROR_CANCELED;
                        call.reject(String.valueOf(mensaje), cancelado ? "CANCELADO" : "ERROR");
                    }
                    // onAuthenticationFailed: un intento fallido; el diálogo sigue abierto
                }
            );
            dialogo.authenticate(info);
        });
    }

    /** Con el bloqueo activo, la vista de «recientes» no muestra el contenido (Android 13+). */
    @PluginMethod
    public void ocultarEnRecientes(PluginCall call) {
        boolean ocultar = Boolean.TRUE.equals(call.getBoolean("ocultar", false));
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            getBridge().executeOnMainThread(() -> getActivity().setRecentsScreenshotEnabled(!ocultar));
        }
        call.resolve();
    }

    private static String limitar(String texto) {
        if (texto == null) return "";
        return texto.length() > 80 ? texto.substring(0, 80) : texto;
    }
}
