import { render, type ComponentChild } from 'preact';
import { act } from 'preact/test-utils';
import { afterEach } from 'vitest';
import { ProveedorEstado } from '../../src/app/estado';
import { crearAlmacen, DiscoMemoria } from '../../src/core/almacen/almacen';
import { RepositorioNotas } from '../../src/core/notas/repositorio';
import { ProveedorNotas } from '../../src/features/notas/contexto';
import { Negocio } from '../../src/core/negocio';
import { NegocioDePrueba } from '../../src/features/negocio/contexto';

/** Utilidades compartidas por las pruebas de pantallas nuevas. */
let contenedores: HTMLElement[] = [];

afterEach(() => {
  // Dentro de act: los efectos pendientes se cierran ya, no en un temporizador que correría
  // cuando jsdom ya desmontó window (error «removeEventListener is not a function»).
  for (const c of contenedores) {
    act(() => render(null, c));
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

/** Negocio en memoria con el dueño creado y su sesión abierta (PIN 1234, PBKDF2 rápido). */
export async function negocioDePrueba(reloj?: () => Date): Promise<Negocio> {
  const negocio = await Negocio.crear(crearAlmacen(new DiscoMemoria()), {
    iteracionesPin: 1000,
    ...(reloj ? { reloj } : {}),
  });
  await negocio.crearUsuario({ nombre: 'Dueña', rol: 'dueno', pin: '1234' });
  return negocio;
}

/** Espera (hasta `ms`) a que se cumpla una condición, dejando correr promesas y re-renders. */
export async function hastaQue(condicion: () => boolean, ms = 3000) {
  const limite = Date.now() + ms;
  while (!condicion() && Date.now() < limite) {
    await act(async () => await new Promise((r) => setTimeout(r, 10)));
  }
}

export async function montar(vista: ComponentChild, repo: RepositorioNotas, negocio?: Negocio) {
  const n = negocio ?? (await negocioDePrueba());
  const nuevo = document.createElement('div');
  document.body.append(nuevo);
  contenedores.push(nuevo);
  await act(async () => {
    render(
      <NegocioDePrueba.Provider value={n}>
        <ProveedorEstado>
          <ProveedorNotas value={repo}>{vista}</ProveedorNotas>
        </ProveedorEstado>
      </NegocioDePrueba.Provider>,
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
