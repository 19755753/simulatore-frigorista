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
  | 'filtro-aspirazione'
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

/** I 6 componenti del ciclo, nell'ordine fisico corretto di montaggio (ciclico). */
export const ORDERED_KINDS: ComponentKind[] = [
  'compressore', 'condensatore', 'filtro', 'voyant', 'detendeur', 'evaporatore',
];

export interface ComponentInfo {
  label: string;
  ruolo: string;
  perche: string;
}

/** Base di conoscenza didattica: cosa fa ogni componente e perché sta in quel punto del ciclo. */
export const COMPONENT_INFO: Record<ComponentKind, ComponentInfo> = {
  compressore: {
    label: 'Compressore',
    ruolo: 'aspira il gas a bassa pressione e lo comprime portandolo ad alta pressione e alta temperatura',
    perche: 'è il punto di partenza del ciclo: crea il salto di pressione che fa muovere tutto il fluido nel circuito',
  },
  condensatore: {
    label: 'Condensatore',
    ruolo: 'riceve il gas caldo ad alta pressione appena uscito dal compressore e lo raffredda fino a farlo condensare in liquido',
    perche: 'deve stare subito dopo il compressore: solo lì il fluido è ancora gas caldo ad alta pressione, pronto a cedere calore',
  },
  filtro: {
    label: 'Filtro deidratatore',
    ruolo: 'trattiene umidità e impurità dal liquido refrigerante',
    perche: 'va montato subito dopo il condensatore, perché a quel punto il fluido è già liquido: il filtro deidratatore funziona solo su liquido, non su gas',
  },
  voyant: {
    label: 'Voyant liquide',
    ruolo: 'permette di vedere a occhio se il liquido che scorre è privo di bolle di gas',
    perche: 'va montato dopo il filtro, mai prima: deve controllare il liquido già pulito e disidratato, appena prima che arrivi alla valvola di espansione',
  },
  detendeur: {
    label: 'Détendeur',
    ruolo: 'lamina il liquido ad alta pressione facendolo passare attraverso un piccolo orifizio, riducendone di colpo pressione e temperatura',
    perche: 'deve ricevere liquido pulito e senza bolle (per questo viene dopo filtro e voyant): è il punto in cui il circuito passa da alta a bassa pressione',
  },
  evaporatore: {
    label: 'Evaporatore',
    ruolo: 'il liquido freddo a bassa pressione assorbe calore dall\'ambiente da raffreddare ed evapora tornando gas',
    perche: 'riceve il fluido subito dopo il détendeur, quando è freddo e a bassa pressione: è qui che avviene il vero effetto frigorifero',
  },
  silenziatore: {
    label: 'Silenziatore mandata',
    ruolo: 'attutisce le pulsazioni di pressione generate dal compressore sulla linea di mandata',
    perche: 'è opzionale: se usato, va sulla linea tra compressore e condensatore',
  },
  'filtro-aspirazione': {
    label: 'Filtro aspirazione',
    ruolo: 'trattiene impurità e particelle metalliche sulla linea di aspirazione, prima del compressore',
    perche: 'è opzionale e tipicamente temporaneo: si monta sulla linea tra evaporatore e compressore soprattutto dopo una rottura del compressore, per proteggere il nuovo compressore dai residui, e si rimuove dopo qualche settimana di funzionamento',
  },
  'tubo-hp': { label: 'Tubo HP', ruolo: 'linea liquido/mandata ad alta pressione', perche: 'il diametro va scelto in base alla potenza dell\'impianto' },
  'tubo-bp': { label: 'Tubo BP', ruolo: 'linea aspirazione a bassa pressione', perche: 'il diametro va scelto in base alla potenza dell\'impianto' },
  fluido: { label: 'Fluido frigorigeno', ruolo: 'il fluido che circola nell\'impianto scambiando calore', perche: 'senza fluido caricato il circuito non può funzionare' },
};

export interface RequiredEdge {
  from: ComponentKind;
  to: ComponentKind;
  kind: 'HP' | 'BP';
}

/** Collegamenti (tubi) richiesti nel ciclo corretto, in ordine, con la relativa linea HP/BP. */
export const REQUIRED_EDGES: RequiredEdge[] = ORDERED_KINDS.map((kind, i) => ({
  from: kind,
  to: ORDERED_KINDS[(i + 1) % ORDERED_KINDS.length],
  kind: i < 4 ? 'HP' : 'BP',
}));

export function findRequiredEdge(from: ComponentKind, to: ComponentKind): RequiredEdge | undefined {
  return REQUIRED_EDGES.find((e) => e.from === from && e.to === to);
}

/**
 * Linea (HP/BP) che esce dalla porta di ciascun componente del ciclo — è una proprietà del
 * componente sorgente, non dipende da dove l'utente lo collega: ciò che esce dal compressore
 * è sempre alta pressione, ciò che esce dal détendeur è sempre bassa pressione.
 */
export const OUT_LINE_KIND: Partial<Record<ComponentKind, 'HP' | 'BP'>> = {
  compressore: 'HP',
  condensatore: 'HP',
  filtro: 'HP',
  voyant: 'HP',
  detendeur: 'BP',
  evaporatore: 'BP',
};

/** Slot ausiliari a posizione fissa: non fanno parte del canvas libero. */
export const AUX_SLOTS: { id: ComponentKind; label: string; compactLabel: string; aiuto: string }[] = [
  { id: 'fluido', label: 'Fluido frigorigeno', compactLabel: 'Fluido frigorigeno', aiuto: 'Trascina qui la bombola del fluido frigorigeno da caricare nell\'impianto.' },
];

export function toolboxForCompressors(compressori: CompressorVariant[]): ToolboxPiece[] {
  const pieces: ToolboxPiece[] = compressori.map((variant) => ({
    id: `compressore-${variant}`,
    kind: 'compressore',
    variant,
    label: compressorLabel(variant),
    descrizioneBreve: 'Trascinalo in un punto libero del banco di lavoro.',
  }));

  pieces.push(
    { id: 'condensatore', kind: 'condensatore', label: 'Condensatore + ventola', descrizioneBreve: 'Posizionalo dove vuoi, poi collegalo con un tubo.' },
    { id: 'filtro', kind: 'filtro', label: 'Filtro deidratatore', descrizioneBreve: 'Posizionalo dove vuoi, poi collegalo con un tubo.' },
    { id: 'voyant', kind: 'voyant', label: 'Voyant liquide', descrizioneBreve: 'Posizionalo dove vuoi, poi collegalo con un tubo.' },
    { id: 'detendeur', kind: 'detendeur', label: 'Détendeur', descrizioneBreve: 'Posizionalo dove vuoi, poi collegalo con un tubo.' },
    { id: 'evaporatore', kind: 'evaporatore', label: 'Evaporatore + ventola', descrizioneBreve: 'Posizionalo dove vuoi, poi collegalo con un tubo.' },
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
  descrizioneBreve: 'Facoltativo: posizionalo sulla linea tra compressore e condensatore.',
};

export const FILTRO_ASPIRAZIONE_PIECE: ToolboxPiece = {
  id: 'filtro-aspirazione',
  kind: 'filtro-aspirazione',
  label: 'Filtro aspirazione (opzionale)',
  descrizioneBreve: 'Facoltativo e temporaneo: si usa sulla linea tra evaporatore e compressore, tipicamente dopo una rottura del compressore.',
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
