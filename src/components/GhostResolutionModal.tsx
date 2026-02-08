import React, { useState } from 'react';
import { X, CheckCircle, AlertTriangle, ArrowRight } from 'lucide-react';
import { createPortal } from 'react-dom';

interface IncidentStub {
    numero: string;
    regione?: string;
    stato?: string;
    descrizione?: string;
    breve_descrizione?: string;
}

interface GhostResolutionModalProps {
    ghosts: IncidentStub[];
    onReassign: (id: string) => Promise<void>;
    onReassignAll: () => Promise<void>;
    onClose: () => void; // Continues import ignoring remaining ghosts
}

// Helper for status colors
const getStatusColor = (status: string) => {
    const s = (status || '').toLowerCase();
    if (s.includes('aperto') || s.includes('corso')) return 'text-blue-400 bg-blue-400/10';
    if (s.includes('sospeso')) return 'text-amber-400 bg-amber-400/10';
    return 'text-slate-400 bg-slate-400/10';
};

const GhostResolutionModal: React.FC<GhostResolutionModalProps> = ({ ghosts, onReassign, onReassignAll, onClose }) => {
    const [processing, setProcessing] = useState<Set<string>>(new Set());
    const [isBulkProcessing, setIsBulkProcessing] = useState(false);

    const handleSingle = async (id: string) => {
        setProcessing(prev => new Set(prev).add(id));
        await onReassign(id);
        setProcessing(prev => {
            const next = new Set(prev);
            next.delete(id);
            return next;
        });
    };

    const handleBulk = async () => {
        setIsBulkProcessing(true);
        await onReassignAll();
        setIsBulkProcessing(false);
    };

    return createPortal(
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <div className="bg-slate-900 border border-amber-500/30 rounded-2xl shadow-2xl w-full max-w-4xl max-h-[80vh] flex flex-col animate-in fade-in zoom-in duration-200">

                {/* Header */}
                <div className="p-6 border-b border-white/10 flex justify-between items-center bg-amber-500/5">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-amber-500/20 rounded-xl text-amber-500">
                            <AlertTriangle size={24} />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-white">Incidenti "Fantasma" Rilevati</h2>
                            <p className="text-sm text-slate-400">
                                Questi incidenti sono aperti nel DB ma <strong>mancano nel file di importazione</strong>.
                                Probabilmente sono stati riassegnati.
                            </p>
                        </div>
                    </div>
                    <button onClick={onClose} disabled={isBulkProcessing} className="p-2 hover:bg-white/10 rounded-lg text-slate-400 hover:text-white transition-colors">
                        <X size={24} />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
                    <div className="flex justify-between items-center mb-4">
                        <span className="text-sm font-semibold text-slate-300">
                            {ghosts.length} Incidenti da verificare
                        </span>
                        <button
                            onClick={handleBulk}
                            disabled={isBulkProcessing || ghosts.length === 0}
                            className="flex items-center gap-2 px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white font-semibold rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                        >
                            {isBulkProcessing ? 'Elaborazione...' : 'Riassegna Tutti a "Riassegnato"'}
                            <CheckCircle size={16} />
                        </button>
                    </div>

                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="text-xs font-bold text-slate-500 uppercase tracking-wider border-b border-white/10">
                                <th className="p-3">Numero</th>
                                <th className="p-3">Regione</th>
                                <th className="p-3">Stato Attuale</th>
                                <th className="p-3">Descrizione</th>
                                <th className="p-3 text-right">Azione</th>
                            </tr>
                        </thead>
                        <tbody className="text-sm divide-y divide-white/5">
                            {ghosts.map(i => (
                                <tr key={i.numero} className="hover:bg-white/5 transition-colors group">
                                    <td className="p-3 font-mono font-bold text-blue-300">{i.numero}</td>
                                    <td className="p-3 text-slate-300">{i.regione || '-'}</td>
                                    <td className="p-3">
                                        <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider ${getStatusColor(i.stato || '')}`}>
                                            {i.stato}
                                        </span>
                                    </td>
                                    <td className="p-3 text-slate-400 max-w-xs truncate" title={i.descrizione}>
                                        {i.descrizione || i.breve_descrizione || '-'}
                                    </td>
                                    <td className="p-3 text-right">
                                        <button
                                            onClick={() => handleSingle(i.numero)}
                                            disabled={processing.has(i.numero) || isBulkProcessing}
                                            className="text-amber-400 hover:text-amber-300 hover:bg-amber-500/10 px-3 py-1.5 rounded transition-all text-xs font-semibold flex items-center gap-2 ml-auto"
                                        >
                                            {processing.has(i.numero) ? '...' : (
                                                <>
                                                    Riassegna
                                                    <ArrowRight size={14} />
                                                </>
                                            )}
                                        </button>
                                    </td>
                                </tr>
                            ))}
                            {ghosts.length === 0 && (
                                <tr>
                                    <td colSpan={5} className="p-8 text-center text-slate-500 italic">
                                        Nessun incidente fantasma rimanente. Puoi chiudere la finestra e continuare.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Footer */}
                <div className="p-4 border-t border-white/10 bg-slate-800/50 flex justify-end gap-3">
                    <button
                        onClick={onClose}
                        disabled={isBulkProcessing}
                        className="px-4 py-2 hover:bg-white/5 text-slate-300 hover:text-white rounded-lg transition-colors text-sm font-medium"
                    >
                        {ghosts.length > 0 ? 'Ignora Rimanenti e Continua Import' : 'Chiudi e Continua Import'}
                    </button>
                </div>
            </div>
        </div>,
        document.body
    );
};

export default GhostResolutionModal;
