import React from 'react';
import './Sidebar.css';
import { getInitialSectionKey, getMenuForUser } from '../roles/menuConfig';

export default function Sidebar({ activeKey, isOpen, onClose, onSelect, onLogout, onSwitchBusiness, user }) {
  const sections = React.useMemo(() => getMenuForUser(user), [user]);
  const [openSections, setOpenSections] = React.useState(() => {
    const nextState = {};
    sections.forEach((section) => {
      nextState[section.key] = Boolean(section.defaultOpen);
    });
    return nextState;
  });

  React.useEffect(() => {
    const nextState = {};
    sections.forEach((section) => {
      nextState[section.key] = Boolean(section.defaultOpen);
    });
    setOpenSections(nextState);
  }, [sections]);

  React.useEffect(() => {
    if (!activeKey) {
      onSelect(getInitialSectionKey(user));
    }
  }, [activeKey, onSelect, user]);

  const toggleSection = (sectionKey) => {
    setOpenSections((current) => ({
      ...current,
      [sectionKey]: !current[sectionKey]
    }));
  };

  return (
    <>
      <div className={`sidebar-backdrop ${isOpen ? 'is-open' : ''}`} onClick={onClose} />
      <aside className={`sidebar ${isOpen ? 'is-open' : ''}`}>
        <div className="sidebar-brand-row">
          <div className="sidebar-brand">
            <img src="/logo.png" alt="ITakt" />
          </div>
          <button type="button" className="sidebar-close" onClick={onClose} aria-label="Cerrar menu">
            ✕
          </button>
        </div>

        {user?.business_options?.length > 1 ? (
          <div className="sidebar-business-switcher">
            <label htmlFor="sidebar-business-select">Sucursal activa</label>
            <select
              id="sidebar-business-select"
              value={user.business_id || ''}
              onChange={(event) => {
                if (typeof onSwitchBusiness === 'function') {
                  onSwitchBusiness(event.target.value);
                }
              }}
            >
              {user.business_options.map((item) => (
                <option key={item.id_negocio} value={item.id_negocio}>
                  {item.nombre_visible || item.nombre_negocio} · {item.tipo_negocio}
                </option>
              ))}
            </select>
          </div>
        ) : null}

        {sections.map((section) => (
          <section className="sidebar-section" key={section.title}>
            <button type="button" className="sidebar-section-toggle" onClick={() => toggleSection(section.key)}>
              <span className="sidebar-section-heading">
                <span>{section.title}</span>
                {section.status ? <small className={`sidebar-section-status ${section.status}`}>{section.status}</small> : null}
              </span>
              <span className={`sidebar-arrow ${openSections[section.key] ? 'is-open' : ''}`}>▾</span>
            </button>
            {openSections[section.key] ? (
              <div className="sidebar-nav">
                {section.items.map((item) => (
                  <button
                    key={item.key}
                    type="button"
                    className={`sidebar-item ${activeKey === item.key ? 'is-active' : ''} ${item.disabled ? 'is-disabled' : ''}`}
                    onClick={() => {
                      if (item.disabled) {
                        return;
                      }

                      onSelect(item.key);
                    }}
                    disabled={item.disabled}
                  >
                    <span className="sidebar-icon">{item.icon}</span>
                    <span className="sidebar-label">{item.label}</span>
                  </button>
                ))}
              </div>
            ) : null}
          </section>
        ))}

        <div className="sidebar-logout">
          <button type="button" onClick={onLogout}>
            Cerrar sesion
          </button>
        </div>
      </aside>
    </>
  );
}
