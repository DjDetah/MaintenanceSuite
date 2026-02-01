# Release Notes v0.8 - Insight System & UI Refinements

## 🚀 Nuove Funzionalità (Insight System)

### **1. Insight Panel Intelligente**
- Introduzione di un sistema di "Insight" dinamici per evidenziare criticità.
- **Regole Attive:**
  - 🚨 **Violazioni SLA Gravi**: >2 giorni di ritardo.
  - 🚨 **Backlog Critico**: >10 Ticket aperti.
  - ⚠️ **Lamentele Clienti**: Rilevamento keywords (e.g., "URGENTE", "SOLLECITO").
  - ⚠️ **Errori Cassa**: Rilevamento pattern regex per codici cassa non validi.
  - ⚠️ **Riassegnazioni Eccessive**: Ticket riassegnati >3 volte.

### **2. Dashboard (Backlog & KPI)**
- **Card Insight Compatte**: Nuovo design "single-line" per occupare meno spazio.
- **Modale Dettaglio**: Cliccando su un Insight, si apre una modale con la lista filtrata dei ticket coinvolti.
- **Export Excel**: Pulsante dedicato nella modale per scaricare il report completo degli insight.

### **3. Tabella Incidenti**
- **Integrazione Insight**: Pannello Insight aggiunto sopra la tabella.
- **Filtro Diretto**: In questa vista, cliccare un Insight **filtra la tabella** in tempo reale (senza aprire modali).
- **UI Compatta**: Stile unificato con la dashboard.

---

## 🛠️ Miglioramenti UI/UX
- **Restyling Card**: Ridotte dimensioni font e padding per una maggiore densità di informazioni.
- **Unified Filtering**:
  - I filtri di **Regione** e **Stato** ora agiscono correttamente anche sui dati Insight.
  - Risolto conflitto logico che faceva sparire le card Insight durante il filtraggio.
- **Performance**: Ottimizzazione del calcolo delle regole Insight (useMemo).

## 🐛 Bug Fix
- **Filtri Globali**: Corretta la propagazione del filtro Regione ai componenti secondari.
- **Layout**: Risolti problemi di allineamento nella modale su schermi piccoli.
