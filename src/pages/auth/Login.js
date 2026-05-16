// src/pages/auth/Login.js
import { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { login } from '../../services/auth';
import './Login.css';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { setUser } = useAuth();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    const { user, error } = await login(email, password);
    if (error || !user) {
      setError(error || 'Credenciales incorrectas');
      setLoading(false);
      return;
    }
    setUser(user);
    setLoading(false);
  };

  return (
    <div className="login-page">
      <section className="login-hero">
        <div className="login-brand">
          <div className="login-brand-wrap">
            <img src="/logo.png" alt="ITakt - Tecnologías y Servicios para Restaurantes Exitosos" />
          </div>
        </div>

        <div className="login-copy">
          <p>Tecnologías y Servicios para Restaurantes y Catering Exitosos</p>
          <h2>Controla compras, recetario, inventario y usuarios desde una sola base.</h2>
          <div className="login-pill-list">
            <span className="login-pill">Inventario con semáforo</span>
            <span className="login-pill">Escandallo y merma</span>
            <span className="login-pill">Eventos de catering</span>
          </div>
        </div>
      </section>

      <section className="login-card">
        <div className="login-card-header">
          <p>Acceso</p>
          <h2>Iniciar sesión</h2>
          <span>Ingresa tu correo y contraseña para entrar al sistema.</span>
        </div>

        <form className="login-form" onSubmit={handleSubmit}>
          <div className="login-field">
            <label htmlFor="email">Correo</label>
            <input
              id="email"
              type="email"
              placeholder="Correo electrónico"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div className="login-field">
            <label htmlFor="password">Contraseña</label>
            <input
              id="password"
              type="password"
              placeholder="Contraseña"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          <button className="login-submit" type="submit" disabled={loading}>
            {loading ? 'Entrando...' : 'Entrar al sistema'}
          </button>
          {error && <div className="login-error">{error}</div>}
        </form>
      </section>
    </div>
  );
}
