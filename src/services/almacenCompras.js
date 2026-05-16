import { clearDemoSessionEmail, setDemoSessionEmail, supabase } from './supabaseClient';

const DEMO_SUPER_ADMIN_EMAIL = 'super@itakt.mx';
const LOCAL_ALMACEN_OVERLAY_PREFIX = 'itakt-local-almacen-overlay';

export const CATEGORIAS_CATALOGO = [
  {
    value: 'ingredientes',
    label: 'Ingredientes',
    subcategorias: [
      'Verduras frescas',
      'Verduras',
      'Frutas',
      'Hierbas',
      'Especias',
      'Leguminosas',
      'Abarrotes',
      'Enlatados',
      'Carnes y pollo',
      'Carnes',
      'Lacteos',
      'Huevo',
      'Panificacion',
      'Panaderia',
      'Bebidas',
      'Proteina y avicola',
      'Cereales y pastas',
      'Mariscos',
      'Semillas',
      'Chiles secos',
      'Salsas y bases'
    ]
  },
  {
    value: 'complementos',
    label: 'Complementos',
    subcategorias: ['Desechables', 'Consumibles de cocina', 'Energeticos', 'Limpieza', 'Empaque', 'Manteleria', 'Decoracion']
  },
  {
    value: 'equipos',
    label: 'Equipos',
    subcategorias: ['Preparacion', 'Montaje', 'Refrigeracion', 'Servicio', 'Mobiliario', 'Ambientacion']
  }
];

export const TIPOS_CONSERVACION = ['Seco', 'Refrigerado', 'Congelado', 'Temperatura ambiente', 'No aplica'];

export const TIPOS_PROVEEDOR = [
  'Abarrotes y verduras',
  'Carnes y proteina',
  'Lacteos y refrigerados',
  'Abarrotes y cocina caliente',
  'Desechables y montaje',
  'Operacion integral catering',
  'Renta de mobiliario',
  'Renta de manteleria',
  'Renta de equipo y montaje',
  'Decoracion y ambientacion',
  'Servicio general',
  'Otro'
];

const CATEGORY_GROUP_BY_TYPE = {
  ingrediente: 'ingredientes',
  complemento: 'complementos',
  equipo: 'equipos'
};

const CATEGORY_TYPE_BY_GROUP = {
  ingredientes: 'ingrediente',
  complementos: 'complemento',
  equipos: 'complemento'
};

const SUBCATEGORY_ALIASES = {
  verduras: ['verduras frescas'],
  frutas: ['verduras frescas'],
  hierbas: ['verduras frescas'],
  especias: ['salsas y bases'],
  abarrotes: ['bases y abarrotes'],
  enlatados: ['bases y abarrotes'],
  carnes: ['carnes y pollo', 'proteinas'],
  'proteina y avicola': ['carnes y pollo', 'proteinas'],
  lacteos: ['lacteos'],
  panaderia: ['panificacion'],
  bebidas: ['bebidas'],
  mariscos: ['proteinas'],
  semillas: ['bases y abarrotes'],
  'chiles secos': ['salsas y bases'],
  'consumibles de cocina': ['desechables'],
  energeticos: ['bebidas'],
  limpieza: ['desechables'],
  empaque: ['desechables'],
  manteleria: ['desechables'],
  decoracion: ['desechables'],
  preparacion: ['desechables'],
  montaje: ['desechables'],
  refrigeracion: ['desechables'],
  servicio: ['desechables'],
  mobiliario: ['desechables'],
  ambientacion: ['desechables']
};

