import { supabase } from './supabaseClient';

export const USER_ROLE_OPTIONS = [
  { value: 'admin', label: 'Administrador' },
  { value: 'trabajador_restaurante', label: 'Trabajador Restaurante' },
  { value: 'trabajador_catering', label: 'Trabajador Catering' },
  { value: 'gerente_restaurante', label: 'Gerente Restaurante' },
  { value: 'gerente_catering', label: 'Gerente Catering' }
];

// ----------------------------------------------------------------
// Internos
// ----------------------------------------------------------------
async function getRoleIdByName(nombreRol) {
  const { data } = await supabase
    .from('roles')
    .select('id_rol')
    .eq('nombre_rol', nombreRol)
    .single();
  return data?.id_rol || null;
}

function getRoleNameFromAdminForm({ scope, tipoUsuario }) {
  if (scope === 'admin') {
    return 'admin';
  }

  if (tipoUsuario === 'gerente') {
    return scope === 'catering' ? 'gerente_catering' : 'gerente_restaurante';
  }

  if (tipoUsuario === 'trabajador') {
    return scope === 'catering' ? 'trabajador_catering' : 'trabajador_restaurante';
  }

  return 'admin';
}

function getBusinessModuleFlags(scope) {
  return {
    tipo_negocio: scope === 'catering' ? 'catering' : 'restaurante',
    tiene_restaurante: scope === 'restaurante',
    tiene_catering: scope === 'catering'
  };
}

function normalizeBusinessLabel(item = {}) {
  const branchName = String(item.nombre_sucursal || '').trim();
  return branchName ? `${item.nombre_negocio} - ${branchName}` : item.nombre_negocio;
}

async function crearNegocioBaseParaUsuario({ userId, scope, nombre_negocio, correo, telefono }) {
  const businessName = String(nombre_negocio || '').trim();
  if (!businessName) {
    return { data: null, error: 'El nombre del negocio es obligatorio para crear un encargado.' };
  }

  const moduleFlags = getBusinessModuleFlags(scope);
  const { data, error } = await supabase
    .from('negocios')
    .insert({
      id_usuario: Number(userId),
      nombre_negocio: businessName,
      telefono: String(telefono || '').trim() || null,
      correo_electronico: String(correo || '').trim().toLowerCase() || null,
      tipo_negocio: moduleFlags.tipo_negocio,
      tipo_unidad: 'matriz',
      tiene_restaurante: moduleFlags.tiene_restaurante,
      tiene_catering: moduleFlags.tiene_catering,
      configuracion_activa: true
    })
    .select('id_negocio, nombre_negocio, tipo_negocio')
    .single();

  if (error || !data) {
    return { data: null, error: error?.message || 'No se pudo crear el negocio base.' };
  }

  return { data, error: null };
}

async function actualizarAccesoGrupoUsuario({ userId, canSeeGroup }) {
  const update = {
    puede_ver_todo_grupo: Boolean(canSeeGroup),
    puede_gestionar_sucursales: Boolean(canSeeGroup),
    es_responsable_matriz: Boolean(canSeeGroup)
  };

  const { error } = await supabase
    .from('usuarios')
    .update(update)
    .eq('id_usuario', Number(userId));

  if (error) {
    return { error: error.message };
  }

  return { error: null };
}

// Construye payload para INSERT/UPDATE en usuarios
async function buildUserPayload({ nombre_completo, correo, contrasena, telefono, id_rol, id_negocio }) {
  const payload = {
    nombre_completo: String(nombre_completo || '').trim(),
    correo: String(correo || '').trim().toLowerCase(),
    telefono: String(telefono || '').trim() || null,
    id_negocio: id_negocio ? Number(id_negocio) : null
  };

  const pass = String(contrasena || '').trim();
  if (pass) {
    payload.contrasena = pass;
  }

  if (!payload.nombre_completo || !payload.correo) {
    return { payload: null, error: 'Nombre y correo son obligatorios.' };
  }

  if (typeof id_rol === 'number') {
    payload.id_rol = id_rol;
  } else if (id_rol) {
    const resolvedId = await getRoleIdByName(String(id_rol));
    if (!resolvedId) {
      return { payload: null, error: `Rol '${id_rol}' no encontrado en la base de datos.` };
    }
    payload.id_rol = resolvedId;
  }

  return { payload, error: null };
}

