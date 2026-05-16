import { inferBusinessScopeFromProfile } from '../utils/businessScope';

const platformAdminItems = [
  { key: 'dashboard_admin', label: 'Panel general', icon: '◎' },
  { key: 'configuracion_admin', label: 'Configuración', icon: '⚙' }
];

const businessAdminItems = [
  { key: 'configuracion_admin', label: 'Configuración', icon: '⚙' }
];

function getBusinessAdminItems(user) {
  const businessType = inferBusinessType(user);
  return [
    {
      key: businessType === 'catering' ? 'configuracion_catering' : 'configuracion_restaurante',
      label: 'Configuración',
      icon: '⚙'
    }
  ];
}

const sharedAdminItems = [
  { key: 'almacen_compras_restaurante', label: 'Inventario y Compras', icon: '🛒' },
  { key: 'recetario_restaurante', label: 'Recetario', icon: '☰' }
];

const sharedWorkerItems = [
  { key: 'almacen_compras_restaurante', label: 'Inventario y Compras', icon: '🛒' },
  { key: 'recetario_restaurante', label: 'Recetario', icon: '☰' }
];

const restauranteAdminItems = [
  { key: 'dashboard_restaurante', label: 'Inicio', icon: '⌘' },
  { key: 'movimientos_restaurante', label: 'Checklist y Movimientos', icon: '↔' },
  { key: 'nuevo_trabajador_restaurante', label: 'Usuarios restaurante', icon: '＋' },
];

const restauranteWorkerItems = [
  { key: 'dashboard_restaurante', label: 'Inicio', icon: '⌘' },
  { key: 'movimientos_restaurante', label: 'Checklist y Operación', icon: '↔' }
];

const cateringAdminItems = [
  { key: 'dashboard_catering', label: 'Inicio catering', icon: '◆' },
  { key: 'eventos_catering', label: 'Eventos', icon: '◉' },
  { key: 'cotizaciones_catering', label: 'Cotizaciones', icon: '¤' },
  { key: 'operacion_catering', label: 'Checklist y Operación', icon: '↺' },
  { key: 'admin_precios_catering', label: 'Admin de Precios', icon: '💰' },
  { key: 'nuevo_usuario_catering', label: 'Usuarios catering', icon: '＋' }
];

const cateringWorkerItems = [
  { key: 'dashboard_catering', label: 'Inicio catering', icon: '◆' },
  { key: 'eventos_catering', label: 'Eventos', icon: '◉' },
  { key: 'operacion_catering', label: 'Checklist y Operación', icon: '↺' }
];

function inferBusinessType(user) {
  return inferBusinessScopeFromProfile({
    businessType: user?.business_type,
    roleName: user?.rol_nombre,
    email: user?.correo,
    fullName: user?.nombre_completo
  });
}

function roleFlags(user) {
  const normalizedRole = user?.rol_nombre?.toLowerCase() || '';
  const hasRestaurant = user?.tiene_restaurante ?? false;
  const hasCatering = user?.tiene_catering ?? false;
  const inferredBusinessType = inferBusinessType(user);

  return {
    isSuperAdmin: normalizedRole === 'super_admin',
    isAdmin: normalizedRole.includes('admin'),
    isOwner: normalizedRole.includes('due'),
    isWorker: normalizedRole.includes('trab') || normalizedRole.includes('gerente'),
    businessType: inferredBusinessType,
    hasRestaurant: hasRestaurant || inferredBusinessType === 'restaurante',
    hasCatering: hasCatering || inferredBusinessType === 'catering'
  };
}

function withSharedItems(items, sharedItems) {
  return [...sharedItems, ...items];
}

export function getMenuForUser(user) {
  const { isSuperAdmin, isAdmin, isOwner, isWorker, hasRestaurant, hasCatering } = roleFlags(user);
  const sections = [];

  if (isSuperAdmin) {
    sections.push({
      key: 'administracion',
      title: 'Administración',
      defaultOpen: true,
      items: platformAdminItems
    });
    return sections;
  }

  if (hasRestaurant) {
    sections.push({
      key: 'restaurante',
      title: 'Restaurante',
      defaultOpen: true,
      items: withSharedItems(isWorker ? restauranteWorkerItems : restauranteAdminItems, isWorker ? sharedWorkerItems : sharedAdminItems)
    });
  }

  if (hasCatering) {
    sections.push({
      key: 'catering',
      title: 'Catering',
      defaultOpen: !hasRestaurant,
      items: hasRestaurant
        ? (isWorker ? cateringWorkerItems : cateringAdminItems)
        : withSharedItems(isWorker ? cateringWorkerItems : cateringAdminItems, isWorker ? sharedWorkerItems : sharedAdminItems)
    });
  }

  if (!sections.length) {
    sections.push({
      key: 'restaurante',
      title: 'Restaurante',
      defaultOpen: true,
      items: withSharedItems(isWorker ? restauranteWorkerItems : restauranteAdminItems, isWorker ? sharedWorkerItems : sharedAdminItems)
    });
  }

  if (isAdmin || isOwner) {
    sections.push({
      key: 'gestion_negocio',
      title: 'Administración',
      defaultOpen: false,
      items: getBusinessAdminItems(user)
    });
  }

  return sections;
}

