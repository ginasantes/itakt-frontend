import React, { useState, useEffect } from 'react';
import { supabase } from '../services/supabaseClient';

const styles = {
  container: {
    padding: '20px',
    backgroundColor: '#f8fafc',
    borderRadius: '8px',
    marginTop: '20px'
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '20px'
  },
  title: {
    fontSize: '24px',
    fontWeight: '700',
    color: '#1f2937'
  },
  filterContainer: {
    display: 'flex',
    gap: '12px',
    marginBottom: '20px',
    flexWrap: 'wrap'
  },
  filterGroup: {
    display: 'flex',
    gap: '8px',
    alignItems: 'center'
  },
  select: {
    padding: '8px 12px',
    border: '1px solid #d1d5db',
    borderRadius: '6px',
    fontSize: '14px',
    backgroundColor: '#fff'
  },
  button: {
    padding: '8px 16px',
    backgroundColor: '#3b82f6',
    color: '#fff',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: '600'
  },
  buttonExcel: {
    backgroundColor: '#10b981'
  },
  buttonPDF: {
    backgroundColor: '#ef4444'
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    backgroundColor: '#fff',
    boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
    borderRadius: '8px',
    overflow: 'hidden'
  },
  thead: {
    backgroundColor: '#f3f4f6',
    borderBottom: '2px solid #e5e7eb'
  },
  th: {
    padding: '12px 16px',
    textAlign: 'left',
    fontWeight: '600',
    color: '#374151',
    fontSize: '14px'
  },
  td: {
    padding: '12px 16px',
    borderBottom: '1px solid #e5e7eb',
    fontSize: '14px',
    color: '#4b5563'
  },
  trEven: {
    backgroundColor: '#f9fafb'
  },
  trOdd: {
    backgroundColor: '#fff'
  },
  loading: {
    textAlign: 'center',
    padding: '40px',
    color: '#6b7280'
  },
  error: {
    backgroundColor: '#fee2e2',
    color: '#991b1b',
    padding: '12px 16px',
    borderRadius: '6px',
    marginBottom: '20px'
  },
  badge: {
    display: 'inline-block',
    padding: '4px 8px',
    borderRadius: '4px',
    fontSize: '12px',
    fontWeight: '600'
  },
  badgeEntrada: {
    backgroundColor: '#d1fae5',
    color: '#065f46'
  },
  badgeSalida: {
    backgroundColor: '#fecaca',
    color: '#7f1d1d'
  },
  badgeRestaurante: {
    backgroundColor: '#dbeafe',
    color: '#1e40af'
  },
  badgeCatering: {
    backgroundColor: '#fce7f3',
    color: '#831843'
  }
};

