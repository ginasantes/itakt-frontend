import { supabase } from './supabaseClient';
import { obtenerAlmacenCompras } from './almacenCompras';
import { obtenerRecetarioEscandallo } from './recetario';

export const CATERING_EVENT_STATUSES = ['cotizando', 'confirmado', 'operando', 'liquidado'];
export const CATERING_TICKET_STATUSES = ['pendiente', 'en_proceso', 'anticipo_recibido', 'pago_parcial', 'resuelto', 'liquidado', 'incobrable'];
export const CATERING_TICKET_TYPES = ['pago_efectivo', 'pago_transferencia', 'pago_tarjeta', 'servicio', 'cliente_insatisfecho'];
export const CATERING_METODOS_PAGO = ['efectivo', 'transferencia', 'tarjeta'];

const META_MARKER = '\n--meta:';

function normalizeText(value) {
  return String(value || '').trim();
}

function toNumber(value) {
  const parsed = Number(value || 0);
  return Number.isNaN(parsed) ? 0 : parsed;
}

function toNumberOrNull(value) {
  if (value === '' || value === null || value === undefined) {
    return null;
  }

  const parsed = Number(value);
  return Number.isNaN(parsed) ? null : parsed;
}

function roundMoney(value) {
  return Number(toNumber(value).toFixed(2));
}

function formatCurrency(value) {
  return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(toNumber(value));
}

function normalizeIdList(values) {
  return Array.from(
    new Set(
      (Array.isArray(values) ? values : [])
        .map((value) => Number(value))
        .filter((value) => Number.isFinite(value) && value > 0)
    )
  );
}

function sortByDateDesc(items, field) {
  return [...(items || [])].sort((left, right) => new Date(right?.[field] || 0) - new Date(left?.[field] || 0));
}

function sortEventsByDateAsc(items) {
  return [...(items || [])].sort((left, right) => new Date(left?.fecha_evento || 0) - new Date(right?.fecha_evento || 0));
}

function buildCsv(rows) {
  return rows
    .map((row) => row.map((value) => `"${String(value ?? '').replaceAll('"', '""')}"`).join(','))
    .join('\n');
}

