import { DIAMETER_STROKE, type CompressorVariant, type TubeDiameter } from '../data/plantTypes';
import { REFRIGERANTS, type RefrigerantId } from '../data/refrigerants';
import type { ValvePosition } from '../data/serviceValveScenarios';

/**
 * Disegni SVG stilizzati (schematico tecnico, non fotorealistico) per i componenti
 * del circuito frigorifero. Ogni componente usa viewBox "0 0 160 110" per essere
 * intercambiabile nei riquadri della cassetta attrezzi e degli slot.
 */

const COPPER = '#c9793f';
const COPPER_DARK = '#8a4f28';
const METAL = '#9aa4ad';
const METAL_DARK = '#5c6670';
const GRAPHITE = '#232a30';
const HP_RED = '#d64545';
const BP_BLUE = '#3f7fd6';
const GREEN_OK = '#4caf6d';

export function CompressorSvg({ variant }: { variant: CompressorVariant }) {
  if (variant === 'semi-hermetique') {
    return (
      <svg viewBox="0 0 160 110" className="piece-svg" role="img" aria-label="Compressore a pistone semi-hermétique">
        {/* piedini */}
        <rect x="28" y="96" width="10" height="10" fill={METAL_DARK} />
        <rect x="122" y="96" width="10" height="10" fill={METAL_DARK} />
        {/* corpo squadrato */}
        <rect x="20" y="46" width="120" height="52" rx="4" fill={GRAPHITE} stroke={METAL} strokeWidth="2" />
        {/* testata cilindri */}
        <rect x="34" y="24" width="34" height="26" rx="3" fill={METAL_DARK} stroke={METAL} strokeWidth="2" />
        <circle cx="51" cy="37" r="7" fill="none" stroke={COPPER} strokeWidth="2" />
        <rect x="76" y="24" width="34" height="26" rx="3" fill={METAL_DARK} stroke={METAL} strokeWidth="2" />
        <circle cx="93" cy="37" r="7" fill="none" stroke={COPPER} strokeWidth="2" />
        {/* morsettiera */}
        <rect x="112" y="52" width="20" height="16" rx="2" fill="#3a4550" stroke={METAL} strokeWidth="1.5" />
        {/* raccordi */}
        <line x1="20" y1="60" x2="6" y2="60" stroke={BP_BLUE} strokeWidth="5" strokeLinecap="round" />
        <line x1="140" y1="70" x2="154" y2="70" stroke={HP_RED} strokeWidth="5" strokeLinecap="round" />
        <text x="80" y="112" textAnchor="middle" className="piece-label">Compressore a pistone</text>
      </svg>
    );
  }
  const scale = variant === 'ermetico-medio' ? 1.08 : 1;
  return (
    <svg viewBox="0 0 160 110" className="piece-svg" role="img" aria-label="Compressore ermetico">
      <g transform={`translate(80 62) scale(${scale}) translate(-80 -62)`}>
        {/* piedini */}
        <rect x="46" y="96" width="8" height="8" fill={METAL_DARK} />
        <rect x="106" y="96" width="8" height="8" fill={METAL_DARK} />
        {/* corpo ovale/cilindrico */}
        <ellipse cx="80" cy="66" rx="52" ry="30" fill={GRAPHITE} stroke={METAL} strokeWidth="2" />
        <ellipse cx="80" cy="66" rx="52" ry="30" fill="none" stroke={COPPER_DARK} strokeWidth="1" opacity="0.5" />
        {/* morsettiera elettrica in alto */}
        <rect x="64" y="30" width="32" height="18" rx="3" fill="#3a4550" stroke={METAL} strokeWidth="1.5" />
        <circle cx="72" cy="39" r="2.5" fill={COPPER} />
        <circle cx="80" cy="39" r="2.5" fill={COPPER} />
        <circle cx="88" cy="39" r="2.5" fill={COPPER} />
        {/* raccordi: aspirazione (blu, grosso, laterale) e mandata (rosso, sottile, alto) */}
        <line x1="28" y1="70" x2="14" y2="70" stroke={BP_BLUE} strokeWidth="6" strokeLinecap="round" />
        <line x1="122" y1="56" x2="136" y2="46" stroke={HP_RED} strokeWidth="4" strokeLinecap="round" />
      </g>
      <text x="80" y="112" textAnchor="middle" className="piece-label">Compressore ermetico</text>
    </svg>
  );
}

