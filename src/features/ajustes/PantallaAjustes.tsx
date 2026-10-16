import { useState } from 'preact/hooks';
import { useEstado } from '../../app/estado';
import { ReglaRota } from '../../core/negocio';
import type { Tema, VistaNotas } from '../../app/ajustes';
import { Boton } from '../../ui/Boton';
import { Encabezado } from '../../ui/Encabezado';
import { Interruptor } from '../../ui/Interruptor';
import { Pagina } from '../../ui/Pagina';
import { Segmentado } from '../../ui/Segmentado';
import { exportarResumen, exportarVentas } from '../contabilidad/exportar';
import { periodoCompleto } from '../contabilidad/periodo';
import { VerificarRegistro } from '../contabilidad/VerificarRegistro';
import { useNegocioOpcional } from '../negocio/contexto';
import { useRepositorio } from '../notas/contexto';
import { exportarCopiaNegocio } from '../negocio/copia';
import { elegirZip, exportarCopia, importarCopia } from '../notas/copia';
import { Bloqueo, enTelefono } from '../seguridad/nativo';
import './PantallaAjustes.css';

const TEMAS: { valor: Tema; etiqueta: string }[] = [
  { valor: 'sistema', etiqueta: 'Sistema' },
  { valor: 'claro', etiqueta: 'Claro' },
  { valor: 'oscuro', etiqueta: 'Oscuro' },
];

const VISTAS: { valor: VistaNotas; etiqueta: string }[] = [
  { valor: 'tarjetas', etiqueta: 'Tarjetas' },
  { valor: 'lista', etiqueta: 'Lista' },
];

/** Lista plana, sin tarjetas (DISENO.md). */
export function PantallaAjustes() {
  const { tema, vistaNotas, cambiarAjustes, abrirComandos, bloqueo } = useEstado();
  const [avisoBloqueo, setAvisoBloqueo] = useState('');

  /** Activar o quitar el bloqueo pide primero huella/PIN: así nadie se queda fuera ni lo quita a escondidas. */
  async function cambiarBloqueo(activar: boolean) {
    setAvisoBloqueo('');
    try {
      if (activar && !(await Bloqueo.disponible()).disponible) {
        setAvisoBloqueo('Primero pon un bloqueo de pantalla en el teléfono (PIN, patrón o huella).');
        return;
      }
      await Bloqueo.autenticar({
        titulo: 'Bar Box',
        subtitulo: activar ? 'Confirma para activar el bloqueo' : 'Confirma para quitar el bloqueo',
      });
      cambiarAjustes({ bloqueo: activar });
    } catch (e) {
      if ((e as { code?: unknown } | null)?.code !== 'CANCELADO') setAvisoBloqueo('No se pudo comprobar. Prueba otra vez.');
    }
  }
  // Se guarda solo cuando es válido (o vacío, para quitarlo)
  const repo = useRepositorio();
  const [aviso, setAviso] = useState('');
  const [ocupado, setOcupado] = useState(false);

  async function trabajar(tarea: () => Promise<string>) {
    setOcupado(true);
    setAviso('');
    try {
      setAviso(await tarea());
    } catch {
      setAviso('No se pudo completar. En Android 10 o anterior, la carpeta Documentos necesita un permiso que la app no pide.');
    } finally {
      setOcupado(false);
    }
  }
  return (
    <Pagina>
      <Encabezado
        titulo="Ajustes"
        iconos={[{ icono: 'buscar', etiqueta: 'Buscar y comandos', alTocar: () => abrirComandos(true) }]}
      />
      <ul class="ajustes">
        <li>
          <p class="ajustes__titulo">
            Tema
          </p>
          <Segmentado etiqueta="Tema" opciones={TEMAS} valor={tema} alCambiar={(t) => cambiarAjustes({ tema: t })} />
          <p class="ajustes__pista">«Sistema» cambia solo cuando el teléfono pasa a modo oscuro.</p>
        </li>
        <li>
          <p class="ajustes__titulo">Notas</p>
          <Segmentado
            etiqueta="Vista de notas"
            opciones={VISTAS}
            valor={vistaNotas}
            alCambiar={(v) => cambiarAjustes({ vistaNotas: v })}
          />
          <p class="ajustes__pista">Tarjetas: tus notas como las apps recientes de Android.</p>
        </li>
        <li>
          <p class="ajustes__titulo">Copia de seguridad</p>
          <div class="ajustes__botones">
            <Boton desactivado={ocupado} alTocar={() => void trabajar(() => exportarCopia(repo))}>
              Exportar notas (ZIP)
            </Boton>
            <Boton
              variante="texto"
              desactivado={ocupado}
              alTocar={() => {
                // El selector se abre ya, dentro del toque. Mientras se elige no se bloquea nada:
                // si el sistema no avisa de "cancelar", los botones no se quedan desactivados.
                void elegirZip().then((archivo) => archivo && trabajar(() => importarCopia(repo, archivo)));
              }}
            >
              Importar notas (ZIP)
            </Boton>
          </div>
          <p class="ajustes__pista">
            Todas tus notas en un .zip de Markdown legible (sin cifrar). Importar nunca borra ni pisa lo que ya tienes.
          </p>
          {aviso && (
            <p class="ajustes__aviso" aria-live="polite">
              {aviso}
            </p>
          )}
        </li>
        <li>
          <p class="ajustes__titulo">Privacidad</p>
          {enTelefono() && (
            <>
              <Interruptor etiqueta="Bloqueo con huella o PIN" activo={bloqueo} alCambiar={(v) => void cambiarBloqueo(v)} />
              <p class="ajustes__pista">Al abrir Bar Box y al volver tras un minuto fuera. Usa el bloqueo del propio teléfono.</p>
              {avisoBloqueo && (
                <p class="ajustes__aviso" role="alert">
                  {avisoBloqueo}
                </p>
              )}
            </>
          )}
          <p class="ajustes__pista ajustes__pista--suelta">
            Cada nota se cifra (AES-256-GCM) en cuanto se crea. En el teléfono, la clave está protegida por el
            almacén de claves de Android (Keystore) y nunca sale de él. Al exportar, la copia va descifrada para que
            cualquier app pueda leerla: guarda el ZIP en un lugar seguro.
          </p>
        </li>
        <DatosNegocio />
      </ul>
    </Pagina>
  );
}

