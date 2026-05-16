/**
 * Script para ejecutar SQL de actualización de movimientos
 * Ejecuta: node execute_updates.js
 */

const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://fpoykjcmfboginwoqkcp.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZwb3lramNtZmJvZ2lud29xa2NwIiwicm9sZSI6ImFub24iLCJpYXQiOjE2ODMyODc5NzcsImV4cCI6MTk5ODk2Mzk3N30.OZzCXAwtBxFEf6YXVW_KO7XqKQfGVnr3S6InMFAa9Og';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function executeSQLUpdates() {
  console.log('🔄 Iniciando actualización de BD...\n');

  // 1. Actualizar tabla entradas_salidas
  console.log('📝 1. Agregando columnas a entradas_salidas...');
  try {
    await supabase.rpc('execute_sql', {
      sql: `
        ALTER TABLE entradas_salidas
        ADD COLUMN IF NOT EXISTS tipo_movimiento_detalle TEXT DEFAULT NULL,
        ADD COLUMN IF NOT EXISTS id_chef INT REFERENCES usuarios(id_usuario),
        ADD COLUMN IF NOT EXISTS descripcion_incidente TEXT;
      `
    });
    console.log('   ✅ Columnas agregadas\n');
  } catch (err) {
    console.log('   ⚠️  Columnas ya existen o error:', err.message, '\n');
  }

  // 2. Crear tabla tipos_movimiento
  console.log('📝 2. Creando tabla tipos_movimiento...');
  try {
    await supabase.rpc('execute_sql', {
      sql: `
        CREATE TABLE IF NOT EXISTS tipos_movimiento (
          id_tipo SERIAL PRIMARY KEY,
          nombre_tipo TEXT NOT NULL UNIQUE,
          descripcion TEXT,
          aplica_a TEXT DEFAULT 'inventario'
        );
      `
    });
    console.log('   ✅ Tabla creada\n');
  } catch (err) {
    console.log('   ⚠️  Error:', err.message, '\n');
  }

  // 3. Insertar tipos de movimiento
  console.log('📝 3. Insertando tipos de movimiento...');
  try {
    await supabase.rpc('execute_sql', {
      sql: `
        INSERT INTO tipos_movimiento (nombre_tipo, descripcion, aplica_a) VALUES
          ('Entrada por Compra', 'Compra de insumos a proveedores', 'inventario'),
          ('Salida por Receta', 'Consumo en preparación de recetas', 'inventario'),
          ('Salida por Evento', 'Consumo para un evento catering', 'inventario'),
          ('Daño', 'Producto dañado o defectuoso', 'inventario'),
          ('Merma', 'Pérdida por spoilage, expiración o descomposición', 'inventario'),
          ('Reposición', 'Reemplazo de artículo roto o dañado', 'equipo'),
          ('Deterioro', 'Equipo en mal estado', 'equipo'),
          ('Ajuste de Inventario', 'Corrección manual de conteos', 'inventario')
        ON CONFLICT (nombre_tipo) DO NOTHING;
      `
    });
    console.log('   ✅ Tipos insertados\n');
  } catch (err) {
    console.log('   ⚠️  Error:', err.message, '\n');
  }

  // 4. Crear función RPC: admin_registrar_dano
  console.log('📝 4. Creando función admin_registrar_dano...');
  try {
    await supabase.rpc('execute_sql', {
      sql: `
        CREATE OR REPLACE FUNCTION admin_registrar_dano(
          p_id_negocio INT,
          p_id_insumo INT,
          p_cantidad NUMERIC,
          p_responsable TEXT,
          p_descripcion TEXT,
          p_motivo TEXT DEFAULT 'Producto dañado'
        )
        RETURNS json AS $$
        DECLARE
          v_resultado json;
          v_id_mov_inv INT;
        BEGIN
          INSERT INTO entradas_salidas (
            id_negocio, id_insumo, tipo_operacion, tipo_detalle,
            cantidad, responsable, motivo, fecha_registro,
            tipo_movimiento_detalle, descripcion_incidente
          ) VALUES (
            p_id_negocio, p_id_insumo, 'Salida', 'Daño',
            p_cantidad, p_responsable, p_motivo, NOW(),
            'Daño', p_descripcion
          )
          RETURNING id_mov_inv INTO v_id_mov_inv;

          INSERT INTO movimientos (
            id_negocio, id_insumo, id_mov_inv,
            tipo_movimiento, cantidad, responsable, fecha_registro
          ) VALUES (
            p_id_negocio, p_id_insumo, v_id_mov_inv,
            'Daño', p_cantidad, p_responsable, NOW()
          );

          v_resultado := json_build_object(
            'success', true,
            'message', 'Daño registrado exitosamente',
            'id_mov_inv', v_id_mov_inv
          );

          RETURN v_resultado;
        EXCEPTION WHEN OTHERS THEN
          v_resultado := json_build_object(
            'success', false,
            'error', SQLERRM
          );
          RETURN v_resultado;
        END;
        $$ LANGUAGE plpgsql SECURITY DEFINER;
      `
    });
    console.log('   ✅ Función admin_registrar_dano creada\n');
  } catch (err) {
    console.log('   ⚠️  Error:', err.message, '\n');
  }

  // 5. Crear función RPC: admin_registrar_merma
  console.log('📝 5. Creando función admin_registrar_merma...');
  try {
    await supabase.rpc('execute_sql', {
      sql: `
        CREATE OR REPLACE FUNCTION admin_registrar_merma(
          p_id_negocio INT,
          p_id_insumo INT,
          p_cantidad NUMERIC,
          p_responsable TEXT,
          p_causa TEXT,
          p_descripcion TEXT DEFAULT ''
        )
        RETURNS json AS $$
        DECLARE
          v_resultado json;
          v_id_mov_inv INT;
        BEGIN
          INSERT INTO entradas_salidas (
            id_negocio, id_insumo, tipo_operacion, tipo_detalle,
            cantidad, responsable, motivo, fecha_registro,
            tipo_movimiento_detalle, descripcion_incidente
          ) VALUES (
            p_id_negocio, p_id_insumo, 'Salida', 'Merma',
            p_cantidad, p_responsable, p_causa, NOW(),
            'Merma', p_descripcion
          )
          RETURNING id_mov_inv INTO v_id_mov_inv;

          INSERT INTO movimientos (
            id_negocio, id_insumo, id_mov_inv,
            tipo_movimiento, cantidad, responsable, fecha_registro
          ) VALUES (
            p_id_negocio, p_id_insumo, v_id_mov_inv,
            'Merma', p_cantidad, p_responsable, NOW()
          );

          v_resultado := json_build_object(
            'success', true,
            'message', 'Merma registrada exitosamente',
            'id_mov_inv', v_id_mov_inv,
            'causa', p_causa
          );

          RETURN v_resultado;
        EXCEPTION WHEN OTHERS THEN
          v_resultado := json_build_object(
            'success', false,
            'error', SQLERRM
          );
          RETURN v_resultado;
        END;
        $$ LANGUAGE plpgsql SECURITY DEFINER;
      `
    });
    console.log('   ✅ Función admin_registrar_merma creada\n');
  } catch (err) {
    console.log('   ⚠️  Error:', err.message, '\n');
  }

  // 6. Crear función RPC: admin_registrar_reposicion_equipo
  console.log('📝 6. Creando función admin_registrar_reposicion_equipo...');
  try {
    await supabase.rpc('execute_sql', {
      sql: `
        CREATE OR REPLACE FUNCTION admin_registrar_reposicion_equipo(
          p_id_negocio INT,
          p_id_insumo INT,
          p_cantidad_reposicion NUMERIC,
          p_responsable TEXT,
          p_descripcion_rotura TEXT,
          p_id_evento INT DEFAULT NULL
        )
        RETURNS json AS $$
        DECLARE
          v_resultado json;
          v_id_mov_inv INT;
        BEGIN
          INSERT INTO entradas_salidas (
            id_negocio, id_insumo, tipo_operacion, tipo_detalle,
            cantidad, responsable, motivo, fecha_registro,
            id_evento, tipo_movimiento_detalle, descripcion_incidente
          ) VALUES (
            p_id_negocio, p_id_insumo, 'Salida', 'Reposición',
            p_cantidad_reposicion, p_responsable, 'Equipo reemplazado', NOW(),
            p_id_evento, 'Reposición', p_descripcion_rotura
          )
          RETURNING id_mov_inv INTO v_id_mov_inv;

          INSERT INTO movimientos (
            id_negocio, id_insumo, id_mov_inv,
            tipo_movimiento, cantidad, responsable, fecha_registro
          ) VALUES (
            p_id_negocio, p_id_insumo, v_id_mov_inv,
            'Reposición', p_cantidad_reposicion, p_responsable, NOW()
          );

          v_resultado := json_build_object(
            'success', true,
            'message', 'Reposición registrada exitosamente',
            'id_mov_inv', v_id_mov_inv,
            'equipo_reemplazado', p_descripcion_rotura
          );

          RETURN v_resultado;
        EXCEPTION WHEN OTHERS THEN
          v_resultado := json_build_object(
            'success', false,
            'error', SQLERRM
          );
          RETURN v_resultado;
        END;
        $$ LANGUAGE plpgsql SECURITY DEFINER;
      `
    });
    console.log('   ✅ Función admin_registrar_reposicion_equipo creada\n');
  } catch (err) {
    console.log('   ⚠️  Error:', err.message, '\n');
  }

  console.log('✅ ¡Actualización completada!\n');
  console.log('Ahora puedes usar el nuevo sistema de movimientos en la app.');
}

executeSQLUpdates().catch(err => {
  console.error('❌ Error fatal:', err);
  process.exit(1);
});
