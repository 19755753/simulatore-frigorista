// Tabelle di saturazione pressione/temperatura, passo 5°C, in kPa gauge.
// Fonte: CoolProp 7.2.0, cross-check ASHRAE Handbook / manufacturer datasheet (hvacptcharts.com).
// Conversione: bar_assoluti = kPa_gauge / 100 + 1.013
// NON aggiungere fluidi senza dati verificati da fonte tecnica affidabile.

export type RefrigerantId = 'R32' | 'R410A' | 'R404A';

export interface Refrigerant {
  id: RefrigerantId;
  label: string;
  classe: string; // classificazione di sicurezza ASHRAE (A1, A2L, ...)
  note: string;
  // kPa gauge, chiave = temperatura °C (multipli di 5)
  saturazioneKpaGauge: Record<number, number>;
}

export const REFRIGERANTS: Record<RefrigerantId, Refrigerant> = {
  R32: {
    id: 'R32',
    label: 'R32',
    classe: 'A2L',
    note: 'Climatizzatori, lieve infiammabilità (A2L)',
    saturazioneKpaGauge: {
      '-30': 172, '-25': 233, '-20': 304, '-15': 387, '-10': 481, '-5': 589,
      '0': 712, '5': 850, '10': 1006, '15': 1180, '20': 1373, '25': 1588,
      '30': 1826, '35': 2089, '40': 2377, '45': 2694, '50': 3040,
    },
  },
  R410A: {
    id: 'R410A',
    label: 'R410A',
    classe: 'A1',
    note: 'Climatizzatori, non infiammabile (A1)',
    saturazioneKpaGauge: {
      '-30': 169, '-25': 229, '-20': 299, '-15': 380, '-10': 473, '-5': 579,
      '0': 699, '5': 835, '10': 987, '15': 1157, '20': 1346, '25': 1556,
      '30': 1788, '35': 2044, '40': 2324, '45': 2633, '50': 2969,
    },
  },
  R404A: {
    id: 'R404A',
    label: 'R404A',
    classe: 'A1',
    note: 'Frigo commerciale, non infiammabile — in phase-down per GWP alto',
    saturazioneKpaGauge: {
      '-30': 107, '-25': 152, '-20': 206, '-15': 267, '-10': 338, '-5': 418,
      '0': 509, '5': 611, '10': 726, '15': 854, '20': 996, '25': 1153,
      '30': 1327, '35': 1518, '40': 1728, '45': 1958, '50': 2209,
    },
  },
};

const KPA_TO_BAR_OFFSET = 1.013;

/** Interpola linearmente la pressione di saturazione (kPa gauge) per una temperatura qualsiasi. */
export function saturationKpaGauge(refrigerant: RefrigerantId, tempC: number): number {
  const table = REFRIGERANTS[refrigerant].saturazioneKpaGauge;
  const keys = Object.keys(table).map(Number).sort((a, b) => a - b);
  const min = keys[0];
  const max = keys[keys.length - 1];
  const clamped = Math.min(Math.max(tempC, min), max);

  let lower = keys[0];
  let upper = keys[keys.length - 1];
  for (let i = 0; i < keys.length - 1; i++) {
    if (clamped >= keys[i] && clamped <= keys[i + 1]) {
      lower = keys[i];
      upper = keys[i + 1];
      break;
    }
  }
  if (lower === upper) return table[lower];
  const fraction = (clamped - lower) / (upper - lower);
  return table[lower] + fraction * (table[upper] - table[lower]);
}

/** Converte kPa gauge in bar assoluti. */
export function kpaGaugeToBarAssoluti(kpaGauge: number): number {
  return kpaGauge / 100 + KPA_TO_BAR_OFFSET;
}

/** Pressione di saturazione in bar assoluti per una data temperatura. */
export function saturationBarAssoluti(refrigerant: RefrigerantId, tempC: number): number {
  return kpaGaugeToBarAssoluti(saturationKpaGauge(refrigerant, tempC));
}

export const TEMP_RANGE = { min: -30, max: 50, step: 5 };
