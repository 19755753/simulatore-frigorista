import { CIRCUIT_SLOTS, type ComponentKind, type ToolboxPiece } from '../data/components';
import type { TubeDiameter } from '../data/plantTypes';
import { Slot } from './Slot';

const BOX_W = 176;
const BOX_H = 116;

const SLOT_POS: Record<ComponentKind, { x: number; y: number }> = {
  compressore: { x: 20, y: 40 },
  condensatore: { x: 330, y: 40 },
  filtro: { x: 640, y: 40 },
  voyant: { x: 640, y: 330 },
  detendeur: { x: 330, y: 330 },
  evaporatore: { x: 20, y: 330 },
  silenziatore: { x: 0, y: 0 },
};

const centerY = (y: number) => y + BOX_H / 2;
const centerX = (x: number) => x + BOX_W / 2;

interface Segment {
  x1: number; y1: number; x2: number; y2: number;
  kind: 'HP' | 'BP';
}

const SEGMENTS: Segment[] = [
  { x1: SLOT_POS.compressore.x + BOX_W, y1: centerY(SLOT_POS.compressore.y), x2: SLOT_POS.condensatore.x, y2: centerY(SLOT_POS.condensatore.y), kind: 'HP' },
  { x1: SLOT_POS.condensatore.x + BOX_W, y1: centerY(SLOT_POS.condensatore.y), x2: SLOT_POS.filtro.x, y2: centerY(SLOT_POS.filtro.y), kind: 'HP' },
  { x1: centerX(SLOT_POS.filtro.x), y1: SLOT_POS.filtro.y + BOX_H, x2: centerX(SLOT_POS.voyant.x), y2: SLOT_POS.voyant.y, kind: 'HP' },
  { x1: SLOT_POS.voyant.x, y1: centerY(SLOT_POS.voyant.y), x2: SLOT_POS.detendeur.x + BOX_W, y2: centerY(SLOT_POS.detendeur.y), kind: 'HP' },
  { x1: SLOT_POS.detendeur.x, y1: centerY(SLOT_POS.detendeur.y), x2: SLOT_POS.evaporatore.x + BOX_W, y2: centerY(SLOT_POS.evaporatore.y), kind: 'BP' },
  { x1: centerX(SLOT_POS.evaporatore.x), y1: SLOT_POS.evaporatore.y, x2: centerX(SLOT_POS.compressore.x), y2: SLOT_POS.compressore.y + BOX_H, kind: 'BP' },
];

const DIAMETER_STROKE: Record<TubeDiameter, number> = {
  '1/4': 3, '3/8': 4.5, '1/2': 6, '5/8': 7.5, '3/4': 9, '7/8': 10.5,
};

interface CircuitBoardProps {
  placed: Partial<Record<ComponentKind, ToolboxPiece>>;
  blockedSlotIndex: number | null;
  flowActive: boolean;
  flowOk: boolean;
  diametroHP: TubeDiameter | null;
  diametroBP: TubeDiameter | null;
  selectedPiece: ToolboxPiece | null;
  onDropPiece: (slotId: ComponentKind, pieceId: string) => { ok: boolean; message?: string };
  onPlacedSuccess: () => void;
  onRemove: (slotId: ComponentKind) => void;
}

export function CircuitBoard({
  placed, blockedSlotIndex, flowActive, flowOk, diametroHP, diametroBP, selectedPiece, onDropPiece, onPlacedSuccess, onRemove,
}: CircuitBoardProps) {
  const activeSegmentCount = blockedSlotIndex === null ? SEGMENTS.length : Math.max(0, blockedSlotIndex);

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
            style={{ left: SLOT_POS[slotDef.id].x, top: SLOT_POS[slotDef.id].y, width: BOX_W, height: BOX_H }}
            selectedPiece={selectedPiece}
            onDropPiece={onDropPiece}
            onPlacedSuccess={onPlacedSuccess}
            onRemove={onRemove}
          />
        ))}
      </div>
    </div>
  );
}
