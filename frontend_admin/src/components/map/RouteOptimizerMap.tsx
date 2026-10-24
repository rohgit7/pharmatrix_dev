import React, { useEffect, useRef } from 'react';
import L from 'leaflet';

export interface MapStop {
  id: string | number;
  sequenceNumber: number;
  lat: number;
  lng: number;
  name: string;
  address?: string;
  weightKg?: number;
  routeIndex: number;
}

export interface MapRoute {
  vehicleIndex: number;
  vehicleLabel: string;
  color: string;
  stops: MapStop[];
  totalDistanceKm: number;
  totalDurationMin: number;
  totalLoadKg: number;
}

export interface MapDepot {
  name: string;
  lat: number;
  lng: number;
  address?: string;
}

interface RouteOptimizerMapProps {
  depot: MapDepot;
  routes: MapRoute[];
  totalStoresCovered?: number;
  maxRouteMinutes?: number;
  className?: string;
  selectedRouteIndex?: number | null;
  onSelectRoute?: (index: number | null) => void;
}

export const ROUTE_COLORS = [
  '#16A34A', // Vibrant Green (matching screenshot Route 1)
  '#8B5CF6', // Vibrant Purple (matching screenshot Route 2)
  '#F97316', // Vibrant Orange (matching screenshot Route 3)
  '#0284C7', // Vibrant Sky/Cyan (matching screenshot Route 4)
  '#E11D48', // Vibrant Rose
  '#D97706', // Vibrant Amber
];

