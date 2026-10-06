import { createContext } from 'preact';
import { useContext } from 'preact/hooks';
import { crearAlmacen, type Almacen } from '../../core/almacen/almacen';
import { claveDelKeystore } from '../../core/almacen/boveda';
import {
  borrarClaveV1,
  CABECERA,
  CABECERA_V2,
  cifrarPendientes,
  claveDelDispositivo,
  claveV1SiExiste,
  discoCifrado,
  quedanConCabecera,
} from '../../core/almacen/cifrado';
import { discoCapacitor } from '../../core/almacen/disco-capacitor';
import { RepositorioNotas } from '../../core/notas/repositorio';
import { enTelefono, envoltorioKeystore } from '../seguridad/nativo';

const Contexto = createContext<RepositorioNotas | null>(null);

/** Las pruebas pasan aquí un repositorio en memoria. */
export const ProveedorNotas = Contexto.Provider;

let predeterminado: RepositorioNotas | undefined;

/**
 * Almacén de la app: archivos de la carpeta privada en el APK (IndexedDB en el navegador),
 * cifrados con la clave del dispositivo (ADR-008). Antes de la primera operación cifra las
 * notas que aún estén en claro, para que nada se lea ni se escriba a medio migrar.
 */
function almacenDeLaApp(): Almacen {
  const { almacen, listo } = enTelefono() ? almacenConKeystore() : almacenWeb();
  return {
    leer: async (ruta) => (await listo, almacen.leer(ruta)),
    escribir: async (ruta, contenido) => (await listo, almacen.escribir(ruta, contenido)),
    borrar: async (ruta) => (await listo, almacen.borrar(ruta)),
    listar: async (carpeta) => (await listo, almacen.listar(carpeta)),
  };
}

function almacenWeb() {
  const almacen = crearAlmacen(discoCifrado(discoCapacitor, claveDelDispositivo));
  const listo = cifrarPendientes(discoCapacitor, (r, t) => almacen.escribir(r, t), 'notas').catch(() => 0);
  return { almacen, listo };
}

/**
 * En el teléfono (ADR-014): lo nuevo se cifra con la clave envuelta por Android Keystore (v2).
 * Las notas v1 se vuelven a cifrar una a una con v2 (cada escritura es atómica: un corte deja
 * cada archivo en v1 o en v2, y ambas se leen). Solo cuando no queda ninguna v1 se borra la
 * clave vieja de IndexedDB. Si el Keystore falla, se sigue con v1 como hasta ahora.
 */
function almacenConKeystore() {
  const plano = crearAlmacen(discoCapacitor);
  let prometida: Promise<CryptoKey> | undefined;
  const v2 = () =>
    (prometida ??= claveDelKeystore(plano, discoCapacitor, envoltorioKeystore).catch((e: unknown) => {
      prometida = undefined;
      throw e;
    }));
  const version = v2().then(
    () => 'v2' as const,
    () => 'v1' as const,
  );
  const almacen = crearAlmacen(
    discoCifrado(discoCapacitor, {
      escribir: () => version,
      v1: async () => (await version) === 'v1' ? claveDelDispositivo() : claveV1SiExiste(),
      v2,
    }),
  );
  const listo = (async () => {
    if ((await version) === 'v1') {
      await cifrarPendientes(discoCapacitor, (r, t) => almacen.escribir(r, t), 'notas');
      return;
    }
    await cifrarPendientes(discoCapacitor, (r, t) => almacen.escribir(r, t), 'notas', {
      destino: CABECERA_V2,
      leerClaro: (r) => almacen.leer(r),
    });
    if (!(await quedanConCabecera(discoCapacitor, 'notas', CABECERA))) await borrarClaveV1();
  })().catch(() => undefined);
  return { almacen, listo };
}

/** Repositorio de la app. El mismo código en el teléfono y en el navegador. */
export function useRepositorio(): RepositorioNotas {
  return useContext(Contexto) ?? (predeterminado ??= new RepositorioNotas(almacenDeLaApp()));
}
