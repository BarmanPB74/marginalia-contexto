import { useState } from 'preact/hooks';
import { cuadriculaMes, diaDe, diaLargo, nombreMes, type Dia } from '../core/notas/fechas';
import { Boton } from './Boton';
import { CeldaDia } from './CeldaDia';
import { Hoja } from './Hoja';
import { Icono } from './Icono';
import './SelectorFecha.css';

interface Props {
  alElegir: (dia: Dia) => void;
  alCerrar: () => void;
  /** Para pruebas: qué día es hoy */
  hoy?: Dia;
}

/** Selector de fecha propio (F3): el mismo mes dibujado del Calendario, en una hoja inferior. */
export function SelectorFecha({ alElegir, alCerrar, hoy = diaDe(new Date()) }: Props) {
  const [anio0, mes0] = hoy.split('-').map(Number) as [number, number];
  const [mes, setMes] = useState({ anio: anio0, mes: mes0 - 1 });
  const mover = (n: number) =>
    setMes((m) => {
      const f = new Date(m.anio, m.mes + n, 1);
      return { anio: f.getFullYear(), mes: f.getMonth() };
    });
  return (
    <Hoja titulo="Elegir fecha" alCerrar={alCerrar}>
      <div class="selector-fecha__mes">
        <button type="button" class="selector-fecha__flecha" aria-label="Mes anterior" onClick={() => mover(-1)}>
          <Icono nombre="izquierda" />
        </button>
        <p class="selector-fecha__nombre" aria-live="polite">
          {nombreMes(mes.anio, mes.mes)}
        </p>
        <button type="button" class="selector-fecha__flecha" aria-label="Mes siguiente" onClick={() => mover(1)}>
          <Icono nombre="derecha" />
        </button>
      </div>
      <div class="selector-fecha__dias" role="group" aria-label={nombreMes(mes.anio, mes.mes)}>
        {cuadriculaMes(mes.anio, mes.mes).map((c) => (
          <span key={c.dia} title={diaLargo(c.dia)}>
            <CeldaDia dia={c.numero} notas={0} hoy={c.dia === hoy} fuera={c.fuera} alTocar={() => alElegir(c.dia)} />
          </span>
        ))}
      </div>
      <div class="selector-fecha__pie">
        <Boton variante="texto" alTocar={() => alElegir(hoy)}>
          Hoy
        </Boton>
        <Boton variante="texto" alTocar={alCerrar}>
          Cancelar
        </Boton>
      </div>
    </Hoja>
  );
}
