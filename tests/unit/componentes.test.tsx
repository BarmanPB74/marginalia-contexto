import { render, type ComponentChild } from 'preact';
import { act } from 'preact/test-utils';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Boton } from '../../src/ui/Boton';
import { CampoTexto } from '../../src/ui/CampoTexto';
import { CeldaDia } from '../../src/ui/CeldaDia';
import { Encabezado } from '../../src/ui/Encabezado';
import { Etiqueta } from '../../src/ui/Etiqueta';
import { Interruptor } from '../../src/ui/Interruptor';
import { Pagina } from '../../src/ui/Pagina';
import { Tarjeta } from '../../src/ui/Tarjeta';
import { Avatar, BotonUsuario } from '../../src/ui/Avatar';
import { BotonFlotante } from '../../src/ui/BotonFlotante';
import { Buscador } from '../../src/ui/Buscador';
import { CampoNumero } from '../../src/ui/CampoNumero';
import { Casilla } from '../../src/ui/Casilla';
import { categoriaDe, CATEGORIAS, inicialesDe } from '../../src/ui/categorias';
import { Chip, ChipFiltro } from '../../src/ui/Chip';
import { Cifra } from '../../src/ui/Cifra';
import { Dialogo } from '../../src/ui/Dialogo';
import { Disposicion, Rejilla } from '../../src/ui/Disposicion';
import { Hoja } from '../../src/ui/Hoja';
import { Insignia } from '../../src/ui/Insignia';
import { MuestraColor } from '../../src/ui/MuestraColor';
import { Pestanas } from '../../src/ui/Pestanas';
import { Rango } from '../../src/ui/Rango';
import { Tabla } from '../../src/ui/Tabla';
import { TarjetaProducto } from '../../src/ui/TarjetaProducto';
import { TecladoNumerico } from '../../src/ui/TecladoNumerico';
import { TecladoPin } from '../../src/ui/TecladoPin';

let contenedor: HTMLElement;

function montar(vista: ComponentChild) {
  contenedor = document.createElement('div');
  document.body.append(contenedor);
  act(() => render(vista, contenedor));
  return contenedor;
}

afterEach(() => {
  render(null, contenedor);
  contenedor.remove();
});

describe('Pagina y Encabezado', () => {
  it('la página es el <main> y el encabezado lleva un único h1', () => {
    const c = montar(
      <Pagina>
        <Encabezado titulo="Notas" />
      </Pagina>,
    );
    expect(c.querySelector('main.pagina')).not.toBeNull();
    expect(c.querySelectorAll('h1')).toHaveLength(1);
    expect(c.querySelector('h1')?.textContent).toBe('Notas');
  });

  it('el encabezado admite como mucho una acción', () => {
    const alTocar = vi.fn();
    const c = montar(<Encabezado titulo="Notas" accion={{ etiqueta: 'Nueva', alTocar }} />);
    const botones = c.querySelectorAll('button');
    expect(botones).toHaveLength(1);
    act(() => botones[0]?.click());
    expect(alTocar).toHaveBeenCalledOnce();
  });
});

describe('Boton', () => {
  it('es un <button type="button"> con la variante como clase', () => {
    const c = montar(<Boton variante="texto">Cancelar</Boton>);
    const boton = c.querySelector('button');
    expect(boton?.type).toBe('button');
    expect(boton?.classList.contains('boton--texto')).toBe(true);
  });

  it('por defecto es de contorno y no responde si está desactivado', () => {
    const alTocar = vi.fn();
    const c = montar(
      <Boton desactivado alTocar={alTocar}>
        Guardar
      </Boton>,
    );
    const boton = c.querySelector('button');
    expect(boton?.classList.contains('boton--contorno')).toBe(true);
    act(() => boton?.click());
    expect(alTocar).not.toHaveBeenCalled();
  });
});

describe('Tarjeta y Etiqueta', () => {
  it('la tarjeta envuelve su contenido', () => {
    const c = montar(<Tarjeta>hola</Tarjeta>);
    expect(c.querySelector('.tarjeta')?.textContent).toBe('hola');
  });

  it('la etiqueta de canción usa la variante de acento', () => {
    const c = montar(<Etiqueta tipo="cancion">♪ Canción · 1:24</Etiqueta>);
    expect(c.querySelector('.etiqueta')?.classList.contains('etiqueta--cancion')).toBe(true);
  });
});

