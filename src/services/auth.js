// src/services/auth.js
// Lógica de autenticación y obtención de roles desde Supabase
import { setDemoSessionEmail, clearDemoSessionEmail, supabase } from './supabaseClient';

function normalizeBusinessOption(item = {}) {
  const businessId = Number(item.id_negocio || item.business_id || 0) || null;
  const businessName = String(item.nombre_negocio || item.business_name || '').trim();
  const branchName = String(item.nombre_sucursal || '').trim();

  return {
    id_negocio: businessId,
    id_negocio_padre: item.id_negocio_padre ? Number(item.id_negocio_padre) : null,
    nombre_negocio: businessName,
    nombre_sucursal: branchName,
    nombre_visible: branchName ? `${businessName} - ${branchName}` : businessName,
    tipo_negocio: item.tipo_negocio || item.business_type || '',
    tipo_unidad: item.tipo_unidad || 'unidad',
    codigo_unidad: item.codigo_unidad || '',
    ciudad: item.ciudad || '',
    zona: item.zona || '',
    tiene_restaurante: Boolean(item.tiene_restaurante),
    tiene_catering: Boolean(item.tiene_catering)
  };
}

function buildFallbackBusinessOptions(usuario, negocio) {
  const businessId = Number(usuario.business_id || usuario.id_negocio || negocio?.id_negocio || 0) || null;
  if (!businessId) {
    return [];
  }

  return [
    normalizeBusinessOption({
      id_negocio: businessId,
      id_negocio_padre: negocio?.id_negocio_padre,
      nombre_negocio: usuario.business_name || usuario.nombre_negocio || negocio?.nombre_negocio || '',
      nombre_sucursal: usuario.nombre_sucursal || negocio?.nombre_sucursal || '',
      tipo_negocio: usuario.business_type || usuario.tipo_negocio || negocio?.tipo_negocio || '',
      tipo_unidad: usuario.tipo_unidad || negocio?.tipo_unidad || 'unidad',
      codigo_unidad: usuario.codigo_unidad || negocio?.codigo_unidad || '',
      ciudad: usuario.ciudad || negocio?.ciudad || '',
      zona: usuario.zona || negocio?.zona || '',
      tiene_restaurante: usuario.tiene_restaurante ?? negocio?.tiene_restaurante ?? false,
      tiene_catering: usuario.tiene_catering ?? negocio?.tiene_catering ?? false
    })
  ];
}

async function fetchAccessibleBusinesses(usuario, negocio) {
  const fallback = buildFallbackBusinessOptions(usuario, negocio);
  const currentBusinessId = fallback[0]?.id_negocio || null;

  if (!currentBusinessId) {
    return [];
  }

  const fields = [
    'id_negocio',
    'id_negocio_padre',
    'nombre_negocio',
    'nombre_sucursal',
    'tipo_negocio',
    'tipo_unidad',
    'codigo_unidad',
    'ciudad',
    'zona',
    'tiene_restaurante',
    'tiene_catering'
  ].join(', ');

  const canSeeGroup = Boolean(usuario.puede_ver_todo_grupo || usuario.es_responsable_matriz);

  if (!canSeeGroup) {
    const { data, error } = await supabase
      .from('negocios')
      .select(fields)
      .eq('id_negocio', currentBusinessId)
      .maybeSingle();

    if (error || !data) {
      return fallback;
    }

    return [normalizeBusinessOption(data)];
  }

  const { data: currentBusiness, error: currentBusinessError } = await supabase
    .from('negocios')
    .select(fields)
    .eq('id_negocio', currentBusinessId)
    .maybeSingle();

  if (currentBusinessError || !currentBusiness) {
    return fallback;
  }

  const rootBusinessId = currentBusiness.id_negocio_padre || currentBusiness.id_negocio;
  const { data: groupBusinesses, error: groupBusinessesError } = await supabase
    .from('negocios')
    .select(fields)
    .or(`id_negocio.eq.${rootBusinessId},id_negocio_padre.eq.${rootBusinessId}`)
    .order('id_negocio_padre', { ascending: true })
    .order('id_negocio', { ascending: true });

  if (groupBusinessesError || !groupBusinesses?.length) {
    return [normalizeBusinessOption(currentBusiness)];
  }

  return groupBusinesses.map(normalizeBusinessOption);
}