export function getInitialSectionKey(user) {
  const { isSuperAdmin, hasRestaurant, hasCatering } = roleFlags(user);

  if (!isSuperAdmin) {
    if (hasRestaurant) {
      return 'dashboard_restaurante';
    }

    if (hasCatering) {
      return 'dashboard_catering';
    }
  }

  const menu = getMenuForUser(user);
  for (const section of menu) {
    if (section.items?.[0]?.key) {
      return section.items[0].key;
    }
  }

  return 'dashboard_restaurante';
}

export function getSectionMeta(sectionKey) {
  const meta = {
    dashboard_admin: {
      title: 'Panel general',
      description: 'Vista de plataforma para negocios activos, módulos habilitados y control general.'
    },
    negocios_admin: {
      title: 'Negocios',
      description: 'Alta, revisión y habilitación de negocios con restaurante, catering o ambos módulos.'
    },
    usuarios_admin: {
      title: 'Usuarios y permisos',
      description: 'Gestión de administradores y trabajadores con permisos según el módulo operativo.'
    },
    configuracion_admin: {
      title: 'Configuración administrativa',
      description: 'Centro de configuración para usuarios, permisos, negocios y módulos según el rol activo.'
    },
    dashboard_restaurante: {
      title: 'Inicio restaurante',
      description: 'Resumen operativo del restaurante con alertas, recetas activas y pendientes del día.'
    },
    almacen_compras_restaurante: {
      title: 'Inventario y Compras',
      description: 'Inventario base, compras, proveedores y captura de entradas compartidas para la operación del negocio.'
    },
    recetario_restaurante: {
      title: 'Recetario',
      description: 'Recetas maestras, fichas técnicas y escandallos compartidos para la producción del negocio.'
    },
    movimientos_restaurante: {
      title: 'Checklist y Movimientos restaurante',
      description: 'Checklist de compra, movimientos de inventario, consumo por receta y reposición operativa.'
    },
    nuevo_trabajador_restaurante: {
      title: 'Usuarios restaurante',
      description: 'Alta y gestión de usuarios del restaurante con permisos de administrador o trabajador.'
    },
    configuracion_restaurante: {
      title: 'Configuración restaurante',
      description: 'Datos visibles y ajustes operativos del restaurante sin mezclar la parte de catering.'
    },
    dashboard_catering: {
      title: 'Inicio catering',
      description: 'Resumen de cotizaciones, eventos, tickets y pendientes operativos del módulo catering.'
    },
    almacen_compras_catering: {
      title: 'Inventario y Compras catering',
      description: 'Inventario base, compras y entradas asociadas a la operación de catering.'
    },
    recetario_catering: {
      title: 'Recetario catering',
      description: 'Recetas, fichas técnicas y escandallos base para eventos y producción de catering.'
    },
    eventos_catering: {
      title: 'Eventos catering',
      description: 'Agenda y seguimiento de eventos confirmados, operando o pendientes de cierre.'
    },
    cotizaciones_catering: {
      title: 'Cotizaciones catering',
      description: 'Cotizaciones por cliente, propuesta, número de personas y precio pactado.'
    },
    operacion_catering: {
      title: 'Checklist y Operación catering',
      description: 'Checklist, tickets, consumos por evento y control operativo del catering.'
    },
    movimientos_catering: {
      title: 'Movimientos de insumos catering',
      description: 'Registro de salidas por insumo: uso en evento, merma, prestado, utilería y renta de servicio.'
    },
    nuevo_usuario_catering: {
      title: 'Usuarios catering',
      description: 'Alta y gestión de usuarios enfocados en eventos, tickets y operación de catering.'
    },
    configuracion_catering: {
      title: 'Configuración catering',
      description: 'Datos visibles y ajustes del negocio catering dentro de su propio módulo.'
    },
    admin_precios_catering: {
      title: 'Gestión de Precios - Catering',
      description: 'Administra precios de recetas, proveedores y equipos basados en el escandallo de ingredientes.'
    }
  };

  return meta[sectionKey] || meta.dashboard_restaurante;
}
