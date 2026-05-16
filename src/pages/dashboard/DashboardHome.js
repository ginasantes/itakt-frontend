import React from 'react';
import AdminWorkspace from '../ajustes/AdminWorkspace';
import CateringWorkspace from '../catering/CateringWorkspace';
import RestauranteWorkspace from '../restaurante/RestauranteWorkspace';

const RESTAURANTE_SECTIONS = new Set([
  'dashboard_restaurante',
  'almacen_compras_restaurante',
  'recetario_restaurante',
  'movimientos_restaurante'
]);

const SHARED_OPERATION_SECTIONS = new Set(['recetario_catering']);

const CATERING_SECTIONS = new Set([
  'dashboard_catering',
  'almacen_compras_catering',
  'nuevo_usuario_catering',
  'configuracion_catering',
  'eventos_catering',
  'cotizaciones_catering',
  'operacion_catering',
  'admin_precios_catering'
]);

const ADMIN_SECTIONS = new Set(['dashboard_admin', 'configuracion_admin', 'usuarios_admin', 'negocios_admin']);

export default function DashboardHome(props) {
  const { activeSection } = props;

  if (ADMIN_SECTIONS.has(activeSection)) {
    return <AdminWorkspace {...props} />;
  }

  if (CATERING_SECTIONS.has(activeSection)) {
    return <CateringWorkspace {...props} />;
  }

  if (SHARED_OPERATION_SECTIONS.has(activeSection)) {
    return <RestauranteWorkspace {...props} />;
  }

  if (RESTAURANTE_SECTIONS.has(activeSection)) {
    return <RestauranteWorkspace {...props} />;
  }

  return <RestauranteWorkspace {...props} />;
}
