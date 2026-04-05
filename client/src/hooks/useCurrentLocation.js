import { useState } from 'react';

const GEO_ERROR_MESSAGES = {
  1: 'Location access denied. Please allow GPS.',
  2: 'Unable to fetch location. Try again.',
  3: 'Unable to fetch location. Try again.',
  unsupported: 'Geolocation not supported in this browser.',
};

async function reverseGeocode(lat, lon) {
  const res = await fetch(
    `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json`,
    { headers: { 'Accept-Language': 'en-US,en;q=0.9' } }
  );
  if (!res.ok) throw new Error('Geocoding failed');
  const data = await res.json();
  return data.display_name || `${lat.toFixed(5)}, ${lon.toFixed(5)}`;
}

/**
 * useCurrentLocation
 *
 * Returns { fetchLocation, isLoading, error, clearError }
 *
 * fetchLocation(onSuccess, onError)
 *   onSuccess({ lat, lon, address })
 *   onError(message)
 */
export function useCurrentLocation() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError]         = useState(null);

  function fetchLocation(onSuccess, onError) {
    if (!navigator.geolocation) {
      const msg = GEO_ERROR_MESSAGES.unsupported;
      setError(msg);
      onError?.(msg);
      return;
    }

    setIsLoading(true);
    setError(null);

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          const { latitude, longitude } = position.coords;
          const address = await reverseGeocode(latitude, longitude);
          setIsLoading(false);
          onSuccess?.({ lat: latitude, lon: longitude, address });
        } catch {
          setIsLoading(false);
          const msg = 'Unable to fetch location. Try again.';
          setError(msg);
          onError?.(msg);
        }
      },
      (err) => {
        setIsLoading(false);
        const msg = GEO_ERROR_MESSAGES[err.code] || 'Unable to fetch location. Try again.';
        setError(msg);
        onError?.(msg);
      },
      { timeout: 10000, maximumAge: 60000 }
    );
  }

  return { fetchLocation, isLoading, error, clearError: () => setError(null) };
}
