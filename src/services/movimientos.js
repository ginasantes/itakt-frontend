import { obtenerRecetarioEscandallo } from './recetario';
import { supabase } from './supabaseClient';

function toNumber(value) {
  const parsed = Number(value || 0);
  return Number.isNaN(parsed) ? 0 : parsed;
}

function roundMoney(value) {
  return Number(toNumber(value).toFixed(2));
}

function roundMeasure(value) {
  return Number(toNumber(value).toFixed(3));
}

function formatCurrency(value) {
  return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(toNumber(value));
}

function getPeriodRange(periodo) {
  const now = new Date();
  const end = new Date(now);
  const start = new Date(now);

  if (periodo === 'semana') {
    start.setDate(now.getDate() - 7);
  } else if (periodo === 'mes') {
    start.setMonth(now.getMonth() - 1);
  } else if (periodo === 'anio') {
    start.setFullYear(now.getFullYear() - 1);
  } else {
    start.setFullYear(now.getFullYear() - 5);
  }

  return {
    start: start.toISOString(),
    end: end.toISOString()
  };
}

function resolveDateRange({ fechaInicio, fechaFin, periodo }) {
  if (fechaInicio || fechaFin) {
    return {
      start: fechaInicio ? new Date(`${fechaInicio}T00:00:00`).toISOString() : getPeriodRange(periodo).start,
      end: fechaFin ? new Date(`${fechaFin}T23:59:59`).toISOString() : new Date().toISOString()
    };
  }

  return getPeriodRange(periodo);
}

function getPuntoReorden(stockActual, puntoReorden) {
  const reorder = toNumber(puntoReorden);
  if (reorder > 0) {
    return reorder;
  }

  const stock = toNumber(stockActual);
  return stock <= 0 ? 1 : Number(Math.max(stock * 0.35, 1).toFixed(3));
}

function getSemaforo(stockActual, puntoReorden) {
  const stock = toNumber(stockActual);
  const reorder = getPuntoReorden(stockActual, puntoReorden);

  if (stock <= reorder) {
    return { label: 'Rojo', className: 'rojo' };
  }

  if (stock <= reorder * 1.5) {
    return { label: 'Amarillo', className: 'amarillo' };
  }

  return { label: 'Verde', className: 'verde' };
}

function parseResponsable(observaciones) {
  const text = String(observaciones || '');
  const match = text.match(/Registro por:\s*([^|\]]+)/i);
  return match?.[1]?.trim() || 'Sin responsable capturado';
}

function parseRol(observaciones) {
  const text = String(observaciones || '');
  const match = text.match(/Rol:\s*([^|\]]+)/i);
  return match?.[1]?.trim() || 'Sin rol';
}

function buildRecipeConsumptionEntries({ receta, recetaById, scaleFactor = 1, stack = new Set() }) {
  if (!receta || stack.has(receta.id_recetario)) {
    return [];
  }

  const nextStack = new Set([...stack, receta.id_recetario]);
  const directEntries = (receta.escandallo || [])
    .map((detail) => ({
      id_item: detail.id_item,
      nombre_item: detail.item_nombre || 'Insumo sin nombre',
      unidad_consumo: detail.unidad_consumo || detail.unidad_medida_receta || 'unidad',
      cantidad_consumida: roundMeasure(toNumber(detail.cantidad_base_bruta || detail.cantidad_utilizada) * scaleFactor),
      costo_consumido: roundMoney(toNumber(detail.costo_real) * scaleFactor)
    }))
    .filter((detail) => detail.id_item && detail.cantidad_consumida > 0);

  const linkedEntries = (receta.recetas_relacionadas || []).flatMap((relacion) => {
    const linkedRecipe = recetaById.get(relacion.id_receta_relacionada);
    if (!linkedRecipe || relacion.es_relacion_ciclica) {
      return [];
    }

    return buildRecipeConsumptionEntries({
      receta: linkedRecipe,
      recetaById,
      scaleFactor: scaleFactor * Math.max(toNumber(relacion.cantidad_relacionada), 0.001),
      stack: nextStack
    });
  });

  return [...directEntries, ...linkedEntries];
}

