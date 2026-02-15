import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import * as XLSX from 'xlsx';
import { X, Download, CalendarPlus, Edit3, List } from 'lucide-react';

// Replicating needed types from App.tsx or importing them if I could, but for now I'll redefine Incident interface relative to display needs
// Ideally checking strict types, but for a component file, loose typing on Incident is acceptable or we export Incident from a central types file.
// Since App.tsx has Incident inline, I will define a compatible interface here.

interface Incident {
    numero: string;
    breve_descrizione?: string;
    descrizione?: string;
    stato?: string;
    data_apertura?: string;
    regione?: string;
    violazione_avvenuta?: boolean;
    in_sla?: string;
    fornitore?: string;
    item?: string;
    category?: string;
    modello?: string;
    ora_violazione?: string; // Date string or Date object
    pianificazione?: string;
    note_laser?: string;
    parti_richieste?: string;
    hw_model?: string;
    [key: string]: any;
}

interface InsightListModalProps {
    data: Incident[];
    title: string;
    subtitle?: string; // e.g., "15 Incidenti"
    icon?: React.ElementType;
    colorTheme?: 'danger' | 'warning' | 'info' | 'blue' | 'emerald';
    ruleId?: string | null; // NEW PROP
    onClose: () => void;
    onSelectIncident: (incident: Incident) => void;
}

const cn = (...classes: (string | undefined | null | false)[]) => classes.filter(Boolean).join(' ');

// ... existing code ...

// Helper for date formatting
const formatDate = (d: string | Date | undefined) => {
    if (!d) return '-';
    const date = new Date(d);
    return isNaN(date.getTime()) ? '-' : date.toLocaleDateString('it-IT');
};

