import { useRef, useState } from 'react';
import type { ComponentKind, ToolboxPiece } from '../data/components';
import { DIAMETER_STROKE, type TubeDiameter } from '../data/plantTypes';
import type { CanvasNode, EdgeEvaluation, PlacedNodes } from '../logic/validation';
import { pieceIcon } from './Toolbox';

export const NODE_W = 150;
export const NODE_H = 100;
export const CANVAS_W = 1240;
export const CANVAS_H = 600;

function clipToRect(cx: number, cy: number, w: number, h: number, tx: number, ty: number) {
  const dx = tx - cx;
  const dy = ty - cy;
  if (dx === 0 && dy === 0) return { x: cx, y: cy };
  const halfW = w / 2;
  const halfH = h / 2;
  const scaleX = dx !== 0 ? halfW / Math.abs(dx) : Infinity;
  const scaleY = dy !== 0 ? halfH / Math.abs(dy) : Infinity;
  const scale = Math.min(scaleX, scaleY);
  return { x: cx + dx * scale, y: cy + dy * scale };
}

function nodeCenter(node: CanvasNode) {
  return { x: node.x + NODE_W / 2, y: node.y + NODE_H / 2 };
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

interface CircuitCanvasProps {
  nodes: PlacedNodes;
  edgeEvaluations: EdgeEvaluation[];
  activeEdgeIds: Set<string>;
  simulationRunning: boolean;
  flowOk: boolean;
  diametroHP: TubeDiameter | null;
  diametroBP: TubeDiameter | null;
  selectedPiece: ToolboxPiece | null;
  onPlaceNode: (pieceId: string, x: number, y: number) => void;
  onMoveNode: (kind: ComponentKind, x: number, y: number) => void;
  onRemoveNode: (kind: ComponentKind) => void;
  onAddEdge: (from: ComponentKind, to: ComponentKind) => void;
  onRemoveEdge: (id: string) => void;
  onPlacedSuccess: () => void;
}

export function CircuitCanvas({
  nodes, edgeEvaluations, activeEdgeIds, simulationRunning, flowOk,
  diametroHP, diametroBP, selectedPiece, onPlaceNode, onMoveNode, onRemoveNode,
  onAddEdge, onRemoveEdge, onPlacedSuccess,
}: CircuitCanvasProps) {
  const canvasRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<DragState | null>(null);
  const connectingRef = useRef<ConnectState | null>(null);
  const [connecting, setConnecting] = useState<ConnectState | null>(null);

  function toCanvasPoint(clientX: number, clientY: number) {
    const el = canvasRef.current;
    if (!el) return { x: 0, y: 0 };
    const rect = el.getBoundingClientRect();
    return { x: clientX - rect.left + el.scrollLeft, y: clientY - rect.top + el.scrollTop };
  }

  function startNodeDrag(e: React.PointerEvent, kind: ComponentKind) {
    e.stopPropagation();
    const node = nodes[kind];
    if (!node) return;
    dragRef.current = {
      kind,
      startPointerX: e.clientX,
      startPointerY: e.clientY,
      startNodeX: node.x,
      startNodeY: node.y,
    };
    window.addEventListener('pointermove', handleNodeDragMove);
    window.addEventListener('pointerup', endNodeDrag);
  }

  function handleNodeDragMove(e: PointerEvent) {
    const drag = dragRef.current;
    if (!drag) return;
    const dx = e.clientX - drag.startPointerX;
    const dy = e.clientY - drag.startPointerY;
    const nx = Math.min(Math.max(drag.startNodeX + dx, 0), CANVAS_W - NODE_W);
    const ny = Math.min(Math.max(drag.startNodeY + dy, 0), CANVAS_H - NODE_H);
    onMoveNode(drag.kind, nx, ny);
  }

  function endNodeDrag() {
    dragRef.current = null;
    window.removeEventListener('pointermove', handleNodeDragMove);
    window.removeEventListener('pointerup', endNodeDrag);
  }

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
    for (const kind of Object.keys(nodes) as ComponentKind[]) {
      const node = nodes[kind];
      if (!node || kind === cur.from) continue;
      if (p.x >= node.x && p.x <= node.x + NODE_W && p.y >= node.y && p.y <= node.y + NODE_H) {
        onAddEdge(cur.from, kind);
        break;
      }
    }
  }

  function handleCanvasClick(e: React.MouseEvent) {
    if (!selectedPiece) return;
    if (e.target !== canvasRef.current && !(e.target as HTMLElement).classList.contains('canvas-grid')) return;
    const p = toCanvasPoint(e.clientX, e.clientY);
    const x = Math.min(Math.max(p.x - NODE_W / 2, 0), CANVAS_W - NODE_W);
    const y = Math.min(Math.max(p.y - NODE_H / 2, 0), CANVAS_H - NODE_H);
    onPlaceNode(selectedPiece.id, x, y);
    onPlacedSuccess();
  }

  function handleCanvasDragOver(e: React.DragEvent) {
    e.preventDefault();
  }

  function handleCanvasDrop(e: React.DragEvent) {
    e.preventDefault();
    const pieceId = e.dataTransfer.getData('text/piece-id');
    if (!pieceId) return;
    const p = toCanvasPoint(e.clientX, e.clientY);
    const x = Math.min(Math.max(p.x - NODE_W / 2, 0), CANVAS_W - NODE_W);
    const y = Math.min(Math.max(p.y - NODE_H / 2, 0), CANVAS_H - NODE_H);
    onPlaceNode(pieceId, x, y);
  }

  const nodeList = Object.values(nodes).filter(Boolean) as CanvasNode[];

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
          disegna i tubi trascinando dal pallino in basso a destra di ciascun componente fino al componente successivo.
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
          const toNode = nodes[ev.edge.to];
          if (!fromNode || !toNode) return null;
          const c1 = nodeCenter(fromNode);
          const c2 = nodeCenter(toNode);
          const p1 = clipToRect(c1.x, c1.y, NODE_W, NODE_H, c2.x, c2.y);
          const p2 = clipToRect(c2.x, c2.y, NODE_W, NODE_H, c1.x, c1.y);
          const isWrong = ev.status === 'wrong';
          const isHP = ev.status === 'correct-hp';
          const color = isWrong ? '#e0a83f' : isHP ? '#d64545' : '#3f7fd6';
          const marker = isWrong ? 'arrow-wrong' : isHP ? 'arrow-hp' : 'arrow-bp';
          const width = isWrong ? 4 : DIAMETER_STROKE[(isHP ? diametroHP : diametroBP) ?? (isHP ? '3/8' : '1/2')];
          const isActive = activeEdgeIds.has(ev.edge.id);
          const midX = (p1.x + p2.x) / 2;
          const midY = (p1.y + p2.y) / 2;
          const pathId = `edge-path-${ev.edge.id}`;

          return (
            <g key={ev.edge.id}>
              <path
                id={pathId}
                d={`M ${p1.x} ${p1.y} L ${p2.x} ${p2.y}`}
                fill="none"
                stroke={color}
                strokeWidth={width}
                strokeLinecap="round"
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
                <g transform={`translate(${midX} ${midY})`}>
                  <circle r="9" fill="#e0a83f" />
                  <text textAnchor="middle" dy="4" fontSize="12" fontWeight="700" fill="#241a00">!</text>
                </g>
              )}
            </g>
          );
        })}

        {connecting && nodes[connecting.from] && (() => {
          const c1 = nodeCenter(nodes[connecting.from]!);
          const p1 = clipToRect(c1.x, c1.y, NODE_W, NODE_H, connecting.x, connecting.y);
          return (
            <line
              x1={p1.x} y1={p1.y} x2={connecting.x} y2={connecting.y}
              stroke="#c9793f" strokeWidth="3" strokeDasharray="6 6" strokeLinecap="round"
            />
          );
        })()}
      </svg>

      {edgeEvaluations.map((ev) => {
        const fromNode = nodes[ev.edge.from];
        const toNode = nodes[ev.edge.to];
        if (!fromNode || !toNode) return null;
        const c1 = nodeCenter(fromNode);
        const c2 = nodeCenter(toNode);
        const midX = (c1.x + c2.x) / 2;
        const midY = (c1.y + c2.y) / 2;
        return (
          <button
            key={ev.edge.id}
            type="button"
            className="edge-remove-btn"
            style={{ left: midX - 10, top: midY - 10 }}
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
          className="canvas-node"
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
          <div
            className="node-port"
            onPointerDown={(e) => startConnect(e, node.kind)}
            title="Trascina da qui per disegnare il tubo verso il componente successivo"
          />
        </div>
      ))}
    </div>
  );
}
