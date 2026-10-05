/*
 * Iconos propios (DISENO.md): 24×24, trazo 1.75, puntas redondas, sin relleno.
 * Las líneas tienen pequeñas curvas a propósito, para que parezcan dibujadas a mano.
 */
const TRAZOS = {
  // Hoja con la esquina doblada y dos renglones
  notas: (
    <>
      <path d="M6.2 3.6c3-.2 6-.1 8.6 0l3.6 3.7c.1 4.3 0 8.7-.1 13-4 .2-8.1.2-12.1 0-.2-5.6-.2-11.1 0-16.7Z" />
      <path d="M14.6 3.8c0 1.3-.1 2.6.1 3.9 1.2.1 2.4.1 3.6 0" />
      <path d="M8.6 12.1c2.3-.1 4.5-.1 6.8.1M8.6 15.6c1.6-.1 3.2 0 4.7 0" />
    </>
  ),
  // Hoja de calendario con dos anillas
  calendario: (
    <>
      <path d="M4.2 6.4c5.2-.3 10.4-.2 15.6 0 .2 4.5.2 9 0 13.6-5.2.2-10.4.2-15.6 0-.2-4.6-.2-9.1 0-13.6Z" />
      <path d="M4.3 10.3c5.1-.1 10.2-.1 15.4.1M8.4 3.6v4.3M15.6 3.6v4.3" />
    </>
  ),
  // Corchea
  musica: (
    <>
      <path d="M10.4 17.3V4.6c2.4.3 4.6 1.4 5.8 3.5.4.8.6 1.7.4 2.5" />
      <circle cx="7.9" cy="17.4" r="2.6" />
    </>
  ),
  // Dos líneas con un punto, el mismo gesto que la barra de progreso del reproductor
  ajustes: (
    <>
      <path d="M3.8 8.1c2.6-.1 5.2 0 7.7 0M16.6 8.1c1.2 0 2.4-.1 3.6 0M3.8 15.9c1.2 0 2.4.1 3.6 0M12.5 15.9c2.6.1 5.2 0 7.7 0" />
      <circle cx="14" cy="8.1" r="2.4" />
      <circle cx="10" cy="15.9" r="2.4" />
    </>
  ),
  // Controles del reproductor: contornos, como en la referencia
  anterior: (
    <>
      <path d="M11.6 7.3c-2.2 1.5-4.3 3.1-6.4 4.7 2.1 1.6 4.2 3.2 6.4 4.7-.1-3.1-.1-6.3 0-9.4Z" />
      <path d="M19 7.3c-2.2 1.5-4.3 3.1-6.4 4.7 2.1 1.6 4.2 3.2 6.4 4.7-.1-3.1-.1-6.3 0-9.4Z" />
    </>
  ),
  siguiente: (
    <>
      <path d="M5 7.3c2.2 1.5 4.3 3.1 6.4 4.7-2.1 1.6-4.2 3.2-6.4 4.7.1-3.1.1-6.3 0-9.4Z" />
      <path d="M12.4 7.3c2.2 1.5 4.3 3.1 6.4 4.7-2.1 1.6-4.2 3.2-6.4 4.7.1-3.1.1-6.3 0-9.4Z" />
    </>
  ),
  pausa: (
    <>
      <path d="M7.3 5.4c1.1-.1 2.1-.1 3.1 0 .1 4.4.1 8.8 0 13.2-1 .1-2 .1-3.1 0-.1-4.4-.1-8.8 0-13.2Z" />
      <path d="M13.6 5.4c1.1-.1 2.1-.1 3.1 0 .1 4.4.1 8.8 0 13.2-1 .1-2 .1-3.1 0-.1-4.4-.1-8.8 0-13.2Z" />
    </>
  ),
  reproducir: <path d="M7.8 5.3c3.9 2.1 7.6 4.3 11.1 6.7-3.5 2.4-7.2 4.6-11.1 6.7-.2-4.5-.2-8.9 0-13.4Z" />,
  'volumen-bajo': <path d="M4.4 9.7c.9-.1 1.9-.1 2.8 0l3.9-3.2c.1 3.7.1 7.4 0 11-1.3-1-2.6-2.1-3.9-3.2-.9.1-1.9.1-2.8 0-.1-1.5-.1-3.1 0-4.6ZM14.3 10.2c.7 1.2.7 2.4 0 3.6" />,
  'volumen-alto': (
    <path d="M3.4 9.7c.9-.1 1.9-.1 2.8 0l3.9-3.2c.1 3.7.1 7.4 0 11-1.3-1-2.6-2.1-3.9-3.2-.9.1-1.9.1-2.8 0-.1-1.5-.1-3.1 0-4.6ZM13.2 10.2c.7 1.2.7 2.4 0 3.6M15.7 8.3c1.6 2.4 1.6 5 0 7.4M18.2 6.5c2.6 3.6 2.6 7.4 0 11" />
  ),
  // Volver: flecha con la punta ligeramente torcida
  atras: <path d="M19.2 12.1c-4.6-.2-9.3-.1-13.9 0M10.6 6.3c-1.9 1.9-3.7 3.8-5.4 5.8 1.7 1.9 3.5 3.8 5.4 5.7" />,
  // Esconder a un lado: flecha corta hacia el borde con una raya (el canto de la pantalla)
  esconder: <path d="M5.2 12.1c3.6-.1 7.2 0 10.6 0M11.7 7.8c1.5 1.4 2.9 2.8 4.2 4.3-1.3 1.4-2.7 2.8-4.2 4.2M19.3 5.4c.1 4.4.1 8.8 0 13.2" />,
  // Lupa dibujada: para buscar y abrir los comandos
  buscar: (
    <>
      <circle cx="10.6" cy="10.4" r="5.9" />
      <path d="M15 14.9c1.5 1.3 2.9 2.7 4.3 4.2" />
    </>
  ),
  // Cuatro tarjetas: vista de notas tipo apps recientes
  tarjetas: (
    <path d="M4.3 5.1c1.9-.1 3.9-.1 5.8 0 .1 1.9.1 3.9 0 5.8-1.9.1-3.9.1-5.8 0-.1-1.9-.1-3.9 0-5.8ZM13.9 5.1c1.9-.1 3.9-.1 5.8 0 .1 1.9.1 3.9 0 5.8-1.9.1-3.9.1-5.8 0-.1-1.9-.1-3.9 0-5.8ZM4.3 13.1c1.9-.1 3.9-.1 5.8 0 .1 1.9.1 3.9 0 5.8-1.9.1-3.9.1-5.8 0-.1-1.9-.1-3.9 0-5.8ZM13.9 13.1c1.9-.1 3.9-.1 5.8 0 .1 1.9.1 3.9 0 5.8-1.9.1-3.9.1-5.8 0-.1-1.9-.1-3.9 0-5.8Z" />
  ),
  // Renglones: vista de lista
  lista: <path d="M4.4 6.6c5-.1 10.1 0 15.2 0M4.4 12.1c5-.1 10.1-.1 15.2 0M4.4 17.5c5 .1 10.1 0 15.2 0" />,
  // Más: crear
  mas: <path d="M12.1 5.2c-.1 4.6-.1 9.1 0 13.6M5.3 12c4.5-.1 9-.1 13.5.1" />,
  // Candado: nota cifrada
  candado: (
    <>
      <path d="M6.1 10.7c3.9-.2 7.9-.2 11.8 0 .2 2.9.2 5.8 0 8.6-3.9.2-7.9.2-11.8 0-.2-2.8-.2-5.7 0-8.6Z" />
      <path d="M8.7 10.6c-.2-2.3.2-5.3 3.3-5.4 3.2 0 3.5 3 3.3 5.4" />
    </>
  ),
  // Flechas de mes en el calendario
  izquierda: <path d="M14.4 6.2c-2 1.9-3.9 3.8-5.7 5.8 1.8 2 3.7 3.9 5.7 5.8" />,
  derecha: <path d="M9.6 6.2c2 1.9 3.9 3.8 5.7 5.8-1.8 2-3.7 3.9-5.7 5.8" />,
  // Exportar: bandeja con flecha hacia arriba
  exportar: (
    <path d="M12 15.1c-.1-3.6-.1-7.2 0-10.8M8.1 8.1c1.3-1.3 2.6-2.6 3.9-3.8 1.3 1.2 2.6 2.5 3.9 3.8M5.1 13.6c-.1 2 0 3.9.1 5.8 4.5.2 9.1.2 13.6 0 .1-1.9.2-3.8.1-5.8" />
  ),
  // Asa para arrastrar: seis puntos
  mover: (
    <>
      <circle cx="9" cy="6.5" r=".6" />
      <circle cx="15" cy="6.5" r=".6" />
      <circle cx="9" cy="12" r=".6" />
      <circle cx="15" cy="12" r=".6" />
      <circle cx="9" cy="17.5" r=".6" />
      <circle cx="15" cy="17.5" r=".6" />
    </>
  ),
};

export type NombreIcono = keyof typeof TRAZOS;
export const NOMBRES_ICONO = Object.keys(TRAZOS) as NombreIcono[];

/** Siempre decorativo: el texto o la etiqueta accesible lo pone quien lo usa. */
export function Icono({ nombre, tamano = 24 }: { nombre: NombreIcono; tamano?: number }) {
  return (
    <svg
      class="icono"
      width={tamano}
      height={tamano}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="1.75"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {TRAZOS[nombre]}
    </svg>
  );
}