// ----------------------------------------------------------------
// Catálogos
// ----------------------------------------------------------------
export async function obtenerRoles() {
  const { data, error } = await supabase
    .from('roles')
    .select('id_rol, nombre_rol')
    .order('id_rol');
  if (error) return { data: [], error: error.message };
  return { data: data || [], error: null };
}

export async function obtenerNegocios() {
  const { data, error } = await supabase
    .from('negocios')
    .select('id_negocio, id_negocio_padre, nombre_negocio, nombre_sucursal, tipo_negocio, tipo_unidad, tiene_restaurante, tiene_catering, configuracion_activa')
    .eq('configuracion_activa', true)
    .order('id_negocio');
  if (error) return { data: [], error: error.message };
  return {
    data: (data || []).map((item) => ({
      ...item,
      nombre_visible: normalizeBusinessLabel(item)
    })),
    error: null
  };
}

// ----------------------------------------------------------------
// Lectura de usuarios
// ----------------------------------------------------------------
export async function obtenerUsuarios() {
  const [{ data: usuarios, error: usuariosError }, { data: negocios, error: negociosError }] = await Promise.all([
    supabase
      .from('usuarios')
      .select(`
        id_usuario,
        nombre_completo,
        correo,
        telefono,
        id_rol,
        id_negocio,
        fecha_registro,
        puede_ver_todo_grupo,
        puede_gestionar_sucursales,
        es_responsable_matriz,
        roles(nombre_rol)
      `)
      .order('id_usuario', { ascending: true }),
    supabase
      .from('negocios')
      .select('id_negocio, id_negocio_padre, nombre_negocio, nombre_sucursal, tipo_negocio, tipo_unidad, tiene_restaurante, tiene_catering, configuracion_activa')
      .order('id_negocio', { ascending: true })
  ]);

  if (usuariosError) {
    console.error('Error obteniendo usuarios:', usuariosError);
    return { data: [], error: usuariosError.message };
  }

  if (negociosError) {
    console.error('Error obteniendo negocios para usuarios:', negociosError);
    return { data: [], error: negociosError.message };
  }

  const negociosPorId = new Map(
    (negocios || []).map((business) => [
      business.id_negocio,
      {
        ...business,
        nombre_visible: normalizeBusinessLabel(business)
      }
    ])
  );

  return {
    data: (usuarios || []).map((item) => ({
      ...item,
      cat_negocios: item.id_negocio && negociosPorId.has(item.id_negocio)
        ? [negociosPorId.get(item.id_negocio)]
        : []
    })),
    error: null
  };
}

export async function obtenerUsuariosAdmin() {
  return obtenerUsuarios();
}

export async function obtenerUsuariosNegocioActual({ businessId } = {}) {
  const safeBusinessId = Number(businessId || 0);
  if (!safeBusinessId) {
    return { data: [], error: 'No hay negocio asignado para cargar usuarios.' };
  }

  const { data, error } = await supabase
    .from('usuarios')
    .select(`
      id_usuario,
      nombre_completo,
      correo,
      telefono,
      id_rol,
      id_negocio,
      fecha_registro,
      puede_ver_todo_grupo,
      puede_gestionar_sucursales,
      es_responsable_matriz,
      roles(nombre_rol)
    `)
    .eq('id_negocio', safeBusinessId)
    .order('id_usuario', { ascending: true });

  if (error) {
    return { data: [], error: error.message };
  }

  return {
    data: (data || []).map((item) => ({
      ...item,
      cat_negocios: item.id_negocio
        ? [{ id_negocio: item.id_negocio }]
        : []
    })),
    error: null
  };
}

export async function obtenerUsuariosRestaurante() {
  const { data, error } = await obtenerUsuarios();
  if (error) return { data: [], error };
  return {
    data: (data || []).filter((u) => (u.cat_negocios || []).some((business) => business.tiene_restaurante || business.tipo_negocio === 'restaurante')),
    error: null
  };
}

export async function obtenerUsuariosCatering() {
  const { data, error } = await obtenerUsuarios();
  if (error) return { data: [], error };
  return {
    data: (data || []).filter((u) => (u.cat_negocios || []).some((business) => business.tiene_catering || business.tipo_negocio === 'catering')),
    error: null
  };
}

export async function obtenerUsuariosPorAmbito(scope) {
  const { data, error } = await obtenerUsuarios();
  if (error) return { data: [], error };
  const normalizedScope = String(scope || '').toLowerCase();
  return {
    data: (data || []).filter((u) => {
      const rol = (u.roles?.nombre_rol || '').toLowerCase();
      return rol.includes(normalizedScope);
    }),
    error: null
  };
}