function normalizeQuickLookup(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

export function getQuickItemDisplayLabel(item = {}) {
  return `${item.nombre_item || ''} · ${item.subcategoria || item.categoria || 'Sin categoria'}`.trim();
}

export function findQuickCatalogMatch(catalogo = [], query = '') {
  const normalizedQuery = normalizeQuickLookup(query);
  if (!normalizedQuery) return null;

  const exactMatch = catalogo.find((item) => {
    const name = normalizeQuickLookup(item.nombre_item);
    const label = normalizeQuickLookup(getQuickItemDisplayLabel(item));
    return name === normalizedQuery || label === normalizedQuery;
  });

  if (exactMatch) return exactMatch;

  const matches = catalogo.filter((item) => {
    const name = normalizeQuickLookup(item.nombre_item);
    const label = normalizeQuickLookup(getQuickItemDisplayLabel(item));
    return name.includes(normalizedQuery) || label.includes(normalizedQuery);
  });

  return matches.length === 1 ? matches[0] : null;
}

export function inferQuickItemFields(name = '') {
  const normalized = normalizeQuickLookup(name);
  const defaults = {
    categoria: 'ingredientes',
    subcategoria: 'Abarrotes',
    tipo_conservacion: 'Seco',
    unidad_consumo: 'kg'
  };

  if (!normalized) return defaults;
  if (/(queso|parmesano|mozzarella|manchego|panela)/.test(normalized)) return { categoria: 'ingredientes', subcategoria: 'Lacteos', tipo_conservacion: 'Refrigerado', unidad_consumo: 'kg' };
  if (/(crema|leche|yogurt)/.test(normalized)) return { categoria: 'ingredientes', subcategoria: 'Lacteos', tipo_conservacion: 'Refrigerado', unidad_consumo: 'lt' };
  if (/(huevo)/.test(normalized)) return { categoria: 'ingredientes', subcategoria: 'Huevo', tipo_conservacion: 'Refrigerado', unidad_consumo: 'pieza' };
  if (/(salsa|caldo|consome|aderezo)/.test(normalized)) return { categoria: 'ingredientes', subcategoria: 'Salsas y bases', tipo_conservacion: 'Refrigerado', unidad_consumo: 'lt' };
  if (/(avellana|almendra|nuez|nuez pecana|pistache|cacahuate|ajonjoli|semilla)/.test(normalized)) return { categoria: 'ingredientes', subcategoria: 'Semillas', tipo_conservacion: 'Seco', unidad_consumo: 'kg' };
  if (/(canela|pimienta|comino|oregano|paprika|especia|especias|vainilla|anis|clavo)/.test(normalized)) return { categoria: 'ingredientes', subcategoria: 'Especias', tipo_conservacion: 'Seco', unidad_consumo: 'kg' };
  if (/(cacao|cocoa|chocolate|cajeta|mermelada|jarabe|azucar glass|sprinkle|gragea|postre)/.test(normalized)) return { categoria: 'ingredientes', subcategoria: 'Abarrotes', tipo_conservacion: 'Seco', unidad_consumo: 'kg' };
  if (/(^|\b)(jugo|agua|refresco)(\b|$)/.test(normalized)) return { categoria: 'complementos', subcategoria: 'Bebidas', tipo_conservacion: /(^|\b)(agua|refresco)(\b|$)/.test(normalized) ? 'Temperatura ambiente' : 'Refrigerado', unidad_consumo: 'lt' };
  if (/(cafe|cafe molido|te )/.test(normalized)) return { categoria: 'complementos', subcategoria: 'Bebidas', tipo_conservacion: 'Seco', unidad_consumo: 'kg' };
  if (/(pan dulce|galleta|galletas)/.test(normalized)) return { categoria: 'complementos', subcategoria: 'Panificacion', tipo_conservacion: 'Seco', unidad_consumo: 'caja' };
  if (/(bolillo|pan )/.test(normalized)) return { categoria: 'complementos', subcategoria: 'Panificacion', tipo_conservacion: 'Temperatura ambiente', unidad_consumo: 'pieza' };
  if (/(vaso|plato|cubierto|servilleta|desech|bolsa|contenedor|tapa)/.test(normalized)) return { categoria: 'complementos', subcategoria: 'Desechables', tipo_conservacion: 'No aplica', unidad_consumo: 'paquete' };
  if (/(mantel|mesa|silla|charola|hielera|equipo)/.test(normalized)) return { categoria: 'equipos', subcategoria: 'Manteleria', tipo_conservacion: 'No aplica', unidad_consumo: 'pieza' };
  if (/(pollo|carne|res|cerdo|pescado|camaron|marisc)/.test(normalized)) return { categoria: 'ingredientes', subcategoria: 'Carnes y pollo', tipo_conservacion: 'Refrigerado', unidad_consumo: 'kg' };
  if (/(cilantro|perejil|hierba|epazote)/.test(normalized)) return { categoria: 'ingredientes', subcategoria: 'Hierbas', tipo_conservacion: 'Refrigerado', unidad_consumo: 'kg' };
  if (/(lechuga)/.test(normalized)) return { categoria: 'ingredientes', subcategoria: 'Verduras frescas', tipo_conservacion: 'Refrigerado', unidad_consumo: 'pieza' };
  if (/(jitomate|tomate|cebolla|ajo|aguacate|pepino|zanahoria|papa|verdura|chile)/.test(normalized)) return { categoria: 'ingredientes', subcategoria: 'Verduras frescas', tipo_conservacion: 'Temperatura ambiente', unidad_consumo: 'kg' };
  if (/(frijol|lenteja|garbanzo)/.test(normalized)) return { categoria: 'ingredientes', subcategoria: 'Leguminosas', tipo_conservacion: 'Seco', unidad_consumo: 'kg' };
  return defaults;
}

export function getQuickProviderDisplayLabel(provider = {}) {
  return `${provider.nombre_prov || ''} · ${provider.tipo_proveedor || 'Sin tipo'}`.trim();
}

export function findQuickProviderMatch(proveedores = [], query = '') {
  const normalizedQuery = normalizeQuickLookup(query);
  if (!normalizedQuery) return null;

  const exactMatch = proveedores.find((item) => {
    const name = normalizeQuickLookup(item.nombre_prov);
    const label = normalizeQuickLookup(getQuickProviderDisplayLabel(item));
    return name === normalizedQuery || label === normalizedQuery;
  });

  if (exactMatch) return exactMatch;

  const matches = proveedores.filter((item) => {
    const name = normalizeQuickLookup(item.nombre_prov);
    const label = normalizeQuickLookup(getQuickProviderDisplayLabel(item));
    const address = normalizeQuickLookup(item.direccion_prov);
    return name.includes(normalizedQuery) || label.includes(normalizedQuery) || address.includes(normalizedQuery);
  });

  return matches.length === 1 ? matches[0] : null;
}

export function inferQuickProviderFields(name = '') {
  const normalized = normalizeQuickLookup(name);
  if (/(desech|vaso|plato|cubierto|servilleta|montaje)/.test(normalized)) return { tipo_proveedor: 'Desechables y montaje' };
  if (/(carne|pollo|proteina|carnicer)/.test(normalized)) return { tipo_proveedor: 'Carnes y proteina' };
  if (/(lacteo|queso|crema|refrigerad)/.test(normalized)) return { tipo_proveedor: 'Lacteos y refrigerados' };
  if (/(avellana|almendra|nuez|semilla|especia|condimento|repost|pasteler|postre|chocolate)/.test(normalized)) return { tipo_proveedor: 'Abarrotes y verduras' };
  if (/(mercado|abasto|verdura|fruta|abarrote)/.test(normalized)) return { tipo_proveedor: 'Abarrotes y verduras' };
  if (/(mantel|mobiliario|silla|mesa)/.test(normalized)) return { tipo_proveedor: 'Renta de manteleria' };
  if (/(evento|banquete|catering)/.test(normalized)) return { tipo_proveedor: 'Operacion integral catering' };
  if (/(cocina|caliente)/.test(normalized)) return { tipo_proveedor: 'Abarrotes y cocina caliente' };
  return { tipo_proveedor: 'Otro' };
}

const DEMO_CATALOG_ITEMS = [
  { id_item: 1, businessId: 1, nombre_item: 'Totopo de maiz', categoria: 'ingredientes', subcategoria: 'Maiz y botanas', tipo_conservacion: 'Seco', unidad_consumo: 'kg', stock_actual: 18, punto_reorden: 6, precio_competencia_promedio: 55, fuente_competencia: 'Mercado local' },
  { id_item: 2, businessId: 1, nombre_item: 'Salsa verde base', categoria: 'ingredientes', subcategoria: 'Salsas y bases', tipo_conservacion: 'Refrigerado', unidad_consumo: 'lt', stock_actual: 8, punto_reorden: 3, precio_competencia_promedio: 65, fuente_competencia: 'Mercado local' },
  { id_item: 3, businessId: 1, nombre_item: 'Crema', categoria: 'ingredientes', subcategoria: 'Lacteos', tipo_conservacion: 'Refrigerado', unidad_consumo: 'lt', stock_actual: 5, punto_reorden: 2, precio_competencia_promedio: 48, fuente_competencia: 'Mercado local' },
  { id_item: 4, businessId: 1, nombre_item: 'Queso fresco', categoria: 'ingredientes', subcategoria: 'Lacteos', tipo_conservacion: 'Refrigerado', unidad_consumo: 'kg', stock_actual: 6, punto_reorden: 2, precio_competencia_promedio: 110, fuente_competencia: 'Mercado local' },
  { id_item: 5, businessId: 1, nombre_item: 'Pollo deshebrado', categoria: 'ingredientes', subcategoria: 'Carnes y pollo', tipo_conservacion: 'Refrigerado', unidad_consumo: 'kg', stock_actual: 9, punto_reorden: 3, precio_competencia_promedio: 130, fuente_competencia: 'Mercado local' },
  { id_item: 6, businessId: 1, nombre_item: 'Aguacate', categoria: 'ingredientes', subcategoria: 'Verduras frescas', tipo_conservacion: 'Temperatura ambiente', unidad_consumo: 'kg', stock_actual: 1, punto_reorden: 4, precio_competencia_promedio: 95, fuente_competencia: 'Mercado local' },
  { id_item: 7, businessId: 1, nombre_item: 'Lechuga romana', categoria: 'ingredientes', subcategoria: 'Verduras frescas', tipo_conservacion: 'Refrigerado', unidad_consumo: 'pieza', stock_actual: 0, punto_reorden: 6, precio_competencia_promedio: 18, fuente_competencia: 'Mercado local' },
  { id_item: 8, businessId: 1, nombre_item: 'Jitomate saladet', categoria: 'ingredientes', subcategoria: 'Verduras frescas', tipo_conservacion: 'Temperatura ambiente', unidad_consumo: 'kg', stock_actual: 4, punto_reorden: 3, precio_competencia_promedio: 28, fuente_competencia: 'Mercado local' },
  { id_item: 9, businessId: 1, nombre_item: 'Tortilla de maiz', categoria: 'ingredientes', subcategoria: 'Maiz y botanas', tipo_conservacion: 'Temperatura ambiente', unidad_consumo: 'kg', stock_actual: 12, punto_reorden: 5, precio_competencia_promedio: 24, fuente_competencia: 'Mercado local' },
  { id_item: 10, businessId: 1, nombre_item: 'Carne al pastor', categoria: 'ingredientes', subcategoria: 'Carnes y pollo', tipo_conservacion: 'Refrigerado', unidad_consumo: 'kg', stock_actual: 7, punto_reorden: 3, precio_competencia_promedio: 145, fuente_competencia: 'Mercado local' },
  { id_item: 11, businessId: 1, nombre_item: 'Cilantro', categoria: 'ingredientes', subcategoria: 'Verduras frescas', tipo_conservacion: 'Refrigerado', unidad_consumo: 'kg', stock_actual: 1.5, punto_reorden: 1, precio_competencia_promedio: 60, fuente_competencia: 'Mercado local' },
  { id_item: 12, businessId: 1, nombre_item: 'Cebolla blanca', categoria: 'ingredientes', subcategoria: 'Verduras frescas', tipo_conservacion: 'Temperatura ambiente', unidad_consumo: 'kg', stock_actual: 4.5, punto_reorden: 2, precio_competencia_promedio: 25, fuente_competencia: 'Mercado local' },
  { id_item: 13, businessId: 1, nombre_item: 'Frijol refrito', categoria: 'ingredientes', subcategoria: 'Leguminosas', tipo_conservacion: 'Refrigerado', unidad_consumo: 'kg', stock_actual: 9, punto_reorden: 3, precio_competencia_promedio: 42, fuente_competencia: 'Mercado local' },
  { id_item: 14, businessId: 1, nombre_item: 'Huevo', categoria: 'ingredientes', subcategoria: 'Huevo', tipo_conservacion: 'Refrigerado', unidad_consumo: 'pieza', stock_actual: 60, punto_reorden: 24, precio_competencia_promedio: 3.5, fuente_competencia: 'Mercado local' },
  { id_item: 15, businessId: 1, nombre_item: 'Pan bolillo', categoria: 'complementos', subcategoria: 'Panificacion', tipo_conservacion: 'Temperatura ambiente', unidad_consumo: 'pieza', stock_actual: 35, punto_reorden: 10, precio_competencia_promedio: 2.5, fuente_competencia: 'Mercado local' },
  { id_item: 21, businessId: 2, nombre_item: 'Cafe molido', categoria: 'complementos', subcategoria: 'Bebidas', tipo_conservacion: 'Seco', unidad_consumo: 'kg', stock_actual: 3, punto_reorden: 1, precio_competencia_promedio: 180, fuente_competencia: 'Distribuidor local' },
  { id_item: 22, businessId: 2, nombre_item: 'Pan dulce surtido', categoria: 'complementos', subcategoria: 'Panificacion', tipo_conservacion: 'Temperatura ambiente', unidad_consumo: 'caja', stock_actual: 4, punto_reorden: 2, precio_competencia_promedio: 160, fuente_competencia: 'Distribuidor local' },
  { id_item: 23, businessId: 2, nombre_item: 'Jugo naranja', categoria: 'complementos', subcategoria: 'Bebidas', tipo_conservacion: 'Refrigerado', unidad_consumo: 'lt', stock_actual: 12, punto_reorden: 4, precio_competencia_promedio: 38, fuente_competencia: 'Distribuidor local' },
  { id_item: 24, businessId: 2, nombre_item: 'Vasos desechables', categoria: 'complementos', subcategoria: 'Desechables', tipo_conservacion: 'No aplica', unidad_consumo: 'paquete', stock_actual: 15, punto_reorden: 4, precio_competencia_promedio: 45, fuente_competencia: 'Distribuidor local' },
  { id_item: 25, businessId: 2, nombre_item: 'Pechuga de pollo', categoria: 'ingredientes', subcategoria: 'Carnes y pollo', tipo_conservacion: 'Refrigerado', unidad_consumo: 'kg', stock_actual: 10, punto_reorden: 4, precio_competencia_promedio: 128, fuente_competencia: 'Distribuidor local' },
  { id_item: 26, businessId: 2, nombre_item: 'Arroz', categoria: 'ingredientes', subcategoria: 'Cereales y pastas', tipo_conservacion: 'Seco', unidad_consumo: 'kg', stock_actual: 14, punto_reorden: 4, precio_competencia_promedio: 32, fuente_competencia: 'Distribuidor local' },
  { id_item: 27, businessId: 2, nombre_item: 'Verduras mixtas', categoria: 'ingredientes', subcategoria: 'Verduras frescas', tipo_conservacion: 'Refrigerado', unidad_consumo: 'kg', stock_actual: 2, punto_reorden: 4, precio_competencia_promedio: 52, fuente_competencia: 'Distribuidor local' },
  { id_item: 28, businessId: 2, nombre_item: 'Crema catering', categoria: 'ingredientes', subcategoria: 'Lacteos', tipo_conservacion: 'Refrigerado', unidad_consumo: 'lt', stock_actual: 4, punto_reorden: 2, precio_competencia_promedio: 50, fuente_competencia: 'Distribuidor local' },
  { id_item: 29, businessId: 2, nombre_item: 'Pasta penne', categoria: 'ingredientes', subcategoria: 'Cereales y pastas', tipo_conservacion: 'Seco', unidad_consumo: 'kg', stock_actual: 8, punto_reorden: 3, precio_competencia_promedio: 48, fuente_competencia: 'Distribuidor local' },
  { id_item: 30, businessId: 2, nombre_item: 'Queso parmesano', categoria: 'ingredientes', subcategoria: 'Lacteos', tipo_conservacion: 'Refrigerado', unidad_consumo: 'kg', stock_actual: 3, punto_reorden: 1, precio_competencia_promedio: 180, fuente_competencia: 'Distribuidor local' },
  { id_item: 31, businessId: 2, nombre_item: 'Agua natural', categoria: 'complementos', subcategoria: 'Bebidas', tipo_conservacion: 'Temperatura ambiente', unidad_consumo: 'lt', stock_actual: 40, punto_reorden: 10, precio_competencia_promedio: 12, fuente_competencia: 'Distribuidor local' },
  { id_item: 32, businessId: 2, nombre_item: 'Platos desechables', categoria: 'complementos', subcategoria: 'Desechables', tipo_conservacion: 'No aplica', unidad_consumo: 'paquete', stock_actual: 18, punto_reorden: 5, precio_competencia_promedio: 55, fuente_competencia: 'Distribuidor local' },
  { id_item: 33, businessId: 2, nombre_item: 'Cubiertos desechables', categoria: 'complementos', subcategoria: 'Desechables', tipo_conservacion: 'No aplica', unidad_consumo: 'paquete', stock_actual: 22, punto_reorden: 5, precio_competencia_promedio: 40, fuente_competencia: 'Distribuidor local' },
  { id_item: 34, businessId: 2, nombre_item: 'Mantel blanco', categoria: 'equipos', subcategoria: 'Manteleria', tipo_conservacion: 'No aplica', unidad_consumo: 'pieza', stock_actual: 12, punto_reorden: 3, precio_competencia_promedio: 220, fuente_competencia: 'Distribuidor local' },
  { id_item: 35, businessId: 2, nombre_item: 'Galletas surtidas', categoria: 'complementos', subcategoria: 'Panificacion', tipo_conservacion: 'Seco', unidad_consumo: 'caja', stock_actual: 10, punto_reorden: 3, precio_competencia_promedio: 75, fuente_competencia: 'Distribuidor local' }
];

const DEMO_PROVIDERS = [
  { id_proveedor: 1, businessId: 1, nombre_prov: 'Central de Abastos Norte', tipo_proveedor: 'Abarrotes y verduras', telefono_prov: '5510101010', correo_prov: 'abastos@norte.com', direccion_prov: 'Bodega 14, Mercado Norte' },
  { id_proveedor: 2, businessId: 1, nombre_prov: 'Carnes Selectas Luna', tipo_proveedor: 'Carnes y proteina', telefono_prov: '5510101011', correo_prov: 'ventas@luna.com', direccion_prov: 'Pasillo Carnes, Local 8' },
  { id_proveedor: 3, businessId: 1, nombre_prov: 'Lacteos La Granja', tipo_proveedor: 'Lacteos y refrigerados', telefono_prov: '5510101012', correo_prov: 'pedidos@lagranja.com', direccion_prov: 'Zona Fria, Nave 2' },
  { id_proveedor: 4, businessId: 2, nombre_prov: 'Eventos y Banquetes MX', tipo_proveedor: 'Operacion catering', telefono_prov: '5520202020', correo_prov: 'operacion@banquetesmx.com', direccion_prov: 'Av. Eventos 100' },
  { id_proveedor: 5, businessId: 2, nombre_prov: 'Desechables y Servicio Total', tipo_proveedor: 'Desechables y montaje', telefono_prov: '5520202021', correo_prov: 'contacto@serviciototal.com', direccion_prov: 'Parque Industrial Oriente' },
  { id_proveedor: 6, businessId: 2, nombre_prov: 'Cocina para Evento Food', tipo_proveedor: 'Abarrotes y cocina caliente', telefono_prov: '5520202022', correo_prov: 'cocina@eventofood.com', direccion_prov: 'Nave 6, Zona Catering' }
];

const DEMO_PURCHASES = [
  { id_compra: 1, businessId: 1, id_proveedor: 1, folio_externo: 'COMP-REST-001', modulo: 'restaurante', daysAgo: 7, responsable: 'Carlos Mendez', observaciones: 'Resurtido semanal de abarrotes y tortilla', detalles: [{ id_lote: 1, id_item: 1, cantidad: 12, unidad: 'kg', precio: 52 }, { id_lote: 2, id_item: 2, cantidad: 6, unidad: 'lt', precio: 58 }, { id_lote: 3, id_item: 9, cantidad: 15, unidad: 'kg', precio: 22 }] },
  { id_compra: 2, businessId: 1, id_proveedor: 2, folio_externo: 'COMP-REST-002', modulo: 'restaurante', daysAgo: 5, responsable: 'Carlos Mendez', observaciones: 'Carnes para produccion semanal', detalles: [{ id_lote: 4, id_item: 5, cantidad: 5, unidad: 'kg', precio: 124 }, { id_lote: 5, id_item: 10, cantidad: 4, unidad: 'kg', precio: 138 }] },
  { id_compra: 3, businessId: 1, id_proveedor: 3, folio_externo: 'COMP-REST-003', modulo: 'restaurante', daysAgo: 3, responsable: 'Ana Cocina', observaciones: 'Lacteos refrigerados', detalles: [{ id_lote: 6, id_item: 3, cantidad: 4, unidad: 'lt', precio: 45 }, { id_lote: 7, id_item: 4, cantidad: 3, unidad: 'kg', precio: 104 }] },
  { id_compra: 4, businessId: 2, id_proveedor: 4, folio_externo: 'COMP-CAT-001', modulo: 'catering', daysAgo: 6, responsable: 'Fernanda Torres', observaciones: 'Insumos para eventos de la semana', detalles: [{ id_lote: 8, id_item: 25, cantidad: 6, unidad: 'kg', precio: 121 }, { id_lote: 9, id_item: 26, cantidad: 8, unidad: 'kg', precio: 28 }, { id_lote: 10, id_item: 27, cantidad: 2, unidad: 'kg', precio: 49 }] },
  { id_compra: 5, businessId: 2, id_proveedor: 5, folio_externo: 'COMP-CAT-002', modulo: 'catering', daysAgo: 4, responsable: 'Rodrigo Campo', observaciones: 'Desechables para buffet y coffee break', detalles: [{ id_lote: 11, id_item: 32, cantidad: 10, unidad: 'paquete', precio: 48 }, { id_lote: 12, id_item: 33, cantidad: 10, unidad: 'paquete', precio: 36 }, { id_lote: 13, id_item: 24, cantidad: 5, unidad: 'paquete', precio: 40 }] },
  { id_compra: 6, businessId: 2, id_proveedor: 6, folio_externo: 'COMP-CAT-003', modulo: 'catering', daysAgo: 2, responsable: 'Fernanda Torres', observaciones: 'Lacteos y pasta para banquete de boda', detalles: [{ id_lote: 14, id_item: 29, cantidad: 5, unidad: 'kg', precio: 44 }, { id_lote: 15, id_item: 30, cantidad: 2, unidad: 'kg', precio: 172 }, { id_lote: 16, id_item: 28, cantidad: 3, unidad: 'lt', precio: 48 }] }
];

function normalizeText(value) {
  return String(value || '').trim();
}

export function toLocalDateKey(value = new Date()) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '';
  }

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getLocalAlmacenOverlayKey(businessId) {
  return `${LOCAL_ALMACEN_OVERLAY_PREFIX}-${businessId || 'sin-negocio'}`;
}

