import { AUX_SLOTS, CIRCUIT_SLOTS, type ComponentKind, type ToolboxPiece } from '../data/components';
import { diameterGuideFor, type PowerCategory } from '../data/plantTypes';
import type { RefrigerantId } from '../data/refrigerants';

export type PlacedPieces = Partial<Record<ComponentKind, ToolboxPiece>>;

export interface DropCheck {
  ok: boolean;
  message?: string;
}

const SLOT_LABEL: Record<ComponentKind, string> = Object.fromEntries(
  [...CIRCUIT_SLOTS, ...AUX_SLOTS].map((s) => [s.id, s.label]),
) as Record<ComponentKind, string>;

/** Verifica se un pezzo può essere posato in uno slot. Rifiuta il drop se non coerente. */
export function canPlacePiece(slotId: ComponentKind, piece: ToolboxPiece): DropCheck {
  if (piece.kind === slotId) return { ok: true };

  if (slotId === 'filtro' && piece.kind === 'voyant') {
    return {
      ok: false,
      message: `Qui va montato il ${SLOT_LABEL.filtro}. Il voyant liquide si monta DOPO il filtro, non prima: il filtro deve intercettare il liquido per primo.`,
    };
  }
  if (slotId === 'voyant' && piece.kind === 'filtro') {
    return {
      ok: false,
      message: `Qui va montato il ${SLOT_LABEL.voyant}. Il filtro deidratatore va montato PRIMA del voyant, non in questa posizione.`,
    };
  }
  return {
    ok: false,
    message: `Posizione sbagliata: qui va montato "${SLOT_LABEL[slotId]}", non "${piece.label}".`,
  };
}

export interface ValidationMessage {
  level: 'error' | 'warning';
  text: string;
}

export interface CircuitValidation {
  blockedSlotIndex: number | null; // indice (0-based) del primo slot vuoto: qui il flusso si blocca
  sequenceComplete: boolean;
  diameterOk: boolean;
  fluidOk: boolean;
  temperatureOk: boolean;
  isFullyCorrect: boolean;
  messages: ValidationMessage[];
}

export function validateCircuit(params: {
  placed: PlacedPieces;
  potenza: PowerCategory;
  tempEvap: number;
  tempCond: number;
}): CircuitValidation {
  const { placed, potenza, tempEvap, tempCond } = params;
  const messages: ValidationMessage[] = [];

  let blockedSlotIndex: number | null = null;
  for (let i = 0; i < CIRCUIT_SLOTS.length; i++) {
    if (!placed[CIRCUIT_SLOTS[i].id]) {
      blockedSlotIndex = i;
      break;
    }
  }
  const sequenceComplete = blockedSlotIndex === null;
  if (!sequenceComplete) {
    messages.push({
      level: 'error',
      text: `Circuito incompleto: manca "${CIRCUIT_SLOTS[blockedSlotIndex!].label}". Il flusso si blocca qui.`,
    });
  }

  const diametroHP = placed['tubo-hp']?.diametro ?? null;
  const diametroBP = placed['tubo-bp']?.diametro ?? null;

  const guide = diameterGuideFor(potenza);
  const diameterOk = !!diametroHP && !!diametroBP && guide.hp.includes(diametroHP) && guide.bp.includes(diametroBP);
  if (diametroHP && !guide.hp.includes(diametroHP)) {
    messages.push({
      level: 'warning',
      text: `Diametro linea liquido (HP) ${diametroHP}" poco coerente per un impianto "${guide.label}": rischio di perdita di carico eccessiva o velocità del fluido non corretta. Consigliato: ${guide.hp.join(', ')}".`,
    });
  }
  if (diametroBP && !guide.bp.includes(diametroBP)) {
    messages.push({
      level: 'warning',
      text: `Diametro linea aspirazione (BP) ${diametroBP}" poco coerente per un impianto "${guide.label}": rischio di perdita di carico eccessiva o rientro olio insufficiente. Consigliato: ${guide.bp.join(', ')}".`,
    });
  }
  if (!diametroHP || !diametroBP) {
    messages.push({ level: 'warning', text: 'Trascina i tubi con il diametro scelto sulle linee HP e BP per completare il montaggio.' });
  }

  const fluidOk = !!placed.fluido;
  if (!fluidOk) {
    messages.push({ level: 'warning', text: 'Trascina la bombola del fluido frigorigeno nello slot dedicato per caricare l\'impianto.' });
  }

  const temperatureOk = tempEvap < tempCond;
  if (!temperatureOk) {
    messages.push({
      level: 'error',
      text: `Temperatura di evaporazione (${tempEvap}°C) deve essere inferiore alla temperatura di condensazione (${tempCond}°C): con questi valori il ciclo non può funzionare.`,
    });
  }

  const isFullyCorrect = sequenceComplete && diameterOk && fluidOk && temperatureOk;

  return { blockedSlotIndex, sequenceComplete, diameterOk, fluidOk, temperatureOk, isFullyCorrect, messages };
}

export function selectedFluid(placed: PlacedPieces): RefrigerantId | null {
  return placed.fluido?.fluido ?? null;
}
