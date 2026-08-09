import type { CompressorVariant, TubeDiameter } from './plantTypes';
import { REFRIGERANTS, type RefrigerantId } from './refrigerants';
import { BP_DIAMETERS, HP_DIAMETERS } from './plantTypes';

export type ComponentKind =
  | 'compressore'
  | 'condensatore'
  | 'filtro'
  | 'voyant'
  | 'detendeur'
  | 'evaporatore'
  | 'silenziatore'
  | 'tubo-hp'
  | 'tubo-bp'
  | 'fluido';

export interface ToolboxPiece {
  id: string;
  kind: ComponentKind;
  variant?: CompressorVariant;
  diametro?: TubeDiameter;
  fluido?: RefrigerantId;
  label: string;
  descrizioneBreve: string;
}

/** Sequenza obbligatoria degli slot del circuito (ordine di montaggio corretto). */
export const CIRCUIT_SLOTS: { id: ComponentKind; label: string; aiuto: string }[] = [
  { id: 'compressore', label: 'Compressore', aiuto: 'Comprime il gas refrigerante a bassa pressione portandolo ad alta pressione.' },
  { id: 'condensatore', label: 'Condensatore', aiuto: 'Il gas caldo ad alta pressione cede calore all\'aria e condensa in liquido.' },
  { id: 'filtro', label: 'Filtro deidratatore', aiuto: 'Trattiene umidità e impurità dal liquido. Va montato SUBITO dopo il condensatore.' },
  { id: 'voyant', label: 'Voyant liquide (spia liquido)', aiuto: 'Permette di vedere se il liquido è privo di bolle. Va montato DOPO il filtro, mai prima.' },
  { id: 'detendeur', label: 'Détendeur (valvola d\'espansione)', aiuto: 'Lamina il liquido riducendone pressione e temperatura prima dell\'evaporatore.' },
  { id: 'evaporatore', label: 'Evaporatore', aiuto: 'Il liquido a bassa pressione assorbe calore dall\'ambiente ed evapora.' },
];

/** Slot ausiliari: non fanno parte della sequenza di montaggio ma richiedono comunque un drag&drop. */
export const AUX_SLOTS: { id: ComponentKind; label: string; compactLabel: string; aiuto: string }[] = [
  { id: 'tubo-hp', label: 'Diametro linea liquido (HP)', compactLabel: 'Tubo HP', aiuto: 'Trascina qui il tubo con il diametro scelto per la linea alta pressione.' },
  { id: 'tubo-bp', label: 'Diametro aspirazione (BP)', compactLabel: 'Tubo BP', aiuto: 'Trascina qui il tubo con il diametro scelto per la linea bassa pressione.' },
  { id: 'fluido', label: 'Fluido frigorigeno', compactLabel: 'Fluido frigorigeno', aiuto: 'Trascina qui la bombola del fluido frigorigeno da caricare nell\'impianto.' },
];

export function toolboxForCompressors(compressori: CompressorVariant[]): ToolboxPiece[] {
  const pieces: ToolboxPiece[] = compressori.map((variant) => ({
    id: `compressore-${variant}`,
    kind: 'compressore',
    variant,
    label: compressorLabel(variant),
    descrizioneBreve: 'Da posizionare nello slot 1 del circuito.',
  }));

  pieces.push(
    { id: 'condensatore', kind: 'condensatore', label: 'Condensatore + ventola', descrizioneBreve: 'Slot 2: dopo il compressore.' },
    { id: 'filtro', kind: 'filtro', label: 'Filtro deidratatore', descrizioneBreve: 'Slot 3: dopo il condensatore.' },
    { id: 'voyant', kind: 'voyant', label: 'Voyant liquide', descrizioneBreve: 'Slot 4: dopo il filtro.' },
    { id: 'detendeur', kind: 'detendeur', label: 'Détendeur', descrizioneBreve: 'Slot 5: dopo il voyant.' },
    { id: 'evaporatore', kind: 'evaporatore', label: 'Evaporatore + ventola', descrizioneBreve: 'Slot 6: chiude il circuito verso il compressore.' },
  );
  return pieces;
}

function compressorLabel(variant: CompressorVariant): string {
  switch (variant) {
    case 'ermetico-piccolo': return 'Compressore ermetico (piccolo)';
    case 'ermetico-medio': return 'Compressore ermetico (medio)';
    case 'semi-hermetique': return 'Compressore a pistone (semi-hermétique)';
  }
}

export const SILENZIATORE_PIECE: ToolboxPiece = {
  id: 'silenziatore',
  kind: 'silenziatore',
  label: 'Silenziatore mandata (opzionale)',
  descrizioneBreve: 'Si monta sulla linea di mandata, tra compressore e condensatore. Facoltativo.',
};

export function toolboxTubesHP(): ToolboxPiece[] {
  return HP_DIAMETERS.map((d) => ({
    id: `tubo-hp-${d}`,
    kind: 'tubo-hp',
    diametro: d,
    label: `Tubo HP ${d}"`,
    descrizioneBreve: `Trascina sulla linea liquido (HP) se ${d}" è il diametro scelto.`,
  }));
}

export function toolboxTubesBP(): ToolboxPiece[] {
  return BP_DIAMETERS.map((d) => ({
    id: `tubo-bp-${d}`,
    kind: 'tubo-bp',
    diametro: d,
    label: `Tubo BP ${d}"`,
    descrizioneBreve: `Trascina sulla linea aspirazione (BP) se ${d}" è il diametro scelto.`,
  }));
}

export function toolboxFluids(fluidi: RefrigerantId[]): ToolboxPiece[] {
  return fluidi.map((f) => ({
    id: `fluido-${f}`,
    kind: 'fluido',
    fluido: f,
    label: `Bombola ${REFRIGERANTS[f].label}`,
    descrizioneBreve: REFRIGERANTS[f].note,
  }));
}
