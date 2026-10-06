package io.github.barmanpb74.appnoti;

import android.os.Build;
import android.security.keystore.KeyGenParameterSpec;
import android.security.keystore.KeyProperties;
import android.security.keystore.StrongBoxUnavailableException;
import android.util.Base64;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.nio.ByteBuffer;
import java.security.KeyStore;
import java.util.Arrays;
import javax.crypto.Cipher;
import javax.crypto.KeyGenerator;
import javax.crypto.SecretKey;
import javax.crypto.spec.GCMParameterSpec;

/**
 * Envuelve la clave de las notas con Android Keystore (ADR-014, auditoría F5 · H6).
 * La clave de envoltorio (AES-256-GCM) se crea dentro del Keystore (StrongBox si el teléfono lo
 * tiene) y nunca sale de él: aquí solo se cifran o descifran los 32 bytes de la clave de datos.
 * Sin permisos. Nada se registra en logcat.
 */
@CapacitorPlugin(name = "Boveda")
public class BovedaPlugin extends Plugin {

    private static final String KEYSTORE = "AndroidKeyStore";
    private static final String ALIAS = "marginalia-envoltorio-v1";
    private static final String TRANSFORMACION = "AES/GCM/NoPadding";
    private static final int IV = 12;
    private static final int ETIQUETA_BITS = 128;
    private static final int BYTES_CLAVE = 32;

    @PluginMethod
    public void envolver(PluginCall call) {
        byte[] clara = null;
        try {
            clara = leerBase64(call.getString("clave", ""));
            if (clara.length != BYTES_CLAVE) {
                call.reject("La clave debe medir 32 bytes", "CLAVE");
                return;
            }
            Cipher cifrador = Cipher.getInstance(TRANSFORMACION);
            cifrador.init(Cipher.ENCRYPT_MODE, claveDeEnvoltorio());
            byte[] iv = cifrador.getIV();
            byte[] cifrada = cifrador.doFinal(clara);
            byte[] todo = ByteBuffer.allocate(iv.length + cifrada.length).put(iv).put(cifrada).array();
            JSObject r = new JSObject();
            r.put("envuelta", Base64.encodeToString(todo, Base64.NO_WRAP));
            call.resolve(r);
        } catch (Exception e) {
            call.reject("No se pudo envolver la clave", "KEYSTORE");
        } finally {
            if (clara != null) Arrays.fill(clara, (byte) 0);
        }
    }

    @PluginMethod
    public void desenvolver(PluginCall call) {
        byte[] clara = null;
        try {
            byte[] todo = leerBase64(call.getString("envuelta", ""));
            if (todo.length != IV + BYTES_CLAVE + ETIQUETA_BITS / 8) {
                call.reject("Clave envuelta con tamaño inesperado", "CLAVE");
                return;
            }
            KeyStore ks = KeyStore.getInstance(KEYSTORE);
            ks.load(null);
            if (!ks.containsAlias(ALIAS)) {
                // Nunca se crea aquí: una clave nueva no abriría lo envuelto con la anterior
                call.reject("Falta la clave del Keystore", "SIN_CLAVE");
                return;
            }
            Cipher cifrador = Cipher.getInstance(TRANSFORMACION);
            cifrador.init(Cipher.DECRYPT_MODE, (SecretKey) ks.getKey(ALIAS, null), new GCMParameterSpec(ETIQUETA_BITS, todo, 0, IV));
            clara = cifrador.doFinal(todo, IV, todo.length - IV);
            JSObject r = new JSObject();
            r.put("clave", Base64.encodeToString(clara, Base64.NO_WRAP));
            call.resolve(r);
        } catch (Exception e) {
            call.reject("No se pudo desenvolver la clave", "KEYSTORE");
        } finally {
            if (clara != null) Arrays.fill(clara, (byte) 0);
        }
    }

    private static byte[] leerBase64(String texto) {
        if (texto == null || texto.length() > 1024) throw new IllegalArgumentException("Base64");
        return Base64.decode(texto, Base64.NO_WRAP);
    }

    /** La clave de envoltorio; la crea la primera vez (StrongBox si existe, si no TEE). */
    private static SecretKey claveDeEnvoltorio() throws Exception {
        KeyStore ks = KeyStore.getInstance(KEYSTORE);
        ks.load(null);
        if (ks.containsAlias(ALIAS)) return (SecretKey) ks.getKey(ALIAS, null);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
            try {
                return generar(true);
            } catch (StrongBoxUnavailableException sinStrongBox) {
                // Muchos teléfonos no tienen StrongBox: el TEE también es hardware aislado
            }
        }
        return generar(false);
    }

    private static SecretKey generar(boolean strongBox) throws Exception {
        KeyGenParameterSpec.Builder spec = new KeyGenParameterSpec.Builder(
            ALIAS,
            KeyProperties.PURPOSE_ENCRYPT | KeyProperties.PURPOSE_DECRYPT
        )
            .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
            .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
            .setKeySize(256)
            .setRandomizedEncryptionRequired(true);
        if (strongBox && Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) spec.setIsStrongBoxBacked(true);
        KeyGenerator generador = KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, KEYSTORE);
        generador.init(spec.build());
        return generador.generateKey();
    }
}