export function CondenserSvg() {
  return (
    <svg viewBox="0 0 160 110" className="piece-svg" role="img" aria-label="Condensatore con ventola">
      <rect x="10" y="30" width="88" height="52" rx="3" fill={GRAPHITE} stroke={METAL} strokeWidth="2" />
      {Array.from({ length: 7 }).map((_, i) => (
        <line key={i} x1={18 + i * 11} y1="34" x2={18 + i * 11} y2="78" stroke={COPPER} strokeWidth="2" opacity="0.85" />
      ))}
      <line x1="10" y1="42" x2="98" y2="42" stroke={METAL_DARK} strokeWidth="1.5" />
      <line x1="10" y1="70" x2="98" y2="70" stroke={METAL_DARK} strokeWidth="1.5" />
      {/* ventola */}
      <circle cx="128" cy="56" r="26" fill="#2c343b" stroke={METAL} strokeWidth="2" />
      <g stroke={METAL} strokeWidth="2.5" strokeLinecap="round">
        <line x1="128" y1="56" x2="128" y2="36" />
        <line x1="128" y1="56" x2="145" y2="66" />
        <line x1="128" y1="56" x2="111" y2="66" />
      </g>
      <circle cx="128" cy="56" r="4" fill={COPPER} />
      {/* frecce aria in uscita */}
      <g stroke={METAL} strokeWidth="2" fill="none" opacity="0.7">
        <path d="M158 46 l8 0 l-3 -3 M166 46 l-3 3" />
        <path d="M158 66 l8 0 l-3 -3 M166 66 l-3 3" />
      </g>
      <text x="80" y="102" textAnchor="middle" className="piece-label">Condensatore + ventola</text>
    </svg>
  );
}

export function FilterSvg() {
  return (
    <svg viewBox="0 0 160 110" className="piece-svg" role="img" aria-label="Filtro deidratatore">
      <line x1="10" y1="55" x2="30" y2="55" stroke={HP_RED} strokeWidth="6" />
      <rect x="30" y="34" width="100" height="42" rx="21" fill={GRAPHITE} stroke={METAL} strokeWidth="2" />
      <ellipse cx="51" cy="55" rx="8" ry="18" fill="none" stroke={COPPER} strokeWidth="1.5" opacity="0.6" />
      <ellipse cx="109" cy="55" rx="8" ry="18" fill="none" stroke={COPPER} strokeWidth="1.5" opacity="0.6" />
      <line x1="130" y1="55" x2="150" y2="55" stroke={HP_RED} strokeWidth="6" />
      {/* freccia di senso di flusso */}
      <path d="M96 55 h20 M108 47 l8 8 l-8 8" fill="none" stroke={COPPER} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      <text x="80" y="98" textAnchor="middle" className="piece-label">Filtro deidratatore</text>
    </svg>
  );
}

export function SightGlassSvg() {
  return (
    <svg viewBox="0 0 160 110" className="piece-svg" role="img" aria-label="Voyant liquide (spia liquido)">
      <line x1="10" y1="55" x2="52" y2="55" stroke={HP_RED} strokeWidth="6" />
      <rect x="52" y="38" width="56" height="34" rx="6" fill={GRAPHITE} stroke={METAL} strokeWidth="2" />
      <circle cx="80" cy="55" r="14" fill="#233a2b" stroke={GREEN_OK} strokeWidth="2.5" />
      <circle cx="80" cy="55" r="7" fill={GREEN_OK} opacity="0.55" />
      <line x1="108" y1="55" x2="150" y2="55" stroke={HP_RED} strokeWidth="6" />
      <text x="80" y="98" textAnchor="middle" className="piece-label">Voyant liquide</text>
    </svg>
  );
}

