import React, { useEffect, useRef, useState } from 'react';
import {
  actualizarConfiguracionNegocio,
  crearTrabajadorRestaurante,
  eliminarUsuarioNegocio,
  obtenerConfiguracionNegocio,
  obtenerUsuariosRestaurante
} from '../../services/usuarios';
import { obtenerUsuariosVisiblesPorNegocio } from '../../services/admin';
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
  obtenerAlmacenCompras,
  toLocalDateKey
} from '../../services/almacenCompras';
import {
  descargarCsv,
  descargarPdfMovimiento,
  obtenerKardexInsumo,
  obtenerMovimientosRestaurante,
  registrarMerma,
  registrarSalidaInsumo,
  registrarSalidaRestaurante,
  TIPOS_SALIDA
} from '../../services/movimientos';
import {
  TIPOS_RECETA,
  TIPOS_RELACION_RECETA,
  UNIDADES_RECETA,
  calcularMermaAutomatica,
  eliminarRecetaConEscandallo,
  guardarRecetaConEscandallo,
  obtenerRecetarioEscandallo
} from '../../services/recetario';
import BusinessUsersTable from '../../components/BusinessUsersTable';
import RegistroMovimientosInventario from '../../components/RegistroMovimientosInventario';
import RegistroMovimientosInventarioCompleto from '../../components/RegistroMovimientosInventarioCompleto';
import { getSectionMeta } from '../../roles/menuConfig';
import { agregarChecklistManual, obtenerChecklistCompras } from '../../services/checklistCompras';
import {
  buildPurchaseObservations,
  getDefaultPurchaseCapture,
  getPurchaseEvidenceLabel,
  getPurchaseFlowLabel,
  normalizePurchaseEvidence,
  normalizePurchaseFlow,
  parsePurchaseMetadata,
  PURCHASE_EVIDENCE_OPTIONS,
} from '../../utils/purchaseCapture';
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

const summaries = [
  { title: 'Modulo activo', value: 'Restaurante', detail: 'Operación enfocada solo a restaurante' },
  { title: 'Ruta rápida', value: 'Viva', detail: 'Alertas, compras y recetas al momento' },
  { title: 'Control', value: 'Diario', detail: 'Corte operativo e historial filtrable' }
];

function getModuleCards(user) {
  return [
    {
      title: 'Restaurante',
      value: user?.tiene_restaurante ? 'Habilitado' : 'Inhabilitado',
      detail: user?.tiene_restaurante ? 'La operación de restaurante ya está activa en este negocio' : 'Este flujo todavía no está activo para este negocio'
    },
    {
      title: 'Catering',
      value: user?.tiene_catering ? 'Habilitado' : 'Inhabilitado',
      detail: user?.tiene_catering ? 'Ya puedes entrar al módulo catering con la misma base del negocio' : 'Se puede habilitar después sin perder la información del negocio'
    }
  ];
}

const quickActions = [
  { title: 'Registrar compra', subtitle: 'Entrada de lote con responsable y proveedor', hint: 'Operación' },
  { title: 'Crear receta', subtitle: 'Escandallo con recetas ligadas y costo real', hint: 'Recetario' },
  { title: 'Corte de compras', subtitle: 'Registra recetas usadas y repón lo faltante', hint: 'Movimientos' }
];

function getRoleClass(roleName) {
  if (!roleName) return 'trabajador';

  const normalized = roleName.toLowerCase();
  if (normalized.includes('admin')) return 'admin';
  if (normalized.includes('due')) return 'dueno';
  if (normalized.includes('gerente')) return 'trabajador';
  return 'trabajador';
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
  g: [
    { a: 'kg', factor: 0.001, label: 'kg' }
  ],
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

  const matches = EQUIVALENCIAS_RAPIDAS.filter((equivalence) =>
    normalizeCatalogSearch(`${equivalence.de} ${equivalence.a} ${equivalence.nota}`).includes(normalizedQuery)
  );

  return matches.length > 0 ? matches : EQUIVALENCIAS_RAPIDAS;
}

function formatCurrency(value) {
  return new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: 'MXN'
  }).format(Number(value || 0));
}

function formatDateTime(value) {
  return new Date(value).toLocaleString('es-MX', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  });
}

function getShortItemList(items, limit = 6) {
  return (items || []).slice(0, limit);
}

function getDefaultItemForm() {
  return {
    nombre_item: '',
    categoria: 'ingredientes',
    subcategoria: 'Verduras frescas',
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
      subcategoria: 'Verduras frescas',
      tipo_conservacion: 'Refrigerado',
      unidad_consumo: 'kg',
      punto_reorden: '',
      precio_competencia_promedio: '',
      fuente_competencia: ''
    },
    proveedor_nuevo: getDefaultProviderForm()
  };
}

function getDefaultRecipeDetail() {
  return {
    id_escandallo: null,
    id_item: '',
    unidad_medida_receta: 'kg',
    cantidad_utilizada: '',
    merma_porcentaje: 0,
    tiempo_preparacion_min: ''
  };
}

function getDefaultRecipeForm() {
  return {
    id_recetario: null,
    nombre_platillo: '',
    tipo_categoria: TIPOS_RECETA[0],
    recetas_relacionadas: [],
    imagen_platillo: '',
    precio_venta_fijo: '',
    rendimiento_personas: '1',
    procedimiento_preparacion: '',
    tiempo_total_estimado_min: '',
    detalles: [getDefaultRecipeDetail()]
  };
}

function getDefaultRecipeRelation() {
  return {
    id_receta_relacionada: '',
    tipo_relacion: TIPOS_RELACION_RECETA[0],
    cantidad_relacionada: '1'
  };
}

function getDefaultWorkerForm() {
  return {
    tipoUsuario: 'trabajador',
    nombre_completo: '',
    correo: '',
    contrasena: '',
    telefono: '',
    nombre_negocio: ''
  };
}

function getDefaultSalidaForm() {
  return {
    idInsumo: '',
    cantidad: '',
    tipoDetalle: 'uso_receta',
    idReceta: '',
    motivo: '',
    responsable: '',
    fecha_registro: getLocalDatetimeValue()
  };
}

function getBusinessLogoStorageKey(scope, businessId) {
  return `itakt-business-logo-${scope}-${businessId || 'sin-negocio'}`;
}

function getDefaultBusinessConfigForm(user) {
  return {
    nombre_negocio: user?.business_name || '',
    tipo_negocio: user?.business_type || 'restaurante',
    logo_preview: ''
  };
}

function getOperationalScope(activeSection, user) {
  if (String(activeSection || '').includes('catering')) {
    return 'catering';
  }

  return user?.business_type === 'catering' ? 'catering' : 'restaurante';
}

function getOperationalScopeLabel(scope) {
  return scope === 'catering' ? 'Catering' : 'Restaurante';
}

function isRentalProviderType(type) {
  const normalized = String(type || '').toLowerCase();
  return normalized.includes('renta') || normalized.includes('decoracion') || normalized.includes('ambientacion');
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

  if (exactMatch) {
    return exactMatch;
  }

  const matches = (catalogo || []).filter((item) => {
    const name = normalizeCatalogSearch(item.nombre_item);
    const label = normalizeCatalogSearch(getPurchaseCatalogLabel(item));
    return name.includes(normalizedQuery) || label.includes(normalizedQuery);
  });

  return matches.length === 1 ? matches[0] : null;
}

function roundMeasure(value) {
  return Number(toNumber(value).toFixed(3));
}

function parseResponsable(observaciones) {
  const text = String(observaciones || '');
  const match = text.match(/Registro por:\s*([^|\]]+)/i);
  return match?.[1]?.trim() || '';
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

function getReceptionPriorityLabel(priority) {
  if (priority === 'alta') return 'Prioridad alta';
  if (priority === 'baja') return 'Prioridad baja';
  return 'Prioridad media';
}

function getReceptionConditionLabel(condition) {
  if (condition === 'regular') return 'Regular';
  if (condition === 'mala') return 'Mala';
  if (condition === 'incompleto') return 'Incompleto';
  return 'Buena';
}

