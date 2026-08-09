import { useMemo, useRef, useState } from 'react';
import './App.css';
import { CircuitCanvas } from './components/CircuitCanvas';
import { Slot } from './components/Slot';
import { Toolbox, type ToolboxSection } from './components/Toolbox';
import { Gauge } from './components/Gauge';
import {
  AUX_SLOTS,
  SILENZIATORE_PIECE,
  toolboxForCompressors,
  toolboxFluids,
  toolboxTubesBP,
  toolboxTubesHP,
  type ComponentKind,
} from './data/components';
import { COMPRESSOR_POWER, PLANT_TYPES, diameterGuideFor, type PlantTypeId } from './data/plantTypes';
import { TEMP_RANGE, saturationBarAssoluti } from './data/refrigerants';
import {
  canPlaceAux,
  selectedFluid,
  validateCircuit,
  type CanvasNode,
  type PlacedNodes,
  type PlacedPieces,
  type WireEdge,
} from './logic/validation';

const tempOptions: number[] = [];
for (let t = TEMP_RANGE.min; t <= TEMP_RANGE.max; t += TEMP_RANGE.step) tempOptions.push(t);

function App() {
  const [plantTypeId, setPlantTypeId] = useState<PlantTypeId>('climatizzatore');
  const plantType = PLANT_TYPES[plantTypeId];

  const [nodes, setNodes] = useState<PlacedNodes>({});
  const [edges, setEdges] = useState<WireEdge[]>([]);
  const [auxPlaced, setAuxPlaced] = useState<PlacedPieces>({});
  const [selectedPieceId, setSelectedPieceId] = useState<string | null>(null);
  const [tempEvap, setTempEvap] = useState<number>(-10);
  const [tempCond, setTempCond] = useState<number>(40);
  const [simulationRunning, setSimulationRunning] = useState(false);
  const edgeCounter = useRef(0);

  const toolboxSections: ToolboxSection[] = useMemo(() => {
    const componenti = toolboxForCompressors(plantType.compressoriDisponibili);
    if (plantType.hasSilenziatoreOpzionale) componenti.push(SILENZIATORE_PIECE);
    return [
      { title: 'Componenti circuito', pieces: componenti },
      { title: 'Diametri tubo', pieces: [...toolboxTubesHP(), ...toolboxTubesBP()] },
      { title: 'Fluido frigorigeno', pieces: toolboxFluids(plantType.fluidiDisponibili) },
    ];
  }, [plantType]);

  const allPieces = useMemo(() => toolboxSections.flatMap((s) => s.pieces), [toolboxSections]);
  const selectedPiece = allPieces.find((p) => p.id === selectedPieceId) ?? null;

  const usedKinds = useMemo(
    () => new Set([...Object.keys(nodes), ...Object.keys(auxPlaced)] as ComponentKind[]),
    [nodes, auxPlaced],
  );

  const effectivePotenza = nodes.compressore?.piece.variant
    ? COMPRESSOR_POWER[nodes.compressore.piece.variant]
    : plantType.potenza;
  const diameterGuide = diameterGuideFor(effectivePotenza);

  const validation = validateCircuit({
    nodes,
    edges,
    auxPlaced,
    potenza: effectivePotenza,
    tempEvap,
    tempCond,
  });

  function handlePlantTypeChange(id: PlantTypeId) {
    setPlantTypeId(id);
    setNodes({});
    setEdges([]);
    setAuxPlaced({});
    setSelectedPieceId(null);
    setSimulationRunning(false);
  }

  function handlePlaceNode(pieceId: string, x: number, y: number) {
    const piece = allPieces.find((p) => p.id === pieceId);
    if (!piece) return;
    if (piece.kind === 'tubo-hp' || piece.kind === 'tubo-bp' || piece.kind === 'fluido') return;
    if (nodes[piece.kind]) return;
    const node: CanvasNode = { kind: piece.kind, piece, x, y };
    setNodes((prev) => ({ ...prev, [piece.kind]: node }));
  }

  function handleMoveNode(kind: ComponentKind, x: number, y: number) {
    setNodes((prev) => (prev[kind] ? { ...prev, [kind]: { ...prev[kind]!, x, y } } : prev));
  }

  function handleRemoveNode(kind: ComponentKind) {
    setNodes((prev) => {
      const next = { ...prev };
      delete next[kind];
      return next;
    });
    setEdges((prev) => prev.filter((e) => e.from !== kind && e.to !== kind));
  }

  function handleAddEdge(from: ComponentKind, to: ComponentKind) {
    setEdges((prev) => {
      const withoutSameSource = prev.filter((e) => e.from !== from);
      const id = `${from}__${to}__${edgeCounter.current++}`;
      return [...withoutSameSource, { id, from, to }];
    });
  }

  function handleRemoveEdge(id: string) {
    setEdges((prev) => prev.filter((e) => e.id !== id));
  }

  function handleDropAux(slotId: ComponentKind, pieceId: string) {
    const piece = allPieces.find((p) => p.id === pieceId);
    if (!piece) return { ok: false, message: 'Componente non riconosciuto.' };
    const check = canPlaceAux(slotId, piece);
    if (check.ok) setAuxPlaced((prev) => ({ ...prev, [slotId]: piece }));
    return check;
  }

  function handleRemoveAux(slotId: ComponentKind) {
    setAuxPlaced((prev) => {
      const next = { ...prev };
      delete next[slotId];
      return next;
    });
  }

  const fluid = selectedFluid(auxPlaced);
  const hpBar = fluid ? saturationBarAssoluti(fluid, tempCond) : null;
  const bpBar = fluid ? saturationBarAssoluti(fluid, tempEvap) : null;
  const gaugesLive = simulationRunning && validation.isFullyCorrect;
  const flowActive = simulationRunning && validation.sequenceComplete;

  const diametroHP = auxPlaced['tubo-hp']?.diametro ?? null;
  const diametroBP = auxPlaced['tubo-bp']?.diametro ?? null;

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

          <h2 className="panel-title">Diametri e fluido</h2>
          <div className="aux-slots-row">
            {AUX_SLOTS.map((s) => (
              <Slot
                key={s.id}
                id={s.id}
                label={s.label}
                displayLabel={s.compactLabel}
                aiuto={s.aiuto}
                piece={auxPlaced[s.id] ?? null}
                style={{ width: 122, height: 66 }}
                selectedPiece={selectedPiece}
                onDropPiece={handleDropAux}
                onPlacedSuccess={() => setSelectedPieceId(null)}
                onRemove={handleRemoveAux}
                variant="aux"
              />
            ))}
          </div>
          <p className="panel-hint">
            Guida diametri per <strong>{diameterGuide.label}</strong>: HP {diameterGuide.hp.join(', ')}"
            &nbsp;· BP {diameterGuide.bp.join(', ')}".
            <br />
            <span className="panel-hint-muted">
              Guida didattica semplificata, non un calcolo reale di perdita di carico.
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
            <Gauge kind="BP" valueBar={bpBar} maxBar={40} active={gaugesLive} running={simulationRunning} />
            <Gauge kind="HP" valueBar={hpBar} maxBar={60} active={gaugesLive} running={simulationRunning} />
          </div>
        </aside>

        <main className="main-area">
          <div className="sim-controls">
            <button
              type="button"
              className={`sim-button${simulationRunning ? ' is-running' : ''}`}
              onClick={() => setSimulationRunning((v) => !v)}
            >
              {simulationRunning ? 'Ferma simulazione' : 'Avvia simulazione'}
            </button>
            <span className={`sim-status${validation.isFullyCorrect ? ' is-ok' : ' is-warning'}`}>
              {validation.isFullyCorrect
                ? 'Circuito pronto: sequenza, diametri, fluido e temperature coerenti.'
                : simulationRunning
                  ? 'Simulazione avviata: il flusso si ferma al primo errore, vedi sotto perché.'
                  : 'Circuito non ancora completo: vedi i suggerimenti sotto.'}
            </span>
          </div>

          <div className="workbench">
            <Toolbox
              sections={toolboxSections}
              usedKinds={usedKinds}
              selectedPieceId={selectedPieceId}
              onSelectPiece={(p) => setSelectedPieceId((cur) => (cur === p.id ? null : p.id))}
            />
            <CircuitCanvas
              nodes={nodes}
              edgeEvaluations={validation.edgeEvaluations}
              activeEdgeIds={validation.activeEdgeIds}
              simulationRunning={flowActive}
              flowOk={validation.isFullyCorrect}
              diametroHP={diametroHP}
              diametroBP={diametroBP}
              selectedPiece={selectedPiece}
              onPlaceNode={handlePlaceNode}
              onMoveNode={handleMoveNode}
              onRemoveNode={handleRemoveNode}
              onAddEdge={handleAddEdge}
              onRemoveEdge={handleRemoveEdge}
              onPlacedSuccess={() => setSelectedPieceId(null)}
            />
          </div>

          <div className="messages-panel">
            {validation.isFullyCorrect && (
              <div className="message-ok-banner">
                Circuito montato correttamente: sequenza, diametri, fluido e temperature sono coerenti.
              </div>
            )}
            {validation.messages.map((m, i) => (
              <div key={i} className={`message-card${m.severity === 'warning' ? ' is-warning' : ''}`}>
                <div className="message-card-icon">{m.severity === 'warning' ? '!' : '×'}</div>
                <div className="message-card-body">
                  <p className="message-card-title">{m.title}</p>
                  <p className="message-card-why">{m.why}</p>
                  <div className="message-card-whatodo">
                    <span className="message-card-whatodo-label">Cosa fare</span>
                    <span>{m.whatToDo}</span>
                  </div>
                </div>
              </div>
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
              <li>Posiziona i componenti dove vuoi e collegali trascinando dal pallino in basso a destra di ciascuno: la validazione controlla solo la logica dei collegamenti, non la disposizione grafica.</li>
            </ul>
          </details>
        </main>
      </div>
    </div>
  );
}

export default App;
