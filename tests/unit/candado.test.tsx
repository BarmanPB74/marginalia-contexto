import { act } from 'preact/test-utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from '../../src/app/App';
import { leerAjustes } from '../../src/app/ajustes';
import { debeBloquear } from '../../src/features/seguridad/Candado';
import { boton, esperar, montar, repoNuevo } from './ayuda';

// El teléfono se simula: el diálogo de huella/PIN responde lo que diga cada prueba.
const llamadas: string[] = [];
let respuesta: 'ok' | 'cancelado' = 'ok';
let disponible = true;
vi.mock('../../src/features/seguridad/nativo', () => ({
  enTelefono: () => true,
  envoltorioKeystore: {},
  Bloqueo: {
    disponible: async () => ({ disponible }),
    autenticar: async (o: { subtitulo: string }) => {
      llamadas.push(o.subtitulo);
      if (respuesta !== 'ok') throw Object.assign(new Error('x'), { code: 'CANCELADO' });
    },
    ocultarEnRecientes: async () => undefined,
  },
}));

beforeEach(() => {
  llamadas.length = 0;
  respuesta = 'ok';
  disponible = true;
});

const fijarVisibilidad = (estado: 'hidden' | 'visible') => {
  Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => estado });
  document.dispatchEvent(new Event('visibilitychange'));
};

describe('bloqueo con huella/PIN (ADR-014)', () => {
  it('debeBloquear: solo tras un minuto fuera', () => {
    expect(debeBloquear(null, 1e6)).toBe(false);
    expect(debeBloquear(1000, 1000 + 59_999)).toBe(false);
    expect(debeBloquear(1000, 1000 + 60_000)).toBe(true);
  });

  it('con el bloqueo activo, nada de las notas se monta hasta desbloquear', async () => {
    localStorage.setItem('marginalia.ajustes.v1', JSON.stringify({ bloqueo: true }));
    respuesta = 'cancelado';
    const repo = repoNuevo();
    await repo.crear({ titulo: 'Secreta' });
    location.hash = '#/notas';
    const c = await montar(<App />, repo);
    expect(c.textContent).toContain('Marginalia está bloqueada');
    expect(c.textContent).not.toContain('Secreta');
    expect(llamadas).toHaveLength(1); // el diálogo se abre solo
    respuesta = 'ok';
    await act(async () => boton(c, 'Desbloquear').click());
    await esperar();
    expect(c.textContent).toContain('Secreta');
  });

  it('vuelve a bloquear tras un minuto fuera, no antes', async () => {
    localStorage.setItem('marginalia.ajustes.v1', JSON.stringify({ bloqueo: true }));
    const ahora = vi.spyOn(Date, 'now');
    ahora.mockReturnValue(1_000_000);
    const c = await montar(<App />, repoNuevo());
    await esperar();
    expect(c.textContent).not.toContain('Marginalia está bloqueada');
    await act(async () => fijarVisibilidad('hidden'));
    ahora.mockReturnValue(1_000_000 + 30_000);
    respuesta = 'cancelado';
    await act(async () => fijarVisibilidad('visible'));
    expect(c.textContent).not.toContain('Marginalia está bloqueada');
    await act(async () => fijarVisibilidad('hidden'));
    ahora.mockReturnValue(1_000_000 + 200_000);
    await act(async () => fijarVisibilidad('visible'));
    await esperar();
    expect(c.textContent).toContain('Marginalia está bloqueada');
    ahora.mockRestore();
  });

  it('Ajustes: activarlo pide confirmar; sin bloqueo de pantalla en el teléfono, lo explica', async () => {
    location.hash = '#/ajustes';
    const c = await montar(<App />, repoNuevo());
    const interruptor = () =>
      [...c.querySelectorAll<HTMLElement>('[role=switch]')].find((e) => e.closest('li')?.textContent?.includes('huella'));
    disponible = false;
    await act(async () => interruptor()?.click());
    await esperar();
    expect(c.textContent).toContain('Primero pon un bloqueo de pantalla');
    expect(leerAjustes().bloqueo).toBe(false);
    disponible = true;
    await act(async () => interruptor()?.click());
    await esperar();
    expect(llamadas).toContain('Confirma para activar el bloqueo');
    expect(leerAjustes().bloqueo).toBe(true);
  });
});
