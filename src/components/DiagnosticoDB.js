import React, { useEffect, useState } from 'react';
import { supabase } from '../services/supabaseClient';

export default function DiagnosticoDB() {
  const [diagnostico, setDiagnostico] = useState({
    insumos_catering: null,
    proveedores_catering: null,
    insumos_restaurante: null,
    proveedores_restaurante: null,
    catering_eventos: null,
    catering_cotizaciones: null,
    usuarios: null,
    recetario: null,
    errores: []
  });
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    ejecutarDiagnostico();
  }, []);

  async function ejecutarDiagnostico() {
    const errores = [];
    const resultado = { ...diagnostico };

    try {
      // 1. Insumos para CATERING (id_negocio=2)
      const { data: insumosCat, error: errInsumosCat } = await supabase
        .from('insumos')
        .select('id_insumo, id_negocio, nombre_item, categoria, grupo, stock_actual')
        .eq('id_negocio', 2)
        .limit(10);
      if (errInsumosCat) errores.push(`Insumos Catering: ${errInsumosCat.message}`);
      resultado.insumos_catering = { data: insumosCat, count: insumosCat?.length || 0 };

      // 2. Proveedores para CATERING (id_negocio=2)
      const { data: provCat, error: errProvCat } = await supabase
        .from('proveedores')
        .select('id_proveedor, id_negocio, nombre_prov, tipo_proveedor')
        .eq('id_negocio', 2)
        .limit(10);
      if (errProvCat) errores.push(`Proveedores Catering: ${errProvCat.message}`);
      resultado.proveedores_catering = { data: provCat, count: provCat?.length || 0 };

      // 3. Insumos para RESTAURANTE (id_negocio=1)
      const { data: insumosRest, error: errInsumosRest } = await supabase
        .from('insumos')
        .select('id_insumo, id_negocio, nombre_item, categoria, grupo, stock_actual')
        .eq('id_negocio', 1)
        .limit(10);
      if (errInsumosRest) errores.push(`Insumos Restaurante: ${errInsumosRest.message}`);
      resultado.insumos_restaurante = { data: insumosRest, count: insumosRest?.length || 0 };

      // 4. Proveedores para RESTAURANTE (id_negocio=1)
      const { data: provRest, error: errProvRest } = await supabase
        .from('proveedores')
        .select('id_proveedor, id_negocio, nombre_prov, tipo_proveedor')
        .eq('id_negocio', 1)
        .limit(10);
      if (errProvRest) errores.push(`Proveedores Restaurante: ${errProvRest.message}`);
      resultado.proveedores_restaurante = { data: provRest, count: provRest?.length || 0 };

      // 5. Catering Eventos
      const { data: eventos, error: errEventos } = await supabase
        .from('catering_eventos')
        .select('id_evento, id_negocio, nombre_evento, fecha_evento')
        .limit(5);
      if (errEventos) errores.push(`Catering Eventos: ${errEventos.message}`);
      resultado.catering_eventos = { data: eventos, count: eventos?.length || 0 };

      // 6. Catering Cotizaciones
      const { data: cotizaciones, error: errCotizaciones } = await supabase
        .from('catering_cotizaciones')
        .select('id_cotizacion, id_negocio, nombre_cliente, numero_personas')
        .limit(5);
      if (errCotizaciones) errores.push(`Catering Cotizaciones: ${errCotizaciones.message}`);
      resultado.catering_cotizaciones = { data: cotizaciones, count: cotizaciones?.length || 0 };

      // 7. Usuarios (muestra todos sin mostrar contraseña)
      const { data: usuarios, error: errUsuarios } = await supabase
        .from('usuarios')
        .select('id_usuario, correo, id_negocio, nombre_completo')
        .limit(10);
      if (errUsuarios) errores.push(`Usuarios: ${errUsuarios.message}`);
      resultado.usuarios = { data: usuarios, count: usuarios?.length || 0 };

      // 8. Recetario
      const { data: recetas, error: errRecetas } = await supabase
        .from('recetario')
        .select('id_recetario, id_negocio, nombre_platillo')
        .limit(10);
      if (errRecetas) errores.push(`Recetario: ${errRecetas.message}`);
      resultado.recetario = { data: recetas, count: recetas?.length || 0 };

      resultado.errores = errores;
      setDiagnostico(resultado);
    } catch (err) {
      errores.push(`Error general: ${err.message}`);
      resultado.errores = errores;
      setDiagnostico(resultado);
    } finally {
      setCargando(false);
    }
  }

  if (cargando) {
    return <div style={{ padding: '20px', textAlign: 'center' }}>⏳ Cargando diagnóstico de BD...</div>;
  }

  return (
    <div style={{ padding: '20px', fontFamily: 'monospace', fontSize: '12px' }}>
      <h2>🔍 DIAGNÓSTICO COMPLETO DE BASE DE DATOS</h2>

      {diagnostico.errores.length > 0 && (
        <div style={{ padding: '12px', backgroundColor: '#fee2e2', borderRadius: '8px', marginBottom: '16px', color: '#991b1b' }}>
          <strong>⚠️ Errores encontrados:</strong>
          <ul>
            {diagnostico.errores.map((err, i) => <li key={i}>{err}</li>)}
          </ul>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px' }}>
        {/* CATERING INSUMOS */}
        <div style={{ padding: '12px', backgroundColor: '#f0fdf4', borderRadius: '8px', border: '2px solid #22c55e' }}>
          <h3 style={{ margin: '0 0 8px 0' }}>📦 INSUMOS CATERING (id_negocio=2)</h3>
          <div style={{ fontSize: '16px', fontWeight: 'bold', color: '#166534', marginBottom: '8px' }}>
            Total: {diagnostico.insumos_catering?.count || 0}
          </div>
          {diagnostico.insumos_catering?.data?.length > 0 ? (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #22c55e' }}>
                  <th style={{ textAlign: 'left', padding: '4px' }}>Nombre</th>
                  <th style={{ textAlign: 'left', padding: '4px' }}>Grupo</th>
                  <th style={{ textAlign: 'right', padding: '4px' }}>Stock</th>
                </tr>
              </thead>
              <tbody>
                {diagnostico.insumos_catering.data.map((item, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid #e0e7ff' }}>
                    <td style={{ padding: '4px' }}>{item.nombre_item}</td>
                    <td style={{ padding: '4px' }}>{item.grupo}</td>
                    <td style={{ padding: '4px', textAlign: 'right' }}>{item.stock_actual}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div style={{ color: '#991b1b', fontWeight: 'bold' }}>❌ Sin datos</div>
          )}
        </div>

        {/* CATERING PROVEEDORES */}
        <div style={{ padding: '12px', backgroundColor: '#fdf2f8', borderRadius: '8px', border: '2px solid #ec4899' }}>
          <h3 style={{ margin: '0 0 8px 0' }}>🤝 PROVEEDORES CATERING (id_negocio=2)</h3>
          <div style={{ fontSize: '16px', fontWeight: 'bold', color: '#be185d', marginBottom: '8px' }}>
            Total: {diagnostico.proveedores_catering?.count || 0}
          </div>
          {diagnostico.proveedores_catering?.data?.length > 0 ? (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #ec4899' }}>
                  <th style={{ textAlign: 'left', padding: '4px' }}>Nombre</th>
                  <th style={{ textAlign: 'left', padding: '4px' }}>Tipo</th>
                </tr>
              </thead>
              <tbody>
                {diagnostico.proveedores_catering.data.map((item, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid #e0e7ff' }}>
                    <td style={{ padding: '4px' }}>{item.nombre_prov}</td>
                    <td style={{ padding: '4px' }}>{item.tipo_proveedor}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div style={{ color: '#991b1b', fontWeight: 'bold' }}>❌ Sin datos</div>
          )}
        </div>

        {/* RESTAURANTE INSUMOS */}
        <div style={{ padding: '12px', backgroundColor: '#f0f9ff', borderRadius: '8px', border: '2px solid #3b82f6' }}>
          <h3 style={{ margin: '0 0 8px 0' }}>📦 INSUMOS RESTAURANTE (id_negocio=1)</h3>
          <div style={{ fontSize: '16px', fontWeight: 'bold', color: '#1e40af', marginBottom: '8px' }}>
            Total: {diagnostico.insumos_restaurante?.count || 0}
          </div>
          {diagnostico.insumos_restaurante?.data?.length > 0 ? (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #3b82f6' }}>
                  <th style={{ textAlign: 'left', padding: '4px' }}>Nombre</th>
                  <th style={{ textAlign: 'left', padding: '4px' }}>Grupo</th>
                  <th style={{ textAlign: 'right', padding: '4px' }}>Stock</th>
                </tr>
              </thead>
              <tbody>
                {diagnostico.insumos_restaurante.data.map((item, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid #e0e7ff' }}>
                    <td style={{ padding: '4px' }}>{item.nombre_item}</td>
                    <td style={{ padding: '4px' }}>{item.grupo}</td>
                    <td style={{ padding: '4px', textAlign: 'right' }}>{item.stock_actual}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div style={{ color: '#991b1b', fontWeight: 'bold' }}>❌ Sin datos</div>
          )}
        </div>

        {/* RESTAURANTE PROVEEDORES */}
        <div style={{ padding: '12px', backgroundColor: '#fffbeb', borderRadius: '8px', border: '2px solid #f59e0b' }}>
          <h3 style={{ margin: '0 0 8px 0' }}>🤝 PROVEEDORES RESTAURANTE (id_negocio=1)</h3>
          <div style={{ fontSize: '16px', fontWeight: 'bold', color: '#b45309', marginBottom: '8px' }}>
            Total: {diagnostico.proveedores_restaurante?.count || 0}
          </div>
          {diagnostico.proveedores_restaurante?.data?.length > 0 ? (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #f59e0b' }}>
                  <th style={{ textAlign: 'left', padding: '4px' }}>Nombre</th>
                  <th style={{ textAlign: 'left', padding: '4px' }}>Tipo</th>
                </tr>
              </thead>
              <tbody>
                {diagnostico.proveedores_restaurante.data.map((item, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid #e0e7ff' }}>
                    <td style={{ padding: '4px' }}>{item.nombre_prov}</td>
                    <td style={{ padding: '4px' }}>{item.tipo_proveedor}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div style={{ color: '#991b1b', fontWeight: 'bold' }}>❌ Sin datos</div>
          )}
        </div>

        {/* CATERING EVENTOS */}
        <div style={{ padding: '12px', backgroundColor: '#f5f3ff', borderRadius: '8px', border: '2px solid #a855f7' }}>
          <h3 style={{ margin: '0 0 8px 0' }}>📅 CATERING EVENTOS</h3>
          <div style={{ fontSize: '16px', fontWeight: 'bold', color: '#6b21a8', marginBottom: '8px' }}>
            Total: {diagnostico.catering_eventos?.count || 0}
          </div>
          {diagnostico.catering_eventos?.data?.length > 0 ? (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #a855f7' }}>
                  <th style={{ textAlign: 'left', padding: '4px' }}>Evento</th>
                  <th style={{ textAlign: 'left', padding: '4px' }}>Negocio</th>
                </tr>
              </thead>
              <tbody>
                {diagnostico.catering_eventos.data.map((item, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid #e0e7ff' }}>
                    <td style={{ padding: '4px' }}>{item.nombre_evento}</td>
                    <td style={{ padding: '4px' }}>#{item.id_negocio}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div style={{ color: '#991b1b', fontWeight: 'bold' }}>❌ Sin datos</div>
          )}
        </div>

        {/* USUARIOS */}
        <div style={{ padding: '12px', backgroundColor: '#fef3c7', borderRadius: '8px', border: '2px solid #eab308' }}>
          <h3 style={{ margin: '0 0 8px 0' }}>👤 USUARIOS</h3>
          <div style={{ fontSize: '16px', fontWeight: 'bold', color: '#854d0e', marginBottom: '8px' }}>
            Total: {diagnostico.usuarios?.count || 0}
          </div>
          {diagnostico.usuarios?.data?.length > 0 ? (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #eab308' }}>
                  <th style={{ textAlign: 'left', padding: '4px' }}>Email</th>
                  <th style={{ textAlign: 'left', padding: '4px' }}>Negocio</th>
                </tr>
              </thead>
              <tbody>
                {diagnostico.usuarios.data.map((item, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid #e0e7ff' }}>
                    <td style={{ padding: '4px' }}>{item.correo}</td>
                    <td style={{ padding: '4px' }}>#{item.id_negocio}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div style={{ color: '#991b1b', fontWeight: 'bold' }}>❌ Sin datos</div>
          )}
        </div>
      </div>

      <div style={{ marginTop: '24px', padding: '12px', backgroundColor: '#f3f4f6', borderRadius: '8px' }}>
        <strong>📋 RESUMEN EJECUTIVO:</strong>
        <ul>
          <li>✅ Insumos Catering: <strong>{diagnostico.insumos_catering?.count || 0}</strong></li>
          <li>✅ Proveedores Catering: <strong>{diagnostico.proveedores_catering?.count || 0}</strong></li>
          <li>✅ Insumos Restaurante: <strong>{diagnostico.insumos_restaurante?.count || 0}</strong></li>
          <li>✅ Proveedores Restaurante: <strong>{diagnostico.proveedores_restaurante?.count || 0}</strong></li>
          <li>✅ Eventos Catering: <strong>{diagnostico.catering_eventos?.count || 0}</strong></li>
          <li>✅ Usuarios: <strong>{diagnostico.usuarios?.count || 0}</strong></li>
        </ul>
      </div>
    </div>
  );
}