// ----------------------------------------------------------------
// Configuración de negocio
// ----------------------------------------------------------------
export async function obtenerConfiguracionNegocio({ businessId } = {}) {
  const safeBusinessId = Number(businessId);
  if (!safeBusinessId) {
    return { data: null, error: 'No hay negocio asignado para esta configuración.' };
  }

  const { data, error } = await supabase
    .from('negocios')
    .select('id_negocio, nombre_negocio, telefono, correo_electronico, direccion, tipo_negocio, tiene_restaurante, tiene_catering, configuracion_activa')
    .eq('id_negocio', safeBusinessId)
    .limit(1);

  if (error) {
    return { data: null, error: error.message };
  }

  const business = Array.isArray(data) ? data[0] || null : data || null;

  if (!business) {
    return { data: null, error: null };
  }

  return { data: business, error: null };
}

export async function actualizarConfiguracionNegocio({ businessId, nombre_negocio } = {}) {
  const safeBusinessId = Number(businessId);
  const businessName = String(nombre_negocio || '').trim();

  if (!safeBusinessId) {
    return { data: null, error: 'No hay negocio asignado para actualizar.' };
  }

  if (!businessName) {
    return { data: null, error: 'El nombre del negocio es obligatorio.' };
  }

  const { data, error } = await supabase
    .from('negocios')
    .update({ nombre_negocio: businessName })
    .eq('id_negocio', safeBusinessId)
    .select()
    .single();

  if (error) {
    return { data: null, error: error.message };
  }

  return { data, error: null };
}

// ----------------------------------------------------------------
// Creación de usuarios
// ----------------------------------------------------------------
export async function crearUsuario({ nombre_completo, correo, contrasena, telefono, id_rol, id_negocio }) {
  const pass = String(contrasena || '').trim();
  if (!pass) {
    return { data: null, error: 'La contraseña es obligatoria para crear un usuario.' };
  }

  const { payload, error: buildError } = await buildUserPayload({ nombre_completo, correo, contrasena: pass, telefono, id_rol, id_negocio });
  if (buildError) return { data: null, error: buildError };

  const { data, error } = await supabase.from('usuarios').insert(payload).select().single();
  if (error || !data) {
    return { data: null, error: error?.message || 'No se pudo guardar el usuario.' };
  }

  return { data: { usuario: data, negocio: null }, error: null };
}

// Alias para compatibilidad con llamadas existentes en la UI
export async function crearTrabajadorRestaurante({ nombre_completo, correo, contrasena, telefono, id_negocio, tipoUsuario }) {
  const id_rol = tipoUsuario === 'gerente' ? 'gerente_restaurante' : 'trabajador_restaurante';
  return crearUsuario({ nombre_completo, correo, contrasena, telefono, id_rol, id_negocio });
}

export async function crearUsuarioCatering({ nombre_completo, correo, contrasena, telefono, id_negocio, tipoUsuario }) {
  const id_rol = tipoUsuario === 'gerente' ? 'gerente_catering' : 'trabajador_catering';
  return crearUsuario({ nombre_completo, correo, contrasena, telefono, id_rol, id_negocio });
}

export async function crearUsuarioAdministrador({ nombre_completo, correo, contrasena, telefono, id_negocio }) {
  return crearUsuario({ nombre_completo, correo, contrasena, telefono, id_rol: 'admin', id_negocio });
}

export async function crearUsuarioSistema({ actorEmail, scope, tipoUsuario, modoNegocio, nombre_completo, correo, contrasena, telefono, nombre_negocio, id_negocio }) {
  const normalizedActorEmail = String(actorEmail || '').trim().toLowerCase();
  if (!normalizedActorEmail) {
    return { data: null, error: 'No hay sesión administrativa activa.' };
  }

  const { data, error } = await supabase.rpc('admin_crear_usuario_demo', {
    p_actor_correo: normalizedActorEmail,
    p_scope: scope,
    p_tipo_usuario: tipoUsuario,
    p_modo_negocio: modoNegocio || 'existente',
    p_nombre_completo: nombre_completo,
    p_correo: correo,
    p_contrasena: contrasena,
    p_telefono: telefono || null,
    p_nombre_negocio: nombre_negocio || null,
    p_id_negocio: id_negocio ? Number(id_negocio) : null
  });

  if (error) {
    return { data: null, error: error.message };
  }

  return { data, error: null };
}

