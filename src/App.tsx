import { useMemo, useState } from 'react';
import './App.css';
import { CircuitBoard } from './components/CircuitBoard';
import { Toolbox, type ToolboxSection } from './components/Toolbox';
import { Gauge } from './components/Gauge';
import {
  SILENZIATORE_PIECE,
  toolboxForCompressors,
  toolboxFluids,
  toolboxTubesBP,
  toolboxTubesHP,
  type ComponentKind,
} from './data/components';
import { COMPRESSOR_POWER, PLANT_TYPES, diameterGuideFor, type PlantTypeId } from './data/plantTypes';
import { TEMP_RANGE, saturationBarAssoluti } from './data/refrigerants';
import { canPlacePiece, selectedFluid, validateCircuit, type PlacedPieces } from './logic/validation';

const tempOptions: number[] = [];
for (let t = TEMP_RANGE.min; t <= TEMP_RANGE.max; t += TEMP_RANGE.step) tempOptions.push(t);

function App() {
  const [plantTypeId, setPlantTypeId] = useState<PlantTypeId>('climatizzatore');
  const plantType = PLANT_TYPES[plantTypeId];

  const [placed, setPlaced] = useState<PlacedPieces>({});
  const [selectedPieceId, setSelectedPieceId] = useState<string | null>(null);
  const [tempEvap, setTempEvap] = useState<number>(-10);
  const [tempCond, setTempCond] = useState<number>(40);

  const toolboxSections: ToolboxSection[] = useMemo(() => {
    const componenti = toolboxForCompressors(plantType.compressoriDisponibili);
    if (plantType.hasSilenziatoreOpzionale) componenti.push(SILENZIATORE_PIECE);
    const sections: ToolboxSection[] = [
      { title: 'Componenti circuito', pieces: componenti },
      { title: 'Diametri tubo', pieces: [...toolboxTubesHP(), ...toolboxTubesBP()] },
      { title: 'Fluido frigorigeno', pieces: toolboxFluids(plantType.fluidiDisponibili) },
    ];
    return sections;
  }, [plantType]);

  const allPieces = useMemo(() => toolboxSections.flatMap((s) => s.pieces), [toolboxSections]);

  const selectedPiece = allPieces.find((p) => p.id === selectedPieceId) ?? null;

  const usedKinds = useMemo(() => new Set(Object.keys(placed) as ComponentKind[]), [placed]);

  const effectivePotenza = placed.compressore?.variant
    ? COMPRESSOR_POWER[placed.compressore.variant]
    : plantType.potenza;

  const diameterGuide = diameterGuideFor(effectivePotenza);

  const validation = validateCircuit({
    placed,
    potenza: effectivePotenza,
    tempEvap,
    tempCond,
  });

  function handlePlantTypeChange(id: PlantTypeId) {
    setPlantTypeId(id);
    setPlaced({});
    setSelectedPieceId(null);
  }

  function handleDropPiece(slotId: ComponentKind, pieceId: string) {
    const piece = allPieces.find((p) => p.id === pieceId);
    if (!piece) return { ok: false, message: 'Componente non riconosciuto.' };
    const check = canPlacePiece(slotId, piece);
    if (check.ok) {
      setPlaced((prev) => ({ ...prev, [slotId]: piece }));
    }
    return check;
  }

  function handleRemove(slotId: ComponentKind) {
    setPlaced((prev) => {
      const next = { ...prev };
      delete next[slotId];
      return next;
    });
  }

  const fluid = selectedFluid(placed);
  const hpBar = fluid ? saturationBarAssoluti(fluid, tempCond) : null;
  const bpBar = fluid ? saturationBarAssoluti(fluid, tempEvap) : null;
  const gaugesActive = validation.isFullyCorrect;

  return (
    <div className="app-shell">
      <header className="app-header">
        <h1>Banco di montaggio virtuale — circuito frigorifero</h1>
        <p className="app-subtitle">
          Strumento didattico per esercitarsi sulla sequenza di montaggio e la lettura di manometri/pressioni.
          Non è un tool di progettazione professionale.
        </p>
      </header>

      <div className="app-layout">
        <aside className="controls-panel">
          <h2 className="panel-title">Impianto</h2>
          <label className="field">
            <span>Tipo di impianto</span>
            <select value={plantTypeId} onChange={(e) => handlePlantTypeChange(e.target.value as PlantTypeId)}>
              {Object.values(PLANT_TYPES).map((pt) => (
                <option key={pt.id} value={pt.id}>{pt.label}</option>
              ))}
            </select>
          </label>
          <p className="panel-hint">{plantType.descrizione}</p>
          {plantType.fluidiNonVerificati && (
            <p className="panel-hint panel-hint-muted">
              In pratica si userebbero anche {plantType.fluidiNonVerificati.join(', ')}, non inclusi qui perché
              in questa v1 mancano dati di saturazione verificati da fonte tecnica affidabile.
            </p>
          )}

          <p className="panel-hint">
            Guida diametri per impianto <strong>{diameterGuide.label}</strong>: HP {diameterGuide.hp.join(', ')}"
            &nbsp;· BP {diameterGuide.bp.join(', ')}".
            <br />
            <span className="panel-hint-muted">
              È una guida didattica semplificata per esercizio, non un calcolo reale di perdita di carico
              (che richiede lunghezza linea, dislivelli, numero di curve, ecc.). Trascina il tubo del diametro
              scelto sulla linea corrispondente nel circuito.
            </span>
          </p>

          <h2 className="panel-title">Temperature di esercizio</h2>
          <label className="field">
            <span>Temperatura di evaporazione</span>
            <select value={tempEvap} onChange={(e) => setTempEvap(Number(e.target.value))}>
              {tempOptions.map((t) => <option key={t} value={t}>{t} °C</option>)}
            </select>
          </label>
          <label className="field">
            <span>Temperatura di condensazione</span>
            <select value={tempCond} onChange={(e) => setTempCond(Number(e.target.value))}>
              {tempOptions.map((t) => <option key={t} value={t}>{t} °C</option>)}
            </select>
          </label>
          <p className="panel-hint panel-hint-muted">
            Uniche selezioni non trascinabili: sono valori numerici digitati/letti, non pezzi fisici del circuito.
          </p>

          <div className="gauges-panel">
            <Gauge kind="BP" valueBar={bpBar} maxBar={40} active={gaugesActive} />
            <Gauge kind="HP" valueBar={hpBar} maxBar={60} active={gaugesActive} />
          </div>
        </aside>

        <main className="main-area">
          <Toolbox
            sections={toolboxSections}
            usedKinds={usedKinds}
            selectedPieceId={selectedPieceId}
            onSelectPiece={(p) => setSelectedPieceId((cur) => (cur === p.id ? null : p.id))}
          />

          <CircuitBoard
            placed={placed}
            blockedSlotIndex={validation.blockedSlotIndex}
            flowActive={validation.sequenceComplete}
            flowOk={validation.isFullyCorrect}
            selectedPiece={selectedPiece}
            onDropPiece={handleDropPiece}
            onPlacedSuccess={() => setSelectedPieceId(null)}
            onRemove={handleRemove}
          />

          <div className="messages-panel">
            {validation.isFullyCorrect && (
              <div className="message message-ok">
                Circuito montato correttamente: sequenza, diametri, fluido e temperature sono coerenti. Il fluido scorre nel circuito.
              </div>
            )}
            {validation.messages.map((m, i) => (
              <div key={i} className={`message message-${m.level}`}>{m.text}</div>
            ))}
          </div>

          <details className="legend">
            <summary>Legenda e note didattiche</summary>
            <ul>
              <li><span className="swatch swatch-hp" /> Linea alta pressione (HP) — mandata / liquido</li>
              <li><span className="swatch swatch-bp" /> Linea bassa pressione (BP) — aspirazione</li>
              <li>Pressioni calcolate da tabelle di saturazione verificate (CoolProp 7.2.0, cross-check ASHRAE/produttore), passo 5°C con interpolazione lineare.</li>
              <li>bar assoluti = kPa gauge / 100 + 1.013</li>
              <li>Tabella diametri: guida didattica semplificata per esercizio, non calcolo di perdita di carico reale.</li>
            </ul>
          </details>
        </main>
      </div>
    </div>
  );
}

export default App;