export function ExpansionValveSvg() {
  return (
    <svg viewBox="0 0 160 110" className="piece-svg" role="img" aria-label="Détendeur (valvola d'espansione)">
      <line x1="10" y1="50" x2="60" y2="50" stroke={HP_RED} strokeWidth="6" />
      {/* corpo a T */}
      <rect x="60" y="38" width="40" height="24" rx="4" fill={GRAPHITE} stroke={METAL} strokeWidth="2" />
      <rect x="74" y="20" width="12" height="20" rx="2" fill={GRAPHITE} stroke={METAL} strokeWidth="2" />
      <line x1="100" y1="50" x2="150" y2="50" stroke={BP_BLUE} strokeWidth="6" />
      {/* capillare al bulbo */}
      <path d="M80 20 C 78 8, 100 6, 116 12" fill="none" stroke={COPPER} strokeWidth="1.8" strokeDasharray="2 2" />
      <ellipse cx="122" cy="14" rx="10" ry="6" fill="none" stroke={COPPER} strokeWidth="2" />
      <text x="80" y="98" textAnchor="middle" className="piece-label">Détendeur</text>
    </svg>
  );
}

export function EvaporatorSvg() {
  return (
    <svg viewBox="0 0 160 110" className="piece-svg" role="img" aria-label="Evaporatore con ventola">
      {/* cella/vetrina stilizzata */}
      <rect x="4" y="14" width="152" height="80" rx="4" fill="none" stroke={METAL_DARK} strokeWidth="2" strokeDasharray="4 3" />
      <rect x="16" y="32" width="70" height="42" rx="3" fill={GRAPHITE} stroke={METAL} strokeWidth="2" />
      {Array.from({ length: 6 }).map((_, i) => (
        <line key={i} x1={23 + i * 11} y1="36" x2={23 + i * 11} y2="70" stroke={BP_BLUE} strokeWidth="2" opacity="0.8" />
      ))}
      <circle cx="118" cy="53" r="22" fill="#2c343b" stroke={METAL} strokeWidth="2" />
      <g stroke={METAL} strokeWidth="2.5" strokeLinecap="round">
        <line x1="118" y1="53" x2="118" y2="37" />
        <line x1="118" y1="53" x2="132" y2="61" />
        <line x1="118" y1="53" x2="104" y2="61" />
      </g>
      <circle cx="118" cy="53" r="3.5" fill={COPPER} />
      <text x="80" y="102" textAnchor="middle" className="piece-label">Evaporatore + ventola</text>
    </svg>
  );
}

export function SilencerSvg() {
  return (
    <svg viewBox="0 0 160 110" className="piece-svg" role="img" aria-label="Silenziatore di mandata">
      <line x1="10" y1="55" x2="34" y2="55" stroke={HP_RED} strokeWidth="6" />
      <rect x="34" y="40" width="92" height="30" rx="15" fill={GRAPHITE} stroke={METAL} strokeWidth="2" />
      {Array.from({ length: 4 }).map((_, i) => (
        <line key={i} x1={52 + i * 18} y1="42" x2={52 + i * 18} y2="68" stroke={COPPER} strokeWidth="1.5" opacity="0.5" />
      ))}
      <line x1="126" y1="55" x2="150" y2="55" stroke={HP_RED} strokeWidth="6" />
      <text x="80" y="98" textAnchor="middle" className="piece-label">Silenziatore mandata</text>
    </svg>
  );
}

export function SuctionFilterSvg() {
  return (
    <svg viewBox="0 0 160 110" className="piece-svg" role="img" aria-label="Filtro aspirazione (opzionale)">
      <line x1="10" y1="55" x2="30" y2="55" stroke={BP_BLUE} strokeWidth="6" />
      <rect x="30" y="34" width="100" height="42" rx="21" fill={GRAPHITE} stroke={METAL} strokeWidth="2" strokeDasharray="5 4" />
      <ellipse cx="51" cy="55" rx="8" ry="18" fill="none" stroke={COPPER} strokeWidth="1.5" opacity="0.6" />
      <ellipse cx="109" cy="55" rx="8" ry="18" fill="none" stroke={COPPER} strokeWidth="1.5" opacity="0.6" />
      <line x1="130" y1="55" x2="150" y2="55" stroke={BP_BLUE} strokeWidth="6" />
      {/* freccia di senso di flusso */}
      <path d="M96 55 h20 M108 47 l8 8 l-8 8" fill="none" stroke={COPPER} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      <text x="80" y="98" textAnchor="middle" className="piece-label">Filtro aspirazione (opz.)</text>
    </svg>
  );
}

const VALVE_STEM_LENGTH: Record<ValvePosition, number> = {
  avanti: 6,
  intermedia: 16,
  indietro: 28,
};

