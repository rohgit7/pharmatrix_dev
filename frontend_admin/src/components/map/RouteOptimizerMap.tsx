import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import { Maximize2, RotateCcw } from 'lucide-react';

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
  roadGeometry?: [number, number][]; // Actual road-following [lat, lng] array
  isRoadLoading?: boolean;
  roadRoutingError?: string;
  routeId?: number;
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
  isRoadRoutingLoading?: boolean;
  onRetryRoadRouting?: () => void;
  selectedBatchInfo?: {
    batchId?: number | string | null;
    planningDate?: string | null;
  } | null;
  emptyMessage?: string;
}

export const ROUTE_COLORS = [
  '#16A34A', // Vibrant Green
  '#8B5CF6', // Vibrant Purple
  '#F97316', // Vibrant Orange
  '#0284C7', // Vibrant Sky/Cyan
  '#E11D48', // Vibrant Rose
  '#D97706', // Vibrant Amber
];

/**
 * Centrally maps a route to a stable color based on its route ID or code.
 * Ensures the route cards and map polylines always render the exact same color.
 */
export function getRouteColor(route: {
  id?: number | string | null;
  route_code?: string | null;
  vehicleIndex?: number | null;
  color?: string | null;
}): string {
  if (route.color) return route.color;
  if (typeof route.id === 'number' && route.id > 0) {
    return ROUTE_COLORS[(route.id - 1) % ROUTE_COLORS.length];
  }
  if (typeof route.id === 'string' && !isNaN(Number(route.id)) && Number(route.id) > 0) {
    return ROUTE_COLORS[(Number(route.id) - 1) % ROUTE_COLORS.length];
  }
  if (route.route_code) {
    let hash = 0;
    for (let i = 0; i < route.route_code.length; i++) {
      hash = (hash << 5) - hash + route.route_code.charCodeAt(i);
      hash |= 0;
    }
    return ROUTE_COLORS[Math.abs(hash) % ROUTE_COLORS.length];
  }
  if (typeof route.vehicleIndex === 'number' && route.vehicleIndex >= 0) {
    return ROUTE_COLORS[route.vehicleIndex % ROUTE_COLORS.length];
  }
  return ROUTE_COLORS[0];
}

