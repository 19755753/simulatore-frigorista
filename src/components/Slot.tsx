import { useState } from 'react';
import type { ComponentKind, ToolboxPiece } from '../data/components';
import { pieceIcon } from './Toolbox';

interface SlotProps {
  id: ComponentKind;
  label: string;
  displayLabel?: string;
  aiuto: string;
  piece: ToolboxPiece | null;
  isBlocked: boolean;
  style: React.CSSProperties;
  selectedPiece: ToolboxPiece | null;
  onDropPiece: (slotId: ComponentKind, pieceId: string) => { ok: boolean; message?: string };
  onPlacedSuccess: () => void;
  onRemove: (slotId: ComponentKind) => void;
  variant?: 'main' | 'aux';
}

export function Slot({ id, label, displayLabel, aiuto, piece, isBlocked, style, selectedPiece, onDropPiece, onPlacedSuccess, onRemove, variant = 'main' }: SlotProps) {
  const [rejectMessage, setRejectMessage] = useState<string | null>(null);
  const [shaking, setShaking] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  function attemptPlace(pieceId: string) {
    const result = onDropPiece(id, pieceId);
    if (!result.ok) {
      setRejectMessage(result.message ?? 'Posizione non corretta.');
      setShaking(true);
      window.setTimeout(() => setShaking(false), 420);
      window.setTimeout(() => setRejectMessage(null), 4200);
    } else {
      setRejectMessage(null);
      onPlacedSuccess();
    }
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const pieceId = e.dataTransfer.getData('text/piece-id');
    if (!pieceId) return;
    attemptPlace(pieceId);
  }

  function handleClick() {
    if (piece) {
      onRemove(id);
      return;
    }
    if (selectedPiece) attemptPlace(selectedPiece.id);
  }

  return (
    <div
      className={[
        'slot',
        variant === 'aux' ? 'slot-aux' : '',
        piece ? 'slot-filled' : 'slot-empty',
        isBlocked ? 'slot-blocked' : '',
        shaking ? 'slot-shake' : '',
        dragOver ? 'slot-dragover' : '',
      ].filter(Boolean).join(' ')}
      style={style}
      onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
      onDragLeave={() => setDragOver(false)}
      onDrop={handleDrop}
      onClick={handleClick}
      title={aiuto}
    >
      <div className="slot-label">{displayLabel ?? label}</div>
      <div className="slot-body">
        {piece ? pieceIcon(piece) : <div className="slot-placeholder">Trascina qui</div>}
      </div>
      {isBlocked && <div className="slot-blocked-badge">flusso bloccato qui</div>}
      {rejectMessage && <div className="slot-reject-msg">{rejectMessage}</div>}
    </div>
  );
}
