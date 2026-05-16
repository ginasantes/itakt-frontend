function getChecklistStorageKey(scope, businessId) {
  return `itakt-shopping-checklist-${scope || 'general'}-${businessId || 'sin-negocio'}`;
}

function readChecklist(key) {
  if (typeof window === 'undefined') {
    return [];
  }

  try {
    const raw = window.localStorage.getItem(key);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    return [];
  }
}

function writeChecklist(key, items) {
  if (typeof window === 'undefined') {
    return items;
  }

  window.localStorage.setItem(key, JSON.stringify(items));
  return items;
}

function normalizeNumber(value) {
  const parsed = Number(value || 0);
  return Number.isNaN(parsed) ? 0 : parsed;
}

function roundMeasure(value) {
  return Number(normalizeNumber(value).toFixed(3));
}

function sortChecklist(items) {
  const priorityWeight = { alta: 0, media: 1, baja: 2 };

  return [...items].sort((a, b) => {
    if (Boolean(a.checked) !== Boolean(b.checked)) {
      return a.checked ? 1 : -1;
    }

    const priorityDiff = (priorityWeight[a.prioridad] ?? 3) - (priorityWeight[b.prioridad] ?? 3);
    if (priorityDiff !== 0) {
      return priorityDiff;
    }

    return String(a.descripcion || '').localeCompare(String(b.descripcion || ''), 'es');
  });
}

function buildAutomaticEntry(item, existingEntry) {
  const suggestedQuantity = roundMeasure(
    Math.max(normalizeNumber(item.stock_maximo_interno) - normalizeNumber(item.stock_actual), 0)
  );
  const priority = item.semaforo?.label === 'Rojo' ? 'alta' : item.semaforo?.label === 'Amarillo' ? 'media' : 'baja';

  return {
    id: `auto-${item.id_item}`,
    itemId: Number(item.id_item),
    descripcion: item.nombre_item,
    cantidad: suggestedQuantity || null,
    unidad: item.unidad_consumo || 'unidad',
    prioridad: priority,
    origen: 'sistema',
    checked: false,
    nota: `Stock ${normalizeNumber(item.stock_actual)} · Punto ${normalizeNumber(item.punto_reorden_interno || item.punto_reorden)}`,
    createdAt: existingEntry?.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
}

export function loadShoppingChecklist({ scope, businessId } = {}) {
  return sortChecklist(readChecklist(getChecklistStorageKey(scope, businessId)));
}

export function syncShoppingChecklist({ scope, businessId, catalogo, currentItems } = {}) {
  const key = getChecklistStorageKey(scope, businessId);
  const existingItems = Array.isArray(currentItems) ? currentItems : readChecklist(key);
  const nextItems = [...existingItems];

  (catalogo || [])
    .filter((item) => item?.semaforo?.label && item.semaforo.label !== 'Verde')
    .forEach((item) => {
      const nextEntry = buildAutomaticEntry(item, existingItems.find((entry) => entry.id === `auto-${item.id_item}`));
      const existingIndex = nextItems.findIndex((entry) => entry.id === nextEntry.id);

      if (existingIndex >= 0) {
        nextItems[existingIndex] = {
          ...nextItems[existingIndex],
          ...nextEntry,
          checked: false
        };
        return;
      }

      nextItems.push(nextEntry);
    });

  return writeChecklist(key, sortChecklist(nextItems));
}

export function addManualChecklistItem({ scope, businessId, currentItems, descripcion, cantidad, unidad, prioridad, nota } = {}) {
  const key = getChecklistStorageKey(scope, businessId);
  const existingItems = Array.isArray(currentItems) ? currentItems : readChecklist(key);
  const now = new Date().toISOString();

  const nextItems = [
    ...existingItems,
    {
      id: `manual-${Date.now()}`,
      itemId: null,
      descripcion: String(descripcion || '').trim(),
      cantidad: cantidad === '' || cantidad === null || cantidad === undefined ? null : roundMeasure(cantidad),
      unidad: String(unidad || '').trim() || 'unidad',
      prioridad: prioridad || 'media',
      origen: 'manual',
      checked: false,
      nota: String(nota || '').trim(),
      createdAt: now,
      updatedAt: now
    }
  ];

  return writeChecklist(key, sortChecklist(nextItems));
}

export function addCatalogItemChecklistItem({ scope, businessId, currentItems, item } = {}) {
  const key = getChecklistStorageKey(scope, businessId);
  const existingItems = Array.isArray(currentItems) ? currentItems : readChecklist(key);
  const existingIndex = existingItems.findIndex(
    (entry) => Number(entry.itemId || 0) === Number(item?.id_item || 0) && !entry.checked
  );

  if (existingIndex >= 0) {
    const updated = [...existingItems];
    updated[existingIndex] = {
      ...updated[existingIndex],
      prioridad: item?.semaforo?.label === 'Rojo' ? 'alta' : updated[existingIndex].prioridad,
      updatedAt: new Date().toISOString()
    };
    return writeChecklist(key, sortChecklist(updated));
  }

  return writeChecklist(key, sortChecklist([...existingItems, buildAutomaticEntry(item)]));
}

export function toggleChecklistItem({ scope, businessId, currentItems, itemId, checked } = {}) {
  const key = getChecklistStorageKey(scope, businessId);
  const existingItems = Array.isArray(currentItems) ? currentItems : readChecklist(key);
  const nextItems = existingItems.map((item) =>
    item.id === itemId
      ? {
          ...item,
          checked: typeof checked === 'boolean' ? checked : !item.checked,
          updatedAt: new Date().toISOString()
        }
      : item
  );

  return writeChecklist(key, sortChecklist(nextItems));
}

export function removeChecklistItem({ scope, businessId, currentItems, itemId } = {}) {
  const key = getChecklistStorageKey(scope, businessId);
  const existingItems = Array.isArray(currentItems) ? currentItems : readChecklist(key);
  return writeChecklist(
    key,
    sortChecklist(existingItems.filter((item) => item.id !== itemId))
  );
}

export function clearCheckedChecklistItems({ scope, businessId, currentItems } = {}) {
  const key = getChecklistStorageKey(scope, businessId);
  const existingItems = Array.isArray(currentItems) ? currentItems : readChecklist(key);
  return writeChecklist(
    key,
    sortChecklist(existingItems.filter((item) => !item.checked))
  );
}

export function markChecklistPurchased({ scope, businessId, currentItems, catalogItemId } = {}) {
  const key = getChecklistStorageKey(scope, businessId);
  const existingItems = Array.isArray(currentItems) ? currentItems : readChecklist(key);
  const nextItems = existingItems.map((item) =>
    Number(item.itemId || 0) === Number(catalogItemId || 0)
      ? {
          ...item,
          checked: true,
          updatedAt: new Date().toISOString()
        }
      : item
  );

  return writeChecklist(key, sortChecklist(nextItems));
}