function getEmptyLocalAlmacenOverlay() {
  return {
    catalogo: [],
    proveedores: [],
    lotes: []
  };
}

function readLocalAlmacenOverlay(businessId) {
  if (typeof window === 'undefined' || !businessId) {
    return getEmptyLocalAlmacenOverlay();
  }

  try {
    const raw = window.localStorage.getItem(getLocalAlmacenOverlayKey(businessId));
    if (!raw) {
      return getEmptyLocalAlmacenOverlay();
    }

    const parsed = JSON.parse(raw);
    return {
      catalogo: Array.isArray(parsed?.catalogo) ? parsed.catalogo : [],
      proveedores: Array.isArray(parsed?.proveedores) ? parsed.proveedores : [],
      lotes: Array.isArray(parsed?.lotes) ? parsed.lotes : []
    };
  } catch {
    return getEmptyLocalAlmacenOverlay();
  }
}

function writeLocalAlmacenOverlay(businessId, overlay) {
  if (typeof window === 'undefined' || !businessId) {
    return;
  }

  window.localStorage.setItem(getLocalAlmacenOverlayKey(businessId), JSON.stringify(overlay));
}

function buildLocalCatalogItem(item, businessId) {
  const stockActual = Number(item.stock_actual || 0);
  const puntoReorden = Number(item.punto_reorden || 0);
  const categoria = item.categoria || 'ingredientes';

  return {
    id_item: item.id_item,
    id_insumo: item.id_insumo || item.id_item,
    id_negocio: businessId,
    nombre_item: item.nombre_item,
    categoria,
    subcategoria: item.subcategoria || 'Sin subcategoria',
    tipo_conservacion: item.tipo_conservacion || 'Seco',
    unidad_consumo: item.unidad_consumo || 'kg',
    stock_actual: stockActual,
    punto_reorden: puntoReorden,
    es_inventariable: true,
    precio_competencia_promedio: Number(item.precio_competencia_promedio || 0),
    fuente_competencia: item.fuente_competencia || 'Captura local',
    fecha_analisis_mercado: item.fecha_analisis_mercado || new Date().toISOString().slice(0, 10),
    ultimo_precio_compra: item.ultimo_precio_compra || null,
    grupo: getCategoriaGrupo(categoria),
    stock_minimo_interno: getStockMinimoInterno(stockActual, puntoReorden),
    stock_maximo_interno: getStockMaximoInterno(stockActual, puntoReorden),
    punto_reorden_interno: getPuntoReordenInterno(stockActual, puntoReorden),
    semaforo: getSemaforo(stockActual, puntoReorden)
  };
}

