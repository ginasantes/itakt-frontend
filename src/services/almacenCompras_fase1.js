// ================================================================
// FASE 1: NUEVAS FUNCIONES PARA MANEJO DE ESTADOS DE COMPRAS
// Se agregan a almacenCompras.js sin reemplazar funciones existentes
// ================================================================

/**
 * Cambiar estado de compra: Sugerida → Pedida → Recibida → Pagada
 * @param {number} idCompra - ID de la compra
 * @param {string} nuevoEstado - 'pedida', 'recibida', 'pagada'
 * @param {object} datosCambio - Datos adicionales según el estado
 */
export async function cambiarEstadoCompra(idCompra, nuevoEstado, datosCambio = {}) {
  try {
    const payload = {
      estatus: nuevoEstado
    };

    const { data, error } = await supabase
      .from('compras')
      .update(payload)
      .eq('id_compra', idCompra)
      .select()
      .single();

    return { data, error: error?.message || null };
  } catch (err) {
    return { data: null, error: err.message };
  }
}

/**
 * Registrar recepción de compra con detalles
 * @param {number} idCompra - ID de la compra
 * @param {object} daatos - { quien_recibio, fecha, cantidad_recibida, observaciones }
 */
export async function registrarRecepcionCompra(idCompra, datos) {
  try {
    const { data, error } = await supabase
      .from('compras')
      .update({
        estatus: 'recibida'
      })
      .eq('id_compra', idCompra)
      .select()
      .single();

    return { data, error: error?.message || null };
  } catch (err) {
    return { data: null, error: err.message };
  }
}

/**
 * Registrar pago de compra
 * @param {number} idCompra - ID de la compra
 * @param {object} datos - { monto_pagado, fecha_pago }
 */
export async function registrarPagoCompra(idCompra, datos) {
  try {
    const { data, error } = await supabase
      .from('compras')
      .update({
        estatus: 'pagada'
      })
      .eq('id_compra', idCompra)
      .select()
      .single();

    return { data, error: error?.message || null };
  } catch (err) {
    return { data: null, error: err.message };
  }
}

/**
 * Obtener compras filtradas por estado
 * @param {number} businessId - ID del negocio
 * @param {string} estado - 'sugerida', 'pedida', 'recibida', 'pagada', o vacio para todas
 */
export async function obtenerComprasPorEstado(businessId, estado = '') {
  try {
    let query = supabase
      .from('compras')
      .select('*')
      .eq('id_negocio', businessId)
      .order('fecha_compra', { ascending: false });

    if (estado) {
      query = query.eq('estatus', estado);
    }

    const { data, error } = await query;

    return { data: data || [], error: error?.message || null };
  } catch (err) {
    return { data: [], error: err.message };
  }
}

/**
 * Obtener resumen de compras por estado
 * @param {number} businessId - ID del negocio
 */
export async function obtenerResumenCompras(businessId) {
  try {
    const { data, error } = await supabase
      .from('v_compras_por_estado')
      .select('estatus, cantidad, monto_total')
      .eq('id_negocio', businessId);

    if (error) {
      return { data: null, error: error.message };
    }

    // Organizar por estado
    const resumen = {
      sugerida: { cantidad: 0, monto: 0 },
      pedida: { cantidad: 0, monto: 0 },
      recibida: { cantidad: 0, monto: 0 },
      pagada: { cantidad: 0, monto: 0 }
    };

    (data || []).forEach(row => {
      if (resumen[row.estatus]) {
        resumen[row.estatus].cantidad = row.cantidad || 0;
        resumen[row.estatus].monto = row.monto_total || 0;
      }
    });

    return { data: resumen, error: null };
  } catch (err) {
    return { data: null, error: err.message };
  }
}

/**
 * Obtener compras pendientes (no recibidas o no pagadas)
 * @param {number} businessId - ID del negocio
 */
export async function obtenerComprasPendientes(businessId) {
  try {
    const { data, error } = await supabase
      .from('v_compras_pendientes')
      .select('*')
      .eq('id_negocio', businessId);

    return { data: data || [], error: error?.message || null };
  } catch (err) {
    return { data: [], error: err.message };
  }
}

/**
 * Exportar compras con detalle de estados (para Excel)
 * @param {array} compras - Array de compras a exportar
 */
export function exportarComprasConEstados(compras) {
  const rows = [
    ['COMPRAS RESTAURANTE - DETALLE POR ESTADO'],
    [''],
    ['Fecha', 'Proveedor', 'Insumo', 'Cantidad', 'Unidad', 'Precio Unit.', 'Total', 'Estado', 'Fecha Recepción', 'Quien Recibió', 'Observaciones', 'Fecha Pago', 'Monto Pagado'],
    ...compras.map(c => [
      c.fecha_compra_dia || '',
      c.nombre_proveedor || '',
      c.item_nombre || '',
      c.cantidad || '',
      c.unidad_consumo || '',
      c.precio_unitario_compra || '',
      c.monto || '',
      c.estatus || 'sugerida',
      c.fecha_recepcion || '',
      c.quien_recibio || '',
      c.observaciones_recepcion || '',
      c.fecha_pago || '',
      c.monto_pagado || ''
    ])
  ];

  descargarCsv('compras_detalle_estados.csv', rows);
}

// Helper: normalizar texto
function normalizeText(value) {
  return String(value || '').trim();
}

// Helper: convertir a número o null
function toNumberOrNull(value) {
  if (value === '' || value === null || value === undefined) {
    return null;
  }
  const parsed = Number(value);
  return Number.isNaN(parsed) ? null : parsed;
}

// Helper: descargar CSV
function descargarCsv(filename, rows) {
  const content = rows
    .map((row) => row.map((value) => `"${String(value ?? '').replaceAll('"', '""')}"`).join(','))
    .join('\n');

  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
