import React from 'react';
import {
  Truck,
  Building2,
  Scale,
  Flame,
  CheckCircle2,
  ShieldCheck,
  Activity,
  ArrowRight,
  FileCheck2,
} from 'lucide-react';

export const OperationsGraphic: React.FC = () => {
  return (
    <div className="w-full max-w-xl mx-auto space-y-4">
      {/* Telemetry Header Bar */}
      <div className="flex items-center justify-between px-4 py-2.5 rounded-xl bg-charcoal-950/60 border border-charcoal-800/80 backdrop-blur-sm text-xs">
        <div className="flex items-center gap-2">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
          </span>
          <span className="font-semibold text-charcoal-200 tracking-wide uppercase text-[10px]">
            Operations Mesh Active
          </span>
        </div>
        <div className="flex items-center gap-3 text-[11px] text-charcoal-400">
          <span className="flex items-center gap-1 font-mono text-charcoal-300">
            <Activity className="w-3.5 h-3.5 text-periwinkle" /> RT-2026-A
          </span>
          <span className="inline-block w-1 h-1 rounded-full bg-charcoal-700" />
          <span className="text-emerald-400 font-medium">8/8 Verified</span>
        </div>
      </div>

      {/* Main Flow Card */}
      <div className="rounded-2xl bg-charcoal-900/90 border border-charcoal-800 p-5 shadow-2xl relative overflow-hidden">
        {/* Subtle background grid pattern */}
        <div
          className="absolute inset-0 opacity-[0.03] pointer-events-none"
          style={{
            backgroundImage:
              'radial-gradient(circle at 1px 1px, #ffffff 1px, transparent 0)',
            backgroundSize: '20px 20px',
          }}
        />

        <div className="relative space-y-4">
          {/* Top Stage Indicators */}
          <div className="grid grid-cols-4 gap-2 text-center pb-3 border-b border-charcoal-800/80 text-[10px] uppercase font-bold tracking-wider">
            <div className="text-periwinkle flex items-center justify-center gap-1">
              <span className="w-4 h-4 rounded-full bg-periwinkle/20 text-periwinkle flex items-center justify-center text-[9px]">1</span>
              <span>Planning</span>
            </div>
            <div className="text-periwinkle flex items-center justify-center gap-1">
              <span className="w-4 h-4 rounded-full bg-periwinkle/20 text-periwinkle flex items-center justify-center text-[9px]">2</span>
              <span>Dispatch</span>
            </div>
            <div className="text-emerald-400 flex items-center justify-center gap-1">
              <span className="w-4 h-4 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center text-[9px]">3</span>
              <span>Intake</span>
            </div>
            <div className="text-charcoal-400 flex items-center justify-center gap-1">
              <span className="w-4 h-4 rounded-full bg-charcoal-800 text-charcoal-400 flex items-center justify-center text-[9px]">4</span>
              <span>Disposal</span>
            </div>
          </div>

          {/* Node 1: Origin Pickup */}
          <div className="flex items-start gap-3 p-3 rounded-xl bg-charcoal-950/70 border border-charcoal-800/90 hover:border-charcoal-700 transition-colors">
            <div className="w-8 h-8 rounded-lg bg-periwinkle/15 border border-periwinkle/30 flex items-center justify-center flex-shrink-0 text-periwinkle mt-0.5">
              <Building2 className="w-4 h-4" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-semibold text-charcoal-100 truncate">
                  Apex Specialty Care — Unit 4B
                </span>
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  <CheckCircle2 className="w-3 h-3" /> OTP Verified
                </span>
              </div>
              <div className="flex items-center gap-3 mt-1 text-[11px] text-charcoal-400">
                <span>Cat. 1 Pharmaceutical Waste</span>
                <span>•</span>
                <span className="font-mono text-charcoal-300">18.5 kg Sealed</span>
              </div>
            </div>
          </div>

          {/* Connector with transit badge */}
          <div className="relative pl-7 py-0.5">
            <div className="absolute left-7 top-0 bottom-0 w-px bg-gradient-to-b from-periwinkle/40 via-emerald-400/40 to-charcoal-800" />
            <div className="flex items-center gap-2 pl-4 py-1 text-[11px] text-charcoal-400 font-mono">
              <Truck className="w-3.5 h-3.5 text-periwinkle animate-pulse" />
              <span>Transit Fleet EV-04 · Driver Assigned · On Schedule</span>
            </div>
          </div>

          {/* Node 2: Central Warehouse Intake */}
          <div className="flex items-start gap-3 p-3 rounded-xl bg-charcoal-950/70 border border-charcoal-800/90 hover:border-charcoal-700 transition-colors">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center flex-shrink-0 text-emerald-400 mt-0.5">
              <Scale className="w-4 h-4" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-semibold text-charcoal-100 truncate">
                  Central Warehouse WH-01 (Segregation Hub)
                </span>
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  Tare Matched
                </span>
              </div>
              <div className="flex items-center gap-3 mt-1 text-[11px] text-charcoal-400">
                <span>Intake Gross: 18.5 kg</span>
                <span>•</span>
                <span className="text-emerald-400 font-medium">Variance: 0.00% (No Divergence)</span>
              </div>
            </div>
          </div>

          {/* Connector to Treatment */}
          <div className="relative pl-7 py-0.5">
            <div className="absolute left-7 top-0 bottom-0 w-px bg-charcoal-800" />
            <div className="flex items-center gap-2 pl-4 py-1 text-[11px] text-charcoal-400 font-mono">
              <FileCheck2 className="w-3.5 h-3.5 text-charcoal-400" />
              <span>Manifest Form-VI Issued · Digital Custody Locked</span>
            </div>
          </div>

          {/* Node 3: CBMWTF Facility */}
          <div className="flex items-start gap-3 p-3 rounded-xl bg-charcoal-950/70 border border-charcoal-800/90 hover:border-charcoal-700 transition-colors">
            <div className="w-8 h-8 rounded-lg bg-amber-500/15 border border-amber-500/30 flex items-center justify-center flex-shrink-0 text-amber-400 mt-0.5">
              <Flame className="w-4 h-4" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-semibold text-charcoal-100 truncate">
                  Regional CBMWTF Incineration Facility
                </span>
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-periwinkle/10 text-periwinkle border border-periwinkle/20">
                  Ready for Treatment
                </span>
              </div>
              <div className="flex items-center gap-3 mt-1 text-[11px] text-charcoal-400">
                <span>Destruction Certificate Workflow Queued</span>
              </div>
            </div>
          </div>
        </div>

        {/* Regulatory Ledger Strip */}
        <div className="mt-4 pt-3.5 border-t border-charcoal-800/80 flex items-center justify-between text-[11px] text-charcoal-400">
          <div className="flex items-center gap-1.5 text-charcoal-300">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            <span>CDSCO & State PCB Audit Ready</span>
          </div>
          <span className="font-mono text-[10px] text-charcoal-500">Hash: e8f2...94a1</span>
        </div>
      </div>

      {/* Illustrative Disclaimer Note */}
      <div className="text-center">
        <p className="text-[11px] text-charcoal-400 tracking-wide font-medium">
          Illustrative operational telemetry preview · Secure platform access restricted to authorized personnel
        </p>
      </div>
    </div>
  );
};
