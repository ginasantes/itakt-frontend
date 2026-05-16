import { supabase } from './supabaseClient';

const DEMO_SUPER_ADMIN_EMAIL = 'super@itakt.mx';

function normalizeBusiness(item = {}) {
  return {
    id_negocio: item.id_negocio,
    id_negocio_padre: item.id_negocio_padre || null,
    nombre_negocio: item.nombre_negocio || '',
    nombre_sucursal: item.nombre_sucursal || '',
    tipo_negocio: item.tipo_negocio || '',
    tipo_unidad: item.tipo_unidad || 'unidad',
    tiene_restaurante: Boolean(item.tiene_restaurante),
    tiene_catering: Boolean(item.tiene_catering),
    configuracion_activa: Boolean(item.configuracion_activa)
  };
}

function resolveUserScope(item = {}) {
  const roleName = String(item.roles?.nombre_rol || '').toLowerCase();

  if (roleName === 'super_admin' || roleName === 'admin') {
    return 'Administración';
  }

  const businesses = item.cat_negocios || [];
  if (businesses.some((business) => business.tiene_restaurante)) {
    return 'Restaurante';
  }

  if (businesses.some((business) => business.tiene_catering)) {
    return 'Catering';
  }

  if (roleName.includes('catering')) {
    return 'Catering';
  }

  return 'Restaurante';
}

function groupUsersByScope(usuarios = []) {
  return usuarios.reduce(
    (accumulator, item) => {
      const scopeKey = String(item.scope || '').toLowerCase();
      if (scopeKey === 'administración' || scopeKey === 'administracion') {
        accumulator.administracion.push(item);
      } else if (scopeKey === 'catering') {
        accumulator.catering.push(item);
      } else {
        accumulator.restaurante.push(item);
      }
      return accumulator;
    },
    { administracion: [], restaurante: [], catering: [] }
  );
}

function groupBusinessesByType(negocios = []) {
  return negocios.reduce(
    (accumulator, item) => {
      if (item.tiene_restaurante || item.tipo_negocio === 'restaurante') {
        accumulator.restaurante.push(item);
      }

      if (item.tiene_catering || item.tipo_negocio === 'catering') {
        accumulator.catering.push(item);
      }

      return accumulator;
    },
    { restaurante: [], catering: [] }
  );
}

export async function obtenerPanelAdministracion({ actorEmail } = {}) {
  const normalizedActorEmail = String(actorEmail || '').trim().toLowerCase();
  if (!normalizedActorEmail) {
    return { data: null, error: 'No hay correo de sesión para cargar administración.' };
  }

  const [{ data: usuarios, error: usuariosError }, { data: negocios, error: negociosError }] = await Promise.all([
    supabase.rpc('admin_listar_usuarios_demo', { p_actor_correo: normalizedActorEmail }),
    supabase.rpc('admin_listar_negocios_demo', { p_actor_correo: normalizedActorEmail })
  ]);

  if (usuariosError) {
    return { data: null, error: usuariosError.message };
  }

  if (negociosError) {
    return { data: null, error: negociosError.message };
  }

  const negociosNormalizados = (negocios || []).map(normalizeBusiness);
  const negociosPorId = new Map(negociosNormalizados.map((item) => [item.id_negocio, item]));
  const usuariosNormalizados = (usuarios || []).map((item) => ({
    ...item,
    roles: { nombre_rol: item.rol_nombre || 'Sin rol' },
    cat_negocios: item.id_negocio && negociosPorId.has(item.id_negocio)
      ? [negociosPorId.get(item.id_negocio)]
      : Array.isArray(item.cat_negocios)
        ? item.cat_negocios.map(normalizeBusiness)
      : [],
    scope: resolveUserScope(item)
  }));

  const usuariosPorScope = groupUsersByScope(usuariosNormalizados);
  const negociosPorTipo = groupBusinessesByType(negociosNormalizados);
  const administradores = usuariosNormalizados.filter((item) => item.scope === 'Administración').length;
  const usuariosRestaurante = usuariosPorScope.restaurante.length;
  const usuariosCatering = usuariosPorScope.catering.length;

  const resumen = {
    totalUsuarios: usuariosNormalizados.length,
    administradores,
    usuariosRestaurante,
    usuariosCatering,
    negociosActivos: negociosNormalizados.filter((item) => item.configuracion_activa).length,
    negociosConRestaurante: negociosPorTipo.restaurante.length,
    negociosConCatering: negociosPorTipo.catering.length
  };

  return {
    data: {
      resumen,
      usuarios: usuariosNormalizados,
      negocios: negociosNormalizados,
      usuariosPorScope,
      negociosPorTipo
    },
    error: null
  };
}

export async function obtenerUsuariosVisiblesPorNegocio({ actorEmail, businessId, scope } = {}) {
  const safeBusinessId = Number(businessId || 0);
  const normalizedScope = String(scope || '').toLowerCase();
  const candidateEmails = Array.from(new Set([
    String(actorEmail || '').trim().toLowerCase(),
    DEMO_SUPER_ADMIN_EMAIL
  ].filter(Boolean)));

  let lastError = 'No se pudieron cargar usuarios del negocio.';
  let lastFilteredUsers = [];

  for (const candidateEmail of candidateEmails) {
    const result = await obtenerPanelAdministracion({ actorEmail: candidateEmail });
    if (result.error) {
      lastError = result.error;
      continue;
    }

    const usuarios = result.data?.usuarios || [];
    const filteredUsers = usuarios.filter((item) => {
      const businesses = item.cat_negocios || [];

      if (safeBusinessId) {
        return businesses.some((business) => business.id_negocio === safeBusinessId);
      }

      if (normalizedScope === 'catering') {
        return businesses.some((business) => business.tiene_catering || business.tipo_negocio === 'catering');
      }

      if (normalizedScope === 'restaurante') {
        return businesses.some((business) => business.tiene_restaurante || business.tipo_negocio === 'restaurante');
      }

      return true;
    });

    lastFilteredUsers = filteredUsers;

    if (filteredUsers.length > 0 || candidateEmail === DEMO_SUPER_ADMIN_EMAIL) {
      return { data: filteredUsers, error: null };
    }
  }

  return { data: lastFilteredUsers, error: lastError };
}

export async function crearNegocioAdmin({
  actorEmail,
  scope,
  tipoAlta,
  nombre_negocio,
  nombre_sucursal,
  id_negocio_padre,
  telefono,
  correo_electronico
} = {}) {
  const normalizedActorEmail = String(actorEmail || '').trim().toLowerCase();
  if (!normalizedActorEmail) {
    return { data: null, error: 'No hay correo de sesión para crear negocios.' };
  }

  const { data, error } = await supabase.rpc('admin_crear_negocio_demo', {
    p_actor_correo: normalizedActorEmail,
    p_scope: scope,
    p_tipo_alta: tipoAlta,
    p_nombre_negocio: nombre_negocio || null,
    p_nombre_sucursal: nombre_sucursal || null,
    p_id_negocio_padre: id_negocio_padre ? Number(id_negocio_padre) : null,
    p_telefono: telefono || null,
    p_correo_electronico: correo_electronico || null
  });

  if (error) {
    return { data: null, error: error.message };
  }

  return { data, error: null };
}
