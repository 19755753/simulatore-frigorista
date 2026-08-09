import type { RefrigerantId } from './refrigerants';

export type PlantTypeId = 'climatizzatore' | 'frigo-vetrina' | 'cella-commerciale';
export type CompressorVariant = 'ermetico-piccolo' | 'ermetico-medio' | 'semi-hermetique';
export type PowerCategory = 'piccolo' | 'medio' | 'grande';
export type TubeDiameter = '1/4' | '3/8' | '1/2' | '5/8' | '3/4' | '7/8';

export interface PlantType {
  id: PlantTypeId;
  label: string;
  descrizione: string;
  fluidiDisponibili: RefrigerantId[];
  fluidiNonVerificati?: string[]; // menzionati nella pratica ma senza dati verificati in v1
  compressoriDisponibili: CompressorVariant[];
  potenza: PowerCategory;
  hasSilenziatoreOpzionale?: boolean;
}

export const PLANT_TYPES: Record<PlantTypeId, PlantType> = {
  climatizzatore: {
    id: 'climatizzatore',
    label: 'Climatizzatore (monosplit residenziale)',
    descrizione: 'Impianto piccolo, fluido A2L o A1, compressore ermetico piccolo.',
    fluidiDisponibili: ['R32', 'R410A'],
    compressoriDisponibili: ['ermetico-piccolo'],
    potenza: 'piccolo',
  },
  'frigo-vetrina': {
    id: 'frigo-vetrina',
    label: 'Frigo / vetrina bar',
    descrizione: 'Impianto piccolo per refrigerazione commerciale leggera.',
    fluidiDisponibili: ['R404A'],
    fluidiNonVerificati: ['R134a'],
    compressoriDisponibili: ['ermetico-piccolo'],
    potenza: 'piccolo',
  },
  'cella-commerciale': {
    id: 'cella-commerciale',
    label: 'Cella commerciale (ristorante)',
    descrizione: 'Impianto medio-grande, compressore ermetico medio o semi-hermétique.',
    fluidiDisponibili: ['R404A'],
    fluidiNonVerificati: ['R448A', 'R449A'],
    compressoriDisponibili: ['ermetico-medio', 'semi-hermetique'],
    potenza: 'medio',
    hasSilenziatoreOpzionale: true,
  },
};

export const COMPRESSOR_POWER: Record<CompressorVariant, PowerCategory> = {
  'ermetico-piccolo': 'piccolo',
  'ermetico-medio': 'medio',
  'semi-hermetique': 'grande',
};

export const COMPRESSOR_LABEL: Record<CompressorVariant, string> = {
  'ermetico-piccolo': 'Compressore ermetico (piccolo)',
  'ermetico-medio': 'Compressore ermetico (medio)',
  'semi-hermetique': 'Compressore a pistone (semi-hermétique)',
};

export interface DiameterGuide {
  potenza: PowerCategory;
  label: string;
  hp: TubeDiameter[];
  bp: TubeDiameter[];
}

export const DIAMETER_GUIDE: DiameterGuide[] = [
  { potenza: 'piccolo', label: 'Piccolo (< 5 kW)', hp: ['1/4', '3/8'], bp: ['3/8', '1/2'] },
  { potenza: 'medio', label: 'Medio (5–15 kW)', hp: ['3/8', '1/2'], bp: ['1/2', '5/8'] },
  { potenza: 'grande', label: 'Grande (> 15 kW)', hp: ['1/2', '5/8', '3/4'], bp: ['5/8', '3/4', '7/8'] },
];

export const HP_DIAMETERS: TubeDiameter[] = ['1/4', '3/8', '1/2', '5/8', '3/4'];
export const BP_DIAMETERS: TubeDiameter[] = ['3/8', '1/2', '5/8', '3/4', '7/8'];

export function diameterGuideFor(potenza: PowerCategory): DiameterGuide {
  return DIAMETER_GUIDE.find((g) => g.potenza === potenza)!;
}

export const DIAMETER_STROKE: Record<TubeDiameter, number> = {
  '1/4': 3, '3/8': 4.5, '1/2': 6, '5/8': 7.5, '3/4': 9, '7/8': 10.5,
};
