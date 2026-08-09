import { useMemo, useState } from 'react';
import './App.css';
import { CircuitBoard } from './components/CircuitBoard';
import { Toolbox } from './components/Toolbox';
import { Gauge } from './components/Gauge';
import { SILENZIATORE_PIECE, toolboxForCompressors, type ComponentKind } from './data/components';
import {
  BP_DIAMETERS,
  COMPRESSOR_POWER,
  HP_DIAMETERS,
  PLANT_TYPES,
  diameterGuideFor,
  type PlantTypeId,
  type TubeDiameter,
} from './data/plantTypes';
import { REFRIGERANTS, TEMP_RANGE, saturationBarAssoluti, type RefrigerantId } from './data/refrigerants';
import { canPlacePiece, validateCircuit, type PlacedPieces } from './logic/validation';

const tempOptions: number[] = [];
for (let t = TEMP_RANGE.min; t <= TEMP_RANGE.max; t += TEMP_RANGE.step) tempOptions.push(t);

function App() {
  const [plantTypeId, setPlantTypeId] = useState<PlantTypeId>('climatizzatore');
  const plantType = PLANT_TYPES[plantTypeId];

  const [fluid, setFluid] = useState<RefrigerantId>(plantType.fluidiDisponibili[0]);
  const [placed, setPlaced] = useState<PlacedPieces>({});
  const [selectedPieceId, setSelectedPieceId] = useState<string | null>(null);
  const [diametroHP, setDiametroHP] = useState<TubeDiameter | null>(null);
  const [diametroBP, setDiametroBP] = useState<TubeDiameter | null>(null);
  const [tempEvap, setTempEvap] = useState<number>(-10);
  const [tempCond, setTempCond] = useState<number>(40);

  const toolboxPieces = useMemo(() => {
    const pieces = toolboxForCompressors(plantType.compressoriDisponibili);
    if (plantType.hasSilenziatoreOpzionale) pieces.push(SILENZIATORE_PIECE);
    return pieces;
  }, [plantType]);

  const selectedPiece = toolboxPieces.find((p) => p.id === selectedPieceId) ?? null;

  const usedKinds = useMemo(() => new Set(Object.keys(placed) as ComponentKind[]), [placed]);

  const effectivePotenza = placed.compressore?.variant
    ? COMPRESSOR_POWER[placed.compressore.variant]
    : plantType.potenza;

  const diameterGuide = diameterGuideFor(effectivePotenza);

  const validation = validateCircuit({
    placed,
    potenza: effectivePotenza,
    diametroHP,
    diametroBP,
    tempEvap,
    tempCond,
  });

  function handlePlantTypeChange(id: PlantTypeId) {
    setPlantTypeId(id);
    setPlaced({});
    setSelectedPieceId(null);
    setDiametroHP(null);
    setDiametroBP(null);
    setFluid(PLANT_TYPES[id].fluidiDisponibili[0]);
  }

  function handleDropPiece(slotId: ComponentKind, pieceId: string) {
    const piece = toolboxPieces.find((p) => p.id === pieceId);
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

  const hpBar = saturationBarAssoluti(fluid, tempCond);
  const bpBar = saturationBarAssoluti(fluid, tempEvap);
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

          <label className="field">
            <span>Fluido frigorigeno</span>
            <select value={fluid} onChange={(e) => setFluid(e.target.value as RefrigerantId)}>
              {plantType.fluidiDisponibili.map((f) => (
                <option key={f} value={f}>{REFRIGERANTS[f].label} — {REFRIGERANTS[f].note}</option>
              ))}
            </select>
          </label>
          {plantType.fluidiNonVerificati && (
            <p className="panel-hint panel-hint-muted">
              In pratica si userebbero anche {plantType.fluidiNonVerificati.join(', ')}, non inclusi qui perché
              in questa v1 mancano dati di saturazione verificati da fonte tecnica affidabile.
            </p>
          )}

          <h2 className="panel-title">Diametri tubi</h2>
          <label className="field">
            <span>Linea liquido (HP)</span>
            <select value={diametroHP ?? ''} onChange={(e) => setDiametroHP((e.target.value || null) as TubeDiameter | null)}>
              <option value="">— seleziona —</option>
              {HP_DIAMETERS.map((d) => <option key={d} value={d}>{d}"</option>)}
            </select>
          </label>
          <label className="field">
            <span>Aspirazione (BP)</span>
            <select value={diametroBP ?? ''} onChange={(e) => setDiametroBP((e.target.value || null) as TubeDiameter | null)}>
              <option value="">— seleziona —</option>
              {BP_DIAMETERS.map((d) => <option key={d} value={d}>{d}"</option>)}
            </select>
          </label>
          <p className="panel-hint">
            Guida indicativa per impianto <strong>{diameterGuide.label}</strong>: HP {diameterGuide.hp.join(', ')}"
            &nbsp;· BP {diameterGuide.bp.join(', ')}".
            <br />
            <span className="panel-hint-muted">
              È una guida didattica semplificata per esercizio, non un calcolo reale di perdita di carico
              (che richiede lunghezza linea, dislivelli, numero di curve, ecc.).
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

          <div className="gauges-panel">
            <Gauge kind="BP" valueBar={bpBar} maxBar={40} active={gaugesActive} />
            <Gauge kind="HP" valueBar={hpBar} maxBar={60} active={gaugesActive} />
          </div>
        </aside>

        <main className="main-area">
          <Toolbox
            pieces={toolboxPieces}
            usedKinds={usedKinds}
            selectedPieceId={selectedPieceId}
            onSelectPiece={(p) => setSelectedPieceId((cur) => (cur === p.id ? null : p.id))}
          />

          <CircuitBoard
            placed={placed}
            blockedSlotIndex={validation.blockedSlotIndex}
            flowActive={validation.sequenceComplete}
            flowOk={validation.isFullyCorrect}
            diametroHP={diametroHP}
            diametroBP={diametroBP}
            selectedPiece={selectedPiece}
            onDropPiece={handleDropPiece}
            onPlacedSuccess={() => setSelectedPieceId(null)}
            onRemove={handleRemove}
          />

          <div className="messages-panel">
            {validation.isFullyCorrect && (
              <div className="message message-ok">
                Circuito montato correttamente: sequenza, diametri e temperature sono coerenti. Il fluido scorre nel circuito.
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