function buildLocalProvider(provider, businessId) {
  return {
    id_proveedor: provider.id_proveedor,
    id_negocio: businessId,
    nombre_prov: provider.nombre_prov,
    tipo_proveedor: provider.tipo_proveedor || 'Otro',
    telefono_prov: provider.telefono_prov || '',
    correo_prov: provider.correo_prov || '',
    direccion_prov: provider.direccion_prov || ''
  };
}

function mergeLocalAlmacenOverlay(baseData, businessId) {
  const overlay = readLocalAlmacenOverlay(businessId);
  if (!overlay.catalogo.length && !overlay.proveedores.length && !overlay.lotes.length) {
    return baseData;
  }

  const catalogoMap = new Map((baseData.catalogo || []).map((item) => [String(item.id_item), { ...item }]));
  overlay.catalogo.forEach((item) => {
    catalogoMap.set(String(item.id_item), buildLocalCatalogItem(item, businessId));
  });

  const proveedoresMap = new Map((baseData.proveedores || []).map((item) => [String(item.id_proveedor), { ...item }]));
  overlay.proveedores.forEach((item) => {
    // NO agregar proveedores inactivos del overlay
    if (item.activo === false) {
      // Si fue desactivado, eliminarlo del mapa
      proveedoresMap.delete(String(item.id_proveedor));
      return;
    }
    proveedoresMap.set(String(item.id_proveedor), buildLocalProvider(item, businessId));
  });

  const lotes = [...(baseData.lotes || []), ...overlay.lotes].sort((a, b) => {
    const left = a.fecha_entrada ? new Date(a.fecha_entrada).getTime() : 0;
    const right = b.fecha_entrada ? new Date(b.fecha_entrada).getTime() : 0;
    return right - left;
  });

  lotes.forEach((lote) => {
    if (lote.estatus !== 'recibida') {
      return;
    }

    const catalogItem = catalogoMap.get(String(lote.id_item));
    if (!catalogItem) return;
    catalogItem.stock_actual = Number((Number(catalogItem.stock_actual || 0) + Number(lote.cantidad_recibida || 0)).toFixed(3));
    catalogItem.ultimo_precio_compra = lote.precio_unitario_compra;
    catalogItem.stock_minimo_interno = getStockMinimoInterno(catalogItem.stock_actual, catalogItem.punto_reorden);
    catalogItem.stock_maximo_interno = getStockMaximoInterno(catalogItem.stock_actual, catalogItem.punto_reorden);
    catalogItem.punto_reorden_interno = getPuntoReordenInterno(catalogItem.stock_actual, catalogItem.punto_reorden);
    catalogItem.semaforo = getSemaforo(catalogItem.stock_actual, catalogItem.punto_reorden);
  });

  const catalogo = Array.from(catalogoMap.values()).sort((a, b) => String(a.nombre_item).localeCompare(String(b.nombre_item), 'es'));
  const proveedores = Array.from(proveedoresMap.values())
    .filter(p => {
      // Excluir proveedores inactivos por campo activo
      if (p.activo === false) return false;
      // Excluir proveedores marcados como inactivos en localStorage
      const inactivoKey = `inactivo_prov_${p.id_proveedor}`;
      return !localStorage.getItem(inactivoKey);
    })
    .sort((a, b) => String(a.nombre_prov).localeCompare(String(b.nombre_prov), 'es'));
  
  // Filtrar equipos también por localStorage
  const equiposFiltrados = (baseData.equipos || []).filter(e => {
    const inactivoKey = `inactivo_equip_${e.id_equipo}`;
    return !localStorage.getItem(inactivoKey);
  });
  const hoy = toLocalDateKey();
  const comprasHoy = lotes.filter((item) => toLocalDateKey(item.fecha_compra_dia || item.fecha_entrada) === hoy);

  return {
    resumen: {
      totalItems: catalogo.length,
      ingredientes: catalogo.filter((item) => item.grupo === 'ingredientes').length,
      equipos: equiposFiltrados.length,
      complementos: catalogo.filter((item) => item.grupo === 'complementos').length,
      proveedores: proveedores.length,
      lotes: lotes.length,
      totalCompraHoy: comprasHoy.reduce((acc, lote) => acc + Number(lote.total_lote || 0), 0),
      comprasHoy: comprasHoy.length
    },
    catalogo,
    proveedores,
    equipos: equiposFiltrados,
    lotes,
    comprasHoy
  };
}

function getNextLocalTempId(overlay) {
  const ids = [];

  (overlay.catalogo || []).forEach((item) => {
    ids.push(Number(item.id_item));
    ids.push(Number(item.id_insumo));
  });

  (overlay.proveedores || []).forEach((item) => {
    ids.push(Number(item.id_proveedor));
  });

  (overlay.lotes || []).forEach((item) => {
    ids.push(Number(item.id_lote));
    ids.push(Number(item.id_compra));
    ids.push(Number(item.id_item));
    ids.push(Number(item.id_insumo));
    ids.push(Number(item.id_proveedor));
  });

  const negativeIds = ids.filter((value) => Number.isInteger(value) && value < 0);
  const currentMin = negativeIds.length ? Math.min(...negativeIds) : 0;
  return currentMin - 1;
}

function buildLocalFallbackRefs({ overlay, data, generatedId }) {
  const inferredItem = inferQuickItemFields(data.item_nuevo?.nombre_item || data.item_query || '');
  const inferredProvider = inferQuickProviderFields(data.proveedor_nuevo?.nombre_prov || data.provider_query || '');
  const itemName = normalizeText(data.item_nuevo?.nombre_item || String(data.item_query || '').split('·')[0]);
  const providerName = normalizeText(data.proveedor_nuevo?.nombre_prov || String(data.provider_query || '').split('·')[0]);

  let itemId = data.id_item ? Number(data.id_item) : null;
  if (!itemId) {
    itemId = generatedId;
    overlay.catalogo.push({
      id_item: itemId,
      id_insumo: itemId,
      nombre_item: itemName,
      categoria: data.item_nuevo?.categoria || inferredItem.categoria,
      subcategoria: data.item_nuevo?.subcategoria || inferredItem.subcategoria,
      tipo_conservacion: data.item_nuevo?.tipo_conservacion || inferredItem.tipo_conservacion,
      unidad_consumo: normalizeText(data.unidad_compra) || data.item_nuevo?.unidad_consumo || inferredItem.unidad_consumo,
      stock_actual: 0,
      punto_reorden: toNumberOrNull(data.item_nuevo?.punto_reorden) || 0,
      precio_competencia_promedio: toNumberOrNull(data.item_nuevo?.precio_competencia_promedio) || toNumberOrNull(data.precio_unitario_compra) || 0,
      fuente_competencia: data.item_nuevo?.fuente_competencia || 'Compra local bloqueada por RLS'
    });
  }

  let providerId = data.id_proveedor ? Number(data.id_proveedor) : null;
  if (!providerId) {
    providerId = generatedId - 1;
    overlay.proveedores.push({
      id_proveedor: providerId,
      nombre_prov: providerName,
      tipo_proveedor: data.proveedor_nuevo?.tipo_proveedor || inferredProvider.tipo_proveedor,
      telefono_prov: data.proveedor_nuevo?.telefono_prov || '',
      correo_prov: data.proveedor_nuevo?.correo_prov || '',
      direccion_prov: data.proveedor_nuevo?.direccion_prov || ''
    });
  }

  return {
    itemId,
    providerId,
    itemName,
    providerName,
    inferredItem,
    inferredProvider
  };
}

function updateLocalFallbackPurchase({ businessId, loteId, data }) {
  const overlay = readLocalAlmacenOverlay(businessId);
  const loteIndex = (overlay.lotes || []).findIndex((item) => Number(item.id_compra || item.id_lote) === Number(loteId));

  if (loteIndex < 0) {
    return buildLocalFallbackPurchase({ businessId, data });
  }

  const generatedId = getNextLocalTempId(overlay);
  const now = new Date();
  const shouldApplyInventory = data.applyInventory === true;
  const existingLote = overlay.lotes[loteIndex];
  const refs = buildLocalFallbackRefs({ overlay, data, generatedId });

  const updatedLote = {
    ...existingLote,
    id_insumo: refs.itemId,
    id_item: refs.itemId,
    id_proveedor: refs.providerId,
    cantidad_recibida: Number(data.cantidad_recibida || 0),
    precio_unitario_compra: Number(data.precio_unitario_compra || 0),
    folio_externo: normalizeText(data.folio_externo) || null,
    fecha_entrada: data.fecha_entrada || existingLote.fecha_entrada || now.toISOString(),
    fecha_compra_dia: toLocalDateKey(data.fecha_entrada || existingLote.fecha_entrada || now),
    observaciones_compra: normalizeText(data.observaciones_compra) || null,
    modulo: data.modulo || existingLote.modulo || 'restaurante',
    estatus: shouldApplyInventory ? 'recibida' : 'pendiente_recepcion',
    responsable: normalizeText(data.responsable_registro) || existingLote.responsable || null,
    total_lote: Number((Number(data.cantidad_recibida || 0) * Number(data.precio_unitario_compra || 0)).toFixed(2)),
    item_nombre: refs.itemName,
    item_subcategoria: data.item_nuevo?.subcategoria || refs.inferredItem.subcategoria,
    unidad_consumo: normalizeText(data.unidad_compra) || data.item_nuevo?.unidad_consumo || refs.inferredItem.unidad_consumo,
    proveedor_nombre: refs.providerName,
    proveedor_tipo: data.proveedor_nuevo?.tipo_proveedor || refs.inferredProvider.tipo_proveedor
  };

  overlay.lotes[loteIndex] = updatedLote;
  writeLocalAlmacenOverlay(businessId, overlay);
  return { data: updatedLote, error: null, localFallback: true };
}