export function descargarCsvCatering(filename, rows) {
  const content = buildCsv(rows);
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export function descargarPdfCatering({ titulo, resumen, movimientos }) {
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

function buildMetaTag(meta) {
  const normalized = Object.entries(meta || {}).reduce((acc, [key, value]) => {
    if (value === null || value === undefined || value === '') {
      return acc;
    }

    if (Array.isArray(value)) {
      if (!value.length) {
        return acc;
      }
      acc[key] = value;
      return acc;
    }

    if (typeof value === 'number' && Number.isNaN(value)) {
      return acc;
    }

    acc[key] = value;
    return acc;
  }, {});

  if (!Object.keys(normalized).length) {
    return '';
  }

  return `${META_MARKER}${JSON.stringify(normalized)}`;
}

function parseTaggedText(rawValue) {
  const raw = String(rawValue || '');
  const markerIndex = raw.indexOf(META_MARKER);

  if (markerIndex < 0) {
    return { text: raw.trim(), meta: {} };
  }

  const text = raw.slice(0, markerIndex).trim();
  const metaText = raw.slice(markerIndex + META_MARKER.length).trim();

  try {
    return {
      text,
      meta: JSON.parse(metaText || '{}') || {}
    };
  } catch (error) {
    return { text: raw.trim(), meta: {} };
  }
}

function buildTaggedText(text, meta) {
  return `${normalizeText(text)}${buildMetaTag(meta)}`;
}

function isRentalProviderType(type) {
  const normalized = normalizeText(type).toLowerCase();
  return normalized.includes('renta') || normalized.includes('decoracion') || normalized.includes('ambientacion');
}

function getRecipeSuggestedPrice(recipe) {
  const fixedPrice = toNumber(recipe?.precio_venta_fijo);
  if (fixedPrice > 0) {
    return fixedPrice;
  }

  const cost = toNumber(recipe?.costo_porcion);
  if (cost <= 0) {
    return 0;
  }

  return roundMoney(cost * 1.65);
}

function calculateEstimate({ recipeIds, recipesById, people, agreedPricePerPerson, adjustment }) {
  const selectedRecipes = normalizeIdList(recipeIds)
    .map((recipeId) => recipesById.get(recipeId))
    .filter(Boolean);

  const costPerPerson = roundMoney(selectedRecipes.reduce((acc, recipe) => acc + toNumber(recipe.costo_porcion), 0));
  const suggestedPricePerPerson = roundMoney(
    selectedRecipes.reduce((acc, recipe) => acc + getRecipeSuggestedPrice(recipe), 0)
  );
  const totalPeople = Math.max(toNumber(people), 0);
  const manualAdjustment = roundMoney(adjustment);
  const finalPricePerPerson = roundMoney(agreedPricePerPerson || suggestedPricePerPerson);

  return {
    selectedRecipes,
    costPerPerson,
    suggestedPricePerPerson,
    finalPricePerPerson,
    totalFoodCost: roundMoney(costPerPerson * totalPeople),
    totalEstimated: roundMoney(finalPricePerPerson * totalPeople + manualAdjustment),
    adjustment: manualAdjustment
  };
}

function buildEventMeta(data, recipeIds, estimate) {
  const anticipoPagado = roundMoney(data.anticipo_pagado);
  const saldoPendiente = roundMoney(
    data.saldo_pendiente === '' || data.saldo_pendiente === null || data.saldo_pendiente === undefined
      ? Math.max(estimate.totalEstimated - anticipoPagado, 0)
      : data.saldo_pendiente
  );

  return {
    solicitadoPor: normalizeText(data.solicitado_por),
    lugarEvento: normalizeText(data.lugar_evento),
    direccionEvento: normalizeText(data.direccion_evento),
    referenciaEvento: normalizeText(data.referencia_evento),
    notasEvento: normalizeText(data.notas_evento),
    proveedorIds: normalizeIdList(data.proveedor_ids),
    equipoIds: normalizeIdList(data.equipo_ids),
    recipeIds,
    ajusteManualTotal: roundMoney(data.ajuste_manual_total),
    precioSugeridoPersona: estimate.suggestedPricePerPerson,
    costoEstimadoPersona: estimate.costPerPerson,
    totalEstimado: estimate.totalEstimated,
    totalCostoAlimentos: estimate.totalFoodCost,
    anticipoPagado,
    saldoPendiente,
    fechaAnticipo: normalizeText(data.fecha_anticipo),
    fechaPagoEstimada: normalizeText(data.fecha_pago_estimada),
    momentoLiquidacion: normalizeText(data.momento_liquidacion)
  };
}

function buildTicketMeta(data) {
  return {
    ticketCodigo: normalizeText(data.ticket_codigo),
    responsableTicket: normalizeText(data.responsable_ticket),
    solicitadoPor: normalizeText(data.solicitado_por),
    estatusTicket: normalizeText(data.estatus_ticket) || 'pendiente',
    tipoTicket: normalizeText(data.tipo_ticket) || 'pago_efectivo',
    montoTicket: roundMoney(data.monto_ticket),
    fechaCompromiso: normalizeText(data.fecha_compromiso),
    canalContacto: normalizeText(data.canal_contacto),
    metodoPago: normalizeText(data.metodo_pago),
    datosTarjeta: normalizeText(data.datos_tarjeta)
  };
}

function normalizeEventRow(row, cotizacionesByEvent, recipesById) {
  const parsed = parseTaggedText(row.nombre_evento);
  const eventQuotes = cotizacionesByEvent.get(row.id_evento) || [];
  const metaRecipeIds = normalizeIdList(parsed.meta.recipeIds);
  const recipeIds = metaRecipeIds.length ? metaRecipeIds : normalizeIdList(eventQuotes.map((item) => item.id_recetario));
  const estimate = calculateEstimate({
    recipeIds,
    recipesById,
    people: row.numero_personas,
    agreedPricePerPerson: eventQuotes[0]?.precio_pactado_persona,
    adjustment: parsed.meta.ajusteManualTotal
  });

  return {
    id_evento: row.id_evento,
    id_negocio: row.id_negocio,
    nombre_evento: parsed.text,
    fecha_evento: row.fecha_evento,
    numero_personas: row.numero_personas,
    estatus: (normalizeText(row.estatus) || 'cotizado').toLowerCase(),
    solicitado_por: normalizeText(parsed.meta.solicitadoPor),
    lugar_evento: normalizeText(parsed.meta.lugarEvento),
    direccion_evento: normalizeText(parsed.meta.direccionEvento),
    referencia_evento: normalizeText(parsed.meta.referenciaEvento),
    notas_evento: normalizeText(parsed.meta.notasEvento),
    proveedor_ids: normalizeIdList(parsed.meta.proveedorIds),
    equipo_ids: normalizeIdList(parsed.meta.equipoIds),
    receta_ids: recipeIds,
    ajuste_manual_total: roundMoney(parsed.meta.ajusteManualTotal),
    anticipo_pagado: roundMoney(parsed.meta.anticipoPagado),
    saldo_pendiente: roundMoney(parsed.meta.saldoPendiente),
    fecha_anticipo: normalizeText(parsed.meta.fechaAnticipo),
    fecha_pago_estimada: normalizeText(parsed.meta.fechaPagoEstimada),
    momento_liquidacion: normalizeText(parsed.meta.momentoLiquidacion),
    precio_sugerido_persona: estimate.suggestedPricePerPerson,
    costo_estimado_persona: estimate.costPerPerson,
    total_estimado: estimate.totalEstimated,
    total_costo_alimentos: estimate.totalFoodCost,
    cotizacion_principal_id: eventQuotes[0]?.id_cotizacion || null,
    nombre_cliente: normalizeText(eventQuotes[0]?.nombre_cliente),
    telefono_cliente: normalizeText(eventQuotes[0]?.telefono_cliente),
    correo_cliente: normalizeText(eventQuotes[0]?.correo_cliente),
    precio_pactado_persona: roundMoney(eventQuotes[0]?.precio_pactado_persona),
    recetas_seleccionadas: estimate.selectedRecipes
  };
}

function normalizeCotizacionRow(row, eventById, recipesById) {
  const eventData = eventById.get(row.id_evento) || null;
  const recipeIds = eventData?.receta_ids?.length ? eventData.receta_ids : normalizeIdList([row.id_recetario]);
  const estimate = calculateEstimate({
    recipeIds,
    recipesById,
    people: eventData?.numero_personas,
    agreedPricePerPerson: row.precio_pactado_persona,
    adjustment: eventData?.ajuste_manual_total
  });

  return {
    id_cotizacion: row.id_cotizacion,
    id_evento: row.id_evento,
    id_recetario: row.id_recetario,
    nombre_cliente: normalizeText(row.nombre_cliente),
    telefono_cliente: normalizeText(row.telefono_cliente),
    correo_cliente: normalizeText(row.correo_cliente),
    fecha_cotizacion: row.fecha_cotizacion,
    precio_pactado_persona: roundMoney(row.precio_pactado_persona),
    nombre_evento: eventData?.nombre_evento || 'Evento sin nombre',
    fecha_evento: eventData?.fecha_evento || null,
    numero_personas: eventData?.numero_personas || 0,
    estatus_evento: eventData?.estatus || 'cotizado',
    solicitado_por: eventData?.solicitado_por || '',
    lugar_evento: eventData?.lugar_evento || '',
    direccion_evento: eventData?.direccion_evento || '',
    referencia_evento: eventData?.referencia_evento || '',
    notas_evento: eventData?.notas_evento || '',
    proveedor_ids: eventData?.proveedor_ids || [],
    equipo_ids: eventData?.equipo_ids || [],
    receta_ids: recipeIds,
    recetas_seleccionadas: estimate.selectedRecipes,
    precio_sugerido_persona: estimate.suggestedPricePerPerson,
    costo_estimado_persona: estimate.costPerPerson,
    total_estimado: estimate.totalEstimated,
    total_costo_alimentos: estimate.totalFoodCost,
    ajuste_manual_total: eventData?.ajuste_manual_total || '',
    anticipo_pagado: eventData?.anticipo_pagado || 0,
    saldo_pendiente: eventData?.saldo_pendiente || 0,
    fecha_anticipo: eventData?.fecha_anticipo || '',
    fecha_pago_estimada: eventData?.fecha_pago_estimada || '',
    momento_liquidacion: eventData?.momento_liquidacion || '',
    receta_principal_nombre: recipesById.get(Number(row.id_recetario || 0))?.nombre_platillo || 'Sin receta principal'
  };
}

function normalizeSalidaRow(row, eventById) {
  const parsed = parseTaggedText(row.observaciones);
  const eventData = eventById.get(row.id_evento) || null;

  return {
    id_ticket: row.id_ticket,
    id_evento: row.id_evento,
    monto_ticket: roundMoney(row.monto_ticket || 0),
    tipo_pago: normalizeText(row.tipo_pago) || 'efectivo',
    responsable: normalizeText(row.responsable),
    estatus_ticket: normalizeText(row.estatus_ticket) || 'pendiente',
    observaciones: parsed.text,
    fecha_registro: row.fecha_registro,
    evento_nombre: eventData?.nombre_evento || 'Sin evento',
    fecha_evento: eventData?.fecha_evento || null
  };
}

export async function guardarBundleEventoCotizacion({ businessId, eventId, quoteId, data, defaultStatus = 'cotizado' } = {}) {
  const recipeIds = normalizeIdList(data.receta_ids);
  const providerIds = normalizeIdList(data.proveedor_ids);
  const equipmentIds = normalizeIdList(data.equipo_ids);
  
  const recetarioResult = await obtenerRecetarioEscandallo({ businessId });
  if (recetarioResult.error) {
    return { data: null, error: recetarioResult.error };
  }

  const recipesById = new Map((recetarioResult.data?.recetas || []).map((item) => [item.id_recetario, item]));
  const estimate = calculateEstimate({
    recipeIds,
    recipesById,
    people: data.numero_personas,
    agreedPricePerPerson: data.precio_pactado_persona,
    adjustment: data.ajuste_manual_total
  });

  // 1. Create or update cotizacion first
  const cotizacionPayload = {
    id_negocio: businessId,
    nombre_cliente: normalizeText(data.nombre_cliente),
    telefono_cliente: normalizeText(data.telefono_cliente),
    correo_cliente: normalizeText(data.correo_cliente),
    numero_personas: Number(data.numero_personas || 0),
    tipo_evento: normalizeText(data.tipo_evento),
    total_estimado: roundMoney(data.total_estimado || estimate.totalEstimate),
    estatus: normalizeText(data.estatus_evento) || 'cotizando',
    fecha_cotizacion: data.fecha_cotizacion || new Date().toISOString(),
    receta_ids: recipeIds,
    proveedor_ids: providerIds,
    equipo_ids: equipmentIds,
    // 8 new fields for request and event details
    solicitado_por: normalizeText(data.solicitado_por),
    lugar_evento: normalizeText(data.lugar_evento),
    direccion_evento: normalizeText(data.direccion_evento),
    referencia_evento: normalizeText(data.referencia_evento),
    fecha_anticipo: data.fecha_anticipo || null,
    fecha_pago_estimada: data.fecha_pago_estimada || null,
    momento_liquidacion: normalizeText(data.momento_liquidacion),
    notas_evento: normalizeText(data.notas_evento)
  };

  let cotizacionId = quoteId;
  let quoteResponse = null;

  if (quoteId) {
    const { data: updatedQuote, error: quoteError } = await supabase
      .from('catering_cotizaciones')
      .update(cotizacionPayload)
      .eq('id_cotizacion', quoteId)
      .select()
      .single();

    if (quoteError) {
      return { data: null, error: quoteError.message };
    }

    quoteResponse = updatedQuote;
  } else if (cotizacionPayload.nombre_cliente || cotizacionPayload.numero_personas) {
    const { data: insertedQuote, error: quoteError } = await supabase
      .from('catering_cotizaciones')
      .insert(cotizacionPayload)
      .select()
      .single();

    if (quoteError) {
      return { data: null, error: quoteError.message };
    }

    quoteResponse = insertedQuote;
    cotizacionId = insertedQuote.id_cotizacion;
  }

  // 2. Create or update evento with cotizacion FK
  const eventPayload = {
    id_negocio: businessId,
    id_cotizacion: cotizacionId,
    nombre_evento: normalizeText(data.nombre_evento),
    nombre_cliente: normalizeText(data.nombre_cliente),
    telefono_cliente: normalizeText(data.telefono_cliente),
    correo_cliente: normalizeText(data.correo_cliente),
    fecha_evento: data.fecha_evento || null,
    numero_personas: Number(data.numero_personas || 0),
    total_estimado: roundMoney(data.total_estimado || estimate.totalEstimate),
    anticipo_pagado: roundMoney(data.anticipo_pagado || 0),
    saldo_pendiente: roundMoney((data.total_estimado || estimate.totalEstimate) - (data.anticipo_pagado || 0)),
    estatus: normalizeText(data.estatus_evento) || defaultStatus,
    solicitado_por: normalizeText(data.solicitado_por),
    lugar_evento: normalizeText(data.lugar_evento),
    direccion_evento: normalizeText(data.direccion_evento),
    referencia_evento: normalizeText(data.referencia_evento),
    fecha_anticipo: data.fecha_anticipo || null,
    fecha_pago_estimada: data.fecha_pago_estimada || null,
    momento_liquidacion: normalizeText(data.momento_liquidacion),
    notas_evento: normalizeText(data.notas_evento),
    receta_ids: recipeIds,
    proveedor_ids: providerIds,
    equipo_ids: equipmentIds
  };

  const eventQuery = eventId
    ? supabase.from('catering_eventos').update(eventPayload).eq('id_evento', eventId).select().single()
    : supabase.from('catering_eventos').insert(eventPayload).select().single();

  const { data: eventResponse, error: eventError } = await eventQuery;
  if (eventError) {
    return { data: null, error: eventError.message };
  }

  // 3. Create or update automatic ticket when status is "confirmado" or higher
  const createdEventId = eventResponse.id_evento;
  if (createdEventId && (normalizeText(data.estatus_evento) === 'confirmado' || normalizeText(data.estatus_evento) === 'operando' || normalizeText(data.estatus_evento) === 'liquidado')) {
    // Find existing ticket for this event
    const { data: existingTicket } = await supabase
      .from('catering_tickets')
      .select('id_ticket')
      .eq('id_evento', createdEventId)
      .maybeSingle();

    // Build ticket data with client information
    const ticketData = {
      id_negocio: businessId,
      id_evento: createdEventId,
      monto_ticket: roundMoney(data.total_estimado || estimate.totalEstimate),
      tipo_pago: 'cotizacion',
      responsable: normalizeText(data.nombre_cliente),
      estatus_ticket: normalizeText(data.estatus_evento) === 'confirmado' ? 'confirmado' : 
                       normalizeText(data.estatus_evento) === 'operando' ? 'operando' : 'liquidado',
      // Store all client data in observations with tagged format
      observaciones: buildTaggedText(
        `Cliente: ${normalizeText(data.nombre_cliente)} | Tel: ${normalizeText(data.telefono_cliente || '')} | Correo: ${normalizeText(data.correo_cliente || '')} | Lugar: ${normalizeText(data.lugar_evento || '')} | Dirección: ${normalizeText(data.direccion_evento || '')}`,
        {
          clienteName: normalizeText(data.nombre_cliente),
          clientePhone: normalizeText(data.telefono_cliente || ''),
          clienteEmail: normalizeText(data.correo_cliente || ''),
          lugarEvento: normalizeText(data.lugar_evento || ''),
          direccionEvento: normalizeText(data.direccion_evento || ''),
          referencia: normalizeText(data.referencia_evento || ''),
          fechaEvento: data.fecha_evento || '',
          personasEvento: Number(data.numero_personas || 0),
          solicitadoPor: normalizeText(data.solicitado_por || '')
        }
      )
    };

    if (existingTicket?.id_ticket) {
      // Update existing ticket
      await supabase
        .from('catering_tickets')
        .update(ticketData)
        .eq('id_ticket', existingTicket.id_ticket);
    } else {
      // Create new ticket
      await supabase
        .from('catering_tickets')
        .insert(ticketData);
    }
  }

  return {
    data: {
      id_evento: eventResponse.id_evento,
      id_cotizacion: cotizacionId || null
    },
    error: null
  };
}

export async function obtenerOperacionCatering({ businessId } = {}) {
  const [eventosResult, cotizacionesResult, ticketsResult, movimientosResult, recetarioResult, almacenResult, proveedoresResult] = await Promise.all([
    // Obtener eventos del negocio
    businessId
      ? supabase
          .from('catering_eventos')
          .select('id_evento, id_negocio, id_cotizacion, nombre_evento, nombre_cliente, fecha_evento, numero_personas, total_estimado, anticipo_pagado, saldo_pendiente, estatus, solicitado_por, lugar_evento, direccion_evento, referencia_evento, fecha_anticipo, fecha_pago_estimada, momento_liquidacion, notas_evento')
          .eq('id_negocio', businessId)
          .order('fecha_evento', { ascending: false })
      : supabase
          .from('catering_eventos')
          .select('id_evento, id_negocio, id_cotizacion, nombre_evento, nombre_cliente, fecha_evento, numero_personas, total_estimado, anticipo_pagado, saldo_pendiente, estatus, solicitado_por, lugar_evento, direccion_evento, referencia_evento, fecha_anticipo, fecha_pago_estimada, momento_liquidacion, notas_evento')
          .order('fecha_evento', { ascending: false }),
    
    // Obtener cotizaciones del negocio
    businessId
      ? supabase
          .from('catering_cotizaciones')
          .select('id_cotizacion, id_negocio, nombre_cliente, telefono_cliente, correo_cliente, numero_personas, tipo_evento, total_estimado, estatus, fecha_cotizacion, solicitado_por, lugar_evento, direccion_evento, referencia_evento, fecha_anticipo, fecha_pago_estimada, momento_liquidacion, notas_evento')
          .eq('id_negocio', businessId)
          .order('fecha_cotizacion', { ascending: false })
      : supabase
          .from('catering_cotizaciones')
          .select('id_cotizacion, id_negocio, nombre_cliente, telefono_cliente, correo_cliente, numero_personas, tipo_evento, total_estimado, estatus, fecha_cotizacion, solicitado_por, lugar_evento, direccion_evento, referencia_evento, fecha_anticipo, fecha_pago_estimada, momento_liquidacion, notas_evento')
          .order('fecha_cotizacion', { ascending: false }),
    
    // Obtener tickets del negocio
    businessId
      ? supabase
          .from('catering_tickets')
          .select('id_ticket, id_negocio, id_evento, monto_ticket, tipo_pago, responsable, estatus_ticket, observaciones, fecha_registro')
          .eq('id_negocio', businessId)
          .order('id_ticket', { ascending: false })
      : supabase
          .from('catering_tickets')
          .select('id_ticket, id_negocio, id_evento, monto_ticket, tipo_pago, responsable, estatus_ticket, observaciones, fecha_registro')
          .order('id_ticket', { ascending: false }),
    
    // Obtener movimientos de insumos del negocio
    businessId
      ? supabase
          .from('entradas_salidas')
          .select('id_mov_inv, id_negocio, id_insumo, tipo_operacion, tipo_detalle, cantidad, costo_unitario, id_evento, responsable, motivo, fecha_registro, insumos(nombre_item, unidad_consumo)')
          .eq('id_negocio', businessId)
          .order('fecha_registro', { ascending: false })
      : supabase
          .from('entradas_salidas')
          .select('id_mov_inv, id_negocio, id_insumo, tipo_operacion, tipo_detalle, cantidad, costo_unitario, id_evento, responsable, motivo, fecha_registro, insumos(nombre_item, unidad_consumo)')
          .order('fecha_registro', { ascending: false }),
    
    obtenerRecetarioEscandallo({ businessId }),
    obtenerAlmacenCompras({ businessId }),
    
    // Obtener proveedores de servicio del negocio
    businessId
      ? supabase.from('proveedores').select('id_proveedor, id_negocio, nombre_prov, tipo_proveedor, telefono_prov, correo_prov, activo').eq('id_negocio', businessId)
      : supabase.from('proveedores').select('id_proveedor, id_negocio, nombre_prov, tipo_proveedor, telefono_prov, correo_prov, activo')
  ]);

  if (eventosResult.error) {
    return { data: null, error: eventosResult.error.message };
  }
  if (cotizacionesResult.error) {
    return { data: null, error: cotizacionesResult.error.message };
  }
  if (ticketsResult.error) {
    return { data: null, error: ticketsResult.error.message };
  }
  if (movimientosResult.error) {
    return { data: null, error: movimientosResult.error.message };
  }
  if (recetarioResult.error) {
    return { data: null, error: recetarioResult.error };
  }
  if (almacenResult.error) {
    return { data: null, error: almacenResult.error };
  }
  if (proveedoresResult.error) {
    console.warn('Error cargando proveedores:', proveedoresResult.error);
    // No es fatal, continuamos sin proveedores
  }

  const eventosBase = eventosResult.data || [];
  const cotizacionesBase = cotizacionesResult.data || [];
  const ticketsBase = ticketsResult.data || [];
  const movimientosBase = movimientosResult.data || [];
  const recipes = recetarioResult.data?.recetas || [];
  const recipesById = new Map(recipes.map((item) => [item.id_recetario, item]));

  // Mapear cotizaciones por id_negocio
  const cotizacionesPorNegocio = cotizacionesBase.reduce((acc, item) => {
    const key = item.id_negocio;
    if (!acc.get(key)) acc.set(key, []);
    acc.get(key).push(item);
    return acc;
  }, new Map());

  // Mapear tickets por id_evento
  const ticketsPorEvento = ticketsBase.reduce((acc, item) => {
    const key = item.id_evento;
    if (!acc.get(key)) acc.set(key, []);
    acc.get(key).push(item);
    return acc;
  }, new Map());

  const eventos = sortEventsByDateAsc(
    eventosBase.map((row) => ({
      id_evento: row.id_evento,
      id_negocio: row.id_negocio,
      id_cotizacion: row.id_cotizacion,
      nombre_evento: row.nombre_evento,
      nombre_cliente: row.nombre_cliente,
      fecha_evento: row.fecha_evento,
      numero_personas: row.numero_personas,
      total_estimado: toNumber(row.total_estimado),
      anticipo_pagado: toNumber(row.anticipo_pagado),
      saldo_pendiente: toNumber(row.saldo_pendiente),
      estatus: row.estatus,
      solicitado_por: row.solicitado_por || '',
      lugar_evento: row.lugar_evento || '',
      direccion_evento: row.direccion_evento || '',
      referencia_evento: row.referencia_evento || '',
      fecha_anticipo: row.fecha_anticipo || '',
      fecha_pago_estimada: row.fecha_pago_estimada || '',
      momento_liquidacion: row.momento_liquidacion || '',
      notas_evento: row.notas_evento || ''
    }))
  );

  const cotizaciones = sortByDateDesc(
    cotizacionesBase.map((row) => ({
      id_cotizacion: row.id_cotizacion,
      id_negocio: row.id_negocio,
      nombre_cliente: row.nombre_cliente,
      telefono_cliente: row.telefono_cliente,
      correo_cliente: row.correo_cliente,
      numero_personas: toNumber(row.numero_personas),
      tipo_evento: row.tipo_evento,
      total_estimado: toNumber(row.total_estimado),
      estatus: row.estatus,
      fecha_cotizacion: row.fecha_cotizacion,
      solicitado_por: row.solicitado_por || '',
      lugar_evento: row.lugar_evento || '',
      direccion_evento: row.direccion_evento || '',
      referencia_evento: row.referencia_evento || '',
      fecha_anticipo: row.fecha_anticipo || '',
      fecha_pago_estimada: row.fecha_pago_estimada || '',
      momento_liquidacion: row.momento_liquidacion || '',
      notas_evento: row.notas_evento || ''
    })),
    'fecha_cotizacion'
  );

  const tickets = sortByDateDesc(
    ticketsBase.map((row) => ({
      id_ticket: row.id_ticket,
      id_negocio: row.id_negocio,
      id_evento: row.id_evento,
      monto_ticket: toNumber(row.monto_ticket),
      tipo_pago: row.tipo_pago,
      responsable: row.responsable,
      estatus_ticket: row.estatus_ticket,
      observaciones: row.observaciones,
      fecha_registro: row.fecha_registro
    })),
    'fecha_registro'
  );

  const movimientos = sortByDateDesc(
    movimientosBase.map((row) => ({
      id_mov_inv: row.id_mov_inv,
      id_negocio: row.id_negocio,
      id_insumo: row.id_insumo,
      tipo_operacion: row.tipo_operacion,
      tipo_detalle: row.tipo_detalle,
      cantidad: toNumber(row.cantidad),
      costo_unitario: toNumber(row.costo_unitario),
      id_evento: row.id_evento,
      responsable: row.responsable,
      motivo: row.motivo,
      fecha_registro: row.fecha_registro,
      nombre_item: row.insumos?.nombre_item || '',
      unidad_consumo: row.insumos?.unidad_consumo || ''
    })),
    'fecha_registro'
  );

  const resumen = {
    cotizaciones: cotizaciones.length,
    eventos: eventos.length,
    tickets: tickets.length,
    movimientos: movimientos.length,
    cotizados: cotizaciones.filter((c) => c.estatus === 'cotizado').length,
    confirmados: eventos.filter((e) => e.estatus === 'confirmado').length,
    eventosOperando: eventos.filter((e) => e.estatus === 'operando').length,
    liquidados: eventos.filter((e) => e.estatus === 'liquidado').length,
    porPagar: eventos.filter((e) => e.saldo_pendiente > 0).length,
    insumos: almacenResult.data?.resumen?.totalItems || 0,
    proveedores: almacenResult.data?.resumen?.proveedores || 0
  };

  // Construir catalogos desde almacen, supabase y recetario
  const almacenInsumos = almacenResult.data?.catalogo || [];
  const almacenProveedores = almacenResult.data?.proveedores || [];
  
  // Obtener equipos del almacen (que ya filtra por inactivos en localStorage)
  const almacenEquipos = almacenResult.data?.equipos || [];
  
  // Los equipos van en almacenEquipos, no es necesario convertir de insumos
  // Obtener equipos reales del catálogo de almacenCompras (grupo === 'equipos') como fallback
  const equiposSupabase = almacenEquipos.length > 0 
    ? almacenEquipos 
    : (almacenResult?.data?.catalogo || [])
      .filter(item => item.grupo === 'equipos')
      .map(item => ({
        id_equipo: item.id_insumo,
        id_negocio: item.id_negocio,
        nombre_equipo: item.nombre_item,
        precio_unitario: item.costo_unitario_promedio || 0,
        unidad_medida: item.unidad_consumo,
        descripcion: '',
        activo: item.activo !== false ? true : false
      }));
  const proveedoresSupabase = proveedoresResult.data || [];
  
  // Convertir equipos a formato compatible para cotizaciones
  const equiposComoProveedores = equiposSupabase.map(eq => ({
    id_proveedor: `eq_${eq.id_equipo || eq.id_insumo}`,
    id_equipo: eq.id_equipo || eq.id_insumo,
    nombre_prov: eq.nombre_equipo || eq.nombre_item,
    tipo_proveedor: 'equipo',
    precio_unitario: eq.precio_unitario || eq.costo_unitario_promedio || 0,
    unidad_medida: eq.unidad_medida || eq.unidad_consumo,
    descripcion: eq.descripcion || '',
    activo: eq.activo !== false ? true : false
  }));
  
  // Convertir proveedores de Supabase al formato compatible
  const proveedoresFormateados = proveedoresSupabase.map(prov => ({
    id_proveedor: `prov_${prov.id_proveedor}`, // Prefijo para distinguir de equipos
    id_proveedor_original: prov.id_proveedor, // Mantener ID original
    nombre_prov: prov.nombre_prov,
    tipo_proveedor: prov.tipo_proveedor || 'servicio',
    precio_unitario: 0, // Los proveedores típicamente no tienen precio fijo
    unidad_medida: '',
    descripcion: prov.telefono_prov || '',
    activo: prov.activo
  }));
  
  // Combinar todos los proveedores
  const todosLosProveedores = [
    ...almacenProveedores,
    ...equiposComoProveedores,
    ...proveedoresFormateados
  ];
  
  // Combinar TODOS los proveedores (incluyendo equipos para usarlos en otros filtros)
  // Pero separados para no duplicar en las secciones de UI
  const todosLosProveedoresParaOperacion = [
    ...almacenProveedores,
    ...proveedoresFormateados
  ];
  
  const todosLosProveedoresParaRenta = [
    ...almacenProveedores,
    ...proveedoresFormateados
  ];
  
  // Proveedores de operación: para cocina, abarrotes, catering, y proveedores de apoyo
  const proveedoresOperacion = todosLosProveedoresParaOperacion.filter(prov => {
    const tipo = (prov.tipo_proveedor || '').toLowerCase();
    return tipo.includes('operacion') || tipo.includes('catering') || tipo.includes('cocina') || 
           tipo.includes('abarrotes') || tipo.includes('alimentos') || tipo.includes('bebida');
  });

  // Proveedores de renta: equipamiento, accesorios, decoración, desechables, servicio
  // EXCLUIR los equipos propios que tienen su propia sección
  const proveedoresRenta = todosLosProveedoresParaRenta.filter(prov => {
    const tipo = (prov.tipo_proveedor || '').toLowerCase();
    // NO incluir los equipos (tipo 'equipo')
    if (tipo === 'equipo') return false;
    // Incluir proveedores de servicio en proveedores de apoyo
    return tipo.includes('renta') || tipo.includes('desechable') || tipo.includes('servicio') || 
           tipo.includes('montaje') || tipo.includes('coctel') ||
           tipo.includes('decoracion') || tipo.includes('mobiliario') || tipo === 'servicio';
  });

  // Equipo propio: SOLO los equipos de la tabla equipos de Supabase
  const equiposPropios = equiposComoProveedores;

  // Filtrar SOLO por inactivo en localStorage
  // Los items desactivados en Admin de Precios tienen inactivo_${type}_${id} en localStorage
  // Usar función helper para obtener la clave correcta según el tipo de ID
  const getInactivoKey = (item) => {
    // Para equipos convertidos: id_proveedor es "eq_${id_equipo}"
    if (typeof item.id_proveedor === 'string' && item.id_proveedor.startsWith('eq_')) {
      const id = item.id_proveedor.replace('eq_', '');
      return `inactivo_equip_${id}`;
    }
    if (item.id_equipo) return `inactivo_equip_${item.id_equipo}`;
    if (item.id_proveedor) {
      // Para proveedores: id_proveedor puede ser con prefijo "prov_" o sin
      const id = String(item.id_proveedor).replace('prov_', '');
      return `inactivo_prov_${id}`;
    }
    return null;
  };

  const equiposActivos = equiposPropios.filter(eq => !localStorage.getItem(getInactivoKey(eq)));
  const proveedoresOperacionActivos = proveedoresOperacion.filter(prov => !localStorage.getItem(getInactivoKey(prov)));
  const proveedoresRentaActivos = proveedoresRenta.filter(prov => !localStorage.getItem(getInactivoKey(prov)));

  const catalogos = {
    recetas: recipes || [],
    equiposPropios: equiposActivos,
    proveedoresRenta: proveedoresRentaActivos,
    proveedoresOperacion: proveedoresOperacionActivos,
    itemsOperacion: almacenInsumos.filter(item => item.es_inventariable !== false)
  };

  return {
    data: {
      eventos,
      cotizaciones,
      tickets,
      movimientos,
      recipes: recipes || [],
      catalogos,
      almacen: almacenResult.data || {},
      resumen
    },
    error: null
  };
}

export async function guardarCotizacionCatering({ businessId, cotizacionId, eventId, data } = {}) {
  return guardarBundleEventoCotizacion({
    businessId,
    quoteId: cotizacionId,
    eventId,
    data,
    defaultStatus: 'cotizando'
  });
}

export async function guardarEventoCatering({ businessId, eventId, data } = {}) {
  return guardarBundleEventoCotizacion({
    businessId,
    quoteId: data.cotizacion_id,
    eventId,
    data,
    defaultStatus: 'confirmado'
  });
}

export async function eliminarCotizacionCatering({ cotizacionId, eventId } = {}) {
  if (!cotizacionId) {
    return { error: 'Selecciona una cotización para eliminar.' };
  }

  // Primero, encontrar y eliminar el evento relacionado a esta cotización
  const { data: eventosRelacionados, error: eventosError } = await supabase
    .from('catering_eventos')
    .select('id_evento')
    .eq('id_cotizacion', cotizacionId);

  if (eventosError) {
    return { error: eventosError.message };
  }

  // Eliminar cada evento relacionado (esto también eliminará sus tickets y movimientos)
  if (eventosRelacionados && eventosRelacionados.length > 0) {
    for (const evento of eventosRelacionados) {
      const eventoId = evento.id_evento;

      // 1. Obtener todos los id_mov_inv (entradas_salidas) del evento
      const { data: entradasData, error: entradasGetError } = await supabase
        .from('entradas_salidas')
        .select('id_mov_inv')
        .eq('id_evento', eventoId);
      
      if (entradasGetError) {
        return { error: `Error al obtener movimientos: ${entradasGetError.message}` };
      }

      // 2. Eliminar movimientos que referencian esos id_mov_inv
      const movInvIds = (entradasData || []).map(e => e.id_mov_inv);
      if (movInvIds.length > 0) {
        const { error: movError } = await supabase
          .from('movimientos')
          .delete()
          .in('id_mov_inv', movInvIds);
        
        if (movError) {
          return { error: `Error al eliminar movimientos: ${movError.message}` };
        }
      }

      // 3. Eliminar entradas_salidas del evento
      const { error: entradasDelError } = await supabase
        .from('entradas_salidas')
        .delete()
        .eq('id_evento', eventoId);
      
      if (entradasDelError) {
        return { error: `Error al eliminar entradas/salidas: ${entradasDelError.message}` };
      }

      // 4. Eliminar tickets del evento
      const { error: ticketsError } = await supabase
        .from('catering_tickets')
        .delete()
        .eq('id_evento', eventoId);
      
      if (ticketsError) {
        return { error: ticketsError.message };
      }

      // 5. Finalmente eliminar el evento
      const { error: eventoError } = await supabase
        .from('catering_eventos')
        .delete()
        .eq('id_evento', eventoId);
      
      if (eventoError) {
        return { error: eventoError.message };
      }
    }
  }

  // Ahora sí, eliminar la cotización
  const { error: cotizacionError } = await supabase.from('catering_cotizaciones').delete().eq('id_cotizacion', cotizacionId);
  if (cotizacionError) {
    return { error: cotizacionError.message };
  }

  return { error: null };
}

export async function eliminarEventoCatering(eventId) {
  if (!eventId) {
    return { error: 'Selecciona un evento para eliminar.' };
  }

  // Solo eliminar tickets del evento (las cotizaciones se mantienen)
  const { error: ticketsError } = await supabase
    .from('catering_tickets')
    .delete()
    .eq('id_evento', eventId);

  if (ticketsError) {
    return { error: ticketsError.message };
  }

  // Eliminar el evento
  const { error } = await supabase.from('catering_eventos').delete().eq('id_evento', eventId);
  return { error: error?.message || null };
}

export async function guardarOperacionCatering({ operationId, data } = {}) {
  // Guardar ticket con los campos correctos
  const payload = {
    id_negocio: data.id_negocio,
    id_evento: Number(data.id_evento),
    monto_ticket: roundMoney(data.monto_ticket || 0),
    tipo_pago: normalizeText(data.tipo_pago) || 'efectivo',
    responsable: normalizeText(data.responsable),
    estatus_ticket: normalizeText(data.estatus_ticket) || 'pendiente',
    observaciones: buildTaggedText(data.observaciones, buildTicketMeta(data))
  };

  const query = operationId
    ? supabase.from('catering_tickets').update(payload).eq('id_ticket', operationId).select().single()
    : supabase.from('catering_tickets').insert(payload).select().single();

  const { data: responseData, error } = await query;
  if (error) {
    return { data: null, error: error.message };
  }

  // Si hay monto, actualizar el evento para reflejar anticipo y saldo
  if (payload.monto_ticket > 0 && payload.id_evento) {
    const { data: eventoActual, error: fetchError } = await supabase
      .from('catering_eventos')
      .select('id_evento, total_estimado, anticipo_pagado, saldo_pendiente')
      .eq('id_evento', payload.id_evento)
      .single();

    if (fetchError) {
      return { data: null, error: fetchError.message };
    }

    // Obtener todos los tickets para calcular total pagado
    const { data: todosLosTickets, error: ticketsError } = await supabase
      .from('catering_tickets')
      .select('id_ticket, monto_ticket')
      .eq('id_evento', payload.id_evento);

    if (ticketsError) {
      return { data: null, error: ticketsError.message };
    }

    // Sumar montos de todos los tickets (incluyendo el que acabamos de guardar)
    const totalPagado = roundMoney(
      (todosLosTickets || []).reduce((acc, t) => {
        if (t.id_ticket === responseData?.id_ticket) {
          // Es el que acabamos de guardar, usar el monto nuevo
          return acc + roundMoney(payload.monto_ticket);
        }
        return acc + roundMoney(t.monto_ticket || 0);
      }, 0)
    );

    const totalEstimado = roundMoney(eventoActual.total_estimado || 0);
    const nuevoSaldo = roundMoney(Math.max(totalEstimado - totalPagado, 0));

    // Actualizar evento con nuevos montos
    const { error: updateEventError } = await supabase
      .from('catering_eventos')
      .update({
        anticipo_pagado: totalPagado,
        saldo_pendiente: nuevoSaldo,
        estatus: nuevoSaldo <= 0 ? 'liquidado' : 'por_pagar'
      })
      .eq('id_evento', payload.id_evento);

    if (updateEventError) {
      return { data: null, error: updateEventError.message };
    }
  }

  return { data: responseData, error: null };
}

export async function eliminarOperacionCatering(operationId) {
  const { error } = await supabase.from('catering_tickets').delete().eq('id_ticket', operationId);
  return { error: error?.message || null };
}

export function filtrarHistorialPorPeriodo(historial, { periodo, fechaInicio, fechaFin } = {}) {
  const now = new Date();
  let start;
  let end = now;

  if (fechaInicio || fechaFin) {
    start = fechaInicio ? new Date(`${fechaInicio}T00:00:00`) : new Date(0);
    end = fechaFin ? new Date(`${fechaFin}T23:59:59`) : now;
  } else if (periodo === 'semana') {
    start = new Date(now);
    start.setDate(now.getDate() - 7);
  } else if (periodo === 'mes') {
    start = new Date(now);
    start.setMonth(now.getMonth() - 1);
  } else if (periodo === 'anio') {
    start = new Date(now);
    start.setFullYear(now.getFullYear() - 1);
  } else {
    return historial || [];
  }

  return (historial || []).filter((item) => {
    const d = new Date(item.fecha);
    return d >= start && d <= end;
  });
}

export function buildMailToLink({ email, subject, body }) {
  const safeEmail = encodeURIComponent(normalizeText(email));
  const safeSubject = encodeURIComponent(normalizeText(subject));
  const safeBody = encodeURIComponent(normalizeText(body));
  return `mailto:${safeEmail}?subject=${safeSubject}&body=${safeBody}`;
}

export function buildWhatsAppLink({ phone, message }) {
  const digits = normalizeText(phone).replace(/\D/g, '');
  const safeMessage = encodeURIComponent(normalizeText(message));
  return `https://wa.me/${digits}?text=${safeMessage}`;
}
