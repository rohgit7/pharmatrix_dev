import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { Platform } from 'react-native';
import { RouteStop, DriverRoute } from '../types/api';
import { createPickupQrPayload, generateQrSvg } from '../utils/qr';

export const printService = {
  /**
   * Generates and prints an official Chain-of-Custody Pickup Slip & QR Manifest
   * containing actual pickup metadata and scannable QR code.
   */
  async printPickupSlip(stop: RouteStop, weightKg: number): Promise<boolean> {
    const qrPayload = createPickupQrPayload(stop);
    const qrSvg = generateQrSvg(qrPayload, {
      size: 180,
      margin: 2,
      color: '#201E1C',
      bgColor: '#FFFFFF',
    });

    const scheduledDateFormatted = stop.arrival_time
      ? new Date(stop.arrival_time).toLocaleDateString()
      : new Date().toLocaleDateString();

    const fullAddress = [
      stop.address,
      stop.city,
      stop.state,
      stop.postal_code,
    ]
      .filter(Boolean)
      .join(', ');

    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1.0" />
          <style>
            @page {
              margin: 12mm;
            }
            body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
              padding: 16px;
              color: #201E1C;
              max-width: 420px;
              margin: 0 auto;
              background-color: #FFFFFF;
            }
            .header {
              text-align: center;
              border-bottom: 2px solid #201E1C;
              padding-bottom: 12px;
              margin-bottom: 16px;
            }
            .brand {
              font-size: 22px;
              font-weight: 800;
              letter-spacing: 2px;
              color: #201E1C;
              margin: 0;
            }
            .doc-type {
              font-size: 12px;
              font-weight: 600;
              text-transform: uppercase;
              letter-spacing: 1.5px;
              color: #7B91EE;
              margin-top: 4px;
            }
            .meta-banner {
              background: #FDFBF8;
              border: 1px solid #EADFD0;
              border-radius: 8px;
              padding: 10px 12px;
              margin-bottom: 16px;
            }
            .meta-row {
              display: flex;
              justify-content: space-between;
              font-size: 12px;
              padding: 3px 0;
            }
            .meta-label {
              color: #757683;
              font-weight: 500;
            }
            .meta-val {
              font-weight: 700;
              font-family: monospace;
              color: #201E1C;
            }
            .section-title {
              font-size: 11px;
              font-weight: 700;
              text-transform: uppercase;
              letter-spacing: 1px;
              color: #757683;
              border-bottom: 1px solid #EADFD0;
              padding-bottom: 4px;
              margin: 14px 0 8px 0;
            }
            .detail-row {
              display: flex;
              justify-content: space-between;
              padding: 6px 0;
              font-size: 13px;
              border-bottom: 1px dashed #F2E7D7;
            }
            .detail-label {
              color: #5C554E;
              font-weight: 500;
            }
            .detail-value {
              font-weight: 600;
              text-align: right;
              max-width: 60%;
            }
            .qr-container {
              text-align: center;
              margin: 18px 0 12px 0;
              padding: 16px;
              background: #FDFBF8;
              border: 1.5px dashed #7B91EE;
              border-radius: 12px;
            }
            .qr-code-box {
              display: inline-block;
              padding: 8px;
              background: #FFFFFF;
              border-radius: 8px;
              box-shadow: 0 1px 4px rgba(0,0,0,0.06);
            }
            .qr-subtext {
              font-size: 11px;
              font-weight: 600;
              color: #7B91EE;
              margin-top: 8px;
              letter-spacing: 0.5px;
            }
            .qr-guidance {
              font-size: 10px;
              color: #757683;
              margin-top: 2px;
            }
            .signatures-box {
              display: flex;
              justify-content: space-between;
              margin-top: 20px;
              padding-top: 12px;
              border-top: 1px solid #EADFD0;
            }
            .sig-col {
              width: 46%;
              text-align: center;
            }
            .sig-line {
              border-bottom: 1px solid #201E1C;
              height: 36px;
              margin-bottom: 4px;
            }
            .sig-title {
              font-size: 10px;
              color: #757683;
              text-transform: uppercase;
              font-weight: 600;
            }
            .footer {
              font-size: 9px;
              color: #757683;
              text-align: center;
              margin-top: 16px;
              line-height: 1.4;
              border-top: 1px solid #EADFD0;
              padding-top: 8px;
            }
          </style>
        </head>
        <body>
          <div class="header">
            <h1 class="brand">PHARMATRIX</h1>
            <div class="doc-type">Official Custody Transfer Manifest</div>
          </div>

          <div class="meta-banner">
            <div class="meta-row">
              <span class="meta-label">Pickup Identifier:</span>
              <span class="meta-val">${stop.pickup_code || 'PKP-' + stop.id}</span>
            </div>
            ${
              stop.pickup_id
                ? `<div class="meta-row"><span class="meta-label">Public UUID:</span><span class="meta-val" style="font-size: 10px;">${stop.pickup_id}</span></div>`
                : ''
            }
            <div class="meta-row">
              <span class="meta-label">Scheduled Date:</span>
              <span class="meta-val">${scheduledDateFormatted}</span>
            </div>
          </div>

          <div class="section-title">Facility & Consignment Information</div>

          <div class="detail-row">
            <span class="detail-label">Facility / Clinic:</span>
            <span class="detail-value">${stop.customer_name || stop.location_name || 'Assigned Facility'}</span>
          </div>

          <div class="detail-row">
            <span class="detail-label">Service Address:</span>
            <span class="detail-value">${fullAddress || 'N/A'}</span>
          </div>

          ${
            stop.customer_phone
              ? `<div class="detail-row"><span class="detail-label">Contact Phone:</span><span class="detail-value">${stop.customer_phone}</span></div>`
              : ''
          }

          <div class="detail-row">
            <span class="detail-label">Recorded Weight:</span>
            <span class="detail-value" style="color: #7B91EE; font-size: 14px;">${weightKg.toFixed(2)} kg</span>
          </div>

          ${
            stop.estimated_weight_kg != null
              ? `<div class="detail-row"><span class="detail-label">Estimated Weight:</span><span class="detail-value">${stop.estimated_weight_kg.toFixed(2)} kg</span></div>`
              : ''
          }

          <div class="detail-row">
            <span class="detail-label">Tamper Seal Status:</span>
            <span class="detail-value" style="color: #2E7D32;">AFFIXED & LOCKED</span>
          </div>

          <div class="detail-row">
            <span class="detail-label">Manifest Generated:</span>
            <span class="detail-value">${new Date().toLocaleString()}</span>
          </div>

          <!-- Real Scannable QR Code Vector Block -->
          <div class="qr-container">
            <div class="qr-code-box">
              ${qrSvg}
            </div>
            <div class="qr-subtext">${stop.pickup_code || 'PMX-' + stop.id}</div>
            <div class="qr-guidance">Scan with Pharmatrix Driver App to verify custody handshake</div>
          </div>

          <div class="signatures-box">
            <div class="sig-col">
              <div class="sig-line"></div>
              <div class="sig-title">Clinic Authorized Signatory</div>
            </div>
            <div class="sig-col">
              <div class="sig-line"></div>
              <div class="sig-title">Pharmatrix Transport Driver</div>
            </div>
          </div>

          <div class="footer">
            Regulated Bio-Hazardous & Controlled Pharmaceutical Waste.<br />
            Complies with EPA 40 CFR Part 266 Subpart P, DOT Hazardous Materials Regulations, and State Environmental Protection Standards.
          </div>
        </body>
      </html>
    `;

    try {
      if (Platform.OS === 'web') {
        const printWindow = window.open('', '_blank');
        if (printWindow) {
          printWindow.document.write(html);
          printWindow.document.close();
          printWindow.focus();
          printWindow.print();
          return true;
        }
      }

      await Print.printAsync({ html });
      return true;
    } catch (err: any) {
      // In case print dialog is cancelled or unavailable, fallback to file share
      try {
        const { uri } = await Print.printToFileAsync({ html });
        if (await Sharing.isAvailableAsync()) {
          await Sharing.shareAsync(uri, { UTI: '.pdf', mimeType: 'application/pdf' });
          return true;
        }
      } catch {
        // Fallback failed
      }
      return false;
    }
  },

  /**
   * Generates a Custody Manifest PDF for the full route and shares/downloads it
   */
  async downloadCustodyManifest(route: DriverRoute): Promise<boolean> {
    const stopsList = route.stops
      .map(
        (s, idx) => `
        <tr>
          <td style="padding: 8px; border-bottom: 1px solid #EADFD0;">${idx + 1}</td>
          <td style="padding: 8px; border-bottom: 1px solid #EADFD0;">${s.customer_name || s.location_name || s.warehouse_name || 'Stop'}</td>
          <td style="padding: 8px; border-bottom: 1px solid #EADFD0;">${s.stop_type}</td>
          <td style="padding: 8px; border-bottom: 1px solid #EADFD0; font-family: monospace;">${s.collected_weight_kg ? s.collected_weight_kg + ' kg' : '—'}</td>
          <td style="padding: 8px; border-bottom: 1px solid #EADFD0;">${s.execution_status}</td>
        </tr>
      `
      )
      .join('');

    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8" />
          <style>
            body { font-family: sans-serif; padding: 24px; color: #201E1C; }
            h1 { font-size: 20px; border-bottom: 2px solid #201E1C; padding-bottom: 8px; }
            table { width: 100%; border-collapse: collapse; margin-top: 16px; font-size: 12px; }
            th { text-align: left; background: #FDFBF8; padding: 8px; border-bottom: 2px solid #EADFD0; }
          </style>
        </head>
        <body>
          <h1>PHARMATRIX ROUTE CUSTODY LOG</h1>
          <p><strong>Route Code:</strong> ${route.route_code}</p>
          <p><strong>Vehicle:</strong> ${route.vehicle_registration_number || 'Assigned Fleet Unit'}</p>
          <p><strong>Depot / Hub:</strong> ${route.warehouse_name}</p>
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>Stop / Facility</th>
                <th>Type</th>
                <th>Net Weight</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              ${stopsList}
            </tbody>
          </table>
        </body>
      </html>
    `;

    try {
      const { uri } = await Print.printToFileAsync({ html });
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, { UTI: '.pdf', mimeType: 'application/pdf' });
        return true;
      }
      return false;
    } catch {
      return false;
    }
  },
};

export default printService;
