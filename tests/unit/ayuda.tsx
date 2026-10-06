import { render, type ComponentChild } from 'preact';
import { act } from 'preact/test-utils';
import { afterEach } from 'vitest';
import { ProveedorEstado } from '../../src/app/estado';
import { crearAlmacen, DiscoMemoria } from '../../src/core/almacen/almacen';
import { RepositorioNotas } from '../../src/core/notas/repositorio';
import { ProveedorNotas } from '../../src/features/notas/contexto';

/** Utilidades compartidas por las pruebas de pantallas nuevas. */
let contenedores: HTMLElement[] = [];

afterEach(() => {
  for (const c of contenedores) {
    render(null, c);
    c.remove();
  }
  contenedores = [];
  location.hash = '';
});

export function repoNuevo(reloj?: () => Date) {
  return new RepositorioNotas(crearAlmacen(new DiscoMemoria()), reloj);
}

/** Deja correr las promesas pendientes (lecturas del repositorio) y re-renderiza. */
export async function esperar() {
  for (let i = 0; i < 6; i++) await act(async () => await new Promise((r) => setTimeout(r, 0)));
}

export async function montar(vista: ComponentChild, repo: RepositorioNotas) {
  const nuevo = document.createElement('div');
  document.body.append(nuevo);
  contenedores.push(nuevo);
  await act(async () => {
    render(
      <ProveedorEstado>
        <ProveedorNotas value={repo}>{vista}</ProveedorNotas>
      </ProveedorEstado>,
      nuevo,
    );
  });
  await esperar();
  return nuevo;
}

export function boton(c: ParentNode, texto: string | RegExp) {
  const b = [...c.querySelectorAll('button')].find((x) =>
    typeof texto === 'string' ? x.textContent === texto || x.getAttribute('aria-label') === texto : texto.test(x.textContent ?? ''),
  );
  if (!b) throw new Error(`No hay botón «${String(texto)}»`);
  return b;
}
