import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { Alert } from 'react-native';
import { DriverRouteStopResponse, DriverRouteResponse } from '@/types/api';

export interface PrintSlipOptions {
  stop: DriverRouteStopResponse;
  route: DriverRouteResponse;
  driverName?: string;
  collectedWeightKg?: number;
  qrPayload?: string;
}

export async function printOrSharePickupSlip({
  stop,
  route,
  driverName = 'Assigned Driver',
  collectedWeightKg,
  qrPayload,
}: PrintSlipOptions): Promise<void> {
  const isPickup = stop.stop_type === 'PICKUP';
  const title = isPickup
    ? 'PHARMATRIX WASTE CONSIGNMENT SLIP'
    : 'PHARMATRIX CENTRAL FACILITY HANDOVER';
  const reference = stop.pickup_code || (stop.pickup_id ? `PU-${stop.pickup_id}` : `STOP-${stop.sequence_number}`);
  const timestamp = new Date().toLocaleString('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
  const weight =
    collectedWeightKg ??
    stop.collected_weight_kg ??
    stop.estimated_weight_kg ??
    0;

  const qrData =
    qrPayload ||
    (stop.pickup_code ? stop.pickup_code : `PHARMATRIX:${reference}:${stop.id || stop.sequence_number}`);

  const qrImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=220x220&margin=4&data=${encodeURIComponent(
    qrData
  )}`;

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${title}</title>
  <style>
    @page {
      size: auto;
      margin: 15mm;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      background-color: #FDFBF8;
      color: #201E1C;
      margin: 0;
      padding: 24px;
    }
    .slip-card {
      background: #FFFFFF;
      border: 1.5px solid #EADFD0;
      border-radius: 12px;
      max-width: 480px;
      margin: 0 auto;
      padding: 24px;
      box-shadow: 0 4px 12px rgba(32, 30, 28, 0.05);
    }
    .header {
      border-bottom: 2px solid #E5EBFF;
      padding-bottom: 16px;
      margin-bottom: 16px;
      text-align: center;
    }
    .brand-title {
      font-size: 20px;
      font-weight: 800;
      color: #201E1C;
      letter-spacing: 1px;
      margin: 0;
    }
    .brand-sub {
      font-size: 11px;
      font-weight: 600;
      color: #7B91EE;
      text-transform: uppercase;
      letter-spacing: 1.5px;
      margin-top: 4px;
    }
    .qr-container {
      text-align: center;
      margin: 20px 0;
      padding: 12px;
      background-color: #FDFBF8;
      border: 1px dashed #EADFD0;
      border-radius: 8px;
    }
    .qr-image {
      width: 180px;
      height: 180px;
      display: inline-block;
    }
    .qr-caption {
      font-family: monospace;
      font-size: 11px;
      color: #8C8476;
      margin-top: 6px;
      word-break: break-all;
    }
    .info-table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 12px;
    }
    .info-table tr {
      border-bottom: 1px solid #F3ECE3;
    }
    .info-table td {
      padding: 8px 0;
      font-size: 13px;
    }
    .label {
      color: #8C8476;
      font-weight: 500;
      width: 40%;
    }
    .value {
      color: #201E1C;
      font-weight: 600;
      text-align: right;
    }
    .badge {
      display: inline-block;
      padding: 4px 10px;
      background-color: #E5EBFF;
      color: #2563EB;
      font-weight: 700;
      font-size: 11px;
      border-radius: 6px;
    }
    .footer {
      margin-top: 24px;
      padding-top: 14px;
      border-top: 1px solid #EADFD0;
      text-align: center;
      font-size: 10px;
      color: #8C8476;
      line-height: 1.4;
    }
  </style>
</head>
<body>
  <div class="slip-card">
    <div class="header">
      <h1 class="brand-title">PHARMATRIX</h1>
      <div class="brand-sub">${title}</div>
    </div>

    <div class="qr-container">
      <img class="qr-image" src="${qrImageUrl}" alt="Verification QR" />
      <div class="qr-caption">${reference}</div>
    </div>

    <table class="info-table">
      <tr>
        <td class="label">Manifest Ref</td>
        <td class="value"><span class="badge">${reference}</span></td>
      </tr>
      <tr>
        <td class="label">Route ID</td>
        <td class="value">#${route.id} (${route.route_date || 'Today'})</td>
      </tr>
      <tr>
        <td class="label">Location Name</td>
        <td class="value">${escapeHtml(stop.customer_name || stop.location_name || stop.warehouse_name || 'Designated Stop')}</td>
      </tr>
      <tr>
        <td class="label">Address</td>
        <td class="value" style="font-size: 11px;">${escapeHtml(stop.address || stop.city || 'On File')}</td>
      </tr>
      <tr>
        <td class="label">Verified Weight</td>
        <td class="value">${weight} kg</td>
      </tr>
      <tr>
        <td class="label">Status</td>
        <td class="value">${stop.execution_status}</td>
      </tr>
      <tr>
        <td class="label">Operational Driver</td>
        <td class="value">${escapeHtml(driverName)}</td>
      </tr>
      <tr>
        <td class="label">Timestamp</td>
        <td class="value">${timestamp}</td>
      </tr>
    </table>

    <div class="footer">
      Regulated Pharmaceutical & Biomedical Waste Management Manifest.<br />
      Verified Handover Token • Chain-of-Custody Protected
    </div>
  </div>
</body>
</html>
  `;

  try {
    // Generate PDF file
    const { uri } = await Print.printToFileAsync({
      html,
      base64: false,
    });

    const isAvailable = await Sharing.isAvailableAsync();
    if (isAvailable) {
      await Sharing.shareAsync(uri, {
        UTI: '.pdf',
        mimeType: 'application/pdf',
        dialogTitle: `Pharmatrix Waste Slip - ${reference}`,
      });
    } else {
      // Direct print fallback
      await Print.printAsync({ html });
    }
  } catch (err: any) {
    if (err?.message?.includes('User canceled') || err?.message?.includes('cancelled')) {
      return;
    }
    Alert.alert('Slip Generation Error', err?.message || 'Unable to print or share manifest slip.');
  }
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
