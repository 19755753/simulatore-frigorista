import { useRef, useState } from 'react';
import { ORDERED_KINDS, type ComponentKind, type ToolboxPiece } from '../data/components';
import { DIAMETER_STROKE } from '../data/plantTypes';
import type { CanvasNode, DropCheck, EdgeEvaluation, PlacedNodes } from '../logic/validation';
import { pieceIcon } from './Toolbox';

export const NODE_W = 150;
export const NODE_H = 100;
export const CANVAS_W = 1240;
export const CANVAS_H = 600;
const PORT_HIT_RADIUS = 34;
// La porta sporge oltre il bordo del nodo (right:-8px/bottom:-8px, 18px di diametro): senza questo
// margine un nodo trascinato vicino al bordo destro/inferiore del canvas avrebbe la porta parzialmente
// fuori dall'area visibile/raggiungibile, rendendo il collegamento da lì impossibile da agganciare.
const PORT_EDGE_MARGIN = 24;
const MAX_NODE_X = CANVAS_W - NODE_W - PORT_EDGE_MARGIN;
const MAX_NODE_Y = CANVAS_H - NODE_H - PORT_EDGE_MARGIN;

function clampNodePos(x: number, y: number) {
  return {
    x: Math.min(Math.max(x, 0), MAX_NODE_X),
    y: Math.min(Math.max(y, 0), MAX_NODE_Y),
  };
}

/** Porta di uscita (in basso a destra) — punto di aggancio interattivo e da cui parte ogni tubo. */
function portPoint(node: CanvasNode) {
  return { x: node.x + NODE_W, y: node.y + NODE_H };
}

/** Punto di ingresso (a sinistra, centrato) — dove i tubi arrivano sul componente successivo. */
function inPoint(node: CanvasNode) {
  return { x: node.x, y: node.y + NODE_H / 2 };
}

/** Percorso a gomiti (90°) tra due punti, come farebbe un frigorista piegando il tubo. */
function elbowPath(x1: number, y1: number, x2: number, y2: number): string {
  const midX = (x1 + x2) / 2;
  return `M ${x1} ${y1} L ${midX} ${y1} L ${midX} ${y2} L ${x2} ${y2}`;
}

function elbowMidpoint(x1: number, y1: number, x2: number, y2: number) {
  return { x: (x1 + x2) / 2, y: (y1 + y2) / 2 };
}

interface DragState {
  kind: ComponentKind;
  startPointerX: number;
  startPointerY: number;
  startNodeX: number;
  startNodeY: number;
}

interface ConnectState {
  from: ComponentKind;
  x: number;
  y: number;
}

interface CompleteState {
  edgeId: string;
  from: ComponentKind;
  x: number;
  y: number;
}

interface RejectInfo {
  kind: ComponentKind;
  message: string;
}

interface CircuitCanvasProps {
  nodes: PlacedNodes;
  edgeEvaluations: EdgeEvaluation[];
  activeEdgeIds: Set<string>;
  simulationRunning: boolean;
  flowOk: boolean;
  allPieces: ToolboxPiece[];
  selectedPiece: ToolboxPiece | null;
  onPlaceNode: (pieceId: string, x: number, y: number) => void;
  onMoveNode: (kind: ComponentKind, x: number, y: number) => void;
  onRemoveNode: (kind: ComponentKind) => void;
  onAddEdge: (from: ComponentKind, to: ComponentKind) => void;
  onCompleteEdge: (edgeId: string, to: ComponentKind) => void;
  onRemoveEdge: (id: string) => void;
  onAttachTube: (nodeKind: ComponentKind, pieceId: string) => DropCheck;
  onPlacedSuccess: () => void;
}