function aggregateConsumption(entries, itemById = new Map()) {
  const consumptionMap = new Map();

  entries.forEach((entry) => {
    const current = consumptionMap.get(entry.id_item) || {
      id_item: entry.id_item,
      nombre_item: entry.nombre_item,
      unidad_consumo: entry.unidad_consumo,
      cantidad_consumida: 0,
      costo_consumido: 0
    };

    consumptionMap.set(entry.id_item, {
      ...current,
      nombre_item: entry.nombre_item || current.nombre_item,
      unidad_consumo: entry.unidad_consumo || current.unidad_consumo,
      cantidad_consumida: roundMeasure(current.cantidad_consumida + toNumber(entry.cantidad_consumida)),
      costo_consumido: roundMoney(current.costo_consumido + toNumber(entry.costo_consumido))
    });
  });

  return Array.from(consumptionMap.values())
    .map((entry) => {
      const catalogItem = itemById.get(entry.id_item);
      return {
        ...entry,
        stock_actual: toNumber(catalogItem?.stock_actual),
        punto_reorden: getPuntoReorden(catalogItem?.stock_actual, catalogItem?.punto_reorden),
        semaforo: getSemaforo(catalogItem?.stock_actual, catalogItem?.punto_reorden)
      };
    })
    .sort((a, b) => b.cantidad_consumida - a.cantidad_consumida);
}

function buildCsv(rows) {
  return rows
    .map((row) =>
      row
        .map((value) => `"${String(value ?? '').replaceAll('"', '""')}"`)
        .join(',')
    )
    .join('\n');
}

