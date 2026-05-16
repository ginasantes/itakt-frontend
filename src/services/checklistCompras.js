import { supabase } from './supabaseClient';

const LOCAL_CHECKLIST_OVERLAY_PREFIX = 'itakt-local-checklist-overlay';

function toNumber(value) {
  const parsed = Number(value || 0);
  return Number.isNaN(parsed) ? 0 : parsed;
}

function roundMeasure(value) {
  return Number(toNumber(value).toFixed(3));
}

function buildMetaTag(meta) {
  const normalized = Object.entries(meta || {}).reduce((acc, [key, value]) => {
    if (value === null || value === undefined || value === '') {
      return acc;
    }

    acc[key] = String(value);
    return acc;
  }, {});

  if (!Object.keys(normalized).length) {
    return '';
  }

  return `\n--meta:${JSON.stringify(normalized)}`;
}

function parseDescription(description) {
  const raw = String(description || '');
  const marker = '\n--meta:';
  const markerIndex = raw.indexOf(marker);

  if (markerIndex < 0) {
    return { text: raw.trim(), meta: {} };
  }

  const text = raw.slice(0, markerIndex).trim();
  const metaText = raw.slice(markerIndex + marker.length).trim();

  try {
    return {
      text,
      meta: JSON.parse(metaText || '{}') || {}
    };
  } catch (error) {
    return { text: raw.trim(), meta: {} };
  }
}

function buildDescription(text, meta) {
  return `${String(text || '').trim()}${buildMetaTag(meta)}`;
}

function getLocalChecklistKey(businessId) {
  return `${LOCAL_CHECKLIST_OVERLAY_PREFIX}-${businessId || 'sin-negocio'}`;
}