function sortChecklist(items) {
  return [...items].sort((a, b) => {
    if (Boolean(a.checked) !== Boolean(b.checked)) {
      return a.checked ? 1 : -1;
    }

    const priorityDiff = getChecklistPriorityWeight(a.prioridad) - getChecklistPriorityWeight(b.prioridad);
    if (priorityDiff !== 0) {
      return priorityDiff;
    }

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
    const hasCapturedPurchaseToday = cantidadCompradaHoy > 0;

    if (isAlert && !hasCapturedPurchaseToday) {
      checklist.push({
        id: `item-${itemId}`,
        itemId,
        descripcion: item.nombre_item,
        cantidad: suggestedQuantity || null,
        unidad: item.unidad_consumo || 'unidad',
        prioridad: getChecklistPriority(item.semaforo?.label),
        origen: 'stock',
        checked: false,
        stockActual: toNumber(item.stock_actual),
        reorden: reorderPoint,
        nota:
          cantidadCompradaHoy > 0
            ? `Llegó ${cantidadCompradaHoy} ${item.unidad_consumo || 'unidad'} hoy${proveedores.length ? ` · ${proveedores.join(', ')}` : ''}, pero sigue faltando revisar.`
            : `Sin compra registrada hoy · Stock ${toNumber(item.stock_actual)} / Reorden ${reorderPoint}`,
        createdBy: proveedores[0] || 'Sistema',
        purchasedToday: cantidadCompradaHoy
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

export default function RestauranteWorkspace({ activeSection, user, onOpenMenu, onNavigateSection }) {
  const [usuarios, setUsuarios] = useState([]);
  const [error, setError] = useState('');
  const [movimientosData, setMovimientosData] = useState(null);
  const [movimientosError, setMovimientosError] = useState('');
  const [movimientosFiltro, setMovimientosFiltro] = useState({ periodo: 'semana', fechaInicio: '', fechaFin: '', buscarInsumo: '', tipoMov: '', responsable: '' });
  const [notasCalidad, setNotasCalidad] = useState(() => {
    try { return JSON.parse(localStorage.getItem(`notas_calidad_${user.business_id}`) || '[]'); } catch { return []; }
  });
  const [notaCalidadForm, setNotaCalidadForm] = useState({ id_item: '', nombre_item: '', prioridad: 'urgente', nota: '' });
  // Kardex state
  const [kardexTab, setKardexTab] = useState('checklist');
  const [kardexInsumoId, setKardexInsumoId] = useState('');
  const [kardexFechaInicio, setKardexFechaInicio] = useState('');
  const [kardexFechaFin, setKardexFechaFin] = useState('');
  const [kardexData, setKardexData] = useState(null);
  const [kardexLoading, setKardexLoading] = useState(false);
  const [kardexError, setKardexError] = useState('');
  const [mermaForm, setMermaForm] = useState({ idInsumo: '', cantidad: '', costoUnitario: '', motivo: '', responsable: '' });
  const [mermaMessage, setMermaMessage] = useState('');
  const [mermaError, setMermaError] = useState('');
  const [isSavingMerma, setIsSavingMerma] = useState(false);
  const [salidaForm, setSalidaForm] = useState(getDefaultSalidaForm());
  const [salidaMessage, setSalidaMessage] = useState('');
  const [salidaError, setSalidaError] = useState('');
  const [isSavingSalida, setIsSavingSalida] = useState(false);
  const [workerForm, setWorkerForm] = useState(getDefaultWorkerForm());
  const [workerMessage, setWorkerMessage] = useState('');
  const [workerError, setWorkerError] = useState('');
  const [isSavingWorker, setIsSavingWorker] = useState(false);
  const [businessConfigForm, setBusinessConfigForm] = useState(getDefaultBusinessConfigForm(user));
  const [businessConfigMessage, setBusinessConfigMessage] = useState('');
  const [businessConfigError, setBusinessConfigError] = useState('');
  const [isSavingBusinessConfig, setIsSavingBusinessConfig] = useState(false);
  const [almacenCompras, setAlmacenCompras] = useState(null);
  const [almacenError, setAlmacenError] = useState('');
  const [recetarioData, setRecetarioData] = useState(null);
  const [recetarioError, setRecetarioError] = useState('');
  const [recetaSeleccionadaId, setRecetaSeleccionadaId] = useState(null);
  const [ingredienteSeleccionadoId, setIngredienteSeleccionadoId] = useState(null);
  const [recetaForm, setRecetaForm] = useState(getDefaultRecipeForm());
  const [recetaFiltro, setRecetaFiltro] = useState({ texto: '', tipo: 'todas' });
  const [recetaOperationMessage, setRecetaOperationMessage] = useState('');
  const [recetaOperationError, setRecetaOperationError] = useState('');
  const [isSavingReceta, setIsSavingReceta] = useState(false);
  const [gestionActiva, setGestionActiva] = useState('inventario');
  const [seleccion, setSeleccion] = useState({ inventario: null, proveedor: null, compra: null });
  const [itemForm, setItemForm] = useState(getDefaultItemForm());
  const [providerForm, setProviderForm] = useState(getDefaultProviderForm());
  const [purchaseForm, setPurchaseForm] = useState(getDefaultPurchaseForm());
  const [inventarioFiltro, setInventarioFiltro] = useState({ grupo: 'todos', subcategoria: 'todas' });
  const [operationMessage, setOperationMessage] = useState('');
  const [operationError, setOperationError] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [modalRecepcionAbierto, setModalRecepcionAbierto] = useState(false);
  const [modalPagoAbierto, setModalPagoAbierto] = useState(false);
  const [compraSeleccionadaEstado, setCompraSeleccionadaEstado] = useState(null);
  const [recepcionForm, setRecepcionForm] = useState({
    fecha_recepcion: new Date().toISOString().slice(0, 10),
    quien_recibio: '',
    cantidad_recibida: '',
    observaciones: ''
  });
  const [pagoForm, setPagoForm] = useState({
    fecha_pago: new Date().toISOString().slice(0, 10),
    monto_pagado: ''
  });
  const [isSavingEstado, setIsSavingEstado] = useState(false);
  const [quickFocus, setQuickFocus] = useState('general');
  const [shoppingChecklist, setShoppingChecklist] = useState([]);
  const [selectedChecklistIds, setSelectedChecklistIds] = useState([]);
  const [recepcionChecklist, setRecepcionChecklist] = useState({});
  const [autoSaveReceptionState, setAutoSaveReceptionState] = useState('idle');
  const [purchaseSessionIds, setPurchaseSessionIds] = useState([]);
  const [manualChecklistForm, setManualChecklistForm] = useState(getDefaultChecklistForm());
  const [isSavingChecklistItem, setIsSavingChecklistItem] = useState(false);
  const lastAutoSavedReceptionRef = useRef('');
  const copy = getSectionMeta(activeSection);
  const operationScope = getOperationalScope(activeSection, user);
  const operationScopeLabel = getOperationalScopeLabel(operationScope);
  const isDashboardRestaurantSection = activeSection === 'dashboard_restaurante';
  const isAlmacenComprasSection = activeSection === 'almacen_compras_restaurante' || activeSection === 'almacen_compras_catering';
  const isRecetarioSection = activeSection === 'recetario_restaurante' || activeSection === 'recetario_catering';
  const isMovimientosSection = activeSection === 'movimientos_restaurante';
  const isNuevoTrabajadorSection = activeSection === 'nuevo_trabajador_restaurante';
  const isConfiguracionSection = activeSection === 'configuracion_restaurante';
  const isRestaurantConfigSection = isNuevoTrabajadorSection || isConfiguracionSection;
  const normalizedUserRole = (user?.rol_nombre || '').toLowerCase();
  const puedeVerRentabilidad = !normalizedUserRole.includes('trab') && !normalizedUserRole.includes('gerente');
  const almacenSectionKey = operationScope === 'catering' ? 'almacen_compras_catering' : 'almacen_compras_restaurante';
  const recetarioSectionKey = operationScope === 'catering' ? 'recetario_catering' : 'recetario_restaurante';

  function navigateSection(sectionKey, focus = 'general') {
    setQuickFocus(focus);
    if (onNavigateSection) {
      onNavigateSection(sectionKey);
    }
  }

  async function cargarAlmacen() {
    const result = await obtenerAlmacenCompras({ businessId: user.business_id || undefined });

    if (result.error) {
      setAlmacenError(result.error);
      setAlmacenCompras(null);
      setShoppingChecklist([]);
      return null;
    }

    setAlmacenError('');
    
    // Filtrar proveedores/equipos marcados como inactivos localmente
    const filteredData = {
      ...result.data,
      proveedores: (result.data?.proveedores || []).filter(prov => {
        const inactivoKey = `inactivo_prov_${prov.id_proveedor}`;
        return !localStorage.getItem(inactivoKey);
      }),
      equipos: (result.data?.equipos || []).filter(equipo => {
        const inactivoKey = `inactivo_equip_${equipo.id_equipo}`;
        return !localStorage.getItem(inactivoKey);
      })
    };
    
    setAlmacenCompras(filteredData);

    const checklistResult = await obtenerChecklistCompras({ businessId: user.business_id || undefined });
    if (checklistResult.error) {
      setShoppingChecklist(buildShoppingChecklist(filteredData));
      return filteredData;
    }

    setShoppingChecklist(buildShoppingChecklist(filteredData, checklistResult.data || []));

    return filteredData;
  }

  async function cargarRecetario() {
    const result = await obtenerRecetarioEscandallo({ businessId: user.business_id || undefined });

    if (result.error) {
      setRecetarioError(result.error);
      setRecetarioData(null);
      return null;
    }

    setRecetarioError('');
    setRecetarioData(result.data);

    const recetaActiva =
      result.data?.recetas?.find((item) => item.id_recetario === recetaSeleccionadaId) || result.data?.recetas?.[0] || null;

    setRecetaSeleccionadaId(recetaActiva?.id_recetario || null);
    setIngredienteSeleccionadoId(recetaActiva?.escandallo?.[0]?.id_escandallo || null);
    return result.data;
  }

  async function cargarMovimientos(filtros = movimientosFiltro) {
    const result = await obtenerMovimientosRestaurante({
      businessId: user.business_id || undefined,
      periodo: filtros.periodo,
      fechaInicio: filtros.fechaInicio,
      fechaFin: filtros.fechaFin
    });

    if (result.error) {
      setMovimientosError(result.error);
      setMovimientosData(null);
      return null;
    }

    setMovimientosError('');
    setMovimientosData(result.data);
    return result.data;
  }

  async function cargarKardex(idInsumo, fechaInicio, fechaFin) {
    if (!idInsumo) return;
    setKardexLoading(true);
    setKardexError('');
    const result = await obtenerKardexInsumo({
      businessId: user.business_id || undefined,
      idInsumo,
      fechaInicio,
      fechaFin,
      periodo: 'mes'
    });
    setKardexLoading(false);
    if (result.error) {
      setKardexError(result.error);
      setKardexData(null);
    } else {
      setKardexData(result.data);
    }
  }

  async function handleRegistrarMerma() {
    if (!mermaForm.idInsumo || !mermaForm.cantidad) {
      setMermaError('Selecciona un insumo e ingresa la cantidad.');
      return;
    }
    setIsSavingMerma(true);
    setMermaError('');
    setMermaMessage('');
    const result = await registrarMerma({
      businessId: user.business_id || undefined,
      idInsumo: mermaForm.idInsumo,
      cantidad: mermaForm.cantidad,
      costoUnitario: mermaForm.costoUnitario || 0,
      motivo: mermaForm.motivo,
      responsable: mermaForm.responsable || user?.nombre_completo || user?.correo || 'Sistema'
    });
    setIsSavingMerma(false);
    if (result.error) {
      setMermaError(result.error);
    } else {
      setMermaMessage(`Merma de ${result.data.cantidad} unidades de "${result.data.nombre_item}" registrada. Stock nuevo: ${result.data.stock_nuevo}`);
      setMermaForm({ idInsumo: '', cantidad: '', costoUnitario: '', motivo: '', responsable: '' });
      await cargarMovimientos();
      if (kardexInsumoId === mermaForm.idInsumo) {
        await cargarKardex(kardexInsumoId, kardexFechaInicio, kardexFechaFin);
      }
    }
  }

  async function cargarUsuariosRestauranteData() {
    const result = await obtenerUsuariosVisiblesPorNegocio({
      actorEmail: user?.correo,
      businessId: user?.business_id,
      scope: 'restaurante'
    });

    if (result.error) {
      const fallback = await obtenerUsuariosRestaurante();
      if (fallback.error) {
        setError(result.error);
        setUsuarios([]);
        return null;
      }

      setError('');
      setUsuarios(fallback.data || []);
      return fallback.data;
    }

    setError('');
    setUsuarios(result.data);
    return result.data;
  }

  async function cargarConfiguracionNegocioRestaurante() {
    const result = await obtenerConfiguracionNegocio({ businessId: user.business_id || undefined });

    if (result.error) {
      setBusinessConfigError(result.error);
      return null;
    }

    const logoPreview = window.localStorage.getItem(getBusinessLogoStorageKey('restaurante', user.business_id));
    setBusinessConfigError('');
    setBusinessConfigForm({
      nombre_negocio: result.data?.nombre_negocio || user.business_name || '',
      tipo_negocio: result.data?.tipo_negocio || user.business_type || 'restaurante',
      logo_preview: logoPreview || ''
    });
    return result.data;
  }

  useEffect(() => {
    let isMounted = true;

    async function cargarUsuarios() {
      const result = await cargarUsuariosRestauranteData();
      if (!isMounted || !result) return;
    }

    if (isRestaurantConfigSection) {
      cargarUsuarios();
    }

    return () => {
      isMounted = false;
    };
  }, [isRestaurantConfigSection]);

  useEffect(() => {
    let isMounted = true;

    async function cargarConfiguracion() {
      const result = await cargarConfiguracionNegocioRestaurante();
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

  useEffect(() => {
    let isMounted = true;

    async function cargar() {
      limpiarCacheAlmacen();  // Limpiar caché al cambiar de negocio
      const data = await cargarAlmacen();
      if (!isMounted || !data) return;

      if (isAlmacenComprasSection) {
        setSeleccion({ inventario: null, proveedor: null, compra: null });
      }
    }

    if (isAlmacenComprasSection || isMovimientosSection || isDashboardRestaurantSection) {
      cargar();
    }

    return () => {
      isMounted = false;
    };
  }, [user.business_id, activeSection, isAlmacenComprasSection, isMovimientosSection, isDashboardRestaurantSection]);

  useEffect(() => {
    if (!user.business_id || (!isAlmacenComprasSection && !isMovimientosSection && !isDashboardRestaurantSection)) {
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
  }, [user.business_id, isAlmacenComprasSection, isMovimientosSection, isDashboardRestaurantSection]);

  useEffect(() => {
    let isMounted = true;

    async function cargar() {
      const data = await cargarRecetario();
      if (!isMounted || !data) return;
    }

    if (isRecetarioSection) {
      cargar();
    }

    return () => {
      isMounted = false;
    };
  }, [user.business_id, activeSection, isRecetarioSection]);

  useEffect(() => {
    let isMounted = true;

    async function cargar() {
      const data = await cargarMovimientos();
      if (!isMounted || !data) return;
    }

    if (isMovimientosSection || isDashboardRestaurantSection || isRestaurantConfigSection) {
      cargar();
    }

    return () => {
      isMounted = false;
    };
  }, [user.business_id, activeSection, isMovimientosSection, isDashboardRestaurantSection, isRestaurantConfigSection]);

  useEffect(() => {
    if (!isMovimientosSection) {
      return;
    }

    const recetasCatalogo = movimientosData?.recetasCatalogo || [];
    if (!recetasCatalogo.length) {
      return;
    }

    setSalidaForm((current) => {
      const recipeStillExists = recetasCatalogo.some((item) => String(item.id_recetario) === String(current.id_recetario));
      if (recipeStillExists) {
        return current;
      }

      return {
        ...current,
        id_recetario: String(recetasCatalogo[0].id_recetario)
      };
    });
  }, [movimientosData, isMovimientosSection]);

  useEffect(() => {
    if (!isDashboardRestaurantSection && !isMovimientosSection) {
      return undefined;
    }

    const timer = window.setInterval(() => {
      cargarMovimientos();
    }, 45000);

    return () => window.clearInterval(timer);
  }, [isDashboardRestaurantSection, isMovimientosSection, movimientosFiltro, user.business_id]);

  useEffect(() => {
    if (!isAlmacenComprasSection) {
      return;
    }

    if (quickFocus === 'compras-sugeridas') {
      abrirCompras();
    }
  }, [isAlmacenComprasSection, quickFocus]);

  useEffect(() => {
    if (!isRecetarioSection || recetaForm.id_recetario || recetaForm.nombre_platillo) {
      return;
    }

    const recetaInicial = recetarioData?.recetas?.find((item) => item.id_recetario === recetaSeleccionadaId);
    if (recetaInicial) {
      loadRecipeIntoForm(recetaInicial);
    }
  }, [isRecetarioSection, recetarioData, recetaSeleccionadaId, recetaForm.id_recetario, recetaForm.nombre_platillo]);

  useEffect(() => {
    const categoriaActual = CATEGORIAS_CATALOGO.find((option) => option.value === itemForm.categoria);
    const subcategoriaPorDefecto = categoriaActual?.subcategorias?.[0] || '';

    if (categoriaActual && !categoriaActual.subcategorias.includes(itemForm.subcategoria)) {
      setItemForm((current) => ({ ...current, subcategoria: subcategoriaPorDefecto }));
    }
  }, [itemForm.categoria, itemForm.subcategoria]);

  useEffect(() => {
    const categoriaActual = CATEGORIAS_CATALOGO.find((option) => option.value === purchaseForm.item_nuevo.categoria);
    const subcategoriaPorDefecto = categoriaActual?.subcategorias?.[0] || '';

    if (categoriaActual && !categoriaActual.subcategorias.includes(purchaseForm.item_nuevo.subcategoria)) {
      setPurchaseForm((current) => ({
        ...current,
        item_nuevo: {
          ...current.item_nuevo,
          subcategoria: subcategoriaPorDefecto
        }
      }));
    }
  }, [purchaseForm.item_nuevo.categoria, purchaseForm.item_nuevo.subcategoria]);

  useEffect(() => {
    setInventarioFiltro((current) => ({ ...current, subcategoria: 'todas' }));
  }, [inventarioFiltro.grupo]);

  const equiposPropiosCatering = (almacenCompras?.catalogo || []).filter((item) => item.grupo === 'equipos');
  const mobiliarioCatering = (almacenCompras?.catalogo || []).filter(
    (item) => item.subcategoria === 'Mobiliario' || item.subcategoria === 'Ambientacion'
  );
  const manteleriaCatering = (almacenCompras?.catalogo || []).filter(
    (item) => item.subcategoria === 'Manteleria' || item.subcategoria === 'Decoracion'
  );
  const proveedoresRenta = (almacenCompras?.proveedores || []).filter((item) => isRentalProviderType(item.tipo_proveedor));
  const proveedoresOperacion = (almacenCompras?.proveedores || []).filter((item) => !isRentalProviderType(item.tipo_proveedor));

  const categoriaCards = almacenCompras
    ? operationScope === 'catering'
      ? [
          {
            title: 'Equipo propio catering',
            value: equiposPropiosCatering.length,
            detail: 'Mobiliario, montaje, servicio y ambientación propios'
          },
          {
            title: 'Proveedores de renta',
            value: proveedoresRenta.length,
            detail: 'Apoyo para mobiliario, mantelería y montaje externo'
          },
          {
            title: 'Compras del dia',
            value: formatCurrency(almacenCompras.resumen.totalCompraHoy),
            detail: `${almacenCompras.resumen.comprasHoy} movimientos guardados hoy`
          }
        ]
      : [
          {
            title: 'Ingredientes clasificados',
            value: almacenCompras.resumen.ingredientes,
            detail: 'Verduras, frutas, leguminosas, abarrotes y enlatados'
          },
          {
            title: 'Proveedores activos',
            value: almacenCompras.resumen.proveedores,
            detail: 'Clasificados por tipo de proveedor'
          },
          {
            title: 'Compras del dia',
            value: formatCurrency(almacenCompras.resumen.totalCompraHoy),
            detail: `${almacenCompras.resumen.comprasHoy} movimientos guardados hoy`
          }
        ]
    : [];

  const recetasFiltradas = (recetarioData?.recetas || []).filter((item) => {
    const coincideTipo = recetaFiltro.tipo === 'todas' || item.tipo_categoria === recetaFiltro.tipo;
    const texto = recetaFiltro.texto.trim().toLowerCase();
    const coincideTexto = !texto || item.nombre_platillo.toLowerCase().includes(texto);

    return coincideTipo && coincideTexto;
  });
  const catalogoRecetaSeparado = recetarioData?.catalogoSeparado || { insumos: [], equipos: [], complementos: [] };
  const catalogoReceta = recetarioData?.catalogo || [];

  const recetaSeleccionada = recetarioData?.recetas?.find((item) => item.id_recetario === recetaSeleccionadaId) || null;
  const detalleSeleccionado =
    recetaSeleccionada?.escandallo?.find((item) => item.id_escandallo === ingredienteSeleccionadoId) ||
    recetaSeleccionada?.escandallo?.[0] ||
    null;
  const recetarioCards = recetarioData
    ? [
        {
          title: 'Recetas base',
          value: recetarioData.resumen.totalRecetas,
          detail: 'Recetas listas para costeo y operación'
        },
        {
          title: 'Costo por porción',
          value: formatCurrency(recetaSeleccionada?.costo_porcion || recetarioData.resumen.costoPromedio),
          detail: recetaSeleccionada ? recetaSeleccionada.nombre_platillo : 'Promedio del recetario'
        },
        {
          title: puedeVerRentabilidad ? 'Costo competencia' : 'Precio de venta',
          value: puedeVerRentabilidad
            ? formatCurrency(
                recetaSeleccionada?.costo_competencia_porcion || recetarioData.resumen.costoCompetenciaPromedio
              )
            : formatCurrency(recetaSeleccionada?.precio_venta_fijo || recetarioData.resumen.precioPromedio),
          detail: puedeVerRentabilidad
            ? 'Referencia teórica usando precios de competencia'
            : 'Costo visible para operación'
        }
      ]
    : [];

  const movimientosCards = movimientosData
    ? [
        {
          title: 'Recetas registradas',
          value: movimientosData.corte.recetas_registradas,
          detail: 'Salidas capturadas desde el corte de compras'
        },
        {
          title: 'Platillos del periodo',
          value: movimientosData.resumen.platillosRegistrados,
          detail: 'Cantidad operada con recetas registradas'
        },
        {
          title: 'Consumo estimado',
          value: formatCurrency(movimientosData.resumen.totalSalidas),
          detail: 'Costo operativo de recetas usadas'
        }
      ]
    : [];

  const moduleCards = getModuleCards(user);

  const dashboardCards = movimientosData
    ? [
        {
          title: 'Alertas urgentes',
          value: movimientosData.resumen.alertasUrgentes,
          detail: 'Pulsa para revisar alertas activas y prioridades de compra',
          tone: 'urgent',
          onClick: () => navigateSection('movimientos_restaurante', 'alertas')
        },
        {
          title: 'Recetas en movimiento',
          value: movimientosData.recetasFrecuentes.length,
          detail: 'Pulsa para abrir el recetario con las recetas más movidas',
          tone: 'recipes',
          onClick: () => navigateSection(recetarioSectionKey, 'recetas')
        },
        {
          title: 'Lista de compra',
          value: movimientosData.recomendaciones[0]?.mejor_proveedor || 'Sin sugerencia',
          detail: movimientosData.recomendaciones[0]?.nombre_item || 'Sin item crítico',
          tone: 'buy',
          onClick: () => navigateSection(almacenSectionKey, 'compras-sugeridas')
        },
        {
          title: 'Movimientos listos',
          value: movimientosData.movimientos.length,
          detail: 'Pulsa para abrir el corte de compras y el historial',
          tone: 'movement',
          onClick: () => navigateSection('movimientos_restaurante', 'registro-dia')
        },
        ...moduleCards
      ]
    : [...summaries, ...moduleCards];

  const itemsBajoMinimo = (almacenCompras?.catalogo || []).filter(
    (item) => Number(item.stock_actual || 0) <= Number(item.stock_minimo_interno || 0)
  );
  const itemsSobreMaximo = (almacenCompras?.catalogo || []).filter(
    (item) => Number(item.stock_actual || 0) > Number(item.stock_maximo_interno || 0)
  );
  const rangoMovimientosLabel = movimientosData
    ? `${new Date(movimientosData.corte.fecha_inicio).toLocaleDateString('es-MX')} - ${new Date(
        movimientosData.corte.fecha_fin
      ).toLocaleDateString('es-MX')}`
    : '';
  const recetasMovimiento = movimientosData?.recetasCatalogo || [];

  const configuracionCards = [
    {
      title: 'Negocio activo',
      value: businessConfigForm.nombre_negocio || user.business_name || 'Sin nombre',
      detail: 'Configuración visible solo para restaurante'
    },
    {
      title: 'Tipo de negocio',
      value: 'Restaurante',
      detail: 'El ámbito se conserva separado de catering'
    },
    {
      title: 'Foto local',
      value: businessConfigForm.logo_preview ? 'Cargada' : 'Pendiente',
      detail: 'La imagen se guarda en este equipo'
    },
    ...moduleCards
  ];

  const contentTitle = isAlmacenComprasSection
    ? `Almacén y Compras ${operationScopeLabel.toLowerCase()}`
    : isRecetarioSection
      ? 'Recetario Maestro'
      : isMovimientosSection
        ? 'Corte de compras restaurante'
        : isRestaurantConfigSection
          ? copy.title
          : 'Ruta rápida restaurante';
  const contentDescription = isAlmacenComprasSection
    ? operationScope === 'catering'
      ? 'Operación completa de catering para controlar insumos, complementos, equipo propio y proveedores de renta dentro del mismo flujo de compras.'
      : `Operacion completa de ${operationScopeLabel.toLowerCase()} para clasificar inventario, registrar compras y llevar una lista operativa alimentada por stock y compras capturadas.`
    : isRecetarioSection
      ? 'Alta, edición y costeo completo de recetas con escandallo, unidades, mermas y referencia de competencia.'
      : isMovimientosSection
        ? 'Registra recetas usadas, descuenta consumo estimado y convierte el historial en un corte de compras real para reposición.'
        : isRestaurantConfigSection
          ? copy.description
          : 'Resumen rápido de alertas, recetas activas y compras urgentes solo para restaurante.';

  const selectedItem = almacenCompras?.catalogo.find((item) => item.id_item === seleccion.inventario) || null;
  const selectedProvider = almacenCompras?.proveedores.find((item) => item.id_proveedor === seleccion.proveedor) || null;
  const selectedPurchase = almacenCompras?.lotes.find((item) => item.id_compra === seleccion.compra || item.id_lote === seleccion.compra) || null;
  const subcategoriasDisponibles =
    CATEGORIAS_CATALOGO.find((option) => option.value === itemForm.categoria)?.subcategorias || [];
  const subcategoriasCompraRapida =
    CATEGORIAS_CATALOGO.find((option) => option.value === purchaseForm.item_nuevo.categoria)?.subcategorias || [];
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
  const proveedoresRentaResumen = Object.entries(
    proveedoresRenta.reduce((acc, item) => {
      const key = item.tipo_proveedor || 'Sin tipo';
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {})
  );
  const catalogoFiltrado = (almacenCompras?.catalogo || []).filter((item) => {
    const coincideGrupo = inventarioFiltro.grupo === 'todos' || item.grupo === inventarioFiltro.grupo;
    const coincideSubcategoria =
      inventarioFiltro.subcategoria === 'todas' || item.subcategoria === inventarioFiltro.subcategoria;

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
  const checklistPendientesBase = shoppingChecklist.filter((item) => !item.checked);
  const checklistPendientes = checklistPendientesBase.filter((item) => !getChecklistLinkedPurchase(item));
  const checklistCompletados = shoppingChecklist.filter((item) => item.checked || Boolean(getChecklistLinkedPurchase(item)));
  const checklistUrgentes = checklistPendientes.filter((item) => item.prioridad === 'alta');
  const checklistSeleccionado = checklistPendientesBase.filter((item) => selectedChecklistIds.includes(item.id));
  const purchaseSessionItems = purchaseSessionIds
    .map((id) => (almacenCompras?.lotes || []).find((item) => (item.id_compra || item.id_lote) === id))
    .filter(Boolean);
  const purchaseSessionPendingItems = purchaseSessionItems.filter((item) => {
    const receptionSummary = getPurchaseReceptionSummary(item);
    return receptionSummary?.statusLabel !== 'Recibido';
  });

  function getActivePurchaseForItem(itemOrId, description = '') {
    const lotes = almacenCompras?.lotes || [];
    const itemId = Number(itemOrId || 0);
    const normalizedDescription = String(description || '').trim().toLowerCase();
    const matches = lotes.filter((entry) => {
      if (itemId > 0) {
        return Number(entry.id_item) === itemId;
      }

      return String(entry.item_nombre || '').trim().toLowerCase() === normalizedDescription;
    });

    if (!matches.length) {
      return null;
    }

    const todayKey = toLocalDateKey();
    const sessionMatch = matches.find((entry) => purchaseSessionIds.includes(entry.id_compra || entry.id_lote));
    if (sessionMatch) {
      return sessionMatch;
    }

    const todayMatch = matches.find((entry) => toLocalDateKey(entry.fecha_compra_dia || entry.fecha_entrada) === todayKey);
    if (todayMatch) {
      return todayMatch;
    }

    return matches.find((entry) => entry.estatus === 'pendiente_recepcion') || null;
  }

  function getOperationalStockState(item) {
    const linkedPurchase = getActivePurchaseForItem(item?.id_item || item?.itemId, item?.nombre_item || item?.descripcion);
    if (!linkedPurchase) {
      return item?.semaforo || { label: 'Sin estado', className: 'neutral' };
    }

    return {
      label: linkedPurchase.estatus === 'recibida' ? 'Recibido' : 'Compra registrada',
      className: 'verde'
    };
  }

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
      prioridad: 'media',
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
      prioridad: item?.prioridad || 'media',
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
      const priorityMatch = itemLine.match(/ · prioridad:(alta|media|baja)/i);

      accumulator[item.id] = {
        llego: itemLine.startsWith('✓'),
        noLlego: itemLine.startsWith('✗'),
        cantidadRecibida: quantityMatch?.[1] || fallback.cantidadRecibida,
        condicion: conditionMatch?.[1]?.toLowerCase() || fallback.condicion,
        prioridad: priorityMatch?.[1]?.toLowerCase() || fallback.prioridad,
        nota: noteMatch?.[1] || ''
      };
      return accumulator;
    }, {});
  }

  function getPurchaseReceptionSummary(purchase) {
    const recepcionItem = buildPurchaseReceptionItem(purchase);
    if (!recepcionItem) {
      return null;
    }

    const state = buildRecepcionStateFromPurchase([recepcionItem], purchase)[recepcionItem.id] || getRecepcionDefaultState(recepcionItem);
    const statusTone = state.llego ? 'ok' : state.noLlego ? 'missing' : 'pending';
    const statusLabel = state.llego ? 'Recibido' : state.noLlego ? 'No llegó' : 'Pendiente';
    const detail = state.llego
      ? `${getReceptionConditionLabel(state.condicion)} · ${getReceptionPriorityLabel(state.prioridad)}`
      : getReceptionPriorityLabel(state.prioridad);

    return {
      tone: statusTone,
      statusLabel,
      detail
    };
  }

  function getPurchaseItemResetForm(current) {
    return {
      ...current,
      purchase_flow: 'lista',
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
        subcategoria: current.item_nuevo?.subcategoria || 'Verduras frescas',
        tipo_conservacion: current.item_nuevo?.tipo_conservacion || 'Refrigerado',
        unidad_consumo: current.item_nuevo?.unidad_consumo || current.unidad_compra || 'kg'
      }
    };
  }

  function hasMeaningfulRecepcionChanges(items, currentState) {
    return items.some((item) => {
      const current = currentState[item.id] || getRecepcionDefaultState(item);
      return current.llego || current.noLlego || String(current.nota || '').trim() || current.condicion !== 'buena' || current.prioridad !== (item?.prioridad || 'media') || String(current.cantidadRecibida || '') !== String(item.cantidad || '');
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
          prioridad: recepcion.prioridad || 'media',
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
      const prioridad = ` · prioridad:${recepcion.prioridad || 'media'}`;
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
      return `${llegada} ${nombre}${cant}${precioStr}${cond}${prioridad}${nota}`;
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
    setSeleccion((current) => ({ ...current, compra: null }));
    setSelectedChecklistIds([]);
    setRecepcionChecklist({});
    setAutoSaveReceptionState('idle');
    lastAutoSavedReceptionRef.current = '';
    setPurchaseForm((current) => ({
      ...current,
      itemMode: 'existing',
      id_item: String(item?.id_item || ''),
      purchase_flow: 'lista',
      item_query: item ? getPurchaseCatalogLabel(item) : '',
      unidad_compra: item?.unidad_consumo || current.unidad_compra,
      unit_query: getPurchaseUnitLabel(item?.unidad_consumo || current.unidad_compra),
      precio_unitario_compra: item?.ultimo_precio_compra || item?.precio_competencia_promedio || current.precio_unitario_compra
    }));
  }

  function renderPurchaseSessionCards() {
    const cards = purchaseSessionPendingItems;

    if (!cards.length) {
      return <p className="panel-empty">Todavia no has guardado insumos en este detalle.</p>;
    }

    return (
      <div className="purchase-session-grid">
        {cards.map((item) => {
          const receptionSummary = getPurchaseReceptionSummary(item);
          return (
            <button
              type="button"
              className={`purchase-session-card ${seleccion.compra === (item.id_compra || item.id_lote) ? 'selected' : ''}`}
              key={`${item.id_compra || item.id_lote}-${item.id_lote}`}
              onClick={() => handleSelectRegistro('compra', item)}
            >
              <div>
                <strong>{item.item_nombre}</strong>
                <span>{item.cantidad_recibida} {item.unidad_consumo} · {item.proveedor_nombre}</span>
                {receptionSummary && (
                  <small className={`purchase-session-status ${receptionSummary.tone}`}>
                    {receptionSummary.statusLabel} · {receptionSummary.detail}
                  </small>
                )}
                <small>{formatDateTime(item.fecha_entrada)}</small>
              </div>
              <em>{formatCurrency(item.total_lote)}</em>
            </button>
          );
        })}
      </div>
    );
  }

  function renderComprasTable() {
    const compras = almacenCompras?.lotes || [];
    const lotesOrdenados = compras.slice().sort((a, b) => new Date(b.fecha_entrada || 0).getTime() - new Date(a.fecha_entrada || 0).getTime()).slice(0, 20);

    if (!lotesOrdenados.length) {
      return <p className="panel-empty">No hay compras registradas.</p>;
    }

    return (
      <div className="table-responsive">
        <table className="data-table">
          <thead>
            <tr>
              <th>Insumo</th>
              <th>Cantidad</th>
              <th>Proveedor</th>
              <th>Total</th>
              <th>Estado</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {lotesOrdenados.map((compra) => (
              <tr key={`${compra.id_compra || compra.id_lote}`}>
                <td>{compra.item_nombre}</td>
                <td>{compra.cantidad_recibida} {compra.unidad_consumo}</td>
                <td>{compra.proveedor_nombre}</td>
                <td>{formatCurrency(compra.total_lote)}</td>
                <td>
                  <span className={`badge badge-${getEstadoCompraColor(compra.estado_compra || 'sugerida')}`}>
                    {getEstadoCompraLabel(compra.estado_compra || 'sugerida')}
                  </span>
                </td>
                <td className="table-actions">
                  {(compra.estado_compra || 'sugerida') === 'sugerida' && (
                    <button 
                      className="action-btn small"
                      onClick={async () => {
                        const { cambiarEstadoCompra } = await import('../../services/almacenCompras');
                        await cambiarEstadoCompra(compra.id_compra || compra.id_lote, 'pedida');
                        await cargarAlmacen();
                      }}
                    >
                      Pedir
                    </button>
                  )}
                  {(compra.estado_compra || 'sugerida') === 'pedida' && (
                    <button 
                      className="action-btn small"
                      onClick={() => abrirRecepcion(compra)}
                    >
                      Recibir
                    </button>
                  )}
                  {(compra.estado_compra || 'sugerida') === 'recibida' && (
                    <button 
                      className="action-btn small"
                      onClick={() => abrirPago(compra)}
                    >
                      Pagar
                    </button>
                  )}
                  {(compra.estado_compra || 'sugerida') === 'pagada' && (
                    <span className="badge-check">✓</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
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
    const shouldApplyInventory = activeReceptionItems.some((item) => {
      const recepcion = recepcionChecklist[item.id] || getRecepcionDefaultState(item);
      return Boolean(recepcion.llego);
    });
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
        applyInventory: shouldApplyInventory,
        modulo: selectedPurchase.modulo || operationScope,
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
    const allItemsReviewed = activeReceptionItems.every((item) => {
      const recepcion = recepcionChecklist[item.id] || getRecepcionDefaultState(item);
      return Boolean(recepcion.llego || recepcion.noLlego);
    });

    if (allItemsReviewed) {
      setPurchaseSessionIds((current) => current.filter((id) => id !== compraId));
      setSelectedChecklistIds([]);
      setRecepcionChecklist({});
      setSeleccion((current) => ({ ...current, compra: null }));
      setAutoSaveReceptionState('idle');
      await cargarAlmacen();
      return;
    }

    setAutoSaveReceptionState('saved');
    await cargarAlmacen();
    setSeleccion((current) => ({ ...current, compra: result.data?.id_compra || compraId }));
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

  function getCatalogItemById(itemId) {
    return catalogoReceta.find((item) => item.id_item === Number(itemId)) || null;
  }

  function getRecipeWaste(itemId) {
    return calcularMermaAutomatica(getCatalogItemById(itemId));
  }

  function setFeedback(message = '', errorMessage = '') {
    setOperationMessage(message);
    setOperationError(errorMessage);
  }

  function abrirCompras(record = null) {
    setGestionActiva('compra');

    if (record?.id_lote) {
      setSeleccion((current) => ({ ...current, compra: record.id_compra || record.id_lote }));
      setAutoSaveReceptionState('idle');
      const recepcionItem = buildPurchaseReceptionItem(record);
      if (recepcionItem) {
        const hydratedReception = buildRecepcionStateFromPurchase([recepcionItem], record);
        setSelectedChecklistIds([]);
        setRecepcionChecklist((current) => ({ ...current, ...hydratedReception }));
        lastAutoSavedReceptionRef.current = serializeRecepcionSnapshot(record.id_compra || record.id_lote, [recepcionItem], hydratedReception);
      } else {
        lastAutoSavedReceptionRef.current = '';
      }
      return;
    }

    setSeleccion((current) => ({ ...current, compra: null }));
  }

  function handleSelectChecklistCompra(item) {
    setSeleccion((current) => ({ ...current, compra: null }));
    setAutoSaveReceptionState('idle');
    lastAutoSavedReceptionRef.current = '';
    setSelectedChecklistIds((current) => {
      const exists = current.includes(item.id);
      const next = exists ? current.filter((entry) => entry !== item.id) : [...current, item.id];
      return next;
    });

    setRecepcionChecklist((current) => {
      if (current[item.id]) return current;
      return {
        ...current,
        [item.id]: getRecepcionDefaultState(item)
      };
    });

    if (item.itemId) {
      const catalogItem = (almacenCompras?.catalogo || []).find((c) => Number(c.id_item) === item.itemId);
      setPurchaseForm((current) => ({
        ...current,
        purchase_flow: 'lista',
        itemMode: 'existing',
        id_item: String(item.itemId),
        item_query: catalogItem ? getPurchaseCatalogLabel(catalogItem) : item.descripcion || '',
        unidad_compra: catalogItem?.unidad_consumo || current.unidad_compra,
        unit_query: getPurchaseUnitLabel(catalogItem?.unidad_consumo || current.unidad_compra),
        cantidad_recibida: item.cantidad || '',
        precio_unitario_compra: catalogItem?.ultimo_precio_compra || catalogItem?.precio_competencia_promedio || ''
      }));
      return;
    }

    setPurchaseForm((current) => ({
      ...current,
      purchase_flow: 'lista',
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
    setRecepcionChecklist((current) => ({
      ...current,
      [itemId]: { ...(current[itemId] || {}), [campo]: valor }
    }));
  }

  function abrirRecetaDesdeRuta(receta) {
    setQuickFocus('recetas');
    setRecetaSeleccionadaId(receta?.id_recetario || null);
    setIngredienteSeleccionadoId(null);
    if (onNavigateSection) {
      onNavigateSection(recetarioSectionKey);
    }
  }

  function abrirCompraSugerida(item) {
    setQuickFocus('compras-sugeridas');
    setGestionActiva('compra');
    setPurchaseForm((current) => ({
      ...current,
      itemMode: 'existing',
      id_item: String(item?.id_item || ''),
      item_query: item ? getPurchaseCatalogLabel(item) : '',
      unidad_compra: item?.unidad_consumo || current.unidad_compra,
      unit_query: getPurchaseUnitLabel(item?.unidad_consumo || current.unidad_compra),
      id_proveedor: String(item?.mejor_proveedor_id || '')
    }));
    if (onNavigateSection) {
      onNavigateSection(almacenSectionKey);
    }
  }

  function abrirCompraManual() {
    setQuickFocus('compras-sugeridas');
    abrirCompras();
    if (onNavigateSection) {
      onNavigateSection(almacenSectionKey);
    }
  }

  function resetActiveForm(section = gestionActiva) {
    if (section === 'inventario') {
      setItemForm(getDefaultItemForm());
      setSeleccion((current) => ({ ...current, inventario: null }));
    }

    if (section === 'proveedor') {
      setProviderForm(getDefaultProviderForm());
      setSeleccion((current) => ({ ...current, proveedor: null }));
    }

    if (section === 'compra') {
      setPurchaseForm(getDefaultPurchaseForm());
      setManualChecklistForm(getDefaultChecklistForm());
      setSeleccion((current) => ({ ...current, compra: null }));
      setSelectedChecklistIds([]);
      setRecepcionChecklist({});
      setAutoSaveReceptionState('idle');
      setPurchaseSessionIds([]);
      lastAutoSavedReceptionRef.current = '';
    }
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
      nombre_item: item.nombre_item || '',
      categoria: item.categoria || 'ingredientes',
      subcategoria: item.subcategoria || 'Verduras frescas',
      tipo_conservacion: item.tipo_conservacion || 'Refrigerado',
      unidad_consumo: item.unidad_consumo || 'kg',
      stock_actual: item.stock_actual ?? '',
      punto_reorden: item.punto_reorden ?? '',
      precio_competencia_promedio: item.precio_competencia_promedio ?? '',
      fuente_competencia: item.fuente_competencia || '',
      fecha_analisis_mercado: item.fecha_analisis_mercado || getTodayDate(),
      es_inventariable: item.es_inventariable !== false
    });
  }

  function loadProviderIntoForm(provider) {
    setProviderForm({
      nombre_prov: provider.nombre_prov || '',
      tipo_proveedor: provider.tipo_proveedor || TIPOS_PROVEEDOR[0],
      telefono_prov: provider.telefono_prov || '',
      correo_prov: provider.correo_prov || '',
      direccion_prov: provider.direccion_prov || ''
    });
  }

  function loadPurchaseIntoForm(lote) {
    const purchaseMeta = parsePurchaseMetadata(lote.observaciones_compra || '');
    setPurchaseForm({
      ...purchaseMeta.metadata,
      itemMode: 'existing',
      id_item: lote.id_item ? String(lote.id_item) : '',
      item_query: lote.item_nombre ? `${lote.item_nombre} · ${lote.item_subcategoria || 'Sin categoría'}` : '',
      unidad_compra: lote.unidad || lote.unidad_compra || 'kg',
      unit_query: getPurchaseUnitLabel(lote.unidad || lote.unidad_compra || 'kg'),
      provider_query: lote.proveedor_nombre || '',
      id_proveedor: lote.id_proveedor ? String(lote.id_proveedor) : '',
      cantidad_recibida: lote.cantidad_recibida ?? '',
      precio_unitario_compra: lote.precio_unitario_compra ?? '',
      fecha_entrada: getLocalDatetimeValue(lote.fecha_entrada),
      folio_externo: lote.folio_externo || '',
      observaciones_compra: purchaseMeta.baseNote,
      purchase_flow: purchaseMeta.metadata.purchase_flow || 'lista',
      providerMode: 'existing',
      item_nuevo: getDefaultPurchaseForm().item_nuevo,
      proveedor_nuevo: getDefaultProviderForm()
    });
  }

  function setRecetaFeedback(message = '', errorMessage = '') {
    setRecetaOperationMessage(message);
    setRecetaOperationError(errorMessage);
  }

  function loadRecipeIntoForm(receta) {
    setRecetaForm({
      id_recetario: receta.id_recetario,
      nombre_platillo: receta.nombre_platillo || '',
      tipo_categoria: receta.tipo_categoria || TIPOS_RECETA[0],
      recetas_relacionadas:
        receta.recetas_relacionadas?.map((relacion) => ({
          id_receta_relacionada: relacion.id_receta_relacionada ? String(relacion.id_receta_relacionada) : '',
          tipo_relacion: relacion.tipo_relacion || TIPOS_RELACION_RECETA[0],
          cantidad_relacionada: relacion.cantidad_relacionada ?? '1'
        })) || [],
      imagen_platillo: receta.imagen_platillo || '',
      precio_venta_fijo: receta.precio_venta_fijo ?? '',
      rendimiento_personas: receta.rendimiento_personas ?? '1',
      procedimiento_preparacion: receta.procedimiento_preparacion || '',
      tiempo_total_estimado_min: receta.tiempo_total_estimado_min ?? '',
      detalles:
        receta.escandallo?.map((detail) => ({
          id_escandallo: detail.id_escandallo,
          id_item: detail.id_item ? String(detail.id_item) : '',
          unidad_medida_receta: detail.unidad_medida_receta || detail.unidad_consumo || 'kg',
          cantidad_utilizada: detail.cantidad_utilizada ?? '',
          merma_porcentaje: detail.merma_porcentaje ?? getRecipeWaste(detail.id_item),
          tiempo_preparacion_min: detail.tiempo_preparacion_min ?? ''
        })) || [getDefaultRecipeDetail()]
    });
  }

  function resetRecipeForm() {
    setRecetaForm(getDefaultRecipeForm());
    setRecetaSeleccionadaId(null);
    setIngredienteSeleccionadoId(null);
    setRecetaFeedback();
  }

  function handleSelectReceta(receta) {
    setRecetaSeleccionadaId(receta.id_recetario);
    setIngredienteSeleccionadoId(receta.escandallo?.[0]?.id_escandallo || null);
    loadRecipeIntoForm(receta);
    setRecetaFeedback();
  }

  function updateRecipeField(field, value) {
    setRecetaForm((current) => ({ ...current, [field]: value }));
  }

  function updateRecipeRelation(index, field, value) {
    setRecetaForm((current) => ({
      ...current,
      recetas_relacionadas: current.recetas_relacionadas.map((relacion, relationIndex) =>
        relationIndex === index ? { ...relacion, [field]: value } : relacion
      )
    }));
  }

  function agregarRecetaRelacionada() {
    setRecetaForm((current) => ({
      ...current,
      recetas_relacionadas: [...current.recetas_relacionadas, getDefaultRecipeRelation()]
    }));
  }

  function eliminarRecetaRelacionada(index) {
    setRecetaForm((current) => ({
      ...current,
      recetas_relacionadas: current.recetas_relacionadas.filter((_, relationIndex) => relationIndex !== index)
    }));
  }

  function handleRecipeImageChange(event) {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    if (!file.type.startsWith('image/')) {
      setRecetaFeedback('', 'Solo puedes subir imágenes para la receta.');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      updateRecipeField('imagen_platillo', String(reader.result || ''));
      setRecetaFeedback('Imagen cargada en la receta.');
    };
    reader.onerror = () => {
      setRecetaFeedback('', 'No se pudo leer la imagen seleccionada.');
    };
    reader.readAsDataURL(file);
  }

  function updateRecipeDetail(index, field, value) {
    setRecetaForm((current) => ({
      ...current,
      detalles: current.detalles.map((detail, detailIndex) =>
        detailIndex === index
          ? {
              ...detail,
              [field]: value,
              ...(field === 'id_item'
                ? {
                    merma_porcentaje: getRecipeWaste(value),
                    unidad_medida_receta:
                      detail.unidad_medida_receta ||
                      catalogoReceta.find((item) => item.id_item === Number(value))?.unidad_consumo ||
                      detail.unidad_medida_receta
                  }
                : {})
            }
          : detail
      )
    }));
  }

  function agregarDetalleReceta() {
    setRecetaForm((current) => ({ ...current, detalles: [...current.detalles, getDefaultRecipeDetail()] }));
  }

  function eliminarDetalleReceta(index) {
    setRecetaForm((current) => ({
      ...current,
      detalles:
        current.detalles.length > 1
          ? current.detalles.filter((_, detailIndex) => detailIndex !== index)
          : [getDefaultRecipeDetail()]
    }));
  }

  async function handleGuardarReceta() {
    if (!user.business_id) {
      setRecetaFeedback('', 'Tu usuario no tiene negocio asignado para operar este módulo.');
      return;
    }

    setIsSavingReceta(true);
    setRecetaFeedback();

    const result = await guardarRecetaConEscandallo({
      businessId: user.business_id,
      recetaId: recetaForm.id_recetario,
      data: recetaForm
    });

    if (result.error) {
      setRecetaFeedback('', result.error);
      setIsSavingReceta(false);
      return;
    }

    const data = await cargarRecetario();
    const recetaGuardada = data?.recetas?.find((item) => item.id_recetario === result.data?.id_recetario) || null;

    if (recetaGuardada) {
      handleSelectReceta(recetaGuardada);
    }

    setRecetaFeedback('Receta guardada correctamente.');
    setIsSavingReceta(false);
  }

  async function handleEliminarReceta() {
    if (!recetaSeleccionada) {
      setRecetaFeedback('', 'Selecciona una receta para eliminar.');
      return;
    }

    if (!window.confirm(`Se eliminará ${recetaSeleccionada.nombre_platillo} con todo su escandallo.`)) {
      return;
    }

    setIsSavingReceta(true);
    const result = await eliminarRecetaConEscandallo(recetaSeleccionada.id_recetario);
    setIsSavingReceta(false);

    if (result.error) {
      setRecetaFeedback('', result.error);
      return;
    }

    await cargarRecetario();
    resetRecipeForm();
    setRecetaFeedback('Receta eliminada correctamente.');
  }

  function handleSelectRegistro(section, record) {
    setGestionActiva(section);

    if (section === 'inventario') {
      setSeleccion((current) => ({ ...current, inventario: record.id_item }));
      loadItemIntoForm(record);
    }

    if (section === 'proveedor') {
      setSeleccion((current) => ({ ...current, proveedor: record.id_proveedor }));
    }

    if (section === 'compra') {
      setSeleccion((current) => ({ ...current, compra: record.id_compra || record.id_lote }));
      setSelectedChecklistIds([]);
      setAutoSaveReceptionState('idle');
      const recepcionItem = buildPurchaseReceptionItem(record);
      if (recepcionItem) {
        const hydratedReception = buildRecepcionStateFromPurchase([recepcionItem], record);
        setRecepcionChecklist((current) => ({ ...current, ...hydratedReception }));
        lastAutoSavedReceptionRef.current = serializeRecepcionSnapshot(record.id_compra || record.id_lote, [recepcionItem], hydratedReception);
      } else {
        lastAutoSavedReceptionRef.current = '';
      }
    }
  }

  function getChecklistLinkedPurchase(item) {
    return getActivePurchaseForItem(item?.itemId, item?.descripcion);
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
      setSeleccion((current) => ({ ...current, compra: nextCompraId }));
      setSelectedChecklistIds([item.id]);
      setRecepcionChecklist((current) => ({ ...current, ...hydratedReception }));
      loadPurchaseIntoForm(linkedPurchase);
      lastAutoSavedReceptionRef.current = serializeRecepcionSnapshot(nextCompraId, [item], hydratedReception);
      setAutoSaveReceptionState(hasMeaningfulRecepcionChanges([item], hydratedReception) ? 'saved' : 'idle');
      return;
    }

    handleSelectChecklistCompra(item);
  }

  async function guardarCompraDesdeFormulario({ keepOpenForNext = false } = {}) {
    if (!user.business_id) {
      setFeedback('', 'Tu usuario no tiene negocio asignado para operar este módulo.');
      return null;
    }

    setIsSaving(true);
    setFeedback();

    const observacionesFinal = buildPurchaseObservacionesConRecepcion({
      baseNote: purchaseForm.observaciones_compra,
      purchaseFlow: purchaseForm.purchase_flow || 'lista',
      evidenceType: purchaseForm.evidence_type,
      items: activeReceptionItems,
      currentState: recepcionChecklist,
      responsable: user.nombre_completo,
      rol: user.rol_nombre
    });

    const result = await guardarCompra({
      businessId: user.business_id,
      loteId: seleccion.compra,
      data: {
        ...purchaseForm,
        purchase_flow: purchaseForm.purchase_flow || 'lista',
        applyInventory: false,
        observaciones_compra: observacionesFinal,
        responsable_registro: user.nombre_completo,
        rol_registro: user.rol_nombre
      }
    });

    if (result.error) {
      setFeedback('', result.error);
      setIsSaving(false);
      return null;
    }

    await cargarAlmacen();
    const nextCompraId = result.data?.id_compra || result.data?.id_lote || null;
    if (nextCompraId) {
      setPurchaseSessionIds((current) => Array.from(new Set([nextCompraId, ...current])));
    }
    setSeleccion((current) => ({ ...current, compra: keepOpenForNext ? null : nextCompraId }));
    setFeedback(keepOpenForNext ? 'Insumo guardado y agregado al detalle de compra. Falta palomear recepción para mandarlo a inventario.' : 'Compra guardada en el sistema. Falta recepción para aplicarla a inventario.');
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

  function handleEditar() {
    setFeedback();

    if (gestionActiva === 'inventario') {
      if (!selectedItem) {
        setFeedback('', 'Selecciona un insumo antes de editar.');
        return;
      }

      loadItemIntoForm(selectedItem);
      return;
    }

    if (gestionActiva === 'proveedor') {
      if (!selectedProvider) {
        setFeedback('', 'Selecciona un proveedor antes de editar.');
        return;
      }

      loadProviderIntoForm(selectedProvider);
      return;
    }

    if (!selectedPurchase) {
      setFeedback('', 'Selecciona una compra antes de editar.');
      return;
    }

    loadPurchaseIntoForm(selectedPurchase);
  }

  async function handleGuardar() {
    if (!user.business_id) {
      setFeedback('', 'Tu usuario no tiene negocio asignado para operar este módulo.');
      return;
    }

    setIsSaving(true);
    setFeedback();

    if (gestionActiva === 'inventario') {
      const result = await guardarItemCatalogo({
        businessId: user.business_id,
        itemId: seleccion.inventario,
        data: itemForm
      });

      if (result.error) {
        setFeedback('', result.error);
        setIsSaving(false);
        return;
      }

      await cargarAlmacen();
      setSeleccion((current) => ({ ...current, inventario: result.data?.id_item || null }));
      setFeedback('Inventario guardado correctamente.');
      if (result.data) {
        loadItemIntoForm(result.data);
      }
      setIsSaving(false);
      return;
    }

    if (gestionActiva === 'proveedor') {
      const result = await guardarProveedor({
        businessId: user.business_id,
        providerId: seleccion.proveedor,
        data: providerForm
      });

      if (result.error) {
        setFeedback('', result.error);
        setIsSaving(false);
        return;
      }

      await cargarAlmacen();
      setSeleccion((current) => ({ ...current, proveedor: result.data?.id_proveedor || null }));
      setFeedback('Proveedor guardado correctamente.');
      if (result.data) {
        loadProviderIntoForm(result.data);
      }
      setIsSaving(false);
      return;
    }

    setIsSaving(false);
    await guardarCompraDesdeFormulario({ keepOpenForNext: true });
  }

  async function handleEliminar() {
    setFeedback();

    if (gestionActiva === 'inventario') {
      if (!selectedItem) {
        setFeedback('', 'Selecciona un insumo para eliminar.');
        return;
      }

      if (!window.confirm(`Se eliminará ${selectedItem.nombre_item}.`)) {
        return;
      }

      setIsSaving(true);
      const result = await eliminarItemCatalogo(selectedItem.id_item);
      setIsSaving(false);

      if (result.error) {
        setFeedback('', result.error);
        return;
      }

      await cargarAlmacen();
      resetActiveForm('inventario');
      setFeedback('Insumo eliminado correctamente.');
      return;
    }

    if (gestionActiva === 'proveedor') {
      if (!selectedProvider) {
        setFeedback('', 'Selecciona un proveedor para eliminar.');
        return;
      }

      if (!window.confirm(`Se desactivará ${selectedProvider.nombre_prov}. Los datos se guardarán pero no aparecerá en cotizaciones.`)) {
        return;
      }

      setIsSaving(true);
      const result = await eliminarProveedor(selectedProvider.id_proveedor);
      setIsSaving(false);

      // Si falla en BD, guardar localmente como inactivo
      if (result.error) {
        const isRLSBlocked = result.error.includes('policy') || result.error.includes('406') || result.error.includes('permission');
        if (isRLSBlocked) {
          // Guardar en localStorage que está inactivo
          const cacheKey = `inactivo_prov_${selectedProvider.id_proveedor}`;
          localStorage.setItem(cacheKey, JSON.stringify({
            desactivado: true,
            timestamp: new Date().toISOString()
          }));
          // NO mostrar error, actuar como si funcionó
          setFeedback('Proveedor desactivado correctamente (guardado localmente).');
        } else {
          setFeedback('', result.error);
          setIsSaving(false);
          return;
        }
      } else {
        setFeedback('Proveedor desactivado correctamente.');
      }

      await cargarAlmacen();
      resetActiveForm('proveedor');
      return;
    }

    if (!selectedPurchase) {
      setFeedback('', 'Selecciona una compra para eliminar.');
      return;
    }

    if (!window.confirm(`Se eliminará el lote #${selectedPurchase.id_lote}.`)) {
      return;
    }

    setIsSaving(true);
    const result = await eliminarCompra(selectedPurchase.id_compra || selectedPurchase.id_lote);
    setIsSaving(false);

    if (result.error) {
      setFeedback('', result.error);
      return;
    }

    await cargarAlmacen();
    resetActiveForm('compra');
    setFeedback('Compra eliminada y stock ajustado.');
  }

  function renderInventoryForm() {
    return (
      <div className="editor-form">
        <div className="form-grid-fields">
          <label>
            <span>Nombre del insumo</span>
            <input
              value={itemForm.nombre_item}
              onChange={(event) => setItemForm((current) => ({ ...current, nombre_item: event.target.value }))}
              placeholder="Ej. Tomate saladet"
            />
          </label>
          <label>
            <span>Categoría base</span>
            <select
              value={itemForm.categoria}
              onChange={(event) => setItemForm((current) => ({ ...current, categoria: event.target.value }))}
            >
              {CATEGORIAS_CATALOGO.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>Subcategoría</span>
            <select
              value={itemForm.subcategoria}
              onChange={(event) => setItemForm((current) => ({ ...current, subcategoria: event.target.value }))}
            >
              {subcategoriasDisponibles.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>Conservación</span>
            <select
              value={itemForm.tipo_conservacion}
              onChange={(event) => setItemForm((current) => ({ ...current, tipo_conservacion: event.target.value }))}
            >
              {TIPOS_CONSERVACION.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>Unidad de consumo</span>
            <input
              value={itemForm.unidad_consumo}
              onChange={(event) => setItemForm((current) => ({ ...current, unidad_consumo: event.target.value }))}
            />
          </label>
          <label>
            <span>Stock actual</span>
            <input
              type="number"
              step="0.001"
              value={itemForm.stock_actual}
              onChange={(event) => setItemForm((current) => ({ ...current, stock_actual: event.target.value }))}
            />
          </label>
          <label>
            <span>Fecha de análisis</span>
            <input
              type="date"
              value={itemForm.fecha_analisis_mercado}
              onChange={(event) =>
                setItemForm((current) => ({ ...current, fecha_analisis_mercado: event.target.value }))
              }
            />
          </label>
          <div className="purchase-total-card">
            <span>Control interno</span>
            <strong>Stock protegido</strong>
            <small>Máximo, mínimo y punto de reorden se calculan en código y no se muestran aquí.</small>
          </div>
        </div>
      </div>
    );
  }

  function renderProviderForm() {
    return (
      <div className="editor-form">
        <div className="form-grid-fields">
          <label>
            <span>Proveedor</span>
            <input
              value={providerForm.nombre_prov}
              onChange={(event) => setProviderForm((current) => ({ ...current, nombre_prov: event.target.value }))}
            />
          </label>
          <label>
            <span>Tipo de proveedor</span>
            <select
              value={providerForm.tipo_proveedor}
              onChange={(event) => setProviderForm((current) => ({ ...current, tipo_proveedor: event.target.value }))}
            >
              {TIPOS_PROVEEDOR.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>Teléfono</span>
            <input
              value={providerForm.telefono_prov}
              onChange={(event) => setProviderForm((current) => ({ ...current, telefono_prov: event.target.value }))}
            />
          </label>
          <label>
            <span>Correo</span>
            <input
              type="email"
              value={providerForm.correo_prov}
              onChange={(event) => setProviderForm((current) => ({ ...current, correo_prov: event.target.value }))}
            />
          </label>
          <label className="field-span-2">
            <span>Dirección</span>
            <textarea
              rows="3"
              value={providerForm.direccion_prov}
              onChange={(event) => setProviderForm((current) => ({ ...current, direccion_prov: event.target.value }))}
            />
          </label>
        </div>
      </div>
    );
  }

  function renderPurchaseForm() {
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
    const evidenceReferenceLabel =
      evidenceType === 'manual'
        ? 'Descripción breve de la compra'
        : evidenceType === 'ticket'
          ? 'Número de ticket'
          : 'Folio o factura';
    const evidenceReferencePlaceholder =
      evidenceType === 'manual'
        ? 'Ej. Compra en cremería nueva, sin folio'
        : evidenceType === 'ticket'
          ? 'Ej. T-2048'
          : 'Ej. FAC-2026-018';

    return (
      <div className="editor-form">
        <div className="form-grid-fields">
          <label>
            <span>Soporte de compra</span>
            <select
              value={purchaseForm.evidence_type}
              onChange={(event) => setPurchaseForm((current) => ({ ...current, evidence_type: event.target.value }))}
            >
              {PURCHASE_EVIDENCE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>{evidenceReferenceLabel}</span>
            <input
              value={purchaseForm.folio_externo}
              onChange={(event) => setPurchaseForm((current) => ({ ...current, folio_externo: event.target.value }))}
              placeholder={evidenceReferencePlaceholder}
            />
          </label>
          <div className="field-span-2 helper-note">
            Usa Guardar para agregar este insumo al detalle de compra. Se queda fijo del lado derecho y luego sigues con el siguiente.
          </div>
          <label>
            <span>Compra rápida</span>
            <>
              <input
                list="restaurante-purchase-catalog"
                value={purchaseForm.item_query}
                onChange={(event) => {
                  const nextQuery = event.target.value;
                  const match = findCatalogMatch(almacenCompras?.catalogo || [], nextQuery);
                  const nextItemDraft = inferQuickItemFields(nextQuery);
                  setPurchaseForm((current) => ({
                    ...current,
                    item_query: nextQuery,
                    itemMode: match ? 'existing' : 'new',
                    id_item: match ? String(match.id_item) : '',
                    unidad_compra: match?.unidad_consumo || nextItemDraft.unidad_consumo,
                    unit_query: getPurchaseUnitLabel(match?.unidad_consumo || nextItemDraft.unidad_consumo),
                    item_nuevo: {
                      ...current.item_nuevo,
                      ...nextItemDraft,
                      nombre_item: nextQuery
                    }
                  }));
                }}
                placeholder="Escribe crema, queso fresco, aguacate..."
              />
              <datalist id="restaurante-purchase-catalog">
                {(almacenCompras?.catalogo || []).map((item) => (
                  <option key={item.id_item} value={getPurchaseCatalogLabel(item)} />
                ))}
              </datalist>
            </>
          </label>

          <div className="field-span-2 helper-note">
            {matchedCatalogItem
              ? `Reconocido en catálogo: ${matchedCatalogItem.nombre_item} · ${matchedCatalogItem.subcategoria || matchedCatalogItem.categoria}.`
              : 'Si no existe en catálogo, el sistema lo toma como compra rápida y abajo solo completas los datos mínimos para darlo de alta.'}
          </div>
          {!matchedCatalogItem && purchaseForm.item_query && (
            <div className="field-span-2 helper-note">
              {`Detección sugerida: ${inferredItem.categoria} → ${inferredItem.subcategoria} · ${inferredItem.unidad_consumo} · ${inferredItem.tipo_conservacion}. Si hace falta, aquí mismo puedes ajustar categoría y subcategoría antes de guardar.`}
            </div>
          )}

          {!matchedCatalogItem && purchaseForm.item_query && (
            <>
              <label>
                <span>Categoría base</span>
                <select
                  value={purchaseForm.item_nuevo.categoria}
                  onChange={(event) =>
                    setPurchaseForm((current) => ({
                      ...current,
                      item_nuevo: {
                        ...current.item_nuevo,
                        categoria: event.target.value
                      }
                    }))
                  }
                >
                  {CATEGORIAS_CATALOGO.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span>Subcategoría</span>
                <select
                  value={purchaseForm.item_nuevo.subcategoria}
                  onChange={(event) =>
                    setPurchaseForm((current) => ({
                      ...current,
                      item_nuevo: {
                        ...current.item_nuevo,
                        subcategoria: event.target.value
                      }
                    }))
                  }
                >
                  {subcategoriasCompraRapida.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </label>
            </>
          )}

          <label>
            <span>Unidad de compra</span>
            <>
              <input
                list="restaurante-purchase-units"
                value={purchaseForm.unit_query || ''}
                onChange={(event) => {
                  const nextQuery = event.target.value;
                  const match = findPurchaseUnitMatch(nextQuery);
                  setPurchaseForm((current) => ({
                    ...current,
                    unit_query: nextQuery,
                    unidad_compra: match?.value || nextQuery.trim() || ''
                  }));
                }}
                placeholder="Escribe kg, caja, bulto, costal, pieza..."
              />
              <datalist id="restaurante-purchase-units">
                {UNIDADES_COMPRA.map((unit) => (
                  <option key={unit.value} value={unit.label} />
                ))}
              </datalist>
            </>
          </label>
          <div className="field-span-2 helper-note">
            {matchedUnit
              ? `Unidad detectada: ${matchedUnit.label} · ${matchedUnit.grupo}.`
              : purchaseForm.unit_query
                ? `Se guardará como unidad personalizada: ${purchaseForm.unit_query}.`
                : `Unidad sugerida por el insumo: ${getPurchaseUnitLabel(suggestedUnitValue)}.`}
          </div>
          <div className="field-span-2 convertidor-live">
            <span className="convertidor-label">Sugerencias rápidas:</span>
            <div className="convertidor-chips">
              {suggestedUnits.map((unit) => (
                <button
                  key={unit.value}
                  type="button"
                  className="convertidor-chip"
                  onClick={() =>
                    setPurchaseForm((current) => ({
                      ...current,
                      unidad_compra: unit.value,
                      unit_query: unit.label
                    }))
                  }
                >
                  {unit.label}
                </button>
              ))}
            </div>
          </div>

          <label>
            <span>Proveedor o lugar de compra</span>
            <>
              <input
                list="restaurante-provider-catalog"
                value={purchaseForm.provider_query}
                onChange={(event) => {
                  const nextQuery = event.target.value;
                  const match = findQuickProviderMatch(almacenCompras?.proveedores || [], nextQuery);
                  const nextProviderDraft = inferQuickProviderFields(nextQuery);
                  setPurchaseForm((current) => ({
                    ...current,
                    provider_query: nextQuery,
                    providerMode: match ? 'existing' : 'quick',
                    id_proveedor: match ? String(match.id_proveedor) : '',
                    proveedor_nuevo: {
                      ...current.proveedor_nuevo,
                      nombre_prov: nextQuery,
                      tipo_proveedor: match?.tipo_proveedor || nextProviderDraft.tipo_proveedor
                    }
                  }));
                }}
                placeholder="Escribe mercado, abastos, Luna, proveedor..."
              />
              <datalist id="restaurante-provider-catalog">
                {(almacenCompras?.proveedores || []).map((item) => (
                  <option key={item.id_proveedor} value={getQuickProviderDisplayLabel(item)} />
                ))}
              </datalist>
            </>
          </label>

          <div className="field-span-2 helper-note">
            {matchedProvider
              ? `Proveedor reconocido: ${matchedProvider.nombre_prov}. Se usará el registro ya guardado.`
              : purchaseForm.provider_query
                ? 'No se encontró ese proveedor. Completa abajo sus datos para darlo de alta junto con esta compra.'
                : 'Escribe el proveedor o el lugar de compra. Si ya existe, el sistema lo reconocerá solo.'}
          </div>

          {!matchedProvider && purchaseForm.provider_query && (
            <>
              <label>
                <span>Tipo de proveedor</span>
                <select
                  value={purchaseForm.proveedor_nuevo.tipo_proveedor || inferredProvider.tipo_proveedor}
                  onChange={(event) =>
                    setPurchaseForm((current) => ({
                      ...current,
                      proveedor_nuevo: { ...current.proveedor_nuevo, tipo_proveedor: event.target.value }
                    }))
                  }
                >
                  {TIPOS_PROVEEDOR.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span>Teléfono del proveedor</span>
                <input
                  value={purchaseForm.proveedor_nuevo.telefono_prov || ''}
                  onChange={(event) =>
                    setPurchaseForm((current) => ({
                      ...current,
                      proveedor_nuevo: { ...current.proveedor_nuevo, telefono_prov: event.target.value }
                    }))
                  }
                  placeholder="Opcional"
                />
              </label>
              <label>
                <span>Correo del proveedor</span>
                <input
                  type="email"
                  value={purchaseForm.proveedor_nuevo.correo_prov || ''}
                  onChange={(event) =>
                    setPurchaseForm((current) => ({
                      ...current,
                      proveedor_nuevo: { ...current.proveedor_nuevo, correo_prov: event.target.value }
                    }))
                  }
                  placeholder="Opcional"
                />
              </label>
              <label className="field-span-2">
                <span>Dirección o referencia del proveedor</span>
                <textarea
                  rows="2"
                  value={purchaseForm.proveedor_nuevo.direccion_prov || ''}
                  onChange={(event) =>
                    setPurchaseForm((current) => ({
                      ...current,
                      proveedor_nuevo: { ...current.proveedor_nuevo, direccion_prov: event.target.value }
                    }))
                  }
                  placeholder="Ej. Local 12, pasillo frío, colonia centro"
                />
              </label>
            </>
          )}

          {(() => {
            const unidadActual = activeUnit;
            const conversiones = convertirUnidades(purchaseForm.cantidad_recibida, unidadActual);

            return (
              <>
                <label>
                  <span>Cantidad recibida {unidadActual ? `(${unidadActual})` : ''}</span>
                  <input
                    type="number"
                    step="0.001"
                    value={purchaseForm.cantidad_recibida}
                    onChange={(event) => setPurchaseForm((current) => ({ ...current, cantidad_recibida: event.target.value }))}
                    placeholder={unidadActual ? `Ej. 5 ${unidadActual}` : 'Ej. 5, 0.5, 12'}
                  />
                </label>
                <label>
                  <span>Precio por {unidadActual || 'unidad'}</span>
                  <input
                    type="number"
                    step="0.01"
                    value={purchaseForm.precio_unitario_compra}
                    onChange={(event) =>
                      setPurchaseForm((current) => ({ ...current, precio_unitario_compra: event.target.value }))
                    }
                    placeholder={`$ por cada ${unidadActual || 'unidad'}`}
                  />
                </label>
                {conversiones.length > 0 && purchaseForm.cantidad_recibida && (
                  <div className="field-span-2 convertidor-live">
                    <span className="convertidor-label">Equivale a:</span>
                    <div className="convertidor-chips">
                      {conversiones.map((c, i) => (
                        <span key={i} className="convertidor-chip">{c.valor} {c.unidad}</span>
                      ))}
                    </div>
                  </div>
                )}
              </>
            );
          })()}
          <div className="purchase-total-card">
            <span>Total del lote</span>
            <strong>{formatCurrency(compraTotalPreview)}</strong>
            <small>Se agrega al detalle de compra en cuanto guardas este insumo.</small>
          </div>
          <div className="purchase-total-card">
            <span>Fecha y hora de captura</span>
            <strong>{formatDateTime(new Date())}</strong>
            <small>Se guardan solas al registrar la compra.</small>
          </div>
          <label className="field-span-2">
            <span>Notas de compra</span>
            <textarea
              rows="3"
              value={purchaseForm.observaciones_compra}
              onChange={(event) =>
                setPurchaseForm((current) => ({ ...current, observaciones_compra: event.target.value }))
              }
              placeholder="Ej. Compra para surtido de hoy, faltó una caja, mandado de última hora..."
            />
          </label>
          <div className="field-span-2 detail-inline-actions">
            <span className="recepcion-meta">Usa Guardar para registrar este insumo y dejarlo fijo en la lista del lado derecho. Luego capturas el siguiente.</span>
          </div>
          <div className="field-span-2 equivalencias-panel">
            <details>
              <summary>Guía de unidades y equivalencias</summary>
              <div className="equivalencias-grid">
                {filteredEquivalences.map((eq, idx) => (
                  <div className="equivalencia-row" key={idx}>
                    <strong>{eq.de}</strong>
                    <span>= {eq.a}</span>
                    <small>{eq.nota}</small>
                  </div>
                ))}
              </div>
              <div className="equivalencias-tip">
                Si compras por costal o bulto, registra la cantidad en la unidad base (kg, lt, pieza).
                Ejemplo: 1 costal de frijol = pon 25 kg como cantidad y el precio por kg.
              </div>
            </details>
          </div>
        </div>
      </div>
    );
  }

  function renderEditorPanel() {
    if (gestionActiva === 'inventario') {
      return renderInventoryForm();
    }

    if (gestionActiva === 'proveedor') {
      return renderProviderForm();
    }

    return renderPurchaseForm();
  }

  function renderChecklistPanel() {
    return (
      <div className="almacen-subpanel">
        <div className="almacen-subpanel-header">
          <h3>Checklist de compra</h3>
          <span>{checklistPendientes.length} pendientes · {checklistUrgentes.length} urgentes</span>
        </div>
        <div className="helper-note">
          Da clic en cualquier insumo para pre-llenar el formulario de compra con sus datos. Los que ya se compraron hoy aparecen tachados.
        </div>
        <div className="helper-note">
          La lista se actualiza sola cada pocos segundos y también cuando otro perfil guarda compras o pendientes en este mismo negocio.
        </div>
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
                placeholder="Ej. Hielo, servilletas, bolsas, gas"
              />
            </label>
            <label>
              <span>Nota o referencia</span>
              <input
                type="text"
                value={manualChecklistForm.nota}
                onChange={(event) => setManualChecklistForm((current) => ({ ...current, nota: event.target.value }))}
                placeholder="Ej. Lo pidió cocina para el turno noche"
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
          <div className="quick-item static-card">
            <div>
              <strong>Pendientes por comprar</strong>
              <span>{operationScopeLabel} · lista activa del negocio</span>
            </div>
            <em>{checklistPendientes.length}</em>
          </div>
          <div className="quick-item">
            <div>
              <strong>Urgentes</strong>
              <span>Acumulados por alertas del stock</span>
            </div>
            <em>{checklistUrgentes.length}</em>
          </div>
          <div className="quick-item">
            <div>
              <strong>Comprado hoy</strong>
              <span>Capturas del día que ya llegaron al sistema</span>
            </div>
            <em>{checklistCompletados.length}</em>
          </div>
        </div>

        <div className="checklist-action-list">
          {shoppingChecklist.length ? (
            shoppingChecklist.map((item) => {
              const linkedPurchase = getChecklistLinkedPurchase(item);
              const isSelected = selectedChecklistIds.includes(item.id) || (linkedPurchase && seleccion.compra === (linkedPurchase.id_compra || linkedPurchase.id_lote));
              return (
                <div className={`checklist-list-row checklist-item ${item.prioridad || 'media'} ${item.checked ? 'checked' : ''} ${isSelected ? 'selected' : ''}`} key={item.id}>
                  <button type="button" className="checklist-row-main" onClick={() => handleChecklistCaptura(item)}>
                    <div className="checklist-copy">
                      <strong>{item.descripcion}</strong>
                      <span>
                        {(item.cantidad || item.cantidad === 0) && item.cantidad !== null ? `${item.cantidad} ${item.unidad}` : item.unidad}
                        {item.checked ? ' · compra registrada' : item.stockActual !== null && item.stockActual !== undefined ? ` · Stock ${item.stockActual ?? '?'} / Reorden ${item.reorden ?? '?'}` : ' · Pendiente manual'}
                      </span>
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
            })
          ) : (
            <p className="panel-empty">No hay pendientes ni compras del día para revisar en este momento.</p>
          )}
        </div>
      </div>
    );
  }

  function renderRecetarioContent() {
    if (recetarioError) {
      return <p className="panel-empty">No se pudo leer el recetario: {recetarioError}</p>;
    }

    if (!recetarioData) {
      return <p className="panel-empty">Cargando recetario y escandallo...</p>;
    }

    if (!recetarioData.recetas.length) {
      return <p className="panel-empty">No hay recetas cargadas para este negocio.</p>;
    }

    return (
      <div className="recetario-layout">
        <div className="module-actions">
          <button type="button" className="module-action-button primary" onClick={resetRecipeForm}>
            Nueva receta
          </button>
          <button
            type="button"
            className="module-action-button success"
            onClick={handleGuardarReceta}
            disabled={isSavingReceta}
          >
            {isSavingReceta ? 'Guardando...' : 'Guardar receta'}
          </button>
          <button type="button" className="module-action-button danger" onClick={handleEliminarReceta}>
            Eliminar receta
          </button>
        </div>

        {(recetaOperationMessage || recetaOperationError) && (
          <div className={`operation-banner ${recetaOperationError ? 'error' : 'success'}`}>
            {recetaOperationError || recetaOperationMessage}
          </div>
        )}

        <div className="recetario-grid-top">
          <div className="almacen-subpanel">
            <div className="almacen-subpanel-header">
              <h3>Recetas maestras</h3>
              <span>{recetasFiltradas.length} visibles</span>
            </div>

            <div className="form-grid-fields compact-form-grid">
              <label>
                <span>Buscar receta</span>
                <input
                  value={recetaFiltro.texto}
                  onChange={(event) => setRecetaFiltro((current) => ({ ...current, texto: event.target.value }))}
                  placeholder="Nombre del platillo o subreceta"
                />
              </label>
              <label>
                <span>Tipo de receta</span>
                <select
                  value={recetaFiltro.tipo}
                  onChange={(event) => setRecetaFiltro((current) => ({ ...current, tipo: event.target.value }))}
                >
                  <option value="todas">Todas</option>
                  {TIPOS_RECETA.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className="split-metric-row">
              <div className="purchase-total-card compact-card">
                <span>Insumos</span>
                <strong>{catalogoRecetaSeparado.insumos.length}</strong>
                <small>Tabla operativa de ingredientes</small>
              </div>
              <div className="purchase-total-card compact-card">
                <span>Equipos</span>
                <strong>{catalogoRecetaSeparado.equipos.length}</strong>
                <small>Tabla operativa de equipo</small>
              </div>
              <div className="purchase-total-card compact-card">
                <span>Complementos</span>
                <strong>{catalogoRecetaSeparado.complementos.length}</strong>
                <small>Tabla operativa de complementos</small>
              </div>
            </div>

            <div className="catalogo-tablas-grid">
              <div className="catalogo-mini-tabla">
                <div className="almacen-subpanel-header compact-header">
                  <h3>Tabla de insumos</h3>
                  <span>{catalogoRecetaSeparado.insumos.length} registros</span>
                </div>
                <div className="catalogo-mini-list">
                  {getShortItemList(catalogoRecetaSeparado.insumos).map((item) => (
                    <div key={`tabla-insumo-${item.id_item}`} className="catalogo-mini-item">
                      <strong>{item.nombre_item}</strong>
                      <span>
                        {item.subcategoria} · {item.unidad_consumo}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="catalogo-mini-tabla">
                <div className="almacen-subpanel-header compact-header">
                  <h3>Tabla de equipos y complementos</h3>
                  <span>{catalogoRecetaSeparado.equipos.length + catalogoRecetaSeparado.complementos.length} registros</span>
                </div>
                <div className="catalogo-mini-list">
                  {getShortItemList([...catalogoRecetaSeparado.equipos, ...catalogoRecetaSeparado.complementos]).map((item) => (
                    <div key={`tabla-extra-${item.id_item}`} className="catalogo-mini-item">
                      <strong>{item.nombre_item}</strong>
                      <span>
                        {item.categoria} · {item.subcategoria}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="mini-list compact-list">
              {recetasFiltradas.map((receta) => (
                <button
                  type="button"
                  key={receta.id_recetario}
                  className={`mini-item selectable-item ${recetaSeleccionada?.id_recetario === receta.id_recetario ? 'selected' : ''}`}
                  onClick={() => handleSelectReceta(receta)}
                >
                  <strong>{receta.nombre_platillo}</strong>
                  <span>
                    {receta.tipo_categoria} · {receta.rendimiento_personas || 0} porciones
                  </span>
                  <span>
                    Costo: {formatCurrency(receta.costo_porcion)} · Competencia: {formatCurrency(receta.costo_competencia_porcion)}
                  </span>
                </button>
              ))}
              {!recetasFiltradas.length && <p className="panel-empty">No hay recetas para ese filtro.</p>}
            </div>
          </div>

          <div className="almacen-subpanel">
            <div className="almacen-subpanel-header">
              <h3>{recetaForm.id_recetario ? 'Editar receta' : 'Alta de receta'}</h3>
              <span>Unidades, merma y costo</span>
            </div>

            <div className="editor-form">
              <div className="form-grid-fields">
                <label>
                  <span>Nombre del platillo</span>
                  <input
                    value={recetaForm.nombre_platillo}
                    onChange={(event) => updateRecipeField('nombre_platillo', event.target.value)}
                    placeholder="Ej. Enchiladas suizas"
                  />
                </label>
                <label>
                  <span>Categoría de receta</span>
                  <select
                    value={recetaForm.tipo_categoria}
                    onChange={(event) => updateRecipeField('tipo_categoria', event.target.value)}
                  >
                    {TIPOS_RECETA.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  <span>Porciones que rinde la receta</span>
                  <input
                    type="number"
                    min="1"
                    value={recetaForm.rendimiento_personas}
                    onChange={(event) => updateRecipeField('rendimiento_personas', event.target.value)}
                  />
                  <small style={{ color: '#64748b', fontSize: '0.75rem' }}>¿Cuántos platos salen de TODA esta preparación?</small>
                  {recetaSeleccionada?.porciones_sugeridas && Number(recetaForm.rendimiento_personas) <= 1 && (
                    <small
                      style={{ color: '#2563eb', fontSize: '0.78rem', cursor: 'pointer', fontWeight: 600, marginTop: 2 }}
                      onClick={() => updateRecipeField('rendimiento_personas', String(recetaSeleccionada.porciones_sugeridas))}
                    >
                      💡 Sugerido: ~{recetaSeleccionada.porciones_sugeridas} porciones (clic para aplicar)
                    </small>
                  )}
                </label>
                <label>
                  <span>Precio venta fijo</span>
                  <input
                    type="number"
                    step="0.01"
                    value={recetaForm.precio_venta_fijo}
                    onChange={(event) => updateRecipeField('precio_venta_fijo', event.target.value)}
                  />
                </label>
                <label>
                  <span>Tiempo total estimado</span>
                  <input
                    type="number"
                    min="0"
                    value={recetaForm.tiempo_total_estimado_min}
                    onChange={(event) => updateRecipeField('tiempo_total_estimado_min', event.target.value)}
                  />
                </label>
                <label>
                  <span>Uso de la receta</span>
                  <div className="image-placeholder-card compact-placeholder">
                    Si esta preparación es base o salsa, primero la das de alta como receta propia. Después armas la receta final y
                    en su escandallo seleccionas sus insumos y complementos.
                  </div>
                </label>
                <label className="field-span-2">
                  <span>Imagen de la receta</span>
                  <div className="recipe-image-upload-row">
                    <label className="recipe-upload-box">
                      <span>Subir foto</span>
                      <input type="file" accept="image/*" capture="environment" onChange={handleRecipeImageChange} />
                    </label>
                    <button
                      type="button"
                      className="module-action-button"
                      onClick={() => updateRecipeField('imagen_platillo', '')}
                    >
                      Quitar foto
                    </button>
                  </div>
                  {recetaForm.imagen_platillo ? (
                    <img className="recipe-image form-preview-image" src={recetaForm.imagen_platillo} alt="Vista previa de receta" />
                  ) : (
                    <div className="image-placeholder-card">
                      Toma la foto desde el celular o súbela desde archivo y se guardará dentro de la receta.
                    </div>
                  )}
                </label>
                <label className="field-span-2">
                  <span>Procedimiento</span>
                  <textarea
                    rows="4"
                    value={recetaForm.procedimiento_preparacion}
                    onChange={(event) => updateRecipeField('procedimiento_preparacion', event.target.value)}
                    placeholder="Paso a paso de elaboración"
                  />
                </label>
              </div>

              <div className="almacen-subpanel nested-panel">
                <div className="almacen-subpanel-header">
                  <h3>Recetas ligadas</h3>
                  <span>Base, salsa o complemento ya existente</span>
                </div>

                <div className="helper-note">
                  Aquí enlazas otra receta ya creada para reutilizarla en el costeo. Ejemplo: primero guardas la salsa verde, luego la
                  ligas a unos chilaquiles o a una carne para que el sistema sume ese costo automáticamente.
                </div>

                <div className="recipe-relation-list">
                  {recetaForm.recetas_relacionadas.map((relacion, index) => (
                    <div className="recipe-relation-editor" key={`relation-${index}`}>
                      <label>
                        <span>Tipo de enlace</span>
                        <select
                          value={relacion.tipo_relacion}
                          onChange={(event) => updateRecipeRelation(index, 'tipo_relacion', event.target.value)}
                        >
                          {TIPOS_RELACION_RECETA.map((option) => (
                            <option key={option} value={option}>
                              {option}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="field-span-2">
                        <span>Receta existente</span>
                        <select
                          value={relacion.id_receta_relacionada}
                          onChange={(event) => updateRecipeRelation(index, 'id_receta_relacionada', event.target.value)}
                        >
                          <option value="">Selecciona receta ligada</option>
                          {(recetarioData?.recetas || [])
                            .filter((item) => item.id_recetario !== recetaForm.id_recetario)
                            .map((item) => (
                              <option key={`rel-${item.id_recetario}`} value={item.id_recetario}>
                                {item.nombre_platillo} · {item.tipo_categoria}
                              </option>
                            ))}
                        </select>
                      </label>
                      <label>
                        <span>Factor de uso</span>
                        <input
                          type="number"
                          min="0.001"
                          step="0.001"
                          value={relacion.cantidad_relacionada}
                          onChange={(event) => updateRecipeRelation(index, 'cantidad_relacionada', event.target.value)}
                        />
                      </label>
                      <button
                        type="button"
                        className="module-action-button danger inline-delete"
                        onClick={() => eliminarRecetaRelacionada(index)}
                      >
                        Quitar enlace
                      </button>
                    </div>
                  ))}
                </div>

                <button type="button" className="module-action-button" onClick={agregarRecetaRelacionada}>
                  Agregar receta ligada
                </button>
              </div>

              <div className="almacen-subpanel nested-panel">
                <div className="almacen-subpanel-header">
                  <h3>Escandallo editable</h3>
                  <span>{recetaForm.detalles.length} renglones</span>
                </div>

                <div className="helper-note">
                  El costo usa la unidad base del catálogo. La merma se calcula en automático según tipo de insumo.
                  <strong> Usa la unidad en la que realmente mides al cocinar</strong> (g para especias, kg para carne, ml para líquidos, pieza para huevos).
                </div>

                <div className="recipe-detail-editor-list">
                  {recetaForm.detalles.map((detail, index) => {
                    const itemSeleccionado = getCatalogItemById(detail.id_item);
                    const unidadesDisponibles = Array.from(
                      new Set([detail.unidad_medida_receta, itemSeleccionado?.unidad_consumo, ...UNIDADES_RECETA].filter(Boolean))
                    );

                    return (
                      <div className="recipe-detail-editor" key={`${detail.id_escandallo || 'new'}-${index}`}>
                        <label className="field-span-2">
                          <span>Insumo / equipo / complemento</span>
                          <select value={detail.id_item} onChange={(event) => updateRecipeDetail(index, 'id_item', event.target.value)}>
                            <option value="">Selecciona del catálogo</option>
                            <optgroup label="Insumos">
                              {catalogoRecetaSeparado.insumos.map((item) => (
                                <option key={`insumo-${item.id_item}`} value={item.id_item}>
                                  {item.nombre_item} · {item.subcategoria}
                                </option>
                              ))}
                            </optgroup>
                            <optgroup label="Equipos">
                              {catalogoRecetaSeparado.equipos.map((item) => (
                                <option key={`equipo-${item.id_item}`} value={item.id_item}>
                                  {item.nombre_item} · {item.subcategoria}
                                </option>
                              ))}
                            </optgroup>
                            <optgroup label="Complementos">
                              {catalogoRecetaSeparado.complementos.map((item) => (
                                <option key={`complemento-${item.id_item}`} value={item.id_item}>
                                  {item.nombre_item} · {item.subcategoria}
                                </option>
                              ))}
                            </optgroup>
                          </select>
                        </label>
                        <label>
                          <span>Unidad receta</span>
                          <select
                            value={detail.unidad_medida_receta}
                            onChange={(event) => updateRecipeDetail(index, 'unidad_medida_receta', event.target.value)}
                          >
                            {unidadesDisponibles.map((unit) => {
                              const unitInfo = UNIDADES_COMPRA.find((u) => u.value === unit);
                              return (
                                <option key={unit} value={unit}>
                                  {unitInfo ? unitInfo.label : unit}
                                </option>
                              );
                            })}
                          </select>
                        </label>
                        <label>
                          <span>Cantidad ({detail.unidad_medida_receta || 'ud'})</span>
                          <input
                            type="number"
                            step="0.001"
                            value={detail.cantidad_utilizada}
                            onChange={(event) => updateRecipeDetail(index, 'cantidad_utilizada', event.target.value)}
                            placeholder={`En ${detail.unidad_medida_receta || 'unidad'}`}
                          />
                        </label>
                        {(() => {
                          const conv = convertirUnidades(detail.cantidad_utilizada, detail.unidad_medida_receta);
                          return conv.length > 0 && detail.cantidad_utilizada ? (
                            <div className="field-span-2 convertidor-live compact">
                              <span className="convertidor-label">≈</span>
                              <div className="convertidor-chips">
                                {conv.map((c, ci) => (
                                  <span key={ci} className="convertidor-chip">{c.valor} {c.unidad}</span>
                                ))}
                              </div>
                            </div>
                          ) : null;
                        })()}
                        <label>
                          <span>Merma automática</span>
                          <div className="auto-merma-pill">{Number(detail.merma_porcentaje || 0).toFixed(1)}%</div>
                        </label>
                        <label>
                          <span>Tiempo min</span>
                          <input
                            type="number"
                            step="1"
                            value={detail.tiempo_preparacion_min}
                            onChange={(event) => updateRecipeDetail(index, 'tiempo_preparacion_min', event.target.value)}
                          />
                        </label>
                        <button
                          type="button"
                          className="module-action-button danger inline-delete"
                          onClick={() => eliminarDetalleReceta(index)}
                        >
                          Quitar
                        </button>
                      </div>
                    );
                  })}
                </div>

                <button type="button" className="module-action-button" onClick={agregarDetalleReceta}>
                  Agregar renglón
                </button>

                <div className="equivalencias-panel" style={{ marginTop: '10px' }}>
                  <details>
                    <summary>Guía rápida de unidades</summary>
                    <div className="equivalencias-grid">
                      {EQUIVALENCIAS_RAPIDAS.slice(0, 4).map((eq, idx) => (
                        <div className="equivalencia-row" key={idx}>
                          <strong>{eq.de}</strong>
                          <span>= {eq.a}</span>
                          <small>{eq.nota}</small>
                        </div>
                      ))}
                    </div>
                    <div className="equivalencias-tip">
                      En recetas usa siempre la unidad más precisa: g para especias, ml para líquidos pequeños, pieza para huevos.
                      El sistema convierte automáticamente al calcular costos.
                    </div>
                  </details>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="recetario-grid-bottom">
          <div className="almacen-subpanel">
            <div className="almacen-subpanel-header">
              <h3>Escandallo detallado</h3>
              <span>{recetaSeleccionada?.escandallo?.length || 0} insumos</span>
            </div>

            {recetaSeleccionada?.escandallo?.length ? (
              <div className="recetario-table-wrap">
                <table className="recetario-table">
                  <thead>
                    <tr>
                      <th>Insumo</th>
                      <th>Unidad receta</th>
                      <th>Neto</th>
                      <th>Bruto</th>
                      <th>Merma</th>
                      <th>Sobrante</th>
                      <th>Stock</th>
                      <th>Precio base</th>
                      <th>Costo real</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recetaSeleccionada.escandallo.map((detalle) => {
                      const esPieza = ['pieza', 'piezas', 'unidad', 'unidades', 'manojo', 'manojos'].includes(detalle.unidad_medida_receta?.toLowerCase());
                      const sobrante = esPieza && detalle.peso_neto % 1 !== 0
                        ? (Math.ceil(detalle.peso_neto) - detalle.peso_neto).toFixed(2)
                        : null;
                      const semaforo = detalle.stock_semaforo || { label: '—', className: '' };
                      return (
                      <tr
                        key={detalle.id_escandallo}
                        className={detalleSeleccionado?.id_escandallo === detalle.id_escandallo ? 'selected-row' : ''}
                        onClick={() => setIngredienteSeleccionadoId(detalle.id_escandallo)}
                      >
                        <td>{detalle.item_nombre}</td>
                        <td>{detalle.unidad_medida_receta}</td>
                        <td>{detalle.peso_neto}</td>
                        <td>{detalle.peso_bruto}</td>
                        <td>{detalle.merma_porcentaje}%</td>
                        <td>{sobrante ? `${sobrante} ${detalle.unidad_medida_receta}` : '—'}</td>
                        <td><span className={`stock-pill ${semaforo.className}`}>{semaforo.label}</span></td>
                        <td>{formatCurrency(detalle.precio_base)}</td>
                        <td>{formatCurrency(detalle.costo_real)}</td>
                      </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="panel-empty">La receta seleccionada aún no tiene insumos en el escandallo.</p>
            )}
          </div>

          <div className="almacen-subpanel">
            <div className="almacen-subpanel-header">
              <h3>Detalle técnico</h3>
              <span>{detalleSeleccionado?.item_nombre || recetaSeleccionada?.nombre_platillo || 'Sin selección'}</span>
            </div>

            {recetaSeleccionada ? (
              <div className="detail-card detail-stack technical-detail-card">
                <div className="technical-hero">
                  {recetaSeleccionada.imagen_platillo ? (
                    <img className="recipe-image technical-image" src={recetaSeleccionada.imagen_platillo} alt={recetaSeleccionada.nombre_platillo} />
                  ) : (
                    <div className="technical-image placeholder-technical-image">Sin foto de receta</div>
                  )}

                  <div className="technical-hero-copy">
                    <strong>{recetaSeleccionada.nombre_platillo}</strong>
                    <span>
                      {recetaSeleccionada.tipo_categoria} · {recetaSeleccionada.rendimiento_personas || 0} porciones ·{' '}
                      {recetaSeleccionada.tiempo_total_estimado_min || 0} min
                    </span>
                    <p>{recetaSeleccionada.procedimiento_preparacion || 'Sin procedimiento cargado.'}</p>
                  </div>
                </div>

                {recetaSeleccionada.recetas_relacionadas?.length ? (
                  <div className="technical-info-card field-span-3 related-recipes-card">
                    <strong>Preparaciones ligadas</strong>
                    {recetaSeleccionada.recetas_relacionadas.map((relacion, index) => (
                      <span key={`linked-${relacion.id_receta_relacionada || index}`}>
                        {relacion.tipo_relacion}: {relacion.nombre_platillo} · factor {relacion.cantidad_relacionada} · costo usado{' '}
                        {formatCurrency(relacion.total_costo_usado)}
                        {relacion.es_relacion_ciclica ? ' · relación cíclica detectada' : ''}
                      </span>
                    ))}
                  </div>
                ) : null}

                {detalleSeleccionado ? (
                  <div className="technical-grid">
                    <div className={`technical-kpi-card ${Number(recetaSeleccionada.margen_porcion) < 0 ? 'accent-danger' : 'accent-current-price'}`}>
                      <span>Precio actual</span>
                      <strong>{formatCurrency(recetaSeleccionada.precio_venta_fijo)}</strong>
                      <small>{Number(recetaSeleccionada.margen_porcion) < 0 ? 'Precio menor al costo — estás perdiendo dinero' : 'Se respeta el precio de venta actual de la receta'}</small>
                    </div>
                    <div className={`technical-kpi-card ${Number(recetaSeleccionada.costo_porcion) > Number(recetaSeleccionada.precio_venta_fijo) ? 'accent-danger' : 'accent-cost'}`}>
                      <span>Costo por porción</span>
                      <strong>{formatCurrency(recetaSeleccionada.costo_porcion)}</strong>
                      <small>{Number(recetaSeleccionada.costo_porcion) > Number(recetaSeleccionada.precio_venta_fijo) ? 'El costo supera tu precio de venta' : 'Con merma y consumos actuales'}</small>
                    </div>
                    <div className={`technical-kpi-card ${Number(recetaSeleccionada.margen_porcion) < 0 ? 'accent-danger' : 'accent-margin'}`}>
                      <span>Margen estimado</span>
                      <strong>{Number(recetaSeleccionada.margen_porcion).toFixed(1)}%</strong>
                      <small>{Number(recetaSeleccionada.margen_porcion) < 0 ? 'Margen negativo — revisa porciones, cantidades o precio' : 'Utilidad calculada con el precio actual'}</small>
                    </div>
                    {Number(recetaSeleccionada.margen_porcion) < 0 && (
                      <div className="technical-info-card field-span-3 alert-banner-danger">
                        <strong>⚠ Esta receta genera pérdidas</strong>
                        <span>El costo por porción ({formatCurrency(recetaSeleccionada.costo_porcion)}) es mayor al precio de venta ({formatCurrency(recetaSeleccionada.precio_venta_fijo)}).</span>
                        <span>Revisa: (1) el número de porciones/rendimiento, (2) las cantidades de cada insumo, (3) sube el precio al sugerido de abajo.</span>
                        {recetaSeleccionada.porciones_sugeridas && recetaSeleccionada.porciones_sugeridas > Number(recetaSeleccionada.rendimiento_personas) && (
                          <span style={{ color: '#1d4ed8', fontWeight: 600 }}>
                            💡 El sistema estima ~{recetaSeleccionada.porciones_sugeridas} porciones para esta receta. Actualmente tienes {recetaSeleccionada.rendimiento_personas}. Edita las porciones arriba.
                          </span>
                        )}
                      </div>
                    )}
                    {recetaSeleccionada.sugerido_30 > 0 && (
                      <div className="technical-kpi-card accent-suggested">
                        <span>Sugerido 30%</span>
                        <strong>{formatCurrency(recetaSeleccionada.sugerido_30)}</strong>
                        <small>Precio mínimo para 30% de margen</small>
                      </div>
                    )}
                    {recetaSeleccionada.sugerido_35 > 0 && (
                      <div className="technical-kpi-card accent-suggested">
                        <span>Sugerido 35%</span>
                        <strong>{formatCurrency(recetaSeleccionada.sugerido_35)}</strong>
                        <small>Precio para 35% de margen</small>
                      </div>
                    )}
                    {recetaSeleccionada.sugerido_40 > 0 && (
                      <div className="technical-kpi-card accent-suggested">
                        <span>Sugerido 40%</span>
                        <strong>{formatCurrency(recetaSeleccionada.sugerido_40)}</strong>
                        <small>Precio para 40% de margen</small>
                      </div>
                    )}

                    <div className="technical-info-card field-span-3">
                      <strong>{detalleSeleccionado.item_nombre}</strong>
                      <span>
                        {detalleSeleccionado.categoria} · {detalleSeleccionado.subcategoria} · {detalleSeleccionado.tipo_conservacion}
                      </span>
                      <span>
                        Compra/Referencia: {detalleSeleccionado.unidad_consumo} · Uso en receta: {detalleSeleccionado.unidad_medida_receta}
                      </span>
                      <span>
                        Neto receta: {detalleSeleccionado.peso_neto} {detalleSeleccionado.unidad_medida_receta} · Neto base: {detalleSeleccionado.cantidad_base_neta} {detalleSeleccionado.unidad_consumo}
                      </span>
                      <span>
                        Bruto receta: {detalleSeleccionado.peso_bruto} {detalleSeleccionado.unidad_medida_receta} · Bruto base: {detalleSeleccionado.cantidad_base_bruta} {detalleSeleccionado.unidad_consumo}
                      </span>
                      {['pieza', 'piezas', 'unidad', 'unidades', 'manojo', 'manojos'].includes(detalleSeleccionado.unidad_medida_receta?.toLowerCase()) && detalleSeleccionado.peso_neto % 1 !== 0 && (
                        <span className="merma-pieza-info">
                          Usas {detalleSeleccionado.peso_neto} {detalleSeleccionado.unidad_medida_receta} → compras {Math.ceil(detalleSeleccionado.peso_neto)} enteras · sobrante: {(Math.ceil(detalleSeleccionado.peso_neto) - detalleSeleccionado.peso_neto).toFixed(2)} {detalleSeleccionado.unidad_medida_receta} (merma o guardado)
                        </span>
                      )}
                      <span>Conversión: {detalleSeleccionado.conversion_bruta}</span>
                      <span>
                        Costo neto: {formatCurrency(detalleSeleccionado.costo_neto)} · Merma: {formatCurrency(detalleSeleccionado.costo_merma)}
                      </span>
                      <span>
                        Costo real: {formatCurrency(detalleSeleccionado.costo_real)} · Competencia:{' '}
                        {formatCurrency(detalleSeleccionado.costo_competencia)}
                      </span>
                      <span>
                        Fuente: {detalleSeleccionado.fuente_precio === 'ultimo_lote' ? 'Último lote comprado' : 'Precio de referencia'}
                      </span>
                      <span>Referencia guardada: {detalleSeleccionado.fuente_competencia}</span>
                    </div>
                  </div>
                ) : null}
              </div>
            ) : (
              <p className="panel-empty">Selecciona una receta para ver su ficha técnica y su desglose real.</p>
            )}
          </div>
        </div>
      </div>
    );
  }

  function renderRecetarioSummary() {
    if (recetarioError) {
      return <p className="panel-empty">No se pudo leer el resumen del recetario: {recetarioError}</p>;
    }

    if (!recetarioData || !recetaSeleccionada) {
      return <p className="panel-empty">Selecciona una receta para ver su costeo.</p>;
    }

    return (
      <div className="quick-list">
        <div className="quick-item static-card">
          <div>
            <strong>Costo total receta</strong>
            <span>
              {recetaSeleccionada.escandallo.length} insumos y {recetaSeleccionada.recetas_relacionadas?.length || 0} recetas ligadas
            </span>
          </div>
          <em>{formatCurrency(recetaSeleccionada.total_costo_receta)}</em>
        </div>

        <div className="quick-item">
          <div>
            <strong>Costo por insumos</strong>
            <span>Solo lo que viene directo del escandallo</span>
          </div>
          <em>{formatCurrency(recetaSeleccionada.total_costo_insumos)}</em>
        </div>

        <div className="quick-item">
          <div>
            <strong>Costo por recetas ligadas</strong>
            <span>Bases, salsas o complementos reutilizados</span>
          </div>
          <em>{formatCurrency(recetaSeleccionada.total_costo_recetas_ligadas)}</em>
        </div>

        <div className="quick-item">
          <div>
            <strong>Costo por porción</strong>
            <span>{recetaSeleccionada.rendimiento_personas || 0} porciones teóricas</span>
          </div>
          <em>{formatCurrency(recetaSeleccionada.costo_porcion)}</em>
        </div>

        <div className="quick-item">
          <div>
            <strong>Precio actual</strong>
            <span>{puedeVerRentabilidad ? 'Venta fija cargada en el recetario' : 'Visible para operación'}</span>
          </div>
          <em>{formatCurrency(recetaSeleccionada.precio_venta_fijo)}</em>
        </div>

        <div className="quick-item">
          <div>
            <strong>Costo competencia</strong>
            <span>Calculado con precio promedio de competencia del catálogo</span>
          </div>
          <em>{formatCurrency(recetaSeleccionada.costo_competencia_porcion)}</em>
        </div>

        {puedeVerRentabilidad && (
          <>
            <div className={`quick-item ${Number(recetaSeleccionada.margen_porcion) < 0 ? 'quick-item-danger' : ''}`}>
              <div>
                <strong>Margen estimado</strong>
                <span>{Number(recetaSeleccionada.margen_porcion) < 0 ? '⚠ Pérdida — revisa porciones o precio' : 'Utilidad aproximada por porción'}</span>
              </div>
              <em>{Number(recetaSeleccionada.margen_porcion).toFixed(1)}%</em>
            </div>
            {recetaSeleccionada.sugerido_30 > 0 && (
              <div className="quick-item">
                <div>
                  <strong>Sugerido 30%</strong>
                  <span>Precio mínimo para 30% de margen</span>
                </div>
                <em>{formatCurrency(recetaSeleccionada.sugerido_30)}</em>
              </div>
            )}
            {recetaSeleccionada.sugerido_35 > 0 && (
              <div className="quick-item">
                <div>
                  <strong>Sugerido 35%</strong>
                  <span>Precio para 35% de margen</span>
                </div>
                <em>{formatCurrency(recetaSeleccionada.sugerido_35)}</em>
              </div>
            )}
            {recetaSeleccionada.sugerido_40 > 0 && (
              <div className="quick-item">
                <div>
                  <strong>Sugerido 40%</strong>
                  <span>Precio para 40% de margen</span>
                </div>
                <em>{formatCurrency(recetaSeleccionada.sugerido_40)}</em>
              </div>
            )}
          </>
        )}
      </div>
    );
  }

  function setWorkerFeedback(message = '', errorMessage = '') {
    setWorkerMessage(message);
    setWorkerError(errorMessage);
  }

  function setBusinessConfigFeedback(message = '', errorMessage = '') {
    setBusinessConfigMessage(message);
    setBusinessConfigError(errorMessage);
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
      window.localStorage.setItem(getBusinessLogoStorageKey('restaurante', user.business_id), imageValue);
      setBusinessConfigFeedback('Foto del restaurante guardada en este equipo.');
    };
    reader.onerror = () => {
      setBusinessConfigFeedback('', 'No se pudo leer la imagen seleccionada.');
    };
    reader.readAsDataURL(file);
  }

  function limpiarBusinessPhoto() {
    setBusinessConfigForm((current) => ({ ...current, logo_preview: '' }));
    window.localStorage.removeItem(getBusinessLogoStorageKey('restaurante', user.business_id));
    setBusinessConfigFeedback('Foto del restaurante eliminada de este equipo.');
  }

  async function handleGuardarConfiguracionRestaurante() {
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
    setBusinessConfigFeedback('Configuración del restaurante actualizada.');
    setIsSavingBusinessConfig(false);
  }

  function setSalidaFeedback(message = '', errorMessage = '') {
    setSalidaMessage(message);
    setSalidaError(errorMessage);
  }

  async function handleGuardarSalida() {
    if (!user.business_id) {
      setSalidaFeedback('', 'Tu usuario no tiene negocio asignado.');
      return;
    }
    if (!salidaForm.idInsumo || !salidaForm.cantidad) {
      setSalidaFeedback('', 'Selecciona un insumo e ingresa la cantidad.');
      return;
    }
    setIsSavingSalida(true);
    setSalidaFeedback();
    const fechaISO = salidaForm.fecha_registro
      ? new Date(salidaForm.fecha_registro).toISOString()
      : undefined;
    const itemCatalogo = (almacenCompras?.catalogo || []).find(
      (item) => String(item.id_insumo) === String(salidaForm.idInsumo) ||
                String(item.id_item) === String(salidaForm.idInsumo)
    );
    const result = await registrarSalidaInsumo({
      businessId: user.business_id,
      idInsumo: salidaForm.idInsumo,
      cantidad: salidaForm.cantidad,
      tipoDetalle: salidaForm.tipoDetalle || 'uso_receta',
      motivo: salidaForm.motivo,
      responsable: salidaForm.responsable || user.nombre_completo,
      idReceta: salidaForm.idReceta || undefined,
      fechaRegistro: fechaISO,
      itemSnapshot: itemCatalogo ? {
        nombre_item: itemCatalogo.nombre_item,
        stock_actual: itemCatalogo.stock_actual,
        costo_unitario_promedio: itemCatalogo.precio_competencia_promedio || itemCatalogo.costo_unitario_promedio
      } : undefined
    });
    await Promise.all([cargarMovimientos(movimientosFiltro), cargarAlmacen()]);
    setQuickFocus('registro-dia');
    if (result.error) {
      setSalidaFeedback('', result.error);
    } else {
      const tipoLabel = TIPOS_SALIDA.find((t) => t.value === salidaForm.tipoDetalle)?.label || salidaForm.tipoDetalle;
      setSalidaFeedback(`Salida registrada: ${result.data?.cantidad} ${result.data?.nombre_item} · ${tipoLabel}. Stock actualizado.`);
      setSalidaForm(getDefaultSalidaForm());
    }
    setIsSavingSalida(false);
  }

  async function handleRegistrarRecepcion() {
    if (!compraSeleccionadaEstado?.id_compra && !compraSeleccionadaEstado?.id_lote) {
      setOperationError('Selecciona una compra válida.');
      return;
    }
    
    setIsSavingEstado(true);
    setOperationError('');
    
    const { registrarRecepcionCompra } = await import('../../services/almacenCompras');
    const result = await registrarRecepcionCompra(compraSeleccionadaEstado.id_compra || compraSeleccionadaEstado.id_lote, {
      fecha_recepcion: recepcionForm.fecha_recepcion,
      quien_recibio: recepcionForm.quien_recibio || user.nombre_completo,
      cantidad_recibida: recepcionForm.cantidad_recibida || compraSeleccionadaEstado.cantidad_recibida,
      observaciones_recepcion: recepcionForm.observaciones
    });

    if (result.error) {
      setOperationError(result.error);
    } else {
      setOperationMessage(`Recepción registrada: ${compraSeleccionadaEstado.item_nombre}`);
      setModalRecepcionAbierto(false);
      setRecepcionForm({
        fecha_recepcion: new Date().toISOString().slice(0, 10),
        quien_recibio: '',
        cantidad_recibida: '',
        observaciones: ''
      });
      await cargarAlmacen();
    }
    setIsSavingEstado(false);
  }

  async function handleRegistrarPago() {
    if (!compraSeleccionadaEstado?.id_compra && !compraSeleccionadaEstado?.id_lote) {
      setOperationError('Selecciona una compra válida.');
      return;
    }
    
    setIsSavingEstado(true);
    setOperationError('');
    
    const { registrarPagoCompra } = await import('../../services/almacenCompras');
    const result = await registrarPagoCompra(compraSeleccionadaEstado.id_compra || compraSeleccionadaEstado.id_lote, {
      fecha_pago: pagoForm.fecha_pago,
      monto_pagado: pagoForm.monto_pagado || compraSeleccionadaEstado.total_lote
    });

    if (result.error) {
      setOperationError(result.error);
    } else {
      setOperationMessage(`Pago registrado: ${compraSeleccionadaEstado.item_nombre}`);
      setModalPagoAbierto(false);
      setPagoForm({
        fecha_pago: new Date().toISOString().slice(0, 10),
        monto_pagado: ''
      });
      await cargarAlmacen();
    }
    setIsSavingEstado(false);
  }

  function abrirRecepcion(compra) {
    setCompraSeleccionadaEstado(compra);
    setRecepcionForm({
      fecha_recepcion: new Date().toISOString().slice(0, 10),
      quien_recibio: user.nombre_completo || '',
      cantidad_recibida: compra.cantidad_recibida || '',
      observaciones: ''
    });
    setModalRecepcionAbierto(true);
  }

  function abrirPago(compra) {
    setCompraSeleccionadaEstado(compra);
    setPagoForm({
      fecha_pago: new Date().toISOString().slice(0, 10),
      monto_pagado: compra.total_lote || ''
    });
    setModalPagoAbierto(true);
  }

  function getEstadoCompraLabel(estado) {
    const labels = {
      'sugerida': 'Sugerida',
      'pedida': 'Pedida',
      'recibida': 'Recibida',
      'pagada': 'Pagada'
    };
    return labels[estado] || estado || 'Sugerida';
  }

  function getEstadoCompraColor(estado) {
    const colors = {
      'sugerida': 'amarillo',
      'pedida': 'azul',
      'recibida': 'naranja',
      'pagada': 'verde'
    };
    return colors[estado] || 'gris';
  }

  async function handleGuardarTrabajador() {
    setWorkerFeedback();
    setIsSavingWorker(true);

    const result = await crearTrabajadorRestaurante(workerForm);
    if (result.error) {
      setWorkerFeedback('', result.error);
      setIsSavingWorker(false);
      return;
    }

    await cargarUsuariosRestauranteData();
    setWorkerForm(getDefaultWorkerForm());
    setWorkerFeedback('Usuario restaurante guardado correctamente.');
    setIsSavingWorker(false);
  }

  async function handleEliminarUsuarioRestaurante(item) {
    if (!item?.id_usuario) {
      setWorkerFeedback('', 'Selecciona un usuario válido para eliminar.');
      return;
    }

    if (!window.confirm(`Se eliminará el usuario ${item.nombre_completo}.`)) {
      return;
    }

    setWorkerFeedback();
    const result = await eliminarUsuarioNegocio({ userId: item.id_usuario, currentUserId: user?.id_usuario });
    if (result.error) {
      setWorkerFeedback('', result.error);
      return;
    }

    await cargarUsuariosRestauranteData();
    setWorkerFeedback('Usuario restaurante eliminado correctamente.');
  }

  async function aplicarFiltroMovimientos(nextFiltro) {
    setMovimientosFiltro(nextFiltro);
    await cargarMovimientos(nextFiltro);
  }

  function exportarMovimientosExcel() {
    if (!movimientosData) {
      return;
    }

    // Cabecera con resumen
    const rows = [
      ['CORTE DE COMPRAS RESTAURANTE'],
      [''],
      ['Período:', movimientosFiltro.fechaInicio || 'Sin fecha', 'hasta', movimientosFiltro.fechaFin || 'Hoy'],
      [''],
      ['RESUMEN'],
      ['Recetas registradas', movimientosData.corte.recetas_registradas || 0],
      ['Platillos operados', movimientosData.corte.platillos_registrados || 0],
      ['Consumo estimado', formatCurrency(movimientosData.corte.salidas_periodo || 0)],
      ['Compras del período', formatCurrency(movimientosData.corte.compras_periodo || 0)],
      ['Balance', formatCurrency(movimientosData.corte.balance_periodo || 0)],
      [''],
      ['HISTORIAL DETALLADO DE MOVIMIENTOS'],
      ['Fecha', 'Hora', 'Tipo', 'Insumo', 'Cantidad', 'Unidad', 'Concepto', 'Responsable', 'Rol', 'Nota/Motivo'],
      ...movimientosData.movimientos.map((item) => {
        const fechaHora = item.fecha_label ? item.fecha_label.split(' ') : ['', ''];
        return [
          fechaHora[0] || '',
          fechaHora[1] || '',
          item.tipo || '',
          item.concepto || '',
          item.cantidad || '',
          item.unidad || '',
          item.motivo || item.detalle || '',
          item.responsable || '',
          item.rol || '',
          item.nota || ''
        ];
      })
    ];

    descargarCsv('corte_compras_restaurante.csv', rows);
  }

  function exportarMovimientosPdf() {
    if (!movimientosData) {
      return;
    }

    descargarPdfMovimiento({
      titulo: 'Corte de compras restaurante',
      resumen: movimientosCards,
      movimientos: movimientosData.movimientos
    });
  }

  function renderDashboardRestaurantContent() {
    if (movimientosError) {
      return <p className="panel-empty">No se pudo cargar la ruta rápida: {movimientosError}</p>;
    }

    if (!movimientosData) {
      return <p className="panel-empty">Cargando ruta rápida del restaurante...</p>;
    }

    return (
      <div className="almacen-layout">
        <div className="route-action-grid">
          <button type="button" className="route-action-card action-almacen" onClick={() => navigateSection(almacenSectionKey, 'compras-sugeridas')}>
            <span>Almacén y Compras</span>
            <strong>Revisar compras y stock</strong>
            <small>Entra directo al registro de compra, alertas y lista operativa de compras.</small>
          </button>
          <button type="button" className="route-action-card action-recetario" onClick={() => navigateSection(recetarioSectionKey, 'recetas')}>
            <span>Recetario Maestro</span>
            <strong>Ver recetas activas</strong>
            <small>Abre tus recetas con mayor salida y su tipo de preparación.</small>
          </button>
          <button type="button" className="route-action-card action-movimientos" onClick={() => navigateSection('movimientos_restaurante', 'registro-dia')}>
            <span>Movimientos</span>
            <strong>Ir al corte de compras</strong>
            <small>Registra recetas usadas, revisa consumo y repón lo faltante.</small>
          </button>
        </div>

        <div className="almacen-subpanel-grid">
          <div className="almacen-subpanel spotlight-panel spotlight-alert">
            <div className="almacen-subpanel-header">
              <h3>Alertas que urgen</h3>
              <span>{movimientosData.alertas.length} activas</span>
            </div>
            <div className="mini-list compact-list">
              {movimientosData.alertas.slice(0, 6).map((item) => (
                <button
                  type="button"
                  className={`mini-item selectable-item alert-mini-card ${getOperationalStockState(item).className}`}
                  key={`alert-${item.id_item}`}
                  onClick={() => navigateSection('movimientos_restaurante', 'alertas')}
                >
                  <strong>{item.nombre_item}</strong>
                  <span>
                    Stock {item.stock_actual} · Punto {item.punto_reorden_interno} · {getOperationalStockState(item).label}
                  </span>
                  <small className={`stock-pill ${getOperationalStockState(item).className}`}>{getOperationalStockState(item).label}</small>
                </button>
              ))}
            </div>
          </div>

          <div className="almacen-subpanel spotlight-panel spotlight-recipes">
            <div className="almacen-subpanel-header">
              <h3>Recetas activas</h3>
              <span>Lo más movido</span>
            </div>
            <div className="mini-list compact-list">
              {movimientosData.recetasFrecuentes.map((item) => (
                <button
                  type="button"
                  className="mini-item selectable-item recipe-mini-card"
                  key={`receta-quick-${item.id_recetario}`}
                  onClick={() => abrirRecetaDesdeRuta(item)}
                >
                  <strong>{item.nombre_platillo}</strong>
                  <span>{item.cantidad_platillos} platillos registrados</span>
                  <small className="route-chip chip-receta">{item.tipo_categoria}</small>
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="almacen-subpanel spotlight-panel spotlight-buy">
          <div className="almacen-subpanel-header">
            <h3>Checklist para comprar</h3>
            <span>Lo urgente y lo pendiente para salir a comprar</span>
          </div>
          {checklistUrgentes.length > 0 && (
            <div className="recommendation-group">
              <div className="recommendation-group-header success">
                <strong>Urgente por comprar</strong>
                <span>Sale directo del stock y de lo que aún no entra</span>
              </div>
              <div className="quick-list">
                {checklistUrgentes.slice(0, 4).map((item) => (
                  <button
                    type="button"
                    className="quick-item quick-clickable recommendation-card rojo"
                    key={`checklist-urgente-${item.id}`}
                    onClick={() => navigateSection(almacenSectionKey, 'compras-sugeridas')}
                  >
                    <div>
                      <strong>{item.descripcion}</strong>
                      <span>{item.nota || 'Urgente por stock bajo'}</span>
                      <span>{item.createdBy || 'Sin responsable'}</span>
                    </div>
                    <em>{item.cantidad ? `${item.cantidad} ${item.unidad}` : 'Comprar'}</em>
                  </button>
                ))}
              </div>
            </div>
          )}

          {checklistPendientes.length > 0 && (
            <div className="recommendation-group pending-group">
              <div className="recommendation-group-header pending">
                <strong>Pendiente por comprar</strong>
                <span>Lo que todavía falta traer o revisar</span>
              </div>
              <div className="quick-list">
                {checklistPendientes.slice(0, 4).map((item) => (
                  <button
                    type="button"
                    className={`quick-item quick-clickable recommendation-card no-history ${item.prioridad === 'alta' ? 'rojo' : 'amarillo'}`}
                    key={`checklist-pendiente-${item.id}`}
                    onClick={() => navigateSection(almacenSectionKey, 'compras-sugeridas')}
                  >
                    <div>
                      <strong>{item.descripcion}</strong>
                      <span>{item.nota || 'Pendiente según inventario y compras registradas'}</span>
                      <span>{item.createdBy || 'Sin responsable'}</span>
                    </div>
                    <em>{item.cantidad ? `${item.cantidad} ${item.unidad}` : 'Pendiente'}</em>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  function renderDashboardRestaurantSummary() {
    if (!movimientosData) {
      return <p className="panel-empty">Cargando resumen operativo...</p>;
    }

    return (
      <div className="quick-list">
        {checklistPendientes.slice(0, 5).map((item) => (
          <button
            type="button"
            className={`quick-item quick-clickable recommendation-card ${item.prioridad === 'alta' ? 'rojo' : 'no-history'}`}
            key={`quick-buy-${item.id}`}
            onClick={() => navigateSection(almacenSectionKey, 'compras-sugeridas')}
          >
            <div>
              <strong>{item.descripcion}</strong>
              <span>{item.nota || item.createdBy || 'Pendiente según inventario'}</span>
            </div>
            <em>{item.checked ? 'OK' : 'Comprar'}</em>
          </button>
        ))}
      </div>
    );
  }

  function renderMovimientosContent() {
    if (movimientosError) {
      return <p className="panel-empty">No se pudieron cargar movimientos: {movimientosError}</p>;
    }

    if (!movimientosData) {
      return <p className="panel-empty">Cargando movimientos del restaurante...</p>;
    }

    const movementFocus = ['registro-dia', 'compras-sugeridas', 'alertas', 'historial', 'kardex'].includes(quickFocus)
      ? quickFocus
      : 'compras-sugeridas';

    return (
      <div className="almacen-module-container">
        {/* REGISTRO DE MOVIMIENTOS ESPECIALES: Daño, Merma, Reposición */}
        <RegistroMovimientosInventario 
          businessId={user.business_id}
          userId={user.id_usuario}
          onMovimientoRegistrado={() => {
            // Opcional: recargar movimientos después de registrar
            // Aquí puedes agregar lógica para recargar si es necesario
          }}
        />

        <div className="almacen-layout">
        <div className="almacen-subpanel">
          <div className="almacen-subpanel-header">
            <h3>Ruta operativa del restaurante</h3>
            <span>Checklist, salidas, alertas y reposición en un solo flujo</span>
          </div>
          <div className="manager-tabs">
            <button
              type="button"
              className={`manager-tab ${movementFocus === 'compras-sugeridas' ? 'active' : ''}`}
              onClick={() => setQuickFocus('compras-sugeridas')}
            >
              Checklist
            </button>
            <button
              type="button"
              className={`manager-tab ${movementFocus === 'alertas' ? 'active' : ''}`}
              onClick={() => setQuickFocus('alertas')}
            >
              Alertas
            </button>
            <button
              type="button"
              className={`manager-tab ${movementFocus === 'registro-dia' ? 'active' : ''}`}
              onClick={() => setQuickFocus('registro-dia')}
            >
              Salidas del día
            </button>
            <button
              type="button"
              className={`manager-tab ${movementFocus === 'kardex' ? 'active' : ''}`}
              onClick={() => setQuickFocus('kardex')}
            >
              Kardex
            </button>
            <button
              type="button"
              className={`manager-tab ${movementFocus === 'historial' ? 'active' : ''}`}
              onClick={() => setQuickFocus('historial')}
            >
              Historial
            </button>
          </div>
          <div className="helper-note">
            Empieza por el checklist para ver qué urge, revisa alertas de stock bajo, registra las salidas reales del día, consulta el kardex de cada insumo para ver entrada/salida completa, y termina con el historial para validar toda la operación.
          </div>
        </div>

        <div className="period-filter-shell">
          <div className="module-actions">
            <button type="button" className="module-action-button success" onClick={exportarMovimientosExcel}>
              Descargar Excel
            </button>
            <button type="button" className="module-action-button" onClick={exportarMovimientosPdf}>
              Descargar PDF
            </button>
          </div>
        </div>

        <div className="almacen-subpanel">
          <div className="almacen-subpanel-header">
            <h3>Filtrar historial</h3>
            <span>Por periodo, insumo y tipo de movimiento</span>
          </div>
          <div className="form-grid-fields">
            <label>
              <span>Fecha inicio</span>
              <input
                type="date"
                value={movimientosFiltro.fechaInicio}
                onChange={(event) => setMovimientosFiltro((current) => ({ ...current, fechaInicio: event.target.value }))}
              />
            </label>
            <label>
              <span>Fecha fin</span>
              <input
                type="date"
                value={movimientosFiltro.fechaFin}
                onChange={(event) => setMovimientosFiltro((current) => ({ ...current, fechaFin: event.target.value }))}
              />
            </label>
            <label className="field-span-2">
              <span>Buscar insumo o movimiento</span>
              <input
                type="text"
                placeholder="Jitomate, cebolla, entrada, salida, merma..."
                value={movimientosFiltro.buscarInsumo}
                onChange={(event) => setMovimientosFiltro((current) => ({ ...current, buscarInsumo: event.target.value }))}
              />
            </label>
            <label>
              <span>Tipo de movimiento</span>
              <select
                value={movimientosFiltro.tipoMov}
                onChange={(event) => setMovimientosFiltro((current) => ({ ...current, tipoMov: event.target.value }))}
              >
                <option value="">Todos (entradas y salidas)</option>
                <option value="Entrada">Solo entradas</option>
                <option value="Salida">Solo salidas</option>
              </select>
            </label>
            <label>
              <span>Responsable</span>
              <input
                type="text"
                placeholder="Nombre de quien hizo el movimiento"
                value={movimientosFiltro.responsable || ''}
                onChange={(event) => setMovimientosFiltro((current) => ({ ...current, responsable: event.target.value }))}
              />
            </label>
          </div>

          <div className="module-actions">
            <button type="button" className="module-action-button primary" onClick={() => aplicarFiltroMovimientos(movimientosFiltro)}>
              Aplicar filtro
            </button>
            <button type="button" className="module-action-button" onClick={() => setMovimientosFiltro({ periodo: 'mes', fechaInicio: '', fechaFin: '', buscarInsumo: '', tipoMov: '', responsable: '' })}>
              Limpiar filtros
            </button>
            <button type="button" className="module-action-button" onClick={abrirCompraManual}>
              Registrar compra manual
            </button>
          </div>
        </div>

        <div className="almacen-subpanel-grid">
          <div className={`almacen-subpanel spotlight-panel spotlight-recipes ${movementFocus === 'registro-dia' ? 'active-spotlight' : ''}`}>
            <div className="almacen-subpanel-header">
              <h3>Registrar salida de insumo</h3>
              <span>Usa_receta · Merma · Prestado — descuenta stock directamente</span>
            </div>
            <div className="helper-note">
              Selecciona el insumo que sale del inventario, la cantidad real y el motivo. Cada registro actualiza el stock y alimenta el historial.
            </div>
            {(salidaMessage || salidaError) && (
              <div className={`operation-banner ${salidaError ? 'error' : 'success'}`}>{salidaError || salidaMessage}</div>
            )}
            <div className="form-grid-fields">
              <label>
                <span>Tipo de salida</span>
                <select
                  value={salidaForm.tipoDetalle}
                  onChange={(event) => setSalidaForm((current) => ({ ...current, tipoDetalle: event.target.value }))}
                >
                  {TIPOS_SALIDA.filter((t) => t.scope === 'restaurante' || t.scope === 'ambos').map((t) => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
              </label>
              <label>
                <span>Insumo</span>
                <select
                  value={salidaForm.idInsumo}
                  onChange={(event) => setSalidaForm((current) => ({ ...current, idInsumo: event.target.value }))}
                >
                  <option value="">Selecciona un insumo</option>
                  {(almacenCompras?.catalogo || [])
                    .slice()
                    .sort((a, b) => String(a.nombre_item).localeCompare(String(b.nombre_item), 'es'))
                    .map((item) => (
                    <option key={`salida-insumo-${item.id_item}`} value={item.id_item}>
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
                  value={salidaForm.cantidad}
                  onChange={(event) => setSalidaForm((current) => ({ ...current, cantidad: event.target.value }))}
                />
              </label>
              {salidaForm.tipoDetalle === 'uso_receta' && (
                <label>
                  <span>Receta (opcional)</span>
                  <select
                    value={salidaForm.idReceta}
                    onChange={(event) => setSalidaForm((current) => ({ ...current, idReceta: event.target.value }))}
                  >
                    <option value="">Sin receta vinculada</option>
                    {recetasMovimiento.map((item) => (
                      <option key={`salida-receta-${item.id_recetario}`} value={item.id_recetario}>
                        {item.nombre_platillo}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              <label>
                <span>Motivo / Nota</span>
                <input
                  type="text"
                  placeholder="Ej: Producción del día, prestado a cocina vecina..."
                  value={salidaForm.motivo}
                  onChange={(event) => setSalidaForm((current) => ({ ...current, motivo: event.target.value }))}
                />
              </label>
              <label>
                <span>Responsable</span>
                <input
                  type="text"
                  placeholder={user.nombre_completo || 'Nombre'}
                  value={salidaForm.responsable}
                  onChange={(event) => setSalidaForm((current) => ({ ...current, responsable: event.target.value }))}
                />
              </label>
              <label className="field-span-2">
                <span>Fecha y hora</span>
                <input
                  type="datetime-local"
                  value={salidaForm.fecha_registro}
                  onChange={(event) => setSalidaForm((current) => ({ ...current, fecha_registro: event.target.value }))}
                />
              </label>
            </div>
            <div className="module-actions">
              <button
                type="button"
                className="module-action-button primary"
                onClick={handleGuardarSalida}
                disabled={isSavingSalida || !salidaForm.idInsumo || !salidaForm.cantidad}
              >
                {isSavingSalida ? 'Registrando...' : 'Registrar salida'}
              </button>
              <button type="button" className="module-action-button" onClick={() => setSalidaForm(getDefaultSalidaForm())}>
                Limpiar
              </button>
            </div>
            <div className="nested-panel movement-register-list">
              <div className="almacen-subpanel-header">
                <h3>Recetas ya registradas</h3>
                <span>{movimientosData.recetasRegistradas.length} acumuladas en el rango</span>
              </div>
              <div className="mini-list compact-list">
                {movimientosData.recetasRegistradas.slice(0, 6).map((item) => (
                  <button
                    type="button"
                    className="mini-item selectable-item recipe-mini-card"
                    key={`receta-registrada-${item.id_recetario}`}
                    onClick={() => abrirRecetaDesdeRuta(item)}
                  >
                    <strong>{item.nombre_platillo}</strong>
                    <span>{item.total_platillos} platillos · {item.registros} registros</span>
                    <small className="route-chip chip-receta">{item.ultimo_registro_label}</small>
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className={`almacen-subpanel spotlight-panel spotlight-buy ${movementFocus === 'compras-sugeridas' ? 'active-spotlight' : ''}`}>
            <div className="almacen-subpanel-header">
              <h3>Checklist y corte de reposicion</h3>
              <span>Lo comprado contra lo consumido por recetas</span>
            </div>
            <div className="quick-list">
              <div className="quick-item static-card">
                <div>
                  <strong>Recetas registradas</strong>
                  <span>Capturas del periodo para el corte</span>
                </div>
                <em>{movimientosData.corte.recetas_registradas}</em>
              </div>
              <div className="quick-item">
                <div>
                  <strong>Platillos registrados</strong>
                  <span>Total operado desde recetas usadas</span>
                </div>
                <em>{movimientosData.corte.platillos_registrados}</em>
              </div>
              <div className="quick-item">
                <div>
                  <strong>Consumo estimado</strong>
                  <span>Costo real del uso de recetas</span>
                </div>
                <em>{formatCurrency(movimientosData.corte.salidas_periodo)}</em>
              </div>
              <div className="quick-item">
                <div>
                  <strong>Compras del periodo</strong>
                  <span>{movimientosData.resumen.entradas} entradas registradas</span>
                </div>
                <em>{formatCurrency(movimientosData.corte.compras_periodo)}</em>
              </div>
              <div className="quick-item">
                <div>
                  <strong>Balance del corte</strong>
                  <span>Comprado menos consumo estimado</span>
                </div>
                <em>{formatCurrency(movimientosData.corte.balance_periodo)}</em>
              </div>
            </div>
            <div className="helper-note">
              Aquí el foco ya no es la venta. Primero registras qué receta salió y luego el sistema te deja ver si hace falta reponer con compra manual o sugerida.
            </div>
          </div>

          <div className={`almacen-subpanel spotlight-panel spotlight-alert ${movementFocus === 'alertas' ? 'active-spotlight' : ''}`}>
            <div className="almacen-subpanel-header">
              <h3>Control de mínimos y máximos</h3>
              <span>{itemsBajoMinimo.length} bajo mínimo · {movimientosData.insumosComprometidos.length} insumos comprometidos</span>
            </div>
            <div className="mini-list compact-list">
              {movimientosData.insumosComprometidos.slice(0, 4).map((item) => (
                <div className={`mini-item recommendation-mini-card ${getOperationalStockState(item).className}`} key={`consumo-${item.id_item}`}>
                  <strong>{item.nombre_item}</strong>
                  <span>
                    Usado {item.cantidad_consumida} {item.unidad_consumo} · costo {formatCurrency(item.costo_consumido)}
                  </span>
                  <small className={`stock-pill ${getOperationalStockState(item).className}`}>{getOperationalStockState(item).label}</small>
                </div>
              ))}
              {itemsBajoMinimo.slice(0, 5).map((item) => (
                <button
                  type="button"
                  className={`mini-item selectable-item alert-mini-card ${getOperationalStockState(item).className}`}
                  key={`mov-min-${item.id_item}`}
                  onClick={abrirCompraManual}
                >
                  <strong>{item.nombre_item}</strong>
                  <span>
                    Stock {item.stock_actual} · Min {item.stock_minimo_interno} · Punto {item.punto_reorden_interno}
                  </span>
                  <small className={`stock-pill ${getOperationalStockState(item).className}`}>{getOperationalStockState(item).label}</small>
                </button>
              ))}
              {itemsSobreMaximo.slice(0, 3).map((item) => (
                <div className="mini-item recommendation-mini-card no-history" key={`mov-max-${item.id_item}`}>
                  <strong>{item.nombre_item}</strong>
                  <span>Stock {item.stock_actual} · Máx {item.stock_maximo_interno}</span>
                  <small className="stock-pill neutral">Sobre máximo</small>
                </div>
              ))}
            </div>
            <div className="nested-panel" style={{ marginTop: 12 }}>
              <div className="almacen-subpanel-header">
                <h3>Registrar nota de calidad</h3>
                <span>Estado, merma o prioridad de un insumo</span>
              </div>
              <div className="form-grid-fields">
                <label>
                  <span>Insumo</span>
                  <select
                    value={notaCalidadForm.id_item}
                    onChange={(event) => {
                      const sel = (almacenCompras?.catalogo || []).find((c) => String(c.id_item) === event.target.value);
                      setNotaCalidadForm((cur) => ({ ...cur, id_item: event.target.value, nombre_item: sel?.nombre_item || '' }));
                    }}
                  >
                    <option value="">Selecciona insumo...</option>
                    {(almacenCompras?.catalogo || []).map((c) => (
                      <option key={`nc-${c.id_item}`} value={c.id_item}>{c.nombre_item}</option>
                    ))}
                  </select>
                </label>
                <label>
                  <span>Prioridad</span>
                  <select value={notaCalidadForm.prioridad} onChange={(event) => setNotaCalidadForm((cur) => ({ ...cur, prioridad: event.target.value }))}>
                    <option value="urgente">Urgente — hay que darle salida</option>
                    <option value="advertencia">Advertencia — revisar pronto</option>
                    <option value="info">Informativa</option>
                  </select>
                </label>
                <label className="field-span-2">
                  <span>Nota</span>
                  <input
                    type="text"
                    placeholder="Ej: el aguacate se está mayugando, prioridad de salida hoy"
                    value={notaCalidadForm.nota}
                    onChange={(event) => setNotaCalidadForm((cur) => ({ ...cur, nota: event.target.value }))}
                  />
                </label>
              </div>
              <div className="module-actions" style={{ marginBottom: 8 }}>
                <button
                  type="button"
                  className="module-action-button primary"
                  disabled={!notaCalidadForm.id_item || !notaCalidadForm.nota.trim()}
                  onClick={() => {
                    const nuevaNota = {
                      id: Date.now(),
                      fecha: new Date().toISOString(),
                      id_item: notaCalidadForm.id_item,
                      nombre_item: notaCalidadForm.nombre_item,
                      prioridad: notaCalidadForm.prioridad,
                      nota: notaCalidadForm.nota.trim(),
                      registrado_por: user.nombre_completo || 'Sistema'
                    };
                    const nuevas = [nuevaNota, ...notasCalidad];
                    setNotasCalidad(nuevas);
                    try { localStorage.setItem(`notas_calidad_${user.business_id}`, JSON.stringify(nuevas)); } catch {}
                    setNotaCalidadForm({ id_item: '', nombre_item: '', prioridad: 'urgente', nota: '' });
                  }}
                >
                  Guardar nota
                </button>
              </div>
              {notasCalidad.length > 0 && (
                <div className="mini-list compact-list" style={{ maxHeight: 200, overflowY: 'auto' }}>
                  {notasCalidad.slice(0, 8).map((n) => (
                    <div className={`mini-item recommendation-mini-card ${n.prioridad === 'urgente' ? 'rojo' : n.prioridad === 'advertencia' ? 'amarillo' : 'neutral'}`} key={`nota-${n.id}`}>
                      <strong>{n.nombre_item}</strong>
                      <span>{n.nota}</span>
                      <small className={`stock-pill ${n.prioridad === 'urgente' ? 'rojo' : n.prioridad === 'advertencia' ? 'amarillo' : 'neutral'}`}>
                        {new Date(n.fecha).toLocaleDateString('es-MX', { day: '2-digit', month: 'short' })} · {n.prioridad}
                      </small>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className={`almacen-subpanel ${movementFocus === 'historial' ? 'spotlight-panel spotlight-movement active-spotlight' : ''}`}>
          {(() => {
            const buscarTxt = (movimientosFiltro.buscarInsumo || '').trim().toLowerCase();
            const tipoFiltro = movimientosFiltro.tipoMov || '';
            const responsableFiltro = (movimientosFiltro.responsable || '').trim().toLowerCase();
            const movsFiltrados = movimientosData.movimientos.filter((item) => {
              const matchTipo = !tipoFiltro || item.tipo === tipoFiltro;
              const matchInsumo = !buscarTxt
                || (item.concepto || '').toLowerCase().includes(buscarTxt)
                || (item.detalle || '').toLowerCase().includes(buscarTxt)
                || (item.motivo || '').toLowerCase().includes(buscarTxt);
              const matchResponsable = !responsableFiltro || (item.responsable || '').toLowerCase().includes(responsableFiltro);
              return matchTipo && matchInsumo && matchResponsable;
            });
            const notasFiltradas = notasCalidad.filter((n) => {
              const matchInsumo = !buscarTxt || (n.nombre_item || '').toLowerCase().includes(buscarTxt);
              return matchInsumo;
            }).map((n) => ({ ...n, _esNota: true }));
            const filas = [...notasFiltradas, ...movsFiltrados];
            const labelFiltro = buscarTxt ? ` · filtrando "${movimientosFiltro.buscarInsumo}"` : '';
            return (
              <>
                <div className="almacen-subpanel-header">
                  <h3>Historial de movimientos</h3>
                  <span>{movsFiltrados.length} registros{labelFiltro} · {formatCurrency(movimientosData.resumen.totalCompras)} comprado</span>
                </div>
                <div className="recetario-table-wrap">
                  <table className="recetario-table history-table">
                    <thead>
                      <tr>
                        <th>Fecha</th>
                        <th>Tipo</th>
                        <th>Insumo / Concepto</th>
                        <th>Responsable</th>
                        <th>Rol</th>
                        <th>Detalle / Motivo</th>
                        <th>Total / Estado</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filas.map((item) => item._esNota ? (
                        <tr key={`nota-${item.id}`} className="history-row nota-calidad">
                          <td>{new Date(item.fecha).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: '2-digit' })}</td>
                          <td><span className="history-type-pill nota">Nota</span></td>
                          <td><strong>{item.nombre_item}</strong></td>
                          <td><span className="history-responsable-pill">{item.registrado_por || '—'}</span></td>
                          <td><small>{item.rol_registrado || '—'}</small></td>
                          <td>{item.nota}</td>
                          <td className="history-total-cell">
                            <span className={`stock-pill ${item.prioridad === 'urgente' ? 'rojo' : 'amarillo'}`}>{item.prioridad}</span>
                          </td>
                        </tr>
                      ) : (
                        <tr key={item.id} className={`history-row ${item.tipo === 'Entrada' ? 'entrada' : 'salida'}`}>
                          <td>{item.fecha_label}</td>
                          <td>
                            <span className={`history-type-pill ${item.tipo === 'Entrada' ? 'entrada' : 'salida'}`}>{item.tipo}</span>
                          </td>
                          <td><strong>{item.concepto}</strong></td>
                          <td>
                            <span className="history-responsable-pill">{item.responsable || '—'}</span>
                          </td>
                          <td><small>{item.rol || '—'}</small></td>
                          <td>{item.detalle || item.motivo || '—'}</td>
                          <td className="history-total-cell">{item.total_label}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            );
          })()}
        </div>

        {/* ── KARDEX POR INSUMO ── */}
        <div className={`almacen-subpanel ${movementFocus === 'kardex' ? 'spotlight-panel spotlight-movement active-spotlight' : ''}`}>
          <div className="almacen-subpanel-header">
            <h3>Kardex por insumo</h3>
            <span>Tarjeta de movimientos con balance corriente · entradas, salidas, mermas y existencia</span>
          </div>

          {/* Merma registration form */}
          <details className="kardex-merma-details" open={false}>
            <summary className="kardex-merma-summary">Registrar merma / baja de inventario</summary>
            {(mermaMessage || mermaError) && (
              <div className={`operation-banner ${mermaError ? 'error' : 'success'}`}>{mermaError || mermaMessage}</div>
            )}
            <div className="form-grid-fields">
              <label>
                <span>Insumo</span>
                <select
                  value={mermaForm.idInsumo}
                  onChange={(ev) => setMermaForm((f) => ({ ...f, idInsumo: ev.target.value }))}
                >
                  <option value="">— Selecciona insumo —</option>
                  {(movimientosData?.catalogo || []).map((item) => (
                    <option key={item.id_insumo} value={item.id_insumo}>
                      {item.nombre_item} (stock: {item.stock_actual} {item.unidad_consumo})
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span>Cantidad a dar de baja</span>
                <input
                  type="number"
                  min="0"
                  step="0.001"
                  value={mermaForm.cantidad}
                  onChange={(ev) => setMermaForm((f) => ({ ...f, cantidad: ev.target.value }))}
                  placeholder="0.000"
                />
              </label>
              <label>
                <span>Costo unitario (referencia)</span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={mermaForm.costoUnitario}
                  onChange={(ev) => setMermaForm((f) => ({ ...f, costoUnitario: ev.target.value }))}
                  placeholder="$0.00"
                />
              </label>
              <label>
                <span>Motivo</span>
                <input
                  value={mermaForm.motivo}
                  onChange={(ev) => setMermaForm((f) => ({ ...f, motivo: ev.target.value }))}
                  placeholder="Ej. Caducidad, daño, derrame..."
                />
              </label>
              <label>
                <span>Responsable</span>
                <input
                  value={mermaForm.responsable}
                  onChange={(ev) => setMermaForm((f) => ({ ...f, responsable: ev.target.value }))}
                  placeholder={user?.nombre_completo || 'Nombre del responsable'}
                />
              </label>
            </div>
            <div className="module-actions">
              <button
                type="button"
                className="module-action-button danger"
                onClick={handleRegistrarMerma}
                disabled={isSavingMerma}
              >
                {isSavingMerma ? 'Registrando...' : 'Registrar merma'}
              </button>
            </div>
          </details>

          {/* Kardex selector */}
          <div className="form-grid-fields" style={{ marginTop: '1rem' }}>
            <label>
              <span>Insumo / Artículo</span>
              <select
                value={kardexInsumoId}
                onChange={(ev) => {
                  setKardexInsumoId(ev.target.value);
                  setKardexData(null);
                }}
              >
                <option value="">— Selecciona un insumo —</option>
                {(() => {
                  const cats = {};
                  (movimientosData?.catalogo || []).forEach((item) => {
                    const cat = item.subcategoria_nombre || item.unidad_consumo || 'General';
                    if (!cats[cat]) cats[cat] = [];
                    cats[cat].push(item);
                  });
                  return Object.entries(cats).map(([cat, items]) => (
                    <optgroup key={cat} label={cat}>
                      {items.map((item) => (
                        <option key={item.id_insumo} value={item.id_insumo}>
                          {item.nombre_item}
                        </option>
                      ))}
                    </optgroup>
                  ));
                })()}
              </select>
            </label>
            <label>
              <span>Desde</span>
              <input
                type="date"
                value={kardexFechaInicio}
                onChange={(ev) => setKardexFechaInicio(ev.target.value)}
              />
            </label>
            <label>
              <span>Hasta</span>
              <input
                type="date"
                value={kardexFechaFin}
                onChange={(ev) => setKardexFechaFin(ev.target.value)}
              />
            </label>
          </div>
          <div className="module-actions">
            <button
              type="button"
              className="module-action-button"
              disabled={!kardexInsumoId || kardexLoading}
              onClick={() => cargarKardex(kardexInsumoId, kardexFechaInicio, kardexFechaFin)}
            >
              {kardexLoading ? 'Cargando...' : 'Ver kardex'}
            </button>
            {kardexData && (
              <>
                <button
                  type="button"
                  className="module-action-button"
                  onClick={() => {
                    const headerRow = ['ID', 'Clave', 'Artículo', 'Fecha', 'Mov', 'Entra', 'Sale', 'Existencia', 'Costo', 'Valor$', 'ValorInv$', 'Responsable', 'Motivo'];
                    const dataRows = kardexData.rows.map((r) => [
                      r.id, r.clave, kardexData.item.nombre_item,
                      r.fecha_label, r.mov,
                      r.entra ?? '', r.sale ?? '',
                      r.existencia, r.costo,
                      r.valor_mov, r.valor_inv,
                      r.responsable, r.motivo
                    ]);
                    descargarCsv(`kardex_${kardexData.item.nombre_item.replace(/\s+/g, '_')}.csv`, [headerRow, ...dataRows]);
                  }}
                >
                  Descargar Excel / CSV
                </button>
                <button
                  type="button"
                  className="module-action-button"
                  onClick={() => {
                    const popup = window.open('', '_blank', 'width=1000,height=720');
                    if (!popup) return;
                    const item = kardexData.item;
                    const rows = kardexData.rows;
                    const tot = kardexData.totales;
                    popup.document.write(`<html><head><title>Kardex ${item.nombre_item}</title>
                      <style>body{font-family:Arial,sans-serif;padding:24px;color:#0f172a}
                      h1{margin-bottom:4px}p{margin:2px 0;font-size:13px}
                      table{width:100%;border-collapse:collapse;margin-top:16px;font-size:12px}
                      th,td{border:1px solid #cbd5e1;padding:6px 8px;text-align:right}
                      th{background:#f1f5f9;text-align:center}
                      td:nth-child(4),td:nth-child(5){text-align:center}
                      td:nth-child(1),td:nth-child(2),td:nth-child(3){text-align:left}
                      .mov-MERMA{background:#fef2f2}.mov-COMPRA{background:#f0fdf4}.mov-RECETA{background:#eff6ff}
                      tfoot td{font-weight:bold;background:#f8fafc}</style></head>
                      <body><h1>Kardex de inventario: ${item.nombre_item}</h1>
                      <p>Unidad: ${item.unidad_consumo || '—'} &nbsp;|&nbsp; Stock actual: ${item.stock_actual}</p>
                      <p>Entradas periodo: ${tot.total_entradas} &nbsp;|&nbsp; Salidas periodo: ${tot.total_salidas}</p>
                      <table><thead><tr><th>ID</th><th>Clave</th><th>Fecha</th><th>Mov</th><th>Responsable</th><th>Motivo</th><th>Entra</th><th>Sale</th><th>Existencia</th><th>Costo</th><th>Valor$</th><th>ValorInv$</th></tr></thead>
                      <tbody>${rows.map((r) => `<tr class="mov-${r.mov}">
                        <td>${r.id}</td><td>${r.clave}</td><td>${r.fecha_label}</td>
                        <td style="text-align:center"><strong>${r.mov}</strong></td>
                        <td>${r.responsable}</td><td>${r.motivo}</td>
                        <td>${r.entra != null ? r.entra : ''}</td>
                        <td>${r.sale != null ? r.sale : ''}</td>
                        <td><strong>${r.existencia}</strong></td>
                        <td>$${r.costo.toFixed(2)}</td>
                        <td>$${r.valor_mov.toFixed(2)}</td>
                        <td>$${r.valor_inv.toFixed(2)}</td></tr>`).join('')}
                      </tbody><tfoot><tr><td colspan="6">Totales del periodo</td>
                        <td>${tot.total_entradas}</td><td>${tot.total_salidas}</td>
                        <td>${tot.stock_final}</td><td colspan="3"></td></tr></tfoot></table>
                      </body></html>`);
                    popup.document.close();
                    popup.focus();
                    popup.print();
                  }}
                >
                  Imprimir / PDF
                </button>
              </>
            )}
          </div>

          {kardexError && <div className="operation-banner error">{kardexError}</div>}

          {kardexData && (() => {
            const item = kardexData.item;
            const rows = kardexData.rows;
            const tot = kardexData.totales;
            return (
              <>
                <div className="kardex-summary-pills" style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', margin: '0.75rem 0', fontSize: '0.82rem' }}>
                  <span className="stock-pill verde">Stock actual: {item.stock_actual} {tot.unidad}</span>
                  <span className="stock-pill entrada">Entradas: +{tot.total_entradas} {tot.unidad}</span>
                  <span className="stock-pill salida">Salidas: -{tot.total_salidas} {tot.unidad}</span>
                </div>
                <div className="recetario-table-wrap">
                  <table className="recetario-table history-table" style={{ fontSize: '0.8rem' }}>
                    <thead>
                      <tr>
                        <th>ID</th>
                        <th>Clave</th>
                        <th>Artículo</th>
                        <th>Fecha</th>
                        <th>Mov</th>
                        <th>Responsable</th>
                        <th>Motivo</th>
                        <th style={{ textAlign: 'right' }}>Entra</th>
                        <th style={{ textAlign: 'right' }}>Sale</th>
                        <th style={{ textAlign: 'right' }}>Existencia</th>
                        <th style={{ textAlign: 'right' }}>Costo</th>
                        <th style={{ textAlign: 'right' }}>Valor$</th>
                        <th style={{ textAlign: 'right' }}>ValorInv$</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((r) => (
                        <tr
                          key={r.id}
                          className={`history-row ${r.mov === 'MERMA' ? 'salida' : r.tipo_operacion === 'entrada' ? 'entrada' : r.mov === 'SALDO INICIAL' ? '' : 'salida'}`}
                        >
                          <td style={{ fontSize: '0.72rem', color: '#64748b' }}>{r.id}</td>
                          <td><code style={{ fontSize: '0.72rem' }}>{r.clave}</code></td>
                          <td><strong>{item.nombre_item}</strong></td>
                          <td style={{ whiteSpace: 'nowrap' }}>{r.fecha_label}</td>
                          <td>
                            <span className={`history-type-pill ${r.mov === 'MERMA' ? 'salida' : r.tipo_operacion === 'entrada' ? 'entrada' : r.mov === 'SALDO INICIAL' ? 'nota' : 'salida'}`}>
                              {r.mov}
                            </span>
                          </td>
                          <td><span className="history-responsable-pill">{r.responsable}</span></td>
                          <td style={{ fontSize: '0.75rem', color: '#64748b' }}>{r.motivo}</td>
                          <td style={{ textAlign: 'right', color: '#16a34a', fontWeight: r.entra != null ? 600 : 400 }}>
                            {r.entra != null ? r.entra : ''}
                          </td>
                          <td style={{ textAlign: 'right', color: '#dc2626', fontWeight: r.sale != null ? 600 : 400 }}>
                            {r.sale != null ? r.sale : ''}
                          </td>
                          <td style={{ textAlign: 'right', fontWeight: 700 }}>{r.existencia}</td>
                          <td style={{ textAlign: 'right' }}>${r.costo.toFixed(2)}</td>
                          <td style={{ textAlign: 'right' }}>${r.valor_mov.toFixed(2)}</td>
                          <td style={{ textAlign: 'right', fontWeight: 600 }}>${r.valor_inv.toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr style={{ fontWeight: 700, background: '#f8fafc' }}>
                        <td colSpan={7} style={{ textAlign: 'right' }}>Totales del periodo</td>
                        <td style={{ textAlign: 'right', color: '#16a34a' }}>{tot.total_entradas}</td>
                        <td style={{ textAlign: 'right', color: '#dc2626' }}>{tot.total_salidas}</td>
                        <td style={{ textAlign: 'right' }}>{tot.stock_final}</td>
                        <td colSpan={3}></td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </>
            );
          })()}

          {!kardexData && !kardexLoading && !kardexError && (
            <p className="panel-empty">Selecciona un insumo y presiona "Ver kardex" para ver su tarjeta de movimientos.</p>
          )}
        </div>
      </div>
      </div>
    );
  }

  function renderMovimientosSummary() {
    if (!movimientosData) {
      return <p className="panel-empty">Cargando resumen de movimientos...</p>;
    }

    return (
      <div className="quick-list">
        {movimientosData.recetasRegistradas.slice(0, 5).map((item) => (
          <div className="quick-item" key={`history-summary-${item.id_recetario}`}>
            <div>
              <strong>{item.nombre_platillo}</strong>
              <span>{item.total_platillos} platillos · {item.ultimo_registro_label}</span>
            </div>
            <em>{formatCurrency(item.costo_consumo_estimado)}</em>
          </div>
        ))}
      </div>
    );
  }

  function renderConfiguracionRestauranteContent() {
    return (
      <div className="almacen-layout">
        {isNuevoTrabajadorSection && (
          <div className="almacen-subpanel">
            <div className="almacen-subpanel-header">
              <h3>Alta de usuarios restaurante</h3>
              <span>Gerentes y trabajadores del negocio restaurante</span>
            </div>
            <div className="helper-note">
              Recomendación: usa un correo o perfil identificable para restaurante. El administrador ve todo; restaurante solo ve sus usuarios.
            </div>
            {(workerMessage || workerError) && (
              <div className={`operation-banner ${workerError ? 'error' : 'success'}`}>{workerError || workerMessage}</div>
            )}
            <div className="form-grid-fields">
              <label>
                <span>Ámbito</span>
                <input value="Restaurante" readOnly />
              </label>
              <label>
                <span>Tipo de usuario</span>
                <select
                  value={workerForm.tipoUsuario}
                  onChange={(event) => setWorkerForm((current) => ({ ...current, tipoUsuario: event.target.value }))}
                >
                  <option value="trabajador">Trabajador</option>
                  <option value="gerente">Gerente</option>
                </select>
              </label>
              <label>
                <span>Nombre completo</span>
                <input
                  value={workerForm.nombre_completo}
                  onChange={(event) => setWorkerForm((current) => ({ ...current, nombre_completo: event.target.value }))}
                  placeholder="Ej. Encargado Restaurante Centro"
                />
              </label>
              <label>
                <span>Correo</span>
                <input
                  value={workerForm.correo}
                  onChange={(event) => setWorkerForm((current) => ({ ...current, correo: event.target.value }))}
                  placeholder="ejemplo.restaurante@dominio.com"
                />
              </label>
              <label>
                <span>Contraseña</span>
                <input
                  type="text"
                  value={workerForm.contrasena}
                  onChange={(event) => setWorkerForm((current) => ({ ...current, contrasena: event.target.value }))}
                />
              </label>
              <label>
                <span>Teléfono</span>
                <input
                  value={workerForm.telefono}
                  onChange={(event) => setWorkerForm((current) => ({ ...current, telefono: event.target.value }))}
                />
              </label>
            </div>
            <div className="module-actions">
              <button
                type="button"
                className="module-action-button success"
                onClick={handleGuardarTrabajador}
                disabled={isSavingWorker}
              >
                {isSavingWorker ? 'Guardando...' : 'Guardar usuario'}
              </button>
            </div>
          </div>
        )}

        <div className="almacen-subpanel-grid configuracion-modelo-grid">
          <div className="almacen-subpanel">
            <div className="almacen-subpanel-header">
              <h3>Configuración del restaurante</h3>
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
                  placeholder="Nombre del restaurante"
                />
              </label>
              <label>
                <span>Tipo de negocio</span>
                <input value="Restaurante" readOnly />
              </label>
            </div>
            <div className="recipe-image-upload-row">
              <label className="recipe-upload-box">
                Subir foto del restaurante
                <input type="file" accept="image/*" onChange={handleBusinessPhotoChange} />
              </label>
              {businessConfigForm.logo_preview && (
                <button type="button" className="module-action-button" onClick={limpiarBusinessPhoto}>
                  Quitar foto
                </button>
              )}
            </div>
            {businessConfigForm.logo_preview ? (
              <img src={businessConfigForm.logo_preview} alt="Restaurante" className="recipe-image form-preview-image" />
            ) : (
              <div className="image-placeholder-card compact-placeholder">
                Puedes cargar una foto o logo del restaurante. La imagen se guarda en este equipo para identificar el negocio.
              </div>
            )}
            <div className="module-actions">
              <button
                type="button"
                className="module-action-button success"
                onClick={handleGuardarConfiguracionRestaurante}
                disabled={isSavingBusinessConfig}
              >
                {isSavingBusinessConfig ? 'Guardando...' : 'Guardar configuración'}
              </button>
            </div>
          </div>

          {error ? (
            <p className="panel-empty">No se pudieron cargar usuarios restaurante: {error}</p>
          ) : (
            <BusinessUsersTable
              title="Todos los usuarios del restaurante"
              subtitle="Se muestran solo el dueño, gerentes y trabajadores del negocio restaurante actual."
              emptyMessage="No hay usuarios visibles en este negocio de restaurante."
              users={usuarios}
              scope="restaurante"
              actionLabel="Eliminar usuario"
              onAction={handleEliminarUsuarioRestaurante}
              isActionDisabled={(item) => item.id_usuario === user?.id_usuario}
            />
          )}
        </div>
      </div>
    );
  }

  function renderConfiguracionRestauranteSummary() {
    return (
      <div className="quick-list">
        {configuracionCards.map((item) => (
          <div className="quick-item" key={item.title}>
            <div>
              <strong>{item.title}</strong>
              <span>{item.detail}</span>
            </div>
            <em>{item.value}</em>
          </div>
        ))}
      </div>
    );
  }

  function renderSelectionDetails() {
    if (gestionActiva === 'inventario') {
      return selectedItem ? (
        <div className="detail-card">
          <strong>{selectedItem.nombre_item}</strong>
          <span>
            {selectedItem.categoria} · {selectedItem.subcategoria}
          </span>
          <span>
            Conservación: {selectedItem.tipo_conservacion || 'Sin definir'} · Unidad: {selectedItem.unidad_consumo}
          </span>
          <span>Stock actual: {selectedItem.stock_actual}</span>
          <div className="detail-inline-actions">
            <button type="button" className="module-action-button success" onClick={() => abrirCompraDesdeInsumo(selectedItem)}>
              Registrar compra de este insumo
            </button>
          </div>
          {renderItemPurchaseHistory(selectedItem.id_item)}
        </div>
      ) : (
        <p className="panel-empty">Selecciona un insumo para ver sus detalles y editarlo.</p>
      );
    }

    if (gestionActiva === 'proveedor') {
      return selectedProvider ? (
        <div className="detail-card">
          <strong>{selectedProvider.nombre_prov}</strong>
          <span>{selectedProvider.tipo_proveedor}</span>
          <span>{selectedProvider.correo_prov || selectedProvider.telefono_prov || 'Sin contacto'}</span>
          <span>{selectedProvider.direccion_prov || 'Sin dirección'}</span>
        </div>
      ) : (
        <p className="panel-empty">Selecciona un proveedor para cargarlo o eliminarlo.</p>
      );
    }

    if (selectedPurchase && activeReceptionItems.length) {
      const totalItems = activeReceptionItems.length;
      const verificados = activeReceptionItems.filter((item) => recepcionChecklist[item.id]?.llego).length;
      const noLlegaron = activeReceptionItems.filter((item) => recepcionChecklist[item.id]?.noLlego).length;
      const revisados = verificados + noLlegaron;
      const porcentaje = totalItems > 0 ? Math.round((revisados / totalItems) * 100) : 0;
      const todosVerificados = revisados === totalItems && totalItems > 0;

      return (
        <div className="detail-card recepcion-card">
          {renderPurchaseSessionCards()}
          <div className="recepcion-titulo">
            <div>
              <strong>Recepción de compra</strong>
              <span className="recepcion-subtitulo">Verifica cada artículo conforme llega</span>
            </div>
            {todosVerificados && noLlegaron === 0 && <span className="recepcion-listo">Todo recibido</span>}
            {todosVerificados && noLlegaron > 0 && <span className="recepcion-listo recepcion-listo-parcial">Revisión completa · {noLlegaron} no llegaron</span>}
            {autoSaveReceptionState !== 'idle' && <span className={`recepcion-autosave-pill ${autoSaveReceptionState}`}>{autoSaveReceptionState === 'saving' ? 'Guardando...' : autoSaveReceptionState === 'pending' ? 'Guardado automático en espera' : autoSaveReceptionState === 'saved' ? 'Guardado automático' : 'Error al guardar'}</span>}
          </div>
          <div className="recepcion-progreso">
            <div className="recepcion-barra">
              <div className="recepcion-barra-fill" style={{ width: `${porcentaje}%` }} />
            </div>
            <span className="recepcion-progreso-texto">{verificados}/{totalItems} recibidos{noLlegaron > 0 ? ` · ${noLlegaron} no llegaron` : ''} · {porcentaje}%</span>
          </div>
          <div className="detail-stack recepcion-lista">
            {activeReceptionItems.map((item) => {
              const recepcion = recepcionChecklist[item.id] || { llego: false, noLlego: false, cantidadRecibida: item.cantidad || '', condicion: 'buena', nota: '' };
              const catalogItem = item.itemId
                ? (almacenCompras?.catalogo || []).find((c) => Number(c.id_item) === item.itemId)
                : null;
              const unidad = catalogItem?.unidad_consumo || item.unidad || 'unidad';
              const convRecepcion = convertirUnidades(recepcion.cantidadRecibida, unidad);

              return (
                <div key={`recepcion-${item.id}`} className={`checklist-recepcion-item ${recepcion.llego ? 'verificado' : ''} ${recepcion.noLlego ? 'no-llego' : ''} ${recepcion.condicion !== 'buena' && !recepcion.noLlego ? 'con-observacion' : ''}`}>
                  <div className="recepcion-header">
                    <div className="recepcion-check">
                      <div className="recepcion-toggle-btns">
                        <button
                          type="button"
                          className={`recepcion-btn-ok ${recepcion.llego ? 'activo' : ''}`}
                          title="Sí llegó"
                          onClick={() => {
                            actualizarRecepcionItem(item.id, 'llego', !recepcion.llego);
                            if (!recepcion.llego) actualizarRecepcionItem(item.id, 'noLlego', false);
                          }}
                        >✓</button>
                        <button
                          type="button"
                          className={`recepcion-btn-no ${recepcion.noLlego ? 'activo' : ''}`}
                          title="No llegó / perdido"
                          onClick={() => {
                            actualizarRecepcionItem(item.id, 'noLlego', !recepcion.noLlego);
                            if (!recepcion.noLlego) actualizarRecepcionItem(item.id, 'llego', false);
                          }}
                        >✗</button>
                      </div>
                      <div className="recepcion-item-info">
                        <strong>{item.descripcion}</strong>
                        {catalogItem && (
                          <small>Stock: {toNumber(catalogItem.stock_actual)} {unidad} · Reorden: {toNumber(catalogItem.punto_reorden_interno || catalogItem.punto_reorden)}</small>
                        )}
                        {!catalogItem && <small>Producto nuevo · {unidad}</small>}
                      </div>
                    </div>
                    <span className={`recepcion-estado ${recepcion.llego ? 'estado-ok' : recepcion.noLlego ? 'estado-no-llego' : recepcion.condicion !== 'buena' ? 'estado-alerta' : 'estado-pendiente'}`}>
                      {recepcion.llego ? '✓ Llegó' : recepcion.noLlego ? '✗ No llegó' : recepcion.condicion !== 'buena' ? '⚠ ' + recepcion.condicion : '○ Pendiente'}
                    </span>
                  </div>
                  {catalogItem?.ultimo_precio_compra || catalogItem?.precio_competencia_promedio ? (
                    <div className="recepcion-precio-ref">
                      Último precio: {formatCurrency(catalogItem.ultimo_precio_compra || catalogItem.precio_competencia_promedio)} / {unidad}
                    </div>
                  ) : null}
                  <div className="recepcion-fields">
                    <label>
                      <span>Cantidad recibida ({unidad})</span>
                      <input
                        type="number"
                        step="0.001"
                        value={recepcion.cantidadRecibida}
                        onChange={(e) => actualizarRecepcionItem(item.id, 'cantidadRecibida', e.target.value)}
                        placeholder={`Esperado: ${item.cantidad || '?'} ${unidad}`}
                      />
                    </label>
                    <label>
                      <span>Condición al llegar</span>
                      <select
                        value={recepcion.condicion}
                        onChange={(e) => actualizarRecepcionItem(item.id, 'condicion', e.target.value)}
                      >
                        <option value="buena">✓ Buena</option>
                        <option value="regular">◐ Regular</option>
                        <option value="mala">✗ Mala / dañado</option>
                        <option value="incompleto">◑ Incompleto</option>
                      </select>
                    </label>
                    <label>
                      <span>Prioridad en sistema</span>
                      <select
                        value={recepcion.prioridad || item.prioridad || 'media'}
                        onChange={(e) => actualizarRecepcionItem(item.id, 'prioridad', e.target.value)}
                      >
                        <option value="alta">Alta</option>
                        <option value="media">Media</option>
                        <option value="baja">Baja</option>
                      </select>
                    </label>
                  </div>
                  {convRecepcion.length > 0 && recepcion.cantidadRecibida && (
                    <div className="convertidor-live compact">
                      <span className="convertidor-label">≈</span>
                      <div className="convertidor-chips">
                        {convRecepcion.map((c, ci) => (
                          <span key={ci} className="convertidor-chip">{c.valor} {c.unidad}</span>
                        ))}
                      </div>
                    </div>
                  )}
                  <label className="recepcion-nota">
                    <span>Nota de recepción</span>
                    <input
                      value={recepcion.nota}
                      onChange={(e) => actualizarRecepcionItem(item.id, 'nota', e.target.value)}
                      placeholder="Ej. Llegó maduro, caja abierta, faltó 1 kg..."
                    />
                  </label>
                  <div className="recepcion-meta-inline">
                    <span className={`purchase-session-status ${recepcion.llego ? 'ok' : recepcion.noLlego ? 'missing' : 'pending'}`}>
                      {recepcion.llego ? '✓ Llegó' : recepcion.noLlego ? '✗ No llegó' : '○ Pendiente'}
                    </span>
                    <span className="recepcion-meta">{getReceptionConditionLabel(recepcion.condicion)} · {getReceptionPriorityLabel(recepcion.prioridad || item.prioridad || 'media')}</span>
                  </div>
                </div>
              );
            })}
          </div>
          {(() => {
            let totalRecibido = 0;
            let totalPerdido = 0;
            let itemsConPrecio = 0;
            activeReceptionItems.forEach((item) => {
              const recepcion = recepcionChecklist[item.id] || {};
              const catItem = item.itemId ? (almacenCompras?.catalogo || []).find((c) => Number(c.id_item) === item.itemId) : null;
              const precio = toNumber(catItem?.ultimo_precio_compra || catItem?.precio_competencia_promedio || 0);
              const cantRecibida = toNumber(recepcion.cantidadRecibida || 0);
              if (precio > 0) itemsConPrecio++;
              if (recepcion.llego && cantRecibida > 0) {
                totalRecibido += cantRecibida * precio;
              }
              if (recepcion.noLlego && cantRecibida > 0) {
                totalPerdido += cantRecibida * precio;
              } else if (recepcion.noLlego && item.cantidad) {
                totalPerdido += toNumber(item.cantidad) * precio;
              }
            });
            if (itemsConPrecio === 0) return null;
            return (
              <div className="recepcion-resumen-total">
                <div className="recepcion-resumen-row">
                  <span>Total recibido</span>
                  <strong className="resumen-recibido">{formatCurrency(totalRecibido)}</strong>
                </div>
                {totalPerdido > 0 && (
                  <div className="recepcion-resumen-row">
                    <span>Pérdida estimada</span>
                    <strong className="resumen-perdido">{formatCurrency(totalPerdido)}</strong>
                  </div>
                )}
                <div className="recepcion-resumen-row resumen-gran-total">
                  <span>Total del lote</span>
                  <strong>{formatCurrency(totalRecibido + totalPerdido)}</strong>
                </div>
              </div>
            );
          })()}
          {todosVerificados && (
            <div className="recepcion-completa-msg">
              La recepción ya quedó registrada. Cada palomita y nota alimenta el sistema y actualiza inventario en cuanto se guarda la compra.
            </div>
          )}
        </div>
      );
    }

    if (checklistSeleccionado.length) {
      return (
        <div className="detail-card">
          <div className="purchase-history-inline">
            <strong>Faltantes por comprar</strong>
            <span>Estos insumos siguen pendientes. Cuando los guardes en compra desaparecerán de la lista de abajo y se quedarán en el detalle de compra.</span>
          </div>
          {checklistSeleccionado.map((item) => {
            const catalogItem = item.itemId
              ? (almacenCompras?.catalogo || []).find((entry) => Number(entry.id_item) === Number(item.itemId))
              : null;

            return (
              <div key={`pending-checklist-${item.id}`} className="purchase-history-card">
                <div className="purchase-history-inline">
                  <strong>{item.descripcion}</strong>
                  <span>{getReceptionPriorityLabel(item.prioridad || 'media')}</span>
                </div>
                <span className="recepcion-meta">
                  {item.cantidad ? `${item.cantidad} ${item.unidad}` : item.unidad} · {item.nota || 'Pendiente por comprar'}
                </span>
                {catalogItem ? (
                  <span className="recepcion-meta">
                    Stock: {toNumber(catalogItem.stock_actual)} {catalogItem.unidad_consumo} · Reorden: {toNumber(catalogItem.punto_reorden_interno || catalogItem.punto_reorden)}
                  </span>
                ) : (
                  <span className="recepcion-meta">Insumo nuevo todavía sin historial de compra.</span>
                )}
              </div>
            );
          })}
        </div>
      );
    }

    return selectedPurchase ? (
      <div className="detail-card">
        {(() => {
          const purchaseMeta = parsePurchaseMetadata(selectedPurchase.observaciones_compra || '');
          return (
            <>
        <div className="purchase-history-inline">
          <strong>Detalle seleccionado de compra</strong>
          <span>Los insumos registrados se van acumulando aquí en tarjetas y desde aquí mismo pasas a recepción.</span>
        </div>
        {renderPurchaseSessionCards()}
        <strong>Lote #{selectedPurchase.id_lote}</strong>
        <span>
          {selectedPurchase.item_nombre} · {selectedPurchase.item_subcategoria}
        </span>
        <span>
          {selectedPurchase.proveedor_nombre} · {selectedPurchase.proveedor_tipo}
        </span>
        <span>
          Registro: {getPurchaseFlowLabel(purchaseMeta.metadata.purchase_flow)} · {getPurchaseEvidenceLabel(purchaseMeta.metadata.evidence_type)}
        </span>
        <span>Folio: {selectedPurchase.folio_externo || 'Sin folio capturado'}</span>
        <span>
          Cantidad: {selectedPurchase.cantidad_recibida} {selectedPurchase.unidad_consumo} · Total:{' '}
          {formatCurrency(selectedPurchase.total_lote)}
        </span>
        <span>Capturado: {formatDateTime(selectedPurchase.fecha_entrada)}</span>
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

          return (
            <div className="recepcion-guardada">
              <div className="recepcion-guardada-titulo">
                <span>Recepción registrada</span>
                <span className="recepcion-guardada-fecha">{formatDateTime(selectedPurchase.fecha_entrada)}</span>
              </div>
              {items.length > 0 && (
                <div className="recepcion-guardada-items">
                  {recibidos.map((item, i) => (
                    <div key={`r-${i}`} className="recepcion-guardada-linea ok">{item}</div>
                  ))}
                  {perdidos.map((item, i) => (
                    <div key={`p-${i}`} className="recepcion-guardada-linea perdido">{item}</div>
                  ))}
                  {pendientes.map((item, i) => (
                    <div key={`pe-${i}`} className="recepcion-guardada-linea pendiente">{item}</div>
                  ))}
                </div>
              )}
              {resumenTexto && (
                <div className="recepcion-resumen-total">
                  {recibidosMatch && (
                    <div className="recepcion-resumen-row">
                      <span>Recibidos ({recibidosMatch[1]})</span>
                      <strong className="resumen-recibido">{formatCurrency(Number(recibidosMatch[2]))}</strong>
                    </div>
                  )}
                  {perdidasMatch && (
                    <div className="recepcion-resumen-row">
                      <span>Pérdidas ({perdidasMatch[1]})</span>
                      <strong className="resumen-perdido">{formatCurrency(Number(perdidasMatch[2]))}</strong>
                    </div>
                  )}
                  {totalMatch && (
                    <div className="recepcion-resumen-row resumen-gran-total">
                      <span>Total del lote</span>
                      <strong>{formatCurrency(Number(totalMatch[1]))}</strong>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })()}
        {purchaseMeta.baseNote && !selectedPurchase.observaciones_compra.includes('[Recepción]') && (
          <span className="recepcion-meta">{purchaseMeta.baseNote}</span>
        )}
        {selectedPurchase.observaciones_compra && selectedPurchase.observaciones_compra.includes('[Recepción]') && (() => {
          const notaBase = purchaseMeta.baseNote;
          return notaBase ? <span className="recepcion-meta">{notaBase}</span> : null;
        })()}
        {renderItemPurchaseHistory(selectedPurchase.id_item, 'No hay más compras registradas para este insumo.')}
            </>
          );
        })()}
      </div>
    ) : selectedPurchase || purchaseSessionItems.length ? (
      <div className="detail-card">
        <div className="purchase-history-inline">
          <strong>Detalle seleccionado de compra</strong>
          <span>La compra se queda fija aquí y cada nuevo insumo se suma a esta lista en el momento.</span>
        </div>
        {renderPurchaseSessionCards()}
        {selectedPurchase ? (
          <>
            <strong>Lote #{selectedPurchase.id_lote}</strong>
            <span>
              {selectedPurchase.item_nombre} · {selectedPurchase.item_subcategoria}
            </span>
            <span>
              {selectedPurchase.proveedor_nombre} · {selectedPurchase.proveedor_tipo}
            </span>
            <span>
              Cantidad: {selectedPurchase.cantidad_recibida} {selectedPurchase.unidad_consumo} · Total {formatCurrency(selectedPurchase.total_lote)}
            </span>
            <small>Puedes registrar otro insumo y este detalle se quedará visible del lado derecho.</small>
          </>
        ) : (
          <small>Selecciona una tarjeta para revisar su recepción o sigue agregando insumos con el mismo folio.</small>
        )}
      </div>
    ) : purchaseForm.id_item ? (
      (() => {
        const catalogItem = (almacenCompras?.catalogo || []).find((c) => String(c.id_item) === String(purchaseForm.id_item));
        return catalogItem ? (
          <div className="detail-card">
            <div className="purchase-history-inline">
              <strong>Detalle seleccionado de compra</strong>
              <span>Ve agregando un insumo a la vez. En cuanto lo guardas aparece aquí arriba.</span>
            </div>
            {renderPurchaseSessionCards()}
            <strong>{catalogItem.nombre_item}</strong>
            <span>{catalogItem.subcategoria || catalogItem.categoria} · {catalogItem.tipo_conservacion || 'Sin conservación'}</span>
            <span>Stock actual: {toNumber(catalogItem.stock_actual)} {catalogItem.unidad_consumo}</span>
            <span>Reorden: {toNumber(catalogItem.punto_reorden_interno || catalogItem.punto_reorden)}</span>
            {(catalogItem.ultimo_precio_compra || catalogItem.precio_competencia_promedio) && (
              <span>Último precio: {formatCurrency(catalogItem.ultimo_precio_compra || catalogItem.precio_competencia_promedio)}</span>
            )}
            <small>Llena cantidad, precio y proveedor. Después usa Guardar y el insumo se queda fijo en la lista para seguir con el siguiente.</small>
            {renderItemPurchaseHistory(catalogItem.id_item)}
          </div>
        ) : (
          <p className="panel-empty">Item seleccionado no encontrado en catálogo.</p>
        );
      })()
    ) : (
      <p className="panel-empty">Selecciona un insumo de la lista o elige uno del catálogo arriba para ver sus detalles.</p>
    );
  }

  function renderActiveList() {
    if (gestionActiva === 'inventario') {
      return (
        <div className="inventory-list compact-list">
          <div className="inventory-filters">
            <div className="filter-chip-row">
              {[
                { value: 'todos', label: 'Todo' },
                { value: 'ingredientes', label: 'Ingredientes' },
                { value: 'complementos', label: 'Complementos' },
                { value: 'equipos', label: 'Equipos' }
              ].map((option) => (
                <button
                  type="button"
                  key={option.value}
                  className={`filter-chip ${inventarioFiltro.grupo === option.value ? 'active' : ''}`}
                  onClick={() => setInventarioFiltro({ grupo: option.value, subcategoria: 'todas' })}
                >
                  {option.label}
                </button>
              ))}
            </div>
            <div className="filter-chip-row">
              <button
                type="button"
                className={`filter-chip ${inventarioFiltro.subcategoria === 'todas' ? 'active' : ''}`}
                onClick={() => setInventarioFiltro((current) => ({ ...current, subcategoria: 'todas' }))}
              >
                Todas
              </button>
              {subcategoriasFiltro.map((option) => (
                <button
                  type="button"
                  key={option}
                  className={`filter-chip ${inventarioFiltro.subcategoria === option ? 'active' : ''}`}
                  onClick={() => setInventarioFiltro((current) => ({ ...current, subcategoria: option }))}
                >
                  {option}
                </button>
              ))}
            </div>
          </div>
          {catalogoFiltrado.map((item) => (
            <button
              type="button"
              className={`inventory-item selectable-item ${seleccion.inventario === item.id_item ? 'selected' : ''}`}
              key={item.id_item}
              onClick={() => handleSelectRegistro('inventario', item)}
            >
              <div>
                <strong>{item.nombre_item}</strong>
                <span>
                  {item.subcategoria} · {item.tipo_conservacion || 'Sin conservación'}
                </span>
              </div>
              <div className="inventory-meta">
                <small>Stock: {item.stock_actual ?? 0}</small>
                <span className={`stock-pill ${getOperationalStockState(item).className}`}>{getOperationalStockState(item).label}</span>
              </div>
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
            <button
              type="button"
              className={`mini-item selectable-item ${seleccion.proveedor === item.id_proveedor ? 'selected' : ''}`}
              key={item.id_proveedor}
              onClick={() => handleSelectRegistro('proveedor', item)}
            >
              <strong>{item.nombre_prov}</strong>
              <span>{item.tipo_proveedor}</span>
              <span>{item.correo_prov || item.telefono_prov || 'Sin contacto'}</span>
            </button>
          ))}
        </div>
      );
    }

    return (
      <div className="mini-list compact-list">
        {checklistPendientes.length ? (
          checklistPendientes.map((item) => (
            <button
              type="button"
              className={`mini-item selectable-item checklist-item ${item.prioridad || 'media'} ${selectedChecklistIds.includes(item.id) ? 'selected' : ''}`}
              key={`checklist-buy-${item.id}`}
              onClick={() => handleChecklistCaptura(item)}
            >
              <strong>{item.descripcion}</strong>
              <span>{item.cantidad ? `${item.cantidad} ${item.unidad}` : item.unidad}</span>
              <span>{item.nota || `${item.prioridad} · ${item.createdBy || 'Sin responsable'}`}</span>
            </button>
          ))
        ) : (
          <p className="panel-empty">No hay nada por comprar ahorita.</p>
        )}

        <div className="purchase-history-inline">
          <strong>Detalle de compra</strong>
          <span>Aquí se irán apilando los insumos que ya registraste en esta captura.</span>
        </div>
        {renderPurchaseSessionCards()}
      </div>
    );
  }

  function renderChecklistPanel() {
    return null;
  }

  return (
    <main className="workspace">
      <section className="mobile-topbar">
        <button type="button" className="mobile-menu-button" onClick={onOpenMenu}>
          ⊞
        </button>
        <div>
          <img src="/logo.png" alt="ITakt" style={{ height: 28, borderRadius: 6 }} />
          <span>{user.rol_nombre}</span>
        </div>
      </section>

      <section className="workspace-header">
        <button type="button" className="menu-button" onClick={onOpenMenu}>
          ⊞
        </button>
        <div>
          <h1>{copy.title}</h1>
          <p>{copy.description}</p>
        </div>
        <div className="workspace-badge">
          {user.rol_nombre}
          {user.business_type ? ` · ${user.business_type}` : ''}
        </div>
      </section>

      <section className="metric-grid">
        {(
          (
            isAlmacenComprasSection
              ? categoriaCards
              : isRecetarioSection
                ? recetarioCards
                : isMovimientosSection
                  ? movimientosCards
                  : isRestaurantConfigSection
                    ? configuracionCards
                    : dashboardCards
          ) || []
        ).map((summary) => (
          <article
            className={`metric-card ${summary.tone ? `metric-card-${summary.tone}` : ''} ${summary.onClick || (isAlmacenComprasSection && summary.title === 'Compras del dia') ? 'clickable-card metric-card-interactive' : ''}`}
            key={summary.title}
            onClick={() => {
              if (summary.onClick) {
                summary.onClick();
                return;
              }

              if (isAlmacenComprasSection && summary.title === 'Compras del dia') {
                abrirCompras();
              }
            }}
          >
            <span>{summary.title}</span>
            <strong>{summary.value}</strong>
            <small>{summary.detail}</small>
          </article>
        ))}
      </section>

      <section className="content-grid">
        <article className="panel-card">
          <h2>{contentTitle}</h2>
          <p>{contentDescription}</p>

          {isAlmacenComprasSection ? (
            almacenError ? (
              <p className="panel-empty">No se pudo leer almacén y compras: {almacenError}</p>
            ) : !almacenCompras ? (
              <p className="panel-empty">Cargando datos de almacén y compras...</p>
            ) : (
              <div className="almacen-layout">
                <div className="module-actions">
                  <button type="button" className="module-action-button primary" onClick={() => resetActiveForm()}>
                    Agregar
                  </button>
                  <button type="button" className="module-action-button" onClick={handleEditar}>
                    Editar
                  </button>
                  <button type="button" className="module-action-button success" onClick={handleGuardar} disabled={isSaving}>
                    {isSaving ? 'Guardando...' : gestionActiva === 'compra' ? 'Guardar insumo' : 'Guardar'}
                  </button>
                  <button type="button" className="module-action-button danger" onClick={handleEliminar}>
                    Eliminar
                  </button>
                </div>

                <div className="manager-tabs">
                  <button
                    type="button"
                    className={`manager-tab ${gestionActiva === 'inventario' ? 'active' : ''}`}
                    onClick={() => setGestionActiva('inventario')}
                  >
                    Inventario
                  </button>
                  <button
                    type="button"
                    className={`manager-tab ${gestionActiva === 'proveedor' ? 'active' : ''}`}
                    onClick={() => setGestionActiva('proveedor')}
                  >
                    Proveedores
                  </button>
                  <button
                    type="button"
                    className={`manager-tab ${gestionActiva === 'compra' ? 'active' : ''}`}
                    onClick={() => setGestionActiva('compra')}
                  >
                    Compras
                  </button>
                </div>

                {(operationMessage || operationError) && (
                  <div className={`operation-banner ${operationError ? 'error' : 'success'}`}>
                    {operationError || operationMessage}
                  </div>
                )}

                <div className="almacen-work-grid">
                  <div className="almacen-subpanel">
                    <div className="almacen-subpanel-header">
                      <h3>
                        {gestionActiva === 'inventario'
                          ? 'Ficha de inventario'
                          : gestionActiva === 'proveedor'
                            ? 'Ficha de proveedor'
                            : 'Registro de compra'}
                      </h3>
                      <span>
                        {gestionActiva === 'inventario'
                          ? 'Clasifica por subtipo y conservación'
                          : gestionActiva === 'proveedor'
                            ? 'Alta o edición del proveedor'
                            : 'Lista de compra, captura rápida y registro por insumo'}
                      </span>
                    </div>
                    {renderEditorPanel()}
                  </div>

                  <div className="almacen-subpanel">
                    <div className="almacen-subpanel-header">
                      <h3>Detalle seleccionado</h3>
                      <span>{gestionActiva}</span>
                    </div>
                    {renderSelectionDetails()}
                  </div>
                </div>

                <div className="almacen-subpanel">
                  <div className="almacen-subpanel-header">
                    <h3>
                      {gestionActiva === 'inventario'
                        ? 'Inventario clasificado'
                        : gestionActiva === 'proveedor'
                          ? 'Lista de proveedores'
                          : 'Lista de compra y detalle del día'}
                    </h3>
                    <span>
                      {gestionActiva === 'inventario'
                        ? `${almacenCompras.resumen.totalItems} registros`
                        : gestionActiva === 'proveedor'
                          ? `${almacenCompras.resumen.proveedores} proveedores`
                          : `${checklistPendientes.length} pendientes · ${purchaseSessionItems.length} en detalle`}
                    </span>
                  </div>
                  {renderActiveList()}
                </div>

                {renderChecklistPanel()}

                <div className="almacen-subpanel">
                  <div className="almacen-subpanel-header">
                    <h3>Compras recientes con estado</h3>
                    <span>Sugerida → Pedida → Recibida → Pagada</span>
                  </div>
                  {renderComprasTable()}
                </div>
              </div>
            )
          ) : isRecetarioSection ? (
            renderRecetarioContent()
          ) : isMovimientosSection ? (
            renderMovimientosContent()
          ) : isRestaurantConfigSection ? (
            renderConfiguracionRestauranteContent()
          ) : (
            renderDashboardRestaurantContent()
          )}
        </article>

        <article className="panel-card">
          <h2>
            {isAlmacenComprasSection
              ? 'Resumen operativo'
              : isRecetarioSection
                ? 'Resumen del escandallo'
                : isMovimientosSection
                  ? 'Resumen del corte de compras'
                  : isRestaurantConfigSection
                    ? 'Resumen de configuración'
                    : 'Resumen de ruta rápida'}
          </h2>
          <p>
            {isAlmacenComprasSection
              ? `Este panel resume compras del día y la lista operativa de ${operationScopeLabel.toLowerCase()} para preparar la salida, revisar lo que falta y confirmar lo que ya llegó.`
              : isRecetarioSection
                ? 'Aquí se concentra el costo real por receta, porción, merma y referencia de precio por insumo.'
                : isMovimientosSection
                  ? 'Vista compacta del registro diario de recetas, consumo estimado y señales de reposición del periodo.'
                  : isRestaurantConfigSection
                    ? 'Concentrado de accesos de restaurante e instrucciones para operar sin mezclar otros giros.'
                    : 'Ruta rápida con recomendaciones y alertas para arrancar la operación del restaurante.'}
          </p>

          {isAlmacenComprasSection && almacenCompras ? (
            <div className="quick-list">
              <div className="quick-item static-card">
                <div>
                  <strong>Checklist pendiente</strong>
                  <span>{checklistUrgentes.length} urgentes dentro de la lista activa</span>
                </div>
                <em>{checklistPendientes.length}</em>
              </div>

              <button type="button" className="quick-item static-card quick-clickable" onClick={() => abrirCompras()}>
                <div>
                  <strong>Total comprado hoy</strong>
                  <span>{almacenCompras.resumen.comprasHoy} movimientos registrados hoy</span>
                </div>
                <em>{formatCurrency(almacenCompras.resumen.totalCompraHoy)}</em>
              </button>

              {operationScope === 'catering' && (
                <>
                  <div className="quick-item">
                    <div>
                      <strong>Equipo propio</strong>
                      <span>{mobiliarioCatering.length} de mobiliario/ambientación y {manteleriaCatering.length} de mantelería/decoración</span>
                    </div>
                    <em>{equiposPropiosCatering.length}</em>
                  </div>

                  <div className="quick-item">
                    <div>
                      <strong>Proveedores externos</strong>
                      <span>{proveedoresOperacion.length} de operación y {proveedoresRenta.length} de renta/apoyo</span>
                    </div>
                    <em>{almacenCompras.resumen.proveedores}</em>
                  </div>
                </>
              )}

              {subcategoriaResumen.map(([subcategoria, total]) => (
                <div className="quick-item" key={subcategoria}>
                  <div>
                    <strong>{subcategoria}</strong>
                    <span>Clasificación para inventario y lotes</span>
                  </div>
                  <em>{total}</em>
                </div>
              ))}

              {proveedoresPorTipo.map(([tipo, total]) => (
                <div className="quick-item" key={tipo}>
                  <div>
                    <strong>{tipo}</strong>
                    <span>Proveedores listos para integrar compra</span>
                  </div>
                  <em>{total}</em>
                </div>
              ))}

              {operationScope === 'catering' && proveedoresRentaResumen.map(([tipo, total]) => (
                <div className="quick-item" key={`renta-${tipo}`}>
                  <div>
                    <strong>{tipo}</strong>
                    <span>Apoyo externo para renta o ambientación de eventos</span>
                  </div>
                  <em>{total}</em>
                </div>
              ))}

              {(almacenCompras.comprasHoy || []).slice(0, 4).map((lote) => (
                <button type="button" className="quick-item quick-clickable" key={lote.id_lote} onClick={() => abrirCompras(lote)}>
                  <div>
                    <strong>{lote.item_nombre}</strong>
                    <span>
                      {lote.proveedor_nombre} · {lote.cantidad_recibida} {lote.unidad_consumo}
                    </span>
                  </div>
                  <em>{formatCurrency(lote.total_lote)}</em>
                </button>
              ))}

              {checklistPendientes.slice(0, 5).map((item) => (
                <div className="quick-item" key={`summary-check-${item.id}`}>
                  <div>
                    <strong>{item.descripcion}</strong>
                    <span>{item.nota || `${item.prioridad} · ${item.origen}`}</span>
                    <span>{item.createdBy || 'Sin responsable'}</span>
                  </div>
                  <em>{item.cantidad ? `${item.cantidad} ${item.unidad}` : item.unidad}</em>
                </div>
              ))}
            </div>
          ) : isRecetarioSection ? (
            renderRecetarioSummary()
          ) : isMovimientosSection ? (
            renderMovimientosSummary()
          ) : isRestaurantConfigSection ? (
            renderConfiguracionRestauranteSummary()
          ) : (
            renderDashboardRestaurantSummary()
          )}
        </article>
      </section>

      {/* MODAL: Registrar Recepción */}
      {modalRecepcionAbierto && (
        <div className="modal-overlay" onClick={() => setModalRecepcionAbierto(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Registrar Recepción</h2>
              <button type="button" onClick={() => setModalRecepcionAbierto(false)}>✕</button>
            </div>
            {operationError && <div className="operation-banner error">{operationError}</div>}
            <div className="form-grid-fields">
              <label className="field-span-2">
                <span>Compra:</span>
                <input type="text" disabled value={`${compraSeleccionadaEstado?.item_nombre} - ${compraSeleccionadaEstado?.cantidad} ${compraSeleccionadaEstado?.unidad_consumo}`} />
              </label>
              <label>
                <span>Fecha recepción</span>
                <input type="date" value={recepcionForm.fecha_recepcion} onChange={(e) => setRecepcionForm({...recepcionForm, fecha_recepcion: e.target.value})} />
              </label>
              <label>
                <span>Quién recibió</span>
                <input type="text" placeholder="Nombre del responsable" value={recepcionForm.quien_recibio} onChange={(e) => setRecepcionForm({...recepcionForm, quien_recibio: e.target.value})} />
              </label>
              <label>
                <span>Cantidad recibida</span>
                <input type="number" step="0.01" value={recepcionForm.cantidad_recibida} onChange={(e) => setRecepcionForm({...recepcionForm, cantidad_recibida: e.target.value})} placeholder={compraSeleccionadaEstado?.cantidad} />
              </label>
              <label className="field-span-2">
                <span>Observaciones (si llegó incompleto, dañado, etc)</span>
                <textarea rows="3" value={recepcionForm.observaciones} onChange={(e) => setRecepcionForm({...recepcionForm, observaciones: e.target.value})} placeholder="Ej: Llegó dañado 2 piezas, faltan 5 kg..." />
              </label>
            </div>
            <div className="modal-actions">
              <button type="button" className="modal-action-button primary" onClick={handleRegistrarRecepcion} disabled={isSavingEstado}>
                {isSavingEstado ? 'Guardando...' : 'Confirmar Recepción'}
              </button>
              <button type="button" className="modal-action-button" onClick={() => setModalRecepcionAbierto(false)}>Cancelar</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Registrar Pago */}
      {modalPagoAbierto && (
        <div className="modal-overlay" onClick={() => setModalPagoAbierto(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Registrar Pago</h2>
              <button type="button" onClick={() => setModalPagoAbierto(false)}>✕</button>
            </div>
            {operationError && <div className="operation-banner error">{operationError}</div>}
            <div className="form-grid-fields">
              <label className="field-span-2">
                <span>Compra:</span>
                <input type="text" disabled value={`${compraSeleccionadaEstado?.item_nombre} - ${formatCurrency(compraSeleccionadaEstado?.monto || 0)}`} />
              </label>
              <label>
                <span>Fecha pago</span>
                <input type="date" value={pagoForm.fecha_pago} onChange={(e) => setPagoForm({...pagoForm, fecha_pago: e.target.value})} />
              </label>
              <label>
                <span>Monto a pagar</span>
                <input type="number" step="0.01" value={pagoForm.monto_pagado} onChange={(e) => setPagoForm({...pagoForm, monto_pagado: e.target.value})} placeholder={compraSeleccionadaEstado?.monto || 0} />
              </label>
            </div>
            <div className="modal-actions">
              <button type="button" className="modal-action-button primary" onClick={handleRegistrarPago} disabled={isSavingEstado}>
                {isSavingEstado ? 'Guardando...' : 'Confirmar Pago'}
              </button>
              <button type="button" className="modal-action-button" onClick={() => setModalPagoAbierto(false)}>Cancelar</button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