export default function RegistroMovimientosInventarioCompleto({ businessId = 2 }) {
  const [movimientos, setMovimientos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filtroModulo, setFiltroModulo] = useState('todos');
  const [filtroTipo, setFiltroTipo] = useState('todos');

  useEffect(() => {
    cargarMovimientos();
  }, [businessId, filtroModulo, filtroTipo]);

  async function cargarMovimientos() {
    setLoading(true);
    setError('');
    try {
      // Cargar de entradas_salidas
      let query = supabase
        .from('entradas_salidas')
        .select(`
          id_mov_inv,
          id_negocio,
          id_insumo,
          id_proveedor,
          tipo_operacion,
          tipo_detalle,
          cantidad,
          costo_unitario,
          id_receta,
          id_evento,
          responsable,
          motivo,
          fecha_registro,
          tipo_movimiento_detalle,
          descripcion_incidente,
          insumos(nombre_item),
          proveedores(nombre_prov),
          recetario(nombre_platillo),
          catering_eventos(nombre_evento)
        `)
        .eq('id_negocio', businessId)
        .order('fecha_registro', { ascending: false })
        .limit(500);

      const { data, error: queryError } = await query;

      if (queryError) throw new Error(queryError.message);

      // Filtrar por módulo (restaurante vs catering)
      let filtered = data || [];
      if (filtroModulo === 'restaurante') {
        filtered = filtered.filter(m => m.id_receta && !m.id_evento);
      } else if (filtroModulo === 'catering') {
        filtered = filtered.filter(m => m.id_evento);
      }

      // Filtrar por tipo
      if (filtroTipo !== 'todos') {
        filtered = filtered.filter(m => m.tipo_operacion === filtroTipo);
      }

      setMovimientos(filtered);
    } catch (err) {
      console.error('Error cargando movimientos:', err);
      setError(err.message || 'Error al cargar movimientos');
    } finally {
      setLoading(false);
    }
  }

  function exportarExcel() {
    const headers = [
      'ID',
      'Fecha',
      'Módulo',
      'Tipo',
      'Insumo',
      'Cantidad',
      'Costo Unitario',
      'Subtotal',
      'Responsable',
      'Motivo'
    ];

    const rows = movimientos.map(m => [
      m.id_mov_inv,
      new Date(m.fecha_registro).toLocaleDateString('es-MX'),
      m.id_evento ? 'Catering' : 'Restaurante',
      m.tipo_operacion,
      m.insumos?.nombre_item || 'N/A',
      m.cantidad,
      m.costo_unitario?.toFixed(2) || '0.00',
      (m.cantidad * (m.costo_unitario || 0)).toFixed(2),
      m.responsable || 'N/A',
      m.motivo || m.descripcion_incidente || 'N/A'
    ]);

    // Crear CSV
    const csv = [
      headers.join(','),
      ...rows.map(r => r.map(cell => `"${cell}"`).join(','))
    ].join('\n');

    // Descargar
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `movimientos_inventario_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  }

  function exportarPDF() {
    // Crear HTML para PDF
    const html = `
      <html>
        <head>
          <meta charset="UTF-8">
          <title>Movimientos de Inventario</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 20px; }
            h1 { text-align: center; color: #333; }
            table { width: 100%; border-collapse: collapse; margin-top: 20px; }
            th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
            th { background-color: #f3f4f6; font-weight: bold; }
            tr:nth-child(even) { background-color: #f9fafb; }
            .fecha { font-size: 12px; color: #666; }
          </style>
        </head>
        <body>
          <h1>Registro de Movimientos de Inventario</h1>
          <p class="fecha">Generado: ${new Date().toLocaleString('es-MX')}</p>
          <table>
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Módulo</th>
                <th>Tipo</th>
                <th>Insumo</th>
                <th>Cantidad</th>
                <th>Costo Unit.</th>
                <th>Subtotal</th>
                <th>Responsable</th>
              </tr>
            </thead>
            <tbody>
              ${movimientos.map(m => `
                <tr>
                  <td>${new Date(m.fecha_registro).toLocaleDateString('es-MX')}</td>
                  <td>${m.id_evento ? 'Catering' : 'Restaurante'}</td>
                  <td>${m.tipo_operacion}</td>
                  <td>${m.insumos?.nombre_item || 'N/A'}</td>
                  <td>${m.cantidad}</td>
                  <td>$${m.costo_unitario?.toFixed(2) || '0.00'}</td>
                  <td>$${(m.cantidad * (m.costo_unitario || 0)).toFixed(2)}</td>
                  <td>${m.responsable || 'N/A'}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
          <p style="margin-top: 30px; text-align: right; font-size: 12px; color: #666;">
            Total de registros: ${movimientos.length}
          </p>
        </body>
      </html>
    `;

    const ventana = window.open('', '', 'width=800,height=600');
    ventana.document.write(html);
    ventana.document.close();
    ventana.print();
  }

  if (loading) {
    return <div style={styles.loading}>⏳ Cargando movimientos...</div>;
  }

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h2 style={styles.title}>📦 Movimientos de Inventario</h2>
      </div>

      {error && <div style={styles.error}>⚠️ {error}</div>}

      <div style={styles.filterContainer}>
        <div style={styles.filterGroup}>
          <label>Módulo:</label>
          <select 
            style={styles.select}
            value={filtroModulo}
            onChange={(e) => setFiltroModulo(e.target.value)}
          >
            <option value="todos">Todos</option>
            <option value="restaurante">Restaurante</option>
            <option value="catering">Catering</option>
          </select>
        </div>

        <div style={styles.filterGroup}>
          <label>Tipo:</label>
          <select 
            style={styles.select}
            value={filtroTipo}
            onChange={(e) => setFiltroTipo(e.target.value)}
          >
            <option value="todos">Todos</option>
            <option value="entrada">Entrada</option>
            <option value="salida">Salida</option>
            <option value="ajuste">Ajuste</option>
          </select>
        </div>

        <button 
          style={{...styles.button, ...styles.buttonExcel}}
          onClick={exportarExcel}
        >
          📊 Descargar Excel
        </button>

        <button 
          style={{...styles.button, ...styles.buttonPDF}}
          onClick={exportarPDF}
        >
          📄 Descargar PDF
        </button>
      </div>

      <div>
        <p style={{marginBottom: '10px', color: '#6b7280'}}>
          Total de registros: <strong>{movimientos.length}</strong>
        </p>
      </div>

      {movimientos.length === 0 ? (
        <div style={{...styles.loading, color: '#9ca3af'}}>
          No hay movimientos para mostrar
        </div>
      ) : (
        <table style={styles.table}>
          <thead style={styles.thead}>
            <tr>
              <th style={styles.th}>Fecha</th>
              <th style={styles.th}>Módulo</th>
              <th style={styles.th}>Tipo</th>
              <th style={styles.th}>Insumo</th>
              <th style={styles.th}>Cantidad</th>
              <th style={styles.th}>Costo Unit.</th>
              <th style={styles.th}>Subtotal</th>
              <th style={styles.th}>Responsable</th>
              <th style={styles.th}>Motivo</th>
            </tr>
          </thead>
          <tbody>
            {movimientos.map((m, idx) => (
              <tr key={m.id_mov_inv} style={idx % 2 === 0 ? styles.trEven : styles.trOdd}>
                <td style={styles.td}>
                  {new Date(m.fecha_registro).toLocaleDateString('es-MX')}
                </td>
                <td style={styles.td}>
                  <span style={{
                    ...styles.badge,
                    ...(m.id_evento ? styles.badgeCatering : styles.badgeRestaurante)
                  }}>
                    {m.id_evento ? '🍽️ Catering' : '🍴 Restaurante'}
                  </span>
                </td>
                <td style={styles.td}>
                  <span style={{
                    ...styles.badge,
                    ...(m.tipo_operacion === 'entrada' ? styles.badgeEntrada : styles.badgeSalida)
                  }}>
                    {m.tipo_operacion === 'entrada' ? '↓ Entrada' : '↑ Salida'}
                  </span>
                </td>
                <td style={styles.td}>
                  <strong>{m.insumos?.nombre_item || 'N/A'}</strong>
                </td>
                <td style={styles.td}>{m.cantidad}</td>
                <td style={styles.td}>${m.costo_unitario?.toFixed(2) || '0.00'}</td>
                <td style={{...styles.td, fontWeight: '600', color: '#059669'}}>
                  ${(m.cantidad * (m.costo_unitario || 0)).toFixed(2)}
                </td>
                <td style={styles.td}>{m.responsable || 'N/A'}</td>
                <td style={styles.td}>{m.motivo || m.descripcion_incidente || 'N/A'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
