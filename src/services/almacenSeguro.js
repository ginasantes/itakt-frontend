// ================================================================
// MÉTODOS DE ACCESO A DATOS CON RLS Y SEGURIDAD
// Diseñados para trabajar con políticas de seguridad por id_negocio
// ================================================================

import { supabase } from './supabaseClient';

/**
 * PASO 1: SETEAR CONTEXTO DE SESIÓN
 * Las políticas RLS necesitan saber quién está accediendo
 * Esto se hace antes de cualquier consulta a Supabase
 */
export async function setSessionContext(userEmail) {
  console.log('🔐 Estableciendo contexto de sesión para:', userEmail);
  try {
    // Establecer el email en el contexto de Postgres
    await supabase.rpc('set_session_email', { email: userEmail });
    console.log('✅ Contexto establecido');
    return { success: true };
  } catch (error) {
    console.warn('⚠️  RPC no disponible, continuando sin contexto');
    // Si la RPC no existe, continuamos sin error - las políticas usarán current_user
    return { success: false };
  }
}

/**
 * PASO 2: OBTENER ID_NEGOCIO DEL EMAIL
 * Consulta la tabla usuarios para obtener el negocio del usuario
 */
export async function obtenerIdNegocioPorCorreo(correo) {
  console.log('🔍 Buscando id_negocio para email:', correo);
  
  const { data, error } = await supabase
    .from('usuarios')
    .select('id_negocio')
    .eq('correo', correo)
    .single();

  if (error) {
    console.error('❌ Error buscando usuario:', error.message);
    return null;
  }

  console.log('✅ id_negocio encontrado:', data?.id_negocio);
  return data?.id_negocio || null;
}

/**
 * PASO 3: OBTENER INSUMOS CON SEGURIDAD
 * Filtra por id_negocio del usuario
 * Las políticas RLS también lo restringirán
 */
export async function obtenerInsumosSeguro(userEmail, excludeEquipos = false) {
  console.log('📦 Obteniendo insumos para:', userEmail, { excludeEquipos });

  // Primero, obtener el id_negocio del usuario
  const idNegocio = await obtenerIdNegocioPorCorreo(userEmail);
  if (!idNegocio) {
    console.error('❌ No se encontró negocio para este usuario');
    return { data: [], error: 'Usuario no asignado a ningún negocio' };
  }

  // Construir la consulta con filtros
  let query = supabase
    .from('insumos')
    .select(`
      id_insumo,
      nombre_item,
      id_subcategoria,
      subcategorias_insumos(nombre),
      tipo_conservacion,
      unidad_consumo,
      stock_actual,
      punto_reorden,
      es_inventariable,
      costo_unitario_promedio,
      precio_competencia_promedio,
      fuente_competencia,
      id_negocio
    `)
    .eq('id_negocio', idNegocio)
    .order('nombre_item', { ascending: true });

  const { data, error } = await query;

  if (error) {
    console.error('❌ Error obteniendo insumos:', error.message);
    return { data: [], error: error.message };
  }

  console.log(`✅ Obtenidos ${data?.length || 0} insumos para negocio ${idNegocio}`);

  // Filtrar equipos si se solicita
  if (excludeEquipos) {
    const filtered = (data || []).filter(item => {
      // No incluir items cuyo nombre contenga palabras clave de equipo
      const equipmentKeywords = [
        'mesa', 'silla', 'banco', 'arreglo', 'centro de mesa',
        'vela', 'mantel', 'servilleta', 'cristalería', 'copa',
        'equipo', 'renta', 'chiavari', 'lonas', 'iluminación'
      ];
      const lowerName = (item.nombre_item || '').toLowerCase();
      return !equipmentKeywords.some(keyword => lowerName.includes(keyword));
    });
    console.log(`🚫 Filtrados ${data?.length - filtered.length} equipos`);
    return { data: filtered, error: null };
  }

  return { data: data || [], error: null };
}

/**
 * PASO 4: OBTENER PROVEEDORES CON SEGURIDAD
 * Filtra por id_negocio del usuario
 */
export async function obtenerProveedoresSeguro(userEmail) {
  console.log('🏢 Obteniendo proveedores para:', userEmail);

  // Obtener el id_negocio del usuario
  const idNegocio = await obtenerIdNegocioPorCorreo(userEmail);
  if (!idNegocio) {
    console.error('❌ No se encontró negocio para este usuario');
    return { data: [], error: 'Usuario no asignado a ningún negocio' };
  }

  const { data, error } = await supabase
    .from('proveedores')
    .select('id_proveedor, nombre_prov, tipo_proveedor, telefono_prov, correo_prov, direccion_prov, id_negocio')
    .eq('id_negocio', idNegocio)
    .order('nombre_prov', { ascending: true });

  if (error) {
    console.error('❌ Error obteniendo proveedores:', error.message);
    return { data: [], error: error.message };
  }

  console.log(`✅ Obtenidos ${data?.length || 0} proveedores para negocio ${idNegocio}`);
  return { data: data || [], error: null };
}

