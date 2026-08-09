import {
  AUX_SLOTS,
  COMPONENT_INFO,
  ORDERED_KINDS,
  REQUIRED_EDGES,
  findRequiredEdge,
  type ComponentKind,
  type ToolboxPiece,
} from '../data/components';
import { diameterGuideFor, type PowerCategory } from '../data/plantTypes';
import type { RefrigerantId } from '../data/refrigerants';

export interface CanvasNode {
  kind: ComponentKind;
  piece: ToolboxPiece;
  x: number;
  y: number;
}

export type PlacedNodes = Partial<Record<ComponentKind, CanvasNode>>;

export interface WireEdge {
  id: string;
  from: ComponentKind;
  to: ComponentKind;
}

export type PlacedPieces = Partial<Record<ComponentKind, ToolboxPiece>>;

export interface DropCheck {
  ok: boolean;
  message?: string;
}

const AUX_LABEL: Record<string, string> = Object.fromEntries(AUX_SLOTS.map((s) => [s.id, s.label]));

/** Verifica se un pezzo ausiliario (tubo/fluido) può essere posato in uno slot fisso. */
export function canPlaceAux(slotId: ComponentKind, piece: ToolboxPiece): DropCheck {
  if (piece.kind === slotId) return { ok: true };
  return {
    ok: false,
    message: `Questo è "${piece.label}": va nello slot "${AUX_LABEL[piece.kind] ?? piece.kind}", non qui. Qui serve: ${AUX_LABEL[slotId] ?? slotId}.`,
  };
}

export interface DidacticMessage {
  severity: 'error' | 'warning';
  title: string;
  why: string;
  whatToDo: string;
}

export type EdgeStatus = 'correct-hp' | 'correct-bp' | 'wrong';

export interface EdgeEvaluation {
  edge: WireEdge;
  status: EdgeStatus;
  message?: DidacticMessage;
}

export interface CircuitValidation {
  edgeEvaluations: EdgeEvaluation[];
  activeEdgeIds: Set<string>; // edges that are part of the correctly-flowing path so far
  blockedAtIndex: number | null; // indice in ORDERED_KINDS dove il flusso si interrompe
  sequenceComplete: boolean;
  diameterOk: boolean;
  fluidOk: boolean;
  temperatureOk: boolean;
  isFullyCorrect: boolean;
  messages: DidacticMessage[];
}

function labelOf(kind: ComponentKind): string {
  return COMPONENT_INFO[kind].label;
}

function explainMissingNode(kind: ComponentKind): DidacticMessage {
  const info = COMPONENT_INFO[kind];
  return {
    severity: 'error',
    title: `Manca ancora: ${info.label}`,
    why: `${info.label} ${info.ruolo}. ${info.perche}.`,
    whatToDo: `Trascina "${info.label}" dalla cassetta attrezzi in un punto libero del banco di lavoro.`,
  };
}

function explainMissingEdge(from: ComponentKind, to: ComponentKind): DidacticMessage {
  const toInfo = COMPONENT_INFO[to];
  return {
    severity: 'error',
    title: `Manca il collegamento: ${labelOf(from)} → ${labelOf(to)}`,
    why: `${toInfo.label} ${toInfo.ruolo}. ${toInfo.perche}.`,
    whatToDo: `Trascina un tubo dalla porta di uscita di "${labelOf(from)}" fino a "${labelOf(to)}" per collegarli.`,
  };
}

function explainWrongEdge(from: ComponentKind, to: ComponentKind): DidacticMessage {
  const fromInfo = COMPONENT_INFO[from];
  const toInfo = COMPONENT_INFO[to];
  const correctNext = REQUIRED_EDGES.find((e) => e.from === from);

  if (from === to) {
    return {
      severity: 'error',
      title: `Collegamento non valido: ${labelOf(from)} collegato a se stesso`,
      why: `Un componente non può scaricare nella propria stessa entrata: il fluido deve sempre passare al componente successivo del ciclo.`,
      whatToDo: correctNext
        ? `Rimuovi questo tubo e collega invece "${labelOf(from)}" → "${labelOf(correctNext.to)}".`
        : `Rimuovi questo tubo.`,
    };
  }

  if (!correctNext) {
    return {
      severity: 'error',
      title: `Collegamento sbagliato: ${labelOf(from)} → ${labelOf(to)}`,
      why: `${fromInfo.label} ${fromInfo.ruolo}, e ${toInfo.label} ${toInfo.ruolo}: non sono il passaggio giusto uno dopo l'altro nel ciclo reale.`,
      whatToDo: `Rimuovi questo tubo e ricontrolla la sequenza corretta: compressore → condensatore → filtro deidratatore → voyant liquide → détendeur → evaporatore → di nuovo compressore.`,
    };
  }

  const correctToInfo = COMPONENT_INFO[correctNext.to];
  return {
    severity: 'error',
    title: `Collegamento sbagliato: ${labelOf(from)} → ${labelOf(to)}`,
    why: `Dopo ${fromInfo.label} (che ${fromInfo.ruolo}) nel ciclo reale deve arrivare ${correctToInfo.label}, perché ${correctToInfo.perche}. ${toInfo.label} invece ${toInfo.ruolo}: non è il passaggio giusto a questo punto del ciclo.`,
    whatToDo: `Rimuovi questo tubo e collega invece "${fromInfo.label}" → "${correctToInfo.label}".`,
  };
}