export async function crearUsuarioNegocio({ nombre_completo, correo, contrasena, telefono, id_rol, id_negocio }) {
  return crearUsuario({ nombre_completo, correo, contrasena, telefono, id_rol, id_negocio });
}

// ----------------------------------------------------------------
// Actualización
// ----------------------------------------------------------------
export async function actualizarUsuarioAdmin({ actorEmail, userId, originalUser, scope, tipoUsuario, modoNegocio, nombre_completo, correo, contrasena, telefono, nombre_negocio, id_rol, id_negocio }) {
  const normalizedActorEmail = String(actorEmail || '').trim().toLowerCase();
  const safeUserId = Number(userId);
  if (!normalizedActorEmail) {
    return { data: null, error: 'No hay sesión administrativa activa.' };
  }

  if (!safeUserId) {
    return { data: null, error: 'Selecciona un usuario válido para actualizar.' };
  }

  const selectedBusiness = originalUser?.cat_negocios?.[0] || null;
  const { data, error } = await supabase.rpc('admin_actualizar_usuario_demo', {
    p_actor_correo: normalizedActorEmail,
    p_user_id: safeUserId,
    p_scope: scope,
    p_tipo_usuario: tipoUsuario,
    p_modo_negocio: modoNegocio || 'existente',
    p_nombre_completo: nombre_completo,
    p_correo: correo,
    p_contrasena: contrasena || null,
    p_telefono: telefono || null,
    p_nombre_negocio: nombre_negocio || null,
    p_id_negocio: selectedBusiness?.id_negocio || (id_negocio ? Number(id_negocio) : null)
  });

  if (error) {
    return { data: null, error: error.message };
  }

  return { data, error: null };
}

// ----------------------------------------------------------------
// Eliminación
// ----------------------------------------------------------------
export async function eliminarUsuarioAdmin({ actorEmail, userId, currentUserId }) {
  const normalizedActorEmail = String(actorEmail || '').trim().toLowerCase();
  const safeUserId = Number(userId);
  if (!normalizedActorEmail) {
    return { error: 'No hay sesión administrativa activa.' };
  }

  if (!safeUserId) {
    return { error: 'Selecciona un usuario válido para eliminar.' };
  }

  if (safeUserId === Number(currentUserId)) {
    return { error: 'No puedes eliminar el administrador con la sesión activa.' };
  }

  const { error } = await supabase.rpc('admin_eliminar_usuario_demo', {
    p_actor_correo: normalizedActorEmail,
    p_user_id: safeUserId,
    p_current_user_id: Number(currentUserId)
  });
  if (error) {
    return { error: error.message };
  }

  return { error: null };
}

export async function eliminarUsuarioNegocio({ userId, currentUserId }) {
  const safeUserId = Number(userId);

  if (!safeUserId) {
    return { error: 'Selecciona un usuario válido para eliminar.' };
  }

  if (safeUserId === Number(currentUserId)) {
    return { error: 'No puedes eliminar el usuario con la sesión activa.' };
  }

  const { error } = await supabase
    .from('usuarios')
    .delete()
    .eq('id_usuario', safeUserId);

  if (error) {
    return { error: error.message };
  }

  return { error: null };
}

// ----------------------------------------------------------------
// Módulos del negocio — super_admin activa/desactiva flags
// ----------------------------------------------------------------
export async function habilitarNegocioParaUsuario({ actorEmail, businessId, tiene_restaurante, tiene_catering } = {}) {
  const normalizedActorEmail = String(actorEmail || '').trim().toLowerCase();
  const safeBusinessId = Number(businessId);
  if (!normalizedActorEmail) {
    return { data: null, error: 'No hay sesión administrativa activa.' };
  }

  if (!safeBusinessId) {
    return { data: null, error: 'Selecciona un negocio válido.' };
  }

  const update = {};
  if (tiene_restaurante !== undefined) update.tiene_restaurante = Boolean(tiene_restaurante);
  if (tiene_catering !== undefined) update.tiene_catering = Boolean(tiene_catering);

  if (Object.keys(update).length === 0) {
    return { data: null, error: 'Indica qué módulo activar o desactivar.' };
  }

  const { data, error } = await supabase.rpc('admin_habilitar_negocio_demo', {
    p_actor_correo: normalizedActorEmail,
    p_business_id: safeBusinessId,
    p_tiene_restaurante: update.tiene_restaurante ?? null,
    p_tiene_catering: update.tiene_catering ?? null
  });

  if (error) {
    return { data: null, error: error.message };
  }

  return { data, error: null };
}