/**
 * PASO 5: OBTENER ALMACÉN COMPLETO
 * Retorna insumos, proveedores y resumen
 */
export async function obtenerAlmacenCompleto(userEmail, options = {}) {
  console.log('📊 Obteniendo almacén completo para:', userEmail);
  const { excludeEquipos = false } = options;

  // Obtener id_negocio
  const idNegocio = await obtenerIdNegocioPorCorreo(userEmail);
  if (!idNegocio) {
    return {
      data: {
        insumos: [],
        proveedores: [],
        resumen: { totalInsumos: 0, proveedores: 0, equipos: 0, otros: 0 }
      },
      error: 'Usuario no asignado a ningún negocio'
    };
  }

  // Cargar en paralelo
  const [insumosResult, proveedoresResult] = await Promise.all([
    obtenerInsumosSeguro(userEmail, excludeEquipos),
    obtenerProveedoresSeguro(userEmail)
  ]);

  if (insumosResult.error || proveedoresResult.error) {
    return {
      data: null,
      error: insumosResult.error || proveedoresResult.error
    };
  }

  const insumos = insumosResult.data || [];
  const proveedores = proveedoresResult.data || [];

  // Calcular resumen
  const resumen = {
    totalInsumos: insumos.length,
    proveedores: proveedores.length,
    equipos: insumos.filter(item => {
      const lowerName = (item.nombre_item || '').toLowerCase();
      return lowerName.includes('equipo') || lowerName.includes('mesa') || lowerName.includes('silla');
    }).length,
    otros: insumos.length - (excludeEquipos ? insumos.length : 0)
  };

  console.log('✅ Almacén completo cargado:', resumen);

  return {
    data: { insumos, proveedores, resumen, idNegocio },
    error: null
  };
}

/**
 * EXPORTAR FUNCIONES COMPATIBLES CON EL CÓDIGO ACTUAL
 * Estas funciones mantienen la interfaz anterior pero usan la nueva seguridad
 */

export async function obtenerAlmacenCatering(userEmail) {
  console.log('🟦 obtenerAlmacenCatering - Catering específico');
  return obtenerAlmacenCompleto(userEmail, { excludeEquipos: false });
}

export async function obtenerAlmacenRestaurante(userEmail) {
  console.log('🟨 obtenerAlmacenRestaurante - Restaurante específico');
  return obtenerAlmacenCompleto(userEmail, { excludeEquipos: true });
}

// ================================================================
// FUNCIONES DE ESCRITURA CON SEGURIDAD
// ================================================================

export async function crearInsumo(userEmail, datosInsumo) {
  console.log('✏️  Creando insumo para:', userEmail);

  const idNegocio = await obtenerIdNegocioPorCorreo(userEmail);
  if (!idNegocio) {
    return { data: null, error: 'Usuario no asignado a ningún negocio' };
  }

  const { data, error } = await supabase
    .from('insumos')
    .insert([{ ...datosInsumo, id_negocio: idNegocio }])
    .select()
    .single();

  if (error) {
    console.error('❌ Error creando insumo:', error.message);
    return { data: null, error: error.message };
  }

  console.log('✅ Insumo creado:', data.id_insumo);
  return { data, error: null };
}

export async function actualizarInsumo(userEmail, idInsumo, datosInsumo) {
  console.log('✏️  Actualizando insumo:', idInsumo);

  const { data, error } = await supabase
    .from('insumos')
    .update(datosInsumo)
    .eq('id_insumo', idInsumo)
    .select()
    .single();

  if (error) {
    console.error('❌ Error actualizando insumo:', error.message);
    return { data: null, error: error.message };
  }

  console.log('✅ Insumo actualizado');
  return { data, error: null };
}

export async function crearProveedor(userEmail, datosProveedor) {
  console.log('✏️  Creando proveedor para:', userEmail);

  const idNegocio = await obtenerIdNegocioPorCorreo(userEmail);
  if (!idNegocio) {
    return { data: null, error: 'Usuario no asignado a ningún negocio' };
  }

  const { data, error } = await supabase
    .from('proveedores')
    .insert([{ ...datosProveedor, id_negocio: idNegocio }])
    .select()
    .single();

  if (error) {
    console.error('❌ Error creando proveedor:', error.message);
    return { data: null, error: error.message };
  }

  console.log('✅ Proveedor creado:', data.id_proveedor);
  return { data, error: null };
}
