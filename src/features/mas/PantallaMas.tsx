import { NOMBRE_ROL } from '../../core/negocio';
import { Encabezado } from '../../ui/Encabezado';
import { Icono } from '../../ui/Icono';
import { Pagina } from '../../ui/Pagina';
import { useNegocio } from '../negocio/contexto';
import { cambiarDeUsuario } from '../usuarios/PantallaUsuarios';
import { seccionesMas } from './secciones';
import './Mas.css';

/**
 * «Más»: tarjetas grandes con icono y descripción para cada sección que no está en la barra,
 * solo las que el cargo de la persona puede usar, y al final «Cambiar de usuario».
 */
export function PantallaMas() {
  const { negocio, sesion } = useNegocio();
  const tarjetas = seccionesMas((a) => negocio.puede(a));
  return (
    <Pagina ancho="amplio">
      <Encabezado titulo="Más" />
      {sesion && (
        <p class="mas__quien">
          {sesion.nombre} · {NOMBRE_ROL[sesion.rol]}
        </p>
      )}
      <ul class="mas__rejilla" aria-label="Otras secciones">
        {tarjetas.map((t) => (
          <li key={t.id}>
            <a class="mas__tarjeta" href={`#/${t.id}`}>
              <span class="mas__icono" aria-hidden="true">
                <Icono nombre={t.icono} tamano={28} />
              </span>
              <span class="mas__texto">
                <span class="mas__titulo">{t.etiqueta}</span>
                <span class="mas__descripcion">{t.descripcion}</span>
              </span>
            </a>
          </li>
        ))}
        <li>
          <button type="button" class="mas__tarjeta mas__tarjeta--salir" onClick={() => cambiarDeUsuario(() => negocio.cerrarSesion())}>
            <span class="mas__icono" aria-hidden="true">
              <Icono nombre="usuarios" tamano={28} />
            </span>
            <span class="mas__texto">
              <span class="mas__titulo">Cambiar de usuario</span>
              <span class="mas__descripcion">Cierra tu sesión para que otra persona entre con su PIN.</span>
            </span>
          </button>
        </li>
      </ul>
    </Pagina>
  );
}