export function descargarCsv(filename, rows) {
  const content = buildCsv(rows);
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export function descargarPdfMovimiento({ titulo, resumen, movimientos }) {
  const popup = window.open('', '_blank', 'width=960,height=720');
  if (!popup) {
    return;
  }

  popup.document.write(`
    <html>
      <head>
        <title>${titulo}</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 24px; color: #0f172a; }
          h1 { margin-bottom: 8px; }
          table { width: 100%; border-collapse: collapse; margin-top: 18px; }
          th, td { border: 1px solid #cbd5e1; padding: 8px; text-align: left; font-size: 12px; }
          th { background: #f8fafc; }
          .grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-top: 18px; }
          .card { border: 1px solid #cbd5e1; border-radius: 12px; padding: 12px; }
        </style>
      </head>
      <body>
        <h1>${titulo}</h1>
        <div class="grid">
          ${resumen
            .map(
              (item) => `<div class="card"><strong>${item.title}</strong><div>${item.value}</div><small>${item.detail}</small></div>`
            )
            .join('')}
        </div>
        <table>
          <thead>
            <tr><th>Fecha</th><th>Tipo</th><th>Concepto</th><th>Responsable</th><th>Detalle</th><th>Total</th></tr>
          </thead>
          <tbody>
            ${movimientos
              .map(
                (item) =>
                  `<tr><td>${item.fecha_label}</td><td>${item.tipo}</td><td>${item.concepto}</td><td>${item.responsable}</td><td>${item.detalle}</td><td>${item.total_label}</td></tr>`
              )
              .join('')}
          </tbody>
        </table>
      </body>
    </html>
  `);
  popup.document.close();
  popup.focus();
  popup.print();
}

export async function registrarSalidaRestaurante({ businessId, recetaId, cantidadPlatillos, fechaRegistro } = {}) {
  const safeRecetaId = Number(recetaId);
  const safeCantidadPlatillos = Math.max(Math.trunc(toNumber(cantidadPlatillos)), 1);

  if (!safeRecetaId) {
    return { data: null, error: 'Selecciona una receta para registrar la salida.' };
  }

  const recetarioResult = await obtenerRecetarioEscandallo({ businessId });
  if (recetarioResult.error) {
    return { data: null, error: recetarioResult.error };
  }

  const recetas = recetarioResult.data?.recetas || [];
  const catalogo = recetarioResult.data?.catalogo || [];
  const recetaById = new Map(recetas.map((item) => [item.id_recetario, item]));
  const receta = recetaById.get(safeRecetaId);

  if (!receta) {
    return { data: null, error: 'La receta seleccionada ya no está disponible para este negocio.' };
  }

  const rendimiento = Math.max(toNumber(receta.rendimiento_personas), 1);
  const factor = safeCantidadPlatillos / rendimiento;
  const recetaEscandalloResult = await obtenerRecetarioEscandallo({ businessId });
  const catalogoEscandallo = recetaEscandalloResult.data?.catalogo || [];
  const consumo = aggregateConsumption(
    buildRecipeConsumptionEntries({ receta, recetaById, scaleFactor: factor }),
    new Map(catalogoEscandallo.map((item) => [item.id_insumo ?? item.id_item, item]))
  );

  const fechaReg = fechaRegistro || new Date().toISOString();
  const motivo = `${safeCantidadPlatillos} platillo${safeCantidadPlatillos !== 1 ? 's' : ''} de ${receta.nombre_platillo}`;

  if (!consumo.length) {
    return { data: { nombre_platillo: receta.nombre_platillo, costo_estimado: 0, insumos_afectados: 0 }, error: null };
  }

  const itemIds = consumo.map((item) => item.id_item);
  const { data: catalogoActual, error: catalogoError } = await supabase
    .from('insumos')
    .select('id_insumo, stock_actual')
    .in('id_insumo', itemIds);

  if (catalogoError) {
    return { data: null, error: `No se pudo leer inventario: ${catalogoError.message}` };
  }

  const stockById = new Map((catalogoActual || []).map((item) => [item.id_insumo, item]));
  let costoTotal = 0;

  for (const item of consumo) {
    const stockActual = toNumber(stockById.get(item.id_item)?.stock_actual);
    const nuevoStock = roundMeasure(stockActual - toNumber(item.cantidad_consumida));
    const costoUnit = item.cantidad_consumida > 0
      ? roundMoney(item.costo_consumido / item.cantidad_consumida)
      : 0;
    costoTotal = roundMoney(costoTotal + item.costo_consumido);

    const { data: esData, error: esError } = await supabase
      .from('entradas_salidas')
      .insert({
        id_negocio: businessId,
        id_insumo: item.id_item,
        tipo_operacion: 'salida',
        tipo_detalle: 'uso_receta',
        id_receta: safeRecetaId,
        cantidad: item.cantidad_consumida,
        costo_unitario: costoUnit,
        responsable: 'Registro operativo',
        motivo,
        fecha_registro: fechaReg
      })
      .select('id_mov_inv')
      .single();

    if (esError) {
      return { data: null, error: `Error al registrar salida de ${item.nombre_item}: ${esError.message}` };
    }

    await supabase.from('movimientos').insert({
      id_negocio: businessId,
      id_insumo: item.id_item,
      id_mov_inv: esData?.id_mov_inv || null,
      tipo_movimiento: 'salida_receta',
      cantidad: item.cantidad_consumida,
      costo_total: item.costo_consumido,
      responsable: 'Registro operativo',
      fecha_registro: fechaReg
    });

    const { error: updateError } = await supabase
      .from('insumos')
      .update({ stock_actual: nuevoStock })
      .eq('id_insumo', item.id_item);

    if (updateError) {
      return { data: null, error: `Salida registrada pero no se pudo actualizar ${item.nombre_item}: ${updateError.message}` };
    }
  }

  return {
    data: {
      nombre_platillo: receta.nombre_platillo,
      costo_estimado: costoTotal,
      insumos_afectados: consumo.length
    },
    error: null
  };
}

export async function obtenerMovimientosRestaurante({ businessId, fechaInicio, fechaFin, periodo = 'semana' } = {}) {
  const range = resolveDateRange({ fechaInicio, fechaFin, periodo });

  let catalogoQuery = supabase
    .from('insumos')
    .select('id_insumo, nombre_item, unidad_consumo, stock_actual, punto_reorden, precio_competencia_promedio')
    .order('nombre_item', { ascending: true });
  let proveedoresQuery = supabase
    .from('proveedores')
    .select('id_proveedor, nombre_prov, tipo_proveedor')
    .order('nombre_prov', { ascending: true });
  // compras now split across compras (header) + compras_detalle (lines)
  let comprasQuery = supabase
    .from('compras_detalle')
    .select('id_detalle, id_insumo, cantidad, costo_unitario, compras(id_compra, id_proveedor, fecha_compra, responsable, total_compra)')
    .gte('compras.fecha_compra', range.start)
    .lte('compras.fecha_compra', range.end)
    .not('compras', 'is', null)
    .order('id_detalle', { ascending: false });
  // All exits (salidas) come from entradas_salidas — salidas_restaurante does NOT exist
  let salidasQuery = supabase
    .from('entradas_salidas')
    .select('id_mov_inv, id_insumo, tipo_operacion, tipo_detalle, cantidad, costo_unitario, id_receta, id_evento, motivo, responsable, fecha_registro')
    .eq('tipo_operacion', 'salida')
    .gte('fecha_registro', range.start)
    .lte('fecha_registro', range.end)
    .order('fecha_registro', { ascending: false });
  let recetarioQuery = supabase
    .from('recetario')
    .select('id_recetario, nombre_platillo, tipo_categoria, precio_venta_fijo')
    .order('nombre_platillo', { ascending: true });
  let lotesHistoricosQuery = supabase
    .from('entradas_salidas')
    .select('id_insumo, id_proveedor, costo_unitario, fecha_registro')
    .eq('tipo_operacion', 'entrada')
    .order('fecha_registro', { ascending: false });

  if (businessId) {
    catalogoQuery = catalogoQuery.eq('id_negocio', businessId);
    proveedoresQuery = proveedoresQuery.eq('id_negocio', businessId);
    salidasQuery = salidasQuery.eq('id_negocio', businessId);
    recetarioQuery = recetarioQuery.eq('id_negocio', businessId);

    const { data: catalogoIdsData } = await supabase.from('insumos').select('id_insumo').eq('id_negocio', businessId);
    const itemIds = (catalogoIdsData || []).map((item) => item.id_insumo);
    if (itemIds.length) {
      comprasQuery = comprasQuery.in('id_insumo', itemIds);
      lotesHistoricosQuery = lotesHistoricosQuery.in('id_insumo', itemIds);
    }
  }

  const [catalogoResult, proveedoresResult, comprasResult, salidasResult, recetarioResult, lotesHistoricosResult] =
    await Promise.all([catalogoQuery, proveedoresQuery, comprasQuery, salidasQuery, recetarioQuery, lotesHistoricosQuery]);

  const error =
    catalogoResult.error ||
    proveedoresResult.error ||
    comprasResult.error ||
    salidasResult.error ||
    recetarioResult.error ||
    lotesHistoricosResult.error;

  if (error) {
    return { data: null, error: error.message };
  }

  const catalogo = catalogoResult.data || [];
  const proveedores = proveedoresResult.data || [];
  const comprasDetalle = comprasResult.data || [];
  const salidasEs = salidasResult.data || [];
  const recetarioCatalogo = recetarioResult.data || [];
  const lotesHistoricos = lotesHistoricosResult.data || [];

  const itemById = new Map(catalogo.map((item) => [item.id_insumo, item]));
  const proveedorById = new Map(proveedores.map((item) => [item.id_proveedor, item]));
  const recetaByIdSimple = new Map(recetarioCatalogo.map((r) => [r.id_recetario, r]));

  const TIPO_LABELS = {
    uso_receta: 'Receta',
    uso_evento: 'Evento',
    merma: 'Merma',
    ajuste: 'Ajuste',
    devolucion: 'Devolución',
    salida: 'Salida'
  };

  const movimientosCompras = comprasDetalle.map((item) => {
    const compra = item.compras || {};
    const total = toNumber(item.cantidad) * toNumber(item.costo_unitario);
    return {
      id: `compra-${item.id_detalle}`,
      tipo: 'Entrada',
      fecha: compra.fecha_compra,
      fecha_label: compra.fecha_compra ? new Date(compra.fecha_compra).toLocaleString('es-MX') : '',
      concepto: itemById.get(item.id_insumo)?.nombre_item || 'Compra',
      detalle: `${item.cantidad} ${itemById.get(item.id_insumo)?.unidad_consumo || ''} · ${
        proveedorById.get(compra.id_proveedor)?.nombre_prov || 'Proveedor'
      }`,
      responsable: compra.responsable || 'Sin responsable capturado',
      rol: 'Compras',
      total,
      total_label: new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(total)
    };
  });

  const recetasRegistradasMap = new Map();
  const consumoEntries = [];

  const movimientosSalidas = salidasEs.map((item) => {
    const nombreItem = itemById.get(item.id_insumo)?.nombre_item || 'Insumo';
    const unidad = itemById.get(item.id_insumo)?.unidad_consumo || '';
    const total = roundMoney(toNumber(item.cantidad) * toNumber(item.costo_unitario));
    const tipoLabel = TIPO_LABELS[item.tipo_detalle] || item.tipo_detalle || 'Salida';
    const receta = item.id_receta ? recetaByIdSimple.get(item.id_receta) : null;

    // Aggregate by recipe for recetasRegistradas
    if (item.id_receta) {
      const current = recetasRegistradasMap.get(item.id_receta) || {
        id_recetario: item.id_receta,
        nombre_platillo: receta?.nombre_platillo || `Receta #${item.id_receta}`,
        tipo_categoria: receta?.tipo_categoria || 'Sin tipo',
        total_platillos: 0,
        registros: 0,
        costo_consumo_estimado: 0,
        ultimo_registro: item.fecha_registro
      };
      recetasRegistradasMap.set(item.id_receta, {
        ...current,
        registros: current.registros + 1,
        costo_consumo_estimado: roundMoney(current.costo_consumo_estimado + total),
        ultimo_registro:
          new Date(item.fecha_registro).getTime() > new Date(current.ultimo_registro).getTime()
            ? item.fecha_registro
            : current.ultimo_registro
      });
    }

    // Accumulate ingredient consumption
    if (item.tipo_detalle === 'uso_receta' || item.tipo_detalle === 'uso_evento') {
      consumoEntries.push({
        id_item: item.id_insumo,
        nombre_item: nombreItem,
        unidad_consumo: unidad,
        cantidad_consumida: toNumber(item.cantidad),
        costo_consumido: total
      });
    }

    return {
      id: `salida-${item.id_mov_inv}`,
      tipo: 'Salida',
      fecha: item.fecha_registro,
      fecha_label: new Date(item.fecha_registro).toLocaleString('es-MX'),
      concepto: receta?.nombre_platillo || nombreItem,
      detalle: item.motivo || `${item.cantidad} ${unidad} · ${tipoLabel}`,
      responsable: item.responsable || 'Sin responsable capturado',
      rol: tipoLabel,
      total,
      total_label: formatCurrency(total)
    };
  });

  const recetasRegistradas = Array.from(recetasRegistradasMap.values())
    .map((item) => ({
      ...item,
      ultimo_registro_label: new Date(item.ultimo_registro).toLocaleString('es-MX')
    }))
    .sort((a, b) => new Date(b.ultimo_registro).getTime() - new Date(a.ultimo_registro).getTime());

  const insumosComprometidos = aggregateConsumption(consumoEntries, itemById);

  const movimientos = [...movimientosCompras, ...movimientosSalidas].sort(
    (a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime()
  );

  const alertas = catalogo
    .map((item) => ({
      ...item,
      punto_reorden_interno: getPuntoReorden(item.stock_actual, item.punto_reorden),
      semaforo: getSemaforo(item.stock_actual, item.punto_reorden)
    }))
    .filter((item) => item.semaforo.label !== 'Verde')
    .sort((a, b) => toNumber(a.stock_actual) - toNumber(b.stock_actual));

  const recomendaciones = alertas.slice(0, 8).map((item) => {
    const lotesItem = lotesHistoricos.filter((lote) => lote.id_insumo === item.id_insumo);
    const providerMap = new Map();

    lotesItem.forEach((lote) => {
      const current = providerMap.get(lote.id_proveedor) || { total: 0, count: 0 };
      providerMap.set(lote.id_proveedor, {
        total: current.total + toNumber(lote.costo_unitario),
        count: current.count + 1
      });
    });

    const best = Array.from(providerMap.entries())
      .map(([providerId, value]) => ({
        providerId,
        promedio: roundMoney(value.total / Math.max(value.count, 1))
      }))
      .sort((a, b) => a.promedio - b.promedio)[0];

    return {
      id_item: item.id_insumo,
      nombre_item: item.nombre_item,
      stock_actual: item.stock_actual,
      semaforo: item.semaforo,
      tiene_historial: Boolean(best),
      mejor_proveedor_id: best?.providerId || null,
      mejor_proveedor: best ? proveedorById.get(best.providerId)?.nombre_prov || 'Sin proveedor' : 'Pendiente de historial',
      precio_promedio: best?.promedio || null,
      detalle: best
        ? `Proveedor recomendado: ${proveedorById.get(best.providerId)?.nombre_prov || 'Sin proveedor'} con mejor precio promedio.`
        : 'Comprar manualmente y registrar proveedor para futuras sugerencias.'
    };
  });

  const recetasFrecuentes = recetasRegistradas
    .map((item) => ({
      id_recetario: item.id_recetario,
      nombre_platillo: item.nombre_platillo,
      tipo_categoria: item.tipo_categoria,
      cantidad_platillos: item.total_platillos,
      fecha_registro: item.ultimo_registro
    }))
    .sort((a, b) => toNumber(b.cantidad_platillos) - toNumber(a.cantidad_platillos))
    .slice(0, 5);

  const resumen = {
    entradas: movimientosCompras.length,
    salidas: movimientosSalidas.length,
    platillosRegistrados: recetasRegistradas.reduce((acc, item) => acc + item.registros, 0),
    totalCompras: roundMoney(movimientosCompras.reduce((acc, item) => acc + item.total, 0)),
    totalSalidas: roundMoney(movimientosSalidas.reduce((acc, item) => acc + item.total, 0)),
    alertasUrgentes: alertas.filter((item) => item.semaforo.label === 'Rojo').length,
    itemsCriticos: alertas.length
  };

  const corte = {
    fecha_inicio: range.start,
    fecha_fin: range.end,
    items_bajo_alerta: alertas.length,
    recetas_registradas: movimientosSalidas.length,
    platillos_registrados: resumen.platillosRegistrados,
    compras_periodo: resumen.totalCompras,
    salidas_periodo: resumen.totalSalidas,
    balance_periodo: roundMoney(resumen.totalCompras - resumen.totalSalidas),
    recomendaciones: recomendaciones.slice(0, 5)
  };

  return {
    data: {
      resumen,
      corte,
      movimientos,
      alertas,
      recomendaciones,
      recetasFrecuentes,
      recetasRegistradas,
      insumosComprometidos,
      recetasCatalogo: recetarioCatalogo,
      catalogo
    },
    error: null
  };
}

export async function registrarMerma({ businessId, idInsumo, cantidad, costoUnitario, motivo, responsable } = {}) {
  if (!businessId || !idInsumo || !cantidad) {
    return { data: null, error: 'Selecciona un insumo e ingresa la cantidad para registrar la merma.' };
  }

  const cantidadNum = Math.abs(toNumber(cantidad));
  const costoNum = toNumber(costoUnitario);
  const insumoId = Number(idInsumo);

  const { data: itemData, error: itemError } = await supabase
    .from('insumos')
    .select('id_insumo, nombre_item, stock_actual')
    .eq('id_insumo', insumoId)
    .single();

  if (itemError) return { data: null, error: itemError.message };
  if (!itemData) return { data: null, error: 'Insumo no encontrado.' };

  const stockActual = toNumber(itemData.stock_actual);
  if (cantidadNum > stockActual + 0.001) {
    return { data: null, error: `La merma (${cantidadNum}) supera el stock actual (${roundMeasure(stockActual)}).` };
  }

  const { data: entradaData, error: entradaError } = await supabase
    .from('entradas_salidas')
    .insert({
      id_negocio: businessId,
      id_insumo: insumoId,
      tipo_operacion: 'salida',
      tipo_detalle: 'merma',
      cantidad: cantidadNum,
      costo_unitario: costoNum,
      responsable: responsable || 'Sistema',
      motivo: motivo || 'Merma de inventario',
      fecha_registro: new Date().toISOString()
    })
    .select('id_mov_inv')
    .single();

  if (entradaError) return { data: null, error: entradaError.message };

  await supabase.from('movimientos').insert({
    id_negocio: businessId,
    id_insumo: insumoId,
    id_mov_inv: entradaData?.id_mov_inv || null,
    tipo_movimiento: 'salida_merma',
    cantidad: cantidadNum,
    costo_total: roundMoney(cantidadNum * costoNum),
    responsable: responsable || 'Sistema',
    fecha_registro: new Date().toISOString()
  });

  const nuevoStock = roundMeasure(stockActual - cantidadNum);
  const { error: updateError } = await supabase
    .from('insumos')
    .update({ stock_actual: nuevoStock })
    .eq('id_insumo', insumoId);

  if (updateError) {
    return { data: null, error: `Merma registrada pero no se actualizó el stock: ${updateError.message}` };
  }

  return {
    data: {
      id_mov_inv: entradaData?.id_mov_inv,
      nombre_item: itemData.nombre_item,
      cantidad: cantidadNum,
      stock_nuevo: nuevoStock
    },
    error: null
  };
}

// Tipos de salida válidos para ambos módulos
export const TIPOS_SALIDA = [
  { value: 'uso_receta',     label: 'Uso en receta',         scope: 'restaurante' },
  { value: 'uso_evento',     label: 'Uso en evento',         scope: 'catering' },
  { value: 'merma',          label: 'Merma / Pérdida',       scope: 'ambos' },
  { value: 'prestado',       label: 'Prestado',              scope: 'ambos' },
  { value: 'utilieria',      label: 'Utilería de evento',    scope: 'catering' },
  { value: 'renta_servicio', label: 'Renta de servicio',     scope: 'catering' },
  { value: 'ajuste',         label: 'Ajuste de inventario',  scope: 'ambos' }
];

/**
 * Registra una salida de inventario POR INSUMO directamente.
 * Funciona para restaurante y catering.
 * tipos válidos: uso_receta | uso_evento | merma | prestado | utilieria | renta_servicio | ajuste
 */
export async function registrarSalidaInsumo({
  businessId,
  idInsumo,
  cantidad,
  tipoDetalle = 'uso_receta',
  motivo = '',
  responsable = '',
  costoUnitario,
  idReceta,
  idEvento,
  fechaRegistro,
  itemSnapshot   // { nombre_item, stock_actual, costo_unitario_promedio } — datos ya conocidos del catálogo
} = {}) {
  if (!businessId || !idInsumo || !cantidad) {
    return { data: null, error: 'Selecciona insumo e ingresa la cantidad.' };
  }

  const cantidadNum = Math.abs(toNumber(cantidad));
  if (!cantidadNum) return { data: null, error: 'La cantidad debe ser mayor a cero.' };

  const insumoId = Number(idInsumo);
  const fechaReg = fechaRegistro || new Date().toISOString();

  // Intentar obtener datos del insumo desde Supabase; si no existe (demo/seed pendiente), usar itemSnapshot
  let itemData = null;
  const { data: dbItem, error: itemError } = await supabase
    .from('insumos')
    .select('id_insumo, nombre_item, stock_actual, costo_unitario_promedio')
    .eq('id_insumo', insumoId)
    .eq('id_negocio', businessId)
    .maybeSingle();

  if (itemError) return { data: null, error: itemError.message };

  if (dbItem) {
    itemData = dbItem;
  } else if (itemSnapshot) {
    // Catálogo demo — usar datos pasados directamente sin actualizar stock en DB
    itemData = { id_insumo: insumoId, ...itemSnapshot };
  } else {
    return { data: null, error: 'Insumo no encontrado en la base de datos. Verifica que el seed SQL haya sido ejecutado.' };
  }

  const stockActual = toNumber(itemData.stock_actual);
  if (cantidadNum > stockActual + 0.001) {
    return { data: null, error: `La salida (${cantidadNum}) supera el stock actual (${roundMeasure(stockActual)}).` };
  }

  const costoNum = toNumber(costoUnitario) || toNumber(itemData.costo_unitario_promedio);

  const insertRow = {
    id_negocio: businessId,
    id_insumo: insumoId,
    tipo_operacion: 'salida',
    tipo_detalle: tipoDetalle,
    cantidad: cantidadNum,
    costo_unitario: costoNum,
    responsable: responsable || 'Registro operativo',
    motivo: motivo || tipoDetalle,
    fecha_registro: fechaReg
  };
  if (idReceta) insertRow.id_receta = Number(idReceta);
  if (idEvento) insertRow.id_evento = Number(idEvento);

  const { data: esData, error: esError } = await supabase
    .from('entradas_salidas')
    .insert(insertRow)
    .select('id_mov_inv');

  if (esError) return { data: null, error: esError.message };

  const movInvId = Array.isArray(esData) ? esData[0]?.id_mov_inv : esData?.id_mov_inv;

  await supabase.from('movimientos').insert({
    id_negocio: businessId,
    id_insumo: insumoId,
    id_mov_inv: movInvId || null,
    tipo_movimiento: `salida_${tipoDetalle}`,
    cantidad: cantidadNum,
    costo_total: roundMoney(cantidadNum * costoNum),
    responsable: responsable || 'Registro operativo',
    fecha_registro: fechaReg
  });

  const nuevoStock = roundMeasure(stockActual - cantidadNum);

  // Solo actualizar stock en DB si el item existe en Supabase (no demo)
  if (dbItem) {
    const { error: updateError } = await supabase
      .from('insumos')
      .update({ stock_actual: nuevoStock })
      .eq('id_insumo', insumoId);

    if (updateError) {
      return { data: null, error: `Salida registrada pero no se actualizó el stock: ${updateError.message}` };
    }
  }

  return {
    data: {
      id_mov_inv: movInvId,
      nombre_item: itemData.nombre_item,
      tipo_detalle: tipoDetalle,
      cantidad: cantidadNum,
      stock_nuevo: nuevoStock
    },
    error: null
  };
}

export async function obtenerKardexInsumo({ businessId, idInsumo, fechaInicio, fechaFin, periodo = 'mes' } = {}) {
  if (!businessId || !idInsumo) {
    return { data: null, error: 'Faltan parámetros para obtener el kardex.' };
  }

  const range = resolveDateRange({ fechaInicio, fechaFin, periodo });
  const insumoId = Number(idInsumo);

  // Kardex uses entradas_salidas directly — no salidas_restaurante dependency
  const [itemResult, entradasResult] = await Promise.all([
    supabase
      .from('insumos')
      .select('id_insumo, nombre_item, unidad_consumo, stock_actual, punto_reorden, precio_competencia_promedio')
      .eq('id_insumo', insumoId)
      .single(),
    supabase
      .from('entradas_salidas')
      .select('id_mov_inv, tipo_operacion, tipo_detalle, cantidad, costo_unitario, motivo, responsable, fecha_registro')
      .eq('id_negocio', businessId)
      .eq('id_insumo', insumoId)
      .gte('fecha_registro', range.start)
      .lte('fecha_registro', range.end)
      .order('fecha_registro', { ascending: true })
  ]);

  if (itemResult.error) return { data: null, error: itemResult.error.message };
  if (!itemResult.data) return { data: null, error: 'Insumo no encontrado.' };

  const item = itemResult.data;
  const entradasSalidas = entradasResult.data || [];
  const costoRef = toNumber(item.precio_competencia_promedio) || toNumber(item.costo_unitario_promedio);

  const allRows = [...entradasSalidas].sort(
    (a, b) => new Date(a.fecha_registro).getTime() - new Date(b.fecha_registro).getTime()
  );

  const totalEntradas = allRows
    .filter((r) => r.tipo_operacion === 'entrada')
    .reduce((s, r) => s + toNumber(r.cantidad), 0);
  const totalSalidas = allRows
    .filter((r) => r.tipo_operacion === 'salida')
    .reduce((s, r) => s + toNumber(r.cantidad), 0);
  const stockActual = toNumber(item.stock_actual);
  const stockInicioPeriodo = Math.max(0, stockActual - totalEntradas + totalSalidas);

  const MOV_LABELS = {
    compra: 'COMPRA',
    entrada: 'ENTRADA',
    uso_receta: 'RECETA',
    uso_evento: 'EVENTO',
    merma: 'MERMA',
    salida_merma: 'MERMA',
    prestado: 'PRESTADO',
    utilieria: 'UTILIERIA',
    renta_servicio: 'RENTA',
    ajuste_entrada: 'AJUSTE+',
    ajuste_salida: 'AJUSTE-',
    ajuste: 'AJUSTE',
    devolucion: 'DEVCTE',
    salida: 'SALIDA'
  };

  let balance = stockInicioPeriodo;
  const rows = allRows.map((r, i) => {
    const cantidad = toNumber(r.cantidad);
    const costo = toNumber(r.costo_unitario) || costoRef;
    const esEntrada = r.tipo_operacion === 'entrada';
    const entra = esEntrada ? cantidad : 0;
    const sale = esEntrada ? 0 : cantidad;
    balance = Number((balance + entra - sale).toFixed(3));
    const movLabel =
      MOV_LABELS[r.tipo_detalle] ||
      MOV_LABELS[r.tipo_operacion] ||
      (r.tipo_detalle || r.tipo_operacion || '').toUpperCase();
    return {
      id: r.id_mov_inv || `r-${i}`,
      clave: `${movLabel.charAt(0)}${String(i + 1).padStart(3, '0')}`,
      fecha: r.fecha_registro,
      fecha_label: new Date(r.fecha_registro).toLocaleDateString('es-MX', {
        day: '2-digit',
        month: 'short',
        year: '2-digit'
      }),
      mov: movLabel,
      entra: entra > 0 ? entra : null,
      sale: sale > 0 ? sale : null,
      existencia: balance,
      costo,
      valor_mov: Number((cantidad * costo).toFixed(2)),
      valor_inv: Number((balance * costo).toFixed(2)),
      responsable: r.responsable || '—',
      motivo: r.motivo || '—',
      tipo_operacion: r.tipo_operacion
    };
  });

  const inicioRow = {
    id: 'inicio',
    clave: 'SALDO00',
    fecha: range.start,
    fecha_label: new Date(range.start).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: '2-digit' }),
    mov: 'SALDO INICIAL',
    entra: null,
    sale: null,
    existencia: Number(stockInicioPeriodo.toFixed(3)),
    costo: costoRef,
    valor_mov: 0,
    valor_inv: Number((stockInicioPeriodo * costoRef).toFixed(2)),
    responsable: '—',
    motivo: 'Balance calculado al inicio del periodo',
    tipo_operacion: 'inicio'
  };

  return {
    data: {
      item,
      rows: [inicioRow, ...rows],
      totales: {
        total_entradas: Number(totalEntradas.toFixed(3)),
        total_salidas: Number(totalSalidas.toFixed(3)),
        stock_final: stockActual,
        unidad: item.unidad_consumo || ''
      }
    },
    error: null
  };
}