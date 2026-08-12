// Scenari per l'esercizio "valvola di servizio" (vanne de service HP/BP
// all'uscita dell'unità esterna). Le due valvole (tappo rosso su HP, tappo
// blu su BP) si manovrano nello stesso modo e, per vuoto/pump-down, insieme:
// per questo l'esercizio le tratta come un'unica manovra.

export type ValvePosition = 'avanti' | 'intermedia' | 'indietro';

export const VALVE_POSITION_LABEL: Record<ValvePosition, string> = {
  avanti: 'Chiusa in avanti (front-seated)',
  intermedia: 'Posizione intermedia (cracked)',
  indietro: 'Chiusa all’indietro (back-seated)',
};

export interface ValveScenario {
  id: string;
  situazione: string;
  posizioneCorretta: ValvePosition;
  spiegazioni: Record<ValvePosition, string>;
}

export const VALVE_SCENARIOS: ValveScenario[] = [
  {
    id: 'vuoto',
    situazione:
      'Impianto nuovo appena installato: hai collegato le tubazioni verso l’unità interna e devi fare il vuoto (tirage au vide) prima di aprire il gas di precarica verso l’impianto.',
    posizioneCorretta: 'avanti',
    spiegazioni: {
      avanti:
        'Corretto: chiuse in avanti (front-seated), le valvole isolano il gas di precarica dentro l’unità esterna. La pompa del vuoto lavora solo su tubazioni e unità interna attraverso le prese di servizio, senza toccare la carica.',
      intermedia:
        'Sbagliato: in posizione intermedia la presa di servizio comunica anche con il circuito già carico di gas. La pompa del vuoto aspirerebbe pure il gas di precarica, mescolandolo con l’aria e disperdendo refrigerante in atmosfera invece di fare un vuoto pulito.',
      indietro:
        'Sbagliato: tutta indietro (back-seated) la presa di servizio è isolata dal circuito. La pompa del vuoto non avrebbe nessun collegamento utile: non riusciresti a fare il vuoto su tubazioni e unità interna.',
    },
  },
  {
    id: 'lettura',
    situazione:
      'Impianto in funzionamento normale: vuoi collegare il manometro e poter leggere la pressione in qualsiasi momento, senza fermare l’impianto.',
    posizioneCorretta: 'intermedia',
    spiegazioni: {
      avanti:
        'Sbagliato: chiuse in avanti le valvole isolano completamente il circuito dalle prese di servizio. Il manometro leggerebbe solo la pressione residua intrappolata nel raccordo, non quella reale dell’impianto in funzione.',
      intermedia:
        'Corretto: in posizione intermedia (cracked) sia il passaggio principale che la presa di servizio restano aperti. Il manometro legge la pressione reale mentre l’impianto continua a funzionare normalmente.',
      indietro:
        'Sbagliato: tutta indietro (back-seated) la presa di servizio è chiusa verso il circuito. Il manometro non leggerebbe nessuna pressione utile, anche con l’impianto in funzione.',
    },
  },
  {
    id: 'scollega',
    situazione:
      'Hai finito di misurare la pressione con il manometro e vuoi scollegare i flessibili senza far uscire gas dall’impianto.',
    posizioneCorretta: 'indietro',
    spiegazioni: {
      avanti:
        'Sbagliato: le valvole chiuse in avanti bloccano il funzionamento normale dell’impianto. Non è la posizione di esercizio/stoccaggio: lasceresti il circuito isolato e non operativo dopo aver scollegato i flessibili.',
      intermedia:
        'Sbagliato: in posizione intermedia la presa di servizio comunica ancora con il circuito in pressione. Scollegando i flessibili senza prima chiudere la presa, il gas sfiaterebbe in atmosfera dall’attacco appena aperto.',
      indietro:
        'Corretto: tutta indietro (back-seated), la presa di servizio è isolata dal circuito mentre il passaggio principale resta a piena apertura. Puoi scollegare i flessibili in sicurezza, senza perdita di refrigerante dall’impianto.',
    },
  },
  {
    id: 'pompaggio',
    situazione:
      'Devi eseguire un pump-down: far confluire tutto il refrigerante nell’unità esterna prima di scollegare le tubazioni per manutenzione.',
    posizioneCorretta: 'avanti',
    spiegazioni: {
      avanti:
        'Corretto: chiudendo le valvole in avanti mentre il compressore gira, il refrigerante viene richiamato e resta imprigionato nell’unità esterna, isolata dalle tubazioni verso l’interno.',
      intermedia:
        'Sbagliato: in posizione intermedia il passaggio principale resta aperto. Il refrigerante continuerebbe a circolare liberamente verso le tubazioni invece di concentrarsi nell’unità esterna.',
      indietro:
        'Sbagliato: tutta indietro il passaggio principale è comunque a piena apertura. Il pump-down non isolerebbe nulla: il refrigerante resterebbe distribuito in tutto il circuito.',
    },
  },
];

export function randomValveScenarioIndex(excludeIndex?: number): number {
  if (VALVE_SCENARIOS.length <= 1) return 0;
  let idx = Math.floor(Math.random() * VALVE_SCENARIOS.length);
  while (idx === excludeIndex) idx = Math.floor(Math.random() * VALVE_SCENARIOS.length);
  return idx;
}
