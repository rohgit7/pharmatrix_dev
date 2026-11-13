import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import {
  Navigation,
  MapPin,
  Truck,
  Phone,
  Clock,
  Compass,
  AlertCircle,
  ExternalLink,
  RotateCw,
} from 'lucide-react';
import { PickupDriverInfo, PickupCustomerInfo } from '../../types/operations';
import { fetchRoadRoute } from '../../services/routingService';
import { formatDateTime, formatDistance, formatDuration } from '../../utils/formatters';

interface LiveDriverMapProps {
  driver: PickupDriverInfo | null | undefined;
  customer: PickupCustomerInfo;
  routeCode?: string | null;
  className?: string;
  onRefreshLocation?: () => void;
  isRefreshing?: boolean;
}

export const LiveDriverMap: React.FC<LiveDriverMapProps> = ({
  driver,
  customer,
  routeCode,
  className = 'h-96 w-full',
  onRefreshLocation,
  isRefreshing = false,
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const routeLayerRef = useRef<L.Polyline | null>(null);
  const markersLayerRef = useRef<L.LayerGroup | null>(null);

  const [roadDistanceKm, setRoadDistanceKm] = useState<number | null>(null);
  const [roadDurationMin, setRoadDurationMin] = useState<number | null>(null);
  const [isRoutingLoading, setIsRoutingLoading] = useState<boolean>(false);

  const hasDriverGps = Boolean(
    driver &&
    typeof driver.current_latitude === 'number' &&
    typeof driver.current_longitude === 'number' &&
    !isNaN(driver.current_latitude) &&
    !isNaN(driver.current_longitude)
  );

  const hasCustomerGps = Boolean(
    typeof customer.latitude === 'number' &&
    typeof customer.longitude === 'number' &&
    !isNaN(customer.latitude) &&
    !isNaN(customer.longitude)
  );

  // Initialize Leaflet Map
  useEffect(() => {
    if (!mapContainerRef.current) return;

    if (!mapInstanceRef.current) {
      // Default center: customer GPS or Bangalore fallback
      const centerLat = customer.latitude || 12.9716;
      const centerLng = customer.longitude || 77.5946;

      const map = L.map(mapContainerRef.current, {
        center: [centerLat, centerLng],
        zoom: 14,
        zoomControl: true,
      });

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors',
        maxZoom: 19,
      }).addTo(map);

      markersLayerRef.current = L.layerGroup().addTo(map);
      mapInstanceRef.current = map;
    }

    const map = mapInstanceRef.current;
    if (!map) return;

    // Clear existing markers and route
    if (markersLayerRef.current) {
      markersLayerRef.current.clearLayers();
    }
    if (routeLayerRef.current) {
      routeLayerRef.current.remove();
      routeLayerRef.current = null;
    }

    const boundsPoints: [number, number][] = [];

    // 1. Customer Location Marker
    if (hasCustomerGps && customer.latitude && customer.longitude) {
      const custIcon = L.divIcon({
        className: 'custom-customer-marker',
        html: `
          <div style="background-color: #201E1C; color: #FFFFFF; width: 34px; height: 34px; border-radius: 50%; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 6px rgba(0,0,0,0.3); border: 2px solid #FFFFFF;">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"></path>
              <circle cx="12" cy="10" r="3"></circle>
            </svg>
          </div>
        `,
        iconSize: [34, 34],
        iconAnchor: [17, 34],
      });

      const customerMarker = L.marker([customer.latitude, customer.longitude], { icon: custIcon })
        .bindPopup(`
          <div style="font-family: inherit; font-size: 12px; padding: 4px;">
            <strong style="color: #201E1C; font-size: 13px;">${customer.display_name}</strong>
            <p style="margin: 4px 0 0; color: #555;">${customer.address || customer.location_name || 'Customer Location'}</p>
          </div>
        `);

      markersLayerRef.current?.addLayer(customerMarker);
      boundsPoints.push([customer.latitude, customer.longitude]);
    }

    // 2. Driver Location Marker (if available)
    if (hasDriverGps && driver && driver.current_latitude && driver.current_longitude) {
      const isLive = driver.location_live;
      const pulseHtml = isLive
        ? '<div style="position: absolute; width: 44px; height: 44px; border-radius: 50%; background-color: #7B91EE; opacity: 0.35; animation: ping 2s cubic-bezier(0, 0, 0.2, 1) infinite;"></div>'
        : '';

      const driverIcon = L.divIcon({
        className: 'custom-driver-marker',
        html: `
          <div style="position: relative; width: 38px; height: 38px; display: flex; align-items: center; justify-content: center;">
            ${pulseHtml}
            <div style="background-color: #7B91EE; color: #FFFFFF; width: 34px; height: 34px; border-radius: 50%; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 10px rgba(123, 145, 238, 0.5); border: 2px solid #FFFFFF; z-index: 2;">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <path d="M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2"></path>
                <path d="M15 18H9"></path>
                <path d="M19 18h2a1 1 0 0 0 1-1v-3.65a1 1 0 0 0-.22-.624l-3.48-4.35A1 1 0 0 0 17.52 8H14"></path>
                <circle cx="17" cy="18" r="2"></circle>
                <circle cx="7" cy="18" r="2"></circle>
              </svg>
            </div>
          </div>
        `,
        iconSize: [38, 38],
        iconAnchor: [19, 19],
      });

      const driverMarker = L.marker([driver.current_latitude, driver.current_longitude], { icon: driverIcon })
        .bindPopup(`
          <div style="font-family: inherit; font-size: 12px; padding: 4px;">
            <strong style="color: #201E1C; font-size: 13px;">${driver.name || 'Assigned Driver'}</strong>
            <p style="margin: 2px 0; color: #555;">Vehicle: ${driver.vehicle?.registration_number || 'N/A'}</p>
            <p style="margin: 2px 0; color: #7B91EE; font-weight: 600;">${isLive ? 'Live GPS Active' : 'Last Recorded Location'}</p>
          </div>
        `);

      markersLayerRef.current?.addLayer(driverMarker);
      boundsPoints.push([driver.current_latitude, driver.current_longitude]);
    }

    // 3. Road Polyline via OSRM (if both points exist)
    if (
      hasDriverGps &&
      hasCustomerGps &&
      driver?.current_latitude &&
      driver?.current_longitude &&
      customer.latitude &&
      customer.longitude
    ) {
      setIsRoutingLoading(true);
      fetchRoadRoute([
        { lat: driver.current_latitude, lng: driver.current_longitude },
        { lat: customer.latitude, lng: customer.longitude },
      ])
        .then((geometry) => {
          setRoadDistanceKm(geometry.distanceKm);
          setRoadDurationMin(geometry.durationMin);

          if (mapInstanceRef.current) {
            const polyline = L.polyline(geometry.coordinates, {
              color: '#7B91EE',
              weight: 5,
              opacity: 0.85,
              dashArray: undefined,
              lineJoin: 'round',
            }).addTo(mapInstanceRef.current);

            routeLayerRef.current = polyline;
          }
        })
        .catch((err) => {
          console.warn('OSRM road routing fallback:', err);
          // Fallback straight line
          if (mapInstanceRef.current && driver.current_latitude && driver.current_longitude && customer.latitude && customer.longitude) {
            const fallbackLine = L.polyline(
              [
                [driver.current_latitude, driver.current_longitude],
                [customer.latitude, customer.longitude],
              ],
              {
                color: '#7B91EE',
                weight: 3,
                dashArray: '5, 8',
                opacity: 0.6,
              }
            ).addTo(mapInstanceRef.current);
            routeLayerRef.current = fallbackLine;
          }
        })
        .finally(() => {
          setIsRoutingLoading(false);
        });
    } else {
      setRoadDistanceKm(null);
      setRoadDurationMin(null);
    }

    // Fit map bounds
    if (boundsPoints.length > 1) {
      map.fitBounds(boundsPoints, { padding: [50, 50], maxZoom: 16 });
    } else if (boundsPoints.length === 1) {
      map.setView(boundsPoints[0], 15);
    }
  }, [
    driver?.current_latitude,
    driver?.current_longitude,
    driver?.location_live,
    customer.latitude,
    customer.longitude,
    hasDriverGps,
    hasCustomerGps,
  ]);

  return (
    <div className="bg-white rounded-xl border border-[#EADFD0] overflow-hidden shadow-xs flex flex-col">
      {/* Map Control Header */}
      <div className="px-5 py-3.5 border-b border-[#EADFD0] bg-[#FDFBF8] flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-[#E5EBFF] flex items-center justify-center text-[#7B91EE]">
            <Compass className="w-4 h-4" />
          </div>
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-[#201E1C]">
              Driver Live Telemetry & Dispatch Route
            </h4>
            <p className="text-[11px] text-[#201E1C]/60">
              {routeCode ? `Assigned to Route ${routeCode}` : 'Single Stop Direct Routing'}
            </p>
          </div>
        </div>

        {/* Live GPS Status & Refresh */}
        <div className="flex items-center gap-2.5">
          {hasDriverGps ? (
            <div className="flex items-center gap-2 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>{driver?.location_live ? 'Live GPS Transmitting' : 'Last Known Location'}</span>
            </div>
          ) : (
            <div className="flex items-center gap-2 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-800 border border-amber-200">
              <AlertCircle className="w-3.5 h-3.5 text-amber-600" />
              <span>Telemetry Pending</span>
            </div>
          )}

          {onRefreshLocation && (
            <button
              onClick={onRefreshLocation}
              disabled={isRefreshing}
              className="p-1.5 rounded-lg border border-[#EADFD0] bg-white text-[#201E1C]/70 hover:text-[#201E1C] hover:bg-gray-50 transition-colors disabled:opacity-50"
              title="Refresh GPS telemetry"
            >
              <RotateCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-[#7B91EE]' : ''}`} />
            </button>
          )}
        </div>
      </div>

      {/* Live location unavailable warning banner */}
      {!hasDriverGps && (
        <div className="bg-amber-50/90 border-b border-amber-200 px-4 py-2.5 text-xs text-amber-900 flex items-start gap-2.5">
          <AlertCircle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
          <div>
            <span className="font-bold">Live location unavailable:</span>{' '}
            {driver?.location_unavailable_reason ||
              'Driver mobile application has not yet started telemetry transmission for this route assignment. Showing customer pickup destination.'}
          </div>
        </div>
      )}

      {/* Map Leaflet Container */}
      <div className={`relative ${className}`}>
        <div ref={mapContainerRef} className="h-full w-full" style={{ zIndex: 1 }} />

        {/* Road ETA & Distance Badge Overlay (when available) */}
        {roadDistanceKm !== null && roadDurationMin !== null && (
          <div className="absolute bottom-3 left-3 z-[1000] bg-white/95 backdrop-blur-xs border border-[#EADFD0] px-3.5 py-2 rounded-lg shadow-md flex items-center gap-4 text-xs">
            <div>
              <span className="text-[10px] text-[#201E1C]/60 block uppercase font-bold">Driving Distance</span>
              <span className="font-extrabold text-[#201E1C] text-sm">
                {formatDistance(roadDistanceKm * 1000)}
              </span>
            </div>
            <div className="h-6 w-px bg-[#EADFD0]" />
            <div>
              <span className="text-[10px] text-[#201E1C]/60 block uppercase font-bold">Estimated Travel</span>
              <span className="font-extrabold text-[#7B91EE] text-sm">
                {formatDuration(roadDurationMin)}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Driver Summary Footer Strip */}
      <div className="px-5 py-3 bg-[#FDFBF8] border-t border-[#EADFD0] grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
        <div>
          <span className="text-[10px] text-[#201E1C]/50 uppercase font-semibold block">Assigned Driver</span>
          <span className="font-bold text-[#201E1C]">{driver?.name || 'Unassigned'}</span>
        </div>
        <div>
          <span className="text-[10px] text-[#201E1C]/50 uppercase font-semibold block">Driver Contact</span>
          <span className="font-semibold text-[#201E1C] flex items-center gap-1">
            <Phone className="w-3 h-3 text-[#7B91EE]" />
            {driver?.phone || 'N/A'}
          </span>
        </div>
        <div>
          <span className="text-[10px] text-[#201E1C]/50 uppercase font-semibold block">Vehicle / Reg</span>
          <span className="font-semibold text-[#201E1C]">
            {driver?.vehicle?.registration_number || 'No Vehicle Assigned'}
          </span>
        </div>
        <div>
          <span className="text-[10px] text-[#201E1C]/50 uppercase font-semibold block">Last GPS Ping</span>
          <span className="text-[#201E1C]/70">
            {driver?.last_location_update ? formatDateTime(driver.last_location_update) : 'Never'}
          </span>
        </div>
      </div>
    </div>
  );
};

