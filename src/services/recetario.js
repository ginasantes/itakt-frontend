import { obtenerAlmacenCompras } from './almacenCompras';
import { supabase } from './supabaseClient';

const CATEGORY_GROUP_BY_TYPE = {
  ingrediente: 'ingredientes',
  complemento: 'complementos',
  equipo: 'equipos'
};

const DEMO_RECETAS = [
  { id_recetario: 1, id_negocio: 1, nombre_platillo: 'Chilaquiles Verdes', tipo_categoria: 'Plato fuerte', subreceta_complemento: null, imagen_platillo: 'https://images.unsplash.com/photo-1543332164-6e82f355badc', precio_venta_fijo: 98, rendimiento_personas: 2, procedimiento_preparacion: 'Freir o tostar totopo, banar con salsa verde y terminar con crema y queso.', tiempo_total_estimado_min: 25 },
  { id_recetario: 2, id_negocio: 1, nombre_platillo: 'Tacos al Pastor', tipo_categoria: 'Plato fuerte', subreceta_complemento: null, imagen_platillo: 'https://images.unsplash.com/photo-1552332386-f8dd00dc2f85', precio_venta_fijo: 110, rendimiento_personas: 3, procedimiento_preparacion: 'Calentar tortilla y servir carne con cebolla y cilantro.', tiempo_total_estimado_min: 30 },
  { id_recetario: 3, id_negocio: 1, nombre_platillo: 'Ensalada de la Casa', tipo_categoria: 'Complemento', subreceta_complemento: null, imagen_platillo: 'https://images.unsplash.com/photo-1546793665-c74683f339c1', precio_venta_fijo: 72, rendimiento_personas: 2, procedimiento_preparacion: 'Mezclar vegetales frescos y montar con aguacate.', tiempo_total_estimado_min: 15 },
  { id_recetario: 4, id_negocio: 1, nombre_platillo: 'Huevos Rancheros', tipo_categoria: 'Plato fuerte', subreceta_complemento: null, imagen_platillo: 'https://images.unsplash.com/photo-1513442542250-854d436a73f2', precio_venta_fijo: 96, rendimiento_personas: 2, procedimiento_preparacion: 'Freir huevo y servir sobre tortilla con salsa y frijol.', tiempo_total_estimado_min: 20 },
  { id_recetario: 10, id_negocio: 2, nombre_platillo: 'Arroz Cremoso para Evento', tipo_categoria: 'Complemento', subreceta_complemento: null, imagen_platillo: 'https://images.unsplash.com/photo-1512058564366-18510be2db19', precio_venta_fijo: 85, rendimiento_personas: 10, procedimiento_preparacion: 'Cocer arroz al vapor y mezclar con crema.', tiempo_total_estimado_min: 40 },
  { id_recetario: 11, id_negocio: 2, nombre_platillo: 'Coffee Break Ejecutivo', tipo_categoria: 'Complemento', subreceta_complemento: null, imagen_platillo: 'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085', precio_venta_fijo: 120, rendimiento_personas: 12, procedimiento_preparacion: 'Montar estacion con cafe, jugo y pan dulce.', tiempo_total_estimado_min: 20 },
  { id_recetario: 12, id_negocio: 2, nombre_platillo: 'Buffet de Pollo y Arroz', tipo_categoria: 'Plato fuerte', subreceta_complemento: null, imagen_platillo: 'https://images.unsplash.com/photo-1604908176997-125f25cc6f3d', precio_venta_fijo: 155, rendimiento_personas: 15, procedimiento_preparacion: 'Preparar pechuga a la plancha, arroz y verduras para buffet.', tiempo_total_estimado_min: 60 }
];

