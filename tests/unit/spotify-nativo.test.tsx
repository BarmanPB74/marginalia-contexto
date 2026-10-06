import { render } from 'preact';
import { act } from 'preact/test-utils';
import { describe, expect, it, vi } from 'vitest';

// El teléfono se simula: el plugin nativo es un doble que registra las órdenes.
const ordenes: [string, unknown?][] = [];
let alEstado: ((d: unknown) => void) | null = null;
let fallarConectar: { code: string } | null = null;
vi.mock('@capacitor/core', () => ({
  Capacitor: { isNativePlatform: () => true },
  registerPlugin: () => ({
    conectar: async (o: unknown) => {
      ordenes.push(['conectar', o]);
      if (fallarConectar) throw fallarConectar;
    },
    reproducir: async (o: unknown) => void ordenes.push(['reproducir', o]),
    pausar: async () => void ordenes.push(['pausar']),
    reanudar: async () => void ordenes.push(['reanudar']),
    estado: async () => ({ pausado: false, posicionMs: 0 }),
    addListener: async (_e: string, cb: (d: unknown) => void) => {
      alEstado = cb;
      return { remove: async () => undefined };
    },
  }),
}));

const { useSpotify } = await import('../../src/features/musica/useSpotify');
type Control = ReturnType<typeof useSpotify>;

async function conHook() {
  const ref: { actual: Control | null } = { actual: null };
  function Prueba() {
    ref.actual = useSpotify();
    return null;
  }
  const div = document.createElement('div');
  await act(async () => render(<Prueba />, div));
  return ref;
}

const ID = 'a'.repeat(32);
const PISTA = 'spotify:track:4uLU6hMCjMI75M1A2tKUQC';

describe('useSpotify con el plugin nativo', () => {
  it('reproducir conecta si hace falta y pone la pista en el segundo pedido; el estado llega por eventos', async () => {
    ordenes.length = 0;
    fallarConectar = null;
    const s = await conHook();
    await act(async () => void (await s.actual?.reproducir(ID, PISTA, 42)));
    expect(ordenes).toEqual([
      ['conectar', { clientId: ID }],
      ['reproducir', { uri: PISTA, posicionMs: 42_000 }],
    ]);
    await act(async () => alEstado?.({ pausado: false, posicionMs: 42_000, uri: PISTA, titulo: 'Tema', duracionMs: 90_000 }));
    expect(s.actual?.conectado).toBe(true);
    expect(s.actual?.sonando).toBe(true);
    expect(s.actual?.estado?.titulo).toBe('Tema');
    await act(async () => s.actual?.alternar());
    expect(ordenes.at(-1)).toEqual(['pausar']);
  });

  it('sin Client ID no llama al plugin; un error nativo se explica', async () => {
    ordenes.length = 0;
    const s = await conHook();
    await act(async () => void (await s.actual?.conectar('')));
    expect(ordenes).toEqual([]);
    expect(s.actual?.error).toContain('Client ID');
    fallarConectar = { code: 'SIN_APP' };
    await act(async () => void (await s.actual?.conectar(ID)));
    expect(s.actual?.conectado).toBe(false);
    expect(s.actual?.error).toContain('Instala la app de Spotify');
    // Desconectado: las órdenes no salen
    ordenes.length = 0;
    await act(async () => s.actual?.alternar());
    expect(ordenes).toEqual([]);
  });
});
