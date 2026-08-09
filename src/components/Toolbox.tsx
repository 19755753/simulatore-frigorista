import type { ComponentKind, ToolboxPiece } from '../data/components';
import {
  CompressorSvg,
  CondenserSvg,
  EvaporatorSvg,
  ExpansionValveSvg,
  FilterSvg,
  SightGlassSvg,
  SilencerSvg,
} from './pieces';

export function pieceIcon(piece: ToolboxPiece) {
  switch (piece.kind) {
    case 'compressore': return <CompressorSvg variant={piece.variant!} />;
    case 'condensatore': return <CondenserSvg />;
    case 'filtro': return <FilterSvg />;
    case 'voyant': return <SightGlassSvg />;
    case 'detendeur': return <ExpansionValveSvg />;
    case 'evaporatore': return <EvaporatorSvg />;
    case 'silenziatore': return <SilencerSvg />;
  }
}

interface ToolboxProps {
  pieces: ToolboxPiece[];
  usedKinds: Set<ComponentKind>;
  selectedPieceId: string | null;
  onSelectPiece: (piece: ToolboxPiece) => void;
}

export function Toolbox({ pieces, usedKinds, selectedPieceId, onSelectPiece }: ToolboxProps) {
  return (
    <div className="toolbox">
      <h2 className="panel-title">Cassetta attrezzi</h2>
      <p className="panel-hint">Trascina un componente nello slot corretto, oppure selezionalo e tocca lo slot di destinazione.</p>
      <div className="toolbox-grid">
        {pieces.map((piece) => {
          const disabled = piece.kind !== 'silenziatore' && usedKinds.has(piece.kind);
          const selected = selectedPieceId === piece.id;
          return (
            <div
              key={piece.id}
              className={`toolbox-piece${disabled ? ' is-disabled' : ''}${selected ? ' is-selected' : ''}`}
              draggable={!disabled}
              onDragStart={(e) => {
                e.dataTransfer.setData('text/piece-id', piece.id);
                e.dataTransfer.effectAllowed = 'move';
              }}
              onClick={() => !disabled && onSelectPiece(piece)}
              role="button"
              tabIndex={disabled ? -1 : 0}
              aria-disabled={disabled}
              title={piece.descrizioneBreve}
            >
              {pieceIcon(piece)}
              <span className="toolbox-piece-label">{piece.label}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