export const RouteOptimizerMap: React.FC<RouteOptimizerMapProps> = ({
  depot,
  routes,
  totalStoresCovered,
  maxRouteMinutes,
  className = 'h-[580px]',
  selectedRouteIndex = null,
  onSelectRoute,
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const layerGroupRef = useRef<L.LayerGroup | null>(null);

  // Initialize Map once
  useEffect(() => {
    if (!mapContainerRef.current) return;

    if (!mapInstanceRef.current) {
      const map = L.map(mapContainerRef.current, {
        zoomControl: true,
        attributionControl: false,
      }).setView([depot.lat, depot.lng], 12);

      // CartoDB Voyager tiles - fast, clean, avoids OpenStreetMap 403 blocking
      L.tileLayer(
        'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
        {
          maxZoom: 19,
          subdomains: 'abcd',
        }
      ).addTo(map);

      // Attribution in bottom right
      L.control
        .attribution({
          position: 'bottomright',
          prefix: '© <a href="https://carto.com/" target="_blank" rel="noreferrer">CARTO</a> · © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OSM</a>',
        })
        .addTo(map);

      layerGroupRef.current = L.layerGroup().addTo(map);
      mapInstanceRef.current = map;
    }

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  // Update layers when depot, routes or selection changes
  useEffect(() => {
    const map = mapInstanceRef.current;
    const layerGroup = layerGroupRef.current;
    if (!map || !layerGroup) return;

    layerGroup.clearLayers();

    const allLatLngs: L.LatLngExpression[] = [];

    // 1. Plot Warehouse Depot (Blue Circular Pin with WAREHOUSE badge as in screenshot)
    const depotIcon = L.divIcon({
      className: 'depot-marker',
      html: `
        <div style="position: relative; width: 36px; height: 36px; display: flex; align-items: center; justify-content: center;">
          <div style="width: 28px; height: 28px; border-radius: 9999px; background-color: #2563EB; border: 3px solid #FFFFFF; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.3); display: flex; align-items: center; justify-content: center; color: white;">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
              <polyline points="9 22 9 12 15 12 15 22"/>
            </svg>
          </div>
        </div>
      `,
      iconSize: [36, 36],
      iconAnchor: [18, 18],
    });

    const depotMarker = L.marker([depot.lat, depot.lng], {
      icon: depotIcon,
      zIndexOffset: 1000,
    })
      .bindTooltip('WAREHOUSE', {
        permanent: true,
        direction: 'top',
        offset: [0, -18],
        className: 'bg-white text-slate-900 font-extrabold text-[10px] tracking-wider px-2 py-0.5 rounded shadow border border-slate-300',
      })
      .bindPopup(`
      <div style="font-family: sans-serif; font-size: 12px; padding: 4px;">
        <div style="font-weight: 700; color: #1E293B;">Warehouse Depot</div>
        <div style="color: #475569; margin-top: 2px;">${depot.name}</div>
        ${depot.address ? `<div style="color: #64748B; font-size: 11px; margin-top: 2px;">${depot.address}</div>` : ''}
        <div style="margin-top: 6px; font-size: 10px; font-weight: 600; color: #2563EB; text-transform: uppercase;">Final destination for all collection routes</div>
      </div>
    `);
    layerGroup.addLayer(depotMarker);
    allLatLngs.push([depot.lat, depot.lng]);

    // 2. Plot Routes and Stop Markers
    routes.forEach((route, idx) => {
      const color = route.color || ROUTE_COLORS[idx % ROUTE_COLORS.length];
      const isSelected = selectedRouteIndex === null || selectedRouteIndex === idx;
      const opacity = isSelected ? 0.95 : 0.25;
      const weight = isSelected ? 4.5 : 2;

      const pathPoints: [number, number][] = [];

      // Add stops in order
      route.stops.forEach((stop, stopIndex) => {
        pathPoints.push([stop.lat, stop.lng]);
        allLatLngs.push([stop.lat, stop.lng]);

        // Stop number marker (white circular pill with colored thick border matching screenshot)
        const stopNumber = stop.sequenceNumber || stopIndex + 1;
        const markerIcon = L.divIcon({
          className: 'stop-marker',
          html: `
            <div style="
              width: 26px;
              height: 26px;
              border-radius: 9999px;
              background-color: #FFFFFF;
              border: 3px solid ${color};
              box-shadow: 0 2px 4px rgba(0,0,0,0.25);
              display: flex;
              align-items: center;
              justify-content: center;
              font-family: ui-sans-serif, system-ui, sans-serif;
              font-weight: 800;
              font-size: 11px;
              color: #111827;
              opacity: ${isSelected ? 1 : 0.4};
              cursor: pointer;
              transition: transform 0.15s ease;
            ">
              ${stopNumber}
            </div>
          `,
          iconSize: [26, 26],
          iconAnchor: [13, 13],
        });

        const stopMarker = L.marker([stop.lat, stop.lng], {
          icon: markerIcon,
          zIndexOffset: isSelected ? 500 + stopNumber : 100,
        }).bindPopup(`
          <div style="font-family: sans-serif; font-size: 12px; min-width: 160px; padding: 2px;">
            <div style="display: flex; align-items: center; justify-content: space-between; gap: 8px;">
              <span style="font-weight: 700; color: #111827;">Stop #${stopNumber}</span>
              <span style="font-size: 10px; font-weight: 700; padding: 2px 6px; border-radius: 4px; background-color: ${color}20; color: ${color};">
                ${route.vehicleLabel}
              </span>
            </div>
            <div style="margin-top: 4px; font-weight: 600; color: #374151;">${stop.name}</div>
            ${stop.address ? `<div style="color: #6B7280; font-size: 11px; margin-top: 2px;">${stop.address}</div>` : ''}
            ${stop.weightKg !== undefined ? `<div style="margin-top: 6px; font-size: 11px; color: #059669; font-weight: 600;">Est. Weight: ${stop.weightKg} kg</div>` : ''}
          </div>
        `);

        if (onSelectRoute) {
          stopMarker.on('click', () => onSelectRoute(idx));
        }

        layerGroup.addLayer(stopMarker);
      });

      // Path starts at warehouse and ends at warehouse
      if (pathPoints.length > 0) {
        pathPoints.unshift([depot.lat, depot.lng]);
        pathPoints.push([depot.lat, depot.lng]);

        const polyline = L.polyline(pathPoints, {
          color,
          weight,
          opacity,
          lineJoin: 'round',
          lineCap: 'round',
          dashArray: isSelected ? undefined : '4, 8',
        });

        if (onSelectRoute) {
          polyline.on('click', () => onSelectRoute(idx));
        }

        polyline.bindTooltip(
          `<b>${route.vehicleLabel}</b>: ${route.stops.length} stops · ${route.totalDistanceKm.toFixed(1)} km`,
          { sticky: true, opacity: 0.9 }
        );

        layerGroup.addLayer(polyline);
      }
    });

    // Fit bounds if coordinates exist
    if (allLatLngs.length > 1) {
      map.fitBounds(L.latLngBounds(allLatLngs), {
        padding: [40, 40],
        maxZoom: 14,
      });
    }
  }, [depot, routes, selectedRouteIndex, onSelectRoute]);

  // Compute summary values for floating badge
  const totalStores =
    totalStoresCovered ??
    routes.reduce((acc, r) => acc + r.stops.length, 0);

  const totalVehicles = routes.length;
  const totalDistance = routes.reduce((acc, r) => acc + r.totalDistanceKm, 0);
  const maxRouteDur =
    maxRouteMinutes ??
    (routes.length > 0
      ? Math.round(Math.max(...routes.map((r) => r.totalDurationMin)))
      : 0);

  return (
    <div className={`relative w-full rounded-xl overflow-hidden border border-slate-300 shadow-sm ${className}`}>
      {/* Map DOM Element */}
      <div ref={mapContainerRef} className="w-full h-full z-0" />

      {/* Floating Summary Badge in Top Right — Exactly matching attached reference */}
      <div className="absolute top-3 right-3 z-10 bg-white/95 backdrop-blur-sm px-4 py-2.5 rounded-lg border border-slate-200 shadow-lg text-slate-800 pointer-events-auto select-none min-w-[170px]">
        <div className="text-sm font-bold text-slate-900 leading-tight">
          {totalStores} stores covered
        </div>
        <div className="text-xs text-slate-600 font-medium mt-0.5">
          {totalVehicles} vehicles · {totalDistance.toFixed(1)} km
        </div>
        <div className="text-xs text-slate-500 font-medium">
          Max route {maxRouteDur} min
        </div>
      </div>
    </div>
  );
};