export function CircuitCanvas({
  nodes, edgeEvaluations, activeEdgeIds, simulationRunning, flowOk, allPieces,
  selectedPiece, onPlaceNode, onMoveNode, onRemoveNode,
  onAddEdge, onCompleteEdge, onRemoveEdge, onAttachTube, onPlacedSuccess,
}: CircuitCanvasProps) {
  const canvasRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<DragState | null>(null);
  const connectingRef = useRef<ConnectState | null>(null);
  const completingRef = useRef<CompleteState | null>(null);
  const [connecting, setConnecting] = useState<ConnectState | null>(null);
  const [completing, setCompleting] = useState<CompleteState | null>(null);
  const [loosePositions, setLoosePositions] = useState<Record<string, { x: number; y: number }>>({});
  const [rejectInfo, setRejectInfo] = useState<RejectInfo | null>(null);
  const rejectTimeoutRef = useRef<number | null>(null);

  const nodeList = Object.values(nodes).filter(Boolean) as CanvasNode[];

  function toCanvasPoint(clientX: number, clientY: number) {
    const el = canvasRef.current;
    if (!el) return { x: 0, y: 0 };
    const rect = el.getBoundingClientRect();
    return { x: clientX - rect.left + el.scrollLeft, y: clientY - rect.top + el.scrollTop };
  }

  function showReject(kind: ComponentKind, message: string) {
    if (rejectTimeoutRef.current) window.clearTimeout(rejectTimeoutRef.current);
    setRejectInfo({ kind, message });
    rejectTimeoutRef.current = window.setTimeout(() => setRejectInfo(null), 4200);
  }

  // Il drag&drop nativo dalla cassetta attrezzi scorre automaticamente il canvas vicino ai bordi;
  // i gesti basati su pointer (disegna collegamento, completa tubo in sospeso) non lo fanno di
  // default, quindi un componente scrollato fuori vista (tipico per gli ultimi posizionati, spesso
  // sul lato destro/basso) risulterebbe irraggiungibile. Replichiamo qui lo stesso scroll automatico.
  function autoScrollNearEdge(clientX: number, clientY: number) {
    const el = canvasRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const EDGE = 48;
    const STEP = 22;
    if (clientX > rect.right - EDGE) el.scrollLeft = Math.min(el.scrollLeft + STEP, el.scrollWidth);
    else if (clientX < rect.left + EDGE) el.scrollLeft = Math.max(el.scrollLeft - STEP, 0);
    if (clientY > rect.bottom - EDGE) el.scrollTop = Math.min(el.scrollTop + STEP, el.scrollHeight);
    else if (clientY < rect.top + EDGE) el.scrollTop = Math.max(el.scrollTop - STEP, 0);
  }

  function findNodeAt(px: number, py: number): ComponentKind | null {
    for (const node of nodeList) {
      const port = portPoint(node);
      const distToPort = Math.hypot(px - port.x, py - port.y);
      const insideBody = px >= node.x && px <= node.x + NODE_W && py >= node.y && py <= node.y + NODE_H;
      if (distToPort <= PORT_HIT_RADIUS || insideBody) return node.kind;
    }
    return null;
  }

  function attachTubeAt(pieceId: string, px: number, py: number) {
    const targetKind = findNodeAt(px, py);
    if (!targetKind) return;
    const result = onAttachTube(targetKind, pieceId);
    if (!result.ok) showReject(targetKind, result.message ?? 'Collegamento non valido.');
  }

  // --- Riposizionamento libero di un nodo ---
  function startNodeDrag(e: React.PointerEvent, kind: ComponentKind) {
    e.stopPropagation();
    if (selectedPiece && (selectedPiece.kind === 'tubo-hp' || selectedPiece.kind === 'tubo-bp')) {
      const result = onAttachTube(kind, selectedPiece.id);
      if (!result.ok) showReject(kind, result.message ?? 'Collegamento non valido.');
      onPlacedSuccess();
      return;
    }
    const node = nodes[kind];
    if (!node) return;
    dragRef.current = { kind, startPointerX: e.clientX, startPointerY: e.clientY, startNodeX: node.x, startNodeY: node.y };
    window.addEventListener('pointermove', handleNodeDragMove);
    window.addEventListener('pointerup', endNodeDrag);
  }

  function handleNodeDragMove(e: PointerEvent) {
    const drag = dragRef.current;
    if (!drag) return;
    autoScrollNearEdge(e.clientX, e.clientY);
    const dx = e.clientX - drag.startPointerX;
    const dy = e.clientY - drag.startPointerY;
    const { x: nx, y: ny } = clampNodePos(drag.startNodeX + dx, drag.startNodeY + dy);
    onMoveNode(drag.kind, nx, ny);
  }

  function endNodeDrag() {
    dragRef.current = null;
    window.removeEventListener('pointermove', handleNodeDragMove);
    window.removeEventListener('pointerup', endNodeDrag);
  }

  // --- Collegamento rapido porta -> componente (senza diametro predefinito) ---
  function startConnect(e: React.PointerEvent, from: ComponentKind) {
    e.stopPropagation();
    e.preventDefault();
    const p = toCanvasPoint(e.clientX, e.clientY);
    connectingRef.current = { from, x: p.x, y: p.y };
    setConnecting(connectingRef.current);
    window.addEventListener('pointermove', handleConnectMove);
    window.addEventListener('pointerup', handleConnectEnd);
  }

  function handleConnectMove(e: PointerEvent) {
    autoScrollNearEdge(e.clientX, e.clientY);
    const p = toCanvasPoint(e.clientX, e.clientY);
    connectingRef.current = connectingRef.current ? { ...connectingRef.current, x: p.x, y: p.y } : null;
    setConnecting(connectingRef.current);
  }

  function handleConnectEnd(e: PointerEvent) {
    window.removeEventListener('pointermove', handleConnectMove);
    window.removeEventListener('pointerup', handleConnectEnd);
    const p = toCanvasPoint(e.clientX, e.clientY);
    const cur = connectingRef.current;
    connectingRef.current = null;
    setConnecting(null);
    if (!cur) return;
    const target = findNodeAt(p.x, p.y);
    if (target && target !== cur.from) onAddEdge(cur.from, target);
  }

  // --- Completamento di un tubo agganciato ma non ancora collegato (trascina l'estremità libera) ---
  function startCompleteEdge(e: React.PointerEvent, edgeId: string, from: ComponentKind) {
    e.stopPropagation();
    e.preventDefault();
    const p = toCanvasPoint(e.clientX, e.clientY);
    completingRef.current = { edgeId, from, x: p.x, y: p.y };
    setCompleting(completingRef.current);
    window.addEventListener('pointermove', handleCompleteMove);
    window.addEventListener('pointerup', handleCompleteEnd);
  }

  function handleCompleteMove(e: PointerEvent) {
    autoScrollNearEdge(e.clientX, e.clientY);
    const p = toCanvasPoint(e.clientX, e.clientY);
    completingRef.current = completingRef.current ? { ...completingRef.current, x: p.x, y: p.y } : null;
    setCompleting(completingRef.current);
    if (completingRef.current) {
      setLoosePositions((prev) => ({ ...prev, [completingRef.current!.edgeId]: { x: p.x, y: p.y } }));
    }
  }

  function handleCompleteEnd(e: PointerEvent) {
    window.removeEventListener('pointermove', handleCompleteMove);
    window.removeEventListener('pointerup', handleCompleteEnd);
    const p = toCanvasPoint(e.clientX, e.clientY);
    const cur = completingRef.current;
    completingRef.current = null;
    setCompleting(null);
    if (!cur) return;
    const target = findNodeAt(p.x, p.y);
    if (target && target !== cur.from) {
      onCompleteEdge(cur.edgeId, target);
      setLoosePositions((prev) => {
        const next = { ...prev };
        delete next[cur.edgeId];
        return next;
      });
    }
  }

  function looseEndFor(edgeId: string, from: ComponentKind) {
    const override = loosePositions[edgeId];
    if (override) return override;
    const fromNode = nodes[from];
    if (!fromNode) return { x: 0, y: 0 };
    const port = portPoint(fromNode);
    return { x: Math.min(port.x + 70, CANVAS_W - 10), y: Math.min(port.y + 10, CANVAS_H - 10) };
  }

  // --- Piazzamento componenti / aggancio tubi da click-to-place o drag&drop nativo ---
  function handleCanvasClick(e: React.MouseEvent) {
    if (!selectedPiece) return;
    if (selectedPiece.kind === 'tubo-hp' || selectedPiece.kind === 'tubo-bp' || selectedPiece.kind === 'fluido') return;
    if (e.target !== canvasRef.current && !(e.target as HTMLElement).classList.contains('canvas-grid')) return;
    const p = toCanvasPoint(e.clientX, e.clientY);
    const { x, y } = clampNodePos(p.x - NODE_W / 2, p.y - NODE_H / 2);
    onPlaceNode(selectedPiece.id, x, y);
    onPlacedSuccess();
  }

  function handleCanvasDragOver(e: React.DragEvent) {
    e.preventDefault();
    // Il drag&drop nativo non scorre automaticamente il canvas verso un bersaglio fuori vista
    // (a differenza dei gesti basati su pointer, gestiti da autoScrollNearEdge altrove): lo facciamo
    // qui a mano, altrimenti un componente scrollato fuori dall'area visibile — tipicamente gli
    // ultimi posizionati, spesso più a destra/in basso — sarebbe impossibile da agganciare.
    autoScrollNearEdge(e.clientX, e.clientY);
  }

  function handleCanvasDrop(e: React.DragEvent) {
    e.preventDefault();
    const pieceId = e.dataTransfer.getData('text/piece-id');
    if (!pieceId) return;
    const piece = allPieces.find((p) => p.id === pieceId);
    if (!piece) return;
    const p = toCanvasPoint(e.clientX, e.clientY);
    if (piece.kind === 'tubo-hp' || piece.kind === 'tubo-bp') {
      attachTubeAt(pieceId, p.x, p.y);
      return;
    }
    if (piece.kind === 'fluido') return;
    const { x, y } = clampNodePos(p.x - NODE_W / 2, p.y - NODE_H / 2);
    onPlaceNode(pieceId, x, y);
  }

  return (
    <div
      ref={canvasRef}
      className="circuit-canvas"
      style={{ width: CANVAS_W, height: CANVAS_H }}
      onClick={handleCanvasClick}
      onDragOver={handleCanvasDragOver}
      onDrop={handleCanvasDrop}
    >
      <div className="canvas-grid" style={{ width: CANVAS_W, height: CANVAS_H }} />

      {nodeList.length === 0 && (
        <div className="canvas-empty-hint">
          Trascina qui i componenti dalla cassetta attrezzi, posizionali dove vuoi (anche in verticale), poi
          disegna i tubi trascinando dal pallino in basso a destra di ciascuno, oppure trascina direttamente un
          pezzo di tubo dalla cassetta attrezzi sopra la porta del componente per agganciarlo lì.
        </div>
      )}

      <svg className="canvas-edges" width={CANVAS_W} height={CANVAS_H}>
        <defs>
          <marker id="arrow-hp" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
            <path d="M0,0 L10,5 L0,10 z" fill="#d64545" />
          </marker>
          <marker id="arrow-bp" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
            <path d="M0,0 L10,5 L0,10 z" fill="#3f7fd6" />
          </marker>
          <marker id="arrow-wrong" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
            <path d="M0,0 L10,5 L0,10 z" fill="#e0a83f" />
          </marker>
          <filter id="tube-glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {edgeEvaluations.map((ev) => {
          const fromNode = nodes[ev.edge.from];
          if (!fromNode) return null;

          if (ev.status === 'pending') {
            const loose = looseEndFor(ev.edge.id, ev.edge.from);
            const p1 = portPoint(fromNode);
            const isHP = ev.edge.from === 'compressore' || ev.edge.from === 'condensatore' || ev.edge.from === 'filtro' || ev.edge.from === 'voyant';
            const color = isHP ? '#d64545' : '#3f7fd6';
            const width = ev.edge.diametro ? DIAMETER_STROKE[ev.edge.diametro] : 4;
            return (
              <g key={ev.edge.id}>
                <path d={elbowPath(p1.x, p1.y, loose.x, loose.y)} fill="none" stroke={color} strokeWidth={width} strokeLinecap="round" strokeLinejoin="round" strokeDasharray="3 7" opacity={0.85} />
              </g>
            );
          }

          const toNode = ev.edge.to ? nodes[ev.edge.to] : null;
          if (!toNode) return null;
          const p1 = portPoint(fromNode);
          const p2 = inPoint(toNode);
          const isWrong = ev.status === 'wrong';
          const isHP = ev.status === 'correct-hp';
          const noDiametro = !isWrong && !ev.edge.diametro;
          const color = isWrong ? '#e0a83f' : noDiametro ? '#7a8590' : isHP ? '#d64545' : '#3f7fd6';
          const marker = isWrong ? 'arrow-wrong' : isHP ? 'arrow-hp' : 'arrow-bp';
          const width = isWrong ? 4 : ev.edge.diametro ? DIAMETER_STROKE[ev.edge.diametro] : 3;
          const isActive = activeEdgeIds.has(ev.edge.id);
          const mid = elbowMidpoint(p1.x, p1.y, p2.x, p2.y);
          const pathId = `edge-path-${ev.edge.id}`;

          return (
            <g key={ev.edge.id}>
              <path
                id={pathId}
                d={elbowPath(p1.x, p1.y, p2.x, p2.y)}
                fill="none"
                stroke={color}
                strokeWidth={width}
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeDasharray={isWrong ? '9 7' : undefined}
                markerEnd={`url(#${marker})`}
                opacity={isWrong ? 0.85 : 1}
                filter={simulationRunning && isActive && flowOk ? 'url(#tube-glow)' : undefined}
              />
              {simulationRunning && isActive && (
                <>
                  {[0, 1, 2].map((i) => (
                    <polygon key={i} points="0,-5 11,0 0,5" fill={flowOk ? '#fff6da' : '#ffe08a'}>
                      <animateMotion dur="1.1s" repeatCount="indefinite" begin={`-${i * 0.37}s`} rotate="auto">
                        <mpath href={`#${pathId}`} />
                      </animateMotion>
                    </polygon>
                  ))}
                </>
              )}
              {isWrong && (
                <g transform={`translate(${mid.x} ${mid.y})`}>
                  <circle r="9" fill="#e0a83f" />
                  <text textAnchor="middle" dy="4" fontSize="12" fontWeight="700" fill="#241a00">!</text>
                </g>
              )}
            </g>
          );
        })}

        {connecting && nodes[connecting.from] && (() => {
          const p1 = portPoint(nodes[connecting.from]!);
          return (
            <path d={elbowPath(p1.x, p1.y, connecting.x, connecting.y)} fill="none" stroke="#c9793f" strokeWidth="3" strokeDasharray="6 6" strokeLinecap="round" strokeLinejoin="round" />
          );
        })()}

        {completing && nodes[completing.from] && (() => {
          const p1 = portPoint(nodes[completing.from]!);
          return (
            <path d={elbowPath(p1.x, p1.y, completing.x, completing.y)} fill="none" stroke="#c9793f" strokeWidth="3" strokeDasharray="6 6" strokeLinecap="round" strokeLinejoin="round" />
          );
        })()}
      </svg>

      {edgeEvaluations.map((ev) => {
        if (ev.status === 'pending') {
          const fromNode = nodes[ev.edge.from];
          if (!fromNode) return null;
          const loose = looseEndFor(ev.edge.id, ev.edge.from);
          return (
            <div key={ev.edge.id}>
              <div
                className="pending-edge-handle"
                style={{ left: loose.x - 11, top: loose.y - 11 }}
                onPointerDown={(e) => startCompleteEdge(e, ev.edge.id, ev.edge.from)}
                title="Trascina qui l'estremità libera del tubo fino al componente successivo"
              />
              <button
                type="button"
                className="edge-remove-btn"
                style={{ left: loose.x + 14, top: loose.y - 24 }}
                onPointerDown={(e) => e.stopPropagation()}
                onClick={(e) => { e.stopPropagation(); onRemoveEdge(ev.edge.id); }}
                title="Rimuovi questo tubo"
              >
                ×
              </button>
            </div>
          );
        }
        const fromNode = nodes[ev.edge.from];
        const toNode = ev.edge.to ? nodes[ev.edge.to] : null;
        if (!fromNode || !toNode) return null;
        const p1 = portPoint(fromNode);
        const p2 = inPoint(toNode);
        const mid = elbowMidpoint(p1.x, p1.y, p2.x, p2.y);
        return (
          <button
            key={ev.edge.id}
            type="button"
            className="edge-remove-btn"
            style={{ left: mid.x - 10, top: mid.y - 10 }}
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => { e.stopPropagation(); onRemoveEdge(ev.edge.id); }}
            title="Rimuovi questo collegamento"
          >
            ×
          </button>
        );
      })}

      {nodeList.map((node) => (
        <div
          key={node.kind}
          className={`canvas-node${rejectInfo?.kind === node.kind ? ' node-shake' : ''}`}
          style={{ left: node.x, top: node.y, width: NODE_W, height: NODE_H }}
          onPointerDown={(e) => startNodeDrag(e, node.kind)}
        >
          <button
            type="button"
            className="node-remove-btn"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => { e.stopPropagation(); onRemoveNode(node.kind); }}
            title="Rimuovi componente"
          >
            ×
          </button>
          <div className="node-icon">{pieceIcon(node.piece)}</div>
          <div className="node-label">{node.piece.label}</div>
          {ORDERED_KINDS.includes(node.piece.kind) && (
            <div
              className="node-port"
              onPointerDown={(e) => startConnect(e, node.kind)}
              title="Trascina da qui per collegare, oppure trascina qui un tubo dalla cassetta attrezzi"
            />
          )}
          {rejectInfo?.kind === node.kind && (
            <div className="node-reject-msg">{rejectInfo.message}</div>
          )}
        </div>
      ))}
    </div>
  );
}
