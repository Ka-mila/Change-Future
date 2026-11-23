import { useState } from 'react';

// Gráficos del dashboard en SVG/HTML propio (sin librerías).
// Reglas: un solo eje, barras delgadas con punta redondeada, el dato destacado
// en el color de acento y el resto en gris, tooltip al pasar el mouse o con el
// teclado, y siempre una tabla con los valores exactos.

export function formatoCompacto(valor, moneda) {
    const texto = new Intl.NumberFormat('es-CL', { notation: 'compact', maximumFractionDigits: 1 }).format(valor);
    return moneda ? `$${texto}` : texto;
}

function ticksLimpios(maximo) {
    if (maximo <= 0) return [0, 1];
    const paso = 10 ** Math.floor(Math.log10(maximo / 3));
    const opciones = [1, 2, 2.5, 5, 10].map((m) => m * paso);
    const elegido = opciones.find((o) => maximo / o <= 4) || opciones.at(-1);
    const ticks = [];
    for (let v = 0; v < maximo; v += elegido) ticks.push(v);
    ticks.push(ticks.at(-1) + elegido);
    return ticks;
}

/** Columnas verticales. datos: [{ etiqueta, valor, destacado }]. formato(valor, corto) */
export function GraficoColumnas({ datos, formato, titulo }) {
    const [activo, setActivo] = useState(null);
    const ancho = 600;
    const alto = 230;
    const margen = { arriba: 22, derecha: 8, abajo: 28, izquierda: 52 };
    const ticks = ticksLimpios(Math.max(...datos.map((d) => d.valor), 0));
    const maximo = ticks.at(-1);
    const banda = (ancho - margen.izquierda - margen.derecha) / datos.length;
    const grosor = Math.min(24, banda * 0.5);
    const y = (valor) => margen.arriba + (alto - margen.arriba - margen.abajo) * (1 - valor / maximo);
    const base = y(0);

    return (
        <div className="grafico" onPointerLeave={() => setActivo(null)}>
            <svg viewBox={`0 0 ${ancho} ${alto}`} role="img" aria-label={titulo}>
                {ticks.map((t) => (
                    <g key={t}>
                        <line className="grafico-grilla" x1={margen.izquierda} x2={ancho - margen.derecha} y1={y(t)} y2={y(t)} />
                        <text className="grafico-eje" x={margen.izquierda - 8} y={y(t)} dy="0.32em" textAnchor="end">{formato(t, true)}</text>
                    </g>
                ))}
                {datos.map((d, i) => {
                    const x = margen.izquierda + banda * i + (banda - grosor) / 2;
                    const tope = y(d.valor);
                    const radio = Math.min(4, base - tope);
                    // Punta redondeada arriba, recta en la base
                    const camino = d.valor > 0
                        ? `M${x},${base} V${tope + radio} Q${x},${tope} ${x + radio},${tope} H${x + grosor - radio} Q${x + grosor},${tope} ${x + grosor},${tope + radio} V${base} Z`
                        : '';
                    return (
                        <g key={d.etiqueta}>
                            {/* Zona de hover más grande que la barra */}
                            <rect className="grafico-hit" x={margen.izquierda + banda * i} y={margen.arriba} width={banda}
                                height={base - margen.arriba} tabIndex={0} aria-label={`${d.etiqueta}: ${formato(d.valor)}`}
                                onPointerEnter={() => setActivo(i)} onFocus={() => setActivo(i)} onBlur={() => setActivo(null)} />
                            <path d={camino} className={`grafico-barra${d.destacado ? ' destacada' : ''}${activo === i ? ' activa' : ''}`} />
                            {d.destacado && (
                                <text className="grafico-valor" x={x + grosor / 2} y={tope - 7} textAnchor="middle">{formato(d.valor, true)}</text>
                            )}
                            <text className="grafico-eje" x={x + grosor / 2} y={alto - 8} textAnchor="middle">{d.etiqueta}</text>
                        </g>
                    );
                })}
            </svg>
            {activo !== null && (
                <div className="grafico-tooltip" style={{
                    left: `${((margen.izquierda + banda * (activo + 0.5)) / ancho) * 100}%`,
                    top: `${(y(datos[activo].valor) / alto) * 100}%`
                }}>
                    <b>{formato(datos[activo].valor)}</b>
                    <span>{datos[activo].etiqueta}</span>
                </div>
            )}
        </div>
    );
}

/** Barras horizontales ordenadas de mayor a menor. datos: [{ nombre, valor, detalle }] */
export function BarrasRanking({ datos, formato }) {
    const maximo = Math.max(...datos.map((d) => d.valor), 1);
    return (
        <ul className="ranking">
            {datos.map((d) => (
                <li key={d.nombre} tabIndex={0} title={`${d.nombre}: ${formato(d.valor)}${d.detalle ? ` · ${d.detalle}` : ''}`}>
                    <span className="ranking-nombre">{d.nombre}</span>
                    <span className="ranking-pista">
                        <span className="ranking-barra" style={{ width: `${(d.valor / maximo) * 100}%` }} />
                    </span>
                    <span className="ranking-valor">{formato(d.valor, true)}</span>
                </li>
            ))}
        </ul>
    );
}

/** Tabla con los valores exactos de un gráfico (accesibilidad). */
export function TablaDatos({ columnas, filas }) {
    return (
        <details className="tabla-datos">
            <summary>Ver como tabla</summary>
            <table className="tabla">
                <thead><tr>{columnas.map((c, i) => <th key={c} className={i ? 'num' : ''}>{c}</th>)}</tr></thead>
                <tbody>
                    {filas.map((fila) => (
                        <tr key={fila[0]}>{fila.map((celda, i) => <td key={i} className={i ? 'num' : ''}>{celda}</td>)}</tr>
                    ))}
                </tbody>
            </table>
        </details>
    );
}

/** Indicador: valor grande y variación contra el período anterior. */
export function StatTile({ etiqueta, valor, actual, anterior, comparacion, nota }) {
    let delta = null;
    if (anterior !== undefined) {
        if (anterior === 0) {
            delta = actual > 0
                ? { clase: 'sube', texto: `▲ Nuevo ${comparacion}` }
                : { clase: '', texto: `Sin cambios ${comparacion}` };
        } else {
            const cambio = Math.round(((actual - anterior) / anterior) * 100);
            delta = cambio === 0
                ? { clase: '', texto: `= Igual ${comparacion}` }
                : { clase: cambio > 0 ? 'sube' : 'baja', texto: `${cambio > 0 ? '▲' : '▼'} ${Math.abs(cambio)}% ${comparacion}` };
        }
    }
    return (
        <article className="stat-tile">
            <span className="stat-etiqueta">{etiqueta}</span>
            <strong className="stat-valor">{valor}</strong>
            {delta && <span className={`stat-delta ${delta.clase}`}>{delta.texto}</span>}
            {nota && <span className="stat-nota">{nota}</span>}
        </article>
    );
}
