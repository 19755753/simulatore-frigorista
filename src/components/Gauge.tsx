interface GaugeProps {
  kind: 'HP' | 'BP';
  valueBar: number | null;
  maxBar: number;
  active: boolean;
}

const START_ANGLE = -120;
const END_ANGLE = 120;

export function Gauge({ kind, valueBar, maxBar, active }: GaugeProps) {
  const color = kind === 'HP' ? '#d64545' : '#3f7fd6';
  const displayValue = active && valueBar !== null ? valueBar : 0;
  const fraction = Math.min(Math.max(displayValue / maxBar, 0), 1);
  const angle = START_ANGLE + fraction * (END_ANGLE - START_ANGLE);

  const ticks = Array.from({ length: 7 }, (_, i) => i / 6);

  return (
    <div className={`gauge gauge-${kind.toLowerCase()}`}>
      <svg viewBox="0 0 140 120" className="gauge-svg" role="img" aria-label={`Manometro ${kind}`}>
        <circle cx="70" cy="66" r="58" fill="#1b2126" stroke={color} strokeWidth="3" />
        <circle cx="70" cy="66" r="58" fill="none" stroke={color} strokeWidth="1" opacity="0.3" />
        {ticks.map((t, i) => {
          const a = (START_ANGLE + t * (END_ANGLE - START_ANGLE)) * (Math.PI / 180);
          const x1 = 70 + Math.sin(a) * 50;
          const y1 = 66 - Math.cos(a) * 50;
          const x2 = 70 + Math.sin(a) * 42;
          const y2 = 66 - Math.cos(a) * 42;
          return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="#8b959e" strokeWidth="2" />;
        })}
        <text x="70" y="94" textAnchor="middle" fill="#8b959e" fontSize="8">bar assoluti</text>
        <g style={{ transform: `rotate(${angle}deg)`, transformOrigin: '70px 66px', transition: 'transform 900ms cubic-bezier(0.22, 1, 0.36, 1)' }}>
          <line x1="70" y1="66" x2="70" y2="20" stroke={color} strokeWidth="3" strokeLinecap="round" />
        </g>
        <circle cx="70" cy="66" r="6" fill={color} />
        <text x="70" y="106" textAnchor="middle" fill={color} fontSize="13" fontWeight="700">
          {kind}
        </text>
      </svg>
      <div className="gauge-readout" style={{ color }}>
        {active && valueBar !== null ? `${valueBar.toFixed(1)} bar` : '— bar'}
      </div>
    </div>
  );
}