function buildLocalFallbackPurchase({ businessId, data }) {
  const overlay = readLocalAlmacenOverlay(businessId);
  const now = new Date();
  const generatedId = getNextLocalTempId(overlay);
  const shouldApplyInventory = data.applyInventory === true;
  const refs = buildLocalFallbackRefs({ overlay, data, generatedId });

  const lote = {
    id_lote: generatedId - 2,
    id_compra: generatedId - 2,
    id_insumo: refs.itemId,
    id_item: refs.itemId,
    id_proveedor: refs.providerId,
    cantidad_recibida: Number(data.cantidad_recibida || 0),
    precio_unitario_compra: Number(data.precio_unitario_compra || 0),
    folio_externo: normalizeText(data.folio_externo) || null,
    fecha_entrada: data.fecha_entrada || now.toISOString(),
    fecha_compra_dia: toLocalDateKey(data.fecha_entrada || now),
    observaciones_compra: normalizeText(data.observaciones_compra) || null,
    modulo: data.modulo || 'restaurante',
    estatus: shouldApplyInventory ? 'recibida' : 'pendiente_recepcion',
    responsable: normalizeText(data.responsable_registro) || null,
    total_lote: Number((Number(data.cantidad_recibida || 0) * Number(data.precio_unitario_compra || 0)).toFixed(2)),
    item_nombre: refs.itemName,
    item_subcategoria: data.item_nuevo?.subcategoria || refs.inferredItem.subcategoria,
    unidad_consumo: normalizeText(data.unidad_compra) || data.item_nuevo?.unidad_consumo || refs.inferredItem.unidad_consumo,
    proveedor_nombre: refs.providerName,
    proveedor_tipo: data.proveedor_nuevo?.tipo_proveedor || refs.inferredProvider.tipo_proveedor
  };

  overlay.lotes.unshift(lote);
  writeLocalAlmacenOverlay(businessId, overlay);
  return { data: lote, error: null, localFallback: true };
}

function isRlsInsertError(message = '') {
  return String(message || '').toLowerCase().includes('row-level security');
}

function resolveCurrentDemoEmail() {
  if (typeof window === 'undefined') {
    return '';
  }

  return window.localStorage.getItem('itakt_demo_email') || '';
}

async function withTemporaryDemoEmail(email, callback) {
  const currentEmail = resolveCurrentDemoEmail();
  const normalizedTargetEmail = normalizeText(email).toLowerCase();
  const normalizedCurrentEmail = normalizeText(currentEmail).toLowerCase();

  if (!normalizedTargetEmail || normalizedTargetEmail === normalizedCurrentEmail) {
    return callback();
  }

  setDemoSessionEmail(normalizedTargetEmail);

  try {
    return await callback();
  } finally {
    if (normalizedCurrentEmail) {
      setDemoSessionEmail(normalizedCurrentEmail);
    } else {
      clearDemoSessionEmail();
    }
  }
}

function normalizeCategoria(value) {
  return normalizeText(value).toLowerCase();
}

function normalizeCategoryType(value) {
  return CATEGORY_TYPE_BY_GROUP[normalizeCategoria(value)] || normalizeCategoria(value) || 'ingrediente';
}

function resolveCategoryGroup(value) {
  return CATEGORY_GROUP_BY_TYPE[normalizeCategoria(value)] || getCategoriaGrupo(value);
}

function getCandidateSubcategoryNames(value) {
  const normalized = normalizeCategoria(value);
  const aliases = SUBCATEGORY_ALIASES[normalized] || [];
  return [normalized, ...aliases];
}

function isSubcategoryMatch(requestedName, databaseName) {
  const requested = normalizeCategoria(requestedName);
  const database = normalizeCategoria(databaseName);

  if (!requested || !database) {
    return false;
  }

  if (requested === database) {
    return true;
  }

  return getCandidateSubcategoryNames(requested).some(
    (candidate) => candidate === database || candidate.includes(database) || database.includes(candidate)
  );
}

function toNumberOrNull(value) {
  if (value === '' || value === null || value === undefined) {
    return null;
  }

  const parsed = Number(value);
  return Number.isNaN(parsed) ? null : parsed;
}

function getCategoriaGrupo(categoria) {
  const normalized = normalizeCategoria(categoria);

  if (normalized.includes('equipo') || normalized.includes('herramienta')) {
    return 'equipos';
  }

  if (normalized.includes('complemento') || normalized.includes('desech') || normalized.includes('consum')) {
    return 'complementos';
  }

  return 'ingredientes';
}

function getPuntoReordenInterno(stockActual, puntoReorden) {
  const reorder = Number(puntoReorden || 0);
  if (reorder > 0) {
    return reorder;
  }

  const stock = Number(stockActual || 0);
  if (stock <= 0) {
    return 1;
  }

  return Number(Math.max(stock * 0.35, 1).toFixed(3));
}

function getStockMinimoInterno(stockActual, puntoReorden) {
  const reorder = getPuntoReordenInterno(stockActual, puntoReorden);
  return Number(Math.max(reorder * 0.5, 1).toFixed(3));
}

function getStockMaximoInterno(stockActual, puntoReorden) {
  const stock = Number(stockActual || 0);
  const reorder = getPuntoReordenInterno(stockActual, puntoReorden);
  return Number(Math.max(stock, reorder * 2).toFixed(3));
}

function getSemaforo(stockActual, puntoReorden) {
  const stock = Number(stockActual || 0);
  const reorder = getPuntoReordenInterno(stockActual, puntoReorden);

  if (!reorder) {
    return { label: 'Sin punto de reorden', className: 'neutral' };
  }

  if (stock <= reorder) {
    return { label: 'Rojo', className: 'rojo' };
  }

  if (stock <= reorder * 1.5) {
    return { label: 'Amarillo', className: 'amarillo' };
  }

  return { label: 'Verde', className: 'verde' };
}

function getRelativeDate(daysAgo) {
  const date = new Date();
  date.setDate(date.getDate() - Number(daysAgo || 0));
  return date.toISOString().slice(0, 10);
}

function buildDemoAlmacenCompras(businessId) {
  const catalogoBase = DEMO_CATALOG_ITEMS.filter((item) => item.businessId === businessId);
  const proveedoresBase = DEMO_PROVIDERS.filter((item) => item.businessId === businessId).map((item) => ({
    ...item,
    id_negocio: item.businessId
  }));
  const proveedoresById = new Map(proveedoresBase.map((item) => [item.id_proveedor, item]));
  const catalogoById = new Map(catalogoBase.map((item) => [item.id_item, item]));

  const lotes = DEMO_PURCHASES.filter((item) => item.businessId === businessId).flatMap((compra) =>
    compra.detalles.map((detalle) => {
      const catalogItem = catalogoById.get(detalle.id_item);
      const proveedor = proveedoresById.get(compra.id_proveedor);
      const fecha = getRelativeDate(compra.daysAgo);
      return {
        id_lote: detalle.id_lote,
        id_compra: compra.id_compra,
        id_insumo: detalle.id_item,
        id_item: detalle.id_item,
        id_proveedor: compra.id_proveedor,
        cantidad_recibida: detalle.cantidad,
        precio_unitario_compra: detalle.precio,
        folio_externo: compra.folio_externo,
        fecha_entrada: fecha,
        fecha_compra_dia: fecha,
        observaciones_compra: compra.observaciones,
        modulo: compra.modulo,
        responsable: compra.responsable,
        total_lote: Number((detalle.cantidad * detalle.precio).toFixed(2)),
        item_nombre: catalogItem?.nombre_item || 'Insumo sin nombre',
        item_subcategoria: catalogItem?.subcategoria || 'Sin subcategoria',
        unidad_consumo: catalogItem?.unidad_consumo || detalle.unidad,
        proveedor_nombre: proveedor?.nombre_prov || 'Proveedor sin nombre',
        proveedor_tipo: proveedor?.tipo_proveedor || 'Sin tipo'
      };
    })
  );

  const ultimoPrecioPorItem = lotes.reduce((accumulator, item) => {
    const current = accumulator.get(item.id_item);
    if (!current || new Date(item.fecha_entrada).getTime() >= new Date(current.fecha_entrada).getTime()) {
      accumulator.set(item.id_item, item);
    }
    return accumulator;
  }, new Map());

  const catalogo = catalogoBase.map((item) => ({
    id_item: item.id_item,
    id_insumo: item.id_item,
    id_negocio: item.businessId,
    nombre_item: item.nombre_item,
    categoria: item.categoria,
    subcategoria: item.subcategoria,
    tipo_conservacion: item.tipo_conservacion,
    unidad_consumo: item.unidad_consumo,
    stock_actual: item.stock_actual,
    punto_reorden: item.punto_reorden,
    es_inventariable: true,
    precio_competencia_promedio: item.precio_competencia_promedio,
    fuente_competencia: item.fuente_competencia,
    fecha_analisis_mercado: getRelativeDate(1),
    ultimo_precio_compra: ultimoPrecioPorItem.get(item.id_item)?.precio_unitario_compra || null,
    grupo: getCategoriaGrupo(item.categoria),
    stock_minimo_interno: getStockMinimoInterno(item.stock_actual, item.punto_reorden),
    stock_maximo_interno: getStockMaximoInterno(item.stock_actual, item.punto_reorden),
    punto_reorden_interno: getPuntoReordenInterno(item.stock_actual, item.punto_reorden),
    semaforo: getSemaforo(item.stock_actual, item.punto_reorden)
  }));

  const hoy = toLocalDateKey();
  const comprasHoy = lotes.filter((item) => toLocalDateKey(item.fecha_compra_dia || item.fecha_entrada) === hoy);

  return mergeLocalAlmacenOverlay({
    resumen: {
      totalItems: catalogo.length,
      ingredientes: catalogo.filter((item) => item.grupo === 'ingredientes').length,
      equipos: catalogo.filter((item) => item.grupo === 'equipos').length,
      complementos: catalogo.filter((item) => item.grupo === 'complementos').length,
      proveedores: proveedoresBase.length,
      lotes: lotes.length,
      totalCompraHoy: comprasHoy.reduce((acc, lote) => acc + Number(lote.total_lote || 0), 0),
      comprasHoy: comprasHoy.length
    },
    catalogo,
    proveedores: proveedoresBase,
    lotes,
    comprasHoy
  }, businessId);
}

