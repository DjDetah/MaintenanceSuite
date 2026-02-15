import React, { useState, useMemo, useEffect } from 'react';
import {
    XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
    Area, ComposedChart, Line
} from 'recharts';
import { Download, TrendingUp, TrendingDown, Minus, Activity, Layers, HelpCircle } from 'lucide-react';


type TimeScope = 'monthly' | 'quarterly' | 'semiannual' | 'annual';

interface TrendAnalysisPageProps {
    supabaseClient: any; // Pass client for future data fetching
}

const TrendAnalysisPage: React.FC<TrendAnalysisPageProps> = ({ supabaseClient }) => {
    const [timeScope, setTimeScope] = useState<TimeScope>('monthly');
    const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
    const [dbData, setDbData] = useState<any[]>([]);
    const [_, setLoading] = useState(true);

    // --- Fetch Real Data ---
    // --- Fetch Real Data ---
    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            try {
                let startDate = new Date();
                let endDate = new Date();
                const now = new Date();

                // Determine Date Range
                if (timeScope === 'monthly') {
                    startDate = new Date(selectedYear, now.getMonth(), 1);
                    endDate = new Date(selectedYear, now.getMonth() + 1, 0);
                } else if (timeScope === 'quarterly') {
                    const currentQuarter = Math.floor(now.getMonth() / 3);
                    startDate = new Date(selectedYear, currentQuarter * 3, 1);
                    endDate = new Date(selectedYear, (currentQuarter + 1) * 3, 0);
                } else if (timeScope === 'semiannual') {
                    const currentSemester = Math.floor(now.getMonth() / 6);
                    startDate = new Date(selectedYear, currentSemester * 6, 1);
                    endDate = new Date(selectedYear, (currentSemester + 1) * 6, 0);
                } else {
                    startDate = new Date(selectedYear, 0, 1);
                    endDate = new Date(selectedYear, 11, 31);
                }

                // Format Dates as YYYY-MM-DD
                const formatDate = (d: Date) => {
                    const y = d.getFullYear();
                    const m = String(d.getMonth() + 1).padStart(2, '0');
                    const day = String(d.getDate()).padStart(2, '0');
                    return `${y}-${m}-${day}`;
                };
                const startStr = formatDate(startDate);
                const endStr = formatDate(endDate);

                console.log(`[TrendAnalysis] Fetching for scope: ${timeScope}, Range: ${startStr} to ${endStr}`);

                // Parallel Fetch: Snapshots & Valid INCIDENTS for Open/Close stats
                const [snapshotsResult, regionsResult, incidentsResult] = await Promise.all([
                    supabaseClient
                        .from('daily_backlog_snapshots')
                        .select('*')
                        .gte('snapshot_date', startStr)
                        .lte('snapshot_date', endStr)
                        .order('snapshot_date', { ascending: true }),
                    supabaseClient
                        .from('regions')
                        .select('name')
                        .eq('visible', true),
                    supabaseClient
                        .from('incidents')
                        .select('numero, data_apertura, data_chiusura, regione, stato, in_sla, violazione_avvenuta')
                        // We fetch ALL incidents involved in the period (opened OR closed in range)
                        // .or(`data_apertura.gte.${startStr},data_chiusura.gte.${startStr}`) 
                        // Complex OR logic with ranges is tricky in one query if we want partial matches.
                        // Let's just fetch ALL incidents created or closed after startStr minus reasonable buffer?
                        // Or just fetch all incidents for the year? 
                        // Let's fetch incidents where Date >= startStr or Date <= endStr?
                        // Actually, simplified: Fetch incidents where data_apertura >= startStr OR data_chiusura >= startStr
                        .or(`data_apertura.gte.${startStr},data_chiusura.gte.${startStr}`)
                ]);

                if (snapshotsResult.error) console.error('Error fetching snapshots:', snapshotsResult.error);
                if (regionsResult.error) console.error('Error fetching regions:', regionsResult.error);
                if (incidentsResult.error) console.error('Error fetching incidents:', incidentsResult.error);

                const visibleRegions = regionsResult.data?.map((r: any) => r.name) || [];
                const rawSnapshots = snapshotsResult.data || [];
                const rawIncidents = incidentsResult.data || [];

                // 1. Process Snapshots (Backlog)
                const filteredSnapshots = visibleRegions.length > 0
                    ? rawSnapshots.filter((row: any) => visibleRegions.includes(row.region))
                    : rawSnapshots;

                // 2. Process Incidents into Daily Stats (Overrides Snapshot 0s)
                // We need to map rawIncidents to dates in the range.
                const incidentStatsByDate: Record<string, { opened: number, closed: number, slaViolations: number }> = {};

                rawIncidents.forEach((inc: any) => {
                    const reg = inc.regione;
                    if (visibleRegions.length > 0 && !visibleRegions.includes(reg)) return;

                    // Opened
                    if (inc.data_apertura) {
                        const d = inc.data_apertura.split('T')[0];
                        if (d >= startStr && d <= endStr) {
                            if (!incidentStatsByDate[d]) incidentStatsByDate[d] = { opened: 0, closed: 0, slaViolations: 0 };
                            incidentStatsByDate[d].opened++;
                        }
                    }

                    // Closed
                    if (inc.data_chiusura) {
                        const d = inc.data_chiusura.split('T')[0];
                        if (d >= startStr && d <= endStr) {
                            if (!incidentStatsByDate[d]) incidentStatsByDate[d] = { opened: 0, closed: 0, slaViolations: 0 };
                            incidentStatsByDate[d].closed++;

                            // SLA Breach (on valid closed tickets)
                            const sla = (inc.in_sla || '').trim().toUpperCase();
                            if (sla === 'SI' || sla === 'NO') {
                                if (sla === 'NO') incidentStatsByDate[d].slaViolations++;
                            }
                        }
                    }
                });


                // 3. Merge Data: Use Snapshot for Backlog, IncidentStats for Flow
                // We iterate through dates in range (or just use snapshot dates if dense enough)
                // Snapshots might be missing for some days?
                // Let's use the union of snapshot dates and incident dates?
                // Or just iterate snapshots and enrich? 
                // If snapshots are missing, backlog is unknown.

                // Better strategy: Enrich the DB Data rows with "real" open/close counts.
                // But dbData is granular (Region + Date).
                // So incidentStats needs to be grouped by Region + Date too!

                const preciseStats: Record<string, { opened: number, closed: number }> = {}; // Key: "yyyy-mm-dd_RegionName"

                rawIncidents.forEach((inc: any) => {
                    const reg = inc.regione || 'Unknown';

                    if (inc.data_apertura) {
                        const d = inc.data_apertura.split('T')[0];
                        const k = `${d}_${reg}`;
                        if (!preciseStats[k]) preciseStats[k] = { opened: 0, closed: 0 };
                        preciseStats[k].opened++;
                    }
                    if (inc.data_chiusura) {
                        const d = inc.data_chiusura.split('T')[0];
                        const k = `${d}_${reg}`;
                        if (!preciseStats[k]) preciseStats[k] = { opened: 0, closed: 0 };
                        preciseStats[k].closed++;
                    }
                });

                // Now map over snapshots and override
                const finalData = filteredSnapshots.map((snap: any) => {
                    const k = `${snap.snapshot_date}_${snap.region}`;
                    const real = preciseStats[k] || { opened: 0, closed: 0 };
                    return {
                        ...snap,
                        opened_today: real.opened, // Override
                        closed_today: real.closed // Override
                    };
                });

                setDbData(finalData);

            } catch (err) {
                console.error('Unexpected error:', err);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [timeScope, selectedYear, supabaseClient]);

    // --- Process Data for Chart (Aggegrate by Date) ---
    const chartData = useMemo(() => {
        if (!dbData.length) return [];

        // Group by Date for Chart display
        const grouped = dbData.reduce((acc: any, row: any) => {
            const date = row.snapshot_date;
            if (!acc[date]) {
                acc[date] = {
                    date: date,
                    // Format Date based on scope
                    name: timeScope === 'monthly'
                        ? new Date(date).getDate().toString()
                        : new Date(date).toLocaleDateString('it-IT', { day: '2-digit', month: 'short' }),
                    total: 0,
                    active: 0,
                    suspended: 0,
                    opened: 0,
                    closed: 0,
                    slaViolations: 0,
                    count: 0
                };
            }
            acc[date].total += (row.total_backlog || 0);
            acc[date].suspended += (row.suspended_count || 0);
            // In Lav = Total - Suspended
            acc[date].active += ((row.total_backlog || 0) - (row.suspended_count || 0));
            acc[date].opened += (row.opened_today || 0);
            acc[date].closed += (row.closed_today || 0);
            acc[date].slaViolations += (row.active_violations || 0);
            acc[date].count += 1;
            return acc;
        }, {});

        // Convert to Array and Sort
        const result = Object.values(grouped).sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime());

        // Calculate Global Average Line (Average of Daily Totals)
        const globalSum = result.reduce((sum: number, day: any) => sum + day.total, 0);
        const globalAvg = result.length > 0 ? Math.round(globalSum / result.length) : 0;

        return result.map((day: any) => ({
            ...day,
            average: globalAvg,
            // Calculate Daily SLA Compliance % (100 - % of violating tickets)
            sla: day.total > 0 ? Math.round(100 - ((day.slaViolations / day.total) * 100)) : 100
        }));

    }, [dbData, timeScope]);

    // Derived Stats for KPIs and Titles
    const { avgBacklog, avgSla, periodDelta } = useMemo(() => {
        if (chartData.length === 0) return { avgBacklog: 0, currentBacklog: 0, avgSla: 0, periodDelta: 0 };

        const lastPoint = chartData[chartData.length - 1];
        const current = lastPoint.total;

        // Average Backlog is already calculated per point (straight line), so take any point's average
        const avg = lastPoint.average;

        // SLA Average for the WHOLE period
        const totalSla = chartData.reduce((acc, cur) => acc + cur.sla, 0);
        const periodSla = totalSla / chartData.length;

        return {
            avgBacklog: Math.round(avg),
            currentBacklog: current,
            avgSla: periodSla,
            periodDelta: current - avg
        };
    }, [chartData]);



    // Process Data for Regional Table
    const regionalData = useMemo(() => {
        /* BLOCK_START */
        if (!dbData.length) return [];

        // 1. Group by Region to calculate Period Averages
        const regionStats: Record<string, any> = {};

        dbData.forEach(row => {
            const reg = row.region;
            if (!regionStats[reg]) {
                regionStats[reg] = {
                    region: reg,
                    totalBacklogSum: 0,
                    openSum: 0,
                    closeSum: 0,
                    daysCount: 0,
                    latestDateSeen: '',
                    currentBacklog: 0,
                    currentSuspended: 0
                };
            }
            const stats = regionStats[reg];
            stats.totalBacklogSum += (row.total_backlog || 0);
            stats.openSum += (row.opened_today || 0);
            stats.closeSum += (row.closed_today || 0);
            stats.daysCount += 1;

            if (row.snapshot_date >= stats.latestDateSeen) {
                stats.latestDateSeen = row.snapshot_date;
                stats.currentBacklog = (row.total_backlog || 0);
                stats.currentSuspended = (row.suspended_count || 0);
            }
        });

        // 2. Filter for Current Month Data
        // Use local date strings to match snapshot_date format (YYYY-MM-DD)
        const now = new Date();
        const year = now.getFullYear();
        const month = now.getMonth(); // 0-indexed

        // Helper to format as YYYY-MM-DD local
        const toLocalISO = (d: Date) => {
            const y = d.getFullYear();
            const m = String(d.getMonth() + 1).padStart(2, '0');
            const day = String(d.getDate()).padStart(2, '0');
            return `${y}-${m}-${day}`;
        };

        const currentMonthStart = toLocalISO(new Date(year, month, 1));
        const currentMonthEnd = toLocalISO(new Date(year, month + 1, 0));

        const currentMonthData = dbData.filter(row =>
            row.snapshot_date >= currentMonthStart &&
            row.snapshot_date <= currentMonthEnd
        );

        const currMonthStats: Record<string, any> = {};
        currentMonthData.forEach(row => {
            const reg = row.region;
            if (!currMonthStats[reg]) currMonthStats[reg] = { open: 0, close: 0, count: 0 };
            currMonthStats[reg].open += (row.opened_today || 0);
            currMonthStats[reg].close += (row.closed_today || 0);
            currMonthStats[reg].count += 1;
        });

        // 3. Map to Table Rows
        return Object.values(regionStats).map((stat: any) => {
            const avgBacklog = Math.round(stat.totalBacklogSum / stat.daysCount);
            const avgOpenPeriod = Number((stat.openSum / stat.daysCount).toFixed(1));
            const avgClosePeriod = Number((stat.closeSum / stat.daysCount).toFixed(1));

            const currStats = currMonthStats[stat.region] || { open: 0, close: 0, count: 0 };
            const avgOpenCurrent = currStats.count > 0 ? Number((currStats.open / currStats.count).toFixed(1)) : 0;
            const avgCloseCurrent = currStats.count > 0 ? Number((currStats.close / currStats.count).toFixed(1)) : 0;

            const totalClosed = stat.closeSum;
            const isOverThreshold = stat.currentBacklog > avgBacklog;

            const isOpenTrendUp = avgOpenCurrent > avgOpenPeriod;
            const isCloseTrendUp = avgCloseCurrent > avgClosePeriod;
            const active = stat.currentBacklog - stat.currentSuspended;

            return {
                region: stat.region,
                backlog: stat.currentBacklog,
                grandTotal: stat.currentBacklog + totalClosed,
                closed: totalClosed,
                avgBacklog,
                avgOpenCurrent,
                avgOpenPeriod,
                avgCloseCurrent,
                avgClosePeriod,
                isOverThreshold,
                isOpenTrendUp,
                isCloseTrendUp,
                active,
                suspended: stat.currentSuspended
            };
        }).sort((a, b) => b.backlog - a.backlog);













    }, [dbData, timeScope, selectedYear]);

    // Data for Heatmap: Region x TimeColumn -> SLA %
    const heatmapData = useMemo(() => {
        if (!dbData.length) return {};

        const map: Record<string, Record<string, number>> = {}; // { Region: { "1": 95, "Jan": 80 } }

        dbData.forEach(row => {
            let timeKey = '';

            // Fix Date Parsing for local time (YYYY-MM-DD is UTC by default)
            // But we want Date object to reflect the date in the string, regardless of timezone.
            // Actually, we manipulate strings mostly.

            if (timeScope === 'monthly') {
                // Key = Day number (1..31)
                // Use substring to avoid timezone issues: "2026-02-15" -> "15"
                timeKey = parseInt(row.snapshot_date.split('-')[2], 10).toString();
            } else {
                // Key = Label matching chartData (e.g. "01 gen")
                // Use strict date construction from parts
                const [y, m, d] = row.snapshot_date.split('-').map(Number);
                const localDate = new Date(y, m - 1, d);
                timeKey = localDate.toLocaleDateString('it-IT', { day: '2-digit', month: 'short' });
            }

            if (!map[row.region]) map[row.region] = {};

            // For now, simpler approach: Just overwrite or average if multiple points per cell?
            // Daily snapshots are unique per region/date. 
            // So for Monthly, it's 1:1.
            // For others, chartData is grouped by date. 
            // Wait, chartData groups ALL regions by date.
            // Heatmap rows are REGIONS. Columns are Dates (from chartData).
            // So for a specific Region and specific Date, we have 1 row in dbData.

            const total = row.total_backlog || 0;
            const violations = row.active_violations || 0;
            const sla = total > 0 ? Math.round(100 - ((violations / total) * 100)) : 100;

            map[row.region][timeKey] = sla;
        });

        return map;
    }, [dbData, timeScope]);

    // Heatmap Columns
    const heatmapColumns = useMemo(() => {
        if (timeScope === 'monthly') {
            // For Monthly scope, showing 30 days is too wide for a heatmap table usually, 
            // but let's try 4 weeks or aggregated. 
            // User request: "mensile il solo mese in corso". 
            // Let's show numeric days 1-31? Or maybe just weeks? 
            // Let's stick to days but maybe grouped or just a few key dates? 
            // Actually, for heatmap, showing days 1-31 is fine if horizontally scrollable.
            return Array.from({ length: 30 }, (_, i) => `${i + 1}`);
        }
        return chartData.map(d => d.name);
    }, [chartData, timeScope]);

    const getScopeLabel = (s: TimeScope) => {
        switch (s) {
            case 'monthly': return 'Mensile (Corrente)';
            case 'quarterly': return 'Trimestrale (Ultimi 3 Mesi)';
            case 'semiannual': return 'Semestrale (Ultimi 6 Mesi)';
            case 'annual': return 'Annuale (Anno Intero)';
        }
    };

    const getTrendIcon = (value: number, inverse: boolean = false) => {
        if (value === 0) return <Minus size={14} className="text-slate-400" />;
        const isPositive = value > 0;
        // If inverse (e.g. Backlog Delta), positive delta is BAD (Red), negative is GOOD (Green)
        const isGood = inverse ? !isPositive : isPositive;
        const ColorIcon = isPositive ? TrendingUp : TrendingDown;
        const colorClass = isGood ? 'text-emerald-400' : 'text-red-400';
        return <ColorIcon size={14} className={colorClass} />;
    };

    return (
        <div className="space-y-6 animate-in fade-in duration-500 pb-20">

            {/* Header & Filters */}
            <div className="flex flex-col md:flex-row justify-between items-center gap-4 mb-2">
                <div>
                    <h2 className="text-2xl font-bold text-slate-200 tracking-tight flex items-center gap-2">
                        <TrendingUp className="text-emerald-400" /> Analisi Trend Storici
                    </h2>
                    <p className="text-sm text-slate-400">Monitoraggio evoluzione backlog e performance SLA nel lungo periodo.</p>
                </div>

                <div className="flex bg-slate-800/50 p-1.5 rounded-lg border border-white/5 shadow-lg">
                    {(['monthly', 'quarterly', 'semiannual', 'annual'] as TimeScope[]).map(scope => (
                        <button
                            key={scope}
                            onClick={() => setTimeScope(scope)}
                            className={`px-3 py-1.5 text-xs font-bold uppercase tracking-wider rounded-md transition-all ${timeScope === scope
                                ? 'bg-emerald-600 text-white shadow-lg'
                                : 'text-slate-500 hover:text-slate-300'
                                }`}
                        >
                            {scope === 'monthly' ? 'Mese' : scope === 'quarterly' ? 'Trimestre' : scope === 'semiannual' ? 'Semestre' : 'Anno'}
                        </button>
                    ))}
                </div>

                <div className="flex items-center gap-2">
                    <select
                        value={selectedYear}
                        onChange={(e) => setSelectedYear(Number(e.target.value))}
                        className="bg-slate-800 border border-slate-600 text-white text-sm rounded-lg p-2 focus:ring-2 focus:ring-blue-500 outline-none"
                    >
                        {[2024, 2025, 2026].map(y => <option key={y} value={y}>{y}</option>)}
                    </select>
                    <button className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg border border-slate-600">
                        <Download size={18} />
                    </button>
                </div>
            </div>

            {/* KPI Cards (With Tooltips Explanation) */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                {(() => {
                    // Pre-calc totals and averages for cards
                    const totalOpenings = chartData.reduce((acc, cur) => acc + cur.opened, 0);
                    const avgOpenings = chartData.length > 0 ? totalOpenings / chartData.length : 0;
                    const lastDayOpenings = chartData.length > 0 ? chartData[chartData.length - 1].opened : 0;
                    const openTrend = lastDayOpenings - avgOpenings;

                    const totalClosures = chartData.reduce((acc, cur) => acc + cur.closed, 0);
                    const avgClosures = chartData.length > 0 ? totalClosures / chartData.length : 0;
                    const lastDayClosures = chartData.length > 0 ? chartData[chartData.length - 1].closed : 0;
                    const closeTrend = lastDayClosures - avgClosures;

                    return [
                        {
                            label: 'Attuale Vs Media',
                            value: `${periodDelta > 0 ? '+' : ''}${periodDelta}`,
                            trend: periodDelta,
                            inverse: true,
                            color: 'emerald',
                            desc: 'Differenza tra il Backlog Attuale e la Media del periodo selezionato.'
                        },
                        {
                            label: 'SLA Medio',
                            value: `${avgSla.toFixed(1)}%`,
                            trend: 0,
                            isGood: avgSla >= 90,
                            color: 'blue',
                            desc: 'Media della SLA Compliance su tutti i ticket del periodo selezionato.'
                        },
                        {
                            label: 'Aperture Totali',
                            value: totalOpenings.toLocaleString(),
                            trend: openTrend,
                            inverse: true, // More openings = Red
                            color: 'slate',
                            desc: 'Totale aperture nel periodo. Trend confronta l\'ultimo giorno con la media giornaliera.',
                            subtext: `Media: ${avgOpenings.toFixed(0)}/gg`
                        },
                        {
                            label: 'Chiusure Totali',
                            value: totalClosures.toLocaleString(),
                            trend: closeTrend,
                            inverse: false, // More closures = Green
                            color: 'purple',
                            desc: 'Totale chiusure nel periodo. Trend confronta l\'ultimo giorno con la media giornaliera.',
                            subtext: `Media: ${avgClosures.toFixed(0)}/gg`
                        },
                    ].map((kpi, i) => (
                        <div key={i} className="glass-card p-4 flex items-center justify-between relative overflow-hidden group cursor-help" title={kpi.desc}>
                            <div className={`absolute right-0 top-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity bg-${kpi.color}-500/20 rounded-bl-full`} />
                            <div>
                                <p className="text-[10px] text-slate-500 uppercase font-bold tracking-wider flex items-center gap-1">
                                    {kpi.label} <HelpCircle size={10} className="text-slate-600" />
                                </p>
                                <h3 className="text-2xl font-bold text-white mt-1">{kpi.value}</h3>
                                {(kpi as any).subtext && (
                                    <p className="text-[9px] text-slate-500 font-mono mt-0.5">{(kpi as any).subtext}</p>
                                )}
                            </div>
                            <div className="flex items-center gap-1 text-xs font-bold">
                                {kpi.label === 'SLA Medio' ? (
                                    <span className={kpi.isGood ? 'text-emerald-400' : 'text-red-400'}>{kpi.isGood ? 'Target OK' : 'Sotto Target'}</span>
                                ) : (
                                    getTrendIcon(kpi.trend as number, kpi.inverse)
                                )}
                            </div>
                        </div>
                    ));
                })()}
            </div>

            {/* Charts Grid - Full Width Stacked */}
            <div className="flex flex-col gap-6">

                {/* 1. Backlog Evolution - Composed Chart for Trend Line */}
                <div className="glass-card p-6 flex flex-col h-[400px]">
                    <h3 className="text-sm font-bold text-white mb-6 flex items-center gap-2">
                        <Layers size={16} className="text-emerald-400" />
                        Evoluzione Backlog ({getScopeLabel(timeScope)})
                        <span className="ml-2 text-xs font-normal text-slate-400 bg-slate-800 px-2 py-0.5 rounded-full border border-white/5">
                            Media: {avgBacklog} incident
                        </span>
                    </h3>
                    <div className="flex-1 w-full min-h-0 min-w-0">
                        <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                            <ComposedChart data={chartData}>
                                <defs>
                                    <linearGradient id="colorTotal" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#e2e8f0" stopOpacity={0.3} />
                                        <stop offset="95%" stopColor="#e2e8f0" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.2} vertical={false} />
                                <XAxis dataKey="name" stroke="#64748b" fontSize={10} tickLine={false} axisLine={false} />
                                <YAxis stroke="#64748b" fontSize={10} tickLine={false} axisLine={false} />
                                <Tooltip
                                    contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', color: '#f8fafc' }}
                                    itemStyle={{ fontSize: '12px', color: '#f8fafc' }}
                                />
                                <Legend />
                                <Area type="monotone" dataKey="total" stroke="#e2e8f0" fillOpacity={1} fill="url(#colorTotal)" name="Backlog Totale" strokeWidth={2} />
                                <Line type="monotone" dataKey="average" stroke="#f59e0b" name="Media Periodo" strokeWidth={2} dot={false} strokeDasharray="5 5" />
                            </ComposedChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* 2. Regional Analysis Table (Replaces Supplier Chart) */}
                <div className="glass-card p-6 flex flex-col h-[600px]">
                    <h3 className="text-sm font-bold text-white mb-6 flex items-center gap-2">
                        <Activity size={16} className="text-amber-400" /> Analisi Regionale ({getScopeLabel(timeScope)})
                    </h3>
                    <div className="flex-1 w-full min-h-0 overflow-auto custom-scrollbar">
                        <table className="w-full text-left border-collapse">
                            <thead className="text-[10px] uppercase text-slate-500 font-bold sticky top-0 bg-[#1e293b] z-10">
                                <tr>
                                    <th className="pb-3 pl-2">Regione</th>
                                    <th className="pb-3 text-center">Backlog</th>
                                    <th className="pb-3 text-center">Media Backlog</th>
                                    <th className="pb-3 text-center">Soglia</th>
                                    <th className="pb-3 text-center text-purple-400">In Lav.</th>
                                    <th className="pb-3 text-center text-yellow-400">Sospesi</th>
                                    <th className="pb-3 text-center">Trend Open</th>
                                    <th className="pb-3 text-center">Trend Close</th>
                                    <th className="pb-3 text-center text-blue-400">Chiusi</th>
                                    <th className="pb-3 text-center text-white font-bold">Totale</th>
                                </tr>
                            </thead>
                            <tbody className="text-xs divide-y divide-slate-800">
                                {regionalData.map((row) => (
                                    <tr key={row.region} className="group hover:bg-white/5 transition-colors">
                                        <td className="py-2.5 pl-2 font-medium text-slate-300 group-hover:text-white transition-colors">
                                            {row.region}
                                        </td>
                                        <td className="py-2.5 text-center text-slate-400 font-mono">
                                            {row.backlog}
                                        </td>
                                        <td className="py-2.5 text-center text-slate-300 font-bold font-mono">
                                            {row.avgBacklog}
                                        </td>
                                        <td className="py-2.5 text-center">
                                            <div className="flex justify-center">
                                                {row.isOverThreshold ? (
                                                    <TrendingUp size={14} className="text-red-400" />
                                                ) : (
                                                    <TrendingDown size={14} className="text-emerald-400" />
                                                )}
                                            </div>
                                        </td>
                                        <td className="py-2.5 text-center text-purple-400 font-mono">
                                            {row.active}
                                        </td>
                                        <td className="py-2.5 text-center text-yellow-400 font-mono">
                                            {row.suspended}
                                        </td>

                                        <td className="py-2.5 text-center">
                                            <div
                                                className="flex justify-center cursor-help"
                                                title={`Media Open (Corr): ${row.avgOpenCurrent}\nMedia Open (Per): ${row.avgOpenPeriod}`}
                                            >
                                                {row.isOpenTrendUp ? (
                                                    <TrendingUp size={14} className="text-red-400" />
                                                ) : (
                                                    <TrendingDown size={14} className="text-emerald-400" />
                                                )}
                                            </div>
                                        </td>

                                        <td className="py-2.5 text-center">
                                            <div
                                                className="flex justify-center cursor-help"
                                                title={`Media Close (Corr): ${row.avgCloseCurrent}\nMedia Close (Per): ${row.avgClosePeriod}`}
                                            >
                                                {row.isCloseTrendUp ? (
                                                    <TrendingUp size={14} className="text-emerald-400" />
                                                ) : (
                                                    <TrendingDown size={14} className="text-red-400" />
                                                )}
                                            </div>
                                        </td>

                                        <td className="py-2.5 text-center text-blue-400 font-mono font-bold">
                                            {row.closed}
                                        </td>
                                        <td className="py-2.5 text-center text-white font-mono font-bold bg-white/5 rounded-r">
                                            {row.grandTotal}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* 3. SLA Heatmap - Columns match scope */}
                <div className="glass-card p-6">
                    <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
                        <Activity size={16} className="text-blue-400" /> SLA Heatmap Regionale
                    </h3>
                    <div className="overflow-x-auto">
                        <div className="min-w-[800px]">
                            <div className="grid gap-1 mb-2" style={{ gridTemplateColumns: `150px repeat(${heatmapColumns.length}, 1fr)` }}>
                                <div className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Regione</div>
                                {heatmapColumns.map(m => <div key={m} className="text-[10px] text-slate-500 text-center font-bold uppercase">{m}</div>)}
                            </div>
                            <div className="space-y-1">
                                {regionalData.slice(0, 15).map(row => (
                                    <div key={row.region} className="grid gap-1 items-center hover:bg-white/5 transition-colors p-1 rounded" style={{ gridTemplateColumns: `150px repeat(${heatmapColumns.length}, 1fr)` }}>
                                        <div className="text-xs text-slate-300 font-medium truncate">{row.region}</div>
                                        {heatmapColumns.map((col, i) => {
                                            const mapVal = heatmapData[row.region]?.[col];
                                            const val = mapVal !== undefined ? mapVal : 0; // Default to 0 or null?
                                            // If no data, maybe show gray?
                                            const hasData = mapVal !== undefined;
                                            const color = !hasData ? 'bg-slate-800 text-slate-600' : val >= 95 ? 'bg-emerald-500' : val >= 90 ? 'bg-emerald-500/60' : val >= 80 ? 'bg-amber-500' : 'bg-red-500';

                                            // Ensure we match the key format. Monthly: "1", "2". Chart: "01"??
                                            // Chart "Monthly" uses "1", "2". HeatmapColumns uses "1", "2". 
                                            // logic seems consistent.

                                            return (
                                                <div key={i} className={`h-6 rounded flex items-center justify-center text-[9px] font-bold text-white/90 ${color} shadow-sm`} title={`${row.region} - ${col}: ${hasData ? val + '%' : 'N/D'}`}>
                                                    {hasData ? val + '%' : '-'}
                                                </div>
                                            )
                                        })}
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>

            </div>
        </div>
    );
};

export default TrendAnalysisPage;