describe('CampoTexto', () => {
  it('la etiqueta visible está asociada al campo', () => {
    const c = montar(<CampoTexto etiqueta="Título" valor="" alCambiar={() => undefined} />);
    const input = c.querySelector('input');
    const label = c.querySelector('label');
    expect(input?.id).toBeTruthy();
    expect(label?.htmlFor).toBe(input?.id);
  });

  it('avisa de cada cambio con el texto nuevo', () => {
    const alCambiar = vi.fn();
    const c = montar(<CampoTexto etiqueta="Título" valor="" alCambiar={alCambiar} />);
    const input = c.querySelector('input');
    if (!input) throw new Error('sin input');
    input.value = 'Hola';
    act(() => {
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });
    expect(alCambiar).toHaveBeenCalledWith('Hola');
  });
});

describe('Interruptor', () => {
  it('es un switch accesible que refleja su estado y lo invierte al tocarlo', () => {
    const alCambiar = vi.fn();
    const c = montar(<Interruptor etiqueta="Modo lectura" activo={false} alCambiar={alCambiar} />);
    const boton = c.querySelector('[role="switch"]');
    expect(boton?.getAttribute('aria-checked')).toBe('false');
    expect(boton?.textContent).toContain('Modo lectura');
    act(() => (boton as HTMLElement).click());
    expect(alCambiar).toHaveBeenCalledWith(true);
  });
});

describe('CeldaDia', () => {
  it('anuncia el día, si es hoy y cuántas notas tiene', () => {
    const c = montar(<CeldaDia dia={12} hoy notas={2} />);
    const celda = c.querySelector('button');
    expect(celda?.textContent).toContain('12');
    expect(celda?.getAttribute('aria-current')).toBe('date');
    expect(celda?.getAttribute('aria-label')).toBe('12, hoy, 2 notas');
    expect(c.querySelectorAll('.celda-dia__nota')).toHaveLength(2);
  });

  it('muestra como mucho 3 marcas aunque haya más notas', () => {
    const c = montar(<CeldaDia dia={3} notas={7} />);
    expect(c.querySelectorAll('.celda-dia__nota')).toHaveLength(3);
    expect(c.querySelector('button')?.getAttribute('aria-label')).toBe('3, 7 notas');
  });

  it('un día sin notas no lleva marcas y uno de otro mes se atenúa', () => {
    const c = montar(<CeldaDia dia={30} notas={0} fuera />);
    expect(c.querySelectorAll('.celda-dia__nota')).toHaveLength(0);
    expect(c.querySelector('button')?.classList.contains('celda-dia--fuera')).toBe(true);
    expect(c.querySelector('button')?.getAttribute('aria-label')).toBe('30');
  });
});

// ── Stark ─────────────────────────────────────────────────────────────────

function escribirEn(input: HTMLInputElement, texto: string) {
  input.value = texto;
  act(() => {
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
}

function tecla(el: Element, key: string, opciones: KeyboardEventInit = {}) {
  act(() => {
    el.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...opciones }));
  });
}

const botones = (c: HTMLElement) => [...c.querySelectorAll('button')];
const boton = (c: HTMLElement, texto: string) => {
  const b = botones(c).find((x) => x.textContent?.trim() === texto || x.getAttribute('aria-label') === texto);
  if (!b) throw new Error(`sin botón «${texto}»`);
  return b;
};

describe('Boton (variantes nuevas)', () => {
  it('la principal es una píldora primaria con icono y puede ocupar todo el ancho', () => {
    const c = montar(
      <Boton variante="primario" icono="check" ancho>
        Cobrar
      </Boton>,
    );
    const b = c.querySelector('button');
    expect(b?.className).toBe('boton boton--primario boton--ancho');
    expect(b?.querySelector('svg')).not.toBeNull();
  });
});

describe('Chip y ChipFiltro', () => {
  it('el chip seleccionable es un botón conmutador (aria-pressed) con contador', () => {
    const alCambiar = vi.fn();
    const c = montar(
      <Chip seleccionado={false} contador={45} alCambiar={alCambiar}>
        Café
      </Chip>,
    );
    const b = c.querySelector('button');
    expect(b?.getAttribute('aria-pressed')).toBe('false');
    expect(c.querySelector('.chip__contador')?.textContent).toBe('45');
    act(() => b?.click());
    expect(alCambiar).toHaveBeenCalledWith(true);
  });

  it('el filtro activo se anuncia como «Quitar filtro» y avisa al tocarlo', () => {
    const alQuitar = vi.fn();
    const c = montar(<ChipFiltro alQuitar={alQuitar}>Cervezas</ChipFiltro>);
    const b = c.querySelector('button');
    expect(b?.getAttribute('aria-label')).toBe('Quitar filtro: Cervezas');
    act(() => b?.click());
    expect(alQuitar).toHaveBeenCalledOnce();
  });
});

