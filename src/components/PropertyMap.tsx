'use client';

import { useEffect, useRef } from 'react';
import 'leaflet/dist/leaflet.css';

/**
 * Location map for the address lookup. Defaults to satellite (Esri World Imagery — keyless) with an
 * OpenStreetMap street toggle and a pin on the geocoded point. Leaflet is dynamically imported inside
 * the effect so it never runs during SSR, and the marker is a divIcon (emoji) to sidestep Leaflet's
 * broken default-icon image paths under bundlers.
 */
export function PropertyMap({ lat, lon, label }: { lat: number; lon: number; label?: string }) {
  const elRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mapRef = useRef<any>(null);

  useEffect(() => {
    let cancelled = false;
    import('leaflet').then((L) => {
      if (cancelled || !elRef.current) return;
      if (mapRef.current) { mapRef.current.remove(); mapRef.current = null; }

      const map = L.map(elRef.current, { center: [lat, lon], zoom: 17, scrollWheelZoom: false });
      mapRef.current = map;

      const satellite = L.tileLayer(
        'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
        { maxZoom: 19, attribution: 'Imagery © Esri' },
      );
      const street = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '© OpenStreetMap',
      });
      satellite.addTo(map);
      L.control.layers({ Satellite: satellite, Street: street }, undefined, { position: 'topright', collapsed: false }).addTo(map);

      const pin = L.divIcon({ className: 'cre-map-pin', html: '<div style="font-size:26px;line-height:1;transform:translate(-50%,-100%)">📍</div>', iconSize: [0, 0] });
      const marker = L.marker([lat, lon], { icon: pin }).addTo(map);
      if (label) marker.bindPopup(label);
    });

    return () => {
      cancelled = true;
      if (mapRef.current) { mapRef.current.remove(); mapRef.current = null; }
    };
  }, [lat, lon, label]);

  return <div ref={elRef} className="h-full min-h-[240px] w-full overflow-hidden rounded-lg ring-1 ring-slate-200" />;
}