export const RouteOptimizerMap: React.FC<RouteOptimizerMapProps> = ({
  depot,
  routes,
  totalStoresCovered,
  maxRouteMinutes,
  className = 'h-full w-full',
  selectedRouteIndex = null,
  onSelectRoute,
  isRoadRoutingLoading = false,
  onRetryRoadRouting,
  selectedBatchInfo,
  emptyMessage,
}) => {
  const [activeBasemap, setActiveBasemap] = useState<'carto' | 'esri' | 'osm'>('carto');
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const layerGroupRef = useRef<L.LayerGroup | null>(null);
  const tileLayerRef = useRef<L.TileLayer | null>(null);
  const allLatLngsRef = useRef<L.LatLngExpression[]>([]);

  // Initialize Map once
  useEffect(() => {
    if (!mapContainerRef.current) return;

    if (!mapInstanceRef.current) {
      const map = L.map(mapContainerRef.current, {
        zoomControl: true,
        attributionControl: false,
      }).setView([depot.lat, depot.lng], 12);

      // Attribution in bottom right
      L.control
        .attribution({
          position: 'bottomright',
          prefix: '© <a href="https://carto.com/" target="_blank" rel="noreferrer">CARTO</a> · © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OSM</a> · © <a href="https://www.esri.com/" target="_blank" rel="noreferrer">Esri</a>',
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

  // Invalidate map size whenever container is resized (e.g. panel toggles or window resize)
  useEffect(() => {
    if (!mapContainerRef.current) return;
    const observer = new ResizeObserver(() => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.invalidateSize();
      }
    });
    observer.observe(mapContainerRef.current);
    return () => observer.disconnect();
  }, []);

  // Update Tile Layer when activeBasemap changes
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    if (tileLayerRef.current) {
      map.removeLayer(tileLayerRef.current);
      tileLayerRef.current = null;
    }

    let tileUrl = '';
    let maxZoom = 19;
    let subdomains = 'abcd';

    if (activeBasemap === 'carto') {
      const cartoApiKey = (
        import.meta.env.VITE_CARTO_API_KEY ||
        'cb1_51ab_1_8526a1412087ab20ad5daf06'
      ).trim();

      tileUrl = `https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png?key=${cartoApiKey}`;
      subdomains = 'abcd';
      maxZoom = 19;
    } else if (activeBasemap === 'esri') {
      tileUrl =
        'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}';
      subdomains = 'abc';
      maxZoom = 16;
    } else {
      tileUrl = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
      subdomains = 'abc';
      maxZoom = 19;
    }

    const newLayer = L.tileLayer(tileUrl, {
      maxZoom,
      subdomains,
    }).addTo(map);

    tileLayerRef.current = newLayer;
  }, [activeBasemap]);

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
      const color = getRouteColor(route);
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

      // Road-following geometry or direct path
      const hasRoad = Array.isArray(route.roadGeometry) && route.roadGeometry.length > 1;
      const polylinePoints: [number, number][] = hasRoad
        ? route.roadGeometry!
        : pathPoints.length > 0
        ? [[depot.lat, depot.lng], ...pathPoints, [depot.lat, depot.lng]]
        : [];

      if (polylinePoints.length > 0) {
        if (hasRoad) {
          polylinePoints.forEach((pt) => allLatLngs.push(pt));
        }

        // Crisp contrast halo for selected route
        if (isSelected) {
          const halo = L.polyline(polylinePoints, {
            color: '#FFFFFF',
            weight: (isSelected ? 5 : 3.5) + 3,
            opacity: 0.75,
            lineJoin: 'round',
            lineCap: 'round',
          });
          layerGroup.addLayer(halo);
        }

        const polyline = L.polyline(polylinePoints, {
          color,
          weight: isSelected ? 5 : 3.5,
          opacity: isSelected ? 0.95 : 0.45,
          lineJoin: 'round',
          lineCap: 'round',
          dashArray: isSelected ? undefined : hasRoad ? undefined : '4, 8',
        });

        if (onSelectRoute) {
          polyline.on('click', () => onSelectRoute(idx));
        }

        const engineLabel = hasRoad ? 'Road Network (OSRM)' : 'Direct Path';
        polyline.bindTooltip(
          `<b>${route.vehicleLabel}</b>: ${route.stops.length} stops · ${route.totalDistanceKm.toFixed(1)} km · ${Math.round(route.totalDurationMin)} min (${engineLabel})`,
          { sticky: true, opacity: 0.95 }
        );

        layerGroup.addLayer(polyline);
      }
    });

    // Save current coordinates ref for Fit Route control
    allLatLngsRef.current = allLatLngs;

    // Fit bounds if coordinates exist, otherwise recenter on warehouse depot
    if (allLatLngs.length > 1) {
      map.fitBounds(L.latLngBounds(allLatLngs), {
        padding: [40, 40],
        maxZoom: 14,
      });
    } else if (depot.lat && depot.lng) {
      map.setView([depot.lat, depot.lng], 12);
    }
  }, [depot, routes, selectedRouteIndex, onSelectRoute]);

  // Recenter and fit bounds to all visible route geometries and depot
  const handleFitBounds = () => {
    const map = mapInstanceRef.current;
    if (!map) return;
    if (allLatLngsRef.current && allLatLngsRef.current.length > 1) {
      map.fitBounds(L.latLngBounds(allLatLngsRef.current), {
        padding: [40, 40],
        maxZoom: 14,
      });
    } else if (depot.lat && depot.lng) {
      map.setView([depot.lat, depot.lng], 12);
    }
  };

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
    <div className={`relative w-full rounded-xl overflow-hidden border border-slate-800 shadow-md ${className}`}>
      {/* Map DOM Element */}
      <div ref={mapContainerRef} className="w-full h-full z-0" />

      {/* Basemap Switcher & View Controls in Bottom-Left */}
      <div className="absolute bottom-2.5 left-2.5 z-10 bg-white/95 backdrop-blur-sm px-2.5 py-1.5 rounded-lg border border-slate-200 shadow-md flex items-center gap-1.5 pointer-events-auto">
        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mr-0.5">Map:</span>
        <button
          type="button"
          onClick={() => setActiveBasemap('carto')}
          className={`px-2 py-0.5 rounded text-[11px] font-semibold transition-all ${
            activeBasemap === 'carto'
              ? 'bg-[#2563EB] text-white shadow-sm'
              : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
          }`}
          title="CARTO Voyager Basemap"
        >
          CARTO
        </button>
        <button
          type="button"
          onClick={() => setActiveBasemap('esri')}
          className={`px-2 py-0.5 rounded text-[11px] font-semibold transition-all ${
            activeBasemap === 'esri'
              ? 'bg-[#2563EB] text-white shadow-sm'
              : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
          }`}
          title="Esri Light Canvas"
        >
          Esri
        </button>
        <button
          type="button"
          onClick={() => setActiveBasemap('osm')}
          className={`px-2 py-0.5 rounded text-[11px] font-semibold transition-all ${
            activeBasemap === 'osm'
              ? 'bg-[#2563EB] text-white shadow-sm'
              : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
          }`}
          title="OpenStreetMap Standard"
        >
          OSM
        </button>

        <div className="h-3 w-px bg-slate-300 mx-0.5" />

        <button
          type="button"
          onClick={handleFitBounds}
          className="px-2 py-0.5 rounded text-[11px] font-semibold text-slate-700 hover:bg-slate-100 hover:text-slate-900 transition-colors flex items-center gap-1"
          title="Recenter and fit view to all stops"
        >
          <Maximize2 className="w-3 h-3 text-[#7B91EE]" />
          <span>Fit Route</span>
        </button>

        <div className="h-3 w-px bg-slate-300 mx-0.5" />

        <span
          className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
            routes.some((r) => r.roadGeometry && r.roadGeometry.length > 1)
              ? 'bg-emerald-100 text-emerald-800'
              : isRoadRoutingLoading
              ? 'bg-blue-100 text-blue-800'
              : 'bg-amber-100 text-amber-800'
          }`}
          title="Route network geometry status"
        >
          {routes.some((r) => r.roadGeometry && r.roadGeometry.length > 1)
            ? 'Road Aligned'
            : isRoadRoutingLoading
            ? 'Routing…'
            : 'Pending Roads'}
        </span>

        {onRetryRoadRouting && routes.some((r) => r.roadRoutingError) && (
          <button
            type="button"
            onClick={onRetryRoadRouting}
            className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-600 text-white hover:bg-amber-700 transition-colors shadow-xs ml-1 flex items-center gap-1"
            title="Retry road routing"
          >
            <RotateCcw className="w-2.5 h-2.5" />
            <span>Retry</span>
          </button>
        )}
      </div>

      {/* Empty State Overlay when no routes are displayed */}
      {routes.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10 p-4">
          <div className="bg-white/95 backdrop-blur-md px-6 py-5 rounded-2xl border border-slate-200 shadow-xl text-center max-w-sm pointer-events-auto">
            <div className="w-10 h-10 rounded-full bg-[#E5EBFF] flex items-center justify-center mx-auto mb-3">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#7B91EE" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="12 2 2 7 12 12 22 7 12 2" />
                <polyline points="2 17 12 22 22 17" />
                <polyline points="2 12 12 17 22 12" />
              </svg>
            </div>
            <h4 className="text-sm font-bold text-[#201E1C]">No Batch Selected</h4>
            <p className="text-xs text-slate-500 mt-1 leading-relaxed">
              {emptyMessage || 'Select an optimization batch to view its routes.'}
            </p>
          </div>
        </div>
      )}

      {/* Floating Summary Badge in Top Right — Exactly matching attached reference */}
      <div className="absolute top-3 right-3 z-10 bg-white/95 backdrop-blur-sm px-4 py-2.5 rounded-lg border border-slate-200 shadow-lg text-slate-800 pointer-events-auto select-none min-w-[170px]">
        {selectedBatchInfo?.planningDate && (
          <div className="text-[10px] font-extrabold text-[#7B91EE] uppercase tracking-wider mb-1 pb-1 border-b border-slate-100 flex items-center justify-between gap-2">
            <span>Date: {selectedBatchInfo.planningDate}</span>
            {selectedBatchInfo.batchId && (
              <span className="text-slate-400 font-normal">
                {typeof selectedBatchInfo.batchId === 'number'
                  ? `Batch #${selectedBatchInfo.batchId}`
                  : ''}
              </span>
            )}
          </div>
        )}
        <div className="text-sm font-bold text-slate-900 leading-tight">
          {routes.length > 0 ? `${totalStores} stores covered` : '0 stores on map'}
        </div>
        <div className="text-xs text-slate-600 font-medium mt-0.5">
          {totalVehicles} vehicle{totalVehicles !== 1 ? 's' : ''} · {totalDistance.toFixed(1)} km
        </div>
        <div className="text-xs text-slate-500 font-medium">
          Max route {maxRouteDur} min
        </div>
        {isRoadRoutingLoading && (
          <div className="mt-1.5 pt-1.5 border-t border-slate-200 flex items-center gap-1.5 text-[11px] text-blue-600 font-semibold">
            <span className="inline-block w-2 h-2 rounded-full bg-blue-600 animate-ping" />
            <span>Calculating road network…</span>
          </div>
        )}
      </div>
    </div>
  );
};