describe('Casilla', () => {
  it('es un checkbox nativo dentro de su etiqueta, con contador', () => {
    const alCambiar = vi.fn();
    const c = montar(<Casilla etiqueta="Cervezas" contador={24} marcada={false} alCambiar={alCambiar} />);
    const input = c.querySelector('input');
    expect(input?.type).toBe('checkbox');
    expect(input?.closest('label')?.textContent).toBe('Cervezas (24)');
    act(() => input?.click());
    expect(alCambiar).toHaveBeenCalledWith(true);
  });

  it('puede quedar indeterminada', () => {
    const c = montar(<Casilla etiqueta="Todas" indeterminada marcada={false} alCambiar={() => undefined} />);
    expect(c.querySelector('input')?.indeterminate).toBe(true);
  });
});

describe('Rango', () => {
  it('tiene dos manijas con nombre y no deja que el mínimo pase al máximo', () => {
    const alCambiar = vi.fn();
    const c = montar(<Rango etiqueta="Precio" min={0} max={100} valorMin={10} valorMax={60} alCambiar={alCambiar} />);
    const manijas = [...c.querySelectorAll<HTMLInputElement>('input[type="range"]')];
    expect(manijas.map((m) => m.getAttribute('aria-label'))).toEqual(['Precio: mínimo', 'Precio: máximo']);
    expect(c.querySelector('legend')?.textContent).toBe('Precio');
    escribirEn(manijas[0] as HTMLInputElement, '80');
    expect(alCambiar).toHaveBeenLastCalledWith(60, 60);
  });

  it('los campos numéricos confirman al salir y limitan al rango', () => {
    const alCambiar = vi.fn();
    const c = montar(<Rango etiqueta="Precio" min={0} max={100} valorMin={10} valorMax={60} alCambiar={alCambiar} />);
    const [minimo] = [...c.querySelectorAll<HTMLInputElement>('input[inputmode="numeric"]')];
    if (!minimo) throw new Error('sin campo');
    escribirEn(minimo, '25');
    act(() => {
      minimo.dispatchEvent(new FocusEvent('blur'));
    });
    expect(alCambiar).toHaveBeenLastCalledWith(25, 60);
  });
});

describe('MuestraColor', () => {
  const opciones = [
    { valor: 'a', nombre: 'Negro', color: 'oscuro' },
    { valor: 'b', nombre: 'Azul', color: 'cielo' },
    { valor: 'c', nombre: 'Rojo', color: 'coral' },
  ] as const;

  it('es un grupo de radio con nombres visibles y una sola parada de tabulador', () => {
    const c = montar(<MuestraColor etiqueta="Color" opciones={opciones} valor="b" alCambiar={() => undefined} />);
    expect(c.querySelector('[role="radiogroup"]')?.getAttribute('aria-label')).toBe('Color');
    const radios = [...c.querySelectorAll('[role="radio"]')];
    expect(radios.map((r) => r.textContent)).toEqual(['Negro', 'Azul', 'Rojo']);
    expect(radios.map((r) => r.getAttribute('aria-checked'))).toEqual(['false', 'true', 'false']);
    expect(radios.map((r) => r.getAttribute('tabindex'))).toEqual(['-1', '0', '-1']);
  });

  it('las flechas eligen el siguiente (y dan la vuelta)', () => {
    const alCambiar = vi.fn();
    const c = montar(<MuestraColor etiqueta="Color" opciones={opciones} valor="c" alCambiar={alCambiar} />);
    tecla(c.querySelectorAll('[role="radio"]')[2] as Element, 'ArrowRight');
    expect(alCambiar).toHaveBeenCalledWith('a');
  });
});