const DEMO_ESCANDALLOS = [
  { id_escandallo: 1, id_recetario: 1, id_insumo: 1, cantidad_bruta: 0.25, cantidad_neta: 0.245, porcentaje_merma: 2, costo_calculado: 13 },
  { id_escandallo: 2, id_recetario: 1, id_insumo: 2, cantidad_bruta: 0.18, cantidad_neta: 0.18, porcentaje_merma: 0, costo_calculado: 10.44 },
  { id_escandallo: 3, id_recetario: 1, id_insumo: 3, cantidad_bruta: 0.05, cantidad_neta: 0.05, porcentaje_merma: 0, costo_calculado: 2.25 },
  { id_escandallo: 4, id_recetario: 1, id_insumo: 4, cantidad_bruta: 0.06, cantidad_neta: 0.06, porcentaje_merma: 0, costo_calculado: 6.24 },
  { id_escandallo: 5, id_recetario: 2, id_insumo: 9, cantidad_bruta: 0.18, cantidad_neta: 0.18, porcentaje_merma: 0, costo_calculado: 3.96 },
  { id_escandallo: 6, id_recetario: 2, id_insumo: 10, cantidad_bruta: 0.22, cantidad_neta: 0.202, porcentaje_merma: 8, costo_calculado: 30.36 },
  { id_escandallo: 7, id_recetario: 2, id_insumo: 11, cantidad_bruta: 0.02, cantidad_neta: 0.019, porcentaje_merma: 5, costo_calculado: 1.04 },
  { id_escandallo: 8, id_recetario: 2, id_insumo: 12, cantidad_bruta: 0.03, cantidad_neta: 0.029, porcentaje_merma: 5, costo_calculado: 0.66 },
  { id_escandallo: 9, id_recetario: 3, id_insumo: 7, cantidad_bruta: 1, cantidad_neta: 0.88, porcentaje_merma: 12, costo_calculado: 14 },
  { id_escandallo: 10, id_recetario: 3, id_insumo: 6, cantidad_bruta: 0.12, cantidad_neta: 0.09, porcentaje_merma: 25, costo_calculado: 10.56 },
  { id_escandallo: 11, id_recetario: 3, id_insumo: 8, cantidad_bruta: 0.09, cantidad_neta: 0.083, porcentaje_merma: 8, costo_calculado: 2.16 },
  { id_escandallo: 12, id_recetario: 4, id_insumo: 14, cantidad_bruta: 2, cantidad_neta: 2, porcentaje_merma: 0, costo_calculado: 6.4 },
  { id_escandallo: 13, id_recetario: 4, id_insumo: 2, cantidad_bruta: 0.1, cantidad_neta: 0.1, porcentaje_merma: 0, costo_calculado: 5.8 },
  { id_escandallo: 14, id_recetario: 4, id_insumo: 13, cantidad_bruta: 0.15, cantidad_neta: 0.144, porcentaje_merma: 4, costo_calculado: 5.85 },
  { id_escandallo: 20, id_recetario: 10, id_insumo: 26, cantidad_bruta: 1, cantidad_neta: 0.95, porcentaje_merma: 5, costo_calculado: 28 },
  { id_escandallo: 21, id_recetario: 10, id_insumo: 27, cantidad_bruta: 0.8, cantidad_neta: 0.576, porcentaje_merma: 28, costo_calculado: 39.2 },
  { id_escandallo: 22, id_recetario: 10, id_insumo: 28, cantidad_bruta: 0.4, cantidad_neta: 0.4, porcentaje_merma: 0, costo_calculado: 19.2 },
  { id_escandallo: 23, id_recetario: 11, id_insumo: 21, cantidad_bruta: 0.3, cantidad_neta: 0.3, porcentaje_merma: 0, costo_calculado: 51 },
  { id_escandallo: 24, id_recetario: 11, id_insumo: 22, cantidad_bruta: 1, cantidad_neta: 1, porcentaje_merma: 0, costo_calculado: 150 },
  { id_escandallo: 25, id_recetario: 11, id_insumo: 23, cantidad_bruta: 3, cantidad_neta: 3, porcentaje_merma: 0, costo_calculado: 102 },
  { id_escandallo: 26, id_recetario: 11, id_insumo: 24, cantidad_bruta: 1, cantidad_neta: 1, porcentaje_merma: 0, costo_calculado: 40 },
  { id_escandallo: 27, id_recetario: 12, id_insumo: 25, cantidad_bruta: 1.5, cantidad_neta: 1.38, porcentaje_merma: 8, costo_calculado: 181.5 },
  { id_escandallo: 28, id_recetario: 12, id_insumo: 26, cantidad_bruta: 1.2, cantidad_neta: 1.14, porcentaje_merma: 5, costo_calculado: 33.6 },
  { id_escandallo: 29, id_recetario: 12, id_insumo: 27, cantidad_bruta: 1, cantidad_neta: 0.82, porcentaje_merma: 18, costo_calculado: 49 }
];

export const TIPOS_RECETA = [
  'Plato fuerte',
  'Base',
  'Salsa',
  'Guarnicion',
  'Complemento',
  'Entrada',
  'Seco',
  'Caldo',
  'Bebida',
  'Postre',
  'Desayuno',
  'Cena'
];

export const UNIDADES_RECETA = ['kg', 'g', 'lt', 'ml', 'pieza', 'unidad', 'manojo', 'lata', 'paquete', 'costal', 'tanque'];

export const TIPOS_RELACION_RECETA = ['Base', 'Salsa', 'Complemento', 'Guarnicion', 'Acompanamiento'];

const UNIT_DEFINITIONS = {
  kg: { dimension: 'masa', factor: 1000 },
  g: { dimension: 'masa', factor: 1 },
  lt: { dimension: 'volumen', factor: 1000 },
  l: { dimension: 'volumen', factor: 1000 },
  ml: { dimension: 'volumen', factor: 1 },
  pieza: { dimension: 'conteo', factor: 1 },
  piezas: { dimension: 'conteo', factor: 1 },
  unidad: { dimension: 'conteo', factor: 1 },
  unidades: { dimension: 'conteo', factor: 1 },
  manojo: { dimension: 'conteo', factor: 1 },
  manojos: { dimension: 'conteo', factor: 1 },
  lata: { dimension: 'conteo', factor: 1 },
  latas: { dimension: 'conteo', factor: 1 },
  paquete: { dimension: 'conteo', factor: 1 },
  paquetes: { dimension: 'conteo', factor: 1 },
  costal: { dimension: 'conteo', factor: 1 },
  costales: { dimension: 'conteo', factor: 1 },
  tanque: { dimension: 'conteo', factor: 1 },
  tanques: { dimension: 'conteo', factor: 1 }
};

