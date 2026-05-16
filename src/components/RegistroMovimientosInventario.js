import React, { useState, useEffect } from 'react';
import { supabase } from '../services/supabaseClient';
import './RegistroMovimientosInventario.css';

/**
 * Componente para registrar movimientos de inventario:
 * - Daños (silla rota)
 * - Mermas (jitomate descompuesto)
 * - Reposiciones (reemplazo de equipo)
 */
export default function RegistroMovimientosInventario({ businessId, userId, onMovimientoRegistrado }) {
  const [tipoMovimiento, setTipoMovimiento] = useState('dano');
  const [insumoSeleccionado, setInsumoSeleccionado] = useState(null);
  const [cantidad, setCantidad] = useState(1);
  const [responsable, setResponsable] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [motivo, setMotivo] = useState('');
  const [eventos, setEventos] = useState([]);
  const [eventoSeleccionado, setEventoSeleccionado] = useState(null);
  const [insumos, setInsumos] = useState([]);
  const [cargandoInsumos, setCargandoInsumos] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [mensaje, setMensaje] = useState('');
  const [error, setError] = useState('');
  
  // Estados para historial
  const [historialMovimientos, setHistorialMovimientos] = useState([]);
  const [cargandoHistorial, setCargandoHistorial] = useState(false);
  const [mostrarHistorial, setMostrarHistorial] = useState(false);

  // Cargar insumos y equipos
  useEffect(() => {
    cargarInsumos();
    cargarEventos();
  }, [businessId]);

  async function cargarInsumos() {
    setCargandoInsumos(true);
    try {
      const { data, error } = await supabase
        .from('insumos')
        .select('id_insumo, nombre_item, id_subcategoria, unidad_consumo')
        .eq('id_negocio', businessId)
        .order('nombre_item');

      if (error) throw error;

      // Separar insumos de equipos
      const datosFormateados = data?.map(item => ({
        ...item,
        tipo: [15, 16, 17].includes(item.id_subcategoria) ? 'Equipo' : 'Insumo'
      })) || [];

      setInsumos(datosFormateados);
    } catch (err) {
      console.error('Error cargando insumos:', err);
      setError('No se pudieron cargar los insumos');
    } finally {
      setCargandoInsumos(false);
    }
  }

  async function cargarEventos() {
    try {
      const { data, error } = await supabase
        .from('catering_eventos')
        .select('id_evento, nombre_evento, estatus_evento')
        .eq('id_negocio', businessId)
        .in('estatus_evento', ['confirmado', 'operando'])
        .order('nombre_evento');

      if (error) throw error;
      setEventos(data || []);
    } catch (err) {
      console.error('Error cargando eventos:', err);
    }
  }

  // Cargar historial de movimientos para un insumo
  async function cargarHistorialMovimientos(id_insumo) {
    if (!id_insumo) {
      setHistorialMovimientos([]);
      return;
    }

    setCargandoHistorial(true);
    try {
      const { data, error } = await supabase
        .from('entradas_salidas')
        .select(`
          id_entrad_salida,
          id_insumo,
          tipo_movimiento_detalle,
          cantidad,
          id_chef,
          descripcion_incidente,
          fecha_mov,
          observaciones
        `)
        .eq('id_negocio', businessId)
        .eq('id_insumo', id_insumo)
        .in('tipo_movimiento_detalle', ['Daño', 'Merma', 'Reposición'])
        .order('fecha_mov', { ascending: false })
        .limit(50);

      if (error) throw error;
      setHistorialMovimientos(data || []);
    } catch (err) {
      console.error('Error cargando historial:', err);
      setHistorialMovimientos([]);
    } finally {
      setCargandoHistorial(false);
    }
  }

  async function handleRegistrarMovimiento() {
    setMensaje('');
    setError('');

    // Validaciones
    if (!insumoSeleccionado) {
      setError('Selecciona un insumo o equipo');
      return;
    }
    if (!cantidad || cantidad <= 0) {
      setError('La cantidad debe ser mayor a 0');
      return;
    }
    if (!responsable.trim()) {
      setError('Debes indicar quién registra el movimiento');
      return;
    }
    if (!descripcion.trim() && tipoMovimiento !== 'entrada') {
      setError('Describe qué pasó (ejemplo: "Se rompió la pata")');
      return;
    }

    setGuardando(true);

    try {
      let resultado;

      switch (tipoMovimiento) {
        case 'dano':
          resultado = await supabase.rpc('admin_registrar_dano', {
            p_id_negocio: businessId,
            p_id_insumo: insumoSeleccionado.id_insumo,
            p_cantidad: cantidad,
            p_responsable: responsable,
            p_descripcion: descripcion,
            p_motivo: motivo || 'Producto/Equipo dañado'
          });
          break;

        case 'merma':
          resultado = await supabase.rpc('admin_registrar_merma', {
            p_id_negocio: businessId,
            p_id_insumo: insumoSeleccionado.id_insumo,
            p_cantidad: cantidad,
            p_responsable: responsable,
            p_causa: motivo || 'Spoilage',
            p_descripcion: descripcion
          });
          break;

        case 'reposicion':
          resultado = await supabase.rpc('admin_registrar_reposicion_equipo', {
            p_id_negocio: businessId,
            p_id_insumo: insumoSeleccionado.id_insumo,
            p_cantidad_reposicion: cantidad,
            p_responsable: responsable,
            p_descripcion_rotura: descripcion,
            p_id_evento: eventoSeleccionado?.id_evento || null
          });
          break;

        default:
          setError('Tipo de movimiento no válido');
          setGuardando(false);
          return;
      }

      if (resultado.error) {
        throw resultado.error;
      }

      const data = resultado.data;
      if (data?.success === false) {
        throw new Error(data.error);
      }

      setMensaje(`✅ ${getTituloMovimiento()} registrado exitosamente`);

      // Limpiar formulario
      setInsumoSeleccionado(null);
      setCantidad(1);
      setResponsable('');
      setDescripcion('');
      setMotivo('');
      setEventoSeleccionado(null);

      // Callback opcional
      if (onMovimientoRegistrado) {
        onMovimientoRegistrado(data);
      }

      // Limpiar mensaje después de 3 segundos
      setTimeout(() => setMensaje(''), 3000);
    } catch (err) {
      console.error('Error registrando movimiento:', err);
      setError(err.message || 'Error al registrar el movimiento');
    } finally {
      setGuardando(false);
    }
  }

  function getTituloMovimiento() {
    switch (tipoMovimiento) {
      case 'dano':
        return 'Daño';
      case 'merma':
        return 'Merma';
      case 'reposicion':
        return 'Reposición';
      default:
        return 'Movimiento';
    }
  }

  return (
    <div className="registro-movimientos-container">
      <h2>📋 Registrar Movimiento de Inventario</h2>

      {/* Selector de tipo de movimiento */}
      <div className="form-group">
        <label>¿Qué tipo de movimiento?</label>
        <div className="tipo-movimiento-buttons">
          <button
            className={`btn-tipo ${tipoMovimiento === 'dano' ? 'activo' : ''}`}
            onClick={() => setTipoMovimiento('dano')}
          >
            🔴 Daño<br /><small>Equipo roto o defectuoso</small>
          </button>
          <button
            className={`btn-tipo ${tipoMovimiento === 'merma' ? 'activo' : ''}`}
            onClick={() => setTipoMovimiento('merma')}
          >
            ⚠️ Merma<br /><small>Spoilage o descomposición</small>
          </button>
          <button
            className={`btn-tipo ${tipoMovimiento === 'reposicion' ? 'activo' : ''}`}
            onClick={() => setTipoMovimiento('reposicion')}
          >
            🔄 Reposición<br /><small>Reemplazo de equipo</small>
          </button>
        </div>
      </div>

      {/* Selector de insumo/equipo */}
      <div className="form-group">
        <label>¿Cuál es el {tipoMovimiento === 'reposicion' ? 'equipo' : 'insumo'}?</label>
        <select
          value={insumoSeleccionado?.id_insumo || ''}
          onChange={(e) => {
            const item = insumos.find(i => i.id_insumo === parseInt(e.target.value));
            setInsumoSeleccionado(item);
            // Cargar historial del insumo seleccionado
            if (item) {
              cargarHistorialMovimientos(item.id_insumo);
            }
          }}
          disabled={cargandoInsumos}
        >
          <option value="">
            {cargandoInsumos ? 'Cargando...' : 'Selecciona un insumo'}
          </option>
          {insumos.map(item => (
            <option key={item.id_insumo} value={item.id_insumo}>
              {item.tipo === 'Equipo' ? '⚙️' : '📦'} {item.nombre_item} ({item.tipo})
            </option>
          ))}
        </select>
      </div>

      {/* Cantidad afectada */}
      <div className="form-group">
        <label>Cantidad afectada {insumoSeleccionado?.unidad_consumo ? `(${insumoSeleccionado.unidad_consumo})` : ''}</label>
        <input
          type="number"
          min="0.001"
          step="0.001"
          value={cantidad}
          onChange={(e) => setCantidad(parseFloat(e.target.value))}
          placeholder="Ej: 1 (si 1 silla de 10)"
        />
      </div>

      {/* Responsable */}
      <div className="form-group">
        <label>¿Quién registra esto? (Nombre o rol)</label>
        <input
          type="text"
          value={responsable}
          onChange={(e) => setResponsable(e.target.value)}
          placeholder="Ej: Chef Juan, Mesero María"
        />
      </div>

      {/* Descripción (qué pasó) */}
      <div className="form-group">
        <label>Descripción de qué pasó</label>
        <textarea
          value={descripcion}
          onChange={(e) => setDescripcion(e.target.value)}
          placeholder={
            tipoMovimiento === 'dano'
              ? 'Ej: Se rompió la pata, el vidrio se quiebró'
              : tipoMovimiento === 'merma'
              ? 'Ej: Se descompuso por falta de refrigeración, luz se fue'
              : 'Ej: Silla rota reemplazada por nueva del lote'
          }
          rows="3"
        />
      </div>

      {/* Motivo específico (para mermas) */}
      {tipoMovimiento === 'merma' && (
        <div className="form-group">
          <label>¿Cuál fue la causa?</label>
          <select value={motivo} onChange={(e) => setMotivo(e.target.value)}>
            <option value="">Selecciona causa</option>
            <option value="Falla eléctrica">⚡ Falla eléctrica</option>
            <option value="Temperatura">🌡️ Temperatura inadecuada</option>
            <option value="Expiración">📅 Fecha de expiración</option>
            <option value="Contaminación">🦠 Contaminación</option>
            <option value="Golpe">💥 Golpe o impacto</option>
            <option value="Almacenamiento">📦 Problemas de almacenamiento</option>
            <option value="Plagas">🐭 Plagas</option>
            <option value="Otro">❓ Otro</option>
          </select>
        </div>
      )}

      {/* Evento relacionado (para reposiciones) */}
      {tipoMovimiento === 'reposicion' && eventos.length > 0 && (
        <div className="form-group">
          <label>¿En cuál evento ocurrió? (Opcional)</label>
          <select
            value={eventoSeleccionado?.id_evento || ''}
            onChange={(e) => {
              const evt = eventos.find(e => e.id_evento === parseInt(e.target.value));
              setEventoSeleccionado(evt);
            }}
          >
            <option value="">Sin evento relacionado</option>
            {eventos.map(evento => (
              <option key={evento.id_evento} value={evento.id_evento}>
                {evento.nombre_evento}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Mensajes */}
      {error && <div className="alert alert-error">{error}</div>}
      {mensaje && <div className="alert alert-success">{mensaje}</div>}

      {/* Botón guardar */}
      <button
        className="btn-primary"
        onClick={handleRegistrarMovimiento}
        disabled={guardando || !insumoSeleccionado}
      >
        {guardando ? '⏳ Guardando...' : `✅ Registrar ${getTituloMovimiento()}`}
      </button>

      {/* SECCIÓN DE HISTORIAL */}
      {insumoSeleccionado && (
        <div className="historial-section">
          <button
            type="button"
            className="btn-historial"
            onClick={() => setMostrarHistorial(!mostrarHistorial)}
          >
            {mostrarHistorial ? '▼' : '▶'} 📊 Historial de Movimientos ({historialMovimientos.length})
          </button>

          {mostrarHistorial && (
            <div className="historial-container">
              {cargandoHistorial ? (
                <p className="loading">⏳ Cargando historial...</p>
              ) : historialMovimientos.length === 0 ? (
                <p className="empty">No hay movimientos registrados para {insumoSeleccionado.nombre_item}</p>
              ) : (
                <div className="historial-table-wrapper">
                  <table className="historial-table">
                    <thead>
                      <tr>
                        <th>Fecha/Hora</th>
                        <th>Tipo</th>
                        <th>Cantidad</th>
                        <th>Responsable</th>
                        <th>Descripción</th>
                      </tr>
                    </thead>
                    <tbody>
                      {historialMovimientos.map(mov => (
                        <tr key={mov.id_entrad_salida}>
                          <td className="fecha">{new Date(mov.fecha_mov).toLocaleDateString('es-MX', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</td>
                          <td className={`tipo tipo-${mov.tipo_movimiento_detalle?.toLowerCase()}`}>
                            {mov.tipo_movimiento_detalle === 'Daño' && '🔴'}
                            {mov.tipo_movimiento_detalle === 'Merma' && '⚠️'}
                            {mov.tipo_movimiento_detalle === 'Reposición' && '🔄'}
                            {' '}{mov.tipo_movimiento_detalle}
                          </td>
                          <td className="cantidad">{mov.cantidad}</td>
                          <td className="responsable">{mov.id_chef || 'Sistema'}</td>
                          <td className="descripcion">{mov.descripcion_incidente || mov.observaciones || '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