function buildSessionUser(usuario, businessOptions = []) {
  // negocios es objeto (many-to-one) o null si super_admin
  const negocio = Array.isArray(usuario.negocios) ? usuario.negocios[0] : usuario.negocios;
  const fallbackOptions = buildFallbackBusinessOptions(usuario, negocio);
  const normalizedOptions = (businessOptions.length ? businessOptions : fallbackOptions).filter((item) => item.id_negocio);
  const activeBusinessId = Number(usuario.business_id || usuario.id_negocio || normalizedOptions[0]?.id_negocio || 0) || null;
  const activeBusiness = normalizedOptions.find((item) => item.id_negocio === activeBusinessId) || normalizedOptions[0] || null;
  const businessId = activeBusiness?.id_negocio || activeBusinessId;
  const businessName = activeBusiness?.nombre_negocio || usuario.business_name || usuario.nombre_negocio || negocio?.nombre_negocio || '';
  const businessType = activeBusiness?.tipo_negocio || usuario.business_type || usuario.tipo_negocio || negocio?.tipo_negocio || '';
  const hasRestaurant = activeBusiness?.tiene_restaurante ?? usuario.tiene_restaurante ?? negocio?.tiene_restaurante ?? false;
  const hasCatering = activeBusiness?.tiene_catering ?? usuario.tiene_catering ?? negocio?.tiene_catering ?? false;

  return {
    id_usuario: usuario.id_usuario,
    nombre_completo: usuario.nombre_completo,
    correo: usuario.correo,
    id_rol: usuario.id_rol,
    rol_nombre: usuario.rol_nombre || usuario.roles?.nombre_rol || 'Sin rol',
    id_negocio: businessId,
    business_id: businessId,
    nombre_negocio: businessName,
    business_name: businessName,
    nombre_sucursal: activeBusiness?.nombre_sucursal || '',
    business_label: activeBusiness?.nombre_visible || businessName,
    tipo_negocio: businessType,
    business_type: businessType,
    tipo_unidad: activeBusiness?.tipo_unidad || usuario.tipo_unidad || negocio?.tipo_unidad || 'unidad',
    id_negocio_padre: activeBusiness?.id_negocio_padre || null,
    tiene_restaurante: hasRestaurant,
    tiene_catering: hasCatering,
    puede_ver_todo_grupo: Boolean(usuario.puede_ver_todo_grupo),
    puede_gestionar_sucursales: Boolean(usuario.puede_gestionar_sucursales),
    es_responsable_matriz: Boolean(usuario.es_responsable_matriz),
    business_options: normalizedOptions
  };
}

// Login directo contra la tabla usuarios y el catálogo de roles.
export async function login(email, password) {
  const normalizedEmail = email.trim().toLowerCase();

  const { data, error } = await supabase.rpc('login_usuario_demo', {
    p_correo: normalizedEmail,
    p_contrasena: password
  });

  if (error) {
    console.error('Error login Supabase:', error);
    clearDemoSessionEmail();

    if (error.code === 'PGRST202') {
      return { error: 'Falta la función login_usuario_demo en Supabase. Ejecuta el patch SQL de login.' };
    }

    return { error: 'No se pudo iniciar sesión en este momento' };
  }

  const usuario = Array.isArray(data) ? data[0] : data;

  if (error || !usuario) {
    clearDemoSessionEmail();
    return { error: 'Credenciales incorrectas o usuario no encontrado' };
  }

  setDemoSessionEmail(normalizedEmail);

  const negocio = Array.isArray(usuario.negocios) ? usuario.negocios[0] : usuario.negocios;
  const businessOptions = await fetchAccessibleBusinesses(usuario, negocio);

  return { user: buildSessionUser(usuario, businessOptions) };
}
