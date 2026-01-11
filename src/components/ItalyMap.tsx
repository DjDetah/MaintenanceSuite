import React, { useMemo, useState } from 'react';
import { ComposableMap, Geographies, Geography } from 'react-simple-maps';
import { scaleLinear } from 'd3-scale';
import { Tooltip } from 'react-tooltip';

// URL to the TopoJSON file we downloaded
const GEO_URL = "/italy-regions.json";

interface MapProps {
    data: any[]; // Array of region stats from RegionalSLATable logic
    mode: 'SLA' | 'BACKLOG';
}

const ItalyMap: React.FC<MapProps> = ({ data, mode }) => {
    const [msg, setMsg] = useState("");

    const mapData = useMemo(() => {
        // Transform data straight into a Region Name -> Stats map
        const map = new Map<string, any>();
        data.forEach(d => {
            // Normalize DB Region Names
            // DB: "LAZIO" -> Map: "Lazio"
            // We will do comparison with normalized strings
            map.set(d.region.toUpperCase(), d);
        });
        return map;
    }, [data]);

    // COLOR SCALES
    // Backlog: 0 -> Max Backlog
    const maxBacklog = useMemo(() => {
        return Math.max(...data.map(d => (d.fil_tot || 0) + (d.pres_tot || 0)), 10);
    }, [data]);

    const colorScaleBacklog = scaleLinear<string>()
        .domain([0, maxBacklog])
        .range(["#164E63", "#22d3ee"]); // Cyan-900 (Low) to Cyan-400 (High/Bright)

    // MAPPING HELPER
    // TopoJSON properties usually have 'reg_name' or similar for Italy
    // We need to match with our DB data
    const normalizeMapName = (geoName: string): string => {
        let name = geoName.toUpperCase();
        // Common mismatches
        if (name.includes("VALLE D'AOSTA")) return "VALLE D'AOSTA";
        if (name.includes("TRENTINO")) return "TRENTINO-ALTO ADIGE";
        if (name.includes("FRIULI")) return "FRIULI-VENEZIA GIULIA";
        if (name.includes("EMILIA")) return "EMILIA-ROMAGNA";
        return name;
    };

    return (
        <div className="w-full h-full min-h-[400px] flex flex-col items-center justify-center relative bg-slate-900/10 rounded-xl overflow-hidden">
            <ComposableMap
                projection="geoMercator"
                projectionConfig={{ center: [12.5, 42], scale: 2400 }} // Centered on Italy
                className="w-full h-full"
            >
                <Geographies geography={GEO_URL}>
                    {({ geographies }: { geographies: any[] }) =>
                        geographies.map((geo: any) => {
                            const geoName = geo.properties.reg_name || geo.properties.name || "Unknown";
                            const dbName = normalizeMapName(geoName);
                            const stats = mapData.get(dbName);

                            // Determine Color
                            let fill = "#1e293b"; // Default Slate-800
                            let stroke = "#334155"; // Slate-700 border

                            if (stats) {
                                if (mode === 'SLA') {
                                    // Logic: Filiali OR Presidi pass (Average? Or Worst case?)
                                    // Let's use Complessivo logic: >= 80% is Pass (Green)
                                    const filPct = stats.fil_tot > 0 ? (stats.fil_si / stats.fil_tot) * 100 : 100; // Empty = Pass
                                    const presPct = stats.pres_tot > 0 ? (stats.pres_si / stats.pres_tot) * 100 : 100;
                                    const passed = filPct >= 80 && presPct >= 80;
                                    fill = passed ? "#10b981" : "#ef4444"; // Emerald-500 or Red-500
                                } else {
                                    // Backlog Volume
                                    const val = (stats.fil_tot || 0) + (stats.pres_tot || 0); // Using Total Closed as proxy for volume in this context? Or Active?
                                    // Actually 'data' passed from RegionalSLATable contains 'tot' (Closed). 
                                    // If we want Backlog (Open), we might need different data prop. 
                                    // Given current request context "SLA vs Backlog", user might imply "SLA Compliance" vs "Ticket Volume".
                                    // Let's use Total Volume for now.
                                    fill = val > 0 ? colorScaleBacklog(val) : "#1e293b";
                                }
                            }

                            return (
                                <Geography
                                    key={geo.rsmKey}
                                    geography={geo}
                                    fill={fill}
                                    stroke={stroke}
                                    strokeWidth={0.5}
                                    style={{
                                        default: { outline: "none" },
                                        hover: { fill: "#f59e0b", outline: "none", cursor: 'pointer' }, // Amber-500 on hover
                                        pressed: { outline: "none" },
                                    }}
                                    onMouseEnter={() => {
                                        const val = stats ? (stats.fil_tot + stats.pres_tot) : 0;
                                        setMsg(`${geoName}: ${val} Interventi`);
                                    }}
                                    onMouseLeave={() => {
                                        setMsg("");
                                    }}
                                    data-tooltip-id="my-tooltip"
                                    data-tooltip-content={`${geoName} ${(stats && mode === 'SLA') ? (stats.fil_si / stats.fil_tot * 100).toFixed(0) + '%' : ''}`}
                                />
                            );
                        })
                    }
                </Geographies>
            </ComposableMap>
            <Tooltip id="my-tooltip" />
            {msg && <div className="absolute bottom-4 left-4 bg-slate-800 text-white text-xs px-2 py-1 rounded shadow">{msg}</div>}
        </div>
    );
};

export default ItalyMap;
