import { categoriaDe, inicialesDe, type Categoria } from './categorias';
import './categorias.css';
import './Avatar.css';

interface PropsAvatar {
  nombre: string;
  color?: Categoria | undefined;
  tamano?: 's' | 'm' | 'l' | undefined;
  /** Foto local (blob: o data:) */
  foto?: string | undefined;
}

/** Círculo con las iniciales (o foto) de una persona, en un color estable para su nombre. Decorativo. */
export function Avatar({ nombre, color, tamano = 'm', foto }: PropsAvatar) {
  return (
    <span class={`avatar avatar--${tamano} cat-${color ?? categoriaDe(nombre)}`} aria-hidden="true">
      {foto ? <img class="avatar__foto" src={foto} alt="" /> : inicialesDe(nombre)}
    </span>
  );
}

/** Alias con el nombre del pedido: la inicial del usuario en el selector con PIN. */
export const InicialUsuario = Avatar;

interface PropsBotonUsuario {
  nombre: string;
  /** Rol visible ("Cajero") */
  rol?: string | undefined;
  color?: Categoria | undefined;
  seleccionado?: boolean | undefined;
  alTocar: () => void;
}

/** Usuario elegible en la pantalla de entrada: avatar grande, nombre y rol. */
export function BotonUsuario({ nombre, rol, color, seleccionado = false, alTocar }: PropsBotonUsuario) {
  return (
    <button type="button" class="boton-usuario" aria-pressed={seleccionado} onClick={alTocar}>
      <Avatar nombre={nombre} color={color} tamano="l" />
      <span class="boton-usuario__nombre">{nombre}</span>
      {rol && <span class="boton-usuario__rol">{rol}</span>}
    </button>
  );
}