describe('Insignia, Cifra y TarjetaProducto', () => {
  it('la insignia usa el tono semántico o el de categoría', () => {
    const c = montar(
      <div>
        <Insignia tono="peligro">Agotado</Insignia>
        <Insignia tono="fucsia">Postres</Insignia>
      </div>,
    );
    const [a, b] = [...c.querySelectorAll('.insignia')];
    expect(a?.classList.contains('insignia--peligro')).toBe(true);
    expect(b?.classList.contains('cat-fucsia')).toBe(true);
  });

  it('la cifra muestra el valor con cifras tabulares y dice si sube o baja', () => {
    const c = montar(<Cifra etiqueta="Gastos" valor="$ 386.500" variacion="+8 %" tendencia="sube" subirEsBueno={false} />);
    expect(c.querySelector('section')?.getAttribute('aria-label')).toBe('Gastos');
    expect(c.querySelector('.cifra__valor')?.classList.contains('cifras')).toBe(true);
    expect(c.querySelector('.cifra__variacion')?.classList.contains('cifra__variacion--mala')).toBe(true);
    expect(c.querySelector('.cifra__variacion')?.textContent).toBe('sube: +8 %');
  });

  it('la tarjeta de producto abre el detalle y el + es un botón aparte con nombre', () => {
    const alTocar = vi.fn();
    const alAgregar = vi.fn();
    const c = montar(
      <TarjetaProducto nombre="Capuchino" precio="$ 7.000" existencias="6 und" estado="bajo" alTocar={alTocar} alAgregar={alAgregar} enPedido={2} />,
    );
    expect(c.querySelector('h3')?.textContent).toBe('Capuchino');
    expect(c.querySelector('.tarjeta-producto__media')?.textContent).toBe('C');
    expect(c.querySelector('.insignia')?.textContent).toBe('Bajo');
    act(() => boton(c, 'Capuchino').click());
    act(() => boton(c, 'Añadir Capuchino').click());
    expect(alTocar).toHaveBeenCalledOnce();
    expect(alAgregar).toHaveBeenCalledOnce();
    // nada de botones anidados
    expect(c.querySelector('button button')).toBeNull();
  });
});

describe('CampoNumero y Buscador', () => {
  it('el campo numérico entrega el texto tal cual, con teclado decimal y su prefijo', () => {
    const alCambiar = vi.fn();
    const c = montar(<CampoNumero etiqueta="Precio" prefijo="$" valor="" alCambiar={alCambiar} />);
    const input = c.querySelector('input');
    if (!input) throw new Error('sin input');
    expect(input.getAttribute('inputmode')).toBe('decimal');
    expect(c.querySelector('label')?.htmlFor).toBe(input.id);
    expect(c.querySelector('.campo-numero__afijo')?.textContent).toBe('$');
    escribirEn(input, '8.500,5');
    expect(alCambiar).toHaveBeenCalledWith('8.500,5');
  });

  it('un error marca el campo y se anuncia', () => {
    const c = montar(<CampoNumero etiqueta="Cantidad" sufijo="kg" valor="x" error="Cantidad no válida" alCambiar={() => undefined} />);
    const input = c.querySelector('input');
    expect(input?.getAttribute('aria-invalid')).toBe('true');
    expect(c.querySelector('[role="alert"]')?.textContent).toBe('Cantidad no válida');
    expect(input?.getAttribute('aria-describedby')).toContain(c.querySelector('[role="alert"]')?.id);
  });

  it('el buscador vive en un landmark search y se borra con su botón', () => {
    const alCambiar = vi.fn();
    const c = montar(<Buscador etiqueta="Buscar productos" valor="caf" alCambiar={alCambiar} />);
    expect(c.querySelector('[role="search"] input[type="search"]')).not.toBeNull();
    act(() => boton(c, 'Borrar búsqueda').click());
    expect(alCambiar).toHaveBeenCalledWith('');
  });
});

describe('TecladoNumerico', () => {
  it('añade dígitos, no deja ceros a la izquierda y borra el último', () => {
    const alCambiar = vi.fn();
    const c = montar(<TecladoNumerico valor="0" alCambiar={alCambiar} />);
    act(() => boton(c, '7').click());
    expect(alCambiar).toHaveBeenLastCalledWith('7');
    act(() => boton(c, 'Borrar').click());
    expect(alCambiar).toHaveBeenLastCalledWith('');
  });

  it('la tecla extra «000» multiplica y «Cobrar» confirma', () => {
    const alCambiar = vi.fn();
    const alConfirmar = vi.fn();
    const c = montar(<TecladoNumerico valor="12" alCambiar={alCambiar} alConfirmar={alConfirmar} />);
    act(() => boton(c, '000').click());
    expect(alCambiar).toHaveBeenLastCalledWith('12000');
    act(() => boton(c, 'Cobrar').click());
    expect(alConfirmar).toHaveBeenCalledOnce();
  });
});

