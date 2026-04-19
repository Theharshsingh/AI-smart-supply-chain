import { useState, useCallback } from 'react';

const STORAGE_KEY = 'shipment_history';

function load() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || []; }
  catch { return []; }
}

function save(data) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

export function useShipmentHistory() {
  const [history, setHistory] = useState(load);

  const addShipment = useCallback((shipment) => {
    // Generate unique tracking token
    const trackingToken = `TRK-${Date.now()}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`;
    const shipmentWithToken = { ...shipment, trackingToken };
    setHistory(prev => {
      const next = [shipmentWithToken, ...prev];
      save(next);
      return next;
    });
    return shipment.id;
  }, []);

  const updateShipment = useCallback((id, updates) => {
    setHistory(prev => {
      const next = prev.map(s => s.id === id ? { ...s, ...updates } : s);
      save(next);
      return next;
    });
  }, []);

  const deleteShipment = useCallback((id) => {
    setHistory(prev => {
      const next = prev.filter(s => s.id !== id);
      save(next);
      return next;
    });
  }, []);

  const stopShipment = useCallback((id) => {
    setHistory(prev => {
      const next = prev.map(s =>
        s.id === id && s.status === 'ongoing'
          ? { ...s, status: 'cancelled', endTime: new Date().toISOString() }
          : s
      );
      save(next);
      return next;
    });
  }, []);

  const completeShipment = useCallback((id) => {
    setHistory(prev => {
      const next = prev.map(s =>
        s.id === id ? { ...s, status: 'completed', endTime: new Date().toISOString() } : s
      );
      save(next);
      return next;
    });
  }, []);

  return { history, addShipment, updateShipment, deleteShipment, stopShipment, completeShipment };
}
