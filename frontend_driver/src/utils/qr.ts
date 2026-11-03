// @ts-ignore
import { toQR } from 'toqr';
import { RouteStop } from '../types/api';

export interface QrMatrixData {
  matrix: number[];
  size: number;
}

export interface QrSvgOptions {
  size?: number;
  margin?: number;
  color?: string;
  bgColor?: string;
}

export interface ParsedPickupPayload {
  isValid: boolean;
  pickupCode?: string;
  pickupId?: string;
  locationId?: number;
  type?: string;
  raw: string;
}

/**
 * Computes a standard 2D bit-matrix from text using the tiny toQR encoder.
 * Size is the square dimension (e.g. 21 for v1, 25 for v2, etc.)
 */
export function generateQrMatrix(text: string): QrMatrixData {
  try {
    const raw = toQR(text);
    const size = Math.round(Math.sqrt(raw.length));
    const matrix: number[] = Array.from(raw);
    return { matrix, size };
  } catch (err) {
    // Return empty fallback matrix if encoding fails
    return { matrix: [], size: 0 };
  }
}

/**
 * Generates an SVG string containing the exact QR code vector squares.
 * Can be rendered directly in HTML (for printing) or via React Native Svg.
 */
export function generateQrSvg(
  text: string,
  options: QrSvgOptions = {}
): string {
  const {
    size = 200,
    margin = 2,
    color = '#201E1C',
    bgColor = '#FFFFFF',
  } = options;

  const { matrix, size: matrixDim } = generateQrMatrix(text);
  if (matrixDim === 0 || matrix.length === 0) {
    return `<svg width="${size}" height="${size}" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><rect width="100%" height="100%" fill="${bgColor}"/><text x="50" y="50" text-anchor="middle" font-size="10" fill="${color}">QR Unavailable</text></svg>`;
  }

  const viewBoxSize = matrixDim + margin * 2;
  let rects = '';

  for (let y = 0; y < matrixDim; y++) {
    for (let x = 0; x < matrixDim; x++) {
      if (matrix[y * matrixDim + x] === 1) {
        rects += `<rect x="${x + margin}" y="${y + margin}" width="1" height="1" fill="${color}"/>`;
      }
    }
  }

  return `<svg width="${size}" height="${size}" viewBox="0 0 ${viewBoxSize} ${viewBoxSize}" xmlns="http://www.w3.org/2000/svg" shape-rendering="crispEdges"><rect width="100%" height="100%" fill="${bgColor}"/>${rects}</svg>`;
}

/**
 * Generates a standardized, unambiguous QR payload for a pickup stop.
 * Contains both human-readable code, public UUID, and Pharmatrix tag identifier.
 */
export function createPickupQrPayload(stop: RouteStop): string {
  const payload = {
    type: 'PHARMATRIX_PICKUP',
    pickup_code: stop.pickup_code || `PKP-${stop.id}`,
    pickup_id: stop.pickup_id || undefined,
    location_id: stop.location_id || undefined,
    v: 1,
  };
  return JSON.stringify(payload);
}

/**
 * Parses and validates scanned QR data.
 * Accepts structured JSON payloads or raw pickup code/UUID strings.
 */
export function parsePickupQrPayload(scannedData: string): ParsedPickupPayload {
  const trimmed = scannedData.trim();
  if (!trimmed) {
    return { isValid: false, raw: scannedData };
  }

  // Attempt JSON parsing first
  if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
    try {
      const parsed = JSON.parse(trimmed);
      const pickupCode = parsed.pickup_code || parsed.code;
      const pickupId = parsed.pickup_id || parsed.id;
      const locationId = parsed.location_id;
      const type = parsed.type;

      if (pickupCode || pickupId) {
        return {
          isValid: true,
          pickupCode: pickupCode ? String(pickupCode) : undefined,
          pickupId: pickupId ? String(pickupId) : undefined,
          locationId: locationId ? Number(locationId) : undefined,
          type,
          raw: trimmed,
        };
      }
    } catch {
      // Fall through to raw string handling
    }
  }

  // Handle standard pickup code string pattern (e.g. PKP-2026-0001 or UUID)
  const isCodePattern = /^[A-Za-z0-9\-_]{4,50}$/.test(trimmed);
  return {
    isValid: isCodePattern,
    pickupCode: trimmed,
    pickupId: trimmed.includes('-') && trimmed.length === 36 ? trimmed : undefined,
    raw: trimmed,
  };
}

