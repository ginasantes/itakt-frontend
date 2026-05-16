import React, { useState, useEffect } from 'react';
import { supabase } from '../services/supabaseClient';
import './AdminEquiposPropios.css';

export default function AdminEquiposPropios({ businessId, userId }) {
  const [equipos, setEquipos] = useState([]);
  const [editando, setEditando] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [mensaje, setMensaje] = useState('');

  useEffect(() => {
    cargarEquipos();
  }, [businessId]);

  async function cargarEquipos() {
    setCargando(true);
    try {
      const { data, error } = await supabase
        .from('insumos')
        .select('id_insumo, nombre_item, precio_unitario, unidad_consumo')
        .eq('id_negocio', businessId)
        .in('id_subcategoria', [15, 16, 17])
        .order('nombre_item');

      if (error) throw error;
      setEquipos(data || []);
    } catch (err) {
      console.error('Error cargando equipos:', err);
      setMensaje('❌ Error cargando equipos');
    } finally {
      setCargando(false);
    }
  }

  async function guardarPrecio(id_insumo, precio_nuevo) {
    if (!precio_nuevo || parseFloat(precio_nuevo) < 0) {
      setMensaje('❌ Precio inválido');
      return;
    }

    setGuardando(true);
    try {
      const { data, error } = await supabase
        .from('insumos')
        .update({ precio_unitario: parseFloat(precio_nuevo) })
        .eq('id_insumo', id_insumo)
        .select();

      if (error) throw error;
      
      // Actualizar localmente
      setEquipos(prev => prev.map(e => 
        e.id_insumo === id_insumo 
          ? { ...e, precio_unitario: parseFloat(precio_nuevo) }
          : e
      ));
      setEditando(null);
      setMensaje('✅ Precio guardado exitosamente');
      setTimeout(() => setMensaje(''), 3000);
    } catch (err) {
      console.error('Error guardando precio:', err);
      setMensaje('❌ Error guardando precio');
    } finally {
      setGuardando(false);
    }
  }

  if (cargando) return <div className="admin-equipos-loading">Cargando equipos...</div>;

  return (
    <div className="admin-equipos-container">
      <h3>⚙️ Equipos Propios - Gestión de Precios</h3>
      
      {mensaje && <div className={`admin-equipos-mensaje ${mensaje.includes('✅') ? 'success' : 'error'}`}>{mensaje}</div>}
      
      {equipos.length === 0 ? (
        <p className="admin-equipos-vacio">No hay equipos registrados</p>
      ) : (
        <div className="admin-equipos-tabla-wrapper">
          <table className="equipos-table">
            <thead>
              <tr>
                <th>Nombre del Equipo</th>
                <th>Unidad</th>
                <th>Precio Unitario ($)</th>
                <th>Acción</th>
              </tr>
            </thead>
            <tbody>
              {equipos.map(equipo => (
                <tr key={equipo.id_insumo}>
                  <td className="nombre-cell">{equipo.nombre_item}</td>
                  <td className="unidad-cell">{equipo.unidad_consumo || 'unidad'}</td>
                  <td className="precio-cell">
                    {editando === equipo.id_insumo ? (
                      <input 
                        type="number" 
                        defaultValue={equipo.precio_unitario || 0}
                        step="0.01"
                        min="0"
                        id={`precio-input-${equipo.id_insumo}`}
                        className="precio-input"
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            guardarPrecio(equipo.id_insumo, e.target.value);
                          }
                        }}
                        autoFocus
                      />
                    ) : (
                      <span className="precio-valor">${(equipo.precio_unitario || 0).toFixed(2)}</span>
                    )}
                  </td>
                  <td className="accion-cell">
                    {editando === equipo.id_insumo ? (
                      <div className="botones-edicion">
                        <button 
                          className="btn-guardar"
                          onClick={() => {
                            const input = document.getElementById(`precio-input-${equipo.id_insumo}`);
                            guardarPrecio(equipo.id_insumo, input.value);
                          }}
                          disabled={guardando}
                        >
                          ✅ Guardar
                        </button>
                        <button 
                          className="btn-cancelar"
                          onClick={() => setEditando(null)}
                          disabled={guardando}
                        >
                          ❌ Cancelar
                        </button>
                      </div>
                    ) : (
                      <button 
                        className="btn-editar"
                        onClick={() => setEditando(equipo.id_insumo)}
                      >
                        ✏️ Editar
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