export function evaluateEdges(edges: WireEdge[]): EdgeEvaluation[] {
  return edges.map((edge) => {
    const required = findRequiredEdge(edge.from, edge.to);
    if (required) {
      return { edge, status: required.kind === 'HP' ? 'correct-hp' : 'correct-bp' };
    }
    return { edge, status: 'wrong', message: explainWrongEdge(edge.from, edge.to) };
  });
}

export function validateCircuit(params: {
  nodes: PlacedNodes;
  edges: WireEdge[];
  auxPlaced: PlacedPieces;
  potenza: PowerCategory;
  tempEvap: number;
  tempCond: number;
}): CircuitValidation {
  const { nodes, edges, auxPlaced, potenza, tempEvap, tempCond } = params;
  const messages: DidacticMessage[] = [];
  const edgeEvaluations = evaluateEdges(edges);
  const activeEdgeIds = new Set<string>();

  // Segnala tutti i collegamenti sbagliati, ovunque si trovino.
  for (const ev of edgeEvaluations) {
    if (ev.status === 'wrong' && ev.message) messages.push(ev.message);
  }

  // Percorre il ciclo richiesto a partire dal compressore, seguendo solo collegamenti corretti disegnati dall'utente.
  let blockedAtIndex: number | null = null;
  for (let i = 0; i < ORDERED_KINDS.length; i++) {
    const fromKind = ORDERED_KINDS[i];
    const toKind = ORDERED_KINDS[(i + 1) % ORDERED_KINDS.length];

    if (!nodes[fromKind]) {
      blockedAtIndex = i;
      messages.push(explainMissingNode(fromKind));
      break;
    }
    if (!nodes[toKind]) {
      blockedAtIndex = i;
      messages.push(explainMissingNode(toKind));
      break;
    }
    const match = edgeEvaluations.find(
      (ev) => ev.status !== 'wrong' && ev.edge.from === fromKind && ev.edge.to === toKind,
    );
    if (!match) {
      blockedAtIndex = i;
      messages.push(explainMissingEdge(fromKind, toKind));
      break;
    }
    activeEdgeIds.add(match.edge.id);
  }

  const sequenceComplete = blockedAtIndex === null;

  const diametroHP = auxPlaced['tubo-hp']?.diametro ?? null;
  const diametroBP = auxPlaced['tubo-bp']?.diametro ?? null;
  const guide = diameterGuideFor(potenza);
  const diameterOk = !!diametroHP && !!diametroBP && guide.hp.includes(diametroHP) && guide.bp.includes(diametroBP);
  if (diametroHP && !guide.hp.includes(diametroHP)) {
    messages.push({
      severity: 'warning',
      title: `Diametro HP ${diametroHP}" poco adatto a questo impianto`,
      why: `Per un impianto "${guide.label}" un tubo così dimensionato rischia una perdita di carico eccessiva o una velocità del fluido non corretta lungo la linea liquido.`,
      whatToDo: `Sostituiscilo con un tubo HP da ${guide.hp.join('" o ')}".`,
    });
  }
  if (diametroBP && !guide.bp.includes(diametroBP)) {
    messages.push({
      severity: 'warning',
      title: `Diametro BP ${diametroBP}" poco adatto a questo impianto`,
      why: `Per un impianto "${guide.label}" un tubo così dimensionato rischia una perdita di carico eccessiva sulla linea di aspirazione o un rientro olio insufficiente al compressore.`,
      whatToDo: `Sostituiscilo con un tubo BP da ${guide.bp.join('" o ')}".`,
    });
  }
  if (!diametroHP || !diametroBP) {
    messages.push({
      severity: 'warning',
      title: 'Diametri tubo non ancora assegnati',
      why: 'Ogni linea del circuito ha bisogno di un tubo con un diametro definito per poter essere caricata e funzionare.',
      whatToDo: 'Trascina un tubo HP sullo slot "Diametro linea liquido" e un tubo BP sullo slot "Diametro aspirazione".',
    });
  }

  const fluidOk = !!auxPlaced.fluido;
  if (!fluidOk) {
    messages.push({
      severity: 'warning',
      title: 'Fluido frigorigeno non caricato',
      why: 'Senza fluido frigorigeno nel circuito non c\'è nulla che possa assorbire o cedere calore: il ciclo non può avvenire.',
      whatToDo: 'Trascina la bombola del fluido scelto sullo slot "Fluido frigorigeno".',
    });
  }

  const temperatureOk = tempEvap < tempCond;
  if (!temperatureOk) {
    messages.push({
      severity: 'error',
      title: 'Temperatura di evaporazione non inferiore a quella di condensazione',
      why: `Il ciclo frigorifero funziona perché il fluido evapora a bassa pressione/temperatura (assorbendo calore) e condensa ad alta pressione/temperatura (cedendo calore). Con Tevap (${tempEvap}°C) non inferiore a Tcond (${tempCond}°C) questo salto di pressione non esiste: il compressore non avrebbe nulla da comprimere in modo utile.`,
      whatToDo: `Abbassa la temperatura di evaporazione sotto quella di condensazione (per un impianto tipico: evaporazione intorno a -10°C, condensazione intorno a 40°C).`,
    });
  }

  const isFullyCorrect = sequenceComplete && diameterOk && fluidOk && temperatureOk;

  return {
    edgeEvaluations,
    activeEdgeIds,
    blockedAtIndex,
    sequenceComplete,
    diameterOk,
    fluidOk,
    temperatureOk,
    isFullyCorrect,
    messages,
  };
}

export function selectedFluid(auxPlaced: PlacedPieces): RefrigerantId | null {
  return auxPlaced.fluido?.fluido ?? null;
}