const MERMA_BY_SUBCATEGORY = {
  Verduras: 12,
  Frutas: 10,
  Hierbas: 15,
  Especias: 5,
  Carnes: 8,
  'Proteina y avicola': 5,
  Lacteos: 2,
  Mariscos: 10,
  Semillas: 1,
  'Chiles secos': 3,
  'Salsas y bases': 3,
  Leguminosas: 2,
  Abarrotes: 1.5,
  Enlatados: 0.5,
  Panaderia: 2,
  Bebidas: 0,
  Desechables: 0,
  Energeticos: 0,
  Preparacion: 0,
  Refrigeracion: 0,
  Servicio: 0,
  Montaje: 0
};

function normalizeText(value) {
  return String(value || '').trim();
}

function normalizeLower(value) {
  return normalizeText(value).toLowerCase();
}

function resolveCategoryGroup(value) {
  return CATEGORY_GROUP_BY_TYPE[normalizeLower(value)] || 'ingredientes';
}

function normalizeUnit(value) {
  return normalizeLower(value)
    .replace('litros', 'lt')
    .replace('litro', 'lt')
    .replace('kilogramos', 'kg')
    .replace('kilogramo', 'kg')
    .replace('gramos', 'g')
    .replace('gramo', 'g');
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

function roundMeasure(value) {
  return Number(toNumber(value).toFixed(3));
}

function getGrossQuantityFromWaste(netQuantity, wastePercent) {
  const safeNet = roundMeasure(netQuantity);
  const safeWaste = Math.max(toNumber(wastePercent), 0);
  const yieldFactor = 1 - safeWaste / 100;

  if (yieldFactor <= 0) {
    return safeNet;
  }

  return roundMeasure(safeNet / yieldFactor);
}

function buildSuggestedPrice(costPerPortion, margin) {
  if (!costPerPortion) {
    return 0;
  }

  const safeMargin = Math.min(Math.max(margin, 0.05), 0.9);
  return roundMoney(costPerPortion / (1 - safeMargin));
}

const PORCION_ESTANDAR_G = {
  'Plato fuerte': 200,
  'Base': 150,
  'Salsa': 50,
  'Guarnicion': 120,
  'Complemento': 100,
  'Entrada': 150,
  'Seco': 180,
  'Caldo': 300,
  'Bebida': 250,
  'Postre': 120,
  'Desayuno': 200,
  'Cena': 180
};

function estimarPorciones({ detalles, tipoCategoria }) {
  const porcionG = PORCION_ESTANDAR_G[tipoCategoria] || 180;

  const pesosEnGramos = detalles.map((d) => {
    const unidad = (d.unidad_consumo || d.unidad_medida_receta || '').toLowerCase();
    const neto = toNumber(d.cantidad_base_neta || d.peso_neto);
    if (['kg'].includes(unidad)) return neto * 1000;
    if (['g'].includes(unidad)) return neto;
    if (['lt', 'litro'].includes(unidad)) return neto * 1000;
    if (['ml'].includes(unidad)) return neto;
    if (['pieza', 'piezas', 'unidad', 'unidades'].includes(unidad)) return neto * 150;
    if (['manojo', 'manojos'].includes(unidad)) return neto * 150;
    return neto * 100;
  });

  const pesoTotal = pesosEnGramos.reduce((sum, w) => sum + w, 0);
  if (pesoTotal <= 0) return null;

  const estimado = Math.max(Math.round(pesoTotal / porcionG), 1);
  return estimado;
}

function getStockSemaforo(stockActual, puntoReorden) {
  const stock = toNumber(stockActual);
  const reorder = toNumber(puntoReorden) || Math.max(stock * 0.35, 1);
  if (stock <= 0) return { label: 'Sin stock', className: 'stock-rojo' };
  if (stock <= reorder) return { label: 'Comprar', className: 'stock-rojo' };
  if (stock <= reorder * 1.5) return { label: 'Bajo', className: 'stock-amarillo' };
  return { label: 'OK', className: 'stock-verde' };
}

function sanitizeRecipeRelations(relaciones) {
  return (relaciones || [])
    .map((relacion) => ({
      id_receta_relacionada: relacion.id_receta_relacionada ? Number(relacion.id_receta_relacionada) : null,
      tipo_relacion: normalizeText(relacion.tipo_relacion) || 'Complemento',
      cantidad_relacionada: Math.max(toNumberOrNull(relacion.cantidad_relacionada) ?? 1, 0.001)
    }))
    .filter((relacion) => relacion.id_receta_relacionada);
}

function parseRecipeRelations(rawValue) {
  const rawText = normalizeText(rawValue);

  if (!rawText) {
    return [];
  }

  if (rawText.startsWith('[')) {
    try {
      return sanitizeRecipeRelations(JSON.parse(rawText));
    } catch {
      return [];
    }
  }

  return [];
}

function serializeRecipeRelations(relaciones) {
  const sanitized = sanitizeRecipeRelations(relaciones);
  return sanitized.length ? JSON.stringify(sanitized) : null;
}

function convertQuantity(quantity, fromUnit, toUnit) {
  const safeQuantity = toNumber(quantity);
  const normalizedFrom = normalizeUnit(fromUnit);
  const normalizedTo = normalizeUnit(toUnit);

  if (!safeQuantity || !normalizedFrom || !normalizedTo || normalizedFrom === normalizedTo) {
    return {
      quantity: roundMeasure(safeQuantity),
      compatible: true,
      note: normalizedFrom && normalizedTo && normalizedFrom === normalizedTo ? `${fromUnit} = ${toUnit}` : 'Sin conversion'
    };
  }

  const fromDefinition = UNIT_DEFINITIONS[normalizedFrom];
  const toDefinition = UNIT_DEFINITIONS[normalizedTo];

  if (!fromDefinition || !toDefinition || fromDefinition.dimension !== toDefinition.dimension) {
    return {
      quantity: roundMeasure(safeQuantity),
      compatible: false,
      note: `Sin equivalencia entre ${fromUnit || 'unidad receta'} y ${toUnit || 'unidad compra'}`
    };
  }

  return {
    quantity: roundMeasure((safeQuantity * fromDefinition.factor) / toDefinition.factor),
    compatible: true,
    note: `${fromUnit} -> ${toUnit}`
  };
}

export function calcularMermaAutomatica(item) {
  if (!item) {
    return 0;
  }

  const categoria = normalizeLower(item.categoria);
  if (categoria === 'equipos' || categoria === 'complementos') {
    return 0;
  }

  const subcategoria = normalizeText(item.subcategoria);
  const conservacion = normalizeLower(item.tipo_conservacion);
  const baseMerma = toNumber(MERMA_BY_SUBCATEGORY[subcategoria] ?? 3);
  let ajuste = 0;

  if (conservacion.includes('refrigerado')) {
    ajuste += 1;
  }

  if (conservacion.includes('temperatura')) {
    ajuste += 0.5;
  }

  if (conservacion.includes('congelado')) {
    ajuste -= 1;
  }

  return roundMoney(Math.min(Math.max(baseMerma + ajuste, 0), 18));
}

function buildRecetaPayload(data, businessId) {
  return {
    id_negocio: businessId,
    nombre_platillo: normalizeText(data.nombre_platillo),
    tipo_categoria: normalizeText(data.tipo_categoria),
    subreceta_complemento: serializeRecipeRelations(data.recetas_relacionadas),
    imagen_platillo: normalizeText(data.imagen_platillo) || null,
    precio_venta_fijo: toNumberOrNull(data.precio_venta_fijo),
    rendimiento_personas: Math.max(toNumberOrNull(data.rendimiento_personas) || 1, 1),
    procedimiento_preparacion: normalizeText(data.procedimiento_preparacion) || null,
    tiempo_total_estimado_min: toNumberOrNull(data.tiempo_total_estimado_min)
  };
}

function buildDetallePayload(detail, recetarioId) {
  const cantidadNeta = toNumber(detail.cantidad_utilizada);
  const porcentajeMerma = toNumber(detail.merma_porcentaje);
  return {
    id_recetario: recetarioId,
    id_insumo: Number(detail.id_item),
    cantidad_neta: cantidadNeta,
    cantidad_bruta: getGrossQuantityFromWaste(cantidadNeta, porcentajeMerma),
    porcentaje_merma: porcentajeMerma,
    costo_calculado: 0
  };
}

function sanitizeDetalles(detalles) {
  return (detalles || [])
    .map((detail) => ({
      ...detail,
      id_item: detail.id_item ? Number(detail.id_item) : null,
      unidad_medida_receta: normalizeText(detail.unidad_medida_receta),
      cantidad_utilizada: toNumberOrNull(detail.cantidad_utilizada),
      merma_porcentaje: toNumberOrNull(detail.merma_porcentaje) ?? 0,
      tiempo_preparacion_min: toNumberOrNull(detail.tiempo_preparacion_min)
    }))
    .filter((detail) => detail.id_item || detail.unidad_medida_receta || detail.cantidad_utilizada);
}

function validateDetalles(detalles) {
  if (!detalles.length) {
    return 'Agrega al menos un renglón al escandallo.';
  }

  const invalidDetail = detalles.find(
    (detail) => !detail.id_item || !detail.unidad_medida_receta || !detail.cantidad_utilizada || detail.cantidad_utilizada <= 0
  );

  if (invalidDetail) {
    return 'Cada renglón del escandallo debe tener insumo, unidad y cantidad mayor a cero.';
  }

  return null;
}

function buildCatalogoSeparado(catalogo) {
  return {
    insumos: catalogo.filter((item) => normalizeLower(item.categoria) === 'ingredientes'),
    equipos: catalogo.filter((item) => normalizeLower(item.categoria) === 'equipos'),
    complementos: catalogo.filter((item) => normalizeLower(item.categoria) === 'complementos')
  };
}

function buildEscandalloDetalle({ detail, itemById, latestPriceByItem }) {
  const itemId = detail.id_item || detail.id_insumo;
  const item = itemById.get(itemId);
  const latestLot = latestPriceByItem.get(itemId);
  const mermaAutomatica = detail.merma_porcentaje ?? detail.porcentaje_merma ?? calcularMermaAutomatica(item);
  const precioUltimoLote = toNumber(latestLot?.precio_unitario || latestLot?.costo_unitario);
  const precioCompetencia = toNumber(item?.precio_competencia_promedio);
  const unidadReceta = detail.unidad_medida_receta || item?.unidad_consumo || 'unidad';
  const pesoNetoReceta = roundMeasure(detail.cantidad_utilizada ?? detail.cantidad_neta);
  const pesoBrutoReceta = roundMeasure(detail.cantidad_bruta) || getGrossQuantityFromWaste(pesoNetoReceta, mermaAutomatica);
  const conversionNeta = convertQuantity(pesoNetoReceta, unidadReceta, item?.unidad_consumo);
  const conversionBruta = convertQuantity(pesoBrutoReceta, unidadReceta, item?.unidad_consumo);
  const precioBase = precioUltimoLote || precioCompetencia;
  const costoNeto = roundMoney(precioBase * conversionNeta.quantity);
  const costoReal = roundMoney(precioBase * conversionBruta.quantity);
  const costoCompetencia = roundMoney(precioCompetencia * conversionBruta.quantity);
  const costoMerma = roundMoney(costoReal - costoNeto);

  return {
    ...detail,
    id_item: itemId,
    unidad_medida_receta: unidadReceta,
    item_nombre: item?.nombre_item || 'Insumo sin nombre',
    categoria: item?.categoria || 'ingredientes',
    subcategoria: item?.subcategoria || 'Sin subcategoria',
    unidad_consumo: item?.unidad_consumo || 'unidad',
    tipo_conservacion: item?.tipo_conservacion || 'No aplica',
    fuente_competencia: item?.fuente_competencia || 'Sin referencia',
    merma_automatica: toNumber(mermaAutomatica),
    precio_ultimo_lote: precioUltimoLote,
    precio_competencia: precioCompetencia,
    precio_base: precioBase,
    fuente_precio: precioUltimoLote ? 'ultimo_lote' : 'precio_referencia',
    peso_neto: pesoNetoReceta,
    peso_bruto: pesoBrutoReceta,
    cantidad_base_neta: conversionNeta.quantity,
    cantidad_base_bruta: conversionBruta.quantity,
    conversion_neta: conversionNeta.note,
    conversion_bruta: conversionBruta.note,
    conversion_incompatible: !conversionNeta.compatible || !conversionBruta.compatible,
    costo_neto: costoNeto,
    costo_real: costoReal,
    costo_merma: costoMerma,
    costo_competencia: costoCompetencia,
    stock_actual: toNumber(item?.stock_actual),
    stock_semaforo: getStockSemaforo(item?.stock_actual, item?.punto_reorden)
  };
}

function enrichRecipe({ receta, escandallos, itemById, latestPriceByItem, recetasById, computeRecipe, stack }) {
  const detalles = escandallos
    .filter((detail) => detail.id_recetario === receta.id_recetario)
    .map((detail) => buildEscandalloDetalle({ detail, itemById, latestPriceByItem }));

  const relacionesGuardadas = parseRecipeRelations(receta.subreceta_complemento);
  const recetasRelacionadas = relacionesGuardadas.map((relacion) => {
    const linkedRecipe = recetasById.get(relacion.id_receta_relacionada);

    if (!linkedRecipe) {
      return {
        ...relacion,
        nombre_platillo: 'Receta no encontrada',
        total_costo_usado: 0,
        costo_porcion_usado: 0,
        total_costo_competencia_usado: 0,
        es_relacion_ciclica: false
      };
    }

    if (stack.has(linkedRecipe.id_recetario)) {
      return {
        ...relacion,
        nombre_platillo: linkedRecipe.nombre_platillo,
        total_costo_usado: 0,
        costo_porcion_usado: 0,
        total_costo_competencia_usado: 0,
        es_relacion_ciclica: true
      };
    }

    const linkedComputed = computeRecipe(linkedRecipe.id_recetario, new Set([...stack, linkedRecipe.id_recetario]));
    const factor = Math.max(toNumber(relacion.cantidad_relacionada), 0.001);

    return {
      ...relacion,
      nombre_platillo: linkedComputed.nombre_platillo,
      tipo_categoria_receta: linkedComputed.tipo_categoria,
      total_costo_usado: roundMoney(linkedComputed.total_costo_receta * factor),
      costo_porcion_usado: roundMoney(linkedComputed.costo_porcion * factor),
      total_costo_competencia_usado: roundMoney(linkedComputed.total_costo_competencia * factor),
      rendimiento_personas: linkedComputed.rendimiento_personas,
      es_relacion_ciclica: false
    };
  });

  const totalCostoInsumos = roundMoney(detalles.reduce((acc, item) => acc + item.costo_real, 0));
  const totalCostoCompetenciaInsumos = roundMoney(detalles.reduce((acc, item) => acc + item.costo_competencia, 0));
  const totalCostoRecetasLigadas = roundMoney(recetasRelacionadas.reduce((acc, item) => acc + item.total_costo_usado, 0));
  const totalCostoCompetenciaLigadas = roundMoney(
    recetasRelacionadas.reduce((acc, item) => acc + item.total_costo_competencia_usado, 0)
  );
  const totalCostoReceta = roundMoney(totalCostoInsumos + totalCostoRecetasLigadas);
  const totalCostoCompetencia = roundMoney(totalCostoCompetenciaInsumos + totalCostoCompetenciaLigadas);
  const rendimiento = Math.max(toNumber(receta.rendimiento_personas), 1);
  const costoPorcion = roundMoney(totalCostoReceta / rendimiento);
  const costoCompetenciaPorcion = roundMoney(totalCostoCompetencia / rendimiento);
  const precioVenta = roundMoney(receta.precio_venta_fijo);
  const utilidadPorcion = roundMoney(precioVenta - costoPorcion);
  const margenPorcion = precioVenta > 0 ? roundMoney((utilidadPorcion / precioVenta) * 100) : 0;

  const porcionesSugeridas = estimarPorciones({ detalles, tipoCategoria: receta.tipo_categoria });

  return {
    ...receta,
    escandallo: detalles,
    recetas_relacionadas: recetasRelacionadas,
    total_costo_insumos: totalCostoInsumos,
    total_costo_recetas_ligadas: totalCostoRecetasLigadas,
    total_costo_receta: totalCostoReceta,
    total_costo_competencia: totalCostoCompetencia,
    costo_porcion: costoPorcion,
    costo_competencia_porcion: costoCompetenciaPorcion,
    utilidad_porcion: utilidadPorcion,
    margen_porcion: margenPorcion,
    porciones_sugeridas: porcionesSugeridas,
    sugerido_30: buildSuggestedPrice(costoPorcion, 0.3),
    sugerido_35: buildSuggestedPrice(costoPorcion, 0.35),
    sugerido_40: buildSuggestedPrice(costoPorcion, 0.4)
  };
}

function buildRecetarioResponse({ recetas, catalogo, escandallos }) {
  const catalogoSeparado = buildCatalogoSeparado(catalogo);
  const itemById = new Map(catalogo.map((item) => [item.id_insumo, item]));
  const latestPriceByItem = new Map(
    catalogo
      .filter((item) => item.ultimo_precio_compra || item.precio_competencia_promedio)
      .map((item) => [
        item.id_insumo,
        {
          id_insumo: item.id_insumo,
          costo_unitario: item.ultimo_precio_compra || item.precio_competencia_promedio,
          fecha_entrada: null
        }
      ])
  );
  const recetasById = new Map(recetas.map((item) => [item.id_recetario, item]));
  const cache = new Map();

  function computeRecipe(recetaId, stack = new Set([recetaId])) {
    if (cache.has(recetaId)) {
      return cache.get(recetaId);
    }

    const receta = recetasById.get(recetaId);
    if (!receta) {
      return null;
    }

    const computed = enrichRecipe({
      receta,
      escandallos,
      itemById,
      latestPriceByItem,
      recetasById,
      computeRecipe,
      stack
    });

    cache.set(recetaId, computed);
    return computed;
  }

  const recetasEnriquecidas = recetas
    .filter(receta => !localStorage.getItem(`inactivo_receta_${receta.id_recetario}`))  // Filtrar recetas desactivadas en Admin
    .map((receta) => computeRecipe(receta.id_recetario))
    .filter(Boolean);
  const totalRecetas = recetasEnriquecidas.length;

  return {
    resumen: {
      totalRecetas,
      costoPromedio: roundMoney(recetasEnriquecidas.reduce((acc, item) => acc + item.costo_porcion, 0) / Math.max(totalRecetas, 1)),
      precioPromedio: roundMoney(recetasEnriquecidas.reduce((acc, item) => acc + toNumber(item.precio_venta_fijo), 0) / Math.max(totalRecetas, 1)),
      margenPromedio: roundMoney(recetasEnriquecidas.reduce((acc, item) => acc + item.margen_porcion, 0) / Math.max(totalRecetas, 1)),
      costoCompetenciaPromedio: roundMoney(recetasEnriquecidas.reduce((acc, item) => acc + item.costo_competencia_porcion, 0) / Math.max(totalRecetas, 1))
    },
    catalogo,
    catalogoSeparado,
    recetas: recetasEnriquecidas
  };
}

export async function obtenerRecetarioEscandallo({ businessId } = {}) {
  let recetasQuery = supabase
    .from('recetario')
    .select(
      'id_recetario, id_negocio, nombre_platillo, tipo_categoria, subreceta_complemento, imagen_platillo, precio_venta_fijo, rendimiento_personas, procedimiento_preparacion, tiempo_total_estimado_min'
    )
    .order('nombre_platillo', { ascending: true });

  let catalogoQuery = supabase
    .from('insumos')
    .select(
      'id_insumo, id_negocio, id_subcategoria, nombre_item, tipo_conservacion, unidad_consumo, precio_competencia_promedio, fuente_competencia, stock_actual, punto_reorden'
    )
    .order('nombre_item', { ascending: true });

  const subcategoriasQuery = supabase
    .from('subcategorias_insumos')
    .select('id_subcategoria, nombre, categorias_insumos(tipo_insumo, nombre)')
    .eq('activo', true);

  if (businessId) {
    recetasQuery = recetasQuery.eq('id_negocio', businessId);
    catalogoQuery = catalogoQuery.eq('id_negocio', businessId);
  }

  const [recetasResult, catalogoResult, subcategoriasResult] = await Promise.all([recetasQuery, catalogoQuery, subcategoriasQuery]);

  if (recetasResult.error || catalogoResult.error || subcategoriasResult.error) {
    return { data: null, error: recetasResult.error?.message || catalogoResult.error?.message || subcategoriasResult.error?.message };
  }

  const recetas = recetasResult.data || [];
  const subcategoriasById = new Map((subcategoriasResult.data || []).map((item) => [item.id_subcategoria, item]));
  const catalogo = (catalogoResult.data || []).map((item) => {
    const subcategoria = subcategoriasById.get(item.id_subcategoria);
    return {
      ...item,
      id_item: item.id_insumo,
      categoria: resolveCategoryGroup(subcategoria?.categorias_insumos?.tipo_insumo),
      subcategoria: subcategoria?.nombre || 'Sin subcategoria'
    };
  });
  const catalogoSeparado = buildCatalogoSeparado(catalogo);
  const recetaIds = recetas.map((item) => item.id_recetario);

  if (!recetas.length && businessId) {
    const demoCatalogoResult = await obtenerAlmacenCompras({ businessId });
    const demoCatalogo = demoCatalogoResult.data?.catalogo || [];
    const demoRecetas = DEMO_RECETAS.filter((item) => item.id_negocio === businessId);
    const demoEscandallos = DEMO_ESCANDALLOS.filter((item) => demoRecetas.some((receta) => receta.id_recetario === item.id_recetario));

    if (demoCatalogo.length && demoRecetas.length) {
      return {
        data: buildRecetarioResponse({
          recetas: demoRecetas,
          catalogo: demoCatalogo.map((item) => ({ ...item, id_insumo: item.id_insumo || item.id_item })),
          escandallos: demoEscandallos
        }),
        error: null
      };
    }
  }

  if (!recetaIds.length) {
    return {
      data: {
        resumen: {
          totalRecetas: 0,
          costoPromedio: 0,
          precioPromedio: 0,
          margenPromedio: 0,
          costoCompetenciaPromedio: 0
        },
        catalogo,
        catalogoSeparado,
        recetas: []
      },
      error: null
    };
  }

  const { data: escandalloBase, error: escandalloError } = await supabase
    .from('escandallo_detalle')
    .select(
      'id_escandallo, id_recetario, id_insumo, cantidad_bruta, cantidad_neta, porcentaje_merma, costo_calculado'
    )
    .in('id_recetario', recetaIds)
    .order('id_escandallo', { ascending: true });

  if (escandalloError) {
    return { data: null, error: escandalloError.message };
  }

  const escandallos = escandalloBase || [];
  const itemIds = Array.from(new Set(escandallos.map((item) => item.id_insumo).filter(Boolean)));
  const lotesResult = itemIds.length
    ? await supabase
        .from('compras_detalle')
        .select('id_insumo, costo_unitario, compras(fecha_compra)')
        .in('id_insumo', itemIds)
        .order('id_detalle', { ascending: false })
    : { data: [], error: null };

  if (lotesResult.error) {
    return { data: null, error: lotesResult.error.message };
  }

  const lotes = lotesResult.data || [];
  const itemById = new Map(catalogo.map((item) => [item.id_insumo, item]));
  const latestPriceByItem = new Map();

  lotes.forEach((lote) => {
    if (!latestPriceByItem.has(lote.id_insumo)) {
      latestPriceByItem.set(lote.id_insumo, {
        id_insumo: lote.id_insumo,
        costo_unitario: lote.costo_unitario,
        fecha_entrada: lote.compras?.fecha_compra || null
      });
    }
  });

  const recetasById = new Map(recetas.map((item) => [item.id_recetario, item]));
  const cache = new Map();

  function computeRecipe(recetaId, stack = new Set([recetaId])) {
    if (cache.has(recetaId)) {
      return cache.get(recetaId);
    }

    const receta = recetasById.get(recetaId);
    if (!receta) {
      return null;
    }

    const computed = enrichRecipe({
      receta,
      escandallos,
      itemById,
      latestPriceByItem,
      recetasById,
      computeRecipe,
      stack
    });

    cache.set(recetaId, computed);
    return computed;
  }

  return {
    data: buildRecetarioResponse({ recetas, catalogo, escandallos }),
    error: null
  };
}

export async function guardarRecetaConEscandallo({ businessId, recetaId, data }) {
  try {
    const recetaPayload = buildRecetaPayload(data, businessId);
    const detalles = sanitizeDetalles(data.detalles);

    if (!recetaPayload.nombre_platillo || !recetaPayload.tipo_categoria) {
      return { data: null, error: 'Nombre del platillo y tipo de receta son obligatorios.' };
    }

    const detallesError = validateDetalles(detalles);
    if (detallesError) {
      return { data: null, error: detallesError };
    }

    const itemIds = Array.from(new Set(detalles.map((detail) => detail.id_item).filter(Boolean)));
    const { data: catalogoItems, error: catalogoError } = itemIds.length
      ? await supabase
          .from('insumos')
          .select('id_insumo, id_subcategoria, tipo_conservacion')
          .in('id_insumo', itemIds)
      : { data: [], error: null };

    const { data: subcategoriasItems, error: subcategoriasError } = itemIds.length
      ? await supabase
          .from('subcategorias_insumos')
          .select('id_subcategoria, nombre, categorias_insumos(tipo_insumo, nombre)')
          .eq('activo', true)
      : { data: [], error: null };

    if (catalogoError || subcategoriasError) {
      return { data: null, error: catalogoError?.message || subcategoriasError?.message };
    }

    const subcategoriasLookup = new Map((subcategoriasItems || []).map((item) => [item.id_subcategoria, item]));
    const itemById = new Map(
      (catalogoItems || []).map((item) => [
        item.id_insumo,
        {
          ...item,
          categoria: resolveCategoryGroup(subcategoriasLookup.get(item.id_subcategoria)?.categorias_insumos?.tipo_insumo),
          subcategoria: subcategoriasLookup.get(item.id_subcategoria)?.nombre || 'Sin subcategoria'
        }
      ])
    );
    const detallesNormalizados = detalles.map((detail) => ({
      ...detail,
      merma_porcentaje: calcularMermaAutomatica(itemById.get(detail.id_item))
    }));

    const recetaQuery = recetaId
      ? supabase.from('recetario').update(recetaPayload).eq('id_recetario', recetaId).select().single()
      : supabase.from('recetario').insert(recetaPayload).select().single();

    const { data: recetaGuardada, error: recetaError } = await recetaQuery;

    if (recetaError) {
      return { data: null, error: recetaError.message };
    }

    const safeRecetaId = recetaGuardada.id_recetario;
    const { data: detallesActuales, error: detallesActualesError } = await supabase
      .from('escandallo_detalle')
      .select('id_escandallo')
      .eq('id_recetario', safeRecetaId);

    if (detallesActualesError) {
      return { data: null, error: detallesActualesError.message };
    }

    const idsActuales = new Set((detallesActuales || []).map((item) => item.id_escandallo));
    const idsGuardados = new Set();

    for (const detail of detallesNormalizados) {
      const payload = buildDetallePayload(detail, safeRecetaId);
      const detalleQuery = detail.id_escandallo
        ? supabase.from('escandallo_detalle').update(payload).eq('id_escandallo', detail.id_escandallo).select('id_escandallo').single()
        : supabase.from('escandallo_detalle').insert(payload).select('id_escandallo').single();

      const { data: detalleGuardado, error: detalleError } = await detalleQuery;

      if (detalleError) {
        return { data: null, error: detalleError.message };
      }

      if (detalleGuardado?.id_escandallo) {
        idsGuardados.add(detalleGuardado.id_escandallo);
      }
    }

    const idsEliminar = Array.from(idsActuales).filter((id) => !idsGuardados.has(id));
    if (idsEliminar.length) {
      const { error: deleteError } = await supabase.from('escandallo_detalle').delete().in('id_escandallo', idsEliminar);
      if (deleteError) {
        return { data: null, error: deleteError.message };
      }
    }

    return { data: recetaGuardada, error: null };
  } catch (error) {
    return { data: null, error: error.message };
  }
}

export async function eliminarRecetaConEscandallo(recetaId) {
  const { error: detalleError } = await supabase.from('escandallo_detalle').delete().eq('id_recetario', recetaId);
  if (detalleError) {
    return { error: detalleError.message };
  }

  const { error: recetaError } = await supabase.from('recetario').delete().eq('id_recetario', recetaId);
  return { error: recetaError?.message || null };
}