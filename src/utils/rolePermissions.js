function normalizeScope(scope = '') {
  const normalized = String(scope || '').toLowerCase();
  if (normalized.includes('catering')) {
    return 'catering';
  }

  if (normalized.includes('admin')) {
    return 'admin';
  }

  return 'restaurante';
}

export function getRolePresentation({ roleName = '', scope = '' } = {}) {
  const normalizedRole = String(roleName || '').toLowerCase();
  const normalizedScope = normalizeScope(scope);
  const scopeLabel = normalizedScope === 'catering' ? 'catering' : normalizedScope === 'admin' ? 'general' : 'restaurante';

  if (normalizedRole === 'super_admin') {
    return {
      label: 'Super admin',
      description: 'Control total de la plataforma, negocios, módulos, sucursales y usuarios.',
      permissions: 'Habilita módulos, crea matrices y sucursales, administra todos los usuarios.'
    };
  }

  if (normalizedRole === 'admin') {
    return normalizedScope === 'admin'
      ? {
          label: 'Administrador general',
          description: 'Administra toda la plataforma desde la vista central.',
          permissions: 'Gestiona negocios, módulos, usuarios, permisos y estructura global.'
        }
      : {
          label: `Administrador ${scopeLabel}`,
          description: `Responsable de la configuración del modelo ${scopeLabel} dentro de su negocio.`,
          permissions: 'Da de alta y elimina usuarios del modelo, actualiza configuración y supervisa la operación.'
        };
  }

  if (normalizedRole.includes('due')) {
    return {
      label: `Dueño ${scopeLabel}`,
      description: `Responsable principal del negocio en el modelo ${scopeLabel}.`,
      permissions: 'Puede ver la operación completa del negocio y gestionar su estructura asignada.'
    };
  }

  if (normalizedRole.includes('gerente')) {
    return {
      label: `Gerente ${scopeLabel}`,
      description: `Coordina la operación diaria del área de ${scopeLabel}.`,
      permissions: 'Gestiona operación, consulta usuarios del modelo y da seguimiento al trabajo del equipo.'
    };
  }

  if (normalizedRole.includes('trab')) {
    return {
      label: `Trabajador ${scopeLabel}`,
      description: `Usuario operativo del módulo ${scopeLabel}.`,
      permissions: 'Ejecuta tareas operativas, movimientos y registros del proceso asignado.'
    };
  }

  return {
    label: roleName || 'Sin rol',
    description: 'Rol sin descripción definida.',
    permissions: 'Permisos no definidos.'
  };
}