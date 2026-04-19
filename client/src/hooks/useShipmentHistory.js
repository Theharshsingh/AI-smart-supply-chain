import { useState, useCallback, useEffect } from 'react';
import { serverAddShipment, serverUpdateShipment, serverGetMyShipments } from '../api';

const STORAGE_KEY = 'shipment_history';

function loadLocal() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || []; }
  catch { return []; }
}
function saveLocal(data) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

export function useShipmentHistory() {
  const [history, setHistory] = useState(loadLocal);

  // Sync from server on mount
  useEffect(() => {
    const token = localStorage.getItem('auth_token');
    if (!token) return;
    serverGetMyShipments()
      .then(data => {
        if (Array.isArray(data) && data.length > 0) {
          setHistory(data);
          saveLocal(data);
        }
      })
      .catch(() => {}); // fallback to localStorage if server down
  }, []);

  const addShipment = useCallback(async (shipment) => {
    const trackingToken = `TRK-${Date.now()}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`;
    const shipmentWithToken = { ...shipment, trackingToken };

    // Optimistic update
    setHistory(prev => {
      const next = [shipmentWithToken, ...prev];
      saveLocal(next);
      return next;
    });

    // Sync to server
    try { await serverAddShipment(shipmentWithToken); } catch {}

    return shipment.id;
  }, []);

  const updateShipment = useCallback(async (id, updates) => {
    setHistory(prev => {
      const next = prev.map(s => s.id === id ? { ...s, ...updates } : s);
      saveLocal(next);
      return next;
    });
    try { await serverUpdateShipment(id, updates); } catch {}
  }, []);

  const deleteShipment = useCallback((id) => {
    setHistory(prev => {
      const next = prev.filter(s => s.id !== id);
      saveLocal(next);
      return next;
    });
    // Note: no server delete — keep history on server for admin
  }, []);

  const stopShipment = useCallback(async (id) => {
    const updates = { status: 'cancelled', endTime: new Date().toISOString() };
    setHistory(prev => {
      const next = prev.map(s =>
        s.id === id && s.status === 'ongoing' ? { ...s, ...updates } : s
      );
      saveLocal(next);
      return next;
    });
    try { await serverUpdateShipment(id, updates); } catch {}
  }, []);

  const completeShipment = useCallback(async (id) => {
    const updates = { status: 'completed', endTime: new Date().toISOString() };
    setHistory(prev => {
      const next = prev.map(s => s.id === id ? { ...s, ...updates } : s);
      saveLocal(next);
      return next;
    });
    try { await serverUpdateShipment(id, updates); } catch {}
  }, []);

  // Push live GPS location to server every 5s when navigating
  const updateLiveLocation = useCallback(async (id, lat, lng) => {
    try {
      await serverUpdateShipment(id, { currentLat: lat, currentLng: lng, locationUpdatedAt: new Date().toISOString() });
    } catch {}
  }, []);

  return { history, addShipment, updateShipment, deleteShipment, stopShipment, completeShipment, updateLiveLocation };
}
