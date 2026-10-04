/** 84 → "1:24" · 3725 → "1:02:05". Redondea hacia abajo; nunca negativo. */
export function formatearTiempo(segundos: number): string {
  const total = Math.max(0, Math.floor(segundos));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = String(total % 60).padStart(2, '0');
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${s}` : `${m}:${s}`;
}

interface Punto {
  x: number;
  y: number;
}

interface Medidas {
  ancho: number;
  alto: number;
}

interface Pantalla extends Medidas {
  /** alto ocupado abajo (barra inferior + zona de gestos) que el flotante no debe tapar */
  reservaInferior: number;
}

const MARGEN = 8;

/** Mantiene una caja flotante (esquina superior izquierda en `punto`) dentro de la pantalla. */
export function limitarPosicion(punto: Punto, caja: Medidas, pantalla: Pantalla): Punto {
  const maxX = pantalla.ancho - caja.ancho - MARGEN;
  const maxY = pantalla.alto - pantalla.reservaInferior - caja.alto - MARGEN;
  return {
    x: Math.max(MARGEN, Math.min(punto.x, maxX)),
    y: Math.max(MARGEN, Math.min(punto.y, maxY)),
  };
}
