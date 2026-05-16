import React, { useEffect, useRef, useState } from 'react';
import {
  buildMailToLink,
  buildWhatsAppLink,
  CATERING_EVENT_STATUSES,
  CATERING_METODOS_PAGO,
  CATERING_TICKET_STATUSES,
  CATERING_TICKET_TYPES,
  descargarCsvCatering,
  descargarPdfCatering,
  eliminarCotizacionCatering,
  eliminarEventoCatering,
  eliminarOperacionCatering,
  filtrarHistorialPorPeriodo,
  guardarBundleEventoCotizacion,
  guardarCotizacionCatering,
  guardarEventoCatering,
  guardarOperacionCatering,
  obtenerOperacionCatering
} from '../../services/catering';
import {
  actualizarConfiguracionNegocio,
  crearUsuarioCatering,
  eliminarUsuarioNegocio,
  obtenerConfiguracionNegocio,
  obtenerUsuariosCatering
} from '../../services/usuarios';
import { obtenerUsuariosVisiblesPorNegocio } from '../../services/admin';
import BusinessUsersTable from '../../components/BusinessUsersTable';
import RegistroMovimientosInventario from '../../components/RegistroMovimientosInventario';
import RegistroMovimientosInventarioCompleto from '../../components/RegistroMovimientosInventarioCompleto';
import {
  CATEGORIAS_CATALOGO,
  TIPOS_CONSERVACION,
  TIPOS_PROVEEDOR,
  eliminarCompra,
  eliminarItemCatalogo,
  eliminarProveedor,
  findQuickProviderMatch,
  getQuickProviderDisplayLabel,
  guardarCompra,
  guardarItemCatalogo,
  guardarProveedor,
  inferQuickItemFields,
  inferQuickProviderFields,
  limpiarCacheAlmacen,
  obtenerAlmacenCompras
} from '../../services/almacenCompras';
import { agregarChecklistManual, obtenerChecklistCompras } from '../../services/checklistCompras';
import { getSectionMeta } from '../../roles/menuConfig';
import {
  descargarCsv,
  descargarPdfMovimiento,
  obtenerMovimientosRestaurante,
  registrarSalidaInsumo,
  TIPOS_SALIDA
} from '../../services/movimientos';
import {
  buildPurchaseObservations,
  getDefaultPurchaseCapture,
  getPurchaseEvidenceLabel,
  getPurchaseFlowLabel,
  normalizePurchaseEvidence,
  normalizePurchaseFlow,
  parsePurchaseMetadata,
  PURCHASE_EVIDENCE_OPTIONS,
  PURCHASE_FLOW_OPTIONS
} from '../../utils/purchaseCapture';
import AdminPreciosCatering from './AdminPreciosCatering';
import AdminEquiposPropios from '../../components/AdminEquiposPropios';
import syncService from '../../services/syncService';
import '../dashboard/DashboardHome.css';

const LOCAL_ALMACEN_OVERLAY_PREFIX = 'itakt-local-almacen-overlay';
const LOCAL_CHECKLIST_OVERLAY_PREFIX = 'itakt-local-checklist-overlay';
const ALMACEN_SYNC_INTERVAL_MS = 5000;

function getDefaultChecklistForm() {
  return {
    descripcion: '',
    cantidad: '',
    unidad: 'unidad',
    prioridad: 'media',
    nota: ''
  };
}

function getDefaultCateringUserForm() {
  return {
    tipoUsuario: 'trabajador',
    nombre_completo: '',
    correo: '',
    contrasena: '',
    telefono: '',
    nombre_negocio: ''
  };
}

function getModuleCards(user) {
  return [
    {
      title: 'Catering',
      value: user?.tiene_catering ? 'Habilitado' : 'Inhabilitado',
      detail: user?.tiene_catering ? 'El flujo de eventos, cotizaciones y operación está disponible' : 'Este flujo todavía no está activo para este negocio'
    },
    {
      title: 'Restaurante',
      value: user?.tiene_restaurante ? 'Habilitado' : 'Inhabilitado',
      detail: user?.tiene_restaurante ? 'También puedes trabajar restaurante con los mismos datos del negocio' : 'Puedes habilitar restaurante después sin perder la información base'
    }
  ];
}

function getDefaultCotizacionForm() {
  return {
    nombre_evento: '',
    fecha_evento: new Date().toISOString().slice(0, 10),
    numero_personas: '',
    nombre_cliente: '',
    telefono_cliente: '',
    correo_cliente: '',
    solicitado_por: '',
    lugar_evento: '',
    direccion_evento: '',
    referencia_evento: '',
    estatus_evento: 'cotizando',
    anticipo_pagado: 0,
    saldo_pendiente: 0,
    fecha_anticipo: '',
    fecha_pago_estimada: '',
    momento_liquidacion: '',
    notas_evento: '',
    total_estimado: 0,
    receta_ids: [],
    proveedor_ids: [],
    equipo_ids: [],
    cotizacion_id: null
  };
}

function getDefaultEventoForm() {
  return {
    nombre_evento: '',
    fecha_evento: new Date().toISOString().slice(0, 10),
    numero_personas: '',
    nombre_cliente: '',
    telefono_cliente: '',
    correo_cliente: '',
    solicitado_por: '',
    lugar_evento: '',
    direccion_evento: '',
    referencia_evento: '',
    estatus_evento: 'confirmado',
    anticipo_pagado: 0,
    saldo_pendiente: 0,
    fecha_anticipo: '',
    fecha_pago_estimada: '',
    momento_liquidacion: '',
    notas_evento: '',
    total_estimado: 0,
    receta_ids: [],
    proveedor_ids: [],
    equipo_ids: [],
    cotizacion_id: null
  };
}

function getDefaultOperacionForm() {
  return {
    id_evento: '',
    ticket_codigo: '',
    responsable_ticket: '',
    solicitado_por: '',
    nombre_cliente: '',
    correo_cliente: '',
    telefono_cliente: '',
    estatus_ticket: 'pendiente',
    tipo_ticket: 'pago_efectivo',
    monto_ticket: '',
    fecha_compromiso: '',
    canal_contacto: 'whatsapp',
    metodo_pago: 'efectivo',
    datos_tarjeta: '',
    observaciones: '',
    actualizar_estatus_evento: 'operando'
  };
}

function getBusinessLogoStorageKey(scope, businessId) {
  return `itakt-business-logo-${scope}-${businessId || 'sin-negocio'}`;
}

function getDefaultBusinessConfigForm(user) {
  return {
    nombre_negocio: user?.business_name || '',
    tipo_negocio: user?.business_type || 'catering',
    logo_preview: ''
  };
}

function formatCurrency(value) {
  return new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: 'MXN'
  }).format(Number(value || 0));
}

function formatDate(value) {
  if (!value) return 'Sin fecha';

  return new Date(value).toLocaleDateString('es-MX', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });
}

function toNumber(value) {
  const parsed = Number(value || 0);
  return Number.isNaN(parsed) ? 0 : parsed;
}

function normalizeCatalogSearch(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function getPurchaseCatalogLabel(item) {
  return `${item.nombre_item} · ${item.subcategoria || item.categoria || 'Sin categoría'}`;
}

function findCatalogMatch(catalogo, query) {
  const normalizedQuery = normalizeCatalogSearch(query);
  if (!normalizedQuery) return null;

  const exactMatch = (catalogo || []).find((item) => {
    const name = normalizeCatalogSearch(item.nombre_item);
    const label = normalizeCatalogSearch(getPurchaseCatalogLabel(item));
    return name === normalizedQuery || label === normalizedQuery;
  });

  if (exactMatch) return exactMatch;

  const matches = (catalogo || []).filter((item) => {
    const name = normalizeCatalogSearch(item.nombre_item);
    const label = normalizeCatalogSearch(getPurchaseCatalogLabel(item));
    return name.includes(normalizedQuery) || label.includes(normalizedQuery);
  });

  return matches.length === 1 ? matches[0] : null;
}

function roundMoney(value) {
  return Number(toNumber(value).toFixed(2));
}

function toggleId(list, value) {
  const numericValue = Number(value);
  if (!numericValue) {
    return list;
  }

  return list.includes(numericValue) ? list.filter((item) => item !== numericValue) : [...list, numericValue];
}

function getStatusClass(status) {
  const normalized = String(status || '').toLowerCase();

  if (normalized === 'cotizando') return 'status-cotizando';
  if (normalized === 'confirmado') return 'status-confirmado';
  if (normalized === 'operando') return 'status-operando';
  if (normalized === 'pendiente') return 'status-pendiente';
  if (normalized === 'resuelto') return 'status-resuelto';
  if (normalized === 'en_proceso') return 'status-proceso';
  if (normalized === 'liquidado') return 'status-liquidado';
  if (normalized === 'cliente_insatisfecho') return 'status-insatisfecho';
  if (normalized === 'anticipo_recibido') return 'status-anticipo-recibido';
  if (normalized === 'pago_parcial') return 'status-pago-parcial';
  if (normalized === 'incobrable') return 'status-incobrable';
  return 'status-default';
}

function getStatusLabel(status) {
  return String(status || 'sin estatus').replaceAll('_', ' ');
}

function getStatusColor(status) {
  const normalized = String(status || '').toLowerCase();
  if (normalized === 'cotizando') return '#fbbf24';
  if (normalized === 'confirmado') return '#60a5fa';
  if (normalized === 'operando') return '#8b5cf6';
  if (normalized === 'pendiente') return '#ef4444';
  if (normalized === 'resuelto') return '#10b981';
  if (normalized === 'en_proceso') return '#f59e0b';
  if (normalized === 'liquidado') return '#10b981';
  if (normalized === 'cliente_insatisfecho') return '#ef4444';
  if (normalized === 'anticipo_recibido') return '#10b981';
  if (normalized === 'pago_parcial') return '#f59e0b';
  if (normalized === 'incobrable') return '#ef4444';
  return '#9ca3af';
}

// Clean event names by removing JSON metadata - updated
function cleanEventName(name) {
  return String(name || '').split(/\s*--meta:/)[0].trim();
}

// Generate automatic ticket code - TK-YYYYMMDD-XXXX
function generateTicketCode(operaciones = []) {
  const now = new Date();
  const dateStr = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
  const todayTickets = operaciones.filter(t => t.ticket_codigo?.startsWith(`TK-${dateStr}`));
  const count = todayTickets.length + 1;
  const ticketNum = String(count).padStart(4, '0');
  return `TK-${dateStr}-${ticketNum}`;
}

const eventDetailStyles = {
  card: {
    backgroundColor: 'white',
    borderRadius: '8px',
    border: '1px solid #e5e7eb',
    padding: '16px',
    marginTop: '12px',
    boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: '12px',
    borderBottom: '1px solid #e5e7eb',
    marginBottom: '12px'
  },
  title: {
    margin: 0,
    fontSize: '15px',
    fontWeight: '700',
    color: '#1f2937'
  },
  statusPill: {
    color: 'white',
    padding: '4px 10px',
    borderRadius: '12px',
    fontSize: '11px',
    fontWeight: '600'
  },
  section: {
    marginBottom: '16px'
  },
  sectionTitle: {
    margin: '0 0 8px 0',
    fontSize: '13px',
    fontWeight: '700',
    color: '#374151'
  },
  grid2: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, 1fr)',
    gap: '12px'
  },
  label: {
    display: 'block',
    fontSize: '11px',
    fontWeight: '600',
    color: '#6b7280',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
    marginBottom: '4px'
  },
  value: {
    margin: 0,
    fontSize: '14px',
    color: '#1f2937',
    fontWeight: '500'
  },
  financialGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: '12px',
    marginBottom: '12px'
  },
  financialBox: {
    backgroundColor: '#f9fafb',
    padding: '12px',
    borderRadius: '6px',
    border: '1px solid #e5e7eb'
  },
  actions: {
    display: 'flex',
    gap: '8px',
    marginTop: '12px',
    paddingTop: '12px',
    borderTop: '1px solid #e5e7eb'
  },
  btn: {
    flex: 1,
    padding: '8px 12px',
    backgroundColor: '#f3f4f6',
    border: '1px solid #d1d5db',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '13px',
    fontWeight: '600',
    color: '#374151',
    transition: 'all 0.2s'
  }
};

function buildEstimate(form, recipes, equipment = [], providers = []) {
  // Calcular costo de recetas (por persona)
  const selectedRecipes = (recipes || []).filter((item) => (form.receta_ids || []).includes(item.id_recetario));
  const recipesCostPerPerson = roundMoney(selectedRecipes.reduce((acc, item) => acc + Number(item.precio_venta_fijo || item.costo_porcion || 0), 0));

  // Precios predeterminados por tipo de equipo/proveedor
  const equipmentPrices = {
    'desechable': 200,
    'montaje': 200,
    'decoracion': 150,
    'renta': 250,
    'equipo': 250,
    'mobiliario': 250,
  };

  const providerPrices = {
    'operacion': 800,
    'catering': 800,
    'cocina': 1000,
    'abarrotes': 1000,
    'bebida': 500,
    'cocteleria': 500
  };

  // Calcular costo de equipos seleccionados (TOTAL, no por persona)
  const selectedEquipment = (equipment || []).filter((item) => (form.equipo_ids || []).includes(item.id_proveedor));
  const equipmentTotalCost = selectedEquipment.reduce((acc, item) => {
    const tipo = (item.tipo_proveedor || '').toLowerCase();
    let price = item.precio_unitario || item.precio_servicio || 0;
    
    if (!price) {
      for (const [key, value] of Object.entries(equipmentPrices)) {
        if (tipo.includes(key)) {
          price = value;
          break;
        }
      }
    }
    return acc + Number(price || 0);
  }, 0);

  // Calcular costo de proveedores seleccionados (TOTAL, no por persona)
  const selectedProviders = (providers || []).filter((item) => (form.proveedor_ids || []).includes(item.id_proveedor));
  const providersTotalCost = selectedProviders.reduce((acc, item) => {
    const tipo = (item.tipo_proveedor || '').toLowerCase();
    let price = item.precio_unitario || item.precio_servicio || 0;
    
    if (!price) {
      for (const [key, value] of Object.entries(providerPrices)) {
        if (tipo.includes(key)) {
          price = value;
          break;
        }
      }
    }
    return acc + Number(price || 0);
  }, 0);

  // Cálculo final
  const people = Math.max(toNumber(form.numero_personas), 1);
  const totalCost = roundMoney(recipesCostPerPerson * people + equipmentTotalCost + providersTotalCost);
  const costPerPerson = roundMoney(totalCost / people);

  return {
    selectedRecipes,
    recipesCostPerPerson,
    equipmentCost: roundMoney(equipmentTotalCost),
    providersCost: roundMoney(providersTotalCost),
    costPerPerson,
    totalEvent: totalCost,
    people
  };
}

function formatDateTime(value) {
  if (!value) return 'Sin fecha';

  return new Date(value).toLocaleString('es-MX', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  });
}

function getTodayDate() {
  return new Date().toISOString().slice(0, 10);
}

function getLocalDatetimeValue(value) {
  const date = value ? new Date(value) : new Date();
  const adjusted = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return adjusted.toISOString().slice(0, 16);
}

const UNIDADES_COMPRA = [
  { value: 'kg', label: 'Kilogramo (kg)', grupo: 'Peso', aliases: ['kilo', 'kilos', 'kilogramo', 'kilogramos'] },
  { value: 'g', label: 'Gramo (g)', grupo: 'Peso', aliases: ['gramo', 'gramos'] },
  { value: 'lt', label: 'Litro (lt)', grupo: 'Volumen', aliases: ['litro', 'litros'] },
  { value: 'ml', label: 'Mililitro (ml)', grupo: 'Volumen', aliases: ['mililitro', 'mililitros'] },
  { value: 'pieza', label: 'Pieza (pza)', grupo: 'Conteo', aliases: ['pza', 'piezas'] },
  { value: 'unidad', label: 'Unidad (ud)', grupo: 'Conteo', aliases: ['ud', 'uds', 'unidades'] },
  { value: 'caja', label: 'Caja', grupo: 'Empaque', aliases: ['cajas'] },
  { value: 'bulto', label: 'Bulto', grupo: 'Empaque', aliases: ['bultos'] },
  { value: 'costal', label: 'Costal', grupo: 'Empaque', aliases: ['costales', 'saco', 'sacos'] },
  { value: 'paquete', label: 'Paquete', grupo: 'Empaque', aliases: ['paq', 'paquetes'] },
  { value: 'lata', label: 'Lata', grupo: 'Empaque', aliases: ['latas'] },
  { value: 'tanque', label: 'Tanque', grupo: 'Empaque', aliases: ['tanques'] },
  { value: 'manojo', label: 'Manojo', grupo: 'Conteo', aliases: ['manojos'] },
  { value: 'rollo', label: 'Rollo', grupo: 'Empaque', aliases: ['rollos'] },
  { value: 'carton', label: 'Cartón', grupo: 'Empaque', aliases: ['carton', 'cartones'] },
  { value: 'reja', label: 'Reja', grupo: 'Empaque', aliases: ['rejas'] },
  { value: 'barra', label: 'Barra', grupo: 'Empaque', aliases: ['barras'] },
  { value: 'bolsa', label: 'Bolsa', grupo: 'Empaque', aliases: ['bolsas'] },
  { value: 'botella', label: 'Botella', grupo: 'Empaque', aliases: ['botellas'] }
];

const CONVERSION_MAP = {
  kg: [
    { a: 'g', factor: 1000, label: 'g' }
  ],
  g: [{ a: 'kg', factor: 0.001, label: 'kg' }],
  lt: [
    { a: 'ml', factor: 1000, label: 'ml' },
    { a: 'tazas', factor: 4.167, label: 'tazas (aprox)' }
  ],
  ml: [
    { a: 'lt', factor: 0.001, label: 'lt' },
    { a: 'cucharadas', factor: 0.0667, label: 'cucharadas (aprox)' }
  ],
  manojo: [
    { a: 'g', factor: 150, label: 'g (aprox)' }
  ],
  pieza: [
    { a: 'mitad', factor: 2, label: 'mitades' },
    { a: 'cuarto', factor: 4, label: 'cuartos' }
  ]
};

function convertirUnidades(cantidad, unidad) {
  const num = Number(cantidad);
  if (!num || !unidad) return [];
  const conversiones = CONVERSION_MAP[unidad.toLowerCase().trim()];
  if (!conversiones) return [];
  return conversiones.map((c) => ({
    valor: (num * c.factor).toLocaleString('es-MX', { maximumFractionDigits: 2 }),
    unidad: c.label
  }));
}

const EQUIVALENCIAS_RAPIDAS = [
  { de: '1 kg', a: '1,000 g', nota: 'Peso' },
  { de: '1 lt', a: '1,000 ml', nota: 'Volumen' },
  { de: '1 costal frijol', a: '≈ 25-50 kg', nota: 'Varía por proveedor' },
  { de: '1 costal arroz', a: '≈ 20 kg', nota: 'Varía por marca' },
  { de: '1 bulto chile', a: '≈ 5 kg', nota: 'Aprox.' },
  { de: '1 caja huevo', a: '360 piezas', nota: '12 cartones × 30' },
  { de: '1 reja huevo', a: '30 piezas', nota: '1 cartón' },
  { de: '1 manojo cilantro', a: '≈ 150 g', nota: 'Compra por manojo' },
  { de: '1 manojo perejil', a: '≈ 100 g', nota: 'Compra por manojo' },
  { de: '1 manojo epazote', a: '≈ 80 g', nota: 'Compra por manojo' },
  { de: '1 barra mantequilla', a: '≈ 90 g', nota: 'Marca estándar' },
  { de: '1.5 piezas jitomate', a: '1 entera + 1 mitad', nota: '0.5 pieza = merma o guardado' },
  { de: '1 pieza', a: '2 mitades / 4 cuartos', nota: 'Pieza divisible' }
];

function getPurchaseUnitLabel(unitValue = '') {
  return UNIDADES_COMPRA.find((unit) => unit.value === unitValue)?.label || unitValue;
}

function findPurchaseUnitMatch(query = '') {
  const normalizedQuery = normalizeCatalogSearch(query);
  if (!normalizedQuery) return null;
  const buildHaystack = (unit) => normalizeCatalogSearch([unit.value, unit.label, unit.grupo, ...(unit.aliases || [])].join(' '));
  const exactMatch = UNIDADES_COMPRA.find((unit) => {
    const aliases = (unit.aliases || []).map((alias) => normalizeCatalogSearch(alias));
    return unit.value === normalizedQuery || normalizeCatalogSearch(unit.label) === normalizedQuery || aliases.includes(normalizedQuery);
  });
  if (exactMatch) return exactMatch;
  const matches = UNIDADES_COMPRA.filter((unit) => buildHaystack(unit).includes(normalizedQuery));
  return matches.length === 1 ? matches[0] : null;
}

function getSuggestedPurchaseUnits(query = '', fallback = '') {
  const normalizedQuery = normalizeCatalogSearch(query || fallback);
  if (!normalizedQuery) return UNIDADES_COMPRA;
  const buildHaystack = (unit) => normalizeCatalogSearch([unit.value, unit.label, unit.grupo, ...(unit.aliases || [])].join(' '));
  const directMatch = findPurchaseUnitMatch(query || fallback);
  const matches = UNIDADES_COMPRA.filter((unit) => buildHaystack(unit).includes(normalizedQuery));
  if (directMatch) {
    return [
      directMatch,
      ...UNIDADES_COMPRA.filter(
        (unit) => unit.value !== directMatch.value && (unit.grupo === directMatch.grupo || matches.some((match) => match.value === unit.value))
      )
    ];
  }
  return matches.length > 0 ? matches : UNIDADES_COMPRA;
}

function getFilteredEquivalences(query = '', fallback = '') {
  const normalizedQuery = normalizeCatalogSearch(query || fallback);
  if (!normalizedQuery) return EQUIVALENCIAS_RAPIDAS;
  const matches = EQUIVALENCIAS_RAPIDAS.filter((equivalence) => normalizeCatalogSearch(`${equivalence.de} ${equivalence.a} ${equivalence.nota}`).includes(normalizedQuery));
  return matches.length > 0 ? matches : EQUIVALENCIAS_RAPIDAS;
}

function getDefaultItemForm() {
  return {
    nombre_item: '',
    categoria: 'ingredientes',
    subcategoria: 'Verduras',
    tipo_conservacion: 'Refrigerado',
    unidad_consumo: 'kg',
    stock_actual: '',
    punto_reorden: '',
    precio_competencia_promedio: '',
    fuente_competencia: '',
    fecha_analisis_mercado: getTodayDate(),
    es_inventariable: true
  };
}

function getDefaultProviderForm() {
  return {
    nombre_prov: '',
    tipo_proveedor: TIPOS_PROVEEDOR[0],
    telefono_prov: '',
    correo_prov: '',
    direccion_prov: ''
  };
}

function getDefaultPurchaseForm() {
  return {
    ...getDefaultPurchaseCapture(),
    itemMode: 'existing',
    id_item: '',
    item_query: '',
    unidad_compra: 'kg',
    unit_query: getPurchaseUnitLabel('kg'),
    provider_query: '',
    id_proveedor: '',
    cantidad_recibida: '',
    precio_unitario_compra: '',
    fecha_entrada: getLocalDatetimeValue(),
    folio_externo: '',
    observaciones_compra: '',
    providerMode: 'existing',
    item_nuevo: {
      nombre_item: '',
      categoria: 'ingredientes',
      subcategoria: 'Verduras',
      tipo_conservacion: 'Refrigerado',
      unidad_consumo: 'kg',
      punto_reorden: '',
      precio_competencia_promedio: '',
      fuente_competencia: ''
    },
    proveedor_nuevo: getDefaultProviderForm()
  };
}

function isRentalProviderType(type) {
  const normalized = String(type || '').toLowerCase();
  return normalized.includes('renta') || normalized.includes('decoracion') || normalized.includes('ambientacion');
}

function roundMeasure(value) {
  return Number(toNumber(value).toFixed(3));
}

function parseTicketMetadata(observaciones) {
  const text = String(observaciones || '');
  const data = {
    clienteName: '',
    clientePhone: '',
    clienteEmail: '',
    lugarEvento: '',
    direccionEvento: '',
    referencia: '',
    fechaEvento: '',
    personasEvento: 0,
    solicitadoPor: ''
  };

  // Extraer datos de formato taggeado: --meta:{...}
  const metaMatch = text.match(/--meta:\s*({.*?})/);
  if (metaMatch) {
    try {
      const parsed = JSON.parse(metaMatch[1]);
      return { ...data, ...parsed };
    } catch (e) {
      // Si falla el JSON, continuar con parsing manual
    }
  }

  // Parsing manual como fallback
  const clienteMatch = text.match(/Cliente:\s*([^|]+)/i);
  if (clienteMatch) data.clienteName = clienteMatch[1].trim();
  
  const telMatch = text.match(/Tel:\s*([^|]+)/i);
  if (telMatch) data.clientePhone = telMatch[1].trim();
  
  const emailMatch = text.match(/Correo:\s*([^|]+)/i);
  if (emailMatch) data.clienteEmail = emailMatch[1].trim();
  
  const lugarMatch = text.match(/Lugar:\s*([^|]+)/i);
  if (lugarMatch) data.lugarEvento = lugarMatch[1].trim();
  
  const dirMatch = text.match(/Dirección:\s*([^|]+)/i);
  if (dirMatch) data.direccionEvento = dirMatch[1].trim();

  return data;
}

function parseRol(observaciones) {
  const text = String(observaciones || '');
  const match = text.match(/Rol:\s*([^|\]]+)/i);
  return match?.[1]?.trim() || '';
}

function getChecklistPriority(label) {
  if (label === 'Rojo') return 'alta';
  if (label === 'Amarillo') return 'media';
  return 'baja';
}

function getChecklistPriorityWeight(priority) {
  if (priority === 'alta') return 0;
  if (priority === 'media') return 1;
  return 2;
}

function sortChecklist(items) {
  return [...items].sort((a, b) => {
    if (Boolean(a.checked) !== Boolean(b.checked)) return a.checked ? 1 : -1;
    const priorityDiff = getChecklistPriorityWeight(a.prioridad) - getChecklistPriorityWeight(b.prioridad);
    if (priorityDiff !== 0) return priorityDiff;
    return String(a.descripcion || '').localeCompare(String(b.descripcion || ''), 'es');
  });
}

function buildShoppingChecklist(almacenData, manualItems = []) {
  const catalogo = almacenData?.catalogo || [];
  const comprasHoy = almacenData?.comprasHoy || [];
  const comprasPorItem = new Map();
  comprasHoy.forEach((lote) => {
    const itemId = Number(lote.id_item || 0);
    const current = comprasPorItem.get(itemId) || [];
    current.push(lote);
    comprasPorItem.set(itemId, current);
  });
  const checklist = [];
  catalogo.forEach((item) => {
    const itemId = Number(item.id_item || 0);
    const comprasItem = comprasPorItem.get(itemId) || [];
    const cantidadCompradaHoy = roundMeasure(
      comprasItem.reduce((acc, lote) => acc + toNumber(lote.cantidad_recibida), 0)
    );
    const proveedores = Array.from(new Set(comprasItem.map((lote) => lote.proveedor_nombre).filter(Boolean)));
    const reorderPoint = toNumber(item.punto_reorden_interno || item.punto_reorden);
    const suggestedQuantity = roundMeasure(Math.max(toNumber(item.stock_maximo_interno) - toNumber(item.stock_actual), 0));
    const isAlert = item.semaforo?.label && item.semaforo.label !== 'Verde';
    if (isAlert) {
      checklist.push({
        id: `item-${itemId}`, itemId, descripcion: item.nombre_item,
        cantidad: suggestedQuantity || null, unidad: item.unidad_consumo || 'unidad',
        prioridad: getChecklistPriority(item.semaforo?.label), origen: 'stock', checked: false,
        stockActual: toNumber(item.stock_actual), reorden: reorderPoint,
        nota: cantidadCompradaHoy > 0
          ? `Llegó ${cantidadCompradaHoy} ${item.unidad_consumo || 'unidad'} hoy${proveedores.length ? ` · ${proveedores.join(', ')}` : ''}, pero sigue faltando revisar.`
          : `Sin compra registrada hoy · Stock ${toNumber(item.stock_actual)} / Reorden ${reorderPoint}`,
        createdBy: proveedores[0] || 'Sistema', purchasedToday: cantidadCompradaHoy
      });
      return;
    }
    if (cantidadCompradaHoy > 0) {
      checklist.push({
        id: `item-${itemId}`, itemId, descripcion: item.nombre_item,
        cantidad: cantidadCompradaHoy, unidad: item.unidad_consumo || 'unidad',
        prioridad: 'baja', origen: 'compra', checked: true,
        stockActual: toNumber(item.stock_actual), reorden: reorderPoint,
        nota: `Compra registrada hoy${proveedores.length ? ` · ${proveedores.join(', ')}` : ''}`,
        createdBy: proveedores[0] || 'Proveedor registrado', purchasedToday: cantidadCompradaHoy
      });
    }
  });
  const checklistManual = (manualItems || []).map((item) => ({
    ...item,
    stockActual: item.stockActual ?? null,
    reorden: item.reorden ?? null,
    purchasedToday: item.purchasedToday ?? 0
  }));

  return sortChecklist([...checklist, ...checklistManual]);
}

