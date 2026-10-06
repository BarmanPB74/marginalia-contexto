package io.github.barmanpb74.appnoti;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.spotify.android.appremote.api.ConnectionParams;
import com.spotify.android.appremote.api.Connector;
import com.spotify.android.appremote.api.SpotifyAppRemote;
import com.spotify.android.appremote.api.error.CouldNotFindSpotifyApp;
import com.spotify.android.appremote.api.error.NotLoggedInException;
import com.spotify.android.appremote.api.error.UserNotAuthorizedException;
import com.spotify.protocol.client.Subscription;
import com.spotify.protocol.types.PlayerState;
import java.util.regex.Pattern;

/**
 * Spotify en segundo plano (ADR-013). No reproduce nada aquí: controla la app oficial de Spotify
 * del teléfono con su SDK App Remote. Spotify suena en su app (también con la pantalla apagada) y
 * esta parte solo envía órdenes y avisa de qué suena y en qué segundo.
 * - Sin contraseñas: la autorización la pide la propia app de Spotify.
 * - El "Client ID" es público (no es un secreto); lo escribe la persona en Ajustes.
 * - Solo se aceptan URIs de Spotify válidas; lo demás se rechaza.
 */
@CapacitorPlugin(name = "Spotify")
public class SpotifyPlugin extends Plugin {

    private static final String REDIRECCION = "marginalia://spotify";
    private static final Pattern CLIENT_ID = Pattern.compile("^[0-9a-f]{32}$");
    private static final Pattern URI = Pattern.compile("^spotify:(track|episode|album|playlist):[A-Za-z0-9]{22}$");

    private SpotifyAppRemote remoto;
    private Subscription<PlayerState> suscripcion;

    @PluginMethod
    public void instalado(PluginCall call) {
        JSObject r = new JSObject();
        r.put("instalado", SpotifyAppRemote.isSpotifyInstalled(getContext()));
        call.resolve(r);
    }

    @PluginMethod
    public void conectar(PluginCall call) {
        String clientId = call.getString("clientId", "");
        if (clientId == null || !CLIENT_ID.matcher(clientId).matches()) {
            call.reject("El Client ID de Spotify no es válido", "CLIENT_ID");
            return;
        }
        if (remoto != null && remoto.isConnected()) {
            call.resolve();
            return;
        }
        ConnectionParams parametros = new ConnectionParams.Builder(clientId)
            .setRedirectUri(REDIRECCION)
            .showAuthView(true)
            .build();
        getBridge().executeOnMainThread(() ->
            SpotifyAppRemote.connect(getContext(), parametros, new Connector.ConnectionListener() {
                @Override
                public void onConnected(SpotifyAppRemote conectado) {
                    remoto = conectado;
                    escucharEstado();
                    call.resolve();
                }

                @Override
                public void onFailure(Throwable error) {
                    call.reject(mensaje(error), codigo(error));
                }
            })
        );
    }

    @PluginMethod
    public void desconectar(PluginCall call) {
        soltar();
        call.resolve();
    }

    @PluginMethod
    public void reproducir(PluginCall call) {
        String uri = call.getString("uri", "");
        if (uri == null || !URI.matcher(uri).matches()) {
            call.reject("URI de Spotify no válida", "URI");
            return;
        }
        if (!conectado(call)) return;
        Long desde = call.getLong("posicionMs", 0L);
        SpotifyAppRemote r = remoto;
        r.getPlayerApi().play(uri).setResultCallback(vacio -> {
            if (desde != null && desde > 0 && r.isConnected()) r.getPlayerApi().seekTo(desde);
            call.resolve();
        }).setErrorCallback(error -> call.reject(mensaje(error), codigo(error)));
    }

    @PluginMethod
    public void pausar(PluginCall call) {
        if (!conectado(call)) return;
        remoto.getPlayerApi().pause();
        call.resolve();
    }

    @PluginMethod
    public void reanudar(PluginCall call) {
        if (!conectado(call)) return;
        remoto.getPlayerApi().resume();
        call.resolve();
    }

    @PluginMethod
    public void siguiente(PluginCall call) {
        if (!conectado(call)) return;
        remoto.getPlayerApi().skipNext();
        call.resolve();
    }

    @PluginMethod
    public void anterior(PluginCall call) {
        if (!conectado(call)) return;
        remoto.getPlayerApi().skipPrevious();
        call.resolve();
    }

    @PluginMethod
    public void saltar(PluginCall call) {
        if (!conectado(call)) return;
        Long posicion = call.getLong("posicionMs", 0L);
        remoto.getPlayerApi().seekTo(posicion == null ? 0L : Math.max(0L, posicion));
        call.resolve();
    }

    @PluginMethod
    public void estado(PluginCall call) {
        if (!conectado(call)) return;
        remoto.getPlayerApi().getPlayerState()
            .setResultCallback(estado -> call.resolve(aJs(estado)))
            .setErrorCallback(error -> call.reject(mensaje(error), codigo(error)));
    }

    private boolean conectado(PluginCall call) {
        if (remoto == null || !remoto.isConnected()) {
            call.reject("Spotify no está conectado", "DESCONECTADO");
            return false;
        }
        return true;
    }

    private void escucharEstado() {
        if (suscripcion != null) suscripcion.cancel();
        suscripcion = remoto.getPlayerApi().subscribeToPlayerState();
        suscripcion.setEventCallback(estado -> notifyListeners("estado", aJs(estado)));
    }

    private void soltar() {
        if (suscripcion != null) suscripcion.cancel();
        suscripcion = null;
        if (remoto != null) SpotifyAppRemote.disconnect(remoto);
        remoto = null;
    }

    private static JSObject aJs(PlayerState estado) {
        JSObject r = new JSObject();
        r.put("pausado", estado.isPaused);
        r.put("posicionMs", estado.playbackPosition);
        if (estado.track != null) {
            r.put("uri", estado.track.uri);
            r.put("titulo", estado.track.name);
            r.put("artista", estado.track.artist != null ? estado.track.artist.name : "");
            r.put("duracionMs", estado.track.duration);
        }
        return r;
    }

    private static String codigo(Throwable error) {
        if (error instanceof CouldNotFindSpotifyApp) return "SIN_APP";
        if (error instanceof NotLoggedInException) return "SIN_SESION";
        if (error instanceof UserNotAuthorizedException) return "NO_AUTORIZADO";
        return "ERROR";
    }

    private static String mensaje(Throwable error) {
        String m = error.getMessage();
        return m == null || m.isEmpty() ? error.getClass().getSimpleName() : m;
    }

    @Override
    protected void handleOnDestroy() {
        soltar();
        super.handleOnDestroy();
    }
}
