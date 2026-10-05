import { useState } from 'preact/hooks';

/**
 * Miniatura oficial de la canción. Sin red (o si YouTube no la tiene) queda el recuadro
 * de color en vez del icono de imagen rota del navegador.
 */
export function Miniatura({ src, clase }: { src: string | null; clase: string }) {
  const [fallo, setFallo] = useState(false);
  if (!src || fallo) return <span class={clase} aria-hidden="true" />;
  return <img class={clase} src={src} alt="" loading="lazy" referrerpolicy="no-referrer" onError={() => setFallo(true)} />;
}