async function obtenerCatalogoSubcategorias() {
  const { data, error } = await supabase
    .from('subcategorias_insumos')
    .select('id_subcategoria, nombre, categorias_insumos(id_categoria, tipo_insumo, nombre)')
    .eq('activo', true);

  if (error) {
    throw new Error(error.message);
  }

  return data || [];
}

async function resolveSubcategoriaId({ categoria, subcategoria }) {
  const categoryType = normalizeCategoryType(categoria);
  const subcategorias = await obtenerCatalogoSubcategorias();
  const exactMatch = subcategorias.find((item) => {
    const tipoInsumo = normalizeCategoria(item.categorias_insumos?.tipo_insumo);
    return tipoInsumo === categoryType && isSubcategoryMatch(subcategoria, item.nombre);
  });

  if (exactMatch?.id_subcategoria) {
    return exactMatch.id_subcategoria;
  }

  const fallbackMatch = subcategorias.find(
    (item) => normalizeCategoria(item.categorias_insumos?.tipo_insumo) === categoryType
  );

  if (fallbackMatch?.id_subcategoria) {
    return fallbackMatch.id_subcategoria;
  }

  throw new Error('No se encontró una subcategoría válida para este insumo.');
}

function buildCatalogItem(item = {}, subcategoriasById = new Map()) {
  const subcategoria = subcategoriasById.get(item.id_subcategoria) || null;
  const categoryType = subcategoria?.categorias_insumos?.tipo_insumo || '';

  return {
    ...item,
    id_item: item.id_insumo,
    categoria: resolveCategoryGroup(categoryType),
    categoria_nombre: subcategoria?.categorias_insumos?.nombre || '',
    subcategoria: subcategoria?.nombre || 'Sin subcategoria',
    fecha_analisis_mercado: item.fecha_analisis_market || null
  };
}

async function buildItemPayload(data, businessId) {
  const inferredData = inferQuickItemFields(data.nombre_item);
  const categoria = data.categoria || inferredData.categoria;
  const subcategoria = data.subcategoria || inferredData.subcategoria;
  const tipoConservacion = data.tipo_conservacion || inferredData.tipo_conservacion;
  const unidadConsumo = data.unidad_consumo || inferredData.unidad_consumo;
  const stockActual = toNumberOrNull(data.stock_actual) ?? 0;
  const puntoReorden = toNumberOrNull(data.punto_reorden);
  const idSubcategoria = await resolveSubcategoriaId({
    categoria,
    subcategoria
  });

  return {
    id_negocio: businessId,
    id_subcategoria: idSubcategoria,
    nombre_item: normalizeText(data.nombre_item),
    tipo_conservacion: normalizeText(tipoConservacion),
    unidad_consumo: normalizeText(unidadConsumo),
    stock_actual: stockActual,
    es_inventariable: data.es_inventariable !== false,
    precio_competencia_promedio: toNumberOrNull(data.precio_competencia_promedio),
    fuente_competencia: normalizeText(data.fuente_competencia),
    fecha_analisis_market: data.fecha_analisis_mercado || new Date().toISOString().slice(0, 10),
    punto_reorden: getPuntoReordenInterno(stockActual, puntoReorden),
    precio_unitario: toNumberOrNull(data.precio_unitario),
    costo_unitario_promedio: toNumberOrNull(data.costo_unitario_promedio)
  };
}

function buildProveedorPayload(data, businessId) {
  return {
    id_negocio: businessId,
    nombre_prov: normalizeText(data.nombre_prov),
    tipo_proveedor: normalizeText(data.tipo_proveedor),
    telefono_prov: normalizeText(data.telefono_prov),
    correo_prov: normalizeText(data.correo_prov),
    direccion_prov: normalizeText(data.direccion_prov),
    precio_unitario: toNumberOrNull(data.precio_unitario),
    unidad_medida: normalizeText(data.unidad_medida),
    descripcion: normalizeText(data.descripcion)
  };
}

async function resolverItemCompra({ businessId, itemMode, itemId, itemData }) {
  if (itemMode === 'new') {
    const payload = await buildItemPayload(
      {
        ...itemData,
        stock_actual: 0,
        es_inventariable: true,
        fecha_analisis_mercado: new Date().toISOString().slice(0, 10)
      },
      businessId
    );

    if (!payload.nombre_item || !payload.id_subcategoria || !payload.unidad_consumo) {
      throw new Error('Para compra rápida captura al menos el nombre del insumo.');
    }

    const { data: existingItem } = await supabase
      .from('insumos')
      .select('id_insumo')
      .eq('id_negocio', businessId)
      .ilike('nombre_item', payload.nombre_item)
      .limit(1)
      .maybeSingle();

    if (existingItem?.id_insumo) {
      return existingItem.id_insumo;
    }

    const { data, error } = await supabase
      .from('insumos')
      .insert(payload)
      .select('id_insumo')
      .single();

    if (error) {
      throw new Error(error.message);
    }

    return data.id_insumo;
  }

  if (!itemId) {
    throw new Error('Selecciona un insumo o usa compra rápida para crear uno al momento.');
  }

  return Number(itemId);
}

async function actualizarStockItem(idInsumo, deltaCantidad) {
  const { data: currentItem, error: currentItemError } = await supabase
    .from('insumos')
    .select('id_insumo, stock_actual')
    .eq('id_insumo', idInsumo)
    .single();

  if (currentItemError) {
    throw new Error(currentItemError.message);
  }

  const currentStock = Number(currentItem?.stock_actual || 0);
  const nextStock = Number((currentStock + Number(deltaCantidad || 0)).toFixed(3));

  const { error: updateError } = await supabase
    .from('insumos')
    .update({ stock_actual: nextStock < 0 ? 0 : nextStock })
    .eq('id_insumo', idInsumo);

  if (updateError) {
    throw new Error(updateError.message);
  }
}

async function resolverProveedorCompra({ businessId, providerMode, proveedorId, proveedorData }) {
  if (providerMode === 'new' || providerMode === 'quick') {
    const inferredProvider = inferQuickProviderFields(proveedorData?.nombre_prov);
    const payload = buildProveedorPayload(
      providerMode === 'quick'
        ? {
            ...proveedorData,
            tipo_proveedor: proveedorData?.tipo_proveedor || inferredProvider.tipo_proveedor
          }
        : { ...inferredProvider, ...proveedorData },
      businessId
    );

    if (!payload.nombre_prov) {
      throw new Error(providerMode === 'quick' ? 'El nombre del lugar de compra es obligatorio.' : 'El nombre del proveedor es obligatorio.');
    }

    const { data: existingProviders, error: existingProvidersError } = await supabase
      .from('proveedores')
      .select('id_proveedor, nombre_prov, tipo_proveedor, direccion_prov')
      .eq('id_negocio', businessId);

    if (existingProvidersError) {
      throw new Error(existingProvidersError.message);
    }

    const existingProvider = findQuickProviderMatch(existingProviders || [], payload.nombre_prov);
    if (existingProvider?.id_proveedor) {
      return existingProvider.id_proveedor;
    }

    const { data, error } = await supabase
      .from('proveedores')
      .insert(payload)
      .select('id_proveedor')
      .single();

    if (error) {
      throw new Error(error.message);
    }

    return data.id_proveedor;
  }

  if (!proveedorId) {
    throw new Error('Selecciona un proveedor existente o registra uno nuevo.');
  }

  return Number(proveedorId);
}

// Limpiar caché de almacén cuando cambias de negocio
export function limpiarCacheAlmacen() {
  // Limpiar overlay de almacén para todos los negocios
  Object.keys(localStorage).forEach((key) => {
    if (key.startsWith('itakt-local-almacen-overlay') || 
        key.startsWith('precio_') ||
        key.startsWith('inactivo_')) {
      localStorage.removeItem(key);
    }
  });
}

