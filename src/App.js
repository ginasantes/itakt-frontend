import React from 'react';
import Sidebar from './components/Sidebar';
import { AuthProvider, useAuth } from './context/AuthContext';
import DashboardHome from './pages/dashboard/DashboardHome';
import Login from './pages/auth/Login';
import { getInitialSectionKey } from './roles/menuConfig';
import { clearDemoSessionEmail } from './services/supabaseClient';

function MainApp() {
  const { user, setUser } = useAuth();
  const [activeSection, setActiveSection] = React.useState('');
  const [isSidebarOpen, setIsSidebarOpen] = React.useState(false);

  React.useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const section = params.get('section');
    if (section) {
      // Map short section names to full internal section keys
      const sectionMap = {
        'cotizaciones': 'cotizaciones_catering',
        'eventos': 'eventos_catering',
        'operacion': 'operacion_catering',
        'admin_precios': 'admin_precios_catering',
        'nuevo_usuario': 'nuevo_usuario_catering',
        'configuracion': user?.tiene_catering ? 'configuracion_catering' : 'configuracion_restaurante'
      };
      
      const mappedSection = sectionMap[section] || section;
      setActiveSection(mappedSection);
    } else if (user) {
      setActiveSection(getInitialSectionKey(user));
    }
  }, [user]);

  if (!user) {
    return <Login />;
  }

  const handleLogout = () => {
    clearDemoSessionEmail();
    setUser(null);
  };

  const handleSwitchBusiness = (businessId) => {
    const nextBusiness = (user.business_options || []).find((item) => item.id_negocio === Number(businessId));
    if (!nextBusiness) {
      return;
    }

    setUser((current) => ({
      ...current,
      id_negocio: nextBusiness.id_negocio,
      business_id: nextBusiness.id_negocio,
      nombre_negocio: nextBusiness.nombre_negocio,
      business_name: nextBusiness.nombre_negocio,
      nombre_sucursal: nextBusiness.nombre_sucursal || '',
      business_label: nextBusiness.nombre_visible || nextBusiness.nombre_negocio,
      tipo_negocio: nextBusiness.tipo_negocio,
      business_type: nextBusiness.tipo_negocio,
      tipo_unidad: nextBusiness.tipo_unidad || 'unidad',
      id_negocio_padre: nextBusiness.id_negocio_padre || null,
      tiene_restaurante: Boolean(nextBusiness.tiene_restaurante),
      tiene_catering: Boolean(nextBusiness.tiene_catering)
    }));
    setIsSidebarOpen(false);
  };

  return (
    <div className="app-shell">
      <Sidebar
        activeKey={activeSection}
        isOpen={isSidebarOpen}
        user={user}
        onClose={() => setIsSidebarOpen(false)}
        onSelect={(key) => {
          setActiveSection(key);
          setIsSidebarOpen(false);
        }}
        onSwitchBusiness={handleSwitchBusiness}
        onLogout={handleLogout}
      />
      <DashboardHome
        activeSection={activeSection}
        user={user}
        onOpenMenu={() => setIsSidebarOpen(true)}
        onNavigateSection={(key) => setActiveSection(key)}
      />
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <MainApp />
    </AuthProvider>
  );
}
