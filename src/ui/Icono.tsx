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
