// src/context/AuthContext.js
import React, { createContext, useContext, useState, useEffect } from 'react';

const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [user, setUserState] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  // Recuperar sesión al cargar el componente
  useEffect(() => {
    const savedUser = localStorage.getItem('user');
    if (savedUser) {
      try {
        setUserState(JSON.parse(savedUser));
      } catch (err) {
        console.error('Error al recuperar sesión:', err);
        localStorage.removeItem('user');
      }
    }
    setIsLoading(false);
  }, []);

  // Guardar sesión cuando cambie
  const setUser = (userData) => {
    if (userData) {
      localStorage.setItem('user', JSON.stringify(userData));
      setUserState(userData);
    } else {
      localStorage.removeItem('user');
      setUserState(null);
    }
  };

  return (
    <AuthContext.Provider value={{ user, setUser, isLoading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
