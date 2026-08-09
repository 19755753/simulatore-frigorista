# Banco di montaggio virtuale — circuito frigorifero

Strumento didattico interattivo per il percorso CAP IFCA / TP frigorista: costruisci
un circuito frigorifero trascinando componenti realistici nella posizione corretta,
scegli diametri tubo e fluido frigorigeno, e ricevi un feedback immediato su errori
di montaggio (sequenza sbagliata, diametro incoerente, ecc.).

Non è un tool di progettazione professionale: è un simulatore didattico per capire
la logica di montaggio e leggere manometri/pressioni reali.

## Funzionalità

- Sequenza di montaggio guidata: Compressore → Condensatore → Filtro deidratatore →
  Voyant liquide → Détendeur → Evaporatore, con drag & drop nativo o selezione a
  click, e rifiuto del drop con spiegazione quando un componente va nella posizione
  sbagliata.
- Tre tipi di impianto (Climatizzatore, Frigo/vetrina bar, Cella commerciale) che
  filtrano cassetta attrezzi, fluidi disponibili e taglia compressore.
- Diametri tubo selezionabili (HP/BP) con guida didattica semplificata per potenza
  impianto, dichiarata esplicitamente come non ingegneristica.
- Manometri HP/BP animati con pressioni di saturazione reali (R32, R410A, R404A),
  calcolate da tabelle verificate (CoolProp 7.2.0, cross-check ASHRAE/produttore)
  con interpolazione lineare passo 5°C.
- Animazione del flusso del fluido lungo il circuito, che si blocca esattamente al
  primo punto mancante o errato.

## Sviluppo

```bash
npm install
npm run dev      # dev server
npm run build    # build di produzione (type-check + bundle)
```
