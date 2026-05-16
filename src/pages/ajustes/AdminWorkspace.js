import React, { useEffect, useState } from 'react';
import { actualizarUsuarioAdmin, crearUsuarioSistema, eliminarUsuarioAdmin, habilitarNegocioParaUsuario } from '../../services/usuarios';
import { crearNegocioAdmin, obtenerPanelAdministracion } from '../../services/admin';
import { getSectionMeta } from '../../roles/menuConfig';
import { inferBusinessScopeFromProfile } from '../../utils/businessScope';
import { getRolePresentation } from '../../utils/rolePermissions';
import '../dashboard/DashboardHome.css';

function formatBusinessLabel(item) {
  const businessName = item?.nombre_sucursal ? `${item.nombre_negocio} - ${item.nombre_sucursal}` : item?.nombre_negocio || 'Sin nombre';
  const moduleLabel = item?.tiene_restaurante && item?.tiene_catering
    ? 'Ambos'
    : item?.tiene_catering || item?.tipo_negocio === 'catering'
      ? 'Catering'
      : 'Restaurante';
  const unitLabel = item?.tipo_unidad === 'sucursal' ? 'Sucursal' : 'Matriz';

  return `${businessName} · ${moduleLabel} · ${unitLabel}`;
}

function getBusinessParentOptions(negocios = []) {
  return negocios.filter((item) => !item.id_negocio_padre);
}

function matchesModuleFilter(item, moduleFilter) {
  if (moduleFilter === 'todos') {
    return true;
  }

  if (!item) {
    return false;
  }

  if (moduleFilter === 'restaurante') {
    return Boolean(item.tiene_restaurante || item.tipo_negocio === 'restaurante');
  }

  if (moduleFilter === 'catering') {
    return Boolean(item.tiene_catering || item.tipo_negocio === 'catering');
  }

  return true;
}

function userMatchesFilters(item, moduleFilter, businessFilter) {
  const businesses = item?.cat_negocios || [];
  const hasBusinessFilter = Boolean(businessFilter);

  if (hasBusinessFilter) {
    return businesses.some((business) => business.id_negocio === businessFilter);
  }

  if (moduleFilter === 'todos') {
    return true;
  }

  if (!businesses.length) {
    return item?.scope === 'Administración';
  }

  return businesses.some((business) => matchesModuleFilter(business, moduleFilter));
}

function buildFilteredSummary(usuarios, negocios) {
  const administradores = usuarios.filter((item) => item.scope === 'Administración').length;
  const usuariosRestaurante = usuarios.filter((item) => item.scope === 'Restaurante').length;
  const usuariosCatering = usuarios.filter((item) => item.scope === 'Catering').length;
  const negociosActivos = negocios.filter((item) => item.configuracion_activa).length;
  const negociosConRestaurante = negocios.filter((item) => item.tiene_restaurante || item.tipo_negocio === 'restaurante').length;
  const negociosConCatering = negocios.filter((item) => item.tiene_catering || item.tipo_negocio === 'catering').length;

  return {
    administradores,
    usuariosRestaurante,
    usuariosCatering,
    negociosActivos,
    negociosConRestaurante,
    negociosConCatering
  };
}

function getDefaultAdminUserForm() {
  return {
    scope: 'restaurante',
    tipoUsuario: 'trabajador',
    modoNegocio: 'existente',
    id_negocio: '',
    nombre_completo: '',
    correo: '',
    contrasena: '',
    telefono: '',
    nombre_negocio: ''
  };
}

function getDefaultBusinessForm() {
  return {
    scope: 'restaurante',
    tipoAlta: 'matriz',
    nombre_negocio: '',
    nombre_sucursal: '',
    id_negocio_padre: '',
    telefono: '',
    correo_electronico: ''
  };
}

function getAdminViewScope(user, isSuperAdminSession) {
  if (isSuperAdminSession) {
    return 'todos';
  }

  return inferBusinessScopeFromProfile({
    businessType: user?.business_type,
    roleName: user?.rol_nombre,
    email: user?.correo,
    fullName: user?.nombre_completo
  });
}

function getModuleOptions(viewScope, isSuperAdminSession) {
  if (isSuperAdminSession || viewScope === 'todos') {
    return [
      { key: 'todos', label: 'Todos' },
      { key: 'restaurante', label: 'Restaurante' },
      { key: 'catering', label: 'Catering' }
    ];
  }

  return [
    {
      key: viewScope,
      label: viewScope === 'catering' ? 'Catering' : 'Restaurante'
    }
  ];
}

