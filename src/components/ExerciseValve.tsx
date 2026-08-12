import { ServiceValveSvg } from './pieces';
import { VALVE_POSITION_LABEL, type ValvePosition, type ValveScenario } from '../data/serviceValveScenarios';

interface ExerciseValveProps {
  scenario: ValveScenario;
  position: ValvePosition | null;
  onSelectPosition: (position: ValvePosition) => void;
  checkedPosition: ValvePosition | null;
  onCheck: () => void;
  onRegenerate: () => void;
}

const POSITIONS: ValvePosition[] = ['avanti', 'intermedia', 'indietro'];

export function ExerciseValve({
  scenario, position, onSelectPosition, checkedPosition, onCheck, onRegenerate,
}: ExerciseValveProps) {
  const isCorrect = checkedPosition !== null && checkedPosition === scenario.posizioneCorretta;
  const resultText = checkedPosition !== null ? scenario.spiegazioni[checkedPosition] : null;

  return (
    <div className="exercise-panel">
      <div className="exercise-panel-header">
        <h2 className="panel-title" style={{ margin: 0 }}>Esercizio: valvole di servizio</h2>
        <button type="button" className="exercise-regenerate-btn" onClick={onRegenerate}>
          Nuovo scenario
        </button>
      </div>
      <p className="panel-hint">
        Le due valvole di servizio (tappo rosso su HP, tappo blu su BP) all’uscita dell’unità esterna si
        manovrano allo stesso modo: in questo esercizio semplificato si spostano insieme. Leggi lo scenario,
        scegli la posizione corretta e verifica.
      </p>

      <div className="exercise-card">
        <h3 className="exercise-card-title">Scenario</h3>
        <p className="valve-scenario-text">{scenario.situazione}</p>

        <div className="valve-graphic-wrap">
          <ServiceValveSvg position={position ?? 'indietro'} />
        </div>

        <div className="valve-position-row">
          {POSITIONS.map((p) => (
            <button
              key={p}
              type="button"
              className={`valve-position-btn${position === p ? ' is-selected' : ''}`}
              onClick={() => onSelectPosition(p)}
            >
              {VALVE_POSITION_LABEL[p]}
            </button>
          ))}
        </div>

        <div className="exercise-input-row" style={{ marginTop: 12 }}>
          <button type="button" className="exercise-check-btn" onClick={onCheck} disabled={position === null}>
            Verifica
          </button>
        </div>

        {resultText && (
          <div className={`exercise-result${isCorrect ? ' is-correct' : ' is-wrong'}`}>
            <p className="exercise-result-title">{isCorrect ? 'Esatto!' : 'Non corretto.'}</p>
            <p className="exercise-result-detail">{resultText}</p>
          </div>
        )}
      </div>
    </div>
  );
}
