import { REFRIGERANTS, TEMP_RANGE, type RefrigerantId } from '../data/refrigerants';

interface PtTableProps {
  fluido: RefrigerantId | null;
}

export function PtTable({ fluido }: PtTableProps) {
  const temps: number[] = [];
  for (let t = TEMP_RANGE.min; t <= TEMP_RANGE.max; t += TEMP_RANGE.step) temps.push(t);

  return (
    <details className="legend pt-table-panel">
      <summary>Tabella pressione/temperatura (P-T)</summary>
      {!fluido ? (
        <p className="panel-hint" style={{ marginTop: 10 }}>
          Carica una bombola di fluido frigorigeno per vedere qui la sua tabella di saturazione.
        </p>
      ) : (
        <>
          <p className="panel-hint" style={{ marginTop: 10 }}>
            Fluido caricato: <strong>{REFRIGERANTS[fluido].label}</strong> ({REFRIGERANTS[fluido].note}).
            Pressioni di saturazione in bar assoluti, passo 5°C — per temperature intermedie interpola
            linearmente tra i due valori più vicini.
          </p>
          <div className="pt-table-scroll">
            <table className="pt-table">
              <thead>
                <tr>
                  <th>Temperatura (°C)</th>
                  <th>Pressione ({REFRIGERANTS[fluido].label}) — bar assoluti</th>
                </tr>
              </thead>
              <tbody>
                {temps.map((t) => (
                  <tr key={t}>
                    <td>{t}</td>
                    <td>{REFRIGERANTS[fluido].saturazioneBarAssoluti[t].toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="panel-hint panel-hint-muted" style={{ marginTop: 8 }}>
            Fonte: CoolProp 7.2.0, cross-check ASHRAE Handbook / scheda tecnica produttore.
          </p>
        </>
      )}
    </details>
  );
}
