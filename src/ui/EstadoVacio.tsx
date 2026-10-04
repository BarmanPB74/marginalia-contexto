import './EstadoVacio.css';

/** Pantalla sin contenido: una frase manuscrita y una pista. Sin ilustraciones ni botones de relleno. */
export function EstadoVacio({ mensaje, pista }: { mensaje: string; pista: string }) {
  return (
    <div class="estado-vacio">
      <p class="estado-vacio__mensaje">{mensaje}</p>
      <p class="estado-vacio__pista">{pista}</p>
    </div>
  );
}
