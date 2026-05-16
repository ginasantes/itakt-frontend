/**
 * syncService.js
 * Maneja sincronización en tiempo real entre Admin de Precios y Cotizaciones
 * Usa Supabase Realtime para cambios inmediatos y caché local para persistencia
 */

import { supabase } from './supabaseClient';

class SyncService {
  constructor() {
    this.listeners = new Map(); // {key: [callback1, callback2...]}
    this.cache = new Map(); // Caché local
    this.subscriptions = new Map(); // Almacena subscripciones activas
    this.loadCacheFromLocalStorage();
  }

  /**
   * Cargar caché desde localStorage
   */
  loadCacheFromLocalStorage() {
    try {
      const cached = localStorage.getItem('itakt_sync_cache');
      if (cached) {
        const data = JSON.parse(cached);
        this.cache = new Map(Object.entries(data));
      }
    } catch (e) {
      console.warn('Error cargando caché:', e);
    }
  }

  /**
   * Guardar caché en localStorage
   */
  saveCacheToLocalStorage() {
    try {
      const data = Object.fromEntries(this.cache);
      localStorage.setItem('itakt_sync_cache', JSON.stringify(data));
    } catch (e) {
      console.warn('Error guardando caché:', e);
    }
  }

  /**
   * Suscribirse a cambios de equipos y proveedores en tiempo real
   * @param {number} businessId - ID del negocio
   * @param {string} userId - ID del usuario (para filtrar por creator)
   * @param {function} onEquiposChange - Callback cuando cambian equipos
   * @param {function} onProveedoresChange - Callback cuando cambian proveedores
   */
  subscribeToChanges(businessId, userId, onEquiposChange, onProveedoresChange) {
    const key = `sync_${businessId}_${userId}`;

    // Evitar múltiples suscripciones al mismo negocio/usuario
    if (this.subscriptions.has(key)) {
      console.log('Suscripción ya activa para', key);
      return () => this.unsubscribeFromChanges(key);
    }

    try {
      const subscriptions = [];

      // Suscribirse a cambios de EQUIPOS (en tabla insumos con subcategorías 15,16,17)
      const equiposChannel = supabase
        .channel(`insumos_equipos_changes_${businessId}_${Date.now()}`)
        .on(
          'postgres_changes',
          {
            event: '*', // INSERT, UPDATE, DELETE
            schema: 'public',
            table: 'insumos',
            filter: `id_negocio=eq.${businessId}`
          },
          (payload) => {
            // Solo procesar items de equipos (subcategorías 15, 16, 17)
            const record = payload.new || payload.old;
            if (record && [15, 16, 17].includes(record.id_subcategoria)) {
              console.log('[syncService] Cambio en equipos:', payload);
              this.updateCache('equipos', payload);
              if (onEquiposChange) {
                // Normalizar el payload para mantener compatibilidad
                const normalizedPayload = {
                  ...payload,
                  new: payload.new ? { ...payload.new, id_equipo: payload.new.id_insumo, nombre_equipo: payload.new.nombre_item } : null,
                  old: payload.old ? { ...payload.old, id_equipo: payload.old.id_insumo, nombre_equipo: payload.old.nombre_item } : null
                };
                onEquiposChange(normalizedPayload);
              }
            }
          }
        )
        .subscribe((status) => {
          console.log(`[syncService] insumos_equipos subscription status: ${status}`);
        });

      subscriptions.push(equiposChannel);

      // Suscribirse a cambios de PROVEEDORES
      const proveedoresChannel = supabase
        .channel(`proveedores_changes_${businessId}_${Date.now()}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'proveedores',
            filter: `id_negocio=eq.${businessId}`
          },
          (payload) => {
            console.log('[syncService] Cambio en proveedores:', payload);
            this.updateCache('proveedores', payload);
            if (onProveedoresChange) {
              onProveedoresChange(payload);
            }
          }
        )
        .subscribe((status) => {
          console.log(`[syncService] proveedores subscription status: ${status}`);
        });

      subscriptions.push(proveedoresChannel);

      // Guardar las suscripciones para poder desuscribirse después
      this.subscriptions.set(key, subscriptions);

      // Retornar función para desuscribirse
      return () => this.unsubscribeFromChanges(key);
    } catch (error) {
      console.error('[syncService] Error al suscribirse:', error);
      // Retornar función de cleanup aunque haya habido error
      return () => {};
    }
  }

  /**
   * Desuscribirse de cambios
   */
  unsubscribeFromChanges(key) {
    const subscriptions = this.subscriptions.get(key);
    if (subscriptions) {
      subscriptions.forEach(sub => {
        supabase.removeChannel(sub);
      });
      this.subscriptions.delete(key);
      console.log('Desuscrito de:', key);
    }
  }

  /**
   * Actualizar caché con cambios
   */
  updateCache(type, payload) {
    // Para equipos, usar id_insumo; para proveedores, usar id_proveedor
    const id = type === 'equipos' 
      ? (payload.new?.id_insumo || payload.old?.id_insumo)
      : (payload.new?.id_proveedor || payload.old?.id_proveedor);
    const cacheKey = `${type}_${id}`;
    
    if (payload.eventType === 'DELETE') {
      this.cache.delete(cacheKey);
    } else {
      this.cache.set(cacheKey, payload.new);
    }

    this.saveCacheToLocalStorage();
  }

  /**
   * Obtener equipos con datos frescos + caché
   * Equipos están en tabla 'insumos' con subcategorías 15, 16, 17
   */
  async getEquipos(businessId, userId = null) {
    try {
      let query = supabase
        .from('insumos')
        .select('*')
        .eq('id_negocio', businessId)
        .in('id_subcategoria', [15, 16, 17]);

      const { data, error } = await query;

      if (error) throw error;

      // Combinar con caché local
      const mergedData = [...(data || [])];
      return mergedData;
    } catch (error) {
      console.error('Error obteniendo equipos:', error);
      // Retornar desde caché si hay error
      return Array.from(this.cache.values()).filter(
        item => item.id_insumo && item.id_negocio === businessId && [15, 16, 17].includes(item.id_subcategoria)
      );
    }
  }

  /**
   * Obtener proveedores con datos frescos + caché
   */
  async getProveedores(businessId, userId = null) {
    try {
      let query = supabase
        .from('proveedores')
        .select('*')
        .eq('id_negocio', businessId);

      // Si hay userId, filtrar por creador
      if (userId) {
        query = query.eq('created_by', userId);
      }

      const { data, error } = await query;

      if (error) throw error;

      return data || [];
    } catch (error) {
      console.error('Error obteniendo proveedores:', error);
      // Retornar desde caché si hay error
      return Array.from(this.cache.values()).filter(
        item => item.id_proveedor && item.id_negocio === businessId
      );
    }
  }

  /**
   * Registrar listener para cambios
   */
  onEquiposChange(key, callback) {
    if (!this.listeners.has('equipos')) {
      this.listeners.set('equipos', []);
    }
    this.listeners.get('equipos').push({ key, callback });

    // Retornar función para remover listener
    return () => {
      const listeners = this.listeners.get('equipos');
      const index = listeners.findIndex(l => l.key === key);
      if (index > -1) {
        listeners.splice(index, 1);
      }
    };
  }

  onProveedoresChange(key, callback) {
    if (!this.listeners.has('proveedores')) {
      this.listeners.set('proveedores', []);
    }
    this.listeners.get('proveedores').push({ key, callback });

    return () => {
      const listeners = this.listeners.get('proveedores');
      const index = listeners.findIndex(l => l.key === key);
      if (index > -1) {
        listeners.splice(index, 1);
      }
    };
  }

  /**
   * Notificar a todos los listeners
   */
  notifyListeners(type, data) {
    const listeners = this.listeners.get(type) || [];
    listeners.forEach(({ callback }) => {
      try {
        callback(data);
      } catch (e) {
        console.error('Error en listener:', e);
      }
    });
  }

  /**
   * Limpiar todo
   */
  cleanup() {
    this.subscriptions.forEach((subs, key) => {
      subs.forEach(sub => supabase.removeChannel(sub));
    });
    this.subscriptions.clear();
    this.listeners.clear();
  }
}

// Exportar instancia singleton
export default new SyncService();