export async function obtenerAlmacenCompras({ businessId } = {}) {
  if (!businessId) {
    return {
      data: {
        catalogo: [],
        proveedores: [],
        lotes: [],
        comprasHoy: [],
        resumen: { totalItems: 0, ingredientes: 0, equipos: 0, complementos: 0, proveedores: 0, lotes: 0, totalCompraHoy: 0, comprasHoy: 0 }
      },
      error: null
    };
  }

  async function loadAlmacenBase() {
    const catalogoQuery = supabase
      .from('insumos')
      .select(
        'id_insumo, id_negocio, id_subcategoria, nombre_item, tipo_conservacion, unidad_consumo, stock_actual, punto_reorden, es_inventariable, costo_unitario_promedio, precio_competencia_promedio, fuente_competencia, fecha_analisis_market'
      )
      .eq('id_negocio', businessId)
      .order('nombre_item', { ascending: true });

    const proveedoresQuery = supabase
      .from('proveedores')
      .select('id_proveedor, id_negocio, nombre_prov, tipo_proveedor, telefono_prov, correo_prov, direccion_prov, precio_unitario, unidad_medida, descripcion, activo')
      .eq('id_negocio', businessId)
      .order('tipo_proveedor', { ascending: true })
      .order('nombre_prov', { ascending: true });

    const equiposQuery = supabase
      .from('equipos')
      .select('id_equipo, id_negocio, nombre_equipo, precio_unitario, unidad_medida, descripcion, activo')
      .eq('id_negocio', businessId)
      .order('nombre_equipo', { ascending: true });

    const [catalogoResult, proveedoresResult, equiposResult, subcategoriasBase] = await Promise.all([
      catalogoQuery,
      proveedoresQuery,
      equiposQuery,
      obtenerCatalogoSubcategorias()
    ]);

    return { catalogoResult, proveedoresResult, equiposResult, subcategoriasBase };
  }

  let { catalogoResult, proveedoresResult, equiposResult, subcategoriasBase } = await loadAlmacenBase();

  if (!catalogoResult.error && !proveedoresResult.error && !equiposResult.error) {
    const catalogoVacio = (catalogoResult.data || []).length === 0;
    const proveedoresVacios = (proveedoresResult.data || []).length === 0;
    const equiposVacios = (equiposResult.data || []).length === 0;

    if (catalogoVacio && proveedoresVacios && equiposVacios) {
      ({ catalogoResult, proveedoresResult, equiposResult, subcategoriasBase } = await withTemporaryDemoEmail(
        DEMO_SUPER_ADMIN_EMAIL,
        loadAlmacenBase
      ));

      if ((catalogoResult.data || []).length === 0 && (proveedoresResult.data || []).length === 0 && (equiposResult.data || []).length === 0) {
        return { data: buildDemoAlmacenCompras(businessId), error: null };
      }
    }
  }

  if (catalogoResult.error || proveedoresResult.error || equiposResult.error) {
    const errorMessage = catalogoResult.error?.message || proveedoresResult.error?.message || equiposResult.error?.message;
    return { data: null, error: errorMessage };
  }

  const subcategoriasById = new Map((subcategoriasBase || []).map((item) => [item.id_subcategoria, item]));
  const catalogoBase = (catalogoResult.data || []).map((item) => buildCatalogItem(item, subcategoriasById));
  const proveedoresBase = proveedoresResult.data || [];
  const insumoIds = catalogoBase.map((item) => item.id_insumo);

  // Cargar compras recientes (header + detalles)
  let lotesEnriquecidos = [];
  let comprasHoy = [];

  if (insumoIds.length) {
    const { data: recentCompras, error: comprasError } = await supabase
      .from('compras')
      .select('id_compra, fecha_compra, folio_externo, id_proveedor, modulo, responsable, estatus, total_compra, observaciones, fecha_registro')
      .eq('id_negocio', businessId)
      .order('fecha_compra', { ascending: false })
      .limit(100);

    if (comprasError) {
      return { data: null, error: comprasError.message };
    }

    const comprasBase = recentCompras || [];

    if (comprasBase.length) {
      const compraIds = comprasBase.map((c) => c.id_compra);
      const { data: detallesData, error: detallesError } = await supabase
        .from('compras_detalle')
        .select('id_detalle, id_compra, id_insumo, cantidad, unidad, costo_unitario, subtotal')
        .in('id_compra', compraIds);

      if (detallesError) {
        return { data: null, error: detallesError.message };
      }

      const comprasById = new Map(comprasBase.map((c) => [c.id_compra, c]));
      const insumosById = new Map(catalogoBase.map((item) => [item.id_insumo, item]));
      const providersById = new Map(proveedoresBase.map((item) => [item.id_proveedor, item]));

      lotesEnriquecidos = (detallesData || []).map((det) => {
        const compra = comprasById.get(det.id_compra);
        const insumo = insumosById.get(det.id_insumo);
        const prov = compra ? providersById.get(compra.id_proveedor) : null;
        return {
          id_lote: det.id_detalle,
          id_compra: det.id_compra,
          id_insumo: det.id_insumo,
          id_item: det.id_insumo,
          id_proveedor: compra?.id_proveedor || null,
          cantidad_recibida: det.cantidad,
          precio_unitario_compra: det.costo_unitario,
          folio_externo: compra?.folio_externo || null,
          fecha_entrada: compra?.fecha_compra || null,
          fecha_compra_dia: compra?.fecha_compra ? toLocalDateKey(compra.fecha_compra) : null,
          observaciones_compra: compra?.observaciones || null,
          modulo: compra?.modulo || 'restaurante',
          estatus: compra?.estatus || 'pendiente_recepcion',
          responsable: compra?.responsable || null,
          estatus: compra?.estatus || 'pendiente',
          fecha_recepcion: compra?.fecha_recepcion || null,
          quien_recibio: compra?.quien_recibio || null,
          cantidad_recibida: compra?.cantidad_recibida || det.cantidad,
          monto_pagado: compra?.monto_pagado || 0,
          fecha_pago: compra?.fecha_pago || null,
          total_lote: Number(det.subtotal || 0) || Number(det.cantidad || 0) * Number(det.costo_unitario || 0),
          item_nombre: insumo?.nombre_item || 'Insumo sin nombre',
          item_subcategoria: insumo?.subcategoria || 'Sin subcategoria',
          unidad_consumo: insumo?.unidad_consumo || 'Sin unidad',
          proveedor_nombre: prov?.nombre_prov || 'Proveedor sin nombre',
          proveedor_tipo: prov?.tipo_proveedor || 'Sin tipo'
        };
      });

      const hoy = toLocalDateKey();
      comprasHoy = lotesEnriquecidos.filter((l) => toLocalDateKey(l.fecha_compra_dia || l.fecha_entrada) === hoy);
    }
  }

  const ultimoPrecioPorItem = lotesEnriquecidos.reduce((accumulator, item) => {
    const current = accumulator.get(item.id_item);
    if (!current) {
      accumulator.set(item.id_item, item);
      return accumulator;
    }

    const currentDate = current.fecha_entrada ? new Date(current.fecha_entrada).getTime() : 0;
    const nextDate = item.fecha_entrada ? new Date(item.fecha_entrada).getTime() : 0;
    if (nextDate >= currentDate) {
      accumulator.set(item.id_item, item);
    }

    return accumulator;
  }, new Map());

  const catalogo = catalogoBase.map((item) => ({
    ...item,
    ultimo_precio_compra: ultimoPrecioPorItem.get(item.id_item)?.precio_unitario_compra || null,
    grupo: getCategoriaGrupo(item.categoria),
    stock_minimo_interno: getStockMinimoInterno(item.stock_actual, item.punto_reorden),
    stock_maximo_interno: getStockMaximoInterno(item.stock_actual, item.punto_reorden),
    punto_reorden_interno: getPuntoReordenInterno(item.stock_actual, item.punto_reorden),
    semaforo: getSemaforo(item.stock_actual, item.punto_reorden)
  }));

  const equiposBase = (equiposResult?.data || []);

  const resumen = {
    totalItems: catalogo.length,
    ingredientes: catalogo.filter((item) => item.grupo === 'ingredientes').length,
    equipos: equiposBase.length,
    complementos: catalogo.filter((item) => item.grupo === 'complementos').length,
    proveedores: proveedoresBase.length,
    lotes: lotesEnriquecidos.length,
    totalCompraHoy: comprasHoy.reduce((acc, lote) => acc + Number(lote.total_lote || 0), 0),
    comprasHoy: comprasHoy.length
  };

  return {
    data: {
      ...mergeLocalAlmacenOverlay(
        {
          resumen,
          catalogo,
          proveedores: proveedoresBase,
          equipos: equiposBase,
          lotes: lotesEnriquecidos,
          comprasHoy
        },
        businessId
      )
    },
    error: null
  };
}

export async function guardarItemCatalogo({ businessId, itemId, data }) {
  return await withTemporaryDemoEmail(DEMO_SUPER_ADMIN_EMAIL, async () => {
    const payload = await buildItemPayload(data, businessId);

    if (!payload.nombre_item || !payload.id_subcategoria) {
      return { data: null, error: 'Nombre, categoria y subcategoria son obligatorios.' };
    }

    const query = itemId
      ? supabase.from('insumos').update(payload).eq('id_insumo', itemId).select().single()
      : supabase.from('insumos').insert(payload).select().single();

    const { data: responseData, error } = await query;
    return {
      data: responseData ? { ...responseData, id_item: responseData.id_insumo || itemId || null } : null,
      error: error?.message || null
    };
  });
}

export async function eliminarItemCatalogo(itemId) {
  return await withTemporaryDemoEmail(DEMO_SUPER_ADMIN_EMAIL, async () => {
    const { error } = await supabase.from('insumos').delete().eq('id_insumo', itemId);
    return { error: error?.message || null };
  });
}

export async function guardarProveedor({ businessId, providerId, data }) {
  return await withTemporaryDemoEmail(DEMO_SUPER_ADMIN_EMAIL, async () => {
    const payload = buildProveedorPayload(data, businessId);

    if (!payload.nombre_prov || !payload.tipo_proveedor) {
      return { data: null, error: 'Nombre y tipo de proveedor son obligatorios.' };
    }

    const query = providerId
      ? supabase.from('proveedores').update(payload).eq('id_proveedor', providerId).select().single()
      : supabase.from('proveedores').insert(payload).select().single();

    const { data: responseData, error } = await query;
    return { data: responseData || null, error: error?.message || null };
  });
}

export async function eliminarProveedor(providerId) {
  return await withTemporaryDemoEmail(DEMO_SUPER_ADMIN_EMAIL, async () => {
    // Usar soft-delete: marcar como inactivo en lugar de eliminar
    const { error } = await supabase
      .from('proveedores')
      .update({ activo: false })
      .eq('id_proveedor', providerId);
    return { error: error?.message || null };
  });
}

export async function eliminarEquipo(equipoId) {
  return await withTemporaryDemoEmail(DEMO_SUPER_ADMIN_EMAIL, async () => {
    // Usar soft-delete: marcar como inactivo en lugar de eliminar
    const { error } = await supabase
      .from('equipos')
      .update({ activo: false })
      .eq('id_equipo', equipoId);
    return { error: error?.message || null };
  });
}

