import React, { useMemo, useState } from 'react';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
    AreaChart, Area, ComposedChart, Line
} from 'recharts';
import { Activity, AlertTriangle, TrendingUp, Users, MapPin, CheckCircle, ChevronLeft, ChevronRight, TrendingDown, Minus } from 'lucide-react';

// Types
interface Incident {
    numero: string;
    stato?: string;
    regione?: string;
    violazione_avvenuta?: boolean;
    fornitore?: string;
    data_apertura?: string;
    data_chiusura?: string;
    in_sla?: string;
    servizio_hd?: string;
    durata?: string | number;
    [key: string]: any;
}

const ExecutiveDashboard = ({ data }: { data: Incident[] }) => {

    // 1. Default Current Month for Overview
    const [selectedDate, setSelectedDate] = useState(new Date());

    const adjustMonth = (delta: number) => {
        const d = new Date(selectedDate);
        d.setMonth(d.getMonth() + delta);
        setSelectedDate(d);
    };

    const getMonthName = (date: Date) => {
        return date.toLocaleString('it-IT', { month: 'long', year: 'numeric' }).replace(/^\w/, c => c.toUpperCase());
    };

    // Helper: Calculate Stats for a given Month
    const calculateStats = (targetDate: Date) => {
        const month = targetDate.getMonth();
        const year = targetDate.getFullYear();

        const closedInMonth = data.filter(i => {
            if (!i.data_chiusura) return false;
            const d = new Date(i.data_chiusura);
            return !isNaN(d.getTime()) && d.getMonth() === month && d.getFullYear() === year;
        });

        const openedInMonth = data.filter(i => {
            if (!i.data_apertura) return false;
            const d = new Date(i.data_apertura);
            return !isNaN(d.getTime()) && d.getMonth() === month && d.getFullYear() === year;
        });

        // SLA Logic
        // Filiali (TECNOFIL) - Complessivo
        const filialiTickets = closedInMonth.filter(i => (i.servizio_hd || '').trim().toUpperCase() === 'TECNOFIL' && ['SI', 'NO'].includes((i.in_sla || '').trim().toUpperCase()));
        const filialiMet = filialiTickets.filter(i => (i.in_sla || '').trim().toUpperCase() === 'SI').length;
        const filialiTotal = filialiTickets.length;
        const filialiSla = filialiTotal > 0 ? (filialiMet / filialiTotal * 100) : 100;

        // Presidi (TECNODIR) - Complessivo
        const presidiTickets = closedInMonth.filter(i => (i.servizio_hd || '').trim().toUpperCase() === 'TECNODIR' && ['SI', 'NO'].includes((i.in_sla || '').trim().toUpperCase()));
        const presidiMet = presidiTickets.filter(i => (i.in_sla || '').trim().toUpperCase() === 'SI').length;
        const presidiTotal = presidiTickets.length;
        const presidiSla = presidiTotal > 0 ? (presidiMet / presidiTotal * 100) : 100;

        // SLA Controllo Logic (Compliance < 44h)
        const filialiControlloTickets = closedInMonth.filter(i => (i.servizio_hd || '').trim().toUpperCase() === 'TECNOFIL');
        const filialiControlloViolations = filialiControlloTickets.filter(i => {
            const d = Number(i.durata);
            return !isNaN(d) && d > 2640;
        }).length;
        const filialiControlloTotal = filialiControlloTickets.length;
        const filialiControllo = filialiControlloTotal > 0 ? ((filialiControlloTotal - filialiControlloViolations) / filialiControlloTotal * 100) : 100;

        const presidiControlloTickets = closedInMonth.filter(i => (i.servizio_hd || '').trim().toUpperCase() === 'TECNODIR');
        const presidiControlloViolations = presidiControlloTickets.filter(i => {
            const d = Number(i.durata);
            return !isNaN(d) && d > 2640;
        }).length;
        const presidiControlloTotal = presidiControlloTickets.length;
        const presidiControllo = presidiControlloTotal > 0 ? ((presidiControlloTotal - presidiControlloViolations) / presidiControlloTotal * 100) : 100;

        // SLA Geografico Logic
        const regions = [...new Set(closedInMonth.map(i => i.regione || 'N/D'))];
        const calculateGeo = (service: string) => {
            if (regions.length === 0) return 100;
            let okCount = 0;
            regions.forEach(reg => {
                const subset = closedInMonth.filter(i => (i.regione || 'N/D') === reg && (i.servizio_hd || '').trim().toUpperCase() === service && ['SI', 'NO'].includes((i.in_sla || '').trim().toUpperCase()));
                const total = subset.length;
                if (total === 0) {
                    okCount++;
                } else {
                    const met = subset.filter(i => (i.in_sla || '').trim().toUpperCase() === 'SI').length;
                    if ((met / total * 100) >= 80) okCount++;
                }
            });
            return (okCount / regions.length) * 100;
        };

        const filialiGeo = calculateGeo('TECNOFIL');
        const presidiGeo = calculateGeo('TECNODIR');

        const slaBreaches = closedInMonth.filter(i => (i.in_sla || '').trim().toUpperCase() === 'NO').length;
        const slaControlloBreaches = filialiControlloViolations + presidiControlloViolations;

        return {
            opened: openedInMonth.length,
            closed: closedInMonth.length,
            filialiSla,
            presidiSla,
            filialiControllo,
            presidiControllo,
            filialiGeo,
            presidiGeo,
            slaBreaches,
            slaControlloBreaches,
            hasData: closedInMonth.length > 0
        };
    };

    const currentStats = useMemo(() => calculateStats(selectedDate), [data, selectedDate]);
    const prevDate = new Date(selectedDate);
    prevDate.setMonth(prevDate.getMonth() - 1);
    const prevStats = useMemo(() => calculateStats(prevDate), [data, prevDate]);


    // Trend Data (Daily for Selected Month)
    const trendData = useMemo(() => {
        const daysInMonth = new Date(selectedDate.getFullYear(), selectedDate.getMonth() + 1, 0).getDate();
        const stats = new Array(daysInMonth).fill(0).map((_, i) => ({
            day: i + 1,
            date: new Date(selectedDate.getFullYear(), selectedDate.getMonth(), i + 1).toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit' }),
            count: 0,
            opened: 0,
            closed: 0
        }));

        data.forEach(i => {
            // Opened
            if (i.data_apertura) {
                const d = new Date(i.data_apertura);
                if (!isNaN(d.getTime()) && d.getMonth() === selectedDate.getMonth() && d.getFullYear() === selectedDate.getFullYear()) {
                    stats[d.getDate() - 1].opened++;
                }
            }
            // Closed
            if (i.data_chiusura) {
                const d = new Date(i.data_chiusura);
                if (!isNaN(d.getTime()) && d.getMonth() === selectedDate.getMonth() && d.getFullYear() === selectedDate.getFullYear()) {
                    stats[d.getDate() - 1].closed++;
                }
            }
        });
        return stats;
    }, [data, selectedDate]);


    // Supplier Data (Top 5 by Volume in Month)
    const supplierData = useMemo(() => {
        const stats: Record<string, { opened: number, closed: number, breaches: number }> = {};

        // 1. Calculate OPENED (Volume) - Used for sorting and volume bar
        data.filter(i => {
            if (!i.data_apertura) return false;
            const d = new Date(i.data_apertura);
            return !isNaN(d.getTime()) && d.getMonth() === selectedDate.getMonth() && d.getFullYear() === selectedDate.getFullYear();
        }).forEach(i => {
            const s = i.fornitore || 'N/A';
            if (!stats[s]) stats[s] = { opened: 0, closed: 0, breaches: 0 };
            stats[s].opened++;
        });

        // 2. Calculate CLOSED & BREACHES (Performance) - Used for %
        data.filter(i => {
            if (!i.data_chiusura) return false;
            const d = new Date(i.data_chiusura);
            return !isNaN(d.getTime()) && d.getMonth() === selectedDate.getMonth() && d.getFullYear() === selectedDate.getFullYear();
        }).forEach(i => {
            const s = i.fornitore || 'N/A';
            if (!stats[s]) stats[s] = { opened: 0, closed: 0, breaches: 0 };
            stats[s].closed++;
            if ((i.in_sla || '').trim().toUpperCase() === 'NO') stats[s].breaches++;
        });

        return Object.entries(stats)
            .map(([name, s]) => ({
                name: name.length > 15 ? name.slice(0, 12) + '...' : name,
                full: name,
                volume: s.opened,
                violationPct: s.closed > 0 ? Number(((s.breaches / s.closed) * 100).toFixed(1)) : 0,
                closedTotal: s.closed
            }))
            .sort((a, b) => b.volume - a.volume)
            .slice(0, 5);
    }, [data, selectedDate]);

    // Region Data (SLA Breaches in Month)
    const regionData = useMemo(() => {
        const stats: Record<string, { total: number, breaches: number }> = {};
        // Use Closed in Month logic for SLA
        data.filter(i => {
            if (!i.data_chiusura) return false;
            const d = new Date(i.data_chiusura);
            return !isNaN(d.getTime()) && d.getMonth() === selectedDate.getMonth() && d.getFullYear() === selectedDate.getFullYear();
        }).forEach(i => {
            const region = i.regione || 'Unknown';
            if (!stats[region]) stats[region] = { total: 0, breaches: 0 };
            stats[region].total++;
            if ((i.in_sla || '').trim().toUpperCase() === 'NO') stats[region].breaches++;
        });

        return Object.entries(stats)
            .map(([name, s]) => ({
                name,
                breaches: s.breaches,
                total: s.total,
                compliance: s.total > 0 ? ((s.total - s.breaches) / s.total * 100) : 100
            }))
            .sort((a, b) => b.breaches - a.breaches)
            .slice(0, 5);
    }, [data, selectedDate]);

    const formatPercentage = (value: number) => {
        if (value === 0 || value === 100) return value.toFixed(0);
        return value.toFixed(1);
    };

    const renderDelta = (current: number, prev: number, suffix = '', inverse = false) => {
        const delta = current - prev;
        if (prev === 0) return <span className="text-slate-500 text-[10px] ml-2">-</span>;

        const isPositive = delta > 0;
        const isNeutral = delta === 0;
        const color = isNeutral ? 'text-slate-500' : (isPositive ? (inverse ? 'text-red-400' : 'text-emerald-400') : (inverse ? 'text-emerald-400' : 'text-red-400'));
        const Icon = isNeutral ? Minus : (isPositive ? TrendingUp : TrendingDown);

        return (
            <div className={`flex items-center gap-0.5 text-[10px] ${color} ml-1.5 font-mono font-bold opacity-80`}>
                <Icon size={10} strokeWidth={3} />
                <span>{Math.abs(delta).toFixed(0)}{suffix}</span>
            </div>
        );
    };

    // Helper for Split SLA Card with Target Label
    const renderSlaSplitCard = (title: string, filValue: number, presValue: number, filPrev: number, presPrev: number, target: number) => (
        <div className="glass-card p-0 relative overflow-hidden flex border-l-4 border-l-purple-500 min-h-[85px] group hover:bg-white/5 transition-colors">
            {/* Title Overlay with Target */}
            <div className="absolute top-1 left-2 z-10 flex items-center justify-between w-full pr-2">
                <p className="text-slate-400 text-[10px] font-bold uppercase tracking-wider flex items-center gap-1">
                    {title}
                </p>
                <span className="text-[9px] font-normal text-slate-500 bg-slate-800/80 px-1.5 py-0.5 rounded border border-white/5">Target {target}%</span>
            </div>

            {/* Filiali Section */}
            <div className="flex-1 p-2 pt-6 border-r border-white/5 relative flex flex-col justify-end">
                <h4 className="text-[10px] font-bold text-purple-300 uppercase mb-0.5 opacity-80">Filiali</h4>
                <div className="flex items-baseline">
                    <h3 className={`text-2xl font-bold ${filValue >= target ? 'text-emerald-400' : 'text-red-400'}`}>
                        {formatPercentage(filValue)}%
                    </h3>
                    {renderDelta(filValue, filPrev, '%')}
                </div>
            </div>

            {/* Presidi Section */}
            <div className="flex-1 p-2 pt-6 relative flex flex-col justify-end">
                <h4 className="text-[10px] font-bold text-indigo-300 uppercase mb-0.5 opacity-80">Presidi</h4>
                <div className="flex items-baseline">
                    <h3 className={`text-2xl font-bold ${presValue >= target ? 'text-emerald-400' : 'text-red-400'}`}>
                        {formatPercentage(presValue)}%
                    </h3>
                    {renderDelta(presValue, presPrev, '%')}
                </div>
            </div>
        </div>
    );

    return (
        <div className="space-y-4 animate-in fade-in duration-500 pb-20">
            {/* Header with Date Selector */}
            <div className="flex justify-between items-center mb-2">
                <div className="flex items-center gap-4 bg-slate-800/50 p-1.5 rounded-lg border border-white/5 shadow-lg">
                    <button onClick={() => adjustMonth(-1)} className="p-1 hover:bg-white/10 rounded-full transition-colors text-slate-400 hover:text-white">
                        <ChevronLeft size={16} />
                    </button>
                    <span className="text-white font-bold min-w-[120px] text-center uppercase tracking-wider text-xs">
                        {getMonthName(selectedDate)}
                    </span>
                    <button onClick={() => adjustMonth(1)} disabled={selectedDate > new Date()} className="p-1 hover:bg-white/10 rounded-full transition-colors text-slate-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed">
                        <ChevronRight size={16} />
                    </button>
                </div>
            </div>

            {/* Row 1: SLA Split Cards (3 columns) */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {renderSlaSplitCard("SLA Complessivo", currentStats.filialiSla, currentStats.presidiSla, prevStats.filialiSla, prevStats.presidiSla, 90)}
                {renderSlaSplitCard("SLA Controllo", currentStats.filialiControllo, currentStats.presidiControllo, prevStats.filialiControllo, prevStats.presidiControllo, 99)}
                {renderSlaSplitCard("SLA Geografico", currentStats.filialiGeo, currentStats.presidiGeo, prevStats.filialiGeo, prevStats.presidiGeo, 100)}
            </div>

            {/* Row 2: KPIs & Volume (4 columns) */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                {/* 1. Ticket Aperti (Month) */}
                <div className="glass-card p-3 relative overflow-hidden group hover:border-blue-500/30 transition-colors">
                    <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity"><Activity size={32} className="text-blue-400" /></div>
                    <p className="text-slate-400 text-[10px] font-bold uppercase tracking-wider">Aperti nel Mese</p>
                    <div className="flex items-baseline mt-1">
                        <h3 className="text-2xl font-bold text-white">{currentStats.opened}</h3>
                        {renderDelta(currentStats.opened, prevStats.opened)}
                    </div>
                </div>

                {/* 2. Ticket Chiusi (Month) */}
                <div className="glass-card p-3 relative overflow-hidden group hover:border-emerald-500/30 transition-colors">
                    <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity"><CheckCircle size={32} className="text-emerald-400" /></div>
                    <p className="text-slate-400 text-[10px] font-bold uppercase tracking-wider">Chiusi nel Mese</p>
                    <div className="flex items-baseline mt-1">
                        <h3 className="text-2xl font-bold text-emerald-400">{currentStats.closed}</h3>
                        {renderDelta(currentStats.closed, prevStats.closed)}
                    </div>
                </div>

                {/* 3. Violazioni Totali */}
                <div className="glass-card p-3 relative overflow-hidden group hover:border-red-500/30 transition-colors">
                    <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity"><AlertTriangle size={32} className="text-red-400" /></div>
                    <p className="text-slate-400 text-[10px] font-bold uppercase tracking-wider">Violazioni Totali</p>
                    <div className="flex items-baseline mt-1">
                        <h3 className="text-2xl font-bold text-red-400">{currentStats.slaBreaches}</h3>
                        {renderDelta(currentStats.slaBreaches, prevStats.slaBreaches, '', true)}
                    </div>
                </div>

                {/* 4. Violazioni SLA Controllo (NEW) */}
                <div className="glass-card p-3 relative overflow-hidden group hover:border-orange-500/30 transition-colors">
                    <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity"><AlertTriangle size={32} className="text-orange-400" /></div>
                    <p className="text-slate-400 text-[10px] font-bold uppercase tracking-wider">SLA Controllo &gt; 2640m</p>
                    <div className="flex items-baseline mt-1">
                        <h3 className="text-2xl font-bold text-orange-400">{currentStats.slaControlloBreaches}</h3>
                        {renderDelta(currentStats.slaControlloBreaches, prevStats.slaControlloBreaches, '', true)}
                    </div>
                </div>
            </div>

            {/* Charts Row 1 */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Trend Chart - Daily in Month (Open vs Closed) */}
                <div className="glass-card p-4 h-[350px] flex flex-col">
                    <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
                        <TrendingUp size={16} className="text-blue-400" />
                        Andamento Giornaliero: Aperti vs Chiusi
                    </h3>
                    <div style={{ width: '100%', height: 270 }}>
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={trendData}>
                                <defs>
                                    <linearGradient id="colorOpened" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#60a5fa" stopOpacity={0.8} />
                                        <stop offset="95%" stopColor="#60a5fa" stopOpacity={0} />
                                    </linearGradient>
                                    <linearGradient id="colorClosed" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.8} />
                                        <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.3} vertical={false} />
                                <XAxis dataKey="date" stroke="#64748b" fontSize={10} tickLine={false} axisLine={false} interval={2} />
                                <YAxis stroke="#64748b" fontSize={10} tickLine={false} axisLine={false} />
                                <Tooltip
                                    contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', color: '#f8fafc', fontSize: '12px' }}
                                />
                                <Area type="monotone" dataKey="opened" stroke="#60a5fa" fillOpacity={1} fill="url(#colorOpened)" name="Aperti" strokeWidth={2} />
                                <Area type="monotone" dataKey="closed" stroke="#10b981" fillOpacity={0.6} fill="url(#colorClosed)" name="Chiusi" strokeWidth={2} />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Top Suppliers (Volume + Violation %) */}
                <div className="glass-card p-4 h-[350px] flex flex-col">
                    <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
                        <Users size={16} className="text-amber-400" />
                        Top 5 Fornitori: Volume e % Violazioni
                    </h3>
                    <div style={{ width: '100%', height: 270 }}>
                        <ResponsiveContainer width="100%" height="100%">
                            <ComposedChart data={supplierData} layout="vertical" margin={{ left: 10, right: 20 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#334155" horizontal={false} opacity={0.3} />
                                <XAxis type="number" stroke="#64748b" fontSize={10} hide />
                                <YAxis dataKey="name" type="category" stroke="#94a3b8" fontSize={10} width={80} tickLine={false} axisLine={false} />
                                <Tooltip
                                    cursor={{ fill: '#334155', opacity: 0.2 }}
                                    contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', color: '#f8fafc', fontSize: '12px' }}
                                    formatter={(value: any, name: string) => {
                                        if (name === '% Violazioni' && typeof value === 'number') return [`${formatPercentage(value)}%`, name];
                                        return [value, name];
                                    }}
                                />
                                <Bar dataKey="volume" fill="#fbbf24" radius={[0, 4, 4, 0]} barSize={12} name="Volume (Aperti)" />
                                <XAxis type="number" orientation="top" xAxisId="pct" domain={[0, 100]} hide />
                                <Line dataKey="violationPct" stroke="#ef4444" strokeWidth={2} dot={{ r: 3, fill: '#ef4444' }} xAxisId="pct" type="monotone" name="% Violazioni" />
                            </ComposedChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>

            {/* Regional Criticality */}
            <div className="glass-card p-6">
                <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                    <MapPin size={20} className="text-red-400" />
                    Regioni con Più Violazioni SLA ({getMonthName(selectedDate)})
                </h3>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left text-slate-300">
                        <thead className="text-xs text-slate-500 uppercase bg-slate-900/50 border-b border-slate-700">
                            <tr>
                                <th className="px-4 py-3">Regione</th>
                                <th className="px-4 py-3 text-center">Violazioni</th>
                                <th className="px-4 py-3 text-center">Totale Chiusi</th>
                                <th className="px-4 py-3 text-right">SLA Compliance</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-700/30">
                            {regionData.map((r) => (
                                <tr key={r.name} className="hover:bg-white/5 transition-colors">
                                    <td className="px-4 py-3 font-medium text-white">{r.name}</td>
                                    <td className="px-4 py-3 text-center text-red-400 font-bold">{r.breaches}</td>
                                    <td className="px-4 py-3 text-center text-slate-400">{r.total}</td>
                                    <td className="px-4 py-3 text-right">
                                        <div className="flex items-center justify-end gap-2">
                                            <span className={`font-bold ${parseFloat(r.compliance as string) < 90 ? 'text-red-400' : 'text-emerald-400'}`}>
                                                {formatPercentage(Number(r.compliance))}%
                                            </span>
                                            <div className="w-16 h-1.5 bg-slate-700 rounded-full overflow-hidden">
                                                <div
                                                    className={`h-full rounded-full ${parseFloat(r.compliance as string) < 90 ? 'bg-red-500' : 'bg-emerald-500'}`}
                                                    style={{ width: `${r.compliance}%` }}
                                                />
                                            </div>
                                        </div>
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

export default ExecutiveDashboard;
