import { quotaTone } from "./filterAccounts";

export function clampPercent(value: number): number {
  if (Number.isNaN(value) || !Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, Math.round(value)));
}

export function dialStrokeDash(percent: number): string {
  return `${clampPercent(percent)}, 100`;
}

export interface CircularGaugeProps {
  model_name: string;
  percent: number;
  reset_text: string;
  window_label: string;
}

export function CircularGauge({ model_name, percent, reset_text, window_label }: CircularGaugeProps) {
  const safe_pct = clampPercent(percent);
  const tone = quotaTone(safe_pct);

  return (
    <div className={`bento-gauge-item ${tone}`}>
      <div className="bento-dial-wrap">
        <svg className="bento-dial-svg" viewBox="0 0 36 36" aria-hidden="true">
          <path
            className="bento-dial-bg"
            strokeWidth="3.5"
            fill="none"
            d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
          />
          <path
            className={`bento-dial-fill ${tone}`}
            strokeWidth="3.5"
            strokeDasharray={dialStrokeDash(safe_pct)}
            strokeLinecap="round"
            fill="none"
            d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
          />
        </svg>
        <span className="bento-dial-pct mono">{safe_pct}%</span>
      </div>
      <span className="bento-gauge-name" title={model_name}>{model_name}</span>
      <div className="bento-gauge-footer">
        <span className="bento-gauge-reset mono">{reset_text}</span>
        <span className="bento-gauge-window">{window_label}</span>
      </div>
    </div>
  );
}