export async function guardarCompra({ businessId, loteId, data }) {
  // loteId ahora representa id_compra para ediciones
  try {
    return await withTemporaryDemoEmail(DEMO_SUPER_ADMIN_EMAIL, async () => {
      const buildStepError = (message) => {
        if (isRlsInsertError(message)) {
          return buildLocalFallbackPurchase({ businessId, data });
        }

        return { data: null, error: message };
      };

      if (loteId && Number(loteId) < 0) {
        return updateLocalFallbackPurchase({ businessId, loteId, data });
      }

      const itemId = await resolverItemCompra({
        businessId,
        itemMode: data.itemMode,
        itemId: data.id_item || data.id_insumo,
        itemData: data.item_nuevo
      });

      const proveedorId = await resolverProveedorCompra({
        businessId,
        providerMode: data.providerMode,
        proveedorId: data.id_proveedor,
        proveedorData: data.proveedor_nuevo
      });

      const cantidad = toNumberOrNull(data.cantidad_recibida);
      const precioUnitario = toNumberOrNull(data.precio_unitario_compra);
      const shouldApplyInventory = data.applyInventory === true;

      if (!cantidad || !precioUnitario) {
        return { data: null, error: 'Cantidad y precio unitario son obligatorios.' };
      }

      const fechaCompra = data.fecha_entrada || new Date().toISOString();
      const compraPayload = {
        id_negocio: businessId,
        fecha_compra: fechaCompra,
        folio_externo: normalizeText(data.folio_externo) || null,
        id_proveedor: proveedorId,
        modulo: data.modulo || 'restaurante',
        responsable: normalizeText(data.responsable_registro) || null,
        estatus: shouldApplyInventory ? 'recibida' : 'pendiente_recepcion',
        total_compra: Number((cantidad * precioUnitario).toFixed(2)),
        observaciones: normalizeText(data.observaciones_compra) || null
      };

      if (loteId) {
        const { data: detalleAnterior, error: detalleAnteriorError } = await supabase
          .from('compras_detalle')
          .select('id_detalle, id_insumo, cantidad')
          .eq('id_compra', loteId)
          .limit(1)
          .maybeSingle();

        const { data: compraAnterior, error: compraAnteriorError } = await supabase
          .from('compras')
          .select('id_compra, estatus')
          .eq('id_compra', loteId)
          .limit(1)
          .maybeSingle();

        if (detalleAnteriorError || compraAnteriorError) {
          return buildStepError(detalleAnteriorError?.message || compraAnteriorError?.message);
        }

        const inventoryAlreadyApplied = compraAnterior?.estatus === 'recibida';
        const inventoryWillBeApplied = shouldApplyInventory || inventoryAlreadyApplied;
        const compraUpdatePayload = {
          ...compraPayload,
          estatus: inventoryWillBeApplied ? 'recibida' : 'pendiente_recepcion'
        };

        const { data: compraActualizada, error: compraError } = await supabase
          .from('compras')
          .update(compraUpdatePayload)
          .eq('id_compra', loteId)
          .select()
          .single();

        if (compraError) {
          return buildStepError(compraError.message);
        }

        if (detalleAnterior) {
          if (inventoryAlreadyApplied) {
            await actualizarStockItem(detalleAnterior.id_insumo, -Number(detalleAnterior.cantidad || 0));
          }

          const { error: updateDetalleError } = await supabase
            .from('compras_detalle')
            .update({
              id_insumo: itemId,
              cantidad,
              unidad: normalizeText(data.unidad_compra) || null,
              costo_unitario: precioUnitario,
              subtotal: Number((cantidad * precioUnitario).toFixed(2))
            })
            .eq('id_detalle', detalleAnterior.id_detalle);

          if (updateDetalleError) {
            return buildStepError(updateDetalleError.message);
          }
        }

        if (inventoryAlreadyApplied) {
          await actualizarStockItem(itemId, cantidad);
          return { data: compraActualizada, error: null };
        }

        if (inventoryWillBeApplied) {
          const { data: entradaExistente, error: entradaExistenteError } = await supabase
            .from('entradas_salidas')
            .select('id_mov_inv')
            .eq('id_compra', loteId)
            .limit(1)
            .maybeSingle();

          if (entradaExistenteError) {
            return buildStepError(entradaExistenteError.message);
          }

          if (!entradaExistente) {
            const { data: entradaData, error: entradaError } = await supabase.from('entradas_salidas').insert({
              id_negocio: businessId,
              id_insumo: itemId,
              id_proveedor: proveedorId,
              id_compra: loteId,
              tipo_operacion: 'entrada',
              tipo_detalle: 'compra',
              cantidad,
              costo_unitario: precioUnitario,
              responsable: compraUpdatePayload.responsable,
              fecha_registro: fechaCompra
            }).select('id_mov_inv').single();

            if (entradaError) {
              return buildStepError(entradaError.message);
            }

            const { error: movimientoError } = await supabase.from('movimientos').insert({
              id_negocio: businessId,
              id_insumo: itemId,
              id_mov_inv: entradaData?.id_mov_inv || null,
              tipo_movimiento: 'entrada_compra',
              cantidad,
              costo_total: Number((cantidad * precioUnitario).toFixed(2)),
              responsable: compraUpdatePayload.responsable,
              fecha_registro: fechaCompra
            });

            if (movimientoError) {
              return buildStepError(movimientoError.message);
            }
          }

          await actualizarStockItem(itemId, cantidad);
        }

        return { data: compraActualizada, error: null };
      }

      const { data: compra, error: compraError } = await supabase.from('compras').insert(compraPayload).select().single();
      if (compraError) {
        return buildStepError(compraError.message);
      }

      const { error: detalleError } = await supabase.from('compras_detalle').insert({
        id_compra: compra.id_compra,
        id_insumo: itemId,
        cantidad,
        unidad: normalizeText(data.unidad_compra) || null,
        costo_unitario: precioUnitario,
        subtotal: Number((cantidad * precioUnitario).toFixed(2))
      });
      if (detalleError) {
        return buildStepError(detalleError.message);
      }

      if (!shouldApplyInventory) {
        return { data: compra, error: null };
      }

      const { data: entradaData, error: entradaError } = await supabase.from('entradas_salidas').insert({
        id_negocio: businessId,
        id_insumo: itemId,
        id_proveedor: proveedorId,
        id_compra: compra.id_compra,
        tipo_operacion: 'entrada',
        tipo_detalle: 'compra',
        cantidad,
        costo_unitario: precioUnitario,
        responsable: compraPayload.responsable,
        fecha_registro: fechaCompra
      }).select('id_mov_inv').single();

      if (entradaError) {
        return buildStepError(entradaError.message);
      }

      const { error: movimientoError } = await supabase.from('movimientos').insert({
        id_negocio: businessId,
        id_insumo: itemId,
        id_mov_inv: entradaData?.id_mov_inv || null,
        tipo_movimiento: 'entrada_compra',
        cantidad,
        costo_total: Number((cantidad * precioUnitario).toFixed(2)),
        responsable: compraPayload.responsable,
        fecha_registro: fechaCompra
      });

      if (movimientoError) {
        return buildStepError(movimientoError.message);
      }

      await actualizarStockItem(itemId, cantidad);

      return { data: compra, error: null };
    });
  } catch (err) {
    if (isRlsInsertError(err?.message)) {
      return buildLocalFallbackPurchase({ businessId, data });
    }

    return { data: null, error: err.message };
  }
}

export async function eliminarCompra(compraId) {
  const { data: detalles, error: detallesError } = await supabase
    .from('compras_detalle')
    .select('id_detalle, id_insumo, cantidad')
    .eq('id_compra', compraId);

  if (detallesError) {
    return { error: detallesError.message };
  }

  // Revertir stock de todos los insumos en esta compra
  try {
    for (const det of detalles || []) {
      await actualizarStockItem(det.id_insumo, -Number(det.cantidad || 0));
    }
  } catch (stockError) {
    return { error: stockError.message };
  }

  // Eliminar la compra (CASCADE elimina compras_detalle y entradas si FK ON DELETE CASCADE)
  const { error } = await supabase.from('compras').delete().eq('id_compra', compraId);
  if (error) {
    return { error: error.message };
  }

  return { error: null };
}

// ================================================================
// FASE 1: ESTADO PROGRESIVO DE COMPRAS
// Cambios de estado: Sugerida → Pedida → Recibida → Pagada
// ================================================================

export async function cambiarEstadoCompra(idCompra, nuevoEstado, datosCambio = {}) {
  try {
    const payload = {
      estatus: nuevoEstado
    };

    if (nuevoEstado === 'recibida') {
      payload.fecha_recepcion = datosCambio.fecha_recepcion || new Date().toISOString().slice(0, 10);
      payload.quien_recibio = normalizeText(datosCambio.quien_recibio) || null;
      payload.observaciones_recepcion = normalizeText(datosCambio.observaciones_recepcion) || null;
      payload.cantidad_recibida = toNumberOrNull(datosCambio.cantidad_recibida);
    } else if (nuevoEstado === 'pagada') {
      payload.fecha_pago = datosCambio.fecha_pago || new Date().toISOString().slice(0, 10);
      payload.monto_pagado = toNumberOrNull(datosCambio.monto_pagado);
    }

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

export async function registrarRecepcionCompra(idCompra, datos) {
  try {
    const cantidadRecibida = toNumberOrNull(datos.cantidad_recibida);
    
    const { data: compraAnterior, error: errorObtener } = await supabase
      .from('compras')
      .select('cantidad, estatus')
      .eq('id_compra', idCompra)
      .single();

    if (errorObtener) {
      return { data: null, error: errorObtener.message };
    }

    const diferencia = cantidadRecibida 
      ? (compraAnterior.cantidad - cantidadRecibida)
      : null;

    const { data, error } = await supabase
      .from('compras')
      .update({
        estatus: 'recibida',
        fecha_recepcion: datos.fecha_recepcion || new Date().toISOString().slice(0, 10),
        quien_recibio: normalizeText(datos.quien_recibio),
        cantidad_recibida: cantidadRecibida,
        diferencia_cantidad: diferencia,
        observaciones_recepcion: normalizeText(datos.observaciones)
      })
      .eq('id_compra', idCompra)
      .select()
      .single();

    return { data, error: error?.message || null };
  } catch (err) {
    return { data: null, error: err.message };
  }
}

export async function registrarPagoCompra(idCompra, datos) {
  try {
    const montoPagado = toNumberOrNull(datos.monto_pagado);

    const { data, error } = await supabase
      .from('compras')
      .update({
        estatus: 'pagada',
        fecha_pago: datos.fecha_pago || new Date().toISOString().slice(0, 10),
        monto_pagado: montoPagado
      })
      .eq('id_compra', idCompra)
      .select()
      .single();

    return { data, error: error?.message || null };
  } catch (err) {
    return { data: null, error: err.message };
  }
}

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

export async function obtenerResumenCompras(businessId) {
  try {
    const { data, error } = await supabase
      .from('v_compras_por_estado')
      .select('estatus, cantidad, monto_total')
      .eq('id_negocio', businessId);

    if (error) {
      return { data: null, error: error.message };
    }

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
