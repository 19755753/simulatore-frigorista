import { AUX_SLOTS, CIRCUIT_SLOTS, type ComponentKind, type ToolboxPiece } from '../data/components';
import { DIAMETER_STROKE } from '../data/plantTypes';
import { Slot } from './Slot';

const BOX_W = 176;
const BOX_H = 116;

const SLOT_POS: Record<ComponentKind, { x: number; y: number; w: number; h: number }> = {
  compressore: { x: 20, y: 40, w: BOX_W, h: BOX_H },
  condensatore: { x: 330, y: 40, w: BOX_W, h: BOX_H },
  filtro: { x: 640, y: 40, w: BOX_W, h: BOX_H },
  voyant: { x: 640, y: 330, w: BOX_W, h: BOX_H },
  detendeur: { x: 330, y: 330, w: BOX_W, h: BOX_H },
  evaporatore: { x: 20, y: 330, w: BOX_W, h: BOX_H },
  silenziatore: { x: 0, y: 0, w: BOX_W, h: BOX_H },
  'tubo-hp': { x: 530, y: 74, w: 110, h: 50 },
  'tubo-bp': { x: 210, y: 364, w: 110, h: 50 },
  fluido: { x: 350, y: 190, w: 200, h: 110 },
};

const centerY = (id: ComponentKind) => SLOT_POS[id].y + SLOT_POS[id].h / 2;
const centerX = (id: ComponentKind) => SLOT_POS[id].x + SLOT_POS[id].w / 2;
const rightX = (id: ComponentKind) => SLOT_POS[id].x + SLOT_POS[id].w;
const bottomY = (id: ComponentKind) => SLOT_POS[id].y + SLOT_POS[id].h;

interface Segment {
  x1: number; y1: number; x2: number; y2: number;
  kind: 'HP' | 'BP';
}

const SEGMENTS: Segment[] = [
  { x1: rightX('compressore'), y1: centerY('compressore'), x2: SLOT_POS.condensatore.x, y2: centerY('condensatore'), kind: 'HP' },
  { x1: rightX('condensatore'), y1: centerY('condensatore'), x2: SLOT_POS.filtro.x, y2: centerY('filtro'), kind: 'HP' },
  { x1: centerX('filtro'), y1: bottomY('filtro'), x2: centerX('voyant'), y2: SLOT_POS.voyant.y, kind: 'HP' },
  { x1: SLOT_POS.voyant.x, y1: centerY('voyant'), x2: rightX('detendeur'), y2: centerY('detendeur'), kind: 'HP' },
  { x1: SLOT_POS.detendeur.x, y1: centerY('detendeur'), x2: rightX('evaporatore'), y2: centerY('evaporatore'), kind: 'BP' },
  { x1: centerX('evaporatore'), y1: SLOT_POS.evaporatore.y, x2: centerX('compressore'), y2: bottomY('compressore'), kind: 'BP' },
];

interface CircuitBoardProps {
  placed: Partial<Record<ComponentKind, ToolboxPiece>>;
  blockedSlotIndex: number | null;
  flowActive: boolean;
  flowOk: boolean;
  selectedPiece: ToolboxPiece | null;
  onDropPiece: (slotId: ComponentKind, pieceId: string) => { ok: boolean; message?: string };
  onPlacedSuccess: () => void;
  onRemove: (slotId: ComponentKind) => void;
}

export function CircuitBoard({
  placed, blockedSlotIndex, flowActive, flowOk, selectedPiece, onDropPiece, onPlacedSuccess, onRemove,
}: CircuitBoardProps) {
  const activeSegmentCount = blockedSlotIndex === null ? SEGMENTS.length : Math.max(0, blockedSlotIndex);
  const diametroHP = placed['tubo-hp']?.diametro ?? null;
  const diametroBP = placed['tubo-bp']?.diametro ?? null;

  return (
    <div className="circuit-board-wrap">
      <svg className="circuit-lines" viewBox="0 0 900 500" preserveAspectRatio="xMidYMid meet">
        {SEGMENTS.map((seg, i) => {
          const isActive = i < activeSegmentCount;
          const width = seg.kind === 'HP' ? DIAMETER_STROKE[diametroHP ?? '3/8'] : DIAMETER_STROKE[diametroBP ?? '1/2'];
          const baseColor = seg.kind === 'HP' ? '#6b2f2f' : '#2c4a6b';
          const activeColor = seg.kind === 'HP' ? '#d64545' : '#3f7fd6';
          return (
            <g key={i}>
              <line x1={seg.x1} y1={seg.y1} x2={seg.x2} y2={seg.y2} stroke={isActive ? activeColor : baseColor} strokeWidth={width} strokeLinecap="round" />
              {isActive && flowActive && (
                <line
                  x1={seg.x1} y1={seg.y1} x2={seg.x2} y2={seg.y2}
                  stroke={flowOk ? '#fff9e0' : '#ffc93f'}
                  strokeWidth={Math.max(2, width - 3)}
                  strokeLinecap="round"
                  strokeDasharray="10 12"
                  className={flowOk ? 'flow-anim' : 'flow-anim flow-anim-warning'}
                />
              )}
            </g>
          );
        })}
      </svg>
      <div className="circuit-slots">
        {CIRCUIT_SLOTS.map((slotDef, i) => (
          <Slot
            key={slotDef.id}
            id={slotDef.id}
            label={slotDef.label}
            aiuto={slotDef.aiuto}
            piece={placed[slotDef.id] ?? null}
            isBlocked={blockedSlotIndex === i}
            style={{ left: SLOT_POS[slotDef.id].x, top: SLOT_POS[slotDef.id].y, width: SLOT_POS[slotDef.id].w, height: SLOT_POS[slotDef.id].h }}
            selectedPiece={selectedPiece}
            onDropPiece={onDropPiece}
            onPlacedSuccess={onPlacedSuccess}
            onRemove={onRemove}
          />
        ))}
        {AUX_SLOTS.map((slotDef) => (
          <Slot
            key={slotDef.id}
            id={slotDef.id}
            label={slotDef.label}
            displayLabel={slotDef.compactLabel}
            aiuto={slotDef.aiuto}
            piece={placed[slotDef.id] ?? null}
            isBlocked={false}
            style={{ left: SLOT_POS[slotDef.id].x, top: SLOT_POS[slotDef.id].y, width: SLOT_POS[slotDef.id].w, height: SLOT_POS[slotDef.id].h }}
            selectedPiece={selectedPiece}
            onDropPiece={onDropPiece}
            onPlacedSuccess={onPlacedSuccess}
            onRemove={onRemove}
            variant="aux"
          />
        ))}
      </div>
    </div>
  );
}