describe('Dialogo y Hoja', () => {
  it('el diálogo es modal, enfoca «Cancelar» y Escape lo cierra', () => {
    const alCerrar = vi.fn();
    const c = montar(
      <Dialogo titulo="¿Anular?" peligro alConfirmar={() => undefined} alCerrar={alCerrar}>
        Se devuelve al inventario.
      </Dialogo>,
    );
    const caja = c.querySelector('[role="alertdialog"]');
    expect(caja?.getAttribute('aria-modal')).toBe('true');
    expect(document.getElementById(caja?.getAttribute('aria-labelledby') ?? '')?.textContent).toBe('¿Anular?');
    expect(document.activeElement?.textContent).toBe('Cancelar');
    tecla(document.body, 'Escape');
    expect(alCerrar).toHaveBeenCalledOnce();
  });

  it('el foco queda atrapado: Tab desde el último vuelve al primero', () => {
    const c = montar(
      <Dialogo titulo="¿Seguro?" alConfirmar={() => undefined} alCerrar={() => undefined}>
        Texto
      </Dialogo>,
    );
    const confirmar = boton(c, 'Confirmar');
    confirmar.focus();
    tecla(confirmar, 'Tab');
    expect(document.activeElement?.textContent).toBe('Cancelar');
    tecla(document.activeElement as Element, 'Tab', { shiftKey: true });
    expect(document.activeElement).toBe(confirmar);
  });

  it('la hoja tiene título accesible y pie fijo', () => {
    const c = montar(
      <Hoja titulo="Filtros" alCerrar={() => undefined} pie={<button type="button">Aplicar</button>}>
        <p>contenido</p>
      </Hoja>,
    );
    const panel = c.querySelector('[role="dialog"]');
    expect(panel?.getAttribute('aria-label')).toBe('Filtros');
    expect(c.querySelector('.hoja__pie')?.textContent).toBe('Aplicar');
  });
});

describe('Tabla', () => {
  interface Fila {
    id: string;
    nombre: string;
    total: string;
  }
  const columnas = [
    { clave: 'nombre', titulo: 'Producto', principal: true, celda: (f: Fila) => f.nombre },
    { clave: 'total', titulo: 'Total', numerica: true, celda: (f: Fila) => f.total },
  ];

  it('mantiene la semántica de tabla y cada celda sabe su título (para apilarse en compacto)', () => {
    const alTocarFila = vi.fn();
    const c = montar(
      <Tabla titulo="Ventas" columnas={columnas} filas={[{ id: '1', nombre: 'Café', total: '$ 4.500' }]} claveFila={(f) => f.id} alTocarFila={alTocarFila} />,
    );
    expect(c.querySelector('caption')?.textContent).toBe('Ventas');
    expect([...c.querySelectorAll('[role="columnheader"]')].map((t) => t.textContent)).toEqual(['Producto', 'Total']);
    expect([...c.querySelectorAll('td')].map((t) => t.getAttribute('data-titulo'))).toEqual(['Producto', 'Total']);
    expect(c.querySelector('td.tabla__num')?.textContent).toBe('$ 4.500');
    act(() => boton(c, 'Café').click());
    expect(alTocarFila).toHaveBeenCalledOnce();
  });

  it('sin filas muestra el texto de vacía', () => {
    const c = montar(<Tabla titulo="Ventas" columnas={columnas} filas={[]} claveFila={(f) => f.id} vacia="Sin ventas hoy." />);
    expect(c.querySelector('tbody')?.textContent).toBe('Sin ventas hoy.');
  });
});

describe('Pestanas', () => {
  const pestanas = [
    { id: 'hoy', etiqueta: 'Hoy' },
    { id: 'semana', etiqueta: 'Semana' },
    { id: 'mes', etiqueta: 'Mes' },
  ] as const;

  it('es un tablist con el panel ligado a la pestaña actual', () => {
    const c = montar(
      <Pestanas etiqueta="Periodo" pestanas={pestanas} actual="semana" alCambiar={() => undefined}>
        <p>panel</p>
      </Pestanas>,
    );
    const tabs = [...c.querySelectorAll('[role="tab"]')];
    expect(tabs.map((t) => t.getAttribute('aria-selected'))).toEqual(['false', 'true', 'false']);
    const panel = c.querySelector('[role="tabpanel"]');
    expect(panel?.getAttribute('aria-labelledby')).toBe(tabs[1]?.id);
    expect(tabs[1]?.getAttribute('aria-controls')).toBe(panel?.id);
  });

  it('Fin y flecha izquierda mueven la selección', () => {
    const alCambiar = vi.fn();
    const c = montar(<Pestanas etiqueta="Periodo" pestanas={pestanas} actual="hoy" alCambiar={alCambiar} />);
    const [primera] = [...c.querySelectorAll('[role="tab"]')];
    tecla(primera as Element, 'End');
    expect(alCambiar).toHaveBeenLastCalledWith('mes');
    tecla(primera as Element, 'ArrowLeft');
    expect(alCambiar).toHaveBeenLastCalledWith('mes');
  });
});

