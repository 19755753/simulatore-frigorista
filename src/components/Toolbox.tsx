import type { ComponentKind, ToolboxPiece } from '../data/components';
import {
  CompressorSvg,
  CondenserSvg,
  EvaporatorSvg,
  ExpansionValveSvg,
  FilterSvg,
  FluidCylinderSvg,
  SightGlassSvg,
  SilencerSvg,
  TubePieceSvg,
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
    case 'tubo-hp': return <TubePieceSvg kind="tubo-hp" diametro={piece.diametro!} />;
    case 'tubo-bp': return <TubePieceSvg kind="tubo-bp" diametro={piece.diametro!} />;
    case 'fluido': return <FluidCylinderSvg fluido={piece.fluido!} />;
  }
}

export interface ToolboxSection {
  title: string;
  pieces: ToolboxPiece[];
}

interface ToolboxProps {
  sections: ToolboxSection[];
  usedKinds: Set<ComponentKind>;
  selectedPieceId: string | null;
  onSelectPiece: (piece: ToolboxPiece) => void;
}

export function Toolbox({ sections, usedKinds, selectedPieceId, onSelectPiece }: ToolboxProps) {
  return (
    <div className="toolbox">
      <h2 className="panel-title">Cassetta attrezzi</h2>
      <p className="panel-hint">Trascina un componente nello slot corretto, oppure selezionalo e tocca lo slot di destinazione.</p>
      {sections.map((section) => (
        <div key={section.title} className="toolbox-section">
          <h3 className="toolbox-section-title">{section.title}</h3>
          <div className="toolbox-grid">
            {section.pieces.map((piece) => {
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
      ))}
    </div>
  );
}
