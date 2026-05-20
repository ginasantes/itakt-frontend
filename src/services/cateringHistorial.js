// Historial y Exportación de Catering
import { supabase } from './supabaseClient';

/**
 * Obtener historial completo de un evento
 * Incluye: cotización, evento, tickets, movimientos
 */
export async function obtenerHistorialEventoCompleto({ eventId, businessId } = {}) {
  if (!eventId) return { error: 'Event ID requerido' };

  try {
    // 1. Obtener evento
    const { data: evento, error: eventoError } = await supabase
      .from('catering_eventos')
      .select('*')
      .eq('id_evento', eventId)
      .single();

    if (eventoError) return { error: eventoError.message };

    // 2. Obtener cotización relacionada
    const { data: cotizacion, error: cotError } = evento.id_cotizacion
      ? await supabase
          .from('catering_cotizaciones')
          .select('*')
          .eq('id_cotizacion', evento.id_cotizacion)
          .single()
      : { data: null, error: null };

    // 3. Obtener todos los tickets del evento
    const { data: tickets, error: ticketsError } = await supabase
      .from('catering_tickets')
      .select('*')
      .eq('id_evento', eventId)
      .order('fecha_registro', { ascending: true });

    if (ticketsError) return { error: ticketsError.message };

    // 4. Obtener movimientos de inventario del evento
    const { data: movimientos, error: movError } = await supabase
      .from('entradas_salidas')
      .select('*')
      .eq('id_evento', eventId)
      .order('fecha_registro', { ascending: true });

    if (movError) return { error: movError.message };

    // 5. Enriquecer movimientos con datos de insumos
    const movimientosEnriquecidos = await Promise.all(
      (movimientos || []).map(async (mov) => {
        const { data: insumo } = await supabase
          .from('insumos')
          .select('nombre_item, unidad_consumo')
          .eq('id_insumo', mov.id_insumo)
          .single();
        
        return {
          ...mov,
          nombre_insumo: insumo?.nombre_item || 'Insumo desconocido',
          unidad: insumo?.unidad_consumo || ''
        };
      })
    );

    return {
      data: {
        evento,
        cotizacion,
        tickets: tickets || [],
        movimientos: movimientosEnriquecidos || [],
        resumen: {
          total_estimado: evento?.total_estimado || 0,
          anticipo_pagado: evento?.anticipo_pagado || 0,
          saldo_pendiente: evento?.saldo_pendiente || 0,
          cantidad_tickets: tickets?.length || 0,
          cantidad_movimientos: movimientos?.length || 0,
          estado: evento?.estatus || 'desconocido',
          fecha_sincronizacion: new Date().toISOString()
        }
      },
      error: null
    };
  } catch (err) {
    return { error: err.message };
  }
}

/**
 * Exportar historial a JSON (para descarga)
 */