export function ServiceValveSvg({ position }: { position: ValvePosition }) {
  const stemLen = VALVE_STEM_LENGTH[position];

  function row(y: number, color: string, label: string, key: string) {
    return (
      <g key={key} transform={`translate(0 ${y})`}>
        {/* verso l'unità esterna */}
        <line x1="4" y1="0" x2="46" y2="0" stroke={color} strokeWidth="7" strokeLinecap="round" />
        {/* corpo valvola */}
        <rect x="46" y="-16" width="94" height="32" rx="9" fill={GRAPHITE} stroke={METAL} strokeWidth="2" />
        {/* verso l'unità interna */}
        <line x1="140" y1="0" x2="182" y2="0" stroke={color} strokeWidth="7" strokeLinecap="round" />
        {/* presa di servizio con tappo colorato */}
        <line x1="93" y1="-16" x2="93" y2="-28" stroke={METAL} strokeWidth="4" />
        <circle cx="93" cy="-32" r="7" fill={color} stroke={METAL_DARK} strokeWidth="1.5" />
        {/* stelo di manovra (tige de commande), lunghezza = posizione */}
        <line x1="68" y1="16" x2="68" y2={16 + stemLen} stroke={METAL_DARK} strokeWidth="5" strokeLinecap="round" />
        <circle cx="68" cy={16 + stemLen + 6} r="6" fill={COPPER} stroke={METAL_DARK} strokeWidth="1.5" />
        <text x="196" y="4" fontSize="12" fontWeight="700" fill={METAL} textAnchor="start">{label}</text>
      </g>
    );
  }

  return (
    <svg viewBox="0 0 300 210" className="piece-svg" role="img" aria-label={`Valvole di servizio HP e BP, posizione ${position}`}>
      {row(60, HP_RED, 'Valvola HP', 'hp')}
      {row(160, BP_BLUE, 'Valvola BP', 'bp')}
    </svg>
  );
}

export function TubeSampleSvg({ color }: { color: 'hp' | 'bp' }) {
  const stroke = color === 'hp' ? HP_RED : BP_BLUE;
  return (
    <svg viewBox="0 0 160 40" className="piece-svg-tube" role="img" aria-label={color === 'hp' ? 'Tubo linea liquido' : 'Tubo aspirazione'}>
      <line x1="8" y1="20" x2="152" y2="20" stroke={stroke} strokeWidth="7" strokeLinecap="round" />
    </svg>
  );
}

export function TubePieceSvg({ kind, diametro }: { kind: 'tubo-hp' | 'tubo-bp'; diametro: TubeDiameter }) {
  const stroke = kind === 'tubo-hp' ? HP_RED : BP_BLUE;
  const width = DIAMETER_STROKE[diametro];
  return (
    <svg viewBox="0 0 160 70" className="piece-svg" role="img" aria-label={`Tubo ${kind === 'tubo-hp' ? 'HP' : 'BP'} ${diametro} pollici`}>
      <line x1="14" y1="30" x2="146" y2="30" stroke={stroke} strokeWidth={width} strokeLinecap="round" />
      <text x="80" y="58" textAnchor="middle" className="piece-label" fontSize="12" fontWeight="700">{diametro}"</text>
    </svg>
  );
}

const CYLINDER_LABEL_COLOR: Record<RefrigerantId, string> = {
  R32: '#5fb0a0',
  R410A: '#d97fae',
  R404A: '#e0a83f',
};

export function FluidCylinderSvg({ fluido }: { fluido: RefrigerantId }) {
  const band = CYLINDER_LABEL_COLOR[fluido];
  return (
    <svg viewBox="0 0 160 110" className="piece-svg" role="img" aria-label={`Bombola ${REFRIGERANTS[fluido].label}`}>
      <path d="M64 26 h32 v-10 h-32 z" fill={METAL_DARK} />
      <rect x="52" y="26" width="56" height="72" rx="10" fill={GRAPHITE} stroke={METAL} strokeWidth="2" />
      <rect x="52" y="46" width="56" height="20" fill={band} opacity="0.85" />
      <text x="80" y="60" textAnchor="middle" fontSize="11" fontWeight="700" fill="#14181b">{fluido}</text>
      <circle cx="80" cy="20" r="5" fill={METAL} />
      <text x="80" y="108" textAnchor="middle" className="piece-label">Bombola {fluido}</text>
    </svg>
  );
}