/**
 * Datos del negocio: exportar toda la contabilidad (CSV), verificar el diario y qué pasa con los
 * datos. Los botones solo aparecen si el cargo puede (lo decide la tabla de permisos del núcleo).
 */
function DatosNegocio() {
  const app = useNegocioOpcional();
  const [aviso, setAviso] = useState('');
  const [ocupado, setOcupado] = useState(false);
  if (!app) return null;
  const { negocio } = app;
  const puedeExportar = negocio.puede('contabilidad.exportar');

  async function exportar(que: 'resumen' | 'ventas') {
    setOcupado(true);
    setAviso('');
    try {
      const hoy = new Date();
      setAviso(await (que === 'resumen' ? exportarResumen(negocio, periodoCompleto(hoy), hoy) : exportarVentas(negocio, periodoCompleto(hoy), hoy)));
    } catch (e) {
      setAviso(e instanceof ReglaRota ? e.message : 'No se pudo exportar. Prueba otra vez.');
    } finally {
      setOcupado(false);
    }
  }

  async function copiaCompleta() {
    setOcupado(true);
    setAviso('');
    try {
      setAviso(await exportarCopiaNegocio());
    } catch {
      setAviso('No se pudo hacer la copia. Prueba otra vez.');
    } finally {
      setOcupado(false);
    }
  }

  return (
    <li>
      <p class="ajustes__titulo">Datos del negocio</p>
      {puedeExportar && (
        <>
          <div class="ajustes__botones">
            <Boton icono="exportar" desactivado={ocupado} alTocar={() => void exportar('resumen')}>
              Exportar contabilidad completa (CSV)
            </Boton>
            <Boton icono="exportar" variante="texto" desactivado={ocupado} alTocar={() => void exportar('ventas')}>
              Exportar todas las ventas (CSV)
            </Boton>
            <Boton icono="exportar" variante="tonal" desactivado={ocupado} alTocar={() => void copiaCompleta()}>
              Copia completa del negocio (ZIP)
            </Boton>
          </div>
          <p class="ajustes__pista">
            Desde el primer movimiento hasta hoy, separado por «;» para Excel o para tu contador. Registro interno de apoyo:
            no es factura electrónica ni contabilidad oficial.
          </p>
          {aviso && (
            <p class="ajustes__aviso" aria-live="polite">
              {aviso}
            </p>
          )}
        </>
      )}
      {negocio.puede('diario.verificar') && <VerificarRegistro negocio={negocio} />}
      <p class="ajustes__pista">
        <strong>Sin internet:</strong> Bar Box no envía nada a nadie; todo vive en este teléfono.{' '}
        <strong>Cifrado:</strong> ventas, inventario, caja, usuarios y fotos de facturas se guardan cifrados (AES-256), con
        la clave protegida por el chip de seguridad de Android (Keystore). <strong>Firmado:</strong> cada movimiento guarda
        quién lo hizo y la huella del anterior; si alguien alterara el archivo, «Verificar registro» lo detecta.{' '}
        <strong>Copias:</strong> son manuales (CSV y ZIP). Guárdalas fuera del teléfono: si se pierde o se reinstala la app,
        solo vuelve lo que esté en una copia.
      </p>
    </li>
  );
}
