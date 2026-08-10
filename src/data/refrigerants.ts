// Tabelle di saturazione pressione/temperatura, passo 5°C, in bar assoluti.
// Fonte: CoolProp 7.2.0, cross-check ASHRAE Handbook / manufacturer datasheet (hvacptcharts.com).
// NON aggiungere fluidi senza dati verificati da fonte tecnica affidabile.
//
// Nota R404A: i valori forniti in origine per questo fluido erano relativi (gauge), non assoluti —
// erano sistematicamente ~1.013 bar più bassi degli equivalenti assoluti su tutti i 17 punti,
// mentre R32/R410A corrispondevano già ai valori assoluti. Corretti sommando l'offset atmosferico
// (1.013 bar) per restare coerenti con R32/R410A e con il resto dello strumento, che lavora sempre
// in bar assoluti.

export type RefrigerantId = 'R32' | 'R410A' | 'R404A';

export interface Refrigerant {
  id: RefrigerantId;
  label: string;
  classe: string; // classificazione di sicurezza ASHRAE (A1, A2L, ...)
  note: string;
  // bar assoluti, chiave = temperatura °C (multipli di 5)
  saturazioneBarAssoluti: Record<number, number>;
}

export const REFRIGERANTS: Record<RefrigerantId, Refrigerant> = {
  R32: {
    id: 'R32',
    label: 'R32',
    classe: 'A2L',
    note: 'Climatizzatori, lieve infiammabilità (A2L)',
    saturazioneBarAssoluti: {
      '-30': 2.75, '-25': 3.34, '-20': 4.04, '-15': 4.87, '-10': 5.82, '-5': 6.90,
      '0': 8.13, '5': 9.51, '10': 11.07, '15': 12.80, '20': 14.74, '25': 16.89,
      '30': 19.27, '35': 21.90, '40': 24.78, '45': 27.95, '50': 31.41,
    },
  },
  R410A: {
    id: 'R410A',
    label: 'R410A',
    classe: 'A1',
    note: 'Climatizzatori, non infiammabile (A1)',
    saturazioneBarAssoluti: {
      '-30': 2.70, '-25': 3.30, '-20': 4.00, '-15': 4.81, '-10': 5.74, '-5': 6.80,
      '0': 8.00, '5': 9.36, '10': 10.87, '15': 12.57, '20': 14.46, '25': 16.57,
      '30': 18.90, '35': 21.45, '40': 24.34, '45': 27.35, '50': 30.70,
    },
  },
  R404A: {
    id: 'R404A',
    label: 'R404A',
    classe: 'A1',
    note: 'Frigo commerciale, non infiammabile — in phase-down per GWP alto',
    saturazioneBarAssoluti: {
      '-30': 2.09, '-25': 2.54, '-20': 3.08, '-15': 3.69, '-10': 4.40, '-5': 5.20,
      '0': 6.11, '5': 7.13, '10': 8.28, '15': 9.56, '20': 10.98, '25': 12.55,
      '30': 14.29, '35': 16.20, '40': 18.30, '45': 20.60, '50': 23.11,
    },
  },
};

/** Interpola linearmente la pressione di saturazione (bar assoluti) per una temperatura qualsiasi. */
export function saturationBarAssoluti(refrigerant: RefrigerantId, tempC: number): number {
  const table = REFRIGERANTS[refrigerant].saturazioneBarAssoluti;
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

export const TEMP_RANGE = { min: -30, max: 50, step: 5 };
