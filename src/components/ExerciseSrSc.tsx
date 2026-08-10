export interface SrScResult {
  correct: boolean;
  expected: number;
  userValue: number;
}

interface ExerciseSrScProps {
  hpBar: number;
  bpBar: number;
  tempCond: number;
  tempEvap: number;
  srMeasuredTemp: number;
  scMeasuredTemp: number;
  srAnswer: string;
  scAnswer: string;
  onSrAnswerChange: (value: string) => void;
  onScAnswerChange: (value: string) => void;
  srResult: SrScResult | null;
  scResult: SrScResult | null;
  onCheckSr: () => void;
  onCheckSc: () => void;
  onRegenerate: () => void;
}

const TOLERANCE = 0.5;

function SrResultBanner({ result, tempCond, srMeasuredTemp }: { result: SrScResult | null; tempCond: number; srMeasuredTemp: number }) {
  if (!result) return null;
  return (
    <div className={`exercise-result${result.correct ? ' is-correct' : ' is-wrong'}`}>
      <p className="exercise-result-title">
        {result.correct ? 'Esatto!' : 'Non corretto.'} Hai risposto {result.userValue.toFixed(1)} °C
      </p>
      <p className="exercise-result-detail">
        Alla pressione HP letta corrisponde (dalla tabella) una temperatura di saturazione di{' '}
        <strong>{tempCond} °C</strong>. SR = T<sub>sat HP</sub> − T<sub>misurata</sub> = {tempCond} °C −{' '}
        {srMeasuredTemp.toFixed(1)} °C = <strong>{result.expected.toFixed(1)} °C</strong> (tolleranza ±{TOLERANCE}°C).
      </p>
    </div>
  );
}

function ScResultBanner({ result, tempEvap, scMeasuredTemp }: { result: SrScResult | null; tempEvap: number; scMeasuredTemp: number }) {
  if (!result) return null;
  return (
    <div className={`exercise-result${result.correct ? ' is-correct' : ' is-wrong'}`}>
      <p className="exercise-result-title">
        {result.correct ? 'Esatto!' : 'Non corretto.'} Hai risposto {result.userValue.toFixed(1)} °C
      </p>
      <p className="exercise-result-detail">
        Alla pressione BP letta corrisponde (dalla tabella) una temperatura di saturazione di{' '}
        <strong>{tempEvap} °C</strong>. SC = T<sub>bulbo</sub> − T<sub>sat BP</sub> = {scMeasuredTemp.toFixed(1)} °C −{' '}
        {tempEvap} °C = <strong>{result.expected.toFixed(1)} °C</strong> (tolleranza ±{TOLERANCE}°C).
      </p>
    </div>
  );
}

export function ExerciseSrSc({
  hpBar, bpBar, tempCond, tempEvap, srMeasuredTemp, scMeasuredTemp,
  srAnswer, scAnswer, onSrAnswerChange, onScAnswerChange,
  srResult, scResult, onCheckSr, onCheckSc, onRegenerate,
}: ExerciseSrScProps) {
  return (
    <div className="exercise-panel">
      <div className="exercise-panel-header">
        <h2 className="panel-title" style={{ margin: 0 }}>Esercizio: calcola SR e SC</h2>
        <button type="button" className="exercise-regenerate-btn" onClick={onRegenerate}>
          Nuovi valori
        </button>
      </div>
      <p className="panel-hint">
        Trovi la pressione al manometro e una temperatura misurata. Ricava tu la temperatura di
        saturazione dalla tabella pressione/temperatura e calcola SR/SC a mano.
        Valori generati casualmente per l'esercizio, non da un modello termico reale.
      </p>

      <div className="exercise-cards">
        <div className="exercise-card">
          <h3 className="exercise-card-title">Sottoraffreddamento (SR)</h3>
          <div className="exercise-readouts">
            <span className="exercise-chip exercise-chip-hp">HP: {hpBar.toFixed(1)} bar</span>
            <span className="exercise-chip">Uscita condensatore: {srMeasuredTemp.toFixed(1)} °C</span>
          </div>
          <div className="exercise-input-row">
            <label>
              <span>SR calcolato (°C)</span>
              <input
                type="text"
                inputMode="decimal"
                value={srAnswer}
                onChange={(e) => onSrAnswerChange(e.target.value)}
                placeholder="es. 5.5"
              />
            </label>
            <button type="button" className="exercise-check-btn" onClick={onCheckSr}>Verifica</button>
          </div>
          <SrResultBanner result={srResult} tempCond={tempCond} srMeasuredTemp={srMeasuredTemp} />
        </div>

        <div className="exercise-card">
          <h3 className="exercise-card-title">Surriscaldamento (SC)</h3>
          <div className="exercise-readouts">
            <span className="exercise-chip exercise-chip-bp">BP: {bpBar.toFixed(1)} bar</span>
            <span className="exercise-chip">Temperatura al bulbo: {scMeasuredTemp.toFixed(1)} °C</span>
          </div>
          <div className="exercise-input-row">
            <label>
              <span>SC calcolato (°C)</span>
              <input
                type="text"
                inputMode="decimal"
                value={scAnswer}
                onChange={(e) => onScAnswerChange(e.target.value)}
                placeholder="es. 6.0"
              />
            </label>
            <button type="button" className="exercise-check-btn" onClick={onCheckSc}>Verifica</button>
          </div>
          <ScResultBanner result={scResult} tempEvap={tempEvap} scMeasuredTemp={scMeasuredTemp} />
        </div>
      </div>
    </div>
  );
}
