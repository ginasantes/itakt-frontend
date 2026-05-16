import { getRolePresentation } from '../utils/rolePermissions';

export default function BusinessUsersTable({
  title,
  subtitle,
  emptyMessage,
  users,
  scope,
  actionLabel,
  onAction,
  isActionDisabled
}) {
  return (
    <div className="almacen-subpanel configuracion-role-panel">
      <div className="almacen-subpanel-header">
        <h3>{title}</h3>
        <span>{users.length} registros</span>
      </div>
      {subtitle ? <p className="configuracion-role-copy">{subtitle}</p> : null}
      <div className="recetario-table-wrap">
        <table className="recetario-table">
          <thead>
            <tr>
              <th>Nombre</th>
              <th>Correo</th>
              <th>Rol visible</th>
              <th>Descripción</th>
              <th>Permisos</th>
              <th>Teléfono</th>
              <th>Acción</th>
            </tr>
          </thead>
          <tbody>
            {users.length ? users.map((item) => {
              const roleInfo = getRolePresentation({
                roleName: item.roles?.nombre_rol,
                scope: item.scope || scope
              });

              return (
                <tr key={`${scope}-${item.id_usuario}`}>
                  <td>{item.nombre_completo}</td>
                  <td>{item.correo}</td>
                  <td>{roleInfo.label}</td>
                  <td>{roleInfo.description}</td>
                  <td>{roleInfo.permissions}</td>
                  <td>{item.telefono || 'Sin teléfono'}</td>
                  <td>
                    <button
                      type="button"
                      className="module-action-button danger"
                      onClick={() => onAction(item)}
                      disabled={Boolean(isActionDisabled?.(item))}
                    >
                      {actionLabel}
                    </button>
                  </td>
                </tr>
              );
            }) : (
              <tr>
                <td colSpan="7" className="panel-empty">{emptyMessage}</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}