const InsightListModal: React.FC<InsightListModalProps> = ({
    data,
    title,
    subtitle,
    icon: Icon = List,
    colorTheme = 'blue',
    ruleId, // Destructure new prop
    onClose,
    onSelectIncident
}) => {
    const [hoveredIncident, setHoveredIncident] = useState<{ id: string, data: Incident, rect: DOMRect, type: 'main' | 'parts' | 'device' } | null>(null);

    // Color mapping
    const themeColor = {
        danger: { bg: 'bg-red-500/20', text: 'text-red-400', border: 'border-red-500/30' },
        warning: { bg: 'bg-amber-500/20', text: 'text-amber-400', border: 'border-amber-500/30' },
        info: { bg: 'bg-blue-500/20', text: 'text-blue-400', border: 'border-blue-500/30' },
        blue: { bg: 'bg-blue-500/20', text: 'text-blue-400', border: 'border-blue-500/30' },
        emerald: { bg: 'bg-emerald-500/20', text: 'text-emerald-400', border: 'border-emerald-500/30' },
    }[colorTheme];

    return createPortal(
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-slate-900 border border-slate-700 rounded-xl shadow-2xl w-full max-w-6xl max-h-[85vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200" onClick={() => setHoveredIncident(null)}>

                {/* Tooltip Portal */}
                {hoveredIncident && createPortal(
                    <div
                        style={{
                            position: 'fixed',
                            top: Math.min(window.innerHeight - 200, Math.max(10, hoveredIncident.rect.top)),
                            left: Math.min(window.innerWidth - 320, hoveredIncident.rect.right + 10),
                            zIndex: 9999,
                            width: '320px',
                            pointerEvents: 'none'
                        }}
                        className="animate-in fade-in zoom-in-95 duration-200 shadow-[0_0_50px_rgba(0,0,0,0.6)] rounded-xl overflow-hidden border border-white/10 ring-1 ring-black/80 bg-slate-900"
                    >
                        {/* MAIN TOOLTIP */}
                        {hoveredIncident.type === 'main' && (
                            <>
                                <div className="bg-slate-900/95 p-4 border-b border-slate-700/50">
                                    <p className="text-[10px] text-slate-500 uppercase font-bold mb-1 flex justify-between">
                                        <span>Descrizione</span>
                                        <span className="text-blue-400">{hoveredIncident.data.numero}</span>
                                    </p>
                                    <div className="text-xs text-slate-200 leading-relaxed whitespace-normal">
                                        {hoveredIncident.data.descrizione || hoveredIncident.data.breve_descrizione || 'Nessuna descrizione.'}
                                    </div>
                                </div>
                                <div className="p-4 bg-[#0f172a]/95">
                                    <p className="text-[10px] text-blue-400 uppercase font-bold mb-2 flex items-center gap-2">
                                        <Edit3 size={12} /> Note Recenti
                                    </p>
                                    <div className="text-[11px] text-slate-300 font-mono whitespace-pre-wrap leading-relaxed max-h-[300px] overflow-y-auto custom-scrollbar p-2 bg-slate-900/50 rounded border border-white/5">
                                        {hoveredIncident.data.note_laser || 'Nessuna nota.'}
                                    </div>
                                </div>
                            </>
                        )}
                    </div>,
                    document.body
                )}

                {/* Header */}
                <div className="p-4 border-b border-white/10 flex justify-between items-center bg-slate-800/50">
                    <div className="flex items-center gap-3">
                        <div className={cn("p-2 rounded-lg", themeColor.bg, themeColor.text)}>
                            <Icon size={20} />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-white">{title}</h2>
                            <p className={cn("text-sm font-semibold", themeColor.text)}>
                                {subtitle || `${data.length} Incidenti`}
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => {
                                const ws = XLSX.utils.json_to_sheet(data);
                                const wb = XLSX.utils.book_new();
                                XLSX.utils.book_append_sheet(wb, ws, "Insight_Data");
                                XLSX.writeFile(wb, `List_${title.replace(/ /g, '_')}_${new Date().toISOString().slice(0, 10)}.xlsx`);
                            }}
                            className="p-2 hover:bg-emerald-500/20 rounded-lg text-emerald-400 hover:text-emerald-300 transition-colors"
                            title="Esporta Excel"
                        >
                            <Download size={20} />
                        </button>
                        <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-lg text-slate-400 hover:text-white transition-colors">
                            <X size={20} />
                        </button>
                    </div>
                </div>

                {/* Table */}
                <div className="flex-1 overflow-auto p-0 scrollbar-thin scrollbar-thumb-slate-700 scrollbar-track-transparent">
                    <table className="w-full text-left border-collapse">
                        <thead className="bg-slate-800/80 sticky top-0 z-10 backdrop-blur-md">
                            {ruleId === 'indirizzi_diversi' ? (
                                // Custom Header for Indirizzi Diversi
                                <tr>
                                    <th className="p-4 text-xs font-bold text-slate-400 uppercase tracking-wider">Numero</th>
                                    <th className="p-4 text-xs font-bold text-slate-400 uppercase tracking-wider">Regione</th>
                                    <th className="p-4 text-xs font-bold text-slate-400 uppercase tracking-wider">Indirizzo Intervento</th>
                                    <th className="p-4 text-xs font-bold text-slate-400 uppercase tracking-wider text-amber-500">Indirizzo Beneficiario</th>
                                    <th className="p-4 text-xs font-bold text-slate-400 uppercase tracking-wider">Stato</th>
                                </tr>
                            ) : (
                                // Default Header
                                <tr>
                                    <th className="p-4 text-xs font-bold text-slate-400 uppercase tracking-wider">Numero</th>
                                    <th className="p-4 text-xs font-bold text-slate-400 uppercase tracking-wider">Regione</th>
                                    <th className="p-4 text-xs font-bold text-slate-400 uppercase tracking-wider">Stato</th>
                                    <th className="p-4 text-xs font-bold text-slate-400 uppercase tracking-wider">Fornitore</th>
                                    <th className="p-4 text-xs font-bold text-slate-400 uppercase tracking-wider">Item / Modello</th>
                                    <th className="p-4 text-xs font-bold text-slate-400 uppercase tracking-wider">Ora Violazione</th>
                                    <th className="p-4 text-xs font-bold text-slate-400 uppercase tracking-wider">Pianificazione</th>
                                </tr>
                            )}
                        </thead>
                        <tbody className="divide-y divide-white/5">
                            {data.map(incident => (
                                <tr
                                    key={incident.numero}
                                    onClick={() => onSelectIncident(incident)}
                                    className="hover:bg-white/5 transition-colors cursor-pointer group"
                                >
                                    <td
                                        className="p-3 text-sm font-mono text-blue-400 font-bold group-hover:underline relative"
                                        onMouseEnter={(e) => {
                                            const rect = e.currentTarget.getBoundingClientRect();
                                            setHoveredIncident({ id: incident.numero, data: incident, rect, type: 'main' });
                                        }}
                                        onMouseLeave={() => setHoveredIncident(null)}
                                    >
                                        {incident.numero}
                                    </td>
                                    <td className="p-3 text-sm text-slate-300">{incident.regione || '-'}</td>

                                    {ruleId === 'indirizzi_diversi' ? (
                                        // Custom Body for Indirizzi Diversi
                                        <>
                                            <td className="p-3 text-sm text-slate-300 font-mono text-[11px] max-w-[200px]">
                                                {incident.indirizzo_intervento || '-'}
                                            </td>
                                            <td className="p-3 text-sm font-mono text-[11px] max-w-[200px] text-amber-300 bg-amber-500/5 border-l-2 border-amber-500/20">
                                                {incident.indirizzo_beneficiario || '-'}
                                            </td>
                                            <td className="p-3 text-sm text-slate-300">
                                                <span className={cn("px-2 py-0.5 rounded text-[10px] font-bold uppercase border border-white/5",
                                                    ['Aperto', 'Open'].includes(incident.stato || '') ? "bg-blue-500/10 text-blue-400 border-blue-500/20" : "bg-slate-700 text-slate-400"
                                                )}>{incident.stato || '-'}</span>
                                            </td>
                                        </>
                                    ) : (
                                        // Default Body
                                        <>
                                            <td className="p-3 text-sm text-slate-300">
                                                <div className="flex items-center gap-2">
                                                    <span className={cn("px-2 py-0.5 rounded text-[10px] font-bold uppercase border border-white/5",
                                                        ['Aperto', 'Open', 'In Corso', 'In Lavorazione'].includes(incident.stato || '') ? "bg-blue-500/10 text-blue-400 border-blue-500/20" :
                                                            ['Sospeso', 'Suspended'].includes(incident.stato || '') ? "bg-yellow-500/10 text-yellow-500 border-yellow-500/20" :
                                                                ['Chiuso', 'Closed', 'Resolved'].includes(incident.stato || '') ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20" :
                                                                    "bg-slate-700 text-slate-400"
                                                    )}>{incident.stato || '-'}</span>
                                                    {incident.gruppo_assegnazione === 'EUS_LOCKER_LASER_MICROINF_INC' && (
                                                        <span className="text-[9px] font-bold bg-purple-500/20 text-purple-400 px-1.5 py-0.5 rounded border border-purple-500/20">LCK</span>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="p-3 text-sm text-slate-300">
                                                {incident.fornitore ? (
                                                    <span className="text-[10px] bg-amber-500/10 text-amber-500 px-2 py-1 rounded border border-amber-500/20">{incident.fornitore}</span>
                                                ) : '-'}
                                            </td>
                                            <td className="p-3 text-sm text-slate-300">
                                                <div className="flex flex-col">
                                                    <span className="font-semibold text-xs">{incident.item || incident.category || '-'}</span>
                                                    <span className="text-[10px] text-slate-500">{incident.modello || '-'}</span>
                                                </div>
                                            </td>
                                            <td className="p-3 text-sm text-slate-300 font-mono">
                                                {incident.ora_violazione ? (
                                                    <span className="text-red-400">{new Date(incident.ora_violazione).toLocaleString('it-IT')}</span>
                                                ) : '-'}
                                            </td>
                                            <td className="p-3 text-sm text-slate-300">
                                                {incident.pianificazione ? (
                                                    <span className="flex items-center gap-1.5 text-emerald-400 font-mono text-xs">
                                                        <CalendarPlus size={12} /> {formatDate(incident.pianificazione)}
                                                    </span>
                                                ) : '-'}
                                            </td>
                                        </>
                                    )}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                {/* Footer status */}
                <div className="p-2 border-t border-white/5 bg-slate-900/80 text-[10px] text-slate-500 flex justify-between px-4">
                    <span>Totale: {data.length} righe</span>
                    <span>Doppio click per aprire dettaglio</span>
                </div>
            </div >
        </div >,
        document.body
    );
};

export default InsightListModal;