describe('BotonFlotante, Avatar y BotonUsuario', () => {
  it('el flotante sin texto lleva nombre accesible; extendido lo muestra', () => {
    const c = montar(
      <div>
        <BotonFlotante etiqueta="Nueva venta" alTocar={() => undefined} />
        <BotonFlotante etiqueta="Nuevo producto" extendido fijo={false} alTocar={() => undefined} />
      </div>,
    );
    const [a, b] = botones(c);
    expect(a?.getAttribute('aria-label')).toBe('Nueva venta');
    expect(a?.classList.contains('boton-flotante--fijo')).toBe(true);
    expect(b?.textContent).toBe('Nuevo producto');
    expect(b?.classList.contains('boton-flotante--fijo')).toBe(false);
  });

  it('las iniciales y el color de una persona son estables', () => {
    expect(inicialesDe('Ana María López')).toBe('AM');
    expect(inicialesDe('  ñandú ')).toBe('Ñ');
    expect(categoriaDe('Luis')).toBe(categoriaDe(' luis '));
    expect(CATEGORIAS).toContain(categoriaDe('Luis'));
    const c = montar(<Avatar nombre="Sofía Ríos" />);
    expect(c.querySelector('.avatar')?.textContent).toBe('SR');
    expect(c.querySelector('.avatar')?.getAttribute('aria-hidden')).toBe('true');
  });

  it('el usuario elegible es un botón con nombre y rol', () => {
    const alTocar = vi.fn();
    const c = montar(<BotonUsuario nombre="Luis" rol="Cajero" seleccionado alTocar={alTocar} />);
    const b = c.querySelector('button');
    expect(b?.getAttribute('aria-pressed')).toBe('true');
    expect(b?.textContent).toBe('LLuisCajero');
    act(() => b?.click());
    expect(alTocar).toHaveBeenCalledOnce();
  });
});

describe('TecladoPin', () => {
  it('nunca muestra los dígitos: solo puntos y cuántos van', () => {
    const c = montar(<TecladoPin valor="12" alCambiar={() => undefined} alCompletar={() => undefined} />);
    expect(c.querySelectorAll('.teclado-pin__punto--lleno')).toHaveLength(2);
    expect(c.querySelector('[role="img"]')?.getAttribute('aria-label')).toBe('2 de 4 dígitos');
    expect(c.querySelector('.teclado-pin__puntos')?.textContent).toBe('');
  });

  it('al completar la longitud avisa con el PIN; también con el teclado físico', () => {
    const alCambiar = vi.fn();
    const alCompletar = vi.fn();
    const c = montar(<TecladoPin valor="123" alCambiar={alCambiar} alCompletar={alCompletar} />);
    act(() => boton(c, '4').click());
    expect(alCompletar).toHaveBeenCalledWith('1234');
    tecla(document.body, 'Backspace');
    expect(alCambiar).toHaveBeenLastCalledWith('12');
  });

  it('el error se anuncia', () => {
    const c = montar(<TecladoPin valor="" error="PIN incorrecto" alCambiar={() => undefined} alCompletar={() => undefined} />);
    expect(c.querySelector('[role="alert"]')?.textContent).toBe('PIN incorrecto');
  });
});

describe('Disposicion y Rejilla', () => {
  it('el panel está en un aside y el botón «Filtros (n)» lo abre en una hoja', () => {
    const c = montar(
      <Disposicion activos={3} panel={<p class="filtro-x">Precio</p>}>
        <Rejilla etiqueta="Productos">
          <span>a</span>
        </Rejilla>
      </Disposicion>,
    );
    expect(c.querySelector('aside')?.getAttribute('aria-label')).toBe('Filtros');
    expect(c.querySelector('[role="dialog"]')).toBeNull();
    act(() => boton(c, 'Filtros (3)').click());
    expect(c.querySelector('[role="dialog"] .filtro-x')?.textContent).toBe('Precio');
    expect(c.querySelector('.rejilla')?.getAttribute('aria-label')).toBe('Productos');
  });
});
