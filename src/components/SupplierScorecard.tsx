import { useMemo, useState } from 'react';

import { Trophy, Award, Medal, ChevronLeft, ChevronRight, List } from 'lucide-react';

// ... (rest of imports)

// Skipping unchanged lines ...



interface Incident {
    numero: string;
    stato?: string;
    regione?: string;
    fornitore?: string;
    data_apertura?: string;
    data_chiusura?: string;
    in_sla?: string;
    durata?: string | number;
    parti_richieste?: string;
    richiesta_apparato?: boolean;
    [key: string]: any;
}

const SupplierScorecard = ({ data }: { data: Incident[] }) => {
    // 1. Month Selector
    const [selectedDate, setSelectedDate] = useState(new Date());

    const adjustMonth = (delta: number) => {
        const d = new Date(selectedDate);
        d.setMonth(d.getMonth() + delta);
        setSelectedDate(d);
    };

    const getMonthName = (date: Date) => {
        return date.toLocaleString('it-IT', { month: 'long', year: 'numeric' }).replace(/^\w/, c => c.toUpperCase());
    };

    const formatPercentage = (value: number) => {
        if (value === 0 || value === 100) return value.toFixed(0);
        return value.toFixed(1);
    };

    // 2. Data Processing
    const scorecardData = useMemo(() => {
        const month = selectedDate.getMonth();
        const year = selectedDate.getFullYear();

        const stats: Record<string, {
            name: string;
            volume: number;
            closed: number;
            breaches: number;
            parts: number;
            devices: number;
            totalDuration: number;
            durationCount: number;
            penalties: number;
        }> = {};

        // Filter by Opened (for Volume/Resources) or Closed (for SLA/Duration) in Month
        // We accumulate everything related to the supplier activity in this month.
        // Option A: Use Opened for Volume/Resources, Closed for SLA.

        // Loop all data once for efficiency?
        // Or separate passes? Separate passes is cleaner logic.

        // Pass 1: Volume & Resources (Based on Opening Date in Month)
        data.forEach(i => {
            if (!i.data_apertura) return;
            const d = new Date(i.data_apertura);
            if (isNaN(d.getTime()) || d.getMonth() !== month || d.getFullYear() !== year) return;

            const supplier = i.fornitore || 'N/A';
            if (!stats[supplier]) stats[supplier] = { name: supplier, volume: 0, closed: 0, breaches: 0, parts: 0, devices: 0, totalDuration: 0, durationCount: 0, penalties: 0 };

            stats[supplier].volume++;

            // Resources: Count if requested
            if (i.parti_richieste) stats[supplier].parts++;
            if (i.richiesta_apparato) stats[supplier].devices++;
        });

        // Pass 2: SLA & Duration (Based on Closing Date in Month)
        data.forEach(i => {
            if (!i.data_chiusura) return;
            const d = new Date(i.data_chiusura);
            if (isNaN(d.getTime()) || d.getMonth() !== month || d.getFullYear() !== year) return;

            const supplier = i.fornitore || 'N/A';
            // Ensure entry exists (it might have 0 volume if no new tickets opened, but closed old ones)
            if (!stats[supplier]) stats[supplier] = { name: supplier, volume: 0, closed: 0, breaches: 0, parts: 0, devices: 0, totalDuration: 0, durationCount: 0, penalties: 0 };

            stats[supplier].closed++;

            const isBreach = (i.in_sla || '').trim().toUpperCase() === 'NO';
            if (isBreach) stats[supplier].breaches++;

            const dur = Number(i.durata);
            if (!isNaN(dur)) {
                stats[supplier].totalDuration += dur;
                stats[supplier].durationCount++;

                // Penalty Logic: Breach AND Duration > 44h (2640 mins)
                if (isBreach && dur > 2640) {
                    stats[supplier].penalties++;
                }
            }
        });

        // Calculate Metrics & Score
        // Score Weight: 60% SLA, 30% Volume (Normalized), 10% Penalties (Inverse)
        const processed = Object.values(stats).map(s => {
            const slaCompliance = s.closed > 0 ? ((s.closed - s.breaches) / s.closed * 100) : 100;

            // Penalty Score: 100% means NO penalties. 0% means ALL closed tickets were penalties.
            // Formula: 100 - (Penalties / Closed * 100)
            const penaltyRate = s.closed > 0 ? (s.penalties / s.closed * 100) : 0;
            const penaltyScore = 100 - penaltyRate;

            const avgDuration = s.durationCount > 0 ? (s.totalDuration / s.durationCount) : 0;
            const avgDays = avgDuration / 1440; // minutes to days

            return {
                ...s,
                slaCompliance,
                penaltyRate,
                penaltyScore,
                avgDays
            };
        });

        // Normalize Volume for Score
        const maxVolume = Math.max(...processed.map(s => s.volume), 1); // Avoid div by 0

        const scored = processed.map(s => {
            const volScore = (s.volume / maxVolume) * 100;

            // New Formula: 60% SLA, 30% Volume, 10% Penalty Score
            const score = (s.slaCompliance * 0.6) + (volScore * 0.3) + (s.penaltyScore * 0.1);

            return { ...s, score, volScore };
        });

        return [...scored].sort((a, b) => (b.score || 0) - (a.score || 0)); // Rank by Score
    }, [data, selectedDate]);

    // Top 3 for Podium
    const top3 = scorecardData.slice(0, 3);

    // Matrix Data (Bubble Chart) - Disabled/Hidden for now
    /*
    const matrixData = scorecardData.map(s => ({
        x: s.volume,
        y: Number(formatPercentage(s.slaCompliance)), // Rounded for chart
        z: s.closed, // Bubble size
        name: s.name,
        score: s.score
    }));
    */

    // Resource Data (Stacked Bar? or simple Bar for Top 5 Resource Users) - Disabled/Hidden for now
    /*
    const resourceData = [...scorecardData]
        .sort((a, b) => (b.parts + b.devices) - (a.parts + a.devices))
        .slice(0, 10)
        .map(s => ({
            name: s.name.length > 15 ? s.name.slice(0, 12) + '...' : s.name,
            full: s.name,
            parts: s.parts,
            devices: s.devices
        }));
    */

    return (
        <div className="space-y-6 animate-in fade-in duration-500 pb-20">
            {/* Header / Month Selector */}
            <div className="flex justify-between items-center mb-4">
                <div className="flex items-center gap-4 bg-slate-800/50 p-1.5 rounded-lg border border-white/5 shadow-lg">
                    <button onClick={() => adjustMonth(-1)} className="p-1 hover:bg-white/10 rounded-full transition-colors text-slate-400 hover:text-white">
                        <ChevronLeft size={16} />
                    </button>
                    <span className="text-white font-bold min-w-[140px] text-center uppercase tracking-wider text-xs">
                        {getMonthName(selectedDate)}
                    </span>
                    <button onClick={() => adjustMonth(1)} disabled={selectedDate > new Date()} className="p-1 hover:bg-white/10 rounded-full transition-colors text-slate-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed">
                        <ChevronRight size={16} />
                    </button>
                </div>
                <div className="text-right">
                    <h2 className="text-lg font-bold text-white flex items-center gap-2 justify-end">
                        <Award className="text-amber-400" /> Supplier Scorecard
                    </h2>
                    <p className="text-slate-400 text-xs text-right">
                        Ranking: SLA (60%) + Volume (30%) + Penalties (10%)
                        <span className="block text-[10px] text-slate-500 opacity-70">* Penalties = Violazioni &gt; 44h</span>
                    </p>
                </div>
            </div>

            {/* Row 1: Podium */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8 items-end">
                {/* 2nd Place */}
                {top3[1] && (
                    <div className="glass-card p-6 flex flex-col items-center justify-end h-[240px] relative border-t-4 border-t-slate-400 order-2 md:order-1 bg-gradient-to-b from-slate-800/80 to-slate-900/40 backdrop-blur-md">
                        <div className="absolute -top-5 bg-slate-800 p-3 rounded-full border border-slate-600 shadow-xl shadow-slate-900/50">
                            <span className="text-2xl font-bold text-slate-300">#2</span>
                        </div>
                        <h3 className="text-lg font-bold text-white text-center mb-1 drop-shadow-md">{top3[1].name}</h3>
                        <div className="flex items-center gap-2 mb-3">
                            <span className="text-xs text-slate-400 font-mono bg-slate-800/50 px-2 py-0.5 rounded border border-white/5">Score: {top3[1].score.toFixed(1)}</span>
                        </div>
                        <div className="grid grid-cols-3 gap-2 w-full text-center border-t border-white/10 pt-3 mt-auto">
                            <div className="flex flex-col">
                                <span className="text-[9px] text-slate-500 uppercase tracking-widest mb-1">SLA</span>
                                <span className={`font-bold ${top3[1].slaCompliance >= 90 ? 'text-emerald-400' : 'text-yellow-400'} drop-shadow-sm`}>
                                    {formatPercentage(top3[1].slaCompliance)}%
                                </span>
                            </div>
                            <div className="flex flex-col border-l border-white/5 border-r">
                                <span className="text-[9px] text-slate-500 uppercase tracking-widest mb-1">Vol</span>
                                <span className="font-bold text-blue-400 drop-shadow-sm">{top3[1].volume}</span>
                            </div>
                            <div className="flex flex-col">
                                <span className="text-[9px] text-red-400/70 uppercase tracking-widest mb-1">Penal</span>
                                <span className="font-bold text-red-500 drop-shadow-sm">{top3[1].penalties}</span>
                            </div>
                        </div>
                    </div>
                )}

                {/* 1st Place */}
                {top3[0] && (
                    <div className="glass-card p-6 flex flex-col items-center justify-end h-[280px] relative border-t-4 border-t-amber-400 order-1 md:order-2 bg-gradient-to-b from-amber-900/20 to-slate-900/40 backdrop-blur-md shadow-[0_0_40px_rgba(251,191,36,0.15)] ring-1 ring-amber-500/20">
                        <div className="absolute -top-6 bg-gradient-to-br from-amber-400 to-amber-600 p-3 rounded-full border border-amber-300 shadow-xl shadow-amber-900/50">
                            <Trophy className="text-white w-7 h-7" />
                        </div>
                        <div className="absolute top-3 right-3 animate-pulse">
                            <Medal className="text-amber-400 w-6 h-6 opacity-30" />
                        </div>
                        <h3 className="text-2xl font-bold text-white text-center mb-1 drop-shadow-lg">{top3[0].name}</h3>
                        <div className="flex items-center gap-2 mb-5">
                            <span className="text-sm text-amber-200 font-bold font-mono bg-amber-500/10 px-3 py-1 rounded-full border border-amber-500/30 shadow-[0_0_10px_rgba(251,191,36,0.2)]">
                                Score: {top3[0].score.toFixed(1)}
                            </span>
                        </div>
                        <div className="grid grid-cols-3 gap-2 w-full text-center border-t border-amber-500/20 pt-4 mt-auto">
                            <div className="flex flex-col">
                                <span className="text-[10px] text-amber-500/70 uppercase tracking-widest mb-1">SLA</span>
                                <span className={`text-xl font-bold ${top3[0].slaCompliance >= 90 ? 'text-emerald-400' : 'text-yellow-400'} drop-shadow-sm`}>
                                    {formatPercentage(top3[0].slaCompliance)}%
                                </span>
                            </div>
                            <div className="flex flex-col border-l border-amber-500/20 border-r">
                                <span className="text-[10px] text-amber-500/70 uppercase tracking-widest mb-1">Volume</span>
                                <span className="text-xl font-bold text-blue-400 drop-shadow-sm">{top3[0].volume}</span>
                            </div>
                            <div className="flex flex-col">
                                <span className="text-[10px] text-red-500/70 uppercase tracking-widest mb-1">Penal</span>
                                <span className="text-xl font-bold text-red-500 drop-shadow-sm">{top3[0].penalties}</span>
                            </div>
                        </div>
                    </div>
                )}

                {/* 3rd Place */}
                {top3[2] && (
                    <div className="glass-card p-6 flex flex-col items-center justify-end h-[220px] relative border-t-4 border-t-orange-700 order-3 md:order-3 bg-gradient-to-b from-slate-800/80 to-slate-900/40 backdrop-blur-md">
                        <div className="absolute -top-5 bg-slate-800 p-3 rounded-full border border-orange-800 shadow-xl shadow-slate-900/50">
                            <span className="text-2xl font-bold text-orange-700">#3</span>
                        </div>
                        <h3 className="text-lg font-bold text-white text-center mb-1 drop-shadow-md">{top3[2].name}</h3>
                        <div className="flex items-center gap-2 mb-3">
                            <span className="text-xs text-slate-400 font-mono bg-slate-800/50 px-2 py-0.5 rounded border border-white/5">Score: {top3[2].score.toFixed(1)}</span>
                        </div>
                        <div className="grid grid-cols-3 gap-2 w-full text-center border-t border-white/10 pt-3 mt-auto">
                            <div className="flex flex-col">
                                <span className="text-[9px] text-slate-500 uppercase tracking-widest mb-1">SLA</span>
                                <span className={`font-bold ${top3[2].slaCompliance >= 90 ? 'text-emerald-400' : 'text-yellow-400'} drop-shadow-sm`}>
                                    {formatPercentage(top3[2].slaCompliance)}%
                                </span>
                            </div>
                            <div className="flex flex-col border-l border-white/5 border-r">
                                <span className="text-[9px] text-slate-500 uppercase tracking-widest mb-1">Vol</span>
                                <span className="font-bold text-blue-400 drop-shadow-md">{top3[2].volume}</span>
                            </div>
                            <div className="flex flex-col">
                                <span className="text-[9px] text-red-400/70 uppercase tracking-widest mb-1">Penal</span>
                                <span className="font-bold text-red-500 drop-shadow-md">{top3[2].penalties}</span>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Row 2: Charts (Matrix & Resources) - HIDDEN BY USER REQUEST */}
            {/*
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                ... Charts Removed Temporarily ...
            </div>
            */}

            {/* Detailed Table */}
            <div className="glass-card overflow-hidden">
                <div className="p-4 border-b border-white/5 flex justify-between items-center bg-slate-900/50">
                    <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                        <List size={16} className="text-slate-400" /> Dettaglio Fornitori
                    </h3>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="text-[10px] text-slate-500 border-b border-slate-700 bg-slate-900/60 font-semibold uppercase tracking-wider">
                                <th className="px-4 py-3">Fornitore</th>
                                <th className="px-4 py-3 text-center">Score</th>
                                <th className="px-4 py-3 text-right">Volume</th>
                                <th className="px-4 py-3 text-right">Chiusi</th>
                                <th className="px-4 py-3 text-right text-red-500">Violazioni</th>
                                <th className="px-4 py-3 text-right text-red-700 font-bold border-l border-white/5">Penalties (&gt;44h)</th>
                                <th className="px-4 py-3 text-right border-r border-white/5">Penal %</th>
                                <th className="px-4 py-3 text-right">SLA %</th>
                                <th className="px-4 py-3 text-right text-cyan-400">Parti</th>
                                <th className="px-4 py-3 text-right text-pink-400">Device</th>
                                <th className="px-4 py-3 text-right">Avg Durata (min)</th>
                            </tr>
                        </thead>
                        <tbody className="text-xs text-slate-300 divide-y divide-white/5">
                            {scorecardData.map((s, idx) => (
                                <tr key={s.name} className="hover:bg-white/5 transition-colors">
                                    <td className="px-4 py-3 font-medium text-white flex items-center gap-2">
                                        {idx < 3 && <Trophy size={12} className={idx === 0 ? 'text-amber-400' : (idx === 1 ? 'text-slate-400' : 'text-orange-700')} />}
                                        {s.name}
                                    </td>
                                    <td className="px-4 py-3 text-center font-mono opacity-70">{s.score.toFixed(1)}</td>
                                    <td className="px-4 py-3 text-right font-bold">{s.volume}</td>
                                    <td className="px-4 py-3 text-right">{s.closed}</td>
                                    <td className="px-4 py-3 text-right text-red-400">{s.breaches}</td>

                                    <td className="px-4 py-3 text-right text-red-500 font-bold border-l border-white/5 bg-red-500/5">
                                        {s.penalties}
                                    </td>
                                    <td className="px-4 py-3 text-right border-r border-white/5 bg-red-500/5 text-slate-400 text-[10px]">
                                        {s.penaltyRate.toFixed(1)}%
                                    </td>

                                    <td className="px-4 py-3 text-right">
                                        <span className={`font-bold ${s.slaCompliance >= 90 ? 'text-emerald-400' : (s.slaCompliance >= 80 ? 'text-yellow-400' : 'text-red-400')}`}>
                                            {formatPercentage(s.slaCompliance)}%
                                        </span>
                                    </td>
                                    <td className="px-4 py-3 text-right text-cyan-300">{s.parts}</td>
                                    <td className="px-4 py-3 text-right text-pink-300">{s.devices}</td>
                                    <td className="px-4 py-3 text-right text-slate-400">
                                        {s.durationCount > 0 ? Math.round(s.totalDuration / s.durationCount) : 0} min
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default SupplierScorecard;