export default function AdminWorkspace({ activeSection, user, onOpenMenu }) {
  const [panel, setPanel] = useState(null);
  const [error, setError] = useState('');
  const [userForm, setUserForm] = useState(getDefaultAdminUserForm());
  const [userMessage, setUserMessage] = useState('');
  const [userFormError, setUserFormError] = useState('');
  const [isSavingUser, setIsSavingUser] = useState(false);
  const [businessForm, setBusinessForm] = useState(getDefaultBusinessForm());
  const [businessMessage, setBusinessMessage] = useState('');
  const [businessFormError, setBusinessFormError] = useState('');
  const [isSavingBusiness, setIsSavingBusiness] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState(null);
  const copy = getSectionMeta(activeSection);
  const isUsersSection = activeSection === 'usuarios_admin';
  const isBusinessesSection = activeSection === 'negocios_admin';
  const isSettingsSection = activeSection === 'configuracion_admin';
  const showUserManagement = isUsersSection || isSettingsSection;
  const showBusinessManagement = isBusinessesSection || isSettingsSection;
  const isSuperAdminSession = (user?.rol_nombre || '').toLowerCase() === 'super_admin';
  const adminViewScope = getAdminViewScope(user, isSuperAdminSession);
  const moduleOptions = getModuleOptions(adminViewScope, isSuperAdminSession);
  const [moduleFilter, setModuleFilter] = useState(adminViewScope);
  const [businessFilter, setBusinessFilter] = useState('');

  useEffect(() => {
    setModuleFilter(adminViewScope);
    setBusinessFilter('');
  }, [adminViewScope]);

  async function cargarPanel() {
    const result = await obtenerPanelAdministracion({ actorEmail: user?.correo });

    if (result.error) {
      setError(result.error);
      setPanel(null);
      return null;
    }

    setError('');
    setPanel(result.data);
    return result.data;
  }

  useEffect(() => {
    let isMounted = true;

    async function cargar() {
      const result = await cargarPanel();
      if (!isMounted || !result) {
        return;
      }
    }

    cargar();
    return () => {
      isMounted = false;
    };
  }, []);

  const filteredBusinesses = (panel?.negocios || []).filter((item) => {
    if (businessFilter) {
      return item.id_negocio === Number(businessFilter);
    }

    return matchesModuleFilter(item, moduleFilter);
  });

  const filteredUsers = (panel?.usuarios || []).filter((item) => userMatchesFilters(item, moduleFilter, businessFilter ? Number(businessFilter) : null));
  const filteredSummary = buildFilteredSummary(filteredUsers, filteredBusinesses);
  const filteredUsersByScope = {
    administracion: filteredUsers.filter((item) => item.scope === 'Administración'),
    restaurante: filteredUsers.filter((item) => item.scope === 'Restaurante'),
    catering: filteredUsers.filter((item) => item.scope === 'Catering')
  };
  const filteredBusinessesByType = {
    restaurante: filteredBusinesses.filter((item) => item.tiene_restaurante || item.tipo_negocio === 'restaurante'),
    catering: filteredBusinesses.filter((item) => item.tiene_catering || item.tipo_negocio === 'catering')
  };
  const showRestaurantScope = isSuperAdminSession || moduleFilter === 'todos' || moduleFilter === 'restaurante';
  const showCateringScope = isSuperAdminSession || moduleFilter === 'todos' || moduleFilter === 'catering';

  const cards = panel
    ? [
        { title: 'Administradores', value: filteredSummary.administradores, detail: 'Control general del sistema' },
        ...(showRestaurantScope
          ? [{ title: 'Usuarios restaurante', value: filteredSummary.usuariosRestaurante, detail: 'Accesos ligados a restaurante' }]
          : []),
        ...(showCateringScope
          ? [{ title: 'Usuarios catering', value: filteredSummary.usuariosCatering, detail: 'Accesos ligados a catering' }]
          : []),
        { title: 'Negocios activos', value: filteredSummary.negociosActivos, detail: 'Configuraciones habilitadas' }
      ]
    : [];
  const selectedUser = panel?.usuarios?.find((item) => item.id_usuario === selectedUserId) || null;
  const selectedUserHasBusiness = Boolean(selectedUser?.cat_negocios?.[0]?.nombre_negocio || selectedUser?.cat_negocios?.[0]?.tipo_negocio);
  const availableBusinesses = (panel?.negocios || []).filter((item) => {
    if (userForm.scope === 'admin') {
      return false;
    }

    if (userForm.scope === 'catering') {
      return item.tiene_catering || item.tipo_negocio === 'catering';
    }

    if (userForm.scope === 'restaurante') {
      return item.tiene_restaurante || item.tipo_negocio === 'restaurante';
    }

    return true;
  });

  const allAssignableBusinesses = panel?.negocios || [];
  const parentBusinessOptions = getBusinessParentOptions(panel?.negocios || []);

  function resetUserEditor() {
    setSelectedUserId(null);
    setUserForm(getDefaultAdminUserForm());
  }

  function resetBusinessEditor() {
    setBusinessForm(getDefaultBusinessForm());
  }

  function handleSelectUser(item) {
    const linkedBusiness = item?.cat_negocios?.[0] || null;
    const scopeValue = item?.scope === 'Administrador' ? 'admin' : item?.scope?.toLowerCase() === 'catering' ? 'catering' : 'restaurante';
    const normalizedRole = (item?.roles?.nombre_rol || '').toLowerCase();
    const roleValue = normalizedRole.includes('admin')
      ? linkedBusiness?.id_negocio ? 'dueno' : 'administrador'
      : normalizedRole.includes('gerente')
        ? 'gerente'
      : normalizedRole.includes('due')
        ? 'dueno'
        : 'trabajador';

    setSelectedUserId(item.id_usuario);
    setUserForm({
      scope: scopeValue,
      tipoUsuario: roleValue,
      modoNegocio: linkedBusiness?.id_negocio ? 'existente' : 'nuevo',
      id_negocio: linkedBusiness?.id_negocio || '',
      nombre_completo: item.nombre_completo || '',
      correo: item.correo || '',
      contrasena: '',
      telefono: item.telefono || '',
      nombre_negocio: linkedBusiness?.nombre_negocio || ''
    });
    setUserMessage('Usuario cargado para edición.');
    setUserFormError('');
  }

  async function handleGuardarUsuario() {
    setUserMessage('');
    setUserFormError('');
    setIsSavingUser(true);

    const payload = {
      ...userForm,
      id_negocio: userForm.scope === 'admin'
        ? null
        : userForm.tipoUsuario === 'dueno' && userForm.modoNegocio === 'nuevo'
          ? null
          : userForm.id_negocio,
      tipoUsuario: userForm.scope === 'admin' ? 'administrador' : userForm.tipoUsuario
    };

    const result = selectedUserId
      ? await actualizarUsuarioAdmin({
          actorEmail: user?.correo,
          userId: selectedUserId,
          originalUser: selectedUser,
          ...payload
        })
      : await crearUsuarioSistema({
          actorEmail: user?.correo,
          ...payload
        });

    if (result.error) {
      setUserFormError(result.error);
      setIsSavingUser(false);
      return;
    }

    await cargarPanel();
    resetUserEditor();
    setUserMessage(selectedUserId ? 'Usuario actualizado correctamente.' : 'Usuario guardado correctamente desde administración.');
    setIsSavingUser(false);
  }

  async function handleEliminarUsuario() {
    if (!selectedUser) {
      setUserFormError('Selecciona un usuario antes de eliminar.');
      return;
    }

    if (!window.confirm(`Se eliminará el usuario ${selectedUser.nombre_completo}.`)) {
      return;
    }

    setUserMessage('');
    setUserFormError('');
    setIsSavingUser(true);

    const result = await eliminarUsuarioAdmin({
      actorEmail: user?.correo,
      userId: selectedUser.id_usuario,
      currentUserId: user.id_usuario,
      originalUser: selectedUser
    });

    if (result.error) {
      setUserFormError(result.error);
      setIsSavingUser(false);
      return;
    }

    await cargarPanel();
    resetUserEditor();
    setUserMessage('Usuario eliminado correctamente.');
    setIsSavingUser(false);
  }

  async function handleToggleBusinessModule(item, moduleKey, nextValue) {
    setBusinessMessage('');
    setBusinessFormError('');

    const result = await habilitarNegocioParaUsuario({
      actorEmail: user?.correo,
      businessId: item?.id_negocio,
      [moduleKey]: nextValue
    });

    if (result.error) {
      setBusinessFormError(result.error);
      return;
    }

    await cargarPanel();
    const moduleLabel = moduleKey === 'tiene_catering' ? 'Catering' : 'Restaurante';
    const statusLabel = nextValue ? 'habilitado' : 'inhabilitado';
    setBusinessMessage(`${moduleLabel} ${statusLabel} para ${formatBusinessLabel(item)}.`);
  }

  async function handleGuardarNegocio() {
    setBusinessMessage('');
    setBusinessFormError('');
    setIsSavingBusiness(true);

    const payload = {
      ...businessForm,
      id_negocio_padre: businessForm.tipoAlta === 'sucursal' ? businessForm.id_negocio_padre : null,
      nombre_sucursal: businessForm.tipoAlta === 'sucursal' ? businessForm.nombre_sucursal : null
    };

    const result = await crearNegocioAdmin({
      actorEmail: user?.correo,
      ...payload
    });

    if (result.error) {
      setBusinessFormError(result.error);
      setIsSavingBusiness(false);
      return;
    }

    await cargarPanel();
    resetBusinessEditor();
    setBusinessMessage(payload.tipoAlta === 'sucursal' ? 'Sucursal registrada correctamente.' : 'Negocio registrado correctamente.');
    setIsSavingBusiness(false);
  }

  return (
    <main className="dashboard-shell">
      <header className="hero-card">
        <button type="button" className="menu-button" onClick={onOpenMenu}>
          ⊞
        </button>
        <div>
          <p className="eyebrow">itakt | Administración</p>
          <h1>{copy.title}</h1>
          <p>{copy.description}</p>
        </div>
        <div className="hero-meta">
          <span>{user.rol_nombre}</span>
          <strong>Administración</strong>
        </div>
      </header>

      <section className="panel-card">
        <h2>Filtros administrativos</h2>
        <p>
          {isSuperAdminSession
            ? 'Filtra la vista por módulo o por negocio para trabajar restaurante, catering o una unidad específica.'
            : adminViewScope === 'catering'
              ? 'Esta administración está enfocada al modelo de catering y solo muestra ese alcance.'
              : 'Esta administración está enfocada al modelo de restaurante y solo muestra ese alcance.'}
        </p>
        {!isSuperAdminSession && (
          <div className="helper-note" style={{ marginTop: '12px' }}>
            La habilitación de módulos, alta global de negocios y cambios de restaurante/catering solo aparecen con sesión de super admin. Con el seed demo, entra con super@itakt.mx para ver esos botones.
          </div>
        )}
        <div className="selection-chip-grid">
          {moduleOptions.map((item) => (
            <button
              key={`admin-module-filter-${item.key}`}
              type="button"
              className={`selection-chip ${moduleFilter === item.key ? 'selected' : ''}`}
              onClick={() => {
                setModuleFilter(item.key);
                setBusinessFilter('');
              }}
            >
              {item.label}
            </button>
          ))}
        </div>
        <div className="form-grid-fields" style={{ marginTop: '16px' }}>
          <label className="field-span-2">
            <span>Negocio filtrado</span>
            <select
              value={businessFilter}
              onChange={(event) => setBusinessFilter(event.target.value)}
            >
              <option value="">Todos los negocios</option>
              {(panel?.negocios || [])
                .filter((item) => matchesModuleFilter(item, moduleFilter))
                .map((item) => (
                  <option key={`admin-filter-business-${item.id_negocio}`} value={item.id_negocio}>
                    {formatBusinessLabel(item)}
                  </option>
                ))}
            </select>
          </label>
        </div>
      </section>

      <section className="metric-grid">
        {cards.map((summary) => (
          <article className="metric-card" key={summary.title}>
            <span>{summary.title}</span>
            <strong>{summary.value}</strong>
            <small>{summary.detail}</small>
          </article>
        ))}
      </section>

      <section className="content-grid">
        <article className="panel-card">
          <h2>
            {isUsersSection
              ? 'Usuarios y permisos'
              : isSettingsSection
                ? 'Usuarios y permisos'
              : isSettingsSection
                ? 'Configuración del modelo'
                : 'Resumen administrativo'}
          </h2>
          <p>
            {isUsersSection
              ? 'Aquí vive solo la gestión de usuarios, roles y permisos del ámbito seleccionado.'
              : isSettingsSection
                ? 'Aquí puedes agregar usuarios, revisar permisos y gestionar la configuración del modelo activo.'
                : 'Resumen general de administración sin mezclar la configuración operativa de los negocios.'}
          </p>
          {error ? (
            <p className="panel-empty">No se pudo cargar administración: {error}</p>
          ) : !panel ? (
            <p className="panel-empty">Cargando administración...</p>
          ) : showUserManagement && !isSuperAdminSession ? (
            <div className="almacen-layout">
              <div className="almacen-subpanel">
                <div className="almacen-subpanel-header">
                  <h3>Acceso restringido</h3>
                  <span>Solo super admin administra usuarios centrales</span>
                </div>
                <div className="helper-note">
                  Tu sesión actual es {user?.rol_nombre || 'sin rol'}. Para editar usuarios, permisos o cambios globales desde administración central, entra con super@itakt.mx.
                </div>
                <p className="panel-empty">Con usuarios de negocio como admin o dueño, la operación sigue en su módulo propio y el alta permitida se enfoca en trabajadores del negocio activo.</p>
              </div>
            </div>
          ) : showUserManagement ? (
            <div className="almacen-layout">
              <div className="almacen-subpanel">
                <div className="almacen-subpanel-header">
                  <h3>{selectedUserId ? 'Editar usuario' : 'Alta central de usuarios'}</h3>
                  <span>{selectedUserId ? 'Solo administración puede editar o eliminar' : 'Administrador, restaurante o catering'}</span>
                </div>
                {(userMessage || userFormError) && (
                  <div className={`operation-banner ${userFormError ? 'error' : 'success'}`}>{userFormError || userMessage}</div>
                )}
                {selectedUserHasBusiness && (
                  <div className="helper-note">
                    Este usuario tiene negocio ligado. Puedes actualizar sus datos, pero no cambiarlo de ámbito ni dejar de ser dueño, y tampoco eliminarlo desde aquí.
                  </div>
                )}
                <div className="form-grid-fields">
                  <label>
                    <span>Ámbito</span>
                    <select
                      value={userForm.scope}
                      onChange={(event) =>
                        setUserForm((current) => ({
                          ...current,
                          scope: event.target.value,
                          id_negocio: '',
                          tipoUsuario: event.target.value === 'admin' ? 'administrador' : current.tipoUsuario === 'administrador' ? 'trabajador' : current.tipoUsuario
                        }))
                      }
                      disabled={selectedUserHasBusiness}
                    >
                      <option value="restaurante">Restaurante</option>
                      <option value="catering">Catering</option>
                      <option value="admin">Administración</option>
                    </select>
                  </label>
                  <label>
                    <span>Tipo de rol</span>
                    <select
                      value={userForm.scope === 'admin' ? 'administrador' : userForm.tipoUsuario}
                      onChange={(event) => setUserForm((current) => ({ ...current, tipoUsuario: event.target.value }))}
                      disabled={userForm.scope === 'admin' || selectedUserHasBusiness}
                    >
                      {userForm.scope === 'admin' ? (
                        <option value="administrador">Administrador</option>
                      ) : (
                        <>
                          <option value="trabajador">Trabajador</option>
                          <option value="gerente">Gerente</option>
                          <option value="dueno">Dueño</option>
                        </>
                      )}
                    </select>
                  </label>
                  {userForm.scope !== 'admin' && userForm.tipoUsuario === 'dueno' && (
                    <label>
                      <span>Alta del negocio</span>
                      <select
                        value={userForm.modoNegocio}
                        onChange={(event) => setUserForm((current) => ({
                          ...current,
                          modoNegocio: event.target.value,
                          id_negocio: event.target.value === 'nuevo' ? '' : current.id_negocio
                        }))}
                        disabled={selectedUserHasBusiness}
                      >
                        <option value="existente">Negocio existente</option>
                        <option value="nuevo">Negocio nuevo</option>
                      </select>
                    </label>
                  )}
                  <label>
                    <span>Nombre completo</span>
                    <input
                      value={userForm.nombre_completo}
                      onChange={(event) => setUserForm((current) => ({ ...current, nombre_completo: event.target.value }))}
                    />
                  </label>
                  <label>
                    <span>Correo</span>
                    <input
                      value={userForm.correo}
                      onChange={(event) => setUserForm((current) => ({ ...current, correo: event.target.value }))}
                    />
                  </label>
                  <label>
                    <span>Contraseña</span>
                    <input
                      type="text"
                      value={userForm.contrasena}
                      onChange={(event) => setUserForm((current) => ({ ...current, contrasena: event.target.value }))}
                    />
                  </label>
                  <label>
                    <span>Teléfono</span>
                    <input
                      value={userForm.telefono}
                      onChange={(event) => setUserForm((current) => ({ ...current, telefono: event.target.value }))}
                    />
                  </label>
                  {userForm.scope !== 'admin' && (userForm.tipoUsuario !== 'dueno' || userForm.modoNegocio === 'existente') && (
                    <label className="field-span-2">
                      <span>Negocio o sucursal asignada</span>
                      <select
                        value={userForm.id_negocio}
                        onChange={(event) => {
                          const selectedBusinessId = Number(event.target.value);
                          const selectedBusiness = allAssignableBusinesses.find((item) => item.id_negocio === selectedBusinessId);
                          const nextScope = selectedBusiness?.tiene_catering && !selectedBusiness?.tiene_restaurante
                            ? 'catering'
                            : selectedBusiness?.tiene_restaurante && !selectedBusiness?.tiene_catering
                              ? 'restaurante'
                              : userForm.scope;

                          setUserForm((current) => ({
                            ...current,
                            id_negocio: event.target.value,
                            scope: nextScope
                          }));
                        }}
                      >
                        <option value="">Selecciona negocio</option>
                        {allAssignableBusinesses.map((item) => (
                          <option key={`admin-business-${item.id_negocio}`} value={item.id_negocio}>
                            {formatBusinessLabel(item)}
                          </option>
                        ))}
                      </select>
                    </label>
                  )}
                  {userForm.scope !== 'admin' && userForm.tipoUsuario === 'dueno' && userForm.modoNegocio === 'nuevo' && (
                    <label className="field-span-2">
                      <span>Nombre del negocio</span>
                      <input
                        value={userForm.nombre_negocio}
                        onChange={(event) => setUserForm((current) => ({ ...current, nombre_negocio: event.target.value }))}
                        placeholder={userForm.scope === 'catering' ? 'Nombre del negocio catering' : 'Nombre del restaurante'}
                      />
                    </label>
                  )}
                </div>
                <div className="module-actions">
                  {selectedUserId && (
                    <button type="button" className="module-action-button" onClick={resetUserEditor} disabled={isSavingUser}>
                      Cancelar edición
                    </button>
                  )}
                  <button
                    type="button"
                    className="module-action-button success"
                    onClick={handleGuardarUsuario}
                    disabled={isSavingUser}
                  >
                    {isSavingUser ? 'Guardando...' : selectedUserId ? 'Guardar cambios' : 'Guardar usuario'}
                  </button>
                  <button
                    type="button"
                    className="module-action-button danger"
                    onClick={handleEliminarUsuario}
                    disabled={isSavingUser || !selectedUserId || selectedUserHasBusiness || selectedUser?.id_usuario === user.id_usuario}
                  >
                    Eliminar usuario
                  </button>
                </div>
              </div>

              <div className="almacen-subpanel">
                <div className="almacen-subpanel-header">
                  <h3>Todos los usuarios</h3>
                  <span>{filteredUsers.length} registros</span>
                </div>
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
                      {filteredUsers.map((item) => {
                        const roleInfo = getRolePresentation({
                          roleName: item.roles?.nombre_rol,
                          scope: item.scope
                        });

                        return (
                          <tr key={item.id_usuario} className={selectedUserId === item.id_usuario ? 'selected-row' : ''}>
                            <td>{item.nombre_completo}</td>
                            <td>{item.correo}</td>
                            <td>{roleInfo.label}</td>
                            <td>{roleInfo.description}</td>
                            <td>{roleInfo.permissions}</td>
                            <td>{item.telefono || 'Sin teléfono'}</td>
                            <td>
                              <button type="button" className="module-action-button" onClick={() => handleSelectUser(item)}>
                                Editar
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          ) : (
            <div className="almacen-layout">
              <div className="almacen-subpanel-grid">
                <div className="almacen-subpanel">
                  <div className="almacen-subpanel-header">
                    <h3>Usuarios dados de alta</h3>
                    <span>Por ámbito</span>
                  </div>
                  <div className="quick-list">
                    <div className="quick-item">
                      <div>
                        <strong>Administración</strong>
                        <span>{(filteredUsersByScope.administracion || []).map((item) => item.nombre_completo).join(', ') || 'Sin usuarios'}</span>
                      </div>
                      <em>{filteredSummary.administradores}</em>
                    </div>
                    <div className="quick-item">
                      <div>
                        <strong>Restaurante</strong>
                        <span>{(filteredUsersByScope.restaurante || []).map((item) => item.nombre_completo).join(', ') || 'Sin usuarios'}</span>
                      </div>
                      <em>{filteredSummary.usuariosRestaurante}</em>
                    </div>
                    {showCateringScope && (
                      <div className="quick-item">
                        <div>
                          <strong>Catering</strong>
                          <span>{(filteredUsersByScope.catering || []).map((item) => item.nombre_completo).join(', ') || 'Sin usuarios'}</span>
                        </div>
                        <em>{filteredSummary.usuariosCatering}</em>
                      </div>
                    )}
                  </div>
                </div>

                <div className="almacen-subpanel">
                  <div className="almacen-subpanel-header">
                    <h3>Negocios dados de alta</h3>
                    <span>{moduleFilter === 'catering' ? 'Vista de catering' : moduleFilter === 'restaurante' ? 'Vista de restaurante' : 'Restaurante y catering'}</span>
                  </div>
                  <div className="quick-list">
                    {showRestaurantScope && (
                      <div className="quick-item">
                        <div>
                          <strong>Restaurantes</strong>
                          <span>{(filteredBusinessesByType.restaurante || []).map((item) => formatBusinessLabel(item)).join(', ') || 'Sin restaurantes'}</span>
                        </div>
                        <em>{filteredBusinessesByType.restaurante?.length || 0}</em>
                      </div>
                    )}
                    {showCateringScope && (
                      <div className="quick-item">
                        <div>
                          <strong>Catering</strong>
                          <span>{(filteredBusinessesByType.catering || []).map((item) => formatBusinessLabel(item)).join(', ') || 'Sin catering'}</span>
                        </div>
                        <em>{filteredBusinessesByType.catering?.length || 0}</em>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="almacen-subpanel">
                <div className="almacen-subpanel-header">
                  <h3>Módulos por negocio</h3>
                  <span>Activa o desactiva restaurante y catering usando los mismos datos base del negocio</span>
                </div>
                {(businessMessage || businessFormError) && (
                  <div className={`operation-banner ${businessFormError ? 'error' : 'success'}`}>{businessFormError || businessMessage}</div>
                )}
                {filteredBusinesses.length ? (
                  <div className="mini-list compact-list">
                    {filteredBusinesses.map((item) => (
                      <div className="mini-item" key={`dashboard-business-module-${item.id_negocio}`}>
                        <strong>{formatBusinessLabel(item)}</strong>
                        <span>Restaurante: {item.tiene_restaurante ? 'Habilitado' : 'Inhabilitado'}</span>
                        <span>Catering: {item.tiene_catering ? 'Habilitado' : 'Inhabilitado'}</span>
                        <div className="module-actions">
                          <button
                            type="button"
                            className={`module-action-button ${item.tiene_restaurante ? 'danger' : 'success'}`}
                            onClick={() => handleToggleBusinessModule(item, 'tiene_restaurante', !item.tiene_restaurante)}
                          >
                            {item.tiene_restaurante ? 'Inhabilitar restaurante' : 'Habilitar restaurante'}
                          </button>
                          <button
                            type="button"
                            className={`module-action-button ${item.tiene_catering ? 'danger' : 'success'}`}
                            onClick={() => handleToggleBusinessModule(item, 'tiene_catering', !item.tiene_catering)}
                          >
                            {item.tiene_catering ? 'Inhabilitar catering' : 'Habilitar catering'}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="panel-empty">No hay negocios disponibles para habilitar módulos con el filtro actual.</p>
                )}
              </div>
            </div>
          )}
        </article>

        <article className="panel-card">
          <h2>{showBusinessManagement ? 'Configuración y negocios' : 'Accesos por ámbito'}</h2>
          <p>
            {showBusinessManagement
              ? 'Aquí se concentra la estructura del negocio, sus sucursales y la habilitación de módulos por modelo.'
              : 'Administrador ve todo; cada negocio revisa solo su propia configuración.'}
          </p>
          {error ? (
            <p className="panel-empty">No se pudo cargar administración: {error}</p>
          ) : !panel ? (
            <p className="panel-empty">Cargando administración...</p>
          ) : showBusinessManagement && !isSuperAdminSession ? (
            <div className="almacen-layout">
              <div className="almacen-subpanel">
                <div className="almacen-subpanel-header">
                  <h3>Acceso restringido</h3>
                  <span>Solo super admin registra matrices y sucursales</span>
                </div>
                <div className="helper-note">
                  Tu sesión actual es {user?.rol_nombre || 'sin rol'}. Para dar de alta negocios o cambiar módulos entre restaurante y catering, entra con super@itakt.mx.
                </div>
                <p className="panel-empty">Desde negocio solo se administra la operación del modelo actual; la estructura global vive aquí solo para super admin.</p>
              </div>
            </div>
          ) : showBusinessManagement ? (
            <div className="almacen-layout">
              <div className="almacen-subpanel">
                <div className="almacen-subpanel-header">
                  <h3>{isSettingsSection ? 'Configuración estructural' : 'Alta de negocio o sucursal'}</h3>
                  <span>{isSettingsSection ? 'Negocios, sucursales y módulos del modelo' : 'Crea matriz nueva o una sucursal hija'}</span>
                </div>
                {(businessMessage || businessFormError) && (
                  <div className={`operation-banner ${businessFormError ? 'error' : 'success'}`}>{businessFormError || businessMessage}</div>
                )}
                <div className="helper-note">
                  Primero registras la unidad del negocio. Después puedes dar de alta al dueño, encargado o trabajador y asignarlo a esa matriz o sucursal.
                </div>
                <div className="form-grid-fields">
                  <label>
                    <span>Módulo</span>
                    <select
                      value={businessForm.scope}
                      onChange={(event) => setBusinessForm((current) => ({ ...current, scope: event.target.value }))}
                      disabled={businessForm.tipoAlta === 'sucursal'}
                    >
                      <option value="restaurante">Restaurante</option>
                      <option value="catering">Catering</option>
                    </select>
                  </label>
                  <label>
                    <span>Tipo de alta</span>
                    <select
                      value={businessForm.tipoAlta}
                      onChange={(event) => setBusinessForm((current) => ({
                        ...current,
                        tipoAlta: event.target.value,
                        nombre_sucursal: '',
                        id_negocio_padre: ''
                      }))}
                    >
                      <option value="matriz">Negocio principal</option>
                      <option value="sucursal">Sucursal</option>
                    </select>
                  </label>
                  {businessForm.tipoAlta === 'matriz' ? (
                    <label className="field-span-2">
                      <span>Nombre del negocio</span>
                      <input
                        value={businessForm.nombre_negocio}
                        onChange={(event) => setBusinessForm((current) => ({ ...current, nombre_negocio: event.target.value }))}
                        placeholder={businessForm.scope === 'catering' ? 'Ej. Esmeralda Eventos' : 'Ej. Los Plebes'}
                      />
                    </label>
                  ) : (
                    <>
                      <label className="field-span-2">
                        <span>Matriz base</span>
                        <select
                          value={businessForm.id_negocio_padre}
                          onChange={(event) => {
                            const selectedBusinessId = Number(event.target.value);
                            const selectedBusiness = parentBusinessOptions.find((item) => item.id_negocio === selectedBusinessId);
                            const nextScope = selectedBusiness?.tiene_catering && !selectedBusiness?.tiene_restaurante
                              ? 'catering'
                              : 'restaurante';

                            setBusinessForm((current) => ({
                              ...current,
                              id_negocio_padre: event.target.value,
                              scope: nextScope
                            }));
                          }}
                        >
                          <option value="">Selecciona matriz</option>
                          {parentBusinessOptions.map((item) => (
                            <option key={`admin-parent-business-${item.id_negocio}`} value={item.id_negocio}>
                              {formatBusinessLabel(item)}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="field-span-2">
                        <span>Nombre de la sucursal</span>
                        <input
                          value={businessForm.nombre_sucursal}
                          onChange={(event) => setBusinessForm((current) => ({ ...current, nombre_sucursal: event.target.value }))}
                          placeholder="Ej. Sucursal Norte"
                        />
                      </label>
                    </>
                  )}
                  <label>
                    <span>Correo del negocio</span>
                    <input
                      value={businessForm.correo_electronico}
                      onChange={(event) => setBusinessForm((current) => ({ ...current, correo_electronico: event.target.value }))}
                      placeholder={businessForm.tipoAlta === 'sucursal' ? 'ej. norte@losplebes.com.mx' : 'ej. contacto@losplebes.com.mx'}
                    />
                  </label>
                  <label>
                    <span>Teléfono</span>
                    <input
                      value={businessForm.telefono}
                      onChange={(event) => setBusinessForm((current) => ({ ...current, telefono: event.target.value }))}
                    />
                  </label>
                </div>
                <div className="module-actions">
                  <button
                    type="button"
                    className="module-action-button success"
                    onClick={handleGuardarNegocio}
                    disabled={isSavingBusiness}
                  >
                    {isSavingBusiness ? 'Guardando...' : businessForm.tipoAlta === 'sucursal' ? 'Guardar sucursal' : 'Guardar negocio'}
                  </button>
                </div>
              </div>

              <div className="almacen-subpanel">
                <div className="almacen-subpanel-header">
                  <h3>{isSettingsSection ? 'Negocios y módulos activos' : 'Negocios configurados'}</h3>
                  <span>{filteredBusinesses.length} registros</span>
                </div>
                <div className="mini-list compact-list">
                  {filteredBusinesses.map((item) => (
                    <div className="mini-item" key={item.id_negocio}>
                      <strong>{formatBusinessLabel(item)}</strong>
                      <span>{item.id_negocio_padre ? `Depende de la matriz ${item.id_negocio_padre}` : 'Matriz principal'}</span>
                      <span>{item.configuracion_activa ? 'Activo' : 'Inactivo'}</span>
                      <span>Restaurante: {item.tiene_restaurante ? 'Habilitado' : 'Inhabilitado'}</span>
                      <span>Catering: {item.tiene_catering ? 'Habilitado' : 'Inhabilitado'}</span>
                      <div className="module-actions">
                        <button
                          type="button"
                          className={`module-action-button ${item.tiene_restaurante ? 'danger' : 'success'}`}
                          onClick={() => handleToggleBusinessModule(item, 'tiene_restaurante', !item.tiene_restaurante)}
                        >
                          {item.tiene_restaurante ? 'Inhabilitar restaurante' : 'Habilitar restaurante'}
                        </button>
                        <button
                          type="button"
                          className={`module-action-button ${item.tiene_catering ? 'danger' : 'success'}`}
                          onClick={() => handleToggleBusinessModule(item, 'tiene_catering', !item.tiene_catering)}
                        >
                          {item.tiene_catering ? 'Inhabilitar catering' : 'Habilitar catering'}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="quick-list">
              <div className="quick-item">
                <div>
                  <strong>Administrador</strong>
                  <span>Puede ver todos los usuarios y crear accesos de cualquier ámbito.</span>
                </div>
                <em>{filteredSummary.administradores}</em>
              </div>
              {showRestaurantScope && (
                <div className="quick-item">
                  <div>
                    <strong>Restaurante</strong>
                    <span>Solo revisa usuarios y configuración del ámbito restaurante.</span>
                  </div>
                  <em>{filteredSummary.usuariosRestaurante}</em>
                </div>
              )}
              {showCateringScope && (
                <div className="quick-item">
                  <div>
                    <strong>Catering</strong>
                    <span>Solo revisa usuarios y configuración del ámbito catering.</span>
                  </div>
                  <em>{filteredSummary.usuariosCatering}</em>
                </div>
              )}
            </div>
          )}
        </article>
      </section>
    </main>
  );
}