function readLocalChecklist(businessId) {
  if (typeof window === 'undefined' || !businessId) {
    return [];
  }

  try {
    const raw = window.localStorage.getItem(getLocalChecklistKey(businessId));
    if (!raw) {
      return [];
    }

    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeLocalChecklist(businessId, items) {
  if (typeof window === 'undefined' || !businessId) {
    return;
  }

  window.localStorage.setItem(getLocalChecklistKey(businessId), JSON.stringify(items || []));
}

function isRlsError(message = '') {
  return String(message || '').toLowerCase().includes('row-level security');
}

function mergeChecklistData(remoteItems = [], localItems = []) {
  return sortChecklist([...(remoteItems || []), ...(localItems || [])]);
}

function createLocalChecklistItem({ descripcion, cantidad, unidad, prioridad, nota, responsable, itemId = null } = {}) {
  const now = new Date().toISOString();
  return {
    id: -Date.now(),
    itemId,
    descripcion: String(descripcion || '').trim(),
    cantidad: cantidad === '' || cantidad === null || cantidad === undefined ? null : roundMeasure(cantidad),
    unidad: String(unidad || '').trim() || 'unidad',
    prioridad: prioridad || 'media',
    origen: itemId ? 'manual' : 'manual',
    modulo: 'restaurante',
    checked: false,
    estado: 'pendiente',
    createdBy: responsable || 'Sin responsable',
    reviewedBy: '',
    nota: nota || '',
    createdAt: now,
    resolvedAt: null,
    updatedAt: now
  };
}

function priorityWeight(priority) {
  if (priority === 'alta') return 0;
  if (priority === 'media') return 1;
  return 2;
}

function normalizeChecklistRow(row) {
  const parsed = parseDescription(row.observaciones || row.insumos?.nombre_item || '');
  const origen = parsed.meta.source || (row.id_insumo ? 'sistema' : 'manual');

  return {
    id: row.id_pendiente,
    itemId: row.id_insumo,
    descripcion: parsed.text || row.insumos?.nombre_item || 'Pendiente sin descripción',
    cantidad: row.cantidad_pedida,
    unidad: parsed.meta.unit || row.insumos?.unidad_consumo || 'unidad',
    prioridad: row.prioridad || 'media',
    origen,
    modulo: row.id_evento ? 'catering' : 'restaurante',
    checked: row.estatus === 'comprado',
    estado: row.estatus || 'pendiente',
    createdBy: parsed.meta.createdBy || row.solicitado_por || (origen === 'sistema' ? 'Sistema' : 'Sin responsable'),
    reviewedBy: parsed.meta.reviewedBy || '',
    nota: parsed.meta.note || '',
    createdAt: row.fecha_registro,
    resolvedAt: parsed.meta.resolvedAt || null,
    updatedAt: parsed.meta.updatedAt || row.fecha_registro
  };
}

function sortChecklist(items) {
  return [...items].sort((a, b) => {
    if (Boolean(a.checked) !== Boolean(b.checked)) {
      return a.checked ? 1 : -1;
    }

    const priorityDiff = priorityWeight(a.prioridad) - priorityWeight(b.prioridad);
    if (priorityDiff !== 0) {
      return priorityDiff;
    }

    return String(a.descripcion || '').localeCompare(String(b.descripcion || ''), 'es');
  });
}

function buildAutomaticPayload(item) {
  const suggestedQuantity = roundMeasure(
    Math.max(toNumber(item.stock_maximo_interno) - toNumber(item.stock_actual), 0)
  );
  const prioridad = item.semaforo?.label === 'Rojo' ? 'alta' : item.semaforo?.label === 'Amarillo' ? 'media' : 'baja';

  return {
    id_insumo: Number(item.id_insumo || item.id_item),
    observaciones: buildDescription(item.nombre_item, {
      createdBy: 'Sistema',
      note: `Stock ${toNumber(item.stock_actual)} · Punto ${toNumber(item.punto_reorden_interno || item.punto_reorden)}`,
      unit: item.unidad_consumo || 'unidad',
      source: 'sistema',
      updatedAt: new Date().toISOString()
    }),
    cantidad_pedida: suggestedQuantity || null,
    prioridad,
    estatus: 'pendiente',
    solicitado_por: 'Sistema'
  };
}

export async function obtenerChecklistCompras({ businessId } = {}) {
  if (!businessId) {
    return { data: [], error: null };
  }

  const localItems = readLocalChecklist(businessId);

  const { data, error } = await supabase
    .from('pendientes_compra')
    .select(
      'id_pendiente, id_insumo, id_evento, cantidad_pedida, prioridad, estatus, solicitado_por, observaciones, fecha_registro, insumos(nombre_item, unidad_consumo)'
    )
    .eq('id_negocio', businessId)
    .order('fecha_registro', { ascending: false });

  if (error) {
    return localItems.length ? { data: mergeChecklistData([], localItems), error: null } : { data: [], error: error.message };
  }

  return { data: mergeChecklistData((data || []).map(normalizeChecklistRow), localItems), error: null };
}

export async function sincronizarChecklistAutomatico({ businessId, catalogo } = {}) {
  if (!businessId) {
    return { data: [], error: null };
  }

  const currentResult = await obtenerChecklistCompras({ businessId });
  if (currentResult.error) {
    return currentResult;
  }

  const currentItems = currentResult.data || [];
  const currentSystemItems = currentItems.filter((item) => item.origen === 'sistema');
  const alertItems = (catalogo || []).filter((item) => item?.semaforo?.label && item.semaforo.label !== 'Verde');
  const alertItemIds = new Set(alertItems.map((item) => Number(item.id_insumo || item.id_item)));

  for (const item of alertItems) {
    const existing = currentSystemItems.find((entry) => Number(entry.itemId) === Number(item.id_insumo || item.id_item));
    const payload = buildAutomaticPayload(item);

    if (existing) {
      const { error } = await supabase
        .from('pendientes_compra')
        .update(payload)
        .eq('id_pendiente', existing.id);

      if (error) {
        return { data: currentItems, error: error.message };
      }
      continue;
    }

    const { error } = await supabase.from('pendientes_compra').insert({
      id_negocio: businessId,
      ...payload
    });

    if (error) {
      return { data: currentItems, error: error.message };
    }
  }

  for (const item of currentSystemItems) {
    if (alertItemIds.has(Number(item.itemId)) || item.checked) {
      continue;
    }

    const { error } = await supabase
      .from('pendientes_compra')
      .update({
        estatus: 'comprado',
        observaciones: buildDescription(item.descripcion, {
          createdBy: item.createdBy || 'Sistema',
          reviewedBy: item.reviewedBy || '',
          note: item.nota,
          unit: item.unidad,
          source: item.origen || 'sistema',
          resolvedAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        })
      })
      .eq('id_pendiente', item.id);

    if (error) {
      return { data: currentItems, error: error.message };
    }
  }

  return obtenerChecklistCompras({ businessId });
}

export async function agregarChecklistManual({ businessId, descripcion, cantidad, unidad, prioridad, nota, responsable } = {}) {
  const payload = {
    id_negocio: businessId,
    observaciones: buildDescription(descripcion, {
      createdBy: responsable,
      note: nota,
      unit: String(unidad || '').trim() || 'unidad',
      source: 'manual',
      updatedAt: new Date().toISOString()
    }),
    cantidad_pedida: cantidad === '' || cantidad === null || cantidad === undefined ? null : roundMeasure(cantidad),
    prioridad: prioridad || 'media',
    estatus: 'pendiente',
    solicitado_por: responsable || null
  };

  const { error } = await supabase.from('pendientes_compra').insert(payload);
  if (error) {
    if (!isRlsError(error.message)) {
      return { data: [], error: error.message };
    }

    const localItems = readLocalChecklist(businessId);
    localItems.unshift(
      createLocalChecklistItem({
        descripcion,
        cantidad,
        unidad,
        prioridad,
        nota,
        responsable
      })
    );
    writeLocalChecklist(businessId, localItems);
    return obtenerChecklistCompras({ businessId });
  }

  return obtenerChecklistCompras({ businessId });
}

export async function agregarChecklistDesdeCatalogo({ businessId, item, responsable } = {}) {
  const currentResult = await obtenerChecklistCompras({ businessId });
  if (currentResult.error) {
    return currentResult;
  }

  const existing = (currentResult.data || []).find(
    (entry) => Number(entry.itemId) === Number(item?.id_insumo || item?.id_item || 0) && !entry.checked
  );

  if (existing) {
    return currentResult;
  }

  const payload = {
    id_negocio: businessId,
    id_insumo: Number(item.id_insumo || item.id_item),
    observaciones: buildDescription(item.nombre_item, {
      createdBy: responsable,
      note: `Agregado desde inventario. Stock ${toNumber(item.stock_actual)}`,
      unit: item.unidad_consumo || 'unidad',
      source: 'manual',
      updatedAt: new Date().toISOString()
    }),
    cantidad_pedida: roundMeasure(Math.max(toNumber(item.stock_maximo_interno) - toNumber(item.stock_actual), 0)) || null,
    prioridad: item.semaforo?.label === 'Rojo' ? 'alta' : 'media',
    estatus: 'pendiente',
    solicitado_por: responsable || null
  };

  const { error } = await supabase.from('pendientes_compra').insert(payload);
  if (error) {
    return { data: currentResult.data || [], error: error.message };
  }

  return obtenerChecklistCompras({ businessId });
}

export async function marcarChecklistEstado({ businessId, checklistId, checked, responsable } = {}) {
  if (Number(checklistId) < 0) {
    const localItems = readLocalChecklist(businessId).map((item) => {
      if (Number(item.id) !== Number(checklistId)) {
        return item;
      }

      return {
        ...item,
        checked,
        estado: checked ? 'comprado' : 'pendiente',
        reviewedBy: checked ? responsable || '' : '',
        resolvedAt: checked ? new Date().toISOString() : null,
        updatedAt: new Date().toISOString()
      };
    });
    writeLocalChecklist(businessId, localItems);
    return { data: mergeChecklistData([], localItems), error: null };
  }

  const currentResult = await obtenerChecklistCompras({ businessId });
  if (currentResult.error) {
    return currentResult;
  }

  const currentItem = (currentResult.data || []).find((item) => Number(item.id) === Number(checklistId));
  if (!currentItem) {
    return { data: currentResult.data || [], error: 'No se encontró el pendiente seleccionado.' };
  }

  const description = buildDescription(currentItem.descripcion, {
    createdBy: currentItem.createdBy,
    reviewedBy: checked ? responsable : '',
    note: currentItem.nota
  });

  const { error } = await supabase
    .from('pendientes_compra')
    .update({
      observaciones: buildDescription(currentItem.descripcion, {
        createdBy: currentItem.createdBy,
        reviewedBy: checked ? responsable : '',
        note: currentItem.nota,
        unit: currentItem.unidad,
        source: currentItem.origen || 'manual',
        resolvedAt: checked ? new Date().toISOString() : '',
        updatedAt: new Date().toISOString()
      }),
      estatus: checked ? 'comprado' : 'pendiente',
      solicitado_por: currentItem.createdBy || responsable || null
    })
    .eq('id_pendiente', checklistId);

  if (error) {
    return { data: currentResult.data || [], error: error.message };
  }

  return obtenerChecklistCompras({ businessId });
}

export async function eliminarChecklistCompra({ businessId, checklistId } = {}) {
  if (Number(checklistId) < 0) {
    const localItems = readLocalChecklist(businessId).filter((item) => Number(item.id) !== Number(checklistId));
    writeLocalChecklist(businessId, localItems);
    return { data: mergeChecklistData([], localItems), error: null };
  }

  const { error } = await supabase.from('pendientes_compra').delete().eq('id_pendiente', checklistId);
  if (error) {
    return { data: [], error: error.message };
  }

  return obtenerChecklistCompras({ businessId });
}

export async function limpiarChecklistResuelto({ businessId } = {}) {
  const localPendientes = readLocalChecklist(businessId).filter((item) => !item.checked);
  writeLocalChecklist(businessId, localPendientes);

  const { error } = await supabase.from('pendientes_compra').delete().eq('id_negocio', businessId).eq('estatus', 'comprado');
  if (error) {
    return isRlsError(error.message) ? { data: mergeChecklistData([], localPendientes), error: null } : { data: [], error: error.message };
  }

  return obtenerChecklistCompras({ businessId });
}

export async function marcarChecklistComprado({ businessId, catalogItemId, responsable } = {}) {
  const currentResult = await obtenerChecklistCompras({ businessId });
  if (currentResult.error) {
    return currentResult;
  }

  const affected = (currentResult.data || []).filter(
    (item) => Number(item.itemId || 0) === Number(catalogItemId || 0) && !item.checked
  );

  const localAffectedIds = new Set(affected.filter((item) => Number(item.id) < 0).map((item) => Number(item.id)));
  if (localAffectedIds.size) {
    const localItems = readLocalChecklist(businessId).map((item) => {
      if (!localAffectedIds.has(Number(item.id))) {
        return item;
      }

      return {
        ...item,
        checked: true,
        estado: 'comprado',
        reviewedBy: responsable || '',
        resolvedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
    });
    writeLocalChecklist(businessId, localItems);
  }

  for (const item of affected) {
    if (Number(item.id) < 0) {
      continue;
    }

    const { error } = await supabase
      .from('pendientes_compra')
      .update({
        observaciones: buildDescription(item.descripcion, {
          createdBy: item.createdBy,
          reviewedBy: responsable,
          note: item.nota,
          unit: item.unidad,
          source: item.origen || 'manual',
          resolvedAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }),
        estatus: 'comprado',
        solicitado_por: item.createdBy || responsable || null
      })
      .eq('id_pendiente', item.id);

    if (error) {
      return { data: currentResult.data || [], error: error.message };
    }
  }

  return obtenerChecklistCompras({ businessId });
}