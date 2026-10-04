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