export default function CateringWorkspace({ activeSection, user, onOpenMenu, onNavigateSection }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [usuarios, setUsuarios] = useState([]);
  const [usuariosError, setUsuariosError] = useState('');
  const [isSavingUser, setIsSavingUser] = useState(false);
  const [userForm, setUserForm] = useState(getDefaultCateringUserForm());
  const [userMessage, setUserMessage] = useState('');
  const [userFormError, setUserFormError] = useState('');
  const [businessConfigForm, setBusinessConfigForm] = useState(getDefaultBusinessConfigForm(user));
  const [businessConfigMessage, setBusinessConfigMessage] = useState('');
  const [businessConfigError, setBusinessConfigError] = useState('');
  const [isSavingBusinessConfig, setIsSavingBusinessConfig] = useState(false);
  const [cotizacionForm, setCotizacionForm] = useState(getDefaultCotizacionForm());
  const [eventoForm, setEventoForm] = useState(getDefaultEventoForm());
  const [eventoFormChecklist, setEventoFormChecklist] = useState(getDefaultEventoForm());
  const [operacionForm, setOperacionForm] = useState(getDefaultOperacionForm());
  const [seleccion, setSeleccion] = useState({ cotizacion: null, evento: null, operacion: null });
  const [moduleMessage, setModuleMessage] = useState('');
  const [moduleError, setModuleError] = useState('');
  const [isSavingModule, setIsSavingModule] = useState(false);
  const [historialFiltro, setHistorialFiltro] = useState({ periodo: 'mes', fechaInicio: '', fechaFin: '' });
  // Almacén y compras catering
  const [almacenCompras, setAlmacenCompras] = useState(null);
  const [almacenError, setAlmacenError] = useState('');
  const [gestionActiva, setGestionActiva] = useState('inventario');
  const [almacenSeleccion, setAlmacenSeleccion] = useState({ inventario: null, proveedor: null, compra: null });
  const [itemForm, setItemForm] = useState(getDefaultItemForm());
  const [providerForm, setProviderForm] = useState(getDefaultProviderForm());
  const [purchaseForm, setPurchaseForm] = useState(getDefaultPurchaseForm());
  const [inventarioFiltro, setInventarioFiltro] = useState({ grupo: 'todos', subcategoria: 'todas' });
  const [operationMessage, setOperationMessage] = useState('');
  const [operationError, setOperationError] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [shoppingChecklist, setShoppingChecklist] = useState([]);
  const [selectedChecklistIds, setSelectedChecklistIds] = useState([]);
  const [recepcionChecklist, setRecepcionChecklist] = useState({});
  const [autoSaveReceptionState, setAutoSaveReceptionState] = useState('idle');
  const [purchaseSessionIds, setPurchaseSessionIds] = useState([]);
  const [manualChecklistForm, setManualChecklistForm] = useState(getDefaultChecklistForm());
  const [isSavingChecklistItem, setIsSavingChecklistItem] = useState(false);
  const lastAutoSavedReceptionRef = useRef('');
  const copy = getSectionMeta(activeSection);
  const isNuevoUsuarioSection = activeSection === 'nuevo_usuario_catering';
  const isConfiguracionSection = activeSection === 'configuracion_catering';
  const isEventosSection = activeSection === 'eventos_catering';
  const isCotizacionesSection = activeSection === 'cotizaciones_catering';
  const isOperacionSection = activeSection === 'operacion_catering';
  const isAlmacenComprasSection = activeSection === 'almacen_compras_catering';
  const isMovimientosSection = activeSection === 'movimientos_catering';
  const isAdminPreciosSection = activeSection === 'admin_precios_catering';
  const isDashboardCateringSection = activeSection === 'dashboard_catering';
  const [operacionTab, setOperacionTab] = useState('checklist'); // 'checklist' o 'movimientos'

  // Movimientos catering state
  const [movimientosCatData, setMovimientosCatData] = useState(null);
  const [movimientosCatError, setMovimientosCatError] = useState('');
  const [movimientosCatFiltro, setMovimientosCatFiltro] = useState({ 
    periodo: 'semana', 
    fechaInicio: '', 
    fechaFin: '',
    horaInicio: '00:00',
    horaFin: '23:59'
  });
  const [salidaCatForm, setSalidaCatForm] = useState({
    idInsumo: '',
    cantidad: '',
    tipoDetalle: 'uso_evento',
    tipoProveedor: 'interno', // interno, externo_alquiler, externo_servicio
    esRenta: false,
    equipoRenta: '', // sillas, mesas, vajilla, decoracion, etc
    condicionEquipo: 'ok', // ok, dañado, roto, perdido, parcial
    motivo: '',
    observacionesDetalladas: '',
    responsable: '',
    idEvento: '',
    fechaRegistro: getLocalDatetimeValue()
  });
  const [salidaCatMessage, setSalidaCatMessage] = useState('');
  const [salidaCatError, setSalidaCatError] = useState('');
  const [isSavingSalidaCat, setIsSavingSalidaCat] = useState(false);

  async function recargarOperacion() {
    const result = await obtenerOperacionCatering({ businessId: user.business_id || undefined });
    if (result.error) {
      setError(result.error);
      setData(null);
      setMovimientosCatData(null);
      return null;
    }

    setError('');
    setData(result.data);
    
    // Cargar movimientos desde los datos de la operación
    if (result.data?.movimientos) {
      setMovimientosCatData({
        movimientos: result.data.movimientos,
        resumen: result.data.resumen
      });
    }
    
    return result.data;
  }

  useEffect(() => {
    limpiarCacheAlmacen();  // Limpiar caché al cambiar de negocio
    recargarOperacion();
  }, [user.business_id]);

  // Escuchar cambios en tiempo real de equipos y proveedores
  useEffect(() => {
    if (!user?.business_id) return;

    const unsubscribe = syncService.subscribeToChanges(
      user.business_id,
      user?.id_usuario,
      (payload) => {
        // Equipos cambiaron
        console.log('[CateringWorkspace] Equipos actualizados:', payload);
        recargarOperacion();
      },
      (payload) => {
        // Proveedores cambiaron
        console.log('[CateringWorkspace] Proveedores actualizados:', payload);
        recargarOperacion();
      }
    );

    return () => {
      if (unsubscribe && typeof unsubscribe === 'function') {
        unsubscribe();
      }
    };
  }, [user?.business_id, user?.id_usuario]);

  useEffect(() => {
    let isMounted = true;

    async function cargarUsuarios() {
      if (!isNuevoUsuarioSection && !isConfiguracionSection) {
        return;
      }

      const result = await obtenerUsuariosVisiblesPorNegocio({
        actorEmail: user?.correo,
        businessId: user?.business_id,
        scope: 'catering'
      });
      if (!isMounted) {
        return;
      }

      if (result.error) {
        const fallback = await obtenerUsuariosCatering();
        if (!isMounted) {
          return;
        }

        if (fallback.error) {
          setUsuarios([]);
          setUsuariosError(fallback.error);
          return;
        }

        setUsuarios(fallback.data || []);
        setUsuariosError('');
        return;
      }

      setUsuarios(result.data || []);
      setUsuariosError('');
    }

    cargarUsuarios();
    return () => {
      isMounted = false;
    };
  }, [isNuevoUsuarioSection, isConfiguracionSection]);

  async function recargarUsuariosCatering() {
    const result = await obtenerUsuariosVisiblesPorNegocio({
      actorEmail: user?.correo,
      businessId: user?.business_id,
      scope: 'catering'
    });

    if (result.error) {
      const fallback = await obtenerUsuariosCatering();
      if (fallback.error) {
        setUsuarios([]);
        setUsuariosError(result.error);
        return;
      }

      setUsuarios(fallback.data || []);
      setUsuariosError('');
      return;
    }

    if (result.error) {
      setUsuarios([]);
      setUsuariosError(result.error);
      return;
    }

    setUsuarios(result.data || []);
    setUsuariosError('');
  }

  async function cargarConfiguracionNegocioCatering() {
    const result = await obtenerConfiguracionNegocio({ businessId: user.business_id || undefined });
    if (result.error) {
      setBusinessConfigError(result.error);
      return null;
    }

    const logoPreview = window.localStorage.getItem(getBusinessLogoStorageKey('catering', user.business_id));
    setBusinessConfigError('');
    setBusinessConfigForm({
      nombre_negocio: result.data?.nombre_negocio || user.business_name || '',
      tipo_negocio: result.data?.tipo_negocio || user.business_type || 'catering',
      logo_preview: logoPreview || ''
    });
    return result.data;
  }

  useEffect(() => {
    let isMounted = true;

    async function cargarConfiguracion() {
      const result = await cargarConfiguracionNegocioCatering();
      if (!isMounted || !result) {
        return;
      }
    }

    if (isConfiguracionSection) {
      cargarConfiguracion();
    }

    return () => {
      isMounted = false;
    };
  }, [isConfiguracionSection, user.business_id]);

  // --- Almacén y compras ---
  async function cargarAlmacen() {
    const result = await obtenerAlmacenCompras({ businessId: user.business_id || undefined });
    if (result.error) {
      setAlmacenError(result.error);
      setAlmacenCompras(null);
      setShoppingChecklist([]);
      return null;
    }
    setAlmacenError('');
    setAlmacenCompras(result.data);

    const checklistResult = await obtenerChecklistCompras({ businessId: user.business_id || undefined });
    if (checklistResult.error) {
      setShoppingChecklist(buildShoppingChecklist(result.data));
      return result.data;
    }

    setShoppingChecklist(buildShoppingChecklist(result.data, checklistResult.data || []));
    return result.data;
  }

  useEffect(() => {
    const shouldLoad = isAlmacenComprasSection || isDashboardCateringSection || (isOperacionSection && operacionTab === 'movimientos');
    if (shouldLoad) {
      cargarAlmacen();
    }
  }, [isAlmacenComprasSection, isDashboardCateringSection, isOperacionSection, operacionTab, user.business_id]);

  // Recargar cotizaciones cuando el usuario entra a la sección para obtener datos frescos
  // (cambios en Admin de Precios: recetas/proveedores/equipos activados/desactivados)
  useEffect(() => {
    if (isCotizacionesSection) {
      recargarOperacion();
    }
  }, [isCotizacionesSection]);

  // Escuchar cambios de activo/inactivo en Admin de Precios y actualizar cotizaciones en tiempo real
  useEffect(() => {
    if (!isCotizacionesSection || !user?.business_id) return;

    let isDisposed = false;
    
    // Escuchar evento de cambios en Admin de Precios
    const handleAdminPreciosChanged = () => {
      if (!isDisposed) {
        recargarOperacion();
      }
    };

    // Escuchar cambios de activo/inactivo en localStorage
    const handleStorageChange = (event) => {
      if (!event.key) return;
      if (event.key.startsWith('inactivo_receta_') || 
          event.key.startsWith('inactivo_prov_') || 
          event.key.startsWith('inactivo_equip_')) {
        if (!isDisposed) {
          recargarOperacion();
        }
      }
    };

    window.addEventListener('admin-precios-changed', handleAdminPreciosChanged);
    window.addEventListener('storage', handleStorageChange);
    
    return () => {
      isDisposed = true;
      window.removeEventListener('admin-precios-changed', handleAdminPreciosChanged);
      window.removeEventListener('storage', handleStorageChange);
    };
  }, [isCotizacionesSection, user?.business_id]);

  useEffect(() => {
    const shouldLoad = isAlmacenComprasSection || isDashboardCateringSection || (isOperacionSection && operacionTab === 'movimientos');
    if (!shouldLoad || !user.business_id) {
      return undefined;
    }

    let isDisposed = false;
    const keySuffix = `-${user.business_id}`;
    const refreshAlmacen = async () => {
      if (isDisposed) {
        return;
      }

      await cargarAlmacen();
    };

    const intervalId = window.setInterval(refreshAlmacen, ALMACEN_SYNC_INTERVAL_MS);
    const handleStorage = (event) => {
      if (!event.key) {
        return;
      }

      const isOverlayKey =
        event.key.startsWith(LOCAL_ALMACEN_OVERLAY_PREFIX) ||
        event.key.startsWith(LOCAL_CHECKLIST_OVERLAY_PREFIX);

      if (isOverlayKey && event.key.endsWith(keySuffix)) {
        refreshAlmacen();
      }
    };

    window.addEventListener('storage', handleStorage);
    return () => {
      isDisposed = true;
      window.clearInterval(intervalId);
      window.removeEventListener('storage', handleStorage);
    };
  }, [isAlmacenComprasSection, isDashboardCateringSection, isOperacionSection, operacionTab, user.business_id]);

  useEffect(() => {
    const shouldLoad = isMovimientosSection || (isOperacionSection && operacionTab === 'movimientos');
    if (!shouldLoad || !user.business_id) return;
    
    // Usa los movimientos que ya vienen en data de obtenerOperacionCatering
    if (data?.movimientos) {
      setMovimientosCatError('');
      setMovimientosCatData({
        movimientos: data.movimientos,
        resumen: data.resumen
      });
    } else {
      setMovimientosCatData(null);
    }
  }, [isMovimientosSection, isOperacionSection, operacionTab, user.business_id, data]);

  async function handleGuardarSalidaCatering() {
    if (!user.business_id || !salidaCatForm.idInsumo || !salidaCatForm.cantidad) {
      setSalidaCatError('Selecciona un insumo e ingresa la cantidad.');
      return;
    }
    setIsSavingSalidaCat(true);
    setSalidaCatError('');
    setSalidaCatMessage('');
    const fechaISO = salidaCatForm.fechaRegistro ? new Date(salidaCatForm.fechaRegistro).toISOString() : undefined;
    const itemCatalogo = (almacenCompras?.catalogo || []).find(
      (item) => String(item.id_insumo) === String(salidaCatForm.idInsumo) ||
                String(item.id_item) === String(salidaCatForm.idInsumo)
    );
    const result = await registrarSalidaInsumo({
      businessId: user.business_id,
      idInsumo: salidaCatForm.idInsumo,
      cantidad: salidaCatForm.cantidad,
      tipoDetalle: salidaCatForm.tipoDetalle || 'uso_evento',
      motivo: salidaCatForm.motivo,
      responsable: salidaCatForm.responsable || user.nombre_completo,
      idEvento: salidaCatForm.idEvento || undefined,
      fechaRegistro: fechaISO,
      itemSnapshot: itemCatalogo ? {
        nombre_item: itemCatalogo.nombre_item,
        stock_actual: itemCatalogo.stock_actual,
        costo_unitario_promedio: itemCatalogo.precio_competencia_promedio || itemCatalogo.costo_unitario_promedio
      } : undefined
    });
    if (result.error) {
      setSalidaCatError(result.error);
    } else {
      const tipoLabel = TIPOS_SALIDA.find((t) => t.value === salidaCatForm.tipoDetalle)?.label || salidaCatForm.tipoDetalle;
      setSalidaCatMessage(`Salida registrada: ${result.data?.cantidad} ${result.data?.nombre_item} · ${tipoLabel}`);
      setSalidaCatForm((prev) => ({ ...prev, idInsumo: '', cantidad: '', motivo: '' }));
      setMovimientosCatFiltro((prev) => ({ ...prev })); // trigger reload
    }
    setIsSavingSalidaCat(false);
  }
  const selectedProvider = almacenCompras?.proveedores.find((item) => item.id_proveedor === almacenSeleccion.proveedor) || null;
  const selectedPurchase = almacenCompras?.lotes.find((item) => item.id_compra === almacenSeleccion.compra || item.id_lote === almacenSeleccion.compra) || null;
  const subcategoriasDisponibles = CATEGORIAS_CATALOGO.find((option) => option.value === itemForm.categoria)?.subcategorias || [];
  const subcategoriasCompraRapida = CATEGORIAS_CATALOGO.find((option) => option.value === purchaseForm.item_nuevo.categoria)?.subcategorias || [];
  const compraTotalPreview = Number(purchaseForm.cantidad_recibida || 0) * Number(purchaseForm.precio_unitario_compra || 0);
  const subcategoriaResumen = almacenCompras
    ? Object.entries(
        almacenCompras.catalogo.reduce((acc, item) => {
          const key = item.subcategoria || 'Sin subcategoria';
          acc[key] = (acc[key] || 0) + 1;
          return acc;
        }, {})
      ).sort((a, b) => a[0].localeCompare(b[0], 'es'))
    : [];
  const proveedoresPorTipo = almacenCompras
    ? Object.entries(
        almacenCompras.proveedores.reduce((acc, item) => {
          const key = item.tipo_proveedor || 'Sin tipo';
          acc[key] = (acc[key] || 0) + 1;
          return acc;
        }, {})
      )
    : [];
  const catalogoFiltrado = (almacenCompras?.catalogo || []).filter((item) => {
    const coincideGrupo = inventarioFiltro.grupo === 'todos' || item.grupo === inventarioFiltro.grupo;
    const coincideSubcategoria = inventarioFiltro.subcategoria === 'todas' || item.subcategoria === inventarioFiltro.subcategoria;
    return coincideGrupo && coincideSubcategoria;
  });
  const subcategoriasFiltro = Array.from(
    new Set(
      (inventarioFiltro.grupo === 'todos'
        ? CATEGORIAS_CATALOGO.flatMap((option) => option.subcategorias)
        : CATEGORIAS_CATALOGO.find((option) => option.value === inventarioFiltro.grupo)?.subcategorias || []
      ).concat(
        (almacenCompras?.catalogo || [])
          .filter((item) => inventarioFiltro.grupo === 'todos' || item.grupo === inventarioFiltro.grupo)
          .map((item) => item.subcategoria || 'Sin subcategoria')
      )
    )
  ).sort((a, b) => a.localeCompare(b, 'es'));
  const checklistPendientes = shoppingChecklist.filter((item) => !item.checked);
  const checklistCompletados = shoppingChecklist.filter((item) => item.checked);
  const checklistUrgentes = checklistPendientes.filter((item) => item.prioridad === 'alta');
  const checklistSeleccionado = shoppingChecklist.filter((item) => selectedChecklistIds.includes(item.id));
  const purchaseSessionItems = purchaseSessionIds
    .map((id) => (almacenCompras?.lotes || []).find((item) => (item.id_compra || item.id_lote) === id))
    .filter(Boolean);

  function buildPurchaseReceptionItem(purchase) {
    if (!purchase) {
      return null;
    }

    return {
      id: `purchase-${purchase.id_compra || purchase.id_lote}`,
      itemId: purchase.id_item || purchase.id_insumo || null,
      descripcion: purchase.item_nombre,
      cantidad: purchase.cantidad_recibida,
      unidad: purchase.unidad_consumo,
      checked: true,
      nota: purchase.observaciones_compra,
      createdBy: parseResponsable(purchase.observaciones_compra) || purchase.responsable || ''
    };
  }

  const selectedPurchaseReceptionItem = buildPurchaseReceptionItem(selectedPurchase);
  const activeReceptionItems = checklistSeleccionado.length
    ? checklistSeleccionado
    : selectedPurchaseReceptionItem
      ? [selectedPurchaseReceptionItem]
      : [];

  function getRecepcionDefaultState(item) {
    return {
      llego: false,
      noLlego: false,
      cantidadRecibida: item?.cantidad || '',
      condicion: 'buena',
      nota: ''
    };
  }

  function escapeRegExp(value = '') {
    return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  function getRecepcionLines(observaciones = '') {
    const recepcionMatch = String(observaciones || '').match(/\[Recepción\]\s*(.+?)(?:\[Resumen\]|$)/);
    return recepcionMatch ? recepcionMatch[1].split(' | ').filter(Boolean).map((line) => line.trim()) : [];
  }

  function buildRecepcionStateFromPurchase(items, purchase) {
    const lines = getRecepcionLines(purchase?.observaciones_compra || '');
    return items.reduce((accumulator, item) => {
      const fallback = getRecepcionDefaultState(item);
      const itemLine = lines.find((line) => line.toLowerCase().includes(String(item.descripcion || '').trim().toLowerCase()));
      if (!itemLine) {
        accumulator[item.id] = fallback;
        return accumulator;
      }

      const quantityMatch = item.descripcion
        ? itemLine.match(new RegExp(`${escapeRegExp(item.descripcion)}\\s+([\\d.,]+)`, 'i'))
        : null;
      const noteMatch = itemLine.match(/ — (.+)$/);
      const conditionMatch = itemLine.match(/ · (regular|mala|incompleto)/i);

      accumulator[item.id] = {
        llego: itemLine.startsWith('✓'),
        noLlego: itemLine.startsWith('✗'),
        cantidadRecibida: quantityMatch?.[1] || fallback.cantidadRecibida,
        condicion: conditionMatch?.[1]?.toLowerCase() || fallback.condicion,
        nota: noteMatch?.[1] || ''
      };
      return accumulator;
    }, {});
  }

  function getPurchaseItemResetForm(current) {
    return {
      ...current,
      itemMode: 'existing',
      id_item: '',
      item_query: '',
      cantidad_recibida: '',
      precio_unitario_compra: '',
      observaciones_compra: '',
      unit_query: getPurchaseUnitLabel(current.unidad_compra || 'kg'),
      item_nuevo: {
        ...getDefaultPurchaseForm().item_nuevo,
        categoria: current.item_nuevo?.categoria || 'ingredientes',
        subcategoria: current.item_nuevo?.subcategoria || 'Verduras',
        tipo_conservacion: current.item_nuevo?.tipo_conservacion || 'Refrigerado',
        unidad_consumo: current.item_nuevo?.unidad_consumo || current.unidad_compra || 'kg'
      }
    };
  }

  function hasMeaningfulRecepcionChanges(items, currentState) {
    return items.some((item) => {
      const current = currentState[item.id] || getRecepcionDefaultState(item);
      return current.llego || current.noLlego || String(current.nota || '').trim() || current.condicion !== 'buena' || String(current.cantidadRecibida || '') !== String(item.cantidad || '');
    });
  }

  function serializeRecepcionSnapshot(compraId, items, currentState) {
    if (!compraId || !items.length) {
      return '';
    }

    return JSON.stringify({
      compraId,
      items: items.map((item) => {
        const recepcion = currentState[item.id] || getRecepcionDefaultState(item);
        return {
          id: item.id,
          llego: Boolean(recepcion.llego),
          noLlego: Boolean(recepcion.noLlego),
          cantidadRecibida: String(recepcion.cantidadRecibida || ''),
          condicion: recepcion.condicion || 'buena',
          nota: String(recepcion.nota || '').trim()
        };
      })
    });
  }

  function buildPurchaseObservacionesConRecepcion({
    baseNote,
    purchaseFlow,
    evidenceType,
    items,
    currentState,
    responsable,
    rol
  }) {
    let observacionesFinal = buildPurchaseObservations({
      note: baseNote,
      purchaseFlow: normalizePurchaseFlow(purchaseFlow),
      evidenceType: normalizePurchaseEvidence(evidenceType)
    });

    const recepcionEntries = items
      .map((item) => [item.id, currentState[item.id] || getRecepcionDefaultState(item)])
      .filter(([, recepcion]) => recepcion);

    if (!recepcionEntries.length) {
      return observacionesFinal;
    }

    let totalRecibidoGuardar = 0;
    let totalPerdidoGuardar = 0;
    let itemsRecibidos = 0;
    let itemsPerdidos = 0;
    const recepcionLines = recepcionEntries.map(([itemId, recepcion]) => {
      const chkItem = items.find((entry) => entry.id === itemId);
      const nombre = chkItem?.descripcion || itemId;
      const llegada = recepcion.llego ? '✓' : recepcion.noLlego ? '✗ NO LLEGÓ' : '?';
      const cond = recepcion.condicion !== 'buena' ? ` · ${recepcion.condicion}` : '';
      const cant = recepcion.cantidadRecibida ? ` ${recepcion.cantidadRecibida} ${chkItem?.unidad || ''}`.trim() : '';
      const nota = recepcion.nota ? ` — ${recepcion.nota}` : '';
      const catItem = chkItem?.itemId ? (almacenCompras?.catalogo || []).find((entry) => Number(entry.id_item) === chkItem.itemId) : null;
      const precio = toNumber(catItem?.ultimo_precio_compra || catItem?.precio_competencia_promedio || 0);
      const cantNum = toNumber(recepcion.cantidadRecibida || 0);
      const subtotal = cantNum * precio;

      if (recepcion.llego) {
        itemsRecibidos++;
        totalRecibidoGuardar += subtotal;
      }

      if (recepcion.noLlego) {
        itemsPerdidos++;
        totalPerdidoGuardar += cantNum > 0 ? subtotal : toNumber(chkItem?.cantidad || 0) * precio;
      }

      const precioStr = precio > 0 && cantNum > 0 ? ` $${subtotal.toFixed(2)}` : '';
      return `${llegada} ${nombre}${cant}${precioStr}${cond}${nota}`;
    });

    const totalGeneral = totalRecibidoGuardar + totalPerdidoGuardar;
    const resumenLinea = `[Resumen] Recibidos: ${itemsRecibidos} ($${totalRecibidoGuardar.toFixed(2)})` +
      (itemsPerdidos > 0 ? ` | Pérdidas: ${itemsPerdidos} ($${totalPerdidoGuardar.toFixed(2)})` : '') +
      ` | Total lote: $${totalGeneral.toFixed(2)} | Revisó: ${responsable || 'Sin responsable'}${rol ? ` (${rol})` : ''}`;
    const recepcionBloque = `[Recepción] ${recepcionLines.join(' | ')} ${resumenLinea}`;
    return observacionesFinal ? `${observacionesFinal} ${recepcionBloque}` : recepcionBloque;
  }

  function abrirCompraDesdeInsumo(item) {
    setGestionActiva('compra');
    setAlmacenSeleccion((current) => ({ ...current, compra: null }));
    setSelectedChecklistIds([]);
    setRecepcionChecklist({});
    setAutoSaveReceptionState('idle');
    lastAutoSavedReceptionRef.current = '';
    setPurchaseForm((current) => ({
      ...current,
      itemMode: 'existing',
      id_item: String(item?.id_item || ''),
      item_query: item ? getPurchaseCatalogLabel(item) : '',
      unidad_compra: item?.unidad_consumo || current.unidad_compra,
      unit_query: getPurchaseUnitLabel(item?.unidad_consumo || current.unidad_compra),
      precio_unitario_compra: item?.ultimo_precio_compra || item?.precio_competencia_promedio || current.precio_unitario_compra
    }));
  }

  function renderItemPurchaseHistory(itemId, emptyMessage = 'Todavía no hay compras registradas para este insumo.') {
    const history = (almacenCompras?.lotes || [])
      .filter((entry) => Number(entry.id_item) === Number(itemId))
      .sort((left, right) => new Date(right.fecha_entrada || 0).getTime() - new Date(left.fecha_entrada || 0).getTime())
      .slice(0, 5);

    if (!history.length) {
      return <span className="recepcion-meta">{emptyMessage}</span>;
    }

    return (
      <div className="purchase-history-card">
        <div className="purchase-history-inline"><strong>Compras registradas</strong><span>Últimos lotes capturados para este insumo.</span></div>
        <div className="purchase-history-list">
          {history.map((entry) => (
            <button type="button" key={`${entry.id_compra}-${entry.id_lote}`} className="purchase-history-row" onClick={() => handleSelectRegistro('compra', entry)}>
              <div>
                <strong>{formatDateTime(entry.fecha_entrada)}</strong>
                <span>{entry.proveedor_nombre} · {entry.cantidad_recibida} {entry.unidad_consumo}</span>
              </div>
              <em>{formatCurrency(entry.total_lote)}</em>
            </button>
          ))}
        </div>
      </div>
    );
  }

  async function persistSelectedPurchaseReception(snapshot) {
    if (!selectedPurchase || !user.business_id) {
      return;
    }

    const compraId = selectedPurchase.id_compra || selectedPurchase.id_lote;
    const purchaseMeta = parsePurchaseMetadata(selectedPurchase.observaciones_compra || '');
    const observacionesFinal = buildPurchaseObservacionesConRecepcion({
      baseNote: purchaseMeta.baseNote,
      purchaseFlow: purchaseMeta.metadata.purchase_flow,
      evidenceType: purchaseMeta.metadata.evidence_type,
      items: activeReceptionItems,
      currentState: recepcionChecklist,
      responsable: user.nombre_completo,
      rol: user.rol_nombre
    });

    setAutoSaveReceptionState('saving');
    const result = await guardarCompra({
      businessId: user.business_id,
      loteId: compraId,
      data: {
        purchase_flow: purchaseMeta.metadata.purchase_flow,
        evidence_type: purchaseMeta.metadata.evidence_type,
        itemMode: 'existing',
        id_item: String(selectedPurchase.id_item || selectedPurchase.id_insumo || ''),
        providerMode: 'existing',
        id_proveedor: selectedPurchase.id_proveedor ? String(selectedPurchase.id_proveedor) : '',
        unidad_compra: selectedPurchase.unidad_consumo || 'unidad',
        cantidad_recibida: selectedPurchase.cantidad_recibida,
        precio_unitario_compra: selectedPurchase.precio_unitario_compra,
        fecha_entrada: selectedPurchase.fecha_entrada,
        folio_externo: selectedPurchase.folio_externo,
        observaciones_compra: observacionesFinal,
        modulo: selectedPurchase.modulo || 'catering',
        responsable_registro: parseResponsable(selectedPurchase.observaciones_compra) || selectedPurchase.responsable || user.nombre_completo,
        rol_registro: parseRol(selectedPurchase.observaciones_compra) || user.rol_nombre
      }
    });

    if (result.error) {
      setAutoSaveReceptionState('error');
      setFeedback('', result.error);
      return;
    }

    lastAutoSavedReceptionRef.current = snapshot;
    setAutoSaveReceptionState('saved');
    await cargarAlmacen();
    setAlmacenSeleccion((current) => ({ ...current, compra: result.data?.id_compra || compraId }));
  }

  useEffect(() => {
    if (gestionActiva !== 'compra' || !selectedPurchase || !activeReceptionItems.length) {
      return undefined;
    }

    if (!hasMeaningfulRecepcionChanges(activeReceptionItems, recepcionChecklist)) {
      return undefined;
    }

    const compraId = selectedPurchase.id_compra || selectedPurchase.id_lote;
    const snapshot = serializeRecepcionSnapshot(compraId, activeReceptionItems, recepcionChecklist);
    if (!snapshot || snapshot === lastAutoSavedReceptionRef.current) {
      return undefined;
    }

    setAutoSaveReceptionState('pending');
    const timer = window.setTimeout(() => {
      persistSelectedPurchaseReception(snapshot);
    }, 800);

    return () => window.clearTimeout(timer);
  }, [gestionActiva, selectedPurchase, activeReceptionItems, recepcionChecklist, user.business_id]);

  function setFeedback(message = '', errorMessage = '') {
    setOperationMessage(message);
    setOperationError(errorMessage);
  }

  function abrirCompras(record = null) {
    setGestionActiva('compra');
    if (record?.id_lote) {
      setAlmacenSeleccion((current) => ({ ...current, compra: record.id_compra || record.id_lote }));
      setAutoSaveReceptionState('idle');
      lastAutoSavedReceptionRef.current = '';
      const recepcionItem = buildPurchaseReceptionItem(record);
      if (recepcionItem) {
        const hydratedReception = buildRecepcionStateFromPurchase([recepcionItem], record);
        setSelectedChecklistIds([]);
        setRecepcionChecklist((current) => ({ ...current, ...hydratedReception }));
        lastAutoSavedReceptionRef.current = serializeRecepcionSnapshot(record.id_compra || record.id_lote, [recepcionItem], hydratedReception);
      }
      return;
    }
    setAlmacenSeleccion((current) => ({ ...current, compra: null }));
  }

  function handleSelectChecklistCompra(item) {
    setAlmacenSeleccion((current) => ({ ...current, compra: null }));
    setAutoSaveReceptionState('idle');
    lastAutoSavedReceptionRef.current = '';
    setSelectedChecklistIds((current) => {
      const exists = current.includes(item.id);
      return exists ? current.filter((entry) => entry !== item.id) : [...current, item.id];
    });
    setRecepcionChecklist((current) => {
      if (current[item.id]) return current;
      return { ...current, [item.id]: getRecepcionDefaultState(item) };
    });
    if (item.itemId) {
      const catalogItem = (almacenCompras?.catalogo || []).find((c) => Number(c.id_item) === item.itemId);
      setPurchaseForm((current) => ({
        ...current, itemMode: 'existing', id_item: String(item.itemId), item_query: catalogItem ? getPurchaseCatalogLabel(catalogItem) : item.descripcion || '',
        unidad_compra: catalogItem?.unidad_consumo || current.unidad_compra,
        unit_query: getPurchaseUnitLabel(catalogItem?.unidad_consumo || current.unidad_compra),
        cantidad_recibida: item.cantidad || '',
        precio_unitario_compra: catalogItem?.ultimo_precio_compra || catalogItem?.precio_competencia_promedio || ''
      }));
      return;
    }

    setPurchaseForm((current) => ({
      ...current,
      itemMode: 'quick',
      id_item: '',
      item_query: item.descripcion || '',
      cantidad_recibida: item.cantidad || current.cantidad_recibida,
      unidad_compra: item.unidad || current.unidad_compra,
      unit_query: getPurchaseUnitLabel(item.unidad || current.unidad_compra),
      item_nuevo: {
        ...current.item_nuevo,
        nombre_item: item.descripcion || current.item_nuevo.nombre_item,
        unidad_consumo: item.unidad || current.item_nuevo.unidad_consumo
      }
    }));
  }

  function actualizarRecepcionItem(itemId, campo, valor) {
    setRecepcionChecklist((current) => ({ ...current, [itemId]: { ...(current[itemId] || {}), [campo]: valor } }));
  }

  function resetActiveForm(section = gestionActiva) {
    if (section === 'inventario') { setItemForm(getDefaultItemForm()); setAlmacenSeleccion((c) => ({ ...c, inventario: null })); }
    if (section === 'proveedor') { setProviderForm(getDefaultProviderForm()); setAlmacenSeleccion((c) => ({ ...c, proveedor: null })); }
    if (section === 'compra') { setPurchaseForm(getDefaultPurchaseForm()); setManualChecklistForm(getDefaultChecklistForm()); setAlmacenSeleccion((c) => ({ ...c, compra: null })); setSelectedChecklistIds([]); setRecepcionChecklist({}); setAutoSaveReceptionState('idle'); setPurchaseSessionIds([]); lastAutoSavedReceptionRef.current = ''; }
  }

  async function handleAgregarChecklistManual() {
    if (!user.business_id) {
      setFeedback('', 'Tu usuario no tiene negocio asignado para operar este módulo.');
      return;
    }

    if (!String(manualChecklistForm.descripcion || '').trim()) {
      setFeedback('', 'Escribe qué necesitas agregar al checklist.');
      return;
    }

    setIsSavingChecklistItem(true);
    const result = await agregarChecklistManual({
      businessId: user.business_id,
      descripcion: manualChecklistForm.descripcion,
      cantidad: manualChecklistForm.cantidad,
      unidad: manualChecklistForm.unidad,
      prioridad: manualChecklistForm.prioridad,
      nota: manualChecklistForm.nota,
      responsable: user.nombre_completo
    });
    setIsSavingChecklistItem(false);

    if (result.error) {
      setFeedback('', result.error);
      return;
    }

    await cargarAlmacen();
    setManualChecklistForm(getDefaultChecklistForm());
    setFeedback('Pendiente agregado al checklist.');
  }

  function loadItemIntoForm(item) {
    setItemForm({
      nombre_item: item.nombre_item || '', categoria: item.categoria || 'ingredientes',
      subcategoria: item.subcategoria || 'Verduras', tipo_conservacion: item.tipo_conservacion || 'Refrigerado',
      unidad_consumo: item.unidad_consumo || 'kg', stock_actual: item.stock_actual ?? '',
      punto_reorden: item.punto_reorden ?? '', precio_competencia_promedio: item.precio_competencia_promedio ?? '',
      fuente_competencia: item.fuente_competencia || '', fecha_analisis_mercado: item.fecha_analisis_mercado || getTodayDate(),
      es_inventariable: item.es_inventariable !== false
    });
  }

  function loadProviderIntoForm(provider) {
    setProviderForm({
      nombre_prov: provider.nombre_prov || '', tipo_proveedor: provider.tipo_proveedor || TIPOS_PROVEEDOR[0],
      telefono_prov: provider.telefono_prov || '', correo_prov: provider.correo_prov || '',
      direccion_prov: provider.direccion_prov || ''
    });
  }

  function loadPurchaseIntoForm(lote) {
    const purchaseMeta = parsePurchaseMetadata(lote.observaciones_compra || '');
    setPurchaseForm({
      ...purchaseMeta.metadata,
      itemMode: 'existing', id_item: lote.id_item ? String(lote.id_item) : '', item_query: lote.item_nombre ? `${lote.item_nombre} · ${lote.item_subcategoria || 'Sin categoría'}` : '',
      unidad_compra: lote.unidad || lote.unidad_compra || 'kg',
      unit_query: getPurchaseUnitLabel(lote.unidad || lote.unidad_compra || 'kg'),
      provider_query: lote.proveedor_nombre || '',
      id_proveedor: lote.id_proveedor ? String(lote.id_proveedor) : '',
      cantidad_recibida: lote.cantidad_recibida ?? '', precio_unitario_compra: lote.precio_unitario_compra ?? '',
      fecha_entrada: getLocalDatetimeValue(lote.fecha_entrada), folio_externo: lote.folio_externo || '',
      observaciones_compra: purchaseMeta.baseNote,
      providerMode: 'existing', item_nuevo: getDefaultPurchaseForm().item_nuevo, proveedor_nuevo: getDefaultProviderForm()
    });
  }

  function handleSelectRegistro(section, record) {
    setGestionActiva(section);
    if (section === 'inventario') { setAlmacenSeleccion((c) => ({ ...c, inventario: record.id_item })); loadItemIntoForm(record); }
    if (section === 'proveedor') { setAlmacenSeleccion((c) => ({ ...c, proveedor: record.id_proveedor })); }
    if (section === 'compra') { setAlmacenSeleccion((c) => ({ ...c, compra: record.id_compra || record.id_lote })); setSelectedChecklistIds([]); setAutoSaveReceptionState('idle'); const recepcionItem = buildPurchaseReceptionItem(record); if (recepcionItem) { const hydratedReception = buildRecepcionStateFromPurchase([recepcionItem], record); setRecepcionChecklist((current) => ({ ...current, ...hydratedReception })); lastAutoSavedReceptionRef.current = serializeRecepcionSnapshot(record.id_compra || record.id_lote, [recepcionItem], hydratedReception); } }
  }

  function getChecklistLinkedPurchase(item) {
    const lotes = almacenCompras?.lotes || [];
    if (item?.itemId) {
      return lotes.find((entry) => Number(entry.id_item) === Number(item.itemId)) || null;
    }

    const normalized = String(item?.descripcion || '').trim().toLowerCase();
    return lotes.find((entry) => String(entry.item_nombre || '').trim().toLowerCase() === normalized) || null;
  }

  function handleChecklistCaptura(item) {
    setGestionActiva('compra');
    handleSelectChecklistCompra(item);
  }

  function handleChecklistRecepcion(item) {
    const linkedPurchase = getChecklistLinkedPurchase(item);
    setGestionActiva('compra');

    if (linkedPurchase) {
      const nextCompraId = linkedPurchase.id_compra || linkedPurchase.id_lote;
      const hydratedReception = buildRecepcionStateFromPurchase([item], linkedPurchase);
      setAlmacenSeleccion((current) => ({ ...current, compra: nextCompraId }));
      setSelectedChecklistIds([item.id]);
      setRecepcionChecklist((current) => ({ ...current, ...hydratedReception }));
      loadPurchaseIntoForm(linkedPurchase);
      lastAutoSavedReceptionRef.current = serializeRecepcionSnapshot(nextCompraId, [item], hydratedReception);
      setAutoSaveReceptionState(hasMeaningfulRecepcionChanges([item], hydratedReception) ? 'saved' : 'idle');
      return;
    }

    handleSelectChecklistCompra(item);
  }

  function handleChecklistInventario(item) {
    if (!item?.itemId) {
      setFeedback('', 'Ese pendiente todavía no está ligado a un insumo del inventario.');
      return;
    }

    const catalogItem = (almacenCompras?.catalogo || []).find((entry) => Number(entry.id_item) === Number(item.itemId));
    if (!catalogItem) {
      setFeedback('', 'No se encontró el insumo ligado a este pendiente.');
      return;
    }

    handleSelectRegistro('inventario', catalogItem);
  }

  async function guardarCompraDesdeFormulario({ keepOpenForNext = false } = {}) {
    if (!user.business_id) { setFeedback('', 'Tu usuario no tiene negocio asignado para operar este módulo.'); return null; }
    setIsSaving(true);
    setFeedback();

    const observacionesFinal = buildPurchaseObservacionesConRecepcion({
      baseNote: purchaseForm.observaciones_compra,
      purchaseFlow: purchaseForm.purchase_flow,
      evidenceType: purchaseForm.evidence_type,
      items: activeReceptionItems,
      currentState: recepcionChecklist,
      responsable: user.nombre_completo,
      rol: user.rol_nombre
    });

    const result = await guardarCompra({
      businessId: user.business_id,
      loteId: almacenSeleccion.compra,
      data: { ...purchaseForm, observaciones_compra: observacionesFinal, responsable_registro: user.nombre_completo, rol_registro: user.rol_nombre }
    });
    if (result.error) { setFeedback('', result.error); setIsSaving(false); return null; }
    await cargarAlmacen();
    const nextCompraId = result.data?.id_compra || result.data?.id_lote || null;
    if (nextCompraId) {
      setPurchaseSessionIds((current) => Array.from(new Set([nextCompraId, ...current])));
    }
    setAlmacenSeleccion((c) => ({ ...c, compra: keepOpenForNext ? null : nextCompraId }));
    setFeedback(keepOpenForNext ? 'Insumo agregado al detalle de compra.' : 'Compra guardada y stock actualizado.');
    setSelectedChecklistIds([]);
    setRecepcionChecklist({});
    setAutoSaveReceptionState('idle');
    lastAutoSavedReceptionRef.current = '';
    setPurchaseForm(keepOpenForNext ? getPurchaseItemResetForm(purchaseForm) : getDefaultPurchaseForm());
    setIsSaving(false);
    return result;
  }

  async function handleAgregarInsumoCompra() {
    await guardarCompraDesdeFormulario({ keepOpenForNext: true });
  }

  function handleEditar() {
    setFeedback();
    if (gestionActiva === 'inventario') { if (!selectedItem) { setFeedback('', 'Selecciona un insumo antes de editar.'); return; } loadItemIntoForm(selectedItem); return; }
    if (gestionActiva === 'proveedor') { if (!selectedProvider) { setFeedback('', 'Selecciona un proveedor antes de editar.'); return; } loadProviderIntoForm(selectedProvider); return; }
    if (!selectedPurchase) { setFeedback('', 'Selecciona una compra antes de editar.'); return; }
    loadPurchaseIntoForm(selectedPurchase);
  }

  async function handleGuardarAlmacen() {
    if (!user.business_id) { setFeedback('', 'Tu usuario no tiene negocio asignado para operar este módulo.'); return; }
    setIsSaving(true);
    setFeedback();

    if (gestionActiva === 'inventario') {
      const result = await guardarItemCatalogo({ businessId: user.business_id, itemId: almacenSeleccion.inventario, data: itemForm });
      if (result.error) { setFeedback('', result.error); setIsSaving(false); return; }
      await cargarAlmacen();
      setAlmacenSeleccion((c) => ({ ...c, inventario: result.data?.id_item || null }));
      setFeedback('Inventario guardado correctamente.');
      if (result.data) loadItemIntoForm(result.data);
      setIsSaving(false);
      return;
    }

    if (gestionActiva === 'proveedor') {
      const result = await guardarProveedor({ businessId: user.business_id, providerId: almacenSeleccion.proveedor, data: providerForm });
      if (result.error) { setFeedback('', result.error); setIsSaving(false); return; }
      await cargarAlmacen();
      setAlmacenSeleccion((c) => ({ ...c, proveedor: result.data?.id_proveedor || null }));
      setFeedback('Proveedor guardado correctamente.');
      if (result.data) loadProviderIntoForm(result.data);
      setIsSaving(false);
      return;
    }

    setIsSaving(false);
    await guardarCompraDesdeFormulario({ keepOpenForNext: false });
  }

  async function handleEliminarAlmacen() {
    setFeedback();
    if (gestionActiva === 'inventario') {
      if (!selectedItem) { setFeedback('', 'Selecciona un insumo para eliminar.'); return; }
      if (!window.confirm(`Se eliminará ${selectedItem.nombre_item}.`)) return;
      setIsSaving(true);
      const result = await eliminarItemCatalogo(selectedItem.id_item);
      setIsSaving(false);
      if (result.error) { setFeedback('', result.error); return; }
      await cargarAlmacen(); resetActiveForm('inventario'); setFeedback('Insumo eliminado correctamente.'); return;
    }
    if (gestionActiva === 'proveedor') {
      if (!selectedProvider) { setFeedback('', 'Selecciona un proveedor para eliminar.'); return; }
      if (!window.confirm(`Se eliminará ${selectedProvider.nombre_prov}.`)) return;
      setIsSaving(true);
      const result = await eliminarProveedor(selectedProvider.id_proveedor);
      setIsSaving(false);
      if (result.error) { setFeedback('', result.error); return; }
      await cargarAlmacen(); resetActiveForm('proveedor'); setFeedback('Proveedor eliminado correctamente.'); return;
    }
    if (!selectedPurchase) { setFeedback('', 'Selecciona una compra para eliminar.'); return; }
    if (!window.confirm(`Se eliminará el lote #${selectedPurchase.id_lote}.`)) return;
    setIsSaving(true);
    const result = await eliminarCompra(selectedPurchase.id_compra || selectedPurchase.id_lote);
    setIsSaving(false);
    if (result.error) { setFeedback('', result.error); return; }
    await cargarAlmacen(); resetActiveForm('compra'); setFeedback('Compra eliminada y stock ajustado.');
  }

  // --- Almacén render functions ---
  function renderAlmacenInventoryForm() {
    return (
      <div className="editor-form"><div className="form-grid-fields">
        <label><span>Nombre del insumo</span><input value={itemForm.nombre_item} onChange={(e) => setItemForm((c) => ({ ...c, nombre_item: e.target.value }))} placeholder="Ej. Café molido" /></label>
        <label><span>Categoría base</span><select value={itemForm.categoria} onChange={(e) => setItemForm((c) => ({ ...c, categoria: e.target.value }))}>{CATEGORIAS_CATALOGO.map((o) => (<option key={o.value} value={o.value}>{o.label}</option>))}</select></label>
        <label><span>Subcategoría</span><select value={itemForm.subcategoria} onChange={(e) => setItemForm((c) => ({ ...c, subcategoria: e.target.value }))}>{subcategoriasDisponibles.map((o) => (<option key={o} value={o}>{o}</option>))}</select></label>
        <label><span>Conservación</span><select value={itemForm.tipo_conservacion} onChange={(e) => setItemForm((c) => ({ ...c, tipo_conservacion: e.target.value }))}>{TIPOS_CONSERVACION.map((o) => (<option key={o} value={o}>{o}</option>))}</select></label>
        <label><span>Unidad de consumo</span><input value={itemForm.unidad_consumo} onChange={(e) => setItemForm((c) => ({ ...c, unidad_consumo: e.target.value }))} /></label>
        <label><span>Stock actual</span><input type="number" step="0.001" value={itemForm.stock_actual} onChange={(e) => setItemForm((c) => ({ ...c, stock_actual: e.target.value }))} /></label>
        <label><span>Fecha de análisis</span><input type="date" value={itemForm.fecha_analisis_mercado} onChange={(e) => setItemForm((c) => ({ ...c, fecha_analisis_mercado: e.target.value }))} /></label>
        <div className="purchase-total-card"><span>Control interno</span><strong>Stock protegido</strong><small>Máximo, mínimo y punto de reorden se calculan en código y no se muestran aquí.</small></div>
      </div></div>
    );
  }

  function renderAlmacenProviderForm() {
    return (
      <div className="editor-form"><div className="form-grid-fields">
        <label><span>Proveedor</span><input value={providerForm.nombre_prov} onChange={(e) => setProviderForm((c) => ({ ...c, nombre_prov: e.target.value }))} /></label>
        <label><span>Tipo de proveedor</span><select value={providerForm.tipo_proveedor} onChange={(e) => setProviderForm((c) => ({ ...c, tipo_proveedor: e.target.value }))}>{TIPOS_PROVEEDOR.map((o) => (<option key={o} value={o}>{o}</option>))}</select></label>
        <label><span>Teléfono</span><input value={providerForm.telefono_prov} onChange={(e) => setProviderForm((c) => ({ ...c, telefono_prov: e.target.value }))} /></label>
        <label><span>Correo</span><input type="email" value={providerForm.correo_prov} onChange={(e) => setProviderForm((c) => ({ ...c, correo_prov: e.target.value }))} /></label>
        <label className="field-span-2"><span>Dirección</span><textarea rows="3" value={providerForm.direccion_prov} onChange={(e) => setProviderForm((c) => ({ ...c, direccion_prov: e.target.value }))} /></label>
      </div></div>
    );
  }

  function renderAlmacenPurchaseForm() {
    const purchaseFlow = normalizePurchaseFlow(purchaseForm.purchase_flow);
    const evidenceType = normalizePurchaseEvidence(purchaseForm.evidence_type);
    const matchedCatalogItem = (almacenCompras?.catalogo || []).find((item) => String(item.id_item) === String(purchaseForm.id_item)) || null;
    const inferredItem = inferQuickItemFields(purchaseForm.item_query);
    const matchedProvider = findQuickProviderMatch(almacenCompras?.proveedores || [], purchaseForm.provider_query);
    const inferredProvider = inferQuickProviderFields(purchaseForm.provider_query);
    const matchedUnit = findPurchaseUnitMatch(purchaseForm.unit_query || purchaseForm.unidad_compra);
    const suggestedUnitValue = matchedCatalogItem?.unidad_consumo || inferredItem.unidad_consumo || 'kg';
    const activeUnit = purchaseForm.unidad_compra || matchedUnit?.value || suggestedUnitValue;
    const suggestedUnits = getSuggestedPurchaseUnits(purchaseForm.unit_query, activeUnit).slice(0, 8);
    const filteredEquivalences = getFilteredEquivalences(purchaseForm.unit_query, activeUnit);
    const evidenceReferenceLabel = evidenceType === 'manual' ? 'Descripción breve de la compra' : evidenceType === 'ticket' ? 'Número de ticket' : 'Folio o factura';
    const evidenceReferencePlaceholder = evidenceType === 'manual' ? 'Ej. Compra en cremería nueva, sin folio' : evidenceType === 'ticket' ? 'Ej. T-2048' : 'Ej. FAC-2026-018';
    return (
      <div className="editor-form"><div className="form-grid-fields">
        <label><span>Tipo de registro</span><select value={purchaseForm.purchase_flow} onChange={(e) => setPurchaseForm((c) => ({ ...c, purchase_flow: e.target.value }))}>{PURCHASE_FLOW_OPTIONS.map((o) => (<option key={o.value} value={o.value}>{o.label}</option>))}</select></label>
        <label><span>Soporte de compra</span><select value={purchaseForm.evidence_type} onChange={(e) => setPurchaseForm((c) => ({ ...c, evidence_type: e.target.value }))}>{PURCHASE_EVIDENCE_OPTIONS.map((o) => (<option key={o.value} value={o.value}>{o.label}</option>))}</select></label>
        <label><span>{evidenceReferenceLabel}</span><input value={purchaseForm.folio_externo} onChange={(e) => setPurchaseForm((c) => ({ ...c, folio_externo: e.target.value }))} placeholder={evidenceReferencePlaceholder} /></label>
        <div className="field-span-2 helper-note">{purchaseFlow === 'lista' ? 'Usa este modo para confirmar lo que sí se compró de la lista del día. Si el ingrediente todavía no existe pero aún no lo vas a comprar, dalo de alta primero en Inventario.' : 'Usa compra directa para mandado rápido, compra imprevista o ingrediente nuevo que se da de alta en el mismo registro.'}</div>
        <label><span>Compra rápida</span>
          <>
            <input value={purchaseForm.item_query} list="catering-purchase-catalog" onChange={(e) => { const nextQuery = e.target.value; const match = findCatalogMatch(almacenCompras?.catalogo || [], nextQuery); const nextItemDraft = inferQuickItemFields(nextQuery); setPurchaseForm((c) => ({ ...c, item_query: nextQuery, itemMode: match ? 'existing' : 'new', id_item: match ? String(match.id_item) : '', unidad_compra: match?.unidad_consumo || nextItemDraft.unidad_consumo, unit_query: getPurchaseUnitLabel(match?.unidad_consumo || nextItemDraft.unidad_consumo), item_nuevo: { ...c.item_nuevo, ...nextItemDraft, nombre_item: nextQuery } })); }} placeholder="Escribe crema, queso fresco, aguacate..." />
            <datalist id="catering-purchase-catalog">{(almacenCompras?.catalogo || []).map((item) => (<option key={item.id_item} value={getPurchaseCatalogLabel(item)} />))}</datalist>
          </>
        </label>
        <div className="field-span-2 helper-note">{matchedCatalogItem ? `Reconocido en catálogo: ${matchedCatalogItem.nombre_item} · ${matchedCatalogItem.subcategoria || matchedCatalogItem.categoria}.` : 'Si no existe en catálogo, el sistema lo toma como compra rápida y abajo solo completas los datos mínimos para darlo de alta.'}</div>
        {!matchedCatalogItem && purchaseForm.item_query && <div className="field-span-2 helper-note">{`Alta sugerida: ${inferredItem.subcategoria} · ${inferredItem.unidad_consumo} · ${inferredItem.tipo_conservacion}.`}</div>}
        <label><span>Unidad de compra</span>
          <>
            <input value={purchaseForm.unit_query || ''} list="catering-purchase-units" onChange={(e) => { const nextQuery = e.target.value; const match = findPurchaseUnitMatch(nextQuery); setPurchaseForm((c) => ({ ...c, unit_query: nextQuery, unidad_compra: match?.value || nextQuery.trim() || '' })); }} placeholder="Escribe kg, caja, bulto, costal, pieza..." />
            <datalist id="catering-purchase-units">{UNIDADES_COMPRA.map((unit) => (<option key={unit.value} value={unit.label} />))}</datalist>
          </>
        </label>
        <div className="field-span-2 helper-note">{matchedUnit ? `Unidad detectada: ${matchedUnit.label} · ${matchedUnit.grupo}.` : purchaseForm.unit_query ? `Se guardará como unidad personalizada: ${purchaseForm.unit_query}.` : `Unidad sugerida por el insumo: ${getPurchaseUnitLabel(suggestedUnitValue)}.`}</div>
        <div className="field-span-2 convertidor-live"><span className="convertidor-label">Sugerencias rápidas:</span><div className="convertidor-chips">{suggestedUnits.map((unit) => (<button key={unit.value} type="button" className="convertidor-chip" onClick={() => setPurchaseForm((c) => ({ ...c, unidad_compra: unit.value, unit_query: unit.label }))}>{unit.label}</button>))}</div></div>
        <label><span>Proveedor o lugar de compra</span>
          <>
            <input value={purchaseForm.provider_query} list="catering-provider-catalog" onChange={(e) => { const nextQuery = e.target.value; const match = findQuickProviderMatch(almacenCompras?.proveedores || [], nextQuery); const nextProviderDraft = inferQuickProviderFields(nextQuery); setPurchaseForm((c) => ({ ...c, provider_query: nextQuery, providerMode: match ? 'existing' : 'quick', id_proveedor: match ? String(match.id_proveedor) : '', proveedor_nuevo: { ...c.proveedor_nuevo, nombre_prov: nextQuery, tipo_proveedor: match?.tipo_proveedor || nextProviderDraft.tipo_proveedor } })); }} placeholder="Escribe mercado, abastos, Luna, proveedor..." />
            <datalist id="catering-provider-catalog">{(almacenCompras?.proveedores || []).map((item) => (<option key={item.id_proveedor} value={getQuickProviderDisplayLabel(item)} />))}</datalist>
          </>
        </label>
        <div className="field-span-2 helper-note">{matchedProvider ? `Proveedor reconocido: ${matchedProvider.nombre_prov}. Se usará el registro ya guardado.` : purchaseForm.provider_query ? 'No se encontró ese proveedor. Completa abajo sus datos para darlo de alta junto con esta compra.' : 'Escribe el proveedor o el lugar de compra. Si ya existe, el sistema lo reconocerá solo.'}</div>
        {!matchedProvider && purchaseForm.provider_query && <><label><span>Tipo de proveedor</span><select value={purchaseForm.proveedor_nuevo.tipo_proveedor || inferredProvider.tipo_proveedor} onChange={(e) => setPurchaseForm((c) => ({ ...c, proveedor_nuevo: { ...c.proveedor_nuevo, tipo_proveedor: e.target.value } }))}>{TIPOS_PROVEEDOR.map((option) => (<option key={option} value={option}>{option}</option>))}</select></label><label><span>Teléfono del proveedor</span><input value={purchaseForm.proveedor_nuevo.telefono_prov || ''} onChange={(e) => setPurchaseForm((c) => ({ ...c, proveedor_nuevo: { ...c.proveedor_nuevo, telefono_prov: e.target.value } }))} placeholder="Opcional" /></label><label><span>Correo del proveedor</span><input type="email" value={purchaseForm.proveedor_nuevo.correo_prov || ''} onChange={(e) => setPurchaseForm((c) => ({ ...c, proveedor_nuevo: { ...c.proveedor_nuevo, correo_prov: e.target.value } }))} placeholder="Opcional" /></label><label className="field-span-2"><span>Dirección o referencia del proveedor</span><textarea rows="2" value={purchaseForm.proveedor_nuevo.direccion_prov || ''} onChange={(e) => setPurchaseForm((c) => ({ ...c, proveedor_nuevo: { ...c.proveedor_nuevo, direccion_prov: e.target.value } }))} placeholder="Ej. Local 12, pasillo frío, colonia centro" /></label></>}
        {(() => {
          const unidadActual = activeUnit;
          const conversiones = convertirUnidades(purchaseForm.cantidad_recibida, unidadActual);
          return (<>
            <label><span>Cantidad recibida {unidadActual ? `(${unidadActual})` : ''}</span><input type="number" step="0.001" value={purchaseForm.cantidad_recibida} onChange={(e) => setPurchaseForm((c) => ({ ...c, cantidad_recibida: e.target.value }))} placeholder={unidadActual ? `Ej. 5 ${unidadActual}` : 'Ej. 5, 0.5, 12'} /></label>
            <label><span>Precio por {unidadActual || 'unidad'}</span><input type="number" step="0.01" value={purchaseForm.precio_unitario_compra} onChange={(e) => setPurchaseForm((c) => ({ ...c, precio_unitario_compra: e.target.value }))} placeholder={`$ por cada ${unidadActual || 'unidad'}`} /></label>
            {conversiones.length > 0 && purchaseForm.cantidad_recibida && (
              <div className="field-span-2 convertidor-live"><span className="convertidor-label">Equivale a:</span><div className="convertidor-chips">{conversiones.map((c, i) => (<span key={i} className="convertidor-chip">{c.valor} {c.unidad}</span>))}</div></div>
            )}
          </>);
        })()}
        <div className="purchase-total-card"><span>Total del lote</span><strong>{formatCurrency(compraTotalPreview)}</strong><small>Se agrega al detalle de compra en cuanto guardas este insumo.</small></div>
        <div className="purchase-total-card"><span>Fecha y hora de captura</span><strong>{formatDateTime(new Date())}</strong><small>Se guardan solas al registrar la compra.</small></div>
        <label className="field-span-2"><span>Notas de compra</span><textarea rows="3" value={purchaseForm.observaciones_compra} onChange={(e) => setPurchaseForm((c) => ({ ...c, observaciones_compra: e.target.value }))} placeholder="Ej. Compra para surtido de hoy, faltó una caja, mandado de última hora..." /></label>
        <div className="field-span-2 detail-inline-actions"><button type="button" className="module-action-button success" onClick={handleAgregarInsumoCompra} disabled={isSaving}>{isSaving ? 'Agregando...' : 'Agregar insumo'}</button><span className="recepcion-meta">Cada insumo se guarda por separado y se va sumando al desglose de detalle.</span></div>
        <div className="field-span-2 equivalencias-panel"><details><summary>Guía de unidades y equivalencias</summary><div className="equivalencias-grid">{filteredEquivalences.map((eq, idx) => (<div className="equivalencia-row" key={idx}><strong>{eq.de}</strong><span>= {eq.a}</span><small>{eq.nota}</small></div>))}</div><div className="equivalencias-tip">Si compras por costal o bulto, registra la cantidad en la unidad base (kg, lt, pieza). Ejemplo: 1 costal de frijol = pon 25 kg como cantidad y el precio por kg.</div></details></div>
      </div></div>
    );
  }

  function renderPurchaseSessionCards() {
    const cards = purchaseSessionItems.length ? purchaseSessionItems : (almacenCompras?.comprasHoy || []);
    if (!cards.length) {
      return <p className="panel-empty">Todavía no hay insumos agregados al detalle de compra.</p>;
    }

    return (
      <div className="purchase-session-grid">
        {cards.map((item) => (
          <button type="button" className={`purchase-session-card ${almacenSeleccion.compra === (item.id_compra || item.id_lote) ? 'selected' : ''}`} key={`${item.id_compra || item.id_lote}-${item.id_lote}`} onClick={() => handleSelectRegistro('compra', item)}>
            <div>
              <strong>{item.item_nombre}</strong>
              <span>{item.cantidad_recibida} {item.unidad_consumo} · {item.proveedor_nombre}</span>
              <small>{formatDateTime(item.fecha_entrada)}</small>
            </div>
            <em>{formatCurrency(item.total_lote)}</em>
          </button>
        ))}
      </div>
    );
  }

  function renderAlmacenEditorPanel() {
    if (gestionActiva === 'inventario') return renderAlmacenInventoryForm();
    if (gestionActiva === 'proveedor') return renderAlmacenProviderForm();
    return renderAlmacenPurchaseForm();
  }

  function renderAlmacenSelectionDetails() {
    if (gestionActiva === 'inventario') {
      return selectedItem ? (
        <div className="detail-card"><strong>{selectedItem.nombre_item}</strong><span>{selectedItem.categoria} · {selectedItem.subcategoria}</span><span>{selectedItem.tipo_conservacion}</span><span>Stock actual: {selectedItem.stock_actual}</span><div className="detail-inline-actions"><button type="button" className="module-action-button success" onClick={() => abrirCompraDesdeInsumo(selectedItem)}>Registrar compra de este insumo</button></div>{renderItemPurchaseHistory(selectedItem.id_item)}</div>
      ) : (<p className="panel-empty">Selecciona un insumo para ver sus detalles y editarlo.</p>);
    }
    if (gestionActiva === 'proveedor') {
      return selectedProvider ? (
        <div className="detail-card"><strong>{selectedProvider.nombre_prov}</strong><span>{selectedProvider.tipo_proveedor}</span><span>{selectedProvider.correo_prov || selectedProvider.telefono_prov || 'Sin contacto'}</span><span>{selectedProvider.direccion_prov || 'Sin dirección'}</span></div>
      ) : (<p className="panel-empty">Selecciona un proveedor para cargarlo o eliminarlo.</p>);
    }
    if (activeReceptionItems.length) {
      const totalItems = activeReceptionItems.length;
      const verificados = activeReceptionItems.filter((item) => recepcionChecklist[item.id]?.llego).length;
      const noLlegaron = activeReceptionItems.filter((item) => recepcionChecklist[item.id]?.noLlego).length;
      const revisados = verificados + noLlegaron;
      const porcentaje = totalItems > 0 ? Math.round((revisados / totalItems) * 100) : 0;
      const todosVerificados = revisados === totalItems && totalItems > 0;
      return (
        <div className="detail-card recepcion-card">
          {renderPurchaseSessionCards()}
          <div className="recepcion-titulo"><div><strong>Recepción de compra</strong><span className="recepcion-subtitulo">Verifica cada artículo conforme llega</span></div>
            {todosVerificados && noLlegaron === 0 && <span className="recepcion-listo">Todo recibido</span>}
            {todosVerificados && noLlegaron > 0 && <span className="recepcion-listo recepcion-listo-parcial">Revisión completa · {noLlegaron} no llegaron</span>}
            {autoSaveReceptionState !== 'idle' && <span className={`recepcion-autosave-pill ${autoSaveReceptionState}`}>{autoSaveReceptionState === 'saving' ? 'Guardando...' : autoSaveReceptionState === 'pending' ? 'Guardado automático en espera' : autoSaveReceptionState === 'saved' ? 'Guardado automático' : 'Error al guardar'}</span>}
          </div>
          <div className="recepcion-progreso"><div className="recepcion-barra"><div className="recepcion-barra-fill" style={{ width: `${porcentaje}%` }} /></div>
            <span className="recepcion-progreso-texto">{verificados}/{totalItems} recibidos{noLlegaron > 0 ? ` · ${noLlegaron} no llegaron` : ''} · {porcentaje}%</span>
          </div>
          <div className="detail-stack recepcion-lista">
            {activeReceptionItems.map((item) => {
              const recepcion = recepcionChecklist[item.id] || { llego: false, noLlego: false, cantidadRecibida: item.cantidad || '', condicion: 'buena', nota: '' };
              const catalogItem = item.itemId ? (almacenCompras?.catalogo || []).find((c) => Number(c.id_item) === item.itemId) : null;
              const unidad = catalogItem?.unidad_consumo || item.unidad || 'unidad';
              const convRecepcion = convertirUnidades(recepcion.cantidadRecibida, unidad);
              return (
                <div key={`recepcion-${item.id}`} className={`checklist-recepcion-item ${recepcion.llego ? 'verificado' : ''} ${recepcion.noLlego ? 'no-llego' : ''} ${recepcion.condicion !== 'buena' && !recepcion.noLlego ? 'con-observacion' : ''}`}>
                  <div className="recepcion-header"><div className="recepcion-check">
                    <div className="recepcion-toggle-btns">
                      <button type="button" className={`recepcion-btn-ok ${recepcion.llego ? 'activo' : ''}`} title="Sí llegó" onClick={() => { actualizarRecepcionItem(item.id, 'llego', !recepcion.llego); if (!recepcion.llego) actualizarRecepcionItem(item.id, 'noLlego', false); }}>✓</button>
                      <button type="button" className={`recepcion-btn-no ${recepcion.noLlego ? 'activo' : ''}`} title="No llegó / perdido" onClick={() => { actualizarRecepcionItem(item.id, 'noLlego', !recepcion.noLlego); if (!recepcion.noLlego) actualizarRecepcionItem(item.id, 'llego', false); }}>✗</button>
                    </div>
                    <div className="recepcion-item-info"><strong>{item.descripcion}</strong>
                      {catalogItem && <small>Stock: {toNumber(catalogItem.stock_actual)} {unidad} · Reorden: {toNumber(catalogItem.punto_reorden_interno || catalogItem.punto_reorden)}</small>}
                      {!catalogItem && <small>Producto nuevo · {unidad}</small>}
                    </div>
                  </div>
                  <span className={`recepcion-estado ${recepcion.llego ? 'estado-ok' : recepcion.noLlego ? 'estado-no-llego' : recepcion.condicion !== 'buena' ? 'estado-alerta' : 'estado-pendiente'}`}>
                    {recepcion.llego ? '✓ Llegó' : recepcion.noLlego ? '✗ No llegó' : recepcion.condicion !== 'buena' ? '⚠ ' + recepcion.condicion : '○ Pendiente'}
                  </span>
                  </div>
                  {(catalogItem?.ultimo_precio_compra || catalogItem?.precio_competencia_promedio) && (
                    <div className="recepcion-precio-ref">Último precio: {formatCurrency(catalogItem.ultimo_precio_compra || catalogItem.precio_competencia_promedio)} / {unidad}</div>
                  )}
                  <div className="recepcion-fields">
                    <label><span>Cantidad recibida ({unidad})</span><input type="number" step="0.001" value={recepcion.cantidadRecibida} onChange={(e) => actualizarRecepcionItem(item.id, 'cantidadRecibida', e.target.value)} placeholder={`Esperado: ${item.cantidad || '?'} ${unidad}`} /></label>
                    <label><span>Condición al llegar</span><select value={recepcion.condicion} onChange={(e) => actualizarRecepcionItem(item.id, 'condicion', e.target.value)}><option value="buena">✓ Buena</option><option value="regular">◐ Regular</option><option value="mala">✗ Mala / dañado</option><option value="incompleto">◑ Incompleto</option></select></label>
                  </div>
                  {convRecepcion.length > 0 && recepcion.cantidadRecibida && (
                    <div className="convertidor-live compact"><span className="convertidor-label">≈</span><div className="convertidor-chips">{convRecepcion.map((c, ci) => (<span key={ci} className="convertidor-chip">{c.valor} {c.unidad}</span>))}</div></div>
                  )}
                  <label className="recepcion-nota"><span>Nota de recepción</span><input value={recepcion.nota} onChange={(e) => actualizarRecepcionItem(item.id, 'nota', e.target.value)} placeholder="Ej. Llegó maduro, caja abierta, faltó 1 kg..." /></label>
                </div>
              );
            })}
          </div>
          {(() => {
            let totalRecibido = 0; let totalPerdido = 0; let itemsConPrecio = 0;
            activeReceptionItems.forEach((item) => {
              const recepcion = recepcionChecklist[item.id] || {};
              const catItem = item.itemId ? (almacenCompras?.catalogo || []).find((c) => Number(c.id_item) === item.itemId) : null;
              const precio = toNumber(catItem?.ultimo_precio_compra || catItem?.precio_competencia_promedio || 0);
              const cantRecibida = toNumber(recepcion.cantidadRecibida || 0);
              if (precio > 0) itemsConPrecio++;
              if (recepcion.llego && cantRecibida > 0) totalRecibido += cantRecibida * precio;
              if (recepcion.noLlego && cantRecibida > 0) totalPerdido += cantRecibida * precio;
              else if (recepcion.noLlego && item.cantidad) totalPerdido += toNumber(item.cantidad) * precio;
            });
            if (itemsConPrecio === 0) return null;
            return (<div className="recepcion-resumen-total">
              <div className="recepcion-resumen-row"><span>Total recibido</span><strong className="resumen-recibido">{formatCurrency(totalRecibido)}</strong></div>
              {totalPerdido > 0 && <div className="recepcion-resumen-row"><span>Pérdida estimada</span><strong className="resumen-perdido">{formatCurrency(totalPerdido)}</strong></div>}
              <div className="recepcion-resumen-row resumen-gran-total"><span>Total del lote</span><strong>{formatCurrency(totalRecibido + totalPerdido)}</strong></div>
            </div>);
          })()}
          {todosVerificados && <div className="recepcion-completa-msg">La recepción ya quedó registrada. En cuanto marcas llegada y condición, el detalle se guarda en automático.</div>}
        </div>
      );
    }
    if (selectedPurchase) {
      const purchaseMeta = parsePurchaseMetadata(selectedPurchase.observaciones_compra || '');
      return (
        <div className="detail-card"><div className="purchase-history-inline"><strong>Detalle de compra</strong><span>Los insumos guardados se muestran aquí como tarjetas y cada uno abre su revisión al llegar.</span></div>{renderPurchaseSessionCards()}<strong>Lote #{selectedPurchase.id_lote}</strong>
          <span>{selectedPurchase.item_nombre} · {selectedPurchase.item_subcategoria}</span>
          <span>{selectedPurchase.proveedor_nombre} · {selectedPurchase.proveedor_tipo}</span>
          <span>Registro: {getPurchaseFlowLabel(purchaseMeta.metadata.purchase_flow)} · {getPurchaseEvidenceLabel(purchaseMeta.metadata.evidence_type)}</span>
          <span>Folio: {selectedPurchase.folio_externo || 'Sin folio capturado'}</span>
          <span>Cantidad: {selectedPurchase.cantidad_recibida} {selectedPurchase.unidad_consumo} · Total: {formatCurrency(selectedPurchase.total_lote)}</span>
          <span>Capturado: {formatDateTime(selectedPurchase.fecha_entrada)}</span>
          {parseResponsable(selectedPurchase.observaciones_compra) && <span className="history-responsable-pill">Registró: {parseResponsable(selectedPurchase.observaciones_compra)} · {parseRol(selectedPurchase.observaciones_compra) || 'Sin rol'}</span>}
          {selectedPurchase.observaciones_compra && selectedPurchase.observaciones_compra.includes('[Recepción]') && (() => {
            const obs = selectedPurchase.observaciones_compra;
            const recepcionMatch = obs.match(/\[Recepción\]\s*(.+?)(?:\[Resumen\]|$)/);
            const resumenMatch = obs.match(/\[Resumen\]\s*(.+)/);
            const items = recepcionMatch ? recepcionMatch[1].split(' | ').filter(Boolean).map(l => l.trim()) : [];
            const recibidos = items.filter(i => i.startsWith('✓'));
            const perdidos = items.filter(i => i.startsWith('✗'));
            const pendientes = items.filter(i => i.startsWith('?'));
            const resumenTexto = resumenMatch ? resumenMatch[1] : null;
            const totalMatch = resumenTexto?.match(/Total lote:\s*\$?([\d,.]+)/);
            const recibidosMatch = resumenTexto?.match(/Recibidos:\s*(\d+)\s*\(\$?([\d,.]+)\)/);
            const perdidasMatch = resumenTexto?.match(/Pérdidas:\s*(\d+)\s*\(\$?([\d,.]+)\)/);
            return (<div className="recepcion-guardada"><div className="recepcion-guardada-titulo"><span>Recepción registrada</span><span className="recepcion-guardada-fecha">{formatDateTime(selectedPurchase.fecha_entrada)}</span></div>
              {items.length > 0 && <div className="recepcion-guardada-items">{recibidos.map((i, idx) => (<div key={`r-${idx}`} className="recepcion-guardada-linea ok">{i}</div>))}{perdidos.map((i, idx) => (<div key={`p-${idx}`} className="recepcion-guardada-linea perdido">{i}</div>))}{pendientes.map((i, idx) => (<div key={`pe-${idx}`} className="recepcion-guardada-linea pendiente">{i}</div>))}</div>}
              {resumenTexto && <div className="recepcion-resumen-total">
                {recibidosMatch && <div className="recepcion-resumen-row"><span>Recibidos ({recibidosMatch[1]})</span><strong className="resumen-recibido">{formatCurrency(Number(recibidosMatch[2]))}</strong></div>}
                {perdidasMatch && <div className="recepcion-resumen-row"><span>Pérdidas ({perdidasMatch[1]})</span><strong className="resumen-perdido">{formatCurrency(Number(perdidasMatch[2]))}</strong></div>}
                {totalMatch && <div className="recepcion-resumen-row resumen-gran-total"><span>Total del lote</span><strong>{formatCurrency(Number(totalMatch[1]))}</strong></div>}
              </div>}
            </div>);
          })()}
          {purchaseMeta.baseNote && !selectedPurchase.observaciones_compra.includes('[Recepción]') && <span className="recepcion-meta">{purchaseMeta.baseNote}</span>}
          {selectedPurchase.observaciones_compra && selectedPurchase.observaciones_compra.includes('[Recepción]') && (() => { const notaBase = purchaseMeta.baseNote; return notaBase ? <span className="recepcion-meta">{notaBase}</span> : null; })()}
          {renderItemPurchaseHistory(selectedPurchase.id_item, 'No hay más compras registradas para este insumo.')}
        </div>
      );
    }
    if (purchaseForm.id_item) {
      const catalogItem = (almacenCompras?.catalogo || []).find((c) => String(c.id_item) === String(purchaseForm.id_item));
      return catalogItem ? (
        <div className="detail-card"><strong>{catalogItem.nombre_item}</strong><span>{catalogItem.subcategoria || catalogItem.categoria} · {catalogItem.tipo_conservacion || 'Sin conservación'}</span><span>Stock actual: {toNumber(catalogItem.stock_actual)} {catalogItem.unidad_consumo}</span><span>Reorden: {toNumber(catalogItem.punto_reorden_interno || catalogItem.punto_reorden)}</span>{(catalogItem.ultimo_precio_compra || catalogItem.precio_competencia_promedio) && <span>Último precio: {formatCurrency(catalogItem.ultimo_precio_compra || catalogItem.precio_competencia_promedio)}</span>}<small>Llena cantidad y precio. Si marcas recepción sobre una compra ya registrada, se guarda sola.</small>{renderItemPurchaseHistory(catalogItem.id_item)}</div>
      ) : (<p className="panel-empty">Item seleccionado no encontrado en catálogo.</p>);
    }
    return <p className="panel-empty">Selecciona un insumo de la checklist o elige uno del catálogo arriba para ver sus detalles.</p>;
  }

  function renderAlmacenActiveList() {
    if (gestionActiva === 'inventario') {
      return (
        <div className="inventory-list compact-list">
          <div className="inventory-filters"><div className="filter-chip-row">
            {[{ value: 'todos', label: 'Todo' }, { value: 'ingredientes', label: 'Ingredientes' }, { value: 'complementos', label: 'Complementos' }, { value: 'equipos', label: 'Equipos' }].map((o) => (
              <button type="button" key={o.value} className={`filter-chip ${inventarioFiltro.grupo === o.value ? 'active' : ''}`} onClick={() => setInventarioFiltro({ grupo: o.value, subcategoria: 'todas' })}>{o.label}</button>
            ))}
          </div><div className="filter-chip-row">
            <button type="button" className={`filter-chip ${inventarioFiltro.subcategoria === 'todas' ? 'active' : ''}`} onClick={() => setInventarioFiltro((c) => ({ ...c, subcategoria: 'todas' }))}>Todas</button>
            {subcategoriasFiltro.map((o) => (<button type="button" key={o} className={`filter-chip ${inventarioFiltro.subcategoria === o ? 'active' : ''}`} onClick={() => setInventarioFiltro((c) => ({ ...c, subcategoria: o }))}>{o}</button>))}
          </div></div>
          {catalogoFiltrado.map((item) => (
            <button type="button" className={`inventory-item selectable-item ${almacenSeleccion.inventario === item.id_item ? 'selected' : ''}`} key={item.id_item} onClick={() => handleSelectRegistro('inventario', item)}>
              <div><strong>{item.nombre_item}</strong><span>{item.subcategoria} · {item.tipo_conservacion || 'Sin conservación'}</span></div>
              <div className="inventory-meta"><small>Stock: {item.stock_actual ?? 0}</small><span className={`stock-pill ${item.semaforo.className}`}>{item.semaforo.label}</span></div>
            </button>
          ))}
          {!catalogoFiltrado.length && <p className="panel-empty">No hay registros para ese filtro.</p>}
        </div>
      );
    }
    if (gestionActiva === 'proveedor') {
      return (
        <div className="mini-list compact-list">
          {(almacenCompras?.proveedores || []).map((item) => (
            <button type="button" className={`mini-item selectable-item ${almacenSeleccion.proveedor === item.id_proveedor ? 'selected' : ''}`} key={item.id_proveedor} onClick={() => handleSelectRegistro('proveedor', item)}>
              <strong>{item.nombre_prov}</strong><span>{item.tipo_proveedor}</span><span>{item.correo_prov || item.telefono_prov || 'Sin contacto'}</span>
            </button>
          ))}
        </div>
      );
    }
    return renderPurchaseSessionCards();
  }

  function renderAlmacenChecklistPanel() {
    if (gestionActiva === 'compra') {
      return null;
    }

    return (
      <div className="almacen-subpanel">
        <div className="almacen-subpanel-header"><h3>Checklist de compra</h3><span>{checklistPendientes.length} pendientes · {checklistUrgentes.length} urgentes</span></div>
        <div className="helper-note">Da clic en cualquier insumo para pre-llenar el formulario de compra con sus datos. Los que ya se compraron hoy aparecen tachados.</div>
        <div className="helper-note">La lista se actualiza sola cada pocos segundos y también cuando otro perfil guarda compras o pendientes en este mismo negocio.</div>
        <div className="checklist-role-strip">
          <div className="checklist-role-card"><strong>1. Registra compra</strong><span>Captura proveedor, folio y costo.</span></div>
          <div className="checklist-role-card"><strong>2. Recibe y revisa</strong><span>Confirma llegada, condición y checklist.</span></div>
          <div className="checklist-role-card"><strong>3. Ajusta inventario</strong><span>Revisa stock y deja lista la salida operativa.</span></div>
        </div>
        <div className="purchase-manual-checklist-form">
          <div className="field-row two-columns">
            <label>
              <span>Agregar al checklist</span>
              <input
                type="text"
                value={manualChecklistForm.descripcion}
                onChange={(event) => setManualChecklistForm((current) => ({ ...current, descripcion: event.target.value }))}
                placeholder="Ej. Hielo extra para evento, servilletas, gas"
              />
            </label>
            <label>
              <span>Nota o referencia</span>
              <input
                type="text"
                value={manualChecklistForm.nota}
                onChange={(event) => setManualChecklistForm((current) => ({ ...current, nota: event.target.value }))}
                placeholder="Ej. Lo pidió Fernanda para montaje"
              />
            </label>
          </div>
          <div className="field-row four-columns">
            <label>
              <span>Cantidad</span>
              <input
                type="number"
                min="0"
                step="0.001"
                value={manualChecklistForm.cantidad}
                onChange={(event) => setManualChecklistForm((current) => ({ ...current, cantidad: event.target.value }))}
                placeholder="Opcional"
              />
            </label>
            <label>
              <span>Unidad</span>
              <input
                type="text"
                value={manualChecklistForm.unidad}
                onChange={(event) => setManualChecklistForm((current) => ({ ...current, unidad: event.target.value }))}
                placeholder="unidad"
              />
            </label>
            <label>
              <span>Prioridad</span>
              <select
                value={manualChecklistForm.prioridad}
                onChange={(event) => setManualChecklistForm((current) => ({ ...current, prioridad: event.target.value }))}
              >
                <option value="alta">Alta</option>
                <option value="media">Media</option>
                <option value="baja">Baja</option>
              </select>
            </label>
            <div className="field-action">
              <button type="button" className="module-action-button primary" onClick={handleAgregarChecklistManual} disabled={isSavingChecklistItem}>
                {isSavingChecklistItem ? 'Agregando...' : 'Añadir pendiente'}
              </button>
            </div>
          </div>
        </div>
        <div className="quick-list checklist-summary-grid">
          <div className="quick-item static-card"><div><strong>Pendientes por comprar</strong><span>Catering · lista activa del negocio</span></div><em>{checklistPendientes.length}</em></div>
          <div className="quick-item"><div><strong>Urgentes</strong><span>Acumulados por alertas del stock</span></div><em>{checklistUrgentes.length}</em></div>
          <div className="quick-item"><div><strong>Comprado hoy</strong><span>Capturas del día que ya llegaron al sistema</span></div><em>{checklistCompletados.length}</em></div>
        </div>
        <div className="checklist-action-list">
          {shoppingChecklist.length ? shoppingChecklist.map((item) => {
            const linkedPurchase = getChecklistLinkedPurchase(item);
            const isSelected = selectedChecklistIds.includes(item.id) || (linkedPurchase && almacenSeleccion.compra === (linkedPurchase.id_compra || linkedPurchase.id_lote));
            return (
              <div className={`checklist-list-row checklist-item ${item.prioridad || 'media'} ${item.checked ? 'checked' : ''} ${isSelected ? 'selected' : ''}`} key={item.id}>
                <button type="button" className="checklist-row-main" onClick={() => handleChecklistCaptura(item)}>
                  <div className="checklist-copy">
                    <strong>{item.descripcion}</strong>
                    <span>{(item.cantidad || item.cantidad === 0) && item.cantidad !== null ? `${item.cantidad} ${item.unidad}` : item.unidad}{item.checked ? ' · compra registrada' : item.stockActual !== null && item.stockActual !== undefined ? ` · Stock ${item.stockActual ?? '?'} / Reorden ${item.reorden ?? '?'}` : ' · Pendiente manual'}</span>
                    <span>{item.checked ? `${item.nota || 'Compra registrada'}${item.createdBy ? ` · ${item.createdBy}` : ''}` : item.nota || item.createdBy || 'Sin referencia de proveedor'}</span>
                  </div>
                </button>
                <div className="checklist-inline-actions">
                  <button type="button" className="checklist-action-btn primary" onClick={() => handleChecklistCaptura(item)}>Capturar</button>
                  <button type="button" className="checklist-action-btn" onClick={() => handleChecklistRecepcion(item)}>{linkedPurchase || item.checked ? 'Recibir' : 'Checklist'}</button>
                  <button type="button" className="checklist-action-btn ghost" onClick={() => handleChecklistInventario(item)}>Inventario</button>
                </div>
              </div>
            );
          }) : <p className="panel-empty">No hay pendientes ni compras del día para revisar en este momento.</p>}
        </div>
      </div>
    );
  }

  function renderAlmacenComprasContent() {
    if (almacenError) return <p className="panel-empty">No se pudo leer almacén y compras: {almacenError}</p>;
    if (!almacenCompras) return <p className="panel-empty">Cargando datos de almacén y compras...</p>;
    return (
      <div className="almacen-layout">
        <div className="module-actions">
          <button type="button" className="module-action-button primary" onClick={() => resetActiveForm()}>Agregar</button>
          <button type="button" className="module-action-button" onClick={handleEditar}>Editar</button>
          <button type="button" className="module-action-button success" onClick={handleGuardarAlmacen} disabled={isSaving}>{isSaving ? 'Guardando...' : 'Guardar'}</button>
          <button type="button" className="module-action-button danger" onClick={handleEliminarAlmacen}>Eliminar</button>
        </div>
        <div className="manager-tabs">
          <button type="button" className={`manager-tab ${gestionActiva === 'inventario' ? 'active' : ''}`} onClick={() => setGestionActiva('inventario')}>Inventario</button>
          <button type="button" className={`manager-tab ${gestionActiva === 'proveedor' ? 'active' : ''}`} onClick={() => setGestionActiva('proveedor')}>Proveedores</button>
          <button type="button" className={`manager-tab ${gestionActiva === 'compra' ? 'active' : ''}`} onClick={() => setGestionActiva('compra')}>Compras</button>
        </div>
        {(operationMessage || operationError) && <div className={`operation-banner ${operationError ? 'error' : 'success'}`}>{operationError || operationMessage}</div>}
        <div className="almacen-work-grid">
          <div className="almacen-subpanel"><div className="almacen-subpanel-header"><h3>{gestionActiva === 'inventario' ? 'Ficha de inventario' : gestionActiva === 'proveedor' ? 'Ficha de proveedor' : 'Registro de compra'}</h3><span>{gestionActiva === 'inventario' ? 'Clasifica por subtipo y conservación' : gestionActiva === 'proveedor' ? 'Alta o edición del proveedor' : 'Lista activa, compra directa y captura rápida del lugar de compra'}</span></div>{renderAlmacenEditorPanel()}</div>
          <div className="almacen-subpanel"><div className="almacen-subpanel-header"><h3>Detalle seleccionado</h3><span>{gestionActiva}</span></div>{renderAlmacenSelectionDetails()}</div>
        </div>
        <div className="almacen-subpanel"><div className="almacen-subpanel-header"><h3>{gestionActiva === 'inventario' ? 'Inventario clasificado' : gestionActiva === 'proveedor' ? 'Lista de proveedores' : 'Checklist de compra y compras del día'}</h3><span>{gestionActiva === 'inventario' ? `${almacenCompras.resumen.totalItems} registros` : gestionActiva === 'proveedor' ? `${almacenCompras.resumen.proveedores} proveedores` : `${checklistPendientes.length} pendientes · ${almacenCompras.resumen.comprasHoy} compras hoy`}</span></div>{renderAlmacenActiveList()}</div>
        {renderAlmacenChecklistPanel()}
      </div>
    );
  }

  function renderAlmacenSummary() {
    if (!almacenCompras) return <p className="panel-empty">Cargando resumen de almacén...</p>;
    return (
      <div className="quick-list">
        <div className="quick-item static-card"><div><strong>Checklist pendiente</strong><span>{checklistUrgentes.length} urgentes dentro de la lista activa</span></div><em>{checklistPendientes.length}</em></div>
        <button type="button" className="quick-item static-card quick-clickable" onClick={() => abrirCompras()}><div><strong>Total comprado hoy</strong><span>{almacenCompras.resumen.comprasHoy} movimientos registrados hoy</span></div><em>{formatCurrency(almacenCompras.resumen.totalCompraHoy)}</em></button>
        {subcategoriaResumen.map(([subcategoria, total]) => (<div className="quick-item" key={subcategoria}><div><strong>{subcategoria}</strong><span>Clasificación para inventario y lotes</span></div><em>{total}</em></div>))}
        {proveedoresPorTipo.map(([tipo, total]) => (<div className="quick-item" key={tipo}><div><strong>{tipo}</strong><span>Proveedores listos para integrar compra</span></div><em>{total}</em></div>))}
        {(almacenCompras.comprasHoy || []).slice(0, 4).map((lote) => (<button type="button" className="quick-item quick-clickable" key={lote.id_lote} onClick={() => abrirCompras(lote)}><div><strong>{lote.item_nombre}</strong><span>{lote.proveedor_nombre} · {lote.cantidad_recibida} {lote.unidad_consumo}</span>{parseResponsable(lote.observaciones_compra) && <span className="history-responsable-pill">{parseResponsable(lote.observaciones_compra)}</span>}</div><em>{formatCurrency(lote.total_lote)}</em></button>))}
        {checklistPendientes.slice(0, 5).map((item) => (<div className="quick-item" key={`summary-check-${item.id}`}><div><strong>{item.descripcion}</strong><span>{item.nota || `${item.prioridad} · ${item.origen}`}</span><span>{item.createdBy || 'Sin responsable'}</span></div><em>{item.cantidad ? `${item.cantidad} ${item.unidad}` : item.unidad}</em></div>))}
      </div>
    );
  }
  // --- End almacén ---

  const catalogos = data?.catalogos || {
    recetas: [],
    equiposPropios: [],
    proveedoresRenta: [],
    proveedoresOperacion: [],
    itemsOperacion: []
  };

  const selectedCotizacion = (data?.cotizaciones || []).find((item) => item.id_cotizacion === seleccion.cotizacion) || null;
  const selectedEvento = (() => {
    const evento = (data?.eventos || []).find((item) => item.id_evento === seleccion.evento);
    if (!evento) return null;
    // Buscar la cotización relacionada para agregar datos de cliente
    const cotizacionRelacionada = (data?.cotizaciones || []).find((c) => c.id_cotizacion === evento.id_cotizacion);
    return {
      ...evento,
      telefono_cliente: cotizacionRelacionada?.telefono_cliente || '',
      correo_cliente: cotizacionRelacionada?.correo_cliente || ''
    };
  })();
  const selectedOperacion = (data?.salidas || []).find((item) => item.id_control_cat === seleccion.operacion) || null;
  const allEquipmentAndProviders = [...(catalogos.equiposPropios || []), ...(catalogos.proveedoresRenta || []), ...(catalogos.proveedoresOperacion || [])];
  const cotizacionEstimate = buildEstimate(cotizacionForm, catalogos.recetas, allEquipmentAndProviders, allEquipmentAndProviders);
  const eventoEstimate = buildEstimate(eventoForm, catalogos.recetas, allEquipmentAndProviders, allEquipmentAndProviders);
  const eventoOperacion = (() => {
    const evento = (data?.eventos || []).find((item) => String(item.id_evento) === String(operacionForm.id_evento));
    if (!evento) return null;
    // Buscar la cotización relacionada para agregar datos completos del cliente y ubicación
    const cotizacionRelacionada = (data?.cotizaciones || []).find((c) => c.id_cotizacion === evento.id_cotizacion);
    return {
      ...evento,
      telefono_cliente: cotizacionRelacionada?.telefono_cliente || '',
      correo_cliente: cotizacionRelacionada?.correo_cliente || '',
      lugar_evento: evento.lugar_evento || cotizacionRelacionada?.lugar_evento || '',
      direccion_evento: evento.direccion_evento || cotizacionRelacionada?.direccion_evento || '',
      referencia_evento: evento.referencia_evento || cotizacionRelacionada?.referencia_evento || '',
      momento_liquidacion: evento.momento_liquidacion || cotizacionRelacionada?.momento_liquidacion || ''
    };
  })();
  const historialFiltrado = filtrarHistorialPorPeriodo(data?.historial, historialFiltro);

  const moduleCards = getModuleCards(user);

  const cards = isNuevoUsuarioSection
    ? [
        { title: 'Usuarios catering', value: usuarios.length, detail: 'Personal visible para catering' },
        { title: 'Alta disponible', value: 'Dueño o trabajador', detail: 'Mismo flujo para nuevos accesos' },
        { title: 'Ámbito', value: 'Catering', detail: 'Sin mezclar restaurante' },
        ...moduleCards
      ]
    : isConfiguracionSection
      ? [
          { title: 'Negocio activo', value: businessConfigForm.nombre_negocio || user.business_name || 'Sin nombre', detail: 'Configuración visible solo para catering' },
          { title: 'Tipo de negocio', value: 'Catering', detail: 'Ámbito separado de restaurante' },
          { title: 'Foto local', value: businessConfigForm.logo_preview ? 'Cargada' : 'Pendiente', detail: 'La imagen se guarda en este equipo' },
          ...moduleCards
        ]
      : isAlmacenComprasSection
        ? almacenCompras
          ? [
              { title: 'Inventario', value: almacenCompras.resumen.totalItems, detail: `${almacenCompras.resumen.ingredientes} ingredientes · ${almacenCompras.resumen.complementos} complementos · ${almacenCompras.resumen.equipos} equipos` },
              { title: 'Proveedores', value: almacenCompras.resumen.proveedores, detail: 'Activos para catering' },
              { title: 'Compras hoy', value: almacenCompras.resumen.comprasHoy, detail: formatCurrency(almacenCompras.resumen.totalCompraHoy) },
              { title: 'Checklist', value: checklistPendientes.length, detail: `${checklistUrgentes.length} urgentes` }
            ]
          : [
              { title: 'Inventario', value: '...', detail: 'Cargando' },
              { title: 'Proveedores', value: '...', detail: 'Cargando' },
              { title: 'Compras hoy', value: '...', detail: 'Cargando' },
              { title: 'Checklist', value: '...', detail: 'Cargando' }
            ]
        : (isCotizacionesSection || isEventosSection || isOperacionSection)
          ? []  // No summary cards in main area for catering workflow sections
          : data && data.resumen
            ? [
                { title: 'Cotizaciones', value: data.resumen.cotizados || 0, detail: 'Propuestas pendientes de respuesta' },
                { title: 'Confirmados', value: data.resumen.confirmados || 0, detail: 'Eventos ya confirmados' },
                { title: 'Operando', value: data.resumen.eventosOperando || 0, detail: 'En ejecución ahora' },
                { title: 'Por pagar', value: data.resumen.porPagar || 0, detail: 'Saldo pendiente' }
              ]
            : [
                { title: 'Cotizaciones', value: '...', detail: 'Cargando' },
                { title: 'Confirmados', value: '...', detail: 'Cargando' },
                { title: 'Operando', value: '...', detail: 'Cargando' },
                { title: 'Por pagar', value: '...', detail: 'Cargando' }
              ];

  function setModuleFeedback(message = '', errorMessage = '') {
    setModuleMessage(message);
    setModuleError(errorMessage);
  }

  function setBusinessConfigFeedback(message = '', errorMessage = '') {
    setBusinessConfigMessage(message);
    setBusinessConfigError(errorMessage);
  }

  async function handleGuardarUsuarioCatering() {
    setUserMessage('');
    setUserFormError('');
    setIsSavingUser(true);

    const result = await crearUsuarioCatering(userForm);
    if (result.error) {
      setUserFormError(result.error);
      setIsSavingUser(false);
      return;
    }

    await recargarUsuariosCatering();
    setUserForm(getDefaultCateringUserForm());
    setUserMessage('Usuario catering guardado correctamente.');
    setIsSavingUser(false);
  }

  async function handleEliminarUsuarioCatering(item) {
    if (!item?.id_usuario) {
      setUserFormError('Selecciona un usuario válido para eliminar.');
      return;
    }

    if (!window.confirm(`Se eliminará el usuario ${item.nombre_completo}.`)) {
      return;
    }

    setUserMessage('');
    setUserFormError('');
    const result = await eliminarUsuarioNegocio({ userId: item.id_usuario, currentUserId: user?.id_usuario });
    if (result.error) {
      setUserFormError(result.error);
      return;
    }

    await recargarUsuariosCatering();
    setUserMessage('Usuario catering eliminado correctamente.');
  }

  function handleBusinessPhotoChange(event) {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    if (!file.type.startsWith('image/')) {
      setBusinessConfigFeedback('', 'Solo puedes subir imágenes para el negocio.');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const imageValue = String(reader.result || '');
      setBusinessConfigForm((current) => ({ ...current, logo_preview: imageValue }));
      window.localStorage.setItem(getBusinessLogoStorageKey('catering', user.business_id), imageValue);
      setBusinessConfigFeedback('Foto de catering guardada en este equipo.');
    };
    reader.onerror = () => {
      setBusinessConfigFeedback('', 'No se pudo leer la imagen seleccionada.');
    };
    reader.readAsDataURL(file);
  }

  function limpiarBusinessPhoto() {
    setBusinessConfigForm((current) => ({ ...current, logo_preview: '' }));
    window.localStorage.removeItem(getBusinessLogoStorageKey('catering', user.business_id));
    setBusinessConfigFeedback('Foto de catering eliminada de este equipo.');
  }

  async function handleGuardarConfiguracionCatering() {
    if (!user.business_id) {
      setBusinessConfigFeedback('', 'Tu usuario no tiene negocio asignado para configurar.');
      return;
    }

    setIsSavingBusinessConfig(true);
    setBusinessConfigFeedback();

    const result = await actualizarConfiguracionNegocio({
      businessId: user.business_id,
      nombre_negocio: businessConfigForm.nombre_negocio
    });

    if (result.error) {
      setBusinessConfigFeedback('', result.error);
      setIsSavingBusinessConfig(false);
      return;
    }

    setBusinessConfigForm((current) => ({
      ...current,
      nombre_negocio: result.data?.nombre_negocio || current.nombre_negocio,
      tipo_negocio: result.data?.tipo_negocio || current.tipo_negocio
    }));
    setBusinessConfigFeedback('Configuración de catering actualizada.');
    setIsSavingBusinessConfig(false);
  }

  function resetCotizacionForm() {
    setCotizacionForm(getDefaultCotizacionForm());
    setSeleccion((current) => ({ ...current, cotizacion: null }));
    setModuleFeedback();
  }

  function resetEventoForm() {
    setEventoForm(getDefaultEventoForm());
    setSeleccion((current) => ({ ...current, evento: null }));
    setModuleFeedback();
  }

  function resetOperacionForm() {
    setOperacionForm(getDefaultOperacionForm());
    setSeleccion((current) => ({ ...current, operacion: null }));
    setModuleFeedback();
  }

  function loadCotizacionIntoForm(item) {
    setCotizacionForm({
      nombre_evento: cleanEventName(item.nombre_evento) || '',
      fecha_evento: item.fecha_evento || new Date().toISOString().slice(0, 10),
      numero_personas: item.numero_personas || '',
      nombre_cliente: item.nombre_cliente || '',
      telefono_cliente: item.telefono_cliente || '',
      correo_cliente: item.correo_cliente || '',
      solicitado_por: item.solicitado_por || '',
      lugar_evento: item.lugar_evento || '',
      direccion_evento: item.direccion_evento || '',
      referencia_evento: item.referencia_evento || '',
      estatus_evento: item.estatus_evento || 'cotizando',
      anticipo_pagado: item.anticipo_pagado || '',
      saldo_pendiente: item.saldo_pendiente || '',
      fecha_anticipo: item.fecha_anticipo || '',
      fecha_pago_estimada: item.fecha_pago_estimada || '',
      momento_liquidacion: item.momento_liquidacion || '',
      notas_evento: item.notas_evento || '',
      receta_ids: item.receta_ids || [],
      proveedor_ids: item.proveedor_ids || [],
      equipo_ids: item.equipo_ids || [],
      cotizacion_id: item.id_cotizacion
    });
  }

  function loadEventoIntoForm(item) {
    // Buscar la cotización relacionada para campos adicionales
    const cotizacionRelacionada = (data?.cotizaciones || []).find((c) => String(c.id_cotizacion) === String(item.id_cotizacion));
    
    // Usar recetas de evento si existen, sino usar de cotización
    const recetasParaCargar = item.receta_ids && item.receta_ids.length > 0 
      ? item.receta_ids 
      : (cotizacionRelacionada?.receta_ids || []);
    
    // Usar proveedores de evento si existen, sino usar de cotización
    const proveedoresParaCargar = item.proveedor_ids && item.proveedor_ids.length > 0 
      ? item.proveedor_ids 
      : (cotizacionRelacionada?.proveedor_ids || []);
    
    // Usar equipos de evento si existen, sino usar de cotización
    const equiposParaCargar = item.equipo_ids && item.equipo_ids.length > 0 
      ? item.equipo_ids 
      : (cotizacionRelacionada?.equipo_ids || []);

    setEventoForm({
      nombre_evento: cleanEventName(item.nombre_evento) || '',
      fecha_evento: item.fecha_evento || new Date().toISOString().slice(0, 10),
      numero_personas: item.numero_personas || '',
      nombre_cliente: item.nombre_cliente || '',
      telefono_cliente: item.telefono_cliente || '',
      correo_cliente: item.correo_cliente || '',
      solicitado_por: cotizacionRelacionada?.solicitado_por || item.solicitado_por || '',
      lugar_evento: cotizacionRelacionada?.lugar_evento || item.lugar_evento || '',
      direccion_evento: cotizacionRelacionada?.direccion_evento || item.direccion_evento || '',
      referencia_evento: cotizacionRelacionada?.referencia_evento || item.referencia_evento || '',
      estatus_evento: item.estatus || 'confirmado',
      anticipo_pagado: item.anticipo_pagado || '',
      saldo_pendiente: item.saldo_pendiente || '',
      fecha_anticipo: cotizacionRelacionada?.fecha_anticipo || item.fecha_anticipo || '',
      fecha_pago_estimada: cotizacionRelacionada?.fecha_pago_estimada || item.fecha_pago_estimada || '',
      momento_liquidacion: cotizacionRelacionada?.momento_liquidacion || item.momento_liquidacion || '',
      notas_evento: cotizacionRelacionada?.notas_evento || item.notas_evento || '',
      total_estimado: item.total_estimado || 0,
      receta_ids: recetasParaCargar,
      proveedor_ids: proveedoresParaCargar,
      equipo_ids: equiposParaCargar,
      cotizacion_id: item.id_cotizacion || null
    });
  }

  function loadOperacionIntoForm(item) {
    // Obtener datos del cliente desde el evento correspondiente
    const eventoCorrespondiente = (data?.eventos || []).find((e) => String(e.id_evento) === String(item.id_evento));
    
    setOperacionForm({
      id_evento: item.id_evento ? String(item.id_evento) : '',
      ticket_codigo: item.ticket_codigo || '',
      responsable_ticket: item.responsable_ticket || '',
      solicitado_por: item.solicitado_por || '',
      nombre_cliente: eventoCorrespondiente?.nombre_cliente || '',
      correo_cliente: eventoCorrespondiente?.correo_cliente || '',
      telefono_cliente: eventoCorrespondiente?.telefono_cliente || '',
      estatus_ticket: item.estatus_ticket || 'pendiente',
      tipo_ticket: item.tipo_ticket || 'pago_efectivo',
      monto_ticket: item.monto_ticket || '',
      fecha_compromiso: item.fecha_compromiso || '',
      canal_contacto: item.canal_contacto || 'whatsapp',
      metodo_pago: item.metodo_pago || 'efectivo',
      datos_tarjeta: item.datos_tarjeta || '',
      observaciones: item.observaciones || '',
      actualizar_estatus_evento: 'operando'
    });
  }

  function handleSelectCotizacion(item) {
    setSeleccion((current) => ({ ...current, cotizacion: item.id_cotizacion, evento: item.id_evento }));
    loadCotizacionIntoForm(item);
    setModuleFeedback();
  }

  function handleSelectEvento(item) {
    setSeleccion((current) => ({ ...current, evento: item.id_evento, cotizacion: item.cotizacion_principal_id || current.cotizacion }));
    loadEventoIntoForm(item);
    setModuleFeedback();
    
    // Auto-save evento con datos de cotización
    setTimeout(() => autoSaveEvento(item), 400);
  }

  async function autoSaveEvento(item) {
    const cotizacionRelacionada = (data?.cotizaciones || []).find((c) => String(c.id_cotizacion) === String(item.id_cotizacion));
    
    if (!cotizacionRelacionada) return; // Solo guardar si hay cotización relacionada
    
    const recetasParaCargar = item.receta_ids && item.receta_ids.length > 0 
      ? item.receta_ids 
      : (cotizacionRelacionada?.receta_ids || []);
    
    const proveedoresParaCargar = item.proveedor_ids && item.proveedor_ids.length > 0 
      ? item.proveedor_ids 
      : (cotizacionRelacionada?.proveedor_ids || []);
    
    const equiposParaCargar = item.equipo_ids && item.equipo_ids.length > 0 
      ? item.equipo_ids 
      : (cotizacionRelacionada?.equipo_ids || []);

    const dataToSave = {
      nombre_evento: cleanEventName(item.nombre_evento) || '',
      fecha_evento: item.fecha_evento || new Date().toISOString().slice(0, 10),
      numero_personas: item.numero_personas || '',
      nombre_cliente: item.nombre_cliente || '',
      telefono_cliente: item.telefono_cliente || '',
      correo_cliente: item.correo_cliente || '',
      solicitado_por: cotizacionRelacionada?.solicitado_por || item.solicitado_por || '',
      lugar_evento: cotizacionRelacionada?.lugar_evento || item.lugar_evento || '',
      direccion_evento: cotizacionRelacionada?.direccion_evento || item.direccion_evento || '',
      referencia_evento: cotizacionRelacionada?.referencia_evento || item.referencia_evento || '',
      estatus_evento: item.estatus || 'confirmado',
      anticipo_pagado: item.anticipo_pagado || '',
      saldo_pendiente: item.saldo_pendiente || '',
      fecha_anticipo: cotizacionRelacionada?.fecha_anticipo || item.fecha_anticipo || '',
      fecha_pago_estimada: cotizacionRelacionada?.fecha_pago_estimada || item.fecha_pago_estimada || '',
      momento_liquidacion: cotizacionRelacionada?.momento_liquidacion || item.momento_liquidacion || '',
      notas_evento: cotizacionRelacionada?.notas_evento || item.notas_evento || '',
      total_estimado: item.total_estimado || 0,
      receta_ids: recetasParaCargar,
      proveedor_ids: proveedoresParaCargar,
      equipo_ids: equiposParaCargar
    };

    try {
      const result = await guardarBundleEventoCotizacion({
        businessId: user.business_id,
        eventId: item.id_evento,
        quoteId: item.id_cotizacion,
        data: dataToSave
      });
      
      if (result.error) {
        console.error('Save error:', result.error);
      }
    } catch (err) {
      console.error('Auto-save evento failed:', err);
    }
  }

  function handleSelectOperacion(item) {
    setSeleccion((current) => ({ ...current, operacion: item.id_control_cat, evento: item.id_evento }));
    loadOperacionIntoForm(item);
    setModuleFeedback();
  }

  async function handleGuardarCotizacion() {
    if (!user.business_id) {
      setModuleFeedback('', 'Tu usuario no tiene negocio asignado para operar catering.');
      return;
    }

    setIsSavingModule(true);
    setModuleFeedback();

    // Incluir el total estimado calculado
    const dataWithTotal = {
      ...cotizacionForm,
      total_estimado: cotizacionEstimate.totalEvent || cotizacionForm.total_estimado
    };

    // DECISIÓN AUTOMÁTICA: Si estatus es "confirmado" o superior, usar guardarEventoCatering
    // Si es "cotizando", usar guardarCotizacionCatering
    const estatusActual = cotizacionForm.estatus_evento || 'cotizando';
    const esEvento = estatusActual !== 'cotizando';

    // FIX: Cuando se convierte a evento, asegurar que tiene datos críticos
    const dataForEvent = {
      ...dataWithTotal,
      nombre_evento: dataWithTotal.nombre_evento || dataWithTotal.nombre_cliente || 'Evento sin nombre',
      fecha_evento: dataWithTotal.fecha_evento || new Date().toISOString().slice(0, 10),
      solicitado_por: dataWithTotal.solicitado_por || 'Sin registrar'
    };

    const result = esEvento
      ? await guardarEventoCatering({
          businessId: user.business_id,
          eventId: selectedCotizacion?.id_evento || seleccion.evento,
          data: { ...dataForEvent, cotizacion_id: seleccion.cotizacion || selectedCotizacion?.id_cotizacion }
        })
      : await guardarCotizacionCatering({
          businessId: user.business_id,
          cotizacionId: seleccion.cotizacion,
          eventId: selectedCotizacion?.id_evento || seleccion.evento,
          data: dataWithTotal
        });

    if (result.error) {
      setModuleFeedback('', result.error);
      setIsSavingModule(false);
      return;
    }

    const refreshedData = await recargarOperacion();
    const newEventoId = result.data?.id_evento;
    
    setSeleccion((current) => ({
      ...current,
      cotizacion: result.data?.id_cotizacion || current.cotizacion,
      evento: newEventoId || current.evento
    }));
    
    // Auto-load the newly created evento with persisted selections
    if (refreshedData && newEventoId) {
      const newEvento = (refreshedData.eventos || []).find((evt) => evt.id_evento === newEventoId);
      if (newEvento) {
        loadEventoIntoForm(newEvento);
      }
    }
    
    const mensajeExito = esEvento 
      ? `✅ Evento confirmado. El estatus cambió de "cotizando" a "${estatusActual}".` 
      : 'Cotización guardada correctamente.';
    setModuleFeedback(mensajeExito);
    setIsSavingModule(false);
  }

  async function handleEliminarCotizacionActual() {
    if (!selectedCotizacion) {
      setModuleFeedback('', 'Selecciona una cotización para eliminar.');
      return;
    }

    if (!window.confirm(`Se eliminará la cotización de ${selectedCotizacion.nombre_cliente}.`)) {
      return;
    }

    setIsSavingModule(true);
    const result = await eliminarCotizacionCatering({
      cotizacionId: selectedCotizacion.id_cotizacion,
      eventId: selectedCotizacion.id_evento
    });
    setIsSavingModule(false);

    if (result.error) {
      setModuleFeedback('', result.error);
      return;
    }

    await recargarOperacion();
    resetCotizacionForm();
    setModuleFeedback('Cotización eliminada correctamente.');
  }

  async function handleGuardarEventoActualConDatos(dataToSave) {
    // Usar seleccion.evento en lugar de selectedEvento que puede estar desactualizado
    if (!seleccion.evento) {
      console.log('No hay evento seleccionado');
      return;
    }

    setIsSavingModule(true);

    // Incluir el total estimado calculado
    const fullData = {
      ...dataToSave,
      total_estimado: eventoEstimate.totalEvent || dataToSave.total_estimado,
      nombre_evento: dataToSave.nombre_evento || dataToSave.nombre_cliente || 'Evento sin nombre',
      fecha_evento: dataToSave.fecha_evento || new Date().toISOString().slice(0, 10),
      solicitado_por: dataToSave.solicitado_por || 'Sin registrar'
    };

    const result = await guardarEventoCatering({
      businessId: user.business_id,
      eventId: seleccion.evento,
      data: fullData
    });

    if (result.error) {
      console.log('Error guardando evento:', result.error);
      setIsSavingModule(false);
      return;
    }

    // También guardar la cotización relacionada con los datos del evento
    const cotizacionId = dataToSave.id_cotizacion || 
      (selectedEvento?.id_cotizacion) ||
      (data?.eventos || []).find(e => e.id_evento === seleccion.evento)?.id_cotizacion;
      
    if (cotizacionId) {
      const cotizacionDataToSave = {
        nombre_cliente: fullData.nombre_cliente,
        numero_personas: fullData.numero_personas,
        tipo_evento: fullData.nombre_evento,
        solicitado_por: fullData.solicitado_por,
        lugar_evento: fullData.lugar_evento,
        direccion_evento: fullData.direccion_evento,
        referencia_evento: fullData.referencia_evento,
        fecha_anticipo: fullData.fecha_anticipo,
        fecha_pago_estimada: fullData.fecha_pago_estimada,
        momento_liquidacion: fullData.momento_liquidacion,
        notas_evento: fullData.notas_evento,
        total_estimado: fullData.total_estimado,
        receta_ids: fullData.receta_ids || [],
        proveedor_ids: fullData.proveedor_ids || [],
        equipo_ids: fullData.equipo_ids || []
      };

      await guardarCotizacionCatering({
        businessId: user.business_id,
        cotizacionId: cotizacionId,
        eventId: seleccion.evento,
        data: cotizacionDataToSave
      }).catch(err => console.log('Cotización update note:', err));
    }

    await recargarOperacion();
    setIsSavingModule(false);
  }

  async function handleGuardarEventoActual() {
    if (!selectedEvento) {
      setModuleFeedback('', 'Selecciona un evento para editarlo.');
      return;
    }

    setIsSavingModule(true);
    setModuleFeedback();

    // Incluir el total estimado calculado
    const dataWithTotal = {
      ...eventoForm,
      total_estimado: eventoEstimate.totalEvent || eventoForm.total_estimado,
      nombre_evento: eventoForm.nombre_evento || eventoForm.nombre_cliente || 'Evento sin nombre',
      fecha_evento: eventoForm.fecha_evento || new Date().toISOString().slice(0, 10),
      solicitado_por: eventoForm.solicitado_por || 'Sin registrar'
    };

    const result = await guardarEventoCatering({
      businessId: user.business_id,
      eventId: selectedEvento.id_evento,
      data: dataWithTotal
    });

    if (result.error) {
      setModuleFeedback('', result.error);
      setIsSavingModule(false);
      return;
    }

    // También guardar la cotización relacionada con los datos del evento
    if (selectedEvento.id_cotizacion) {
      const cotizacionDataToSave = {
        nombre_cliente: dataWithTotal.nombre_cliente,
        numero_personas: dataWithTotal.numero_personas,
        tipo_evento: dataWithTotal.nombre_evento,
        solicitado_por: dataWithTotal.solicitado_por,
        lugar_evento: dataWithTotal.lugar_evento,
        direccion_evento: dataWithTotal.direccion_evento,
        referencia_evento: dataWithTotal.referencia_evento,
        fecha_anticipo: dataWithTotal.fecha_anticipo,
        fecha_pago_estimada: dataWithTotal.fecha_pago_estimada,
        momento_liquidacion: dataWithTotal.momento_liquidacion,
        notas_evento: dataWithTotal.notas_evento,
        total_estimado: dataWithTotal.total_estimado,
        receta_ids: dataWithTotal.receta_ids || [],
        proveedor_ids: dataWithTotal.proveedor_ids || [],
        equipo_ids: dataWithTotal.equipo_ids || []
      };

      await guardarCotizacionCatering({
        businessId: user.business_id,
        cotizacionId: selectedEvento.id_cotizacion,
        eventId: selectedEvento.id_evento,
        data: cotizacionDataToSave
      }).catch(err => console.log('Cotización update note:', err));
    }

    await recargarOperacion();
    setModuleFeedback('Evento actualizado correctamente.');
    setIsSavingModule(false);
  }

  async function handleEliminarEventoActual() {
    if (!selectedEvento) {
      setModuleFeedback('', 'Selecciona un evento para eliminar.');
      return;
    }

    if (!window.confirm(`Se eliminará el evento ${cleanEventName(selectedEvento.nombre_evento)} con sus cotizaciones y tickets.`)) {
      return;
    }

    setIsSavingModule(true);
    const result = await eliminarEventoCatering(selectedEvento.id_evento);
    setIsSavingModule(false);

    if (result.error) {
      setModuleFeedback('', result.error);
      return;
    }

    await recargarOperacion();
    resetEventoForm();
    setModuleFeedback('Evento eliminado correctamente.');
  }

  async function handleGuardarOperacionActual() {
    if (!operacionForm.id_evento) {
      setModuleFeedback('', 'Selecciona un evento para registrar el ticket de operación.');
      return;
    }

    if (selectedOperacion?.estatus_ticket === 'liquidado') {
      setModuleFeedback('', 'Este ticket ya está liquidado y no se puede modificar.');
      return;
    }

    setIsSavingModule(true);
    setModuleFeedback();

    // Auto-generate ticket code if empty
    const formData = { ...operacionForm };
    if (!formData.ticket_codigo || formData.ticket_codigo.trim() === '') {
      formData.ticket_codigo = generateTicketCode(data?.salidas || []);
    }

    const result = await guardarOperacionCatering({
      operationId: seleccion.operacion,
      data: formData
    });

    if (result.error) {
      setModuleFeedback('', result.error);
      setIsSavingModule(false);
      return;
    }

    await recargarOperacion();
    const estaLiquidado = (formData.estatus_ticket || '').toLowerCase() === 'liquidado';
    setModuleFeedback(estaLiquidado ? '✅ Pago confirmado. Ticket liquidado correctamente.' : `✅ Ticket ${formData.ticket_codigo} creado automáticamente.`);
    setIsSavingModule(false);
  }

  async function handleEliminarOperacionActual() {
    if (!selectedOperacion) {
      setModuleFeedback('', 'Selecciona un ticket de operación para eliminar.');
      return;
    }

    if (!window.confirm(`Se eliminará el ticket ${selectedOperacion.ticket_codigo || selectedOperacion.id_control_cat}.`)) {
      return;
    }

    setIsSavingModule(true);
    const result = await eliminarOperacionCatering(selectedOperacion.id_control_cat);
    setIsSavingModule(false);

    if (result.error) {
      setModuleFeedback('', result.error);
      return;
    }

    await recargarOperacion();
    resetOperacionForm();
    setModuleFeedback('Ticket de operación eliminado.');
  }

  async function handleGuardarEventoDesdeChecklist() {
    if (!seleccion.evento) {
      setModuleFeedback('', 'Selecciona un evento para guardar.');
      return;
    }

    setIsSavingModule(true);
    setModuleFeedback();

    // DECISIÓN AUTOMÁTICA: Si cambió a "confirmado" o superior desde "cotizando"
    // Actualiza como evento, no como cotización
    const eventDataFromChecklist = {
      ...eventoFormChecklist,
      nombre_evento: eventoFormChecklist.nombre_evento || eventoFormChecklist.nombre_cliente || 'Evento sin nombre',
      fecha_evento: eventoFormChecklist.fecha_evento || new Date().toISOString().slice(0, 10),
      solicitado_por: eventoFormChecklist.solicitado_por || 'Sin registrar'
    };

    const result = await guardarEventoCatering({
      businessId: user.business_id,
      eventId: seleccion.evento,
      data: eventDataFromChecklist
    });

    if (result.error) {
      setModuleFeedback('', result.error);
      setIsSavingModule(false);
      return;
    }

    await recargarOperacion();
    const estatusNuevo = eventoFormChecklist.estatus_evento;
    const mensajeExito = estatusNuevo !== 'cotizando' 
      ? `✅ Evento actualizado a estado "${getStatusLabel(estatusNuevo)}". Los cambios se han guardado.`
      : '✅ Evento actualizado correctamente. Los cambios se reflejarán en el sistema.';
    setModuleFeedback(mensajeExito);
    setIsSavingModule(false);
  }

  function buildClientReminderMessage(evento, ticket = null) {
    const lines = [
      `Hola ${evento?.nombre_cliente || 'cliente'},`,
      `seguimiento de tu evento ${cleanEventName(evento?.nombre_evento)} .`
    ];

    if (evento?.anticipo_pagado) {
      lines.push(`Anticipo registrado: ${formatCurrency(evento.anticipo_pagado)}.`);
    }

    if (evento?.saldo_pendiente) {
      lines.push(`Saldo pendiente: ${formatCurrency(evento.saldo_pendiente)}.`);
    }

    if (evento?.fecha_pago_estimada) {
      lines.push(`Fecha estimada de pago: ${formatDate(evento.fecha_pago_estimada)}.`);
    }

    if (ticket) {
      lines.push(`Ticket: ${ticket.ticket_codigo || `TK-${ticket.id_control_cat}`}.`);
      lines.push(`Pendiente: ${ticket.tipo_ticket} ${ticket.monto_ticket ? `por ${formatCurrency(ticket.monto_ticket)}` : ''}.`);
      if (ticket.fecha_compromiso) {
        lines.push(`Compromiso estimado: ${formatDate(ticket.fecha_compromiso)}.`);
      }
      if (ticket.observaciones) {
        lines.push(`Detalle: ${ticket.observaciones}`);
      }
    }

    lines.push('Quedo pendiente de tu confirmación por este medio.');
    return lines.filter(Boolean).join(' ');
  }

  function buildPagoConfirmadoMessage(evento, ticket, destino = 'cliente') {
    const nombre = destino === 'cliente'
      ? (evento?.nombre_cliente || 'cliente')
      : (ticket?.responsable_ticket || 'equipo');
    const lineas = [
      destino === 'cliente'
        ? `Hola ${nombre}, confirmamos que hemos recibido tu pago para el evento ${cleanEventName(evento?.nombre_evento)}.`
        : `Hola ${nombre}, el pago del ticket ${ticket?.ticket_codigo || `TK-${ticket?.id_control_cat}`} del evento ${cleanEventName(evento?.nombre_evento)} ha sido confirmado.`,
    ];
    if (ticket?.monto_ticket) {
      lineas.push(`Monto: ${formatCurrency(ticket.monto_ticket)}.`);
    }
    if (ticket?.metodo_pago) {
      lineas.push(`Método: ${ticket.metodo_pago}.`);
    }
    if (evento?.saldo_pendiente > 0) {
      lineas.push(`Saldo restante del evento: ${formatCurrency(evento.saldo_pendiente)}.`);
    } else {
      lineas.push('El evento queda totalmente liquidado.');
    }
    lineas.push('Gracias por confiar en nosotros.');
    return lineas.join(' ');
  }

  function abrirWhatsAppPagoConfirmado(evento, ticket, destino = 'cliente') {
    const telefono = destino === 'cliente' ? evento?.telefono_cliente : null;
    if (!telefono) {
      setModuleFeedback('', destino === 'cliente' ? 'El cliente no tiene teléfono capturado.' : 'Sin teléfono del responsable.');
      return;
    }
    const link = buildWhatsAppLink({ phone: telefono, message: buildPagoConfirmadoMessage(evento, ticket, destino) });
    window.open(link, '_blank');
  }

  function abrirCorreoPagoConfirmado(evento, ticket) {
    if (!evento?.correo_cliente) {
      setModuleFeedback('', 'El cliente no tiene correo capturado.');
      return;
    }
    const link = buildMailToLink({
      email: evento.correo_cliente,
      subject: `Pago confirmado · ${cleanEventName(evento.nombre_evento)}`,
      body: buildPagoConfirmadoMessage(evento, ticket, 'cliente')
    });
    window.open(link, '_blank');
  }

  function abrirCorreoSeguimiento(evento, ticket = null) {
    if (!evento?.correo_cliente) {
      setModuleFeedback('', 'Este cliente no tiene correo capturado.');
      return;
    }

    const link = buildMailToLink({
      email: evento.correo_cliente,
      subject: `Seguimiento de ${cleanEventName(evento.nombre_evento)}`,
      body: buildClientReminderMessage(evento, ticket)
    });

    window.open(link, '_blank');
  }

  function abrirWhatsAppSeguimiento(evento, ticket = null) {
    if (!evento?.telefono_cliente) {
      setModuleFeedback('', 'Este cliente no tiene teléfono capturado.');
      return;
    }

    const link = buildWhatsAppLink({
      phone: evento.telefono_cliente,
      message: buildClientReminderMessage(evento, ticket)
    });

    window.open(link, '_blank');
  }

  function exportarHistorialCateringCsv() {
    const rows = [
      ['Fecha', 'Tipo', 'Concepto', 'Responsable', 'Detalle', 'Total'],
      ...historialFiltrado.map((item) => [item.fecha_label, item.tipo, item.concepto, item.responsable, item.detalle, item.total_label])
    ];

    descargarCsvCatering(`historial-catering-${new Date().toISOString().slice(0, 10)}.csv`, rows);
  }

  function exportarHistorialCateringPdf() {
    descargarPdfCatering({
      titulo: 'Historial de catering',
      resumen: [
        { title: 'Cotizados', value: data?.resumen?.cotizados || 0, detail: 'Cotizaciones registradas' },
        { title: 'Por pagar', value: data?.resumen?.porPagar || 0, detail: 'Eventos con saldo pendiente' },
        { title: 'Operando', value: data?.resumen?.eventosOperando || 0, detail: 'Eventos en curso' },
        { title: 'Tickets', value: data?.resumen?.salidas || 0, detail: 'Tickets de seguimiento guardados' }
      ],
      movimientos: historialFiltrado
    });
  }

  function renderSelectionGroup(title, items, selectedIds, onToggle, getLabel) {
    return (
      <div className="field-span-2">
        <span>{title}</span>
        <div className="selection-chip-grid">
          {items.length ? (
            items.map((item) => {
              // Usar el id_proveedor directamente si es string (con prefijo)
              // Si no, extraer el número del id_recetario, id_item o id_proveedor
              let itemId;
              if (typeof item.id_proveedor === 'string' && (item.id_proveedor.startsWith('eq_') || item.id_proveedor.startsWith('prov_'))) {
                itemId = item.id_proveedor;
              } else {
                itemId = Number(item.id_recetario || item.id_item || item.id_proveedor);
              }
              
              const isSelected = selectedIds.includes(itemId);

              return (
                <button
                  type="button"
                  key={itemId}
                  className={`selection-chip ${isSelected ? 'selected' : ''}`}
                  onClick={() => onToggle(itemId)}
                >
                  {getLabel(item)}
                </button>
              );
            })
          ) : (
            <div className="image-placeholder-card compact-placeholder">No hay opciones disponibles todavía.</div>
          )}
        </div>
      </div>
    );
  }

  function renderEstimateCard(estimate, providerIds, equipmentIds) {
    return (
      <div className="split-metric-row">
        <div className="purchase-total-card compact-card">
          <span>Costo por persona</span>
          <strong>{formatCurrency(estimate.costPerPerson)}</strong>
          <small>Para {estimate.people} persona{estimate.people !== 1 ? 's' : ''}</small>
        </div>
        <div className="purchase-total-card compact-card">
          <span>Total del evento</span>
          <strong>{formatCurrency(estimate.totalEvent)}</strong>
          <small>Incluye recetas, equipos y proveedores</small>
        </div>
      </div>
    );
  }

  function renderEventoEstimate() {
    // Si el evento ya tiene un total_estimado guardado, mostrarlo
    if (eventoForm.total_estimado && eventoForm.total_estimado > 0 && eventoForm.numero_personas) {
      const costPerPerson = Number(eventoForm.total_estimado) / Number(eventoForm.numero_personas);
      return (
        <div className="split-metric-row">
          <div className="purchase-total-card compact-card">
            <span>Costo por persona</span>
            <strong>{formatCurrency(costPerPerson)}</strong>
            <small>Para {eventoForm.numero_personas} persona{eventoForm.numero_personas !== 1 ? 's' : ''}</small>
          </div>
          <div className="purchase-total-card compact-card">
            <span>Total del evento</span>
            <strong>{formatCurrency(eventoForm.total_estimado)}</strong>
            <small>Según cotización realizada</small>
          </div>
        </div>
      );
    }
    // Si no, mostrar el estimate recalculado
    return renderEstimateCard(eventoEstimate, eventoForm.proveedor_ids, eventoForm.equipo_ids);
  }

  function renderCotizacionEditor() {
    return (
      <div className="almacen-layout">
        <div className="module-actions">
          <button type="button" className="module-action-button primary" onClick={resetCotizacionForm}>
            Nueva cotización
          </button>
          <button type="button" className="module-action-button success" onClick={handleGuardarCotizacion} disabled={isSavingModule}>
            {isSavingModule 
              ? 'Guardando...' 
              : cotizacionForm.estatus_evento === 'cotizando'
                ? 'Guardar como cotización'
                : 'Convertir a evento'}
          </button>
          <button type="button" className="module-action-button danger" onClick={handleEliminarCotizacionActual}>
            Eliminar cotización
          </button>
        </div>

        {(moduleMessage || moduleError) && (
          <div className={`operation-banner ${moduleError ? 'error' : 'success'}`}>{moduleError || moduleMessage}</div>
        )}

        <div className="almacen-subpanel-grid">
          <div className="almacen-subpanel">
            <div className="almacen-subpanel-header">
              <h3>Cotización completa</h3>
              <span>Cliente, solicitud, menú y logística</span>
            </div>
            <div className="form-grid-fields">
              <label>
                <span>Nombre del evento</span>
                <input
                  value={cotizacionForm.nombre_evento}
                  onChange={(event) => setCotizacionForm((current) => ({ ...current, nombre_evento: event.target.value }))}
                  placeholder="Ej. Boda jardín, desayuno ejecutivo"
                />
              </label>
              <label>
                <span>Fecha del evento</span>
                <input
                  type="date"
                  value={cotizacionForm.fecha_evento}
                  onChange={(event) => setCotizacionForm((current) => ({ ...current, fecha_evento: event.target.value }))}
                />
              </label>
              <label>
                <span>Número de personas</span>
                <input
                  type="number"
                  min="1"
                  value={cotizacionForm.numero_personas}
                  onChange={(event) => setCotizacionForm((current) => ({ ...current, numero_personas: event.target.value }))}
                />
              </label>
              <label>
                <span>Estatus inicial</span>
                <select
                  value={cotizacionForm.estatus_evento}
                  onChange={(event) => setCotizacionForm((current) => ({ ...current, estatus_evento: event.target.value }))}
                >
                  {CATERING_EVENT_STATUSES.map((status) => (
                    <option key={status} value={status}>
                      {getStatusLabel(status)}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span>Cliente</span>
                <input
                  value={cotizacionForm.nombre_cliente}
                  onChange={(event) => setCotizacionForm((current) => ({ ...current, nombre_cliente: event.target.value }))}
                  placeholder="Nombre del cliente"
                />
              </label>
              <label>
                <span>Solicitado por</span>
                <input
                  value={cotizacionForm.solicitado_por}
                  onChange={(event) => setCotizacionForm((current) => ({ ...current, solicitado_por: event.target.value }))}
                  placeholder="Quién pidió la cotización"
                />
              </label>
              <label>
                <span>Teléfono</span>
                <input
                  value={cotizacionForm.telefono_cliente}
                  onChange={(event) => setCotizacionForm((current) => ({ ...current, telefono_cliente: event.target.value }))}
                />
              </label>
              <label>
                <span>Correo</span>
                <input
                  type="email"
                  value={cotizacionForm.correo_cliente}
                  onChange={(event) => setCotizacionForm((current) => ({ ...current, correo_cliente: event.target.value }))}
                />
              </label>
              <label>
                <span>Lugar</span>
                <input
                  value={cotizacionForm.lugar_evento}
                  onChange={(event) => setCotizacionForm((current) => ({ ...current, lugar_evento: event.target.value }))}
                  placeholder="Salón, jardín, oficina, domicilio"
                />
              </label>
              <label className="field-span-2">
                <span>Dirección</span>
                <input
                  value={cotizacionForm.direccion_evento}
                  onChange={(event) => setCotizacionForm((current) => ({ ...current, direccion_evento: event.target.value }))}
                  placeholder="Dónde será el evento"
                />
              </label>
              <label className="field-span-2">
                <span>Referencia</span>
                <input
                  value={cotizacionForm.referencia_evento}
                  onChange={(event) => setCotizacionForm((current) => ({ ...current, referencia_evento: event.target.value }))}
                  placeholder="Entre calles, acceso, indicaciones"
                />
              </label>
              <label>
                <span>Fecha anticipo</span>
                <input
                  type="date"
                  value={cotizacionForm.fecha_anticipo}
                  onChange={(event) => setCotizacionForm((current) => ({ ...current, fecha_anticipo: event.target.value }))}
                />
              </label>
              <label>
                <span>Fecha pago estimada</span>
                <input
                  type="date"
                  value={cotizacionForm.fecha_pago_estimada}
                  onChange={(event) => setCotizacionForm((current) => ({ ...current, fecha_pago_estimada: event.target.value }))}
                />
              </label>
              <label className="field-span-2">
                <span>Cuándo liquida</span>
                <input
                  value={cotizacionForm.momento_liquidacion}
                  onChange={(event) => setCotizacionForm((current) => ({ ...current, momento_liquidacion: event.target.value }))}
                  placeholder="Antes, durante o después del evento"
                />
              </label>
              <label className="field-span-2">
                <span>Notas</span>
                <textarea
                  rows="3"
                  value={cotizacionForm.notas_evento}
                  onChange={(event) => setCotizacionForm((current) => ({ ...current, notas_evento: event.target.value }))}
                  placeholder="Requerimientos especiales del cliente"
                />
              </label>
              {renderSelectionGroup(
                'Recetas a utilizar',
                catalogos.recetas,
                cotizacionForm.receta_ids,
                (itemId) => setCotizacionForm((current) => ({ ...current, receta_ids: toggleId(current.receta_ids, itemId) })),
                (item) => `${item.nombre_platillo} · ${formatCurrency(item.precio_venta_fijo || item.costo_porcion)}`
              )}
              {renderSelectionGroup(
                'Equipo propio',
                catalogos.equiposPropios,
                cotizacionForm.equipo_ids,
                (itemId) => setCotizacionForm((current) => ({ ...current, equipo_ids: toggleId(current.equipo_ids, itemId) })),
                (item) => `${item.nombre_prov} · ${item.tipo_proveedor}`
              )}
              {renderSelectionGroup(
                'Proveedores de apoyo',
                [...catalogos.proveedoresOperacion, ...catalogos.proveedoresRenta],
                cotizacionForm.proveedor_ids,
                (itemId) => setCotizacionForm((current) => ({ ...current, proveedor_ids: toggleId(current.proveedor_ids, itemId) })),
                (item) => `${item.nombre_prov} · ${item.tipo_proveedor}`
              )}
            </div>
            {renderEstimateCard(cotizacionEstimate, cotizacionForm.proveedor_ids, cotizacionForm.equipo_ids)}
          </div>

          <div className="almacen-subpanel">
            <div className="almacen-subpanel-header">
              <h3>Detalle de la cotización</h3>
              <span>{seleccion.cotizacion ? 'Registro seleccionado' : 'Vista previa actual'}</span>
            </div>
            <div className="detail-card">
              <strong>{cleanEventName(cotizacionForm.nombre_evento) || 'Nueva cotización'}</strong>
              <span>{cotizacionForm.nombre_cliente || 'Sin cliente'} · {formatDate(cotizacionForm.fecha_evento)}</span>
              <span>{toNumber(cotizacionForm.numero_personas)} personas · {getStatusLabel(cotizacionForm.estatus_evento)}</span>
              <span>{formatCurrency(cotizacionEstimate.costPerPerson)} por persona · Total {formatCurrency(cotizacionEstimate.totalEvent)}</span>
              <div className="detail-stack">
                {cotizacionEstimate.selectedRecipes.length ? (
                  cotizacionEstimate.selectedRecipes.map((item) => <p key={`quote-recipe-${item.id_recetario}`}>{item.nombre_platillo}</p>)
                ) : (
                  <p>Selecciona al menos una receta para calcular la propuesta.</p>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="almacen-subpanel">
          <div className="almacen-subpanel-header">
            <h3>Cotizaciones guardadas</h3>
            <span>{data?.cotizaciones?.length || 0} registros</span>
          </div>
          <div className="mini-list compact-list">
            {(data?.cotizaciones || []).map((item) => (
              <button
                type="button"
                className={`mini-item selectable-item ${seleccion.cotizacion === item.id_cotizacion ? 'selected' : ''}`}
                key={item.id_cotizacion}
                onClick={() => handleSelectCotizacion(item)}
              >
                <strong>{item.nombre_cliente} · {cleanEventName(item.nombre_evento)}</strong>
                <span>{formatDate(item.fecha_evento)} · {item.numero_personas} personas</span>
                <span>{formatCurrency(item.total_estimado)} · {(item.recetas_seleccionadas || []).length} recetas</span>
                <span>
                  Actual {formatCurrency(item.precio_sugerido_persona || 0)} · Pactado {formatCurrency(item.precio_pactado_persona || 0)}
                  {item.variacion_vs_anterior !== null ? ` · Historial ${formatCurrency(item.variacion_vs_anterior)}` : ''}
                </span>
                <small className={`status-pill ${getStatusClass(item.estatus_evento)}`}>{getStatusLabel(item.estatus_evento)}</small>
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  function renderEventosEditor() {
    return (
      <div className="almacen-layout">
        <div className="module-actions">
          <button type="button" className="module-action-button primary" onClick={resetEventoForm}>
            Limpiar selección
          </button>
          <button type="button" className="module-action-button success" onClick={handleGuardarEventoActual} disabled={isSavingModule}>
            {isSavingModule ? 'Guardando...' : 'Guardar evento'}
          </button>
          <button 
            type="button" 
            className="module-action-button success" 
            onClick={() => {
              // Primero guarda el evento
              handleGuardarEventoActual();
              // Luego actualiza automáticamente el ticket
              setTimeout(() => {
                setModuleFeedback('Evento y ticket actualizados correctamente');
              }, 1500);
            }} 
            disabled={isSavingModule}
            style={{ backgroundColor: '#17a2b8' }}
          >
            {isSavingModule ? 'Guardando...' : '✓ Guardar y actualizar ticket'}
          </button>
          <button type="button" className="module-action-button danger" onClick={handleEliminarEventoActual}>
            Eliminar evento
          </button>
        </div>

        {(moduleMessage || moduleError) && (
          <div className={`operation-banner ${moduleError ? 'error' : 'success'}`}>{moduleError || moduleMessage}</div>
        )}

        <div className="almacen-subpanel-grid">
          <div className="almacen-subpanel">
            <div className="almacen-subpanel-header">
              <h3>Evento confirmado</h3>
              <span>Edita estatus, cliente, sede y cobertura</span>
            </div>
            <div className="form-grid-fields">
              <label>
                <span>Evento</span>
                <input
                  value={eventoForm.nombre_evento}
                  onChange={(event) => setEventoForm((current) => ({ ...current, nombre_evento: event.target.value }))}
                />
              </label>
              <label>
                <span>Fecha</span>
                <input
                  type="date"
                  value={eventoForm.fecha_evento}
                  onChange={(event) => setEventoForm((current) => ({ ...current, fecha_evento: event.target.value }))}
                />
              </label>
              <label>
                <span>Personas</span>
                <input
                  type="number"
                  min="1"
                  value={eventoForm.numero_personas}
                  onChange={(event) => setEventoForm((current) => ({ ...current, numero_personas: event.target.value }))}
                />
              </label>
              <label>
                <span>Estatus</span>
                <select
                  value={eventoForm.estatus_evento}
                  onChange={(event) => {
                    const nuevoEstatus = event.target.value;
                    
                    // Actualizar el form primero
                    setEventoForm((current) => {
                      const updated = { ...current, estatus_evento: nuevoEstatus };
                      
                      // Auto-guardar cuando cambio a "operando" o "liquidado"
                      if (nuevoEstatus === 'operando' || nuevoEstatus === 'liquidado') {
                        // Usar setTimeout para permitir que React actualice el estado
                        setTimeout(() => {
                          handleGuardarEventoActualConDatos(updated);
                        }, 100);
                      }
                      
                      return updated;
                    });
                  }}
                >
                  {CATERING_EVENT_STATUSES.map((status) => (
                    <option key={status} value={status}>
                      {getStatusLabel(status)}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span>Cliente</span>
                <input
                  value={eventoForm.nombre_cliente}
                  onChange={(event) => setEventoForm((current) => ({ ...current, nombre_cliente: event.target.value }))}
                />
              </label>
              <label>
                <span>Solicitado por</span>
                <input
                  value={eventoForm.solicitado_por}
                  onChange={(event) => setEventoForm((current) => ({ ...current, solicitado_por: event.target.value }))}
                />
              </label>
              <label>
                <span>Teléfono</span>
                <input
                  value={eventoForm.telefono_cliente}
                  onChange={(event) => setEventoForm((current) => ({ ...current, telefono_cliente: event.target.value }))}
                />
              </label>
              <label>
                <span>Correo</span>
                <input
                  type="email"
                  value={eventoForm.correo_cliente}
                  onChange={(event) => setEventoForm((current) => ({ ...current, correo_cliente: event.target.value }))}
                />
              </label>
              <label>
                <span>Lugar</span>
                <input
                  value={eventoForm.lugar_evento}
                  onChange={(event) => setEventoForm((current) => ({ ...current, lugar_evento: event.target.value }))}
                />
              </label>
              <label className="field-span-2">
                <span>Dirección</span>
                <input
                  value={eventoForm.direccion_evento}
                  onChange={(event) => setEventoForm((current) => ({ ...current, direccion_evento: event.target.value }))}
                />
              </label>
              <label className="field-span-2">
                <span>Referencia</span>
                <input
                  value={eventoForm.referencia_evento}
                  onChange={(event) => setEventoForm((current) => ({ ...current, referencia_evento: event.target.value }))}
                />
              </label>
              <label>
                <span>Anticipo pagado</span>
                <input
                  type="number"
                  step="0.01"
                  value={eventoForm.anticipo_pagado}
                  onChange={(event) => setEventoForm((current) => ({ ...current, anticipo_pagado: event.target.value }))}
                />
              </label>
              <label>
                <span>Saldo pendiente</span>
                <input
                  type="number"
                  step="0.01"
                  value={eventoForm.saldo_pendiente}
                  onChange={(event) => setEventoForm((current) => ({ ...current, saldo_pendiente: event.target.value }))}
                />
              </label>
              <label>
                <span>Fecha anticipo</span>
                <input
                  type="date"
                  value={eventoForm.fecha_anticipo}
                  onChange={(event) => setEventoForm((current) => ({ ...current, fecha_anticipo: event.target.value }))}
                />
              </label>
              <label>
                <span>Fecha pago estimada</span>
                <input
                  type="date"
                  value={eventoForm.fecha_pago_estimada}
                  onChange={(event) => setEventoForm((current) => ({ ...current, fecha_pago_estimada: event.target.value }))}
                />
              </label>
              <label className="field-span-2">
                <span>Cuándo liquida</span>
                <input
                  value={eventoForm.momento_liquidacion}
                  onChange={(event) => setEventoForm((current) => ({ ...current, momento_liquidacion: event.target.value }))}
                  placeholder="Antes, durante o después del evento"
                />
              </label>
              <label className="field-span-2">
                <span>Notas</span>
                <textarea
                  rows="3"
                  value={eventoForm.notas_evento}
                  onChange={(event) => setEventoForm((current) => ({ ...current, notas_evento: event.target.value }))}
                />
              </label>
            </div>
            {renderEventoEstimate()}
          </div>

          <div className="almacen-subpanel">
            <div className="almacen-subpanel-header">
              <h3>Detalle del evento</h3>
              <span>{selectedEvento ? 'Evento seleccionado' : 'Elige un evento para editar'}</span>
            </div>
            {seleccion.evento && eventoForm ? (
              <div className="detail-card">
                <strong>{cleanEventName(eventoForm.nombre_evento)}</strong>
                <span>{eventoForm.nombre_cliente || 'Sin cliente'} · {formatDate(eventoForm.fecha_evento)}</span>
                <span>{eventoForm.numero_personas} personas · {getStatusLabel(eventoForm.estatus_evento)}</span>
                <span>{formatCurrency(eventoForm.total_estimado || 0)} total estimado</span>
                
                {/* Información de ubicación */}
                <div style={{
                  marginTop: '12px',
                  padding: '12px',
                  backgroundColor: '#f3f4f6',
                  borderRadius: '6px',
                  borderLeft: '4px solid #3b82f6'
                }}>
                  <div style={{fontSize: '13px', fontWeight: '600', color: '#1f2937', marginBottom: '8px'}}>📍 Ubicación del evento</div>
                  <div style={{fontSize: '12px', color: '#4b5563', lineHeight: '1.6'}}>
                    <div><strong>Lugar:</strong> {eventoForm.lugar_evento || 'No especificado'}</div>
                    <div><strong>Dirección:</strong> {eventoForm.direccion_evento || 'No especificada'}</div>
                    {eventoForm.referencia_evento && <div><strong>Referencia:</strong> {eventoForm.referencia_evento}</div>}
                  </div>
                </div>

                {/* Información de contacto */}
                <div style={{
                  marginTop: '12px',
                  padding: '12px',
                  backgroundColor: '#f0fdf4',
                  borderRadius: '6px',
                  borderLeft: '4px solid #10b981'
                }}>
                  <div style={{fontSize: '13px', fontWeight: '600', color: '#1f2937', marginBottom: '8px'}}>👤 Datos del Cliente</div>
                  <div style={{fontSize: '12px', color: '#4b5563', lineHeight: '1.6'}}>
                    <div><strong>Solicitado por:</strong> {eventoForm.solicitado_por || 'No especificado'}</div>
                    {eventoForm.nombre_cliente && <div><strong>Cliente:</strong> {eventoForm.nombre_cliente}</div>}
                    {eventoForm.telefono_cliente && <div><strong>Teléfono:</strong> {eventoForm.telefono_cliente}</div>}
                    {eventoForm.correo_cliente && <div><strong>Correo:</strong> {eventoForm.correo_cliente}</div>}
                  </div>
                </div>

                {/* Información financiera */}
                <div style={{
                  marginTop: '12px',
                  padding: '12px',
                  backgroundColor: '#fef3c7',
                  borderRadius: '6px',
                  borderLeft: '4px solid #f59e0b'
                }}>
                  <div style={{fontSize: '13px', fontWeight: '600', color: '#1f2937', marginBottom: '8px'}}>💰 Información de Pago</div>
                  <div style={{fontSize: '12px', color: '#4b5563', lineHeight: '1.6'}}>
                    <div><strong>Total Estimado:</strong> {formatCurrency(eventoForm.total_estimado || 0)}</div>
                    <div><strong>Anticipo:</strong> {formatCurrency(eventoForm.anticipo_pagado || 0)}</div>
                    <div><strong>Saldo:</strong> {formatCurrency(eventoForm.saldo_pendiente || 0)}</div>
                    {eventoForm.momento_liquidacion && <div><strong>¿Cuándo liquida?:</strong> {eventoForm.momento_liquidacion}</div>}
                  </div>
                </div>

                <div className="module-actions" style={{marginTop: '12px'}}>
                  <button type="button" className="module-action-button" onClick={() => abrirCorreoSeguimiento(eventoForm)}>
                    📧 Avisar por correo
                  </button>
                  <button type="button" className="module-action-button" onClick={() => abrirWhatsAppSeguimiento(eventoForm)}>
                    💬 Avisar por WhatsApp
                  </button>
                </div>
              </div>
            ) : (
              <p className="panel-empty">Selecciona un evento para ver y editar su detalle.</p>
            )}
          </div>
        </div>

        <div className="almacen-subpanel">
          <div className="almacen-subpanel-header">
            <h3>Eventos de catering</h3>
            <span>{data?.eventos?.length || 0} registros</span>
          </div>
          <div className="mini-list compact-list">
            {(data?.eventos || []).map((item) => (
                <button
                  type="button"
                  className={`mini-item selectable-item ${seleccion.evento === item.id_evento ? 'selected' : ''}`}
                  key={item.id_evento}
                  onClick={() => handleSelectEvento(item)}
                >
                  <strong>{cleanEventName(item.nombre_evento)}</strong>
                  <span style={{fontSize: '12px', color: '#6b7280'}}>{formatDate(item.fecha_evento)} · {item.numero_personas} personas</span>
                  <span style={{fontSize: '12px', color: '#9ca3af'}}>{item.nombre_cliente || 'Sin cliente'} · {item.lugar_evento || 'Sin lugar'}</span>
                  <small className={`status-pill ${getStatusClass(item.estatus)}`}>{getStatusLabel(item.estatus)}</small>
                </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  function exportarMovimientosCateringExcel() {
    if (!movimientosCatData) {
      return;
    }

    const movimientos = movimientosCatData.movimientos || [];
    
    const rows = [
      ['MOVIMIENTOS DE INSUMOS CATERING - DETALLE COMPLETO'],
      [''],
      ['Período:', movimientosCatFiltro.fechaInicio || 'Sin fecha', 'hasta', movimientosCatFiltro.fechaFin || 'Hoy'],
      movimientosCatFiltro.horaInicio ? ['Horario:', movimientosCatFiltro.horaInicio, 'a', movimientosCatFiltro.horaFin] : [],
      [''],
      ['RESUMEN DETALLADO DE MOVIMIENTOS'],
      ['Fecha y Hora', 'Insumo', 'Cantidad', 'Unidad', 'Tipo de Movimiento', 'Tipo de Proveedor', 'Equipo/Artículo', 'Condición', 'Responsable', 'Observaciones Detalladas', 'Motivo'],
      ...movimientos.map((item) => {
        const fechaHora = item.fecha_registro ? new Date(item.fecha_registro).toLocaleString('es-MX') : '';
        const tipoProveedor = {
          'interno': 'Interno (stock propio)',
          'externo_alquiler': 'Externo - Alquiler equipo',
          'externo_servicio': 'Externo - Servicio prestado'
        }[item.tipo_proveedor] || item.tipo_proveedor || '';
        
        return [
          fechaHora,
          item.nombre_item || item.id_insumo || '',
          item.cantidad || '',
          item.unidad_consumo || '',
          item.tipo_detalle || item.tipo_operacion || '',
          tipoProveedor,
          item.equipo_renta || '',
          item.condicion_equipo || '',
          item.responsable || '',
          item.observaciones_detalladas || '',
          item.motivo || ''
        ];
      })
    ];

    descargarCsv('movimientos_catering_detalle.csv', rows);
  }

  function exportarMovimientosCateringPdf() {
    if (!movimientosCatData) {
      return;
    }

    const movimientos = movimientosCatData.movimientos || [];
    const totalMovimientos = movimientos.length;
    
    // Contar por proveedor
    const porProveedor = movimientos.reduce((acc, m) => {
      const tipo = m.tipo_proveedor || 'interno';
      acc[tipo] = (acc[tipo] || 0) + 1;
      return acc;
    }, {});
    
    // Contar por condición
    const porCondicion = movimientos.reduce((acc, m) => {
      const cond = m.condicion_equipo || 'ok';
      acc[cond] = (acc[cond] || 0) + 1;
      return acc;
    }, {});

    descargarPdfMovimiento({
      titulo: 'Movimientos de insumos catering - Detalle',
      resumen: [
        { title: 'Total registros', value: totalMovimientos, detail: 'movimientos en el período' },
        { title: 'Períodoido', value: movimientosCatFiltro.periodo || 'personalizado', detail: `${movimientosCatFiltro.fechaInicio || 'inicio'} a ${movimientosCatFiltro.fechaFin || 'hoy'}${movimientosCatFiltro.horaInicio ? ` (${movimientosCatFiltro.horaInicio} a ${movimientosCatFiltro.horaFin})` : ''}` },
        { title: 'Externos (alquiler)', value: porProveedor['externo_alquiler'] || 0, detail: 'movimientos' },
        { title: 'Con daños/pérdidas', value: (porCondicion['dañado'] || 0) + (porCondicion['roto'] || 0) + (porCondicion['perdido'] || 0), detail: 'problemas reportados' }
      ],
      movimientos: movimientos.map((item) => {
        const fechaHora = item.fecha_registro ? new Date(item.fecha_registro).toLocaleString('es-MX') : '—';
        const tipoProveedor = {
          'interno': 'Interno',
          'externo_alquiler': 'Alquiler',
          'externo_servicio': 'Servicio'
        }[item.tipo_proveedor] || item.tipo_proveedor || '—';
        
        return {
          fecha_label: fechaHora,
          tipo: item.tipo_detalle || item.tipo_operacion || '—',
          concepto: `${item.nombre_item || '—'} (${item.cantidad} ${item.unidad_consumo || ''})`,
          responsable: item.responsable || '—',
          detalle: `${tipoProveedor} | ${item.equipoRenta || '—'} | ${item.condicion_equipo || '—'}`,
          total_label: item.observaciones_detalladas || item.motivo || '—'
        };
      })
    });
  }

  function renderOperacionEditor() {
    const ticketLiquidado = selectedOperacion?.estatus_ticket === 'liquidado';
    return (
      <div className="almacen-layout">
        <div className="module-tabs" style={{ marginBottom: '16px', display: 'flex', gap: '8px', borderBottom: '1px solid #ddd', paddingBottom: '8px' }}>
          <button
            type="button"
            className={`manager-tab ${operacionTab === 'checklist' ? 'active' : ''}`}
            onClick={() => setOperacionTab('checklist')}
          >
            Checklist y Operación
          </button>
          <button
            type="button"
            className={`manager-tab ${operacionTab === 'movimientos' ? 'active' : ''}`}
            onClick={() => setOperacionTab('movimientos')}
          >
            Movimientos de insumos
          </button>
        </div>

        {operacionTab === 'checklist' && (
        <div>
        <div className="module-actions">
          <button type="button" className="module-action-button primary" onClick={resetOperacionForm}>
            Nuevo ticket
          </button>
          <button type="button" className="module-action-button success" onClick={handleGuardarOperacionActual} disabled={isSavingModule || ticketLiquidado}>
            {isSavingModule ? 'Guardando...' : 'Guardar ticket'}
          </button>
          <button type="button" className="module-action-button danger" onClick={handleEliminarOperacionActual}>
            Eliminar ticket
          </button>
        </div>

        {ticketLiquidado && (
          <div className="operation-banner liquidado-banner">
            ✅ Este ticket ya está <strong>liquidado</strong>. No se puede modificar.
            <div className="module-actions" style={{ marginTop: '8px' }}>
              <button type="button" className="module-action-button success" onClick={() => abrirWhatsAppPagoConfirmado(eventoOperacion, selectedOperacion, 'cliente')}>
                WhatsApp cliente
              </button>
              <button type="button" className="module-action-button" onClick={() => abrirCorreoPagoConfirmado(eventoOperacion, selectedOperacion)}>
                Correo cliente
              </button>
            </div>
          </div>
        )}

        {(moduleMessage || moduleError) && (
          <div className={`operation-banner ${moduleError ? 'error' : moduleMessage.startsWith('✅') ? 'liquidado-banner' : 'success'}`}>{moduleError || moduleMessage}</div>
        )}

        <div className="almacen-subpanel-grid">
          <div className="almacen-subpanel">
            <div className="almacen-subpanel-header">
              <h3>Cobro y pagos del evento</h3>
              <span>Selecciona evento para ver datos del cliente</span>
            </div>
            <div className="form-grid-fields">
              <label>
                <span>Evento</span>
                <select
                  value={operacionForm.id_evento}
                  onChange={(event) => {
                    const idEvento = event.target.value;
                    const eventoSeleccionado = (data?.eventos || []).find((e) => String(e.id_evento) === String(idEvento));
                    const cotizacionRelacionada = eventoSeleccionado ? (data?.cotizaciones || []).find((c) => c.id_cotizacion === eventoSeleccionado.id_cotizacion) : null;
                    
                    // Obtener el estatus actual del evento - usar estatus_evento primero, luego estatus, con fallback a cotizando
                    const estatusActual = eventoSeleccionado?.estatus_evento || eventoSeleccionado?.estatus || 'cotizando';
                    
                    // Obtener el nombre del cliente desde cotización o evento
                    const nombreCliente = cotizacionRelacionada?.nombre_cliente || eventoSeleccionado?.nombre_cliente || '';
                    
                    setSeleccion((current) => ({ ...current, evento: idEvento }));
                    
                    setOperacionForm((current) => ({
                      ...current,
                      id_evento: idEvento,
                      fecha_compromiso: eventoSeleccionado?.fecha_evento ? eventoSeleccionado.fecha_evento.slice(0, 10) : current.fecha_compromiso,
                      nombre_cliente: nombreCliente,
                      correo_cliente: cotizacionRelacionada?.correo_cliente || eventoSeleccionado?.correo_cliente || '',
                      telefono_cliente: cotizacionRelacionada?.telefono_cliente || eventoSeleccionado?.telefono_cliente || '',
                      actualizar_estatus_evento: estatusActual // Cargar el estatus actual del evento dinámicamente
                    }));

                    // Cargar datos del evento en el formulario editable de Checklist
                    if (eventoSeleccionado) {
                      setEventoFormChecklist({
                        nombre_evento: cotizacionRelacionada?.nombre_evento || eventoSeleccionado.nombre_evento || '',
                        fecha_evento: eventoSeleccionado.fecha_evento || '',
                        numero_personas: eventoSeleccionado.numero_personas || '',
                        nombre_cliente: nombreCliente,
                        telefono_cliente: cotizacionRelacionada?.telefono_cliente || eventoSeleccionado?.telefono_cliente || '',
                        correo_cliente: cotizacionRelacionada?.correo_cliente || eventoSeleccionado?.correo_cliente || '',
                        solicitado_por: cotizacionRelacionada?.solicitado_por || eventoSeleccionado?.solicitado_por || '',
                        lugar_evento: cotizacionRelacionada?.lugar_evento || eventoSeleccionado?.lugar_evento || '',
                        direccion_evento: cotizacionRelacionada?.direccion_evento || eventoSeleccionado?.direccion_evento || '',
                        referencia_evento: cotizacionRelacionada?.referencia_evento || eventoSeleccionado?.referencia_evento || '',
                        estatus_evento: eventoSeleccionado.estatus_evento || eventoSeleccionado.estatus || 'cotizando',
                        anticipo_pagado: eventoSeleccionado.anticipo_pagado || 0,
                        saldo_pendiente: eventoSeleccionado.saldo_pendiente || 0,
                        fecha_anticipo: eventoSeleccionado.fecha_anticipo || '',
                        fecha_pago_estimada: eventoSeleccionado.fecha_pago_estimada || '',
                        momento_liquidacion: cotizacionRelacionada?.momento_liquidacion || eventoSeleccionado?.momento_liquidacion || '',
                        notas_evento: cotizacionRelacionada?.notas_evento || eventoSeleccionado?.notas_evento || '',
                        total_estimado: eventoSeleccionado.total_estimado || 0,
                        receta_ids: eventoSeleccionado.receta_ids || [],
                        proveedor_ids: eventoSeleccionado.proveedor_ids || [],
                        equipo_ids: eventoSeleccionado.equipo_ids || [],
                        cotizacion_id: eventoSeleccionado.id_cotizacion || null
                      });
                    }
                  }}
                >
                  <option value="">Selecciona un evento</option>
                  {(data?.eventos || []).map((item) => {
                    const fechaFormato = item.fecha_evento ? formatDate(item.fecha_evento) : 'Sin fecha';
                    // Obtener nombre desde cotización primero, luego evento, fallback a cliente
                    const cotizacionRelacionada = item.id_cotizacion ? (data?.cotizaciones || []).find((c) => c.id_cotizacion === item.id_cotizacion) : null;
                    const nombreDesdeEvento = cleanEventName(item.nombre_evento);
                    const nombreDesdeCotizacion = cotizacionRelacionada ? cleanEventName(cotizacionRelacionada.nombre_evento) : '';
                    const nombreEvento = nombreDesdeCotizacion || nombreDesdeEvento || item.nombre_cliente || 'Sin nombre';
                    return (
                      <option key={`operacion-evento-${item.id_evento}`} value={item.id_evento}>
                        {nombreEvento} · {fechaFormato} · {item.numero_personas} personas
                      </option>
                    );
                  })}
                </select>
              </label>
              <label>
                <span>Estatus del evento al guardar</span>
                <select
                  value={operacionForm.actualizar_estatus_evento || 'cotizando'}
                  onChange={(event) => setOperacionForm((current) => ({ ...current, actualizar_estatus_evento: event.target.value }))}
                  disabled={ticketLiquidado}
                >
                  {CATERING_EVENT_STATUSES.map((status) => (
                    <option key={status} value={status}>
                      {getStatusLabel(status)}
                    </option>
                  ))}
                </select>
              </label>
              
              {/* Mostrar datos del cliente heredados automáticamente */}
              {operacionForm.nombre_cliente && (
                <>
                  <label>
                    <span>👤 Cliente</span>
                    <input
                      value={operacionForm.nombre_cliente}
                      readOnly
                      style={{ backgroundColor: '#f3f4f6', cursor: 'default' }}
                    />
                  </label>
                  <label>
                    <span>📞 Teléfono</span>
                    <input
                      value={operacionForm.telefono_cliente}
                      readOnly
                      style={{ backgroundColor: '#f3f4f6', cursor: 'default' }}
                    />
                  </label>
                  <label>
                    <span>📧 Correo</span>
                    <input
                      value={operacionForm.correo_cliente}
                      readOnly
                      style={{ backgroundColor: '#f3f4f6', cursor: 'default' }}
                    />
                  </label>
                </>
              )}
            </div>

            {eventoOperacion && (
              <div style={eventDetailStyles.card}>
                <div style={eventDetailStyles.header}>
                  <h4 style={eventDetailStyles.title}>{String(eventoOperacion.nombre_evento || '').split(/\s*--meta:/)[0].trim()}</h4>
                  <span style={{...eventDetailStyles.statusPill, backgroundColor: getStatusColor(eventoOperacion.estatus)}}>{getStatusLabel(eventoOperacion.estatus)}</span>
                </div>
                
                <div style={eventDetailStyles.section}>
                  <h5 style={eventDetailStyles.sectionTitle}>👤 Datos del Cliente</h5>
                  <div style={eventDetailStyles.grid2}>
                    <div>
                      <small style={eventDetailStyles.label}>Cliente</small>
                      <p style={eventDetailStyles.value}>{eventoOperacion.nombre_cliente || 'Sin cliente'}</p>
                    </div>
                    <div>
                      <small style={eventDetailStyles.label}>Teléfono</small>
                      <p style={eventDetailStyles.value}>{eventoOperacion.telefono_cliente || '—'}</p>
                    </div>
                    <div style={{gridColumn: 'span 2'}}>
                      <small style={eventDetailStyles.label}>Correo</small>
                      <p style={eventDetailStyles.value}>{eventoOperacion.correo_cliente || '—'}</p>
                    </div>
                  </div>
                </div>

                <div style={eventDetailStyles.section}>
                  <h5 style={eventDetailStyles.sectionTitle}>📍 Detalles del Evento</h5>
                  <div style={eventDetailStyles.grid2}>
                    <div>
                      <small style={eventDetailStyles.label}>Fecha</small>
                      <p style={eventDetailStyles.value}>{formatDate(eventoOperacion.fecha_evento)}</p>
                    </div>
                    <div>
                      <small style={eventDetailStyles.label}>Personas</small>
                      <p style={eventDetailStyles.value}>{eventoOperacion.numero_personas}</p>
                    </div>
                    <div style={{gridColumn: 'span 2'}}>
                      <small style={eventDetailStyles.label}>Lugar</small>
                      <p style={eventDetailStyles.value}>{eventoOperacion.lugar_evento || '—'}</p>
                    </div>
                    <div style={{gridColumn: 'span 2'}}>
                      <small style={eventDetailStyles.label}>Dirección</small>
                      <p style={eventDetailStyles.value}>{eventoOperacion.direccion_evento || '—'}</p>
                    </div>
                    <div style={{gridColumn: 'span 2'}}>
                      <small style={eventDetailStyles.label}>Referencia</small>
                      <p style={eventDetailStyles.value}>{eventoOperacion.referencia_evento || '—'}</p>
                    </div>
                    <div style={{gridColumn: 'span 2'}}>
                      <small style={eventDetailStyles.label}>¿Cuándo liquida?</small>
                      <p style={eventDetailStyles.value}>{eventoOperacion.momento_liquidacion || '—'}</p>
                    </div>
                  </div>
                </div>

                <div style={{
                  ...eventDetailStyles.section,
                  backgroundColor: '#f8fafc',
                  border: '2px solid #e2e8f0',
                  borderRadius: '8px',
                  padding: '16px'
                }}>
                  <h5 style={{...eventDetailStyles.sectionTitle, color: '#0f172a', marginBottom: '12px'}}>💰 Resumen Financiero</h5>
                  <div style={eventDetailStyles.financialGrid}>
                    <div style={{...eventDetailStyles.financialBox, backgroundColor: '#ffffff', border: '1px solid #e5e7eb'}}>
                      <small style={{...eventDetailStyles.label, color: '#6b7280'}}>Total Estimado</small>
                      <p style={{...eventDetailStyles.value, fontSize: '22px', fontWeight: '800', color: '#1f2937'}}>
                        {formatCurrency(eventoOperacion.total_estimado)}
                      </p>
                    </div>
                    <div style={{...eventDetailStyles.financialBox, backgroundColor: '#ecfdf5', border: '2px solid #10b981'}}>
                      <small style={{...eventDetailStyles.label, color: '#059669', fontWeight: '600'}}>✓ Pagado</small>
                      <p style={{...eventDetailStyles.value, fontSize: '22px', fontWeight: '800', color: '#059669'}}>
                        {formatCurrency(eventoOperacion.anticipo_pagado)}
                      </p>
                      <small style={{fontSize: '11px', color: '#059669'}}>
                        ({Math.min(100, Math.round((eventoOperacion.anticipo_pagado / (eventoOperacion.total_estimado || 1)) * 100))}% del total)
                      </small>
                    </div>
                    <div style={{...eventDetailStyles.financialBox, backgroundColor: '#fef2f2', border: '2px solid #ef4444'}}>
                      <small style={{...eventDetailStyles.label, color: '#991b1b', fontWeight: '600'}}>⚠ Pendiente</small>
                      <p style={{...eventDetailStyles.value, fontSize: '22px', fontWeight: '800', color: '#991b1b'}}>
                        {formatCurrency(eventoOperacion.saldo_pendiente)}
                      </p>
                      <small style={{fontSize: '11px', color: '#991b1b'}}>
                        ({Math.min(100, Math.round((eventoOperacion.saldo_pendiente / (eventoOperacion.total_estimado || 1)) * 100))}% del total)
                      </small>
                    </div>
                  </div>
                  
                  {eventoOperacion.total_estimado > 0 && (
                    <div style={{marginTop: '16px', paddingTop: '12px', borderTop: '1px solid #e5e7eb'}}>
                      <div style={{display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '13px', fontWeight: '700'}}>
                        <span style={{color: '#1f2937'}}>Progreso de Pago</span>
                        <span style={{color: '#10b981'}}>{Math.min(100, Math.round((eventoOperacion.anticipo_pagado / eventoOperacion.total_estimado) * 100))}%</span>
                      </div>
                      <div style={{backgroundColor: '#e5e7eb', borderRadius: '6px', height: '8px', overflow: 'hidden', boxShadow: '0 1px 2px rgba(0,0,0,0.05)'}}>
                        <div
                          style={{
                            backgroundColor: '#10b981',
                            height: '100%',
                            width: `${Math.min(100, Math.round((eventoOperacion.anticipo_pagado / eventoOperacion.total_estimado) * 100))}%`,
                            transition: 'width 0.3s'
                          }}
                        />
                      </div>
                    </div>
                  )}
                </div>

                <div style={eventDetailStyles.actions}>
                  <button type="button" style={eventDetailStyles.btn} onClick={() => abrirCorreoSeguimiento(eventoOperacion, selectedOperacion)}>
                    📧 Enviar correo
                  </button>
                  <button type="button" style={eventDetailStyles.btn} onClick={() => abrirWhatsAppSeguimiento(eventoOperacion, selectedOperacion)}>
                    💬 Enviar WhatsApp
                  </button>
                </div>
              </div>
            )}

            <div className="form-grid-fields" style={{ marginTop: '16px' }}>
              <label>
                <span>Ticket (Auto-generado)</span>
                <input
                  value={operacionForm.ticket_codigo}
                  placeholder="Se genera automáticamente al guardar"
                  readOnly
                  disabled={ticketLiquidado}
                  style={{ backgroundColor: '#f3f4f6', cursor: 'default' }}
                />
              </label>
              <label>
                <span>Responsable</span>
                <input
                  value={operacionForm.responsable_ticket}
                  onChange={(event) => setOperacionForm((current) => ({ ...current, responsable_ticket: event.target.value }))}
                  placeholder="Encargado del ticket"
                  disabled={ticketLiquidado}
                />
              </label>
              <label>
                <span>Estatus del ticket</span>
                <select
                  value={operacionForm.estatus_ticket}
                  onChange={(event) => setOperacionForm((current) => ({ ...current, estatus_ticket: event.target.value }))}
                >
                  {CATERING_TICKET_STATUSES.map((status) => (
                    <option key={status} value={status}>
                      {getStatusLabel(status)}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span>Tipo de ticket</span>
                <select
                  value={operacionForm.tipo_ticket}
                  onChange={(event) => setOperacionForm((current) => ({ ...current, tipo_ticket: event.target.value }))}
                >
                  {CATERING_TICKET_TYPES.map((type) => (
                    <option key={type} value={type}>
                      {getStatusLabel(type)}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span>Método de pago</span>
                <select
                  value={operacionForm.metodo_pago}
                  onChange={(event) => setOperacionForm((current) => ({ ...current, metodo_pago: event.target.value }))}
                >
                  {CATERING_METODOS_PAGO.map((m) => (
                    <option key={m} value={m}>{m.charAt(0).toUpperCase() + m.slice(1)}</option>
                  ))}
                </select>
              </label>
              <label>
                <span>Monto del ticket</span>
                <input
                  type="number"
                  step="0.01"
                  value={operacionForm.monto_ticket}
                  onChange={(event) => setOperacionForm((current) => ({ ...current, monto_ticket: event.target.value }))}
                />
              </label>
              <label>
                <span>Fecha compromiso</span>
                <input
                  type="date"
                  value={operacionForm.fecha_compromiso}
                  onChange={(event) => setOperacionForm((current) => ({ ...current, fecha_compromiso: event.target.value }))}
                />
              </label>
              <label>
                <span>Canal de contacto</span>
                <select
                  value={operacionForm.canal_contacto}
                  onChange={(event) => setOperacionForm((current) => ({ ...current, canal_contacto: event.target.value }))}
                >
                  <option value="whatsapp">WhatsApp</option>
                  <option value="correo">Correo</option>
                  <option value="llamada">Llamada</option>
                </select>
              </label>
              {operacionForm.metodo_pago === 'tarjeta' && (
                <label className="field-span-2">
                  <span>Referencia de tarjeta</span>
                  <input
                    value={operacionForm.datos_tarjeta}
                    onChange={(event) => setOperacionForm((current) => ({ ...current, datos_tarjeta: event.target.value }))}
                    placeholder="Últimos 4 dígitos, referencia de terminal, etc."
                  />
                </label>
              )}
              <label className="field-span-2">
                <span>Observaciones</span>
                <textarea
                  rows="3"
                  value={operacionForm.observaciones}
                  onChange={(event) => setOperacionForm((current) => ({ ...current, observaciones: event.target.value }))}
                  placeholder="Detalle del pago o solicitud especial"
                />
              </label>
            </div>
          </div>

          <div className="almacen-subpanel">
            <div className="almacen-subpanel-header">
              <h3>Detalle del ticket</h3>
              <span>{selectedOperacion ? 'Ticket seleccionado' : 'Vista previa'}</span>
            </div>
            {selectedOperacion ? (
              <div className="detail-card">
                <strong>{selectedOperacion.ticket_codigo || `Ticket ${selectedOperacion.id_control_cat}`}</strong>
                <span>{selectedOperacion.evento_nombre}</span>
                <span>{selectedOperacion.responsable_ticket || 'Sin responsable'} · {selectedOperacion.solicitado_por || 'Sin solicitante'}</span>
                <span>{getStatusLabel(selectedOperacion.tipo_ticket)} · {formatCurrency(selectedOperacion.monto_ticket)} · {selectedOperacion.metodo_pago || 'Sin método'}</span>
                <span>{selectedOperacion.fecha_compromiso ? formatDate(selectedOperacion.fecha_compromiso) : 'Sin fecha compromiso'}</span>
                {selectedOperacion.datos_tarjeta && <span>Ref. tarjeta: {selectedOperacion.datos_tarjeta}</span>}
                <small className={`status-pill ${getStatusClass(selectedOperacion.estatus_ticket)}`}>{getStatusLabel(selectedOperacion.estatus_ticket)}</small>

                {/* Información de contacto del cliente */}
                {(() => {
                  const metadata = parseTicketMetadata(selectedOperacion.observaciones);
                  return (
                    <div style={{
                      marginTop: '12px',
                      padding: '12px',
                      backgroundColor: '#f0fdf4',
                      borderRadius: '6px',
                      borderLeft: '4px solid #10b981'
                    }}>
                      <div style={{fontSize: '13px', fontWeight: '600', color: '#1f2937', marginBottom: '8px'}}>📞 Contacto del Cliente</div>
                      <div style={{fontSize: '12px', color: '#4b5563', lineHeight: '1.6'}}>
                        {metadata.clientePhone && <div><strong>Teléfono:</strong> {metadata.clientePhone}</div>}
                        {metadata.clienteEmail && <div><strong>Correo:</strong> {metadata.clienteEmail}</div>}
                        {metadata.lugarEvento && <div><strong>Lugar:</strong> {metadata.lugarEvento}</div>}
                        {!metadata.clientePhone && !metadata.clienteEmail && <div style={{color: '#9ca3af'}}>Sin información de contacto</div>}
                      </div>
                    </div>
                  );
                })()}
              </div>
            ) : (
              <p className="panel-empty">Selecciona un ticket para editarlo o crea uno nuevo.</p>
            )}
          </div>

          {seleccion.evento && (
            <div className="almacen-subpanel">
              <div className="almacen-subpanel-header">
                <h3>✏️ Editar datos del evento</h3>
                <span>Actualiza el evento directamente desde Checklist</span>
              </div>
              <div className="form-grid-fields">
                <label>
                  <span>Nombre del evento</span>
                  <input
                    value={eventoFormChecklist.nombre_evento}
                    onChange={(event) => setEventoFormChecklist((current) => ({ ...current, nombre_evento: event.target.value }))}
                    placeholder="Nombre del evento"
                  />
                </label>
                <label>
                  <span>Fecha</span>
                  <input
                    type="date"
                    value={eventoFormChecklist.fecha_evento}
                    onChange={(event) => setEventoFormChecklist((current) => ({ ...current, fecha_evento: event.target.value }))}
                  />
                </label>
                <label>
                  <span>Personas</span>
                  <input
                    type="number"
                    value={eventoFormChecklist.numero_personas}
                    onChange={(event) => setEventoFormChecklist((current) => ({ ...current, numero_personas: event.target.value }))}
                  />
                </label>
                <label>
                  <span>Estatus del evento</span>
                  <select
                    value={eventoFormChecklist.estatus_evento}
                    onChange={(event) => setEventoFormChecklist((current) => ({ ...current, estatus_evento: event.target.value }))}
                  >
                    {CATERING_EVENT_STATUSES.map((status) => (
                      <option key={status} value={status}>
                        {getStatusLabel(status)}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  <span>Cliente</span>
                  <input
                    value={eventoFormChecklist.nombre_cliente}
                    onChange={(event) => setEventoFormChecklist((current) => ({ ...current, nombre_cliente: event.target.value }))}
                    placeholder="Nombre del cliente"
                  />
                </label>
                <label>
                  <span>Teléfono</span>
                  <input
                    value={eventoFormChecklist.telefono_cliente}
                    onChange={(event) => setEventoFormChecklist((current) => ({ ...current, telefono_cliente: event.target.value }))}
                    placeholder="Teléfono del cliente"
                  />
                </label>
                <label>
                  <span>Correo</span>
                  <input
                    type="email"
                    value={eventoFormChecklist.correo_cliente}
                    onChange={(event) => setEventoFormChecklist((current) => ({ ...current, correo_cliente: event.target.value }))}
                    placeholder="Email del cliente"
                  />
                </label>
                <label>
                  <span>Lugar</span>
                  <input
                    value={eventoFormChecklist.lugar_evento}
                    onChange={(event) => setEventoFormChecklist((current) => ({ ...current, lugar_evento: event.target.value }))}
                    placeholder="Lugar del evento"
                  />
                </label>
                <label className="field-span-2">
                  <span>Dirección</span>
                  <input
                    value={eventoFormChecklist.direccion_evento}
                    onChange={(event) => setEventoFormChecklist((current) => ({ ...current, direccion_evento: event.target.value }))}
                    placeholder="Dirección completa"
                  />
                </label>
                <label className="field-span-2">
                  <span>Referencia</span>
                  <input
                    value={eventoFormChecklist.referencia_evento}
                    onChange={(event) => setEventoFormChecklist((current) => ({ ...current, referencia_evento: event.target.value }))}
                    placeholder="Entre calles, acceso, indicaciones"
                  />
                </label>
                <label>
                  <span>Cuándo liquida</span>
                  <input
                    value={eventoFormChecklist.momento_liquidacion}
                    onChange={(event) => setEventoFormChecklist((current) => ({ ...current, momento_liquidacion: event.target.value }))}
                    placeholder="Ej. Antes del evento, al terminar"
                  />
                </label>
              </div>
              <div className="module-actions" style={{ marginTop: '12px' }}>
                <button type="button" className="module-action-button success" onClick={handleGuardarEventoDesdeChecklist} disabled={isSavingModule}>
                  {isSavingModule ? 'Guardando...' : '✓ Guardar evento'}
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="almacen-subpanel">
          <div className="almacen-subpanel-header">
            <h3>Historial de pagos y tickets</h3>
            <span>{historialFiltrado.length} movimientos</span>
          </div>

          <div className="period-filter-shell">
            <div className="period-filter-row">
              <button
                type="button"
                className={`module-action-button period-filter-button ${historialFiltro.periodo === 'semana' && !historialFiltro.fechaInicio && !historialFiltro.fechaFin ? 'active' : ''}`}
                onClick={() => setHistorialFiltro({ periodo: 'semana', fechaInicio: '', fechaFin: '' })}
              >
                Semana
              </button>
              <button
                type="button"
                className={`module-action-button period-filter-button ${historialFiltro.periodo === 'mes' && !historialFiltro.fechaInicio && !historialFiltro.fechaFin ? 'active' : ''}`}
                onClick={() => setHistorialFiltro({ periodo: 'mes', fechaInicio: '', fechaFin: '' })}
              >
                Mes
              </button>
              <button
                type="button"
                className={`module-action-button period-filter-button ${historialFiltro.periodo === 'anio' && !historialFiltro.fechaInicio && !historialFiltro.fechaFin ? 'active' : ''}`}
                onClick={() => setHistorialFiltro({ periodo: 'anio', fechaInicio: '', fechaFin: '' })}
              >
                Año
              </button>
            </div>
            <div className="module-actions">
              <button type="button" className="module-action-button success" onClick={exportarHistorialCateringCsv}>
                Descargar Excel
              </button>
              <button type="button" className="module-action-button" onClick={exportarHistorialCateringPdf}>
                Descargar PDF
              </button>
            </div>
          </div>

          <div className="form-grid-fields">
            <label>
              <span>Fecha inicio</span>
              <input
                type="date"
                value={historialFiltro.fechaInicio}
                onChange={(event) => setHistorialFiltro((current) => ({ ...current, fechaInicio: event.target.value }))}
              />
            </label>
            <label>
              <span>Fecha fin</span>
              <input
                type="date"
                value={historialFiltro.fechaFin}
                onChange={(event) => setHistorialFiltro((current) => ({ ...current, fechaFin: event.target.value }))}
              />
            </label>
          </div>

          <div className="mini-list compact-list">
            {historialFiltrado.map((item) => (
              <div className="mini-item" key={item.id}>
                <strong>{item.concepto}</strong>
                <span>{item.detalle}</span>
                <span>{item.responsable} · {item.fecha_label}</span>
                <em>{item.total_label}</em>
              </div>
            ))}
            {!historialFiltrado.length && <p className="panel-empty">Sin movimientos en el periodo seleccionado.</p>}
          </div>
        </div>

        <div className="almacen-subpanel">
          <div className="almacen-subpanel-header">
            <h3>Tickets registrados</h3>
            <span>{data?.salidas?.length || 0} movimientos</span>
          </div>
          <div className="mini-list compact-list">
            {(data?.salidas || []).map((item) => (
              <button
                type="button"
                className={`mini-item selectable-item ${seleccion.operacion === item.id_control_cat ? 'selected' : ''}`}
                key={item.id_control_cat}
                onClick={() => handleSelectOperacion(item)}
              >
                <strong>{item.ticket_codigo || `Ticket ${item.id_control_cat}`} · {item.evento_nombre}</strong>
                <span>{getStatusLabel(item.tipo_ticket)} · {formatCurrency(item.monto_ticket)} · {item.metodo_pago || 'Sin método'}</span>
                <span>{item.responsable_ticket || 'Sin responsable'} · {item.fecha_compromiso ? formatDate(item.fecha_compromiso) : 'Sin fecha'}</span>
                <small className={`status-pill ${getStatusClass(item.estatus_ticket)}`}>{getStatusLabel(item.estatus_ticket)}</small>
              </button>
            ))}
          </div>
        </div>
        </div>
        )}

        {operacionTab === 'movimientos' && (
        <div className="almacen-layout">
          {(() => {
            const catalogoInsumos = almacenCompras?.catalogo || [];
            const eventos = data?.eventos || [];
            const movimientos = movimientosCatData?.movimientos || [];
            const tiposCatering = TIPOS_SALIDA.filter((t) => t.scope === 'catering' || t.scope === 'ambos');

            return (
              <div className="almacen-module-container">
                <section className="almacen-section">
                  <div className="almacen-subpanel spotlight-panel">
                    <div className="almacen-subpanel-header">
                      <h3>Registrar salida de insumo</h3>
                      <span>Uso en evento · Merma · Prestado · Utilería · Renta · Daños y pérdidas</span>
                    </div>
                    {(salidaCatMessage || salidaCatError) && (
                      <div className={`operation-banner ${salidaCatError ? 'error' : 'success'}`}>
                        {salidaCatError || salidaCatMessage}
                      </div>
                    )}
                    <div className="form-grid-fields">
                      <label>
                        <span>Tipo de salida</span>
                        <select
                          value={salidaCatForm.tipoDetalle}
                          onChange={(e) => setSalidaCatForm((prev) => ({ ...prev, tipoDetalle: e.target.value }))}
                        >
                          {tiposCatering.map((t) => (
                            <option key={t.value} value={t.value}>{t.label}</option>
                          ))}
                        </select>
                      </label>
                      <label>
                        <span>Tipo de proveedor</span>
                        <select
                          value={salidaCatForm.tipoProveedor}
                          onChange={(e) => setSalidaCatForm((prev) => ({ ...prev, tipoProveedor: e.target.value }))}
                        >
                          <option value="interno">Interno (stock propio)</option>
                          <option value="externo_alquiler">Externo - Alquiler equipo</option>
                          <option value="externo_servicio">Externo - Servicio prestado</option>
                        </select>
                      </label>
                      <label>
                        <span>Insumo</span>
                        <select
                          value={salidaCatForm.idInsumo}
                          onChange={(e) => setSalidaCatForm((prev) => ({ ...prev, idInsumo: e.target.value }))}
                        >
                          <option value="">Selecciona un insumo</option>
                          {catalogoInsumos
                            .slice()
                            .sort((a, b) => String(a.nombre_item).localeCompare(String(b.nombre_item), 'es'))
                            .map((item) => (
                              <option key={`cat-sal-${item.id_item}`} value={item.id_item}>
                                {item.nombre_item} · stock {item.stock_actual} {item.unidad_consumo}
                              </option>
                            ))}
                        </select>
                      </label>
                      <label>
                        <span>Cantidad</span>
                        <input
                          type="number"
                          min="0.001"
                          step="0.001"
                          placeholder="0.000"
                          value={salidaCatForm.cantidad}
                          onChange={(e) => setSalidaCatForm((prev) => ({ ...prev, cantidad: e.target.value }))}
                        />
                      </label>
                      {salidaCatForm.tipoProveedor !== 'interno' && (
                        <>
                          <label>
                            <span>Equipo de renta / Artículo</span>
                            <input
                              type="text"
                              placeholder="Ej: Sillas, mesas, vajilla, decoración..."
                              value={salidaCatForm.equipoRenta}
                              onChange={(e) => setSalidaCatForm((prev) => ({ ...prev, equipoRenta: e.target.value }))}
                            />
                          </label>
                          <label>
                            <span>Condición del equipo</span>
                            <select
                              value={salidaCatForm.condicionEquipo}
                              onChange={(e) => setSalidaCatForm((prev) => ({ ...prev, condicionEquipo: e.target.value }))}
                            >
                              <option value="ok">✓ En perfecto estado</option>
                              <option value="parcial">⚠ Parcialmente dañado</option>
                              <option value="dañado">✗ Dañado</option>
                              <option value="roto">✗✗ Roto</option>
                              <option value="perdido">!! Perdido</option>
                            </select>
                          </label>
                        </>
                      )}
                      {salidaCatForm.tipoDetalle === 'uso_evento' && (
                        <label>
                          <span>Evento</span>
                          <select
                            value={salidaCatForm.idEvento}
                            onChange={(e) => setSalidaCatForm((prev) => ({ ...prev, idEvento: e.target.value }))}
                          >
                            <option value="">Sin evento vinculado</option>
                            {eventos.map((ev) => (
                              <option key={`cat-ev-${ev.id_evento}`} value={ev.id_evento}>
                                {cleanEventName(ev.nombre_evento) || `Evento #${ev.id_evento}`}
                              </option>
                            ))}
                          </select>
                        </label>
                      )}
                      <label>
                        <span>Motivo / Nota rápida</span>
                        <input
                          type="text"
                          placeholder="Ej: Boda García, equipo prestado a otro evento..."
                          value={salidaCatForm.motivo}
                          onChange={(e) => setSalidaCatForm((prev) => ({ ...prev, motivo: e.target.value }))}
                        />
                      </label>
                      <label>
                        <span>Responsable</span>
                        <input
                          type="text"
                          placeholder={user.nombre_completo || 'Nombre'}
                          value={salidaCatForm.responsable}
                          onChange={(e) => setSalidaCatForm((prev) => ({ ...prev, responsable: e.target.value }))}
                        />
                      </label>
                      <label className="field-span-2">
                        <span>Observaciones detalladas</span>
                        <textarea
                          rows="3"
                          placeholder="Ej: Mesa se rompió durante montaje. Falta una silla. Rotura de vajilla..."
                          value={salidaCatForm.observacionesDetalladas}
                          onChange={(e) => setSalidaCatForm((prev) => ({ ...prev, observacionesDetalladas: e.target.value }))}
                        />
                      </label>
                      <label className="field-span-2">
                        <span>Fecha y hora</span>
                        <input
                          type="datetime-local"
                          value={salidaCatForm.fechaRegistro}
                          onChange={(e) => setSalidaCatForm((prev) => ({ ...prev, fechaRegistro: e.target.value }))}
                        />
                      </label>
                    </div>
                    <div className="module-actions">
                      <button
                        type="button"
                        className="module-action-button primary"
                        onClick={handleGuardarSalidaCatering}
                        disabled={isSavingSalidaCat || !salidaCatForm.idInsumo || !salidaCatForm.cantidad}
                      >
                        {isSavingSalidaCat ? 'Registrando...' : 'Registrar salida'}
                      </button>
                    </div>
                  </div>
                </section>

                <section className="almacen-section">
                  <div className="almacen-subpanel">
                    <div className="almacen-subpanel-header">
                      <h3>Historial de movimientos</h3>
                      <span>{movimientos.length} registros</span>
                    </div>
                    <div className="form-grid-fields">
                      <label>
                        <span>Período</span>
                        <select
                          value={movimientosCatFiltro.periodo}
                          onChange={(e) => setMovimientosCatFiltro((prev) => ({ ...prev, periodo: e.target.value }))}
                        >
                          <option value="hoy">Hoy</option>
                          <option value="semana">Esta semana</option>
                          <option value="mes">Este mes</option>
                          <option value="personalizado">Personalizado</option>
                        </select>
                      </label>
                      {movimientosCatFiltro.periodo === 'personalizado' && (
                        <>
                          <label>
                            <span>Desde (fecha)</span>
                            <input
                              type="date"
                              value={movimientosCatFiltro.fechaInicio}
                              onChange={(e) => setMovimientosCatFiltro((prev) => ({ ...prev, fechaInicio: e.target.value }))}
                            />
                          </label>
                          <label>
                            <span>Desde (hora)</span>
                            <input
                              type="time"
                              value={movimientosCatFiltro.horaInicio}
                              onChange={(e) => setMovimientosCatFiltro((prev) => ({ ...prev, horaInicio: e.target.value }))}
                            />
                          </label>
                          <label>
                            <span>Hasta (fecha)</span>
                            <input
                              type="date"
                              value={movimientosCatFiltro.fechaFin}
                              onChange={(e) => setMovimientosCatFiltro((prev) => ({ ...prev, fechaFin: e.target.value }))}
                            />
                          </label>
                          <label>
                            <span>Hasta (hora)</span>
                            <input
                              type="time"
                              value={movimientosCatFiltro.horaFin}
                              onChange={(e) => setMovimientosCatFiltro((prev) => ({ ...prev, horaFin: e.target.value }))}
                            />
                          </label>
                        </>
                      )}
                    </div>
                    {movimientosCatError && <p className="panel-empty">{movimientosCatError}</p>}
                    {!movimientosCatError && movimientos.length === 0 && (
                      <p className="panel-empty">Sin movimientos en el período seleccionado.</p>
                    )}
                    {movimientos.length > 0 && (
                      <table className="recetario-table" style={{ fontSize: '13px' }}>
                        <thead>
                          <tr>
                            <th>Fecha y Hora</th>
                            <th>Insumo</th>
                            <th>Tipo</th>
                            <th>Cantidad</th>
                            <th>Proveedor</th>
                            <th>Equipo/Artículo</th>
                            <th>Condición</th>
                            <th>Responsable</th>
                            <th>Observaciones</th>
                          </tr>
                        </thead>
                        <tbody>
                          {movimientos.map((mov, idx) => {
                            const fechaHora = mov.fecha_registro 
                              ? new Date(mov.fecha_registro).toLocaleString('es-MX') 
                              : '—';
                            const getProveedorLabel = (tipo) => {
                              if (tipo === 'externo_alquiler') return '🏪 Alquiler';
                              if (tipo === 'externo_servicio') return '👥 Servicio';
                              return '📦 Interno';
                            };
                            const getCondicionIcon = (condicion) => {
                              if (condicion === 'perdido') return '❌❌';
                              if (condicion === 'roto') return '❌';
                              if (condicion === 'dañado') return '⚠️';
                              if (condicion === 'parcial') return '⚠️';
                              return '✓';
                            };
                            return (
                              <tr key={`cat-mov-${mov.id_mov_inv || idx}`}>
                                <td>{fechaHora}</td>
                                <td><strong>{mov.nombre_item || mov.id_insumo}</strong></td>
                                <td>{mov.tipo_detalle || mov.tipo_operacion || '—'}</td>
                                <td>{mov.cantidad} {mov.unidad_consumo || ''}</td>
                                <td>{getProveedorLabel(mov.tipo_proveedor)}</td>
                                <td>{mov.equipo_renta || '—'}</td>
                                <td>{getCondicionIcon(mov.condicion_equipo)} {mov.condicion_equipo || '—'}</td>
                                <td>{mov.responsable || '—'}</td>
                                <td style={{ maxWidth: '200px', wordBreak: 'break-word' }}>
                                  {mov.observaciones_detalladas ? (
                                    <span title={mov.observaciones_detalladas}>
                                      {mov.observaciones_detalladas.substring(0, 40)}...
                                    </span>
                                  ) : (
                                    mov.motivo || '—'
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    )}
                    {movimientos.length > 0 && (
                      <div className="module-actions" style={{ marginTop: '16px' }}>
                        <button
                          type="button"
                          className="module-action-button success"
                          onClick={exportarMovimientosCateringExcel}
                        >
                          📊 Descargar Excel
                        </button>
                        <button
                          type="button"
                          className="module-action-button"
                          onClick={exportarMovimientosCateringPdf}
                        >
                          📄 Descargar PDF
                        </button>
                      </div>
                    )}
                  </div>
                </section>
              </div>
            );
          })()}
        </div>
        )}
      </div>
    );
  }

  function renderConfiguracionCatering() {
    return (
      <div className="almacen-layout">
        {isNuevoUsuarioSection && (
          <div className="almacen-subpanel">
            <div className="almacen-subpanel-header">
              <h3>Alta de usuarios catering</h3>
              <span>Gerentes y trabajadores del negocio catering</span>
            </div>
            {(userMessage || userFormError) && (
              <div className={`operation-banner ${userFormError ? 'error' : 'success'}`}>{userFormError || userMessage}</div>
            )}
            <div className="form-grid-fields">
              <label>
                <span>Ámbito</span>
                <input value="Catering" readOnly />
              </label>
              <label>
                <span>Tipo de usuario</span>
                <select
                  value={userForm.tipoUsuario}
                  onChange={(event) => setUserForm((current) => ({ ...current, tipoUsuario: event.target.value }))}
                >
                  <option value="trabajador">Trabajador</option>
                  <option value="gerente">Gerente</option>
                </select>
              </label>
              <label>
                <span>Nombre completo</span>
                <input
                  value={userForm.nombre_completo}
                  onChange={(event) => setUserForm((current) => ({ ...current, nombre_completo: event.target.value }))}
                />
              </label>
              <label>
                <span>Correo</span>
                <input
                  value={userForm.correo}
                  onChange={(event) => setUserForm((current) => ({ ...current, correo: event.target.value }))}
                />
              </label>
              <label>
                <span>Contraseña</span>
                <input
                  type="text"
                  value={userForm.contrasena}
                  onChange={(event) => setUserForm((current) => ({ ...current, contrasena: event.target.value }))}
                />
              </label>
              <label>
                <span>Teléfono</span>
                <input
                  value={userForm.telefono}
                  onChange={(event) => setUserForm((current) => ({ ...current, telefono: event.target.value }))}
                />
              </label>
            </div>
            <div className="module-actions">
              <button
                type="button"
                className="module-action-button success"
                onClick={handleGuardarUsuarioCatering}
                disabled={isSavingUser}
              >
                {isSavingUser ? 'Guardando...' : 'Guardar usuario'}
              </button>
            </div>
          </div>
        )}

        <div className="almacen-subpanel-grid configuracion-modelo-grid">
          <div className="almacen-subpanel">
            <div className="almacen-subpanel-header">
              <h3>Configuración de catering</h3>
              <span>Nombre y foto del negocio</span>
            </div>
            {(businessConfigMessage || businessConfigError) && (
              <div className={`operation-banner ${businessConfigError ? 'error' : 'success'}`}>
                {businessConfigError || businessConfigMessage}
              </div>
            )}
            <div className="form-grid-fields">
              <label>
                <span>Nombre del negocio</span>
                <input
                  value={businessConfigForm.nombre_negocio}
                  onChange={(event) => setBusinessConfigForm((current) => ({ ...current, nombre_negocio: event.target.value }))}
                />
              </label>
              <label>
                <span>Tipo de negocio</span>
                <input value="Catering" readOnly />
              </label>
            </div>
            <div className="recipe-image-upload-row">
              <label className="recipe-upload-box">
                Subir foto de catering
                <input type="file" accept="image/*" onChange={handleBusinessPhotoChange} />
              </label>
              {businessConfigForm.logo_preview && (
                <button type="button" className="module-action-button" onClick={limpiarBusinessPhoto}>
                  Quitar foto
                </button>
              )}
            </div>
            {businessConfigForm.logo_preview ? (
              <img src={businessConfigForm.logo_preview} alt="Catering" className="recipe-image form-preview-image" />
            ) : (
              <div className="image-placeholder-card compact-placeholder">
                Puedes cargar una foto o logo de catering. La imagen se guarda en este equipo para identificar el negocio.
              </div>
            )}
            <div className="module-actions">
              <button
                type="button"
                className="module-action-button success"
                onClick={handleGuardarConfiguracionCatering}
                disabled={isSavingBusinessConfig}
              >
                {isSavingBusinessConfig ? 'Guardando...' : 'Guardar configuración'}
              </button>
            </div>
          </div>

          {usuariosError ? (
            <p className="panel-empty">No se pudieron cargar usuarios catering: {usuariosError}</p>
          ) : (
            <BusinessUsersTable
              title="Todos los usuarios de catering"
              subtitle="Se muestran solo el dueño, gerentes y trabajadores del negocio catering actual."
              emptyMessage="No hay usuarios visibles en este negocio de catering."
              users={usuarios}
              scope="catering"
              actionLabel="Eliminar usuario"
              onAction={handleEliminarUsuarioCatering}
              isActionDisabled={(item) => item.id_usuario === user?.id_usuario}
            />
          )}
        </div>
      </div>
    );
  }

  function renderConfiguracionCateringSummary() {
    return (
      <div className="quick-list">
        <div className="quick-item">
          <div>
            <strong>Usuarios visibles</strong>
            <span>Personal y dueños clasificados dentro de catering.</span>
          </div>
          <em>{usuarios.length}</em>
        </div>
        <div className="quick-item">
          <div>
            <strong>Alta habilitada</strong>
            <span>Puedes crear trabajadores o dueños nuevos para catering.</span>
          </div>
          <em>Activa</em>
        </div>
      </div>
    );
  }

  function renderOverview() {
    if (error) {
      return <p className="panel-empty">No se pudo cargar catering: {error}</p>;
    }

    if (!data) {
      return <p className="panel-empty">Cargando información de catering...</p>;
    }

    // Obtener datos del recetario y almacén
    const recetas = catalogos?.recetas || [];
    const catalogoItems = almacenCompras?.catalogo || [];
    
    // Calcular items con stock bajo (urgentes)
    const itemsConStockBajo = catalogoItems.filter(item => {
      const stockActual = toNumber(item.stock_actual);
      const puntoReorden = toNumber(item.punto_reorden_interno || item.punto_reorden);
      return stockActual <= puntoReorden;
    }).slice(0, 6);

    // Calcular totales de inventario
    const totalItems = catalogoItems.length;
    const totalStockValue = catalogoItems.reduce((sum, item) => {
      return sum + (toNumber(item.stock_actual) * toNumber(item.precio_costo || 0));
    }, 0);

    return (
      <div className="almacen-layout">
        <div className="almacen-subpanel-grid">
          <div className="almacen-subpanel">
            <div className="almacen-subpanel-header">
              <h3>📚 Recetario</h3>
              <span>{recetas.length} tipos</span>
            </div>
            <div className="mini-list compact-list">
              {recetas.length > 0 ? (
                recetas.slice(0, 6).map((item) => {
                  const ingredientes = item.escandallo || [];
                  return (
                    <div className="mini-item" key={item.id_recetario || item.id}>
                      <strong>{item.nombre_platillo || 'Sin nombre'}</strong>
                      <span>{item.procedimiento_preparacion || 'Sin descripción'}</span>
                      <span>{ingredientes.length} ingredientes · Costo: ${toNumber(item.costo_porcion || 0).toFixed(2)}</span>
                    </div>
                  );
                })
              ) : (
                <div className="mini-item"><span style={{ color: '#9ca3af' }}>No hay recetas cargadas</span></div>
              )}
            </div>
          </div>
          <div className="almacen-subpanel">
            <div className="almacen-subpanel-header">
              <h3>Stock crítico ⚠</h3>
              <span>{itemsConStockBajo.length} urgentes</span>
            </div>
            <div className="mini-list compact-list">
              {itemsConStockBajo.length > 0 ? (
                itemsConStockBajo.map((item) => (
                  <div className="mini-item alert-item" key={`urgente-${item.id_item}`}>
                    <strong style={{ color: '#dc2626' }}>🔴 {item.nombre_item}</strong>
                    <span>Stock: {toNumber(item.stock_actual)} {item.unidad_consumo} · Mín: {toNumber(item.punto_reorden_interno || item.punto_reorden)}</span>
                    <span>Máx: {toNumber(item.stock_maximo_interno || '?')}</span>
                  </div>
                ))
              ) : (
                <div className="mini-item"><span style={{ color: '#10b981' }}>✓ Todo en orden</span></div>
              )}
            </div>
          </div>
          <div className="almacen-subpanel">
            <div className="almacen-subpanel-header">
              <h3>📦 Inventario</h3>
              <span>{totalItems} productos</span>
            </div>
            <div className="mini-list compact-list">
              {totalItems > 0 ? (
                <>
                  <div className="mini-item">
                    <strong>Valor total stock</strong>
                    <span style={{ color: '#10b981', fontSize: '1.1em', fontWeight: 'bold' }}>${totalStockValue.toFixed(2)}</span>
                  </div>
                  <div className="mini-item">
                    <strong>Productos en stock</strong>
                    <span>{totalItems} referencias</span>
                  </div>
                  <div className="mini-item">
                    <strong>Productos críticos</strong>
                    <span style={{ color: itemsConStockBajo.length > 0 ? '#dc2626' : '#10b981' }}>
                      {itemsConStockBajo.length} bajo mínimo
                    </span>
                  </div>
                </>
              ) : (
                <div className="mini-item"><span style={{ color: '#9ca3af' }}>No hay productos cargados</span></div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  function renderMovimientosCatering() {
    const catalogoInsumos = almacenCompras?.catalogo || [];
    const eventos = data?.eventos || [];
    const movimientos = movimientosCatData?.movimientos || [];
    const tiposCatering = TIPOS_SALIDA.filter((t) => t.scope === 'catering' || t.scope === 'ambos');

    return (
      <div className="almacen-module-container">
        {/* REGISTRO DE MOVIMIENTOS ESPECIALES: Daño, Merma, Reposición */}
        <RegistroMovimientosInventario 
          businessId={user.business_id}
          userId={user.id_usuario}
          onMovimientoRegistrado={() => {
            // Opcional: recargar movimientos después de registrar
            recargarOperacion();
          }}
        />

        <section className="almacen-section">
          <div className="almacen-subpanel spotlight-panel">
            <div className="almacen-subpanel-header">
              <h3>Registrar salida de insumo</h3>
              <span>Uso en evento · Merma · Prestado · Utilería · Renta</span>
            </div>
            {(salidaCatMessage || salidaCatError) && (
              <div className={`operation-banner ${salidaCatError ? 'error' : 'success'}`}>
                {salidaCatError || salidaCatMessage}
              </div>
            )}
            <div className="form-grid-fields">
              <label>
                <span>Tipo de salida</span>
                <select
                  value={salidaCatForm.tipoDetalle}
                  onChange={(e) => setSalidaCatForm((prev) => ({ ...prev, tipoDetalle: e.target.value }))}
                >
                  {tiposCatering.map((t) => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
              </label>
              <label>
                <span>Insumo</span>
                <select
                  value={salidaCatForm.idInsumo}
                  onChange={(e) => setSalidaCatForm((prev) => ({ ...prev, idInsumo: e.target.value }))}
                >
                  <option value="">Selecciona un insumo</option>
                  {catalogoInsumos
                    .slice()
                    .sort((a, b) => String(a.nombre_item).localeCompare(String(b.nombre_item), 'es'))
                    .map((item) => (
                      <option key={`cat-sal-${item.id_item}`} value={item.id_item}>
                        {item.nombre_item} · stock {item.stock_actual} {item.unidad_consumo}
                      </option>
                    ))}
                </select>
              </label>
              <label>
                <span>Cantidad</span>
                <input
                  type="number"
                  min="0.001"
                  step="0.001"
                  placeholder="0.000"
                  value={salidaCatForm.cantidad}
                  onChange={(e) => setSalidaCatForm((prev) => ({ ...prev, cantidad: e.target.value }))}
                />
              </label>
              {salidaCatForm.tipoDetalle === 'uso_evento' && (
                <label>
                  <span>Evento</span>
                  <select
                    value={salidaCatForm.idEvento}
                    onChange={(e) => setSalidaCatForm((prev) => ({ ...prev, idEvento: e.target.value }))}
                  >
                    <option value="">Sin evento vinculado</option>
                    {eventos.map((ev) => (
                      <option key={`cat-ev-${ev.id_evento}`} value={ev.id_evento}>
                        {cleanEventName(ev.nombre_evento) || `Evento #${ev.id_evento}`}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              <label>
                <span>Motivo / Nota</span>
                <input
                  type="text"
                  placeholder="Ej: Boda García, equipo prestado a otro evento..."
                  value={salidaCatForm.motivo}
                  onChange={(e) => setSalidaCatForm((prev) => ({ ...prev, motivo: e.target.value }))}
                />
              </label>
              <label>
                <span>Responsable</span>
                <input
                  type="text"
                  placeholder={user.nombre_completo || 'Nombre'}
                  value={salidaCatForm.responsable}
                  onChange={(e) => setSalidaCatForm((prev) => ({ ...prev, responsable: e.target.value }))}
                />
              </label>
              <label className="field-span-2">
                <span>Fecha y hora</span>
                <input
                  type="datetime-local"
                  value={salidaCatForm.fechaRegistro}
                  onChange={(e) => setSalidaCatForm((prev) => ({ ...prev, fechaRegistro: e.target.value }))}
                />
              </label>
            </div>
            <div className="module-actions">
              <button
                type="button"
                className="module-action-button primary"
                onClick={handleGuardarSalidaCatering}
                disabled={isSavingSalidaCat || !salidaCatForm.idInsumo || !salidaCatForm.cantidad}
              >
                {isSavingSalidaCat ? 'Registrando...' : 'Registrar salida'}
              </button>
            </div>
          </div>
        </section>

        <section className="almacen-section">
          <div className="almacen-subpanel">
            <div className="almacen-subpanel-header">
              <h3>Historial de movimientos</h3>
              <span>{movimientos.length} registros</span>
            </div>
            <div className="form-grid-fields">
              <label>
                <span>Período</span>
                <select
                  value={movimientosCatFiltro.periodo}
                  onChange={(e) => setMovimientosCatFiltro((prev) => ({ ...prev, periodo: e.target.value }))}
                >
                  <option value="hoy">Hoy</option>
                  <option value="semana">Esta semana</option>
                  <option value="mes">Este mes</option>
                  <option value="personalizado">Personalizado</option>
                </select>
              </label>
              {movimientosCatFiltro.periodo === 'personalizado' && (
                <>
                  <label>
                    <span>Desde</span>
                    <input
                      type="date"
                      value={movimientosCatFiltro.fechaInicio}
                      onChange={(e) => setMovimientosCatFiltro((prev) => ({ ...prev, fechaInicio: e.target.value }))}
                    />
                  </label>
                  <label>
                    <span>Hasta</span>
                    <input
                      type="date"
                      value={movimientosCatFiltro.fechaFin}
                      onChange={(e) => setMovimientosCatFiltro((prev) => ({ ...prev, fechaFin: e.target.value }))}
                    />
                  </label>
                </>
              )}
            </div>
            {movimientosCatError && <p className="panel-empty">{movimientosCatError}</p>}
            {!movimientosCatError && movimientos.length === 0 && (
              <p className="panel-empty">Sin movimientos en el período seleccionado.</p>
            )}
            {movimientos.length > 0 && (
              <table className="recetario-table">
                <thead>
                  <tr>
                    <th>Fecha</th>
                    <th>Insumo</th>
                    <th>Tipo</th>
                    <th>Cantidad</th>
                    <th>Responsable</th>
                    <th>Motivo</th>
                  </tr>
                </thead>
                <tbody>
                  {movimientos.map((mov, idx) => (
                    <tr key={`cat-mov-${mov.id_mov_inv || idx}`}>
                      <td>{mov.fecha_registro ? new Date(mov.fecha_registro).toLocaleDateString('es-MX') : '—'}</td>
                      <td>{mov.nombre_item || mov.id_insumo}</td>
                      <td>{mov.tipo_detalle || mov.tipo_operacion}</td>
                      <td>{mov.cantidad} {mov.unidad_consumo || ''}</td>
                      <td>{mov.responsable || '—'}</td>
                      <td>{mov.motivo || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            {movimientos.length > 0 && (
              <div className="module-actions" style={{ marginTop: '16px' }}>
                <button
                  type="button"
                  className="module-action-button success"
                  onClick={exportarMovimientosCateringExcel}
                >
                  📊 Descargar Excel
                </button>
                <button
                  type="button"
                  className="module-action-button"
                  onClick={exportarMovimientosCateringPdf}
                >
                  📄 Descargar PDF
                </button>
              </div>
            )}
          </div>
        </section>
      </div>
    );
  }

  function renderContent() {
    if (isNuevoUsuarioSection || isConfiguracionSection) {
      return renderConfiguracionCatering();
    }

    if (isAdminPreciosSection) {
      return (
        <>
          <AdminPreciosCatering businessId={user.business_id} />
          <AdminEquiposPropios businessId={user.business_id} userId={user.id_usuario} />
        </>
      );
    }

    if (isAlmacenComprasSection) {
      return renderAlmacenComprasContent();
    }

    if (isMovimientosSection) {
      return renderMovimientosCatering();
    }

    if (error) {
      return <p className="panel-empty">No se pudo cargar catering: {error}</p>;
    }

    if (!data) {
      return <p className="panel-empty">Cargando catering...</p>;
    }

    if (isCotizacionesSection) {
      return renderCotizacionEditor();
    }

    if (isEventosSection) {
      return renderEventosEditor();
    }

    if (isOperacionSection) {
      return renderOperacionEditor();
    }

    return renderOverview();
  }

  function renderSummary() {
    if (isNuevoUsuarioSection || isConfiguracionSection) {
      return renderConfiguracionCateringSummary();
    }

    if (isAdminPreciosSection) {
      return null;
    }

    if (isAlmacenComprasSection) {
      return renderAlmacenSummary();
    }

    if (!data || !data.resumen) {
      return <p className="panel-empty">Cargando resumen de catering...</p>;
    }

    // Mostrar listado de eventos en dashboard catering
    if (activeSection === 'dashboard_catering') {
      const eventos = data.eventos || [];
      const movimientos = data.movimientos || [];
      
      // Separar movimientos por tipo
      const entradas = movimientos.filter(m => m.tipo_operacion === 'entrada').slice(0, 5);
      const salidas = movimientos.filter(m => m.tipo_operacion === 'salida').slice(0, 5);

      return (
        <div className="catering-listado-completo">
          {/* Sección de movimientos de almacén */}
          <div className="almacen-historial-section">
            <div className="almacen-historial-header">
              <h4>📦 Movimientos de almacén</h4>
              <span>{movimientos.length} total</span>
            </div>
            
            {entradas.length > 0 && (
              <div className="almacen-subseccion">
                <p className="almacen-subtitulo">⬆️ Entradas recientes</p>
                <div className="almacen-items">
                  {entradas.map((mov) => (
                    <div key={`entrada-${mov.id_mov_inv}`} className="almacen-item entrada">
                      <div className="almacen-item-info">
                        <strong>{mov.nombre_item}</strong>
                        <span>{mov.cantidad} {mov.unidad_consumo} · ${toNumber(mov.costo_unitario).toFixed(2)}</span>
                        <small>{mov.responsable || 'Sin responsable'} · {formatDate(mov.fecha_registro)}</small>
                      </div>
                      <span className="almacen-item-monto">${(toNumber(mov.cantidad) * toNumber(mov.costo_unitario)).toFixed(2)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            {salidas.length > 0 && (
              <div className="almacen-subseccion">
                <p className="almacen-subtitulo">⬇️ Salidas recientes</p>
                <div className="almacen-items">
                  {salidas.map((mov) => (
                    <div key={`salida-${mov.id_mov_inv}`} className="almacen-item salida">
                      <div className="almacen-item-info">
                        <strong>{mov.nombre_item}</strong>
                        <span>{mov.tipo_detalle} · {mov.cantidad} {mov.unidad_consumo}</span>
                        <small>{mov.responsable || 'Sin responsable'} · {formatDate(mov.fecha_registro)}</small>
                      </div>
                      <span className="almacen-item-badge">{mov.tipo_detalle}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {movimientos.length === 0 && (
              <div className="image-placeholder-card compact-placeholder">Sin movimientos registrados</div>
            )}
          </div>

          {/* Sección de eventos */}
          {eventos.length > 0 && (
            <div className="eventos-listado-section">
              <div className="eventos-listado-header">
                <h4>🎉 Eventos activos</h4>
                <span>{eventos.length} total</span>
              </div>
              <div className="catering-eventos-listado">
                {eventos.map((evento) => {
                  let statusColor, statusLabel, statusIcon;
                  
                  if (evento.estatus === 'confirmado') {
                    statusColor = '#10b981';
                    statusLabel = 'Confirmado';
                    statusIcon = '✓';
                  } else if (evento.estatus === 'operando') {
                    statusColor = '#8b5cf6';
                    statusLabel = 'Operando';
                    statusIcon = '⚙';
                  } else if (evento.estatus === 'liquidado') {
                    statusColor = '#6366f1';
                    statusLabel = 'Liquidado';
                    statusIcon = '✓✓';
                  } else if (evento.estatus === 'cotizando') {
                    statusColor = '#3b82f6';
                    statusLabel = 'Cotizando';
                    statusIcon = '📋';
                  } else {
                    statusColor = '#6b7280';
                    statusLabel = 'Desconocido';
                    statusIcon = '?';
                  }

                  return (
                    <div key={evento.id_evento} className="evento-item-card">
                      <div className="evento-icon" style={{ backgroundColor: statusColor }}>
                        {statusIcon}
                      </div>
                      <div className="evento-info">
                        <strong className="evento-nombre">{evento.nombre_evento || 'Sin nombre'}</strong>
                        <span className="evento-cliente">{evento.nombre_cliente || 'Sin cliente'}</span>
                        <span className="evento-fecha">{formatDate(evento.fecha_evento) || 'Sin fecha'} · {evento.numero_personas || 0} personas</span>
                      </div>
                      <span className="evento-status" style={{ backgroundColor: statusColor }}>{statusLabel}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      );
    }

    const navCards = [
      {
        label: 'Cotizaciones',
        value: data.resumen.cotizados || 0,
        detail: 'Propuestas convertidas en evento',
        icon: '📋',
        section: 'cotizaciones_catering',
        color: '#3b82f6',
        bgColor: '#eff6ff'
      },
      {
        label: 'Confirmados',
        value: data.resumen.confirmados || 0,
        detail: 'Eventos listos para atención',
        icon: '✅',
        section: 'eventos_catering',
        color: '#10b981',
        bgColor: '#ecfdf5'
      },
      {
        label: 'Operando',
        value: data.resumen.eventosOperando || 0,
        detail: 'Eventos en curso con tickets',
        icon: '⚙️',
        section: 'operacion_catering',
        color: '#8b5cf6',
        bgColor: '#faf5ff'
      },
      {
        label: 'Liquidado',
        value: data.resumen.liquidados || 0,
        detail: 'Eventos finalizados y pagados',
        icon: '🏁',
        section: 'operacion_catering',
        color: '#6366f1',
        bgColor: '#e0e7ff'
      },
    ];

    return (
      <div>
        <div className="catering-resumen-nav-grid">
          {navCards.map((card) => (
            <button
              key={card.label}
              type="button"
              className="catering-nav-card"
              style={{
                color: card.color
              }}
              onClick={() => onNavigateSection && onNavigateSection(card.section)}
            >
              <span className="catering-nav-icon">{card.icon}</span>
              <strong className="catering-nav-value">{card.value}</strong>
              <span className="catering-nav-label">{card.label}</span>
              <small className="catering-nav-detail">{card.detail}</small>
            </button>
          ))}
        </div>
        {(data.historial || []).length > 0 && (
          <div className="catering-historial-reciente">
            <p className="catering-historial-titulo">Actividad reciente</p>
            <div className="quick-list">
              {(data.historial || []).slice(0, 4).map((item) => (
                <div className="quick-item" key={item.id}>
                  <div>
                    <strong>{item.concepto}</strong>
                    <span>{item.detalle}</span>
                    <span>{item.responsable} · {item.fecha_label}</span>
                  </div>
                  <em>{item.total_label}</em>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <main className="dashboard-shell" data-section={activeSection}>
      <header className="hero-card">
        <button type="button" className="menu-button" onClick={onOpenMenu}>
          ⊞
        </button>
        <div>
          <p className="eyebrow">itakt | Catering</p>
          <h1>{copy.title}</h1>
          <p>{copy.description}</p>
        </div>
        <div className="hero-meta">
          <span>{user.rol_nombre}</span>
          <strong>{user.business_name || 'Catering'}</strong>
        </div>
      </header>

      <section className="metric-grid">
        {cards.map((summary) => (
          <article className="metric-card" key={summary.title}>
            <span>{summary.title}</span>
            <strong>{summary.value}</strong>
            <small>{summary.detail}</small>
          </article>
        ))}
      </section>

      <section className="content-grid">
        <article className="panel-card">
          <h2>{copy.title}</h2>
          <p>{copy.description}</p>
          {renderContent()}
        </article>
        <article className="panel-card">
          <h2>{isNuevoUsuarioSection || isConfiguracionSection ? 'Configuración catering' : (activeSection === 'dashboard_catering' ? 'Listado de estado' : 'Resumen catering')}</h2>
          <p>
            {isNuevoUsuarioSection || isConfiguracionSection
              ? 'Alta de usuarios y configuración solo para catering, sin mezclar restaurante.'
              : activeSection === 'dashboard_catering'
                ? 'Cotizaciones pendientes, eventos confirmados y operación activa del catering.'
                : 'Cotización, evento y operación ya quedan dentro del mismo flujo de catering con cliente, dirección, estatus y tickets.'}
          </p>
          {renderSummary()}
        </article>
      </section>
    </main>
  );
}