export function exportarHistorialJSON(historial, nombreEvento) {
  const contenido = JSON.stringify(historial, null, 2);
  const blob = new Blob([contenido], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `historial_${nombreEvento}_${new Date().toISOString().split('T')[0]}.json`;
  link.click();
}

/**
 * Exportar historial a CSV (Excel compatible)
 */
export function exportarHistorialCSV(historial, nombreEvento) {
  const { evento, tickets, movimientos, resumen } = historial;

  let csv = 'HISTORIAL DE CATERING\n';
  csv += `Evento: ${evento.nombre_evento}\n`;
  csv += `Cliente: ${evento.nombre_cliente}\n`;
  csv += `Teléfono: ${evento.telefono_cliente}\n`;
  csv += `Correo: ${evento.correo_cliente}\n`;
  csv += `Fecha Evento: ${evento.fecha_evento}\n`;
  csv += `Personas: ${evento.numero_personas}\n`;
  csv += `Estado: ${evento.estatus}\n`;
  csv += `Fecha Sincronización: ${resumen.fecha_sincronizacion}\n\n`;

  // Resumen Financiero
  csv += 'RESUMEN FINANCIERO\n';
  csv += `Total Estimado,${resumen.total_estimado}\n`;
  csv += `Anticipo Pagado,${resumen.anticipo_pagado}\n`;
  csv += `Saldo Pendiente,${resumen.saldo_pendiente}\n\n`;

  // Tickets
  csv += 'HISTORIAL DE TICKETS\n';
  csv += 'Fecha,Monto,Tipo Pago,Estado,Responsable\n';
  tickets.forEach((ticket) => {
    csv += `${ticket.fecha_registro},${ticket.monto_ticket},${ticket.tipo_pago},${ticket.estatus_ticket},${ticket.responsable}\n`;
  });
  csv += '\n';

  // Movimientos de Inventario
  csv += 'MOVIMIENTOS DE INVENTARIO\n';
  csv += 'Fecha,Insumo,Operación,Cantidad,Unidad,Costo Unitario,Costo Total\n';
  movimientos.forEach((mov) => {
    csv += `${mov.fecha_registro},${mov.nombre_insumo},${mov.tipo_operacion},${mov.cantidad},${mov.unidad},${mov.costo_unitario},${mov.cantidad * mov.costo_unitario}\n`;
  });

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `historial_${nombreEvento}_${new Date().toISOString().split('T')[0]}.csv`;
  link.click();
}

/**
 * Obtener datos para PDF
 */
export function generarReporteHTML(historial) {
  const { evento, tickets, movimientos, resumen } = historial;

  const totalMovimientos = movimientos.reduce((sum, mov) => 
    sum + (mov.cantidad * mov.costo_unitario), 0
  );

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <title>Historial ${evento.nombre_evento}</title>
      <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        .header { border-bottom: 2px solid #333; padding-bottom: 10px; margin-bottom: 20px; }
        .header h1 { margin: 0; }
        .section { margin-top: 20px; page-break-inside: avoid; }
        .section h2 { background-color: #f0f0f0; padding: 10px; }
        table { width: 100%; border-collapse: collapse; }
        th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
        th { background-color: #f0f0f0; font-weight: bold; }
        .resumen-box { background-color: #fffacd; padding: 10px; margin: 10px 0; }
        .resumen-item { display: flex; justify-content: space-between; margin: 5px 0; }
        .total { font-weight: bold; font-size: 1.1em; }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>HISTORIAL COMPLETO - CATERING</h1>
        <p><strong>Evento:</strong> ${evento.nombre_evento}</p>
        <p><strong>Cliente:</strong> ${evento.nombre_cliente} | Tel: ${evento.telefono_cliente} | Email: ${evento.correo_cliente}</p>
        <p><strong>Fecha Evento:</strong> ${evento.fecha_evento} | <strong>Personas:</strong> ${evento.numero_personas}</p>
        <p><strong>Estado:</strong> ${evento.estatus} | <strong>Lugar:</strong> ${evento.lugar_evento}</p>
        <p><strong>Dirección:</strong> ${evento.direccion_evento} | <strong>Referencia:</strong> ${evento.referencia_evento}</p>
        <p style="color: #888; font-size: 0.9em;"><strong>Sincronizado:</strong> ${resumen.fecha_sincronizacion}</p>
      </div>

      <div class="section">
        <h2>INFORMACIÓN FINANCIERA</h2>
        <div class="resumen-box">
          <div class="resumen-item">
            <span>Total Estimado:</span>
            <span class="total">$${resumen.total_estimado.toFixed(2)}</span>
          </div>
          <div class="resumen-item">
            <span>Anticipo Pagado:</span>
            <span class="total">$${resumen.anticipo_pagado.toFixed(2)}</span>
          </div>
          <div class="resumen-item">
            <span>Saldo Pendiente:</span>
            <span class="total">$${resumen.saldo_pendiente.toFixed(2)}</span>
          </div>
          <div class="resumen-item">
            <span>Cantidad de Tickets:</span>
            <span>${resumen.cantidad_tickets}</span>
          </div>
        </div>
      </div>

      <div class="section">
        <h2>HISTORIAL DE TICKETS (${resumen.cantidad_tickets})</h2>
        <table>
          <thead>
            <tr>
              <th>Fecha</th>
              <th>Monto</th>
              <th>Tipo Pago</th>
              <th>Estado</th>
              <th>Responsable</th>
            </tr>
          </thead>
          <tbody>
            ${tickets.map(ticket => `
              <tr>
                <td>${new Date(ticket.fecha_registro).toLocaleDateString('es-MX')}</td>
                <td>$${ticket.monto_ticket.toFixed(2)}</td>
                <td>${ticket.tipo_pago}</td>
                <td>${ticket.estatus_ticket}</td>
                <td>${ticket.responsable}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>

      <div class="section">
        <h2>MOVIMIENTOS DE INVENTARIO (${resumen.cantidad_movimientos})</h2>
        <table>
          <thead>
            <tr>
              <th>Fecha</th>
              <th>Insumo</th>
              <th>Operación</th>
              <th>Cantidad</th>
              <th>Unidad</th>
              <th>Costo Unitario</th>
              <th>Costo Total</th>
            </tr>
          </thead>
          <tbody>
            ${movimientos.map(mov => `
              <tr>
                <td>${new Date(mov.fecha_registro).toLocaleDateString('es-MX')}</td>
                <td>${mov.nombre_insumo}</td>
                <td>${mov.tipo_operacion}</td>
                <td>${mov.cantidad}</td>
                <td>${mov.unidad}</td>
                <td>$${mov.costo_unitario.toFixed(2)}</td>
                <td>$${(mov.cantidad * mov.costo_unitario).toFixed(2)}</td>
              </tr>
            `).join('')}
            <tr style="font-weight: bold;">
              <td colspan="6">TOTAL COSTO MOVIMIENTOS:</td>
              <td>$${totalMovimientos.toFixed(2)}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div style="margin-top: 30px; text-align: center; color: #888; font-size: 0.9em;">
        <p>Reporte generado: ${new Date().toLocaleString('es-MX')}</p>
        <p>Sistema iTAKT © 2026</p>
      </div>
    </body>
    </html>
  `;

  return html;
}

/**
 * Exportar a PDF (abre en ventana nueva para imprimir)
 */
export function exportarHistorialPDF(historial, nombreEvento) {
  const html = generarReporteHTML(historial);
  const ventana = window.open('', '_blank');
  ventana.document.write(html);
  ventana.document.close();
  // Usuario presiona Ctrl+P o usa botón imprimir
}

/**
 * Calcular totales y resumen
 */
export function calcularResumenHistorial(historial) {
  const { tickets, movimientos } = historial;
  
  const totalPagado = tickets.reduce((sum, t) => sum + (t.monto_ticket || 0), 0);
  const totalMovimientosInsumos = movimientos.reduce((sum, m) => 
    sum + (m.cantidad * m.costo_unitario), 0
  );

  return {
    totalTickets: tickets.length,
    totalPagado,
    totalMovimientos: movimientos.length,
    totalCostoInsumos: totalMovimientosInsumos,
    rentabilidad: totalPagado - totalCostoInsumos
  };
}
