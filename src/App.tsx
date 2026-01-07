import React, { useState, useEffect, useMemo } from 'react';
import { createClient } from '@supabase/supabase-js';
import * as XLSX from 'xlsx';

import { LayoutDashboard, FileSpreadsheet, Menu, X, LogOut, AlertTriangle, CheckCircle, Clock, Table as TableIcon, Upload, Edit3, Settings, Save, Search, ChevronLeft, ChevronRight, Download, CalendarPlus, List } from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LabelList
} from 'recharts';

// --- Supabase Client ---
// Placeholder config as requested. User must provide VITE_ env vars.
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

// --- Constants ---
const REGIONS = [
  'Abruzzo', 'Basilicata', 'Calabria', 'Campania', 'Emilia Romagna',
  'Friuli Venezia Giulia', 'Lazio', 'Liguria', 'Lombardia', 'Marche',
  'Molise', 'Piemonte', 'Puglia', 'Sardegna', 'Sicilia',
  'Toscana', 'Trentino', 'Umbria', "Valle d'Aosta", 'Veneto'
];

// --- Types ---
interface Incident {
  numero: string;
  breve_descrizione?: string;
  stato?: string;
  data_apertura?: string;
  regione?: string;
  violazione_avvenuta?: boolean;
  in_sla?: string;
  created_at?: string;
  data_chiusura_prevista?: string; // New field
  pianificazione?: string; // New field for planned intervention date
  note_laser?: string; // New field for operator notes
  data_richiesta_parti?: string;
  parti_richieste?: string;
  richiesta_apparato?: boolean;
  stato_richiesta?: 'Pending' | 'In gestione' | 'Disponibile' | 'Evasione';
  gruppo_assegnazione?: string; // EUS_LOCKER_LASER_MICROINF_INC or EUS_LASER_MICROINF_INC
  fornitore?: string;
  [key: string]: any; // Allow dynamic access
}

interface UserProfile {
  id: string;
  email: string;
  role: string;
  regions: string[];
}

type ViewMode = 'dashboard' | 'incidents' | 'import' | 'requests' | 'settings';

// --- Utils ---
const formatDate = (dateString?: string) => {
  if (!dateString) return '-';
  return new Date(dateString).toLocaleDateString('it-IT', {
    day: '2-digit', month: '2-digit', year: 'numeric'
  });
};

const cn = (...classes: (string | undefined | null | false)[]) => {
  return classes.filter(Boolean).join(' ');
};

const isToday = (dateString?: string) => {
  if (!dateString) return false;
  const d = new Date(dateString);
  const today = new Date();
  return d.getDate() === today.getDate() &&
    d.getMonth() === today.getMonth() &&
    d.getFullYear() === today.getFullYear();
};

const isYesterday = (dateString?: string) => {
  if (!dateString) return false;
  const d = new Date(dateString);
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  return d.getDate() === yesterday.getDate() &&
    d.getMonth() === yesterday.getMonth() &&
    d.getFullYear() === yesterday.getFullYear();
};

const isSlaBreach = (breach?: boolean) => breach === true;

const isSlaExpiringToday = (i: Incident) => {
  if (['Chiuso', 'Closed'].includes(i.stato || '')) return false;
  // Assuming 'data_esecuzione' is the SLA deadline field as per previous logic
  return i.data_esecuzione && isToday(i.data_esecuzione);
};

// --- Components ---

// 1. Sidebar
const Sidebar = ({
  currentView,
  setView,
  isOpen,
  toggleSidebar,
  user,
  loading
}: {
  currentView: ViewMode;
  setView: (v: ViewMode) => void;
  isOpen: boolean;
  toggleSidebar: () => void;
  user: UserProfile | null;
  loading: boolean;
}) => {
  return (
    <aside className={cn(
      "fixed left-0 top-0 z-40 h-screen transition-transform w-64 bg-white dark:bg-[#0f172a]/90 backdrop-blur-md border-r border-slate-200 dark:border-white/5",
      !isOpen && "-translate-x-full"
    )}>
      <div className="h-full px-3 py-4 overflow-y-auto custom-scrollbar">
        <div className="flex items-center justify-between mb-8 pl-2 mt-2">
          <span className="self-center text-xl font-bold whitespace-nowrap text-slate-900 dark:text-white tracking-wide text-glow">
            ASTRAL EAGLE
          </span>
          <button onClick={toggleSidebar} className="lg:hidden text-slate-400 hover:text-white">
            <X size={24} />
          </button>
        </div>

        <ul className="space-y-2 font-medium">
          <li>
            <button
              onClick={() => setView('dashboard')}
              className={cn("flex items-center p-3 rounded-xl w-full text-left group transition-all duration-300",
                currentView === 'dashboard'
                  ? "bg-blue-600/20 text-blue-300 dark:bg-blue-600/20 dark:text-blue-300 bg-blue-50 text-blue-600 shadow-[0_0_15px_rgba(37,99,235,0.3)] border border-blue-500/30"
                  : "text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/5 hover:text-slate-900 dark:hover:text-white hover:pl-4"
              )}
            >
              <LayoutDashboard size={20} />
              <span className="ml-3">Backlog & KPI</span>
            </button>
          </li>
          <li>
            <button
              onClick={() => setView('incidents')}
              className={cn("flex items-center p-3 rounded-xl w-full text-left group transition-all duration-300",
                currentView === 'incidents'
                  ? "bg-blue-600/20 text-blue-300 dark:bg-blue-600/20 dark:text-blue-300 bg-blue-50 text-blue-600 shadow-[0_0_15px_rgba(37,99,235,0.3)] border border-blue-500/30"
                  : "text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/5 hover:text-slate-900 dark:hover:text-white hover:pl-4"
              )}
            >
              <TableIcon size={20} />
              <span className="ml-3">Tabella Incidenti</span>
            </button>
          </li>
          <li>
            <button
              onClick={() => setView('requests')}
              className={cn("flex items-center p-3 rounded-xl w-full text-left group transition-all duration-300",
                currentView === 'requests'
                  ? "bg-blue-600/20 text-blue-300 dark:bg-blue-600/20 dark:text-blue-300 bg-blue-50 text-blue-600 shadow-[0_0_15px_rgba(37,99,235,0.3)] border border-blue-500/30"
                  : "text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/5 hover:text-slate-900 dark:hover:text-white hover:pl-4"
              )}
            >
              <List size={20} />
              <span className="ml-3">Richieste Parti</span>
            </button>
          </li>
          <li>
            <button
              onClick={() => setView('import')}
              className={cn("flex items-center p-3 rounded-xl w-full text-left group transition-all duration-300",
                currentView === 'import'
                  ? "bg-blue-600/20 text-blue-300 dark:bg-blue-600/20 dark:text-blue-300 bg-blue-50 text-blue-600 shadow-[0_0_15px_rgba(37,99,235,0.3)] border border-blue-500/30"
                  : "text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/5 hover:text-slate-900 dark:hover:text-white hover:pl-4"
              )}
            >
              <Upload size={20} />
              <span className="ml-3">Importazione Dati</span>
            </button>
          </li>

          {['admin', 'manager'].includes(user?.role || '') && (
            <li>
              <div className="my-2 border-t border-slate-700/50 mx-2" />
              <button
                onClick={() => setView('settings')}
                className={cn("flex items-center p-3 rounded-xl w-full text-left group transition-all duration-300",
                  currentView === 'settings'
                    ? "bg-blue-600/20 text-blue-300 dark:bg-blue-600/20 dark:text-blue-300 bg-blue-50 text-blue-600 shadow-[0_0_15px_rgba(37,99,235,0.3)] border border-blue-500/30"
                    : "text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/5 hover:text-slate-900 dark:hover:text-white hover:pl-4"
                )}
              >
                <Settings size={20} />
                <span className="ml-3">Impostazioni</span>
              </button>
            </li>
          )}
        </ul>

        <div className="mt-10 border-t border-white/10 pt-6">
          {loading ? <p className="text-xs text-slate-500 text-center">Loading...</p> : user ? (
            <div className="bg-slate-800/50 rounded-lg p-3 mb-4 border border-white/5">
              <p className="text-xs text-slate-400 uppercase tracking-wider mb-1">Utente</p>
              <p className="text-sm font-semibold text-white truncate">{user.email}</p>
              <p className="text-xs text-blue-300 mt-1 capitalize">{user.role}</p>
            </div>
          ) : <p className="text-xs text-red-500 px-2 pb-2">Not Authenticated</p>}



          <button onClick={async () => await supabase.auth.signOut()} className="flex items-center p-3 mt-2 text-red-400 rounded-xl hover:bg-red-500/10 hover:text-red-300 group w-full transition-all">
            <LogOut size={20} />
            <span className="ml-3">Esci</span>
          </button>
        </div>
      </div>
    </aside>
  )
};

// 2. KPICards
const KPICards = ({ stats, selectedStatus, onStatusSelect }: { stats: any, selectedStatus: string | null, onStatusSelect: (s: string | null) => void }) => {
  const getActiveClass = (status: string | null) => {
    if (selectedStatus === status) return "ring-2 ring-white scale-105 shadow-2xl brightness-125";
    if (selectedStatus && selectedStatus !== status) return "opacity-50 blur-[1px] grayscale hover:grayscale-0 hover:opacity-100 hover:blur-none";
    return "";
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-6 mb-8">
      <div
        onClick={() => onStatusSelect(selectedStatus === 'Backlog' ? null : 'Backlog')}
        className={cn("glass-card p-6 relative overflow-hidden group cursor-pointer transition-all duration-300", getActiveClass('Backlog'))}
      >
        <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
          <Clock size={48} className="text-white" />
        </div>
        <p className="text-slate-400 text-sm font-medium uppercase tracking-wider mb-1">Backlog Totale</p>
        <h3 className="text-3xl font-bold text-white mb-1">{stats.open + stats.suspended}</h3>
        <p className="text-xs text-slate-500">In Lavorazione + Sospesi</p>
      </div>

      <div
        onClick={() => onStatusSelect('In Lavorazione')}
        className={cn("glass-card p-6 relative overflow-hidden group cursor-pointer transition-all duration-300", getActiveClass('In Lavorazione'))}
      >
        <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
          <LayoutDashboard size={48} className="text-purple-400" />
        </div>
        <p className="text-slate-400 text-sm font-medium uppercase tracking-wider mb-1">In Lavorazione</p>
        <h3 className="text-3xl font-bold text-purple-400 mb-1">{stats.open}</h3>
        <p className="text-xs text-purple-500/60">Ticket Attivi</p>
      </div>

      <div
        onClick={() => onStatusSelect('Sospesi')}
        className={cn("glass-card p-6 relative overflow-hidden group cursor-pointer transition-all duration-300", getActiveClass('Sospesi'))}
      >
        <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
          <Clock size={48} className="text-yellow-400" />
        </div>
        <p className="text-slate-400 text-sm font-medium uppercase tracking-wider mb-1">Sospesi</p>
        <h3 className="text-3xl font-bold text-yellow-400 mb-1">{stats.suspended}</h3>
        <p className="text-xs text-yellow-500/60">In Attesa</p>
      </div>

      {/* Aperti Oggi - MOVED AFTER SOSPESI */}
      <div
        onClick={() => onStatusSelect('Aperti Oggi')}
        className={cn("glass-card p-6 relative overflow-hidden group cursor-pointer transition-all duration-300", getActiveClass('Aperti Oggi'))}
      >
        <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
          <CheckCircle size={48} className="text-sky-400" />
        </div>
        <p className="text-slate-400 text-sm font-medium uppercase tracking-wider mb-1">Aperti Oggi</p>
        <h3 className="text-3xl font-bold text-sky-400 mb-1">{stats.openedToday}</h3>
        <p className="text-xs text-sky-500/60">Nuovi Ticket</p>
      </div>

      <div
        onClick={() => onStatusSelect('Chiusi Oggi')}
        className={cn("glass-card p-6 relative overflow-hidden group cursor-pointer transition-all duration-300", getActiveClass('Chiusi Oggi'))}
      >
        <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
          <CheckCircle size={48} className="text-emerald-400" />
        </div>
        <p className="text-slate-400 text-sm font-medium uppercase tracking-wider mb-1">Chiusi Oggi</p>
        <h3 className="text-3xl font-bold text-emerald-400 mb-1">{stats.closedToday}</h3>
        <p className="text-xs text-emerald-500/60">Risolti in giornata</p>
      </div>

      <div
        onClick={() => onStatusSelect('Violazioni SLA')}
        className={cn("glass-card p-6 relative overflow-hidden group cursor-pointer transition-all duration-300", getActiveClass('Violazioni SLA'))}
      >
        <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
          <AlertTriangle size={48} className="text-red-500" />
        </div>
        <p className="text-slate-400 text-sm font-medium uppercase tracking-wider mb-1">Violazioni SLA</p>
        <h3 className="text-3xl font-bold text-red-500 mb-1">{stats.slaBreach}</h3>
        <p className="text-xs text-red-500/60">Attenzione Richiesta</p>
      </div>
    </div>
  );
};

// 2. Regional Stats Table
interface RegionStat {
  region: string;
  total: number;
  backlog: number;
  suspended: number;
  slaBreach: number;
  openedYesterday: number;
  closedYesterday: number;
  openedToday: number;
  closedToday: number;
  plannedToday: number;
  lockers: number;
}

const RegionalStatsTable = ({ data, onFilterChange }: { data: Incident[], onFilterChange: (reg: string, status: string) => void }) => {
  const stats = useMemo(() => {
    const map = new Map<string, RegionStat>();

    data.forEach(i => {
      const reg = i.regione || 'N/D';
      if (!map.has(reg)) {
        map.set(reg, { region: reg, total: 0, backlog: 0, suspended: 0, slaBreach: 0, openedYesterday: 0, closedYesterday: 0, openedToday: 0, closedToday: 0, plannedToday: 0, lockers: 0 });
      }
      const stat = map.get(reg)!;
      stat.total++;

      const isClosed = ['Chiuso', 'Closed'].includes(i.stato || '');
      const isSuspended = ['Sospeso', 'Suspended'].includes(i.stato || '');
      const isLocker = i.gruppo_assegnazione === 'EUS_LOCKER_LASER_MICROINF_INC';

      if (!isClosed) {
        stat.backlog++;
        if (isSuspended) stat.suspended++;
        if (isSlaBreach(i.violazione_avvenuta)) stat.slaBreach++;
        if (isLocker) stat.lockers++;
      }

      if (isYesterday(i.data_ultima_riassegnazione)) stat.openedYesterday++;
      if (isYesterday(i.chiuso)) stat.closedYesterday++;

      if (isToday(i.data_apertura)) stat.openedToday++;
      if (isToday(i.chiuso)) stat.closedToday++;

      if (i.pianificazione && isToday(i.pianificazione)) stat.plannedToday++;
    });

    return Array.from(map.values()).sort((a, b) => b.backlog - a.backlog);
  }, [data]);

  return (
    <div className="glass-card overflow-hidden">
      <div className="p-4 border-b border-white/5 flex justify-between items-center bg-slate-900/50">
        <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
          <LayoutDashboard size={16} className="text-blue-400" /> Distribuzione Backlog Regionale
        </h3>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="text-[10px] text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-white/5 bg-slate-50 dark:bg-slate-900/60 font-semibold uppercase tracking-wider">
              <th className="px-3 py-1.5">Regione</th>
              <th className="px-3 py-1.5 text-right text-blue-400">Backlog</th>
              <th className="px-3 py-1.5 text-right text-purple-400">Sospesi</th>
              <th className="px-3 py-1.5 text-right text-slate-400">Lockers</th>
              <th className="px-3 py-1.5 text-right text-red-400">SLA Violati</th>
              <th className="px-3 py-1.5 text-right text-orange-400">SLA Scadenza</th>
              <th className="px-3 py-1.5 text-right text-amber-500">Pianificati</th>
              <th className="px-3 py-1.5 text-right text-xs text-blue-300 border-l border-white/5">Aperti Ieri</th>
              <th className="px-3 py-1.5 text-right text-xs text-emerald-300">Chiusi Ieri</th>
              <th className="px-3 py-1.5 text-right text-xs text-cyan-300 border-l border-white/5">Aperti Oggi</th>
              <th className="px-3 py-1.5 text-right text-xs text-emerald-400">Chiusi Oggi</th>
            </tr>
          </thead>
          <tbody className="text-xs text-slate-300 divide-y divide-white/5">
            {stats.map(s => {
              const expiringToday = data.filter(i => (i.regione === s.region) && isSlaExpiringToday(i)).length;
              return (
                <tr key={s.region} className="hover:bg-white/5 transition-colors cursor-pointer group" onClick={() => onFilterChange(s.region, '')}>
                  <td className="px-3 py-1.5 font-medium text-white group-hover:text-blue-400 transition-colors">{s.region}</td>
                  <td className="px-3 py-1.5 text-right font-bold text-blue-400 bg-blue-500/5">{s.backlog}</td>
                  <td className="px-3 py-1.5 text-right font-bold text-purple-400 cursor-pointer hover:underline" onClick={(e) => { e.stopPropagation(); onFilterChange(s.region, 'Sospesi'); }}>{s.suspended}</td>
                  <td className="px-3 py-1.5 text-right font-bold text-slate-400 bg-slate-500/5">{s.lockers}</td>
                  <td className="px-3 py-1.5 text-right font-bold text-red-500 cursor-pointer hover:underline" onClick={(e) => { e.stopPropagation(); onFilterChange(s.region, 'Violazioni SLA'); }}>{s.slaBreach}</td>
                  <td className="px-3 py-1.5 text-right font-bold text-orange-400">{expiringToday}</td>
                  <td className="px-3 py-1.5 text-right font-bold text-amber-500">{s.plannedToday}</td>
                  <td className="px-3 py-1.5 text-right font-mono text-blue-300 border-l border-white/5">{s.openedYesterday}</td>
                  <td className="px-3 py-1.5 text-right font-mono text-emerald-300">{s.closedYesterday}</td>
                  <td className="px-3 py-1.5 text-right font-mono text-cyan-300 border-l border-white/5 cursor-pointer hover:underline" onClick={(e) => { e.stopPropagation(); onFilterChange(s.region, 'Aperti Oggi'); }}>{s.openedToday}</td>
                  <td className="px-3 py-1.5 text-right font-mono text-emerald-400 cursor-pointer hover:underline" onClick={(e) => { e.stopPropagation(); onFilterChange(s.region, 'Chiusi Oggi'); }}>{s.closedToday}</td>
                </tr>
              );
            })}
            {stats.length === 0 && (
              <tr><td colSpan={11} className="text-center py-4 text-slate-500 italic text-xs">Nessuna regione con backlog attivo</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

// --- Locker Stats Table (Group by City) ---
const LockerStatsTable = ({ data }: { data: Incident[] }) => {
  // 1. Filter only Locker incidents
  const lockerData = data.filter(i => i.gruppo_assegnazione === 'EUS_LOCKER_LASER_MICROINF_INC');

  const stats = useMemo(() => {
    const map = new Map<string, RegionStat>(); // Reusing RegionStat interface for Citta

    lockerData.forEach(i => {
      const city = i.citta || 'N/D';
      if (!map.has(city)) {
        map.set(city, { region: city, total: 0, backlog: 0, suspended: 0, slaBreach: 0, openedYesterday: 0, closedYesterday: 0, openedToday: 0, closedToday: 0, plannedToday: 0, lockers: 0 });
      }
      const stat = map.get(city)!;
      stat.total++;

      const isClosed = ['Chiuso', 'Closed'].includes(i.stato || '');
      const isSuspended = ['Sospeso', 'Suspended'].includes(i.stato || '');
      // const isLocker = true; // By definition

      if (!isClosed) {
        stat.backlog++;
        if (isSuspended) stat.suspended++;
        if (isSlaBreach(i.violazione_avvenuta)) stat.slaBreach++;
        stat.lockers++;
      }

      if (isYesterday(i.data_ultima_riassegnazione)) stat.openedYesterday++;
      if (isYesterday(i.chiuso)) stat.closedYesterday++;
      if (isToday(i.data_apertura)) stat.openedToday++;
      if (isToday(i.chiuso)) stat.closedToday++;
      if (i.pianificazione && isToday(i.pianificazione)) stat.plannedToday++;
    });

    return Array.from(map.values()).sort((a, b) => b.backlog - a.backlog); // Sort by volume
  }, [lockerData]);

  if (stats.length === 0) return null; // Hide if no locker data

  return (
    <div className="glass-card overflow-hidden mt-6">
      <div className="p-4 border-b border-white/5 flex justify-between items-center bg-slate-900/50">
        <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
          <Settings size={16} className="text-slate-400" /> Backlog Locker (Dettaglio Città)
        </h3>
      </div>
      <div className="overflow-x-auto max-h-[400px] custom-scrollbar">
        <table className="w-full text-left border-collapse">
          <thead className="sticky top-0 bg-slate-50 dark:bg-slate-950 z-10 shadow-lg">
            <tr className="text-[10px] text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-white/5 font-semibold uppercase tracking-wider">
              <th className="px-3 py-1.5">Città</th>
              <th className="px-3 py-1.5 text-right text-blue-400">Backlog</th>
              <th className="px-3 py-1.5 text-right text-purple-400">Sospesi</th>
              <th className="px-3 py-1.5 text-right text-slate-400">Lockers</th>
              <th className="px-3 py-1.5 text-right text-red-400">SLA Violati</th>
              <th className="px-3 py-1.5 text-right text-orange-400">SLA Scadenza</th>
              <th className="px-3 py-1.5 text-right text-amber-500">Pianificati</th>
              <th className="px-3 py-1.5 text-right text-xs text-blue-300 border-l border-white/5">Aperti Ieri</th>
              <th className="px-3 py-1.5 text-right text-xs text-emerald-300">Chiusi Ieri</th>
              <th className="px-3 py-1.5 text-right text-xs text-cyan-300 border-l border-white/5">Aperti Oggi</th>
              <th className="px-3 py-1.5 text-right text-xs text-emerald-400">Chiusi Oggi</th>
            </tr>
          </thead>
          <tbody className="text-xs text-slate-300 divide-y divide-white/5">
            {stats.map(s => {
              const expiringToday = lockerData.filter(i => (i.citta === s.region) && isSlaExpiringToday(i)).length; // Filter on lockerData!
              return (
                <tr key={s.region} className="hover:bg-white/5 transition-colors cursor-pointer">
                  <td className="px-3 py-1.5 font-medium text-white">{s.region}</td>
                  <td className="px-3 py-1.5 text-right font-bold text-blue-400 bg-blue-500/5">{s.backlog}</td>
                  <td className="px-3 py-1.5 text-right font-bold text-purple-400">{s.suspended}</td>
                  <td className="px-3 py-1.5 text-right font-bold text-slate-400 bg-slate-500/5">{s.lockers}</td>
                  <td className="px-3 py-1.5 text-right font-bold text-red-500">{s.slaBreach}</td>
                  <td className="px-3 py-1.5 text-right font-bold text-orange-400">{expiringToday}</td>
                  <td className="px-3 py-1.5 text-right font-bold text-amber-500">{s.plannedToday}</td>
                  <td className="px-3 py-1.5 text-right font-mono text-blue-300 border-l border-white/5">{s.openedYesterday}</td>
                  <td className="px-3 py-1.5 text-right font-mono text-emerald-300">{s.closedYesterday}</td>
                  <td className="px-3 py-1.5 text-right font-mono text-cyan-300 border-l border-white/5">{s.openedToday}</td>
                  <td className="px-3 py-1.5 text-right font-mono text-emerald-400">{s.closedToday}</td>
                </tr>
              );
            })}
            {stats.length === 0 && (
              <tr><td colSpan={11} className="text-center py-4 text-slate-500 italic text-xs">Nessuna città con backlog locker attivo</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

// 3b. Item Analysis Chart
const ItemBarChart = ({ data }: { data: Incident[] }) => {
  const chartData = useMemo(() => {
    const counts: Record<string, number> = {};
    data.forEach(i => {
      // Item field, fallback to 'N/A'
      const key = i.item || 'N/A';
      counts[key] = (counts[key] || 0) + 1;
    });
    // Sort by count desc and take top 10
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .map(([name, value]) => ({ name, value })); // No slice limit
  }, [data]);



  // Height: 35px per item + some padding, but let container handle max/scroll if needed, or grow.
  // User asked to remove scrollbar: "Troviamo una soluzione... lasciare che la sezione si adatti".
  // So we calculate height and JUST USE IT.
  const height = Math.max(chartData.length * 35, 100);

  return (
    <div className="w-full pr-2" style={{ height: 'auto' }}>
      <div style={{ height: `${height}px`, minHeight: '300px' }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart layout="vertical" data={chartData} margin={{ top: 5, right: 30, left: 100, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" horizontal={false} />
            <XAxis type="number" stroke="#94a3b8" />
            <YAxis dataKey="name" type="category" width={120} style={{ fontSize: '11px', fill: '#cbd5e1' }} stroke="#94a3b8" />
            <Tooltip
              contentStyle={{ backgroundColor: 'rgba(15, 23, 42, 0.9)', borderColor: 'rgba(255,255,255,0.1)', color: '#fff', borderRadius: '12px', backdropFilter: 'blur(10px)' }}
              itemStyle={{ color: '#fff' }}
              cursor={{ fill: 'rgba(255,255,255,0.05)' }}
            />
            <Bar dataKey="value" fill="#6366f1" radius={[0, 4, 4, 0]}>
              <LabelList dataKey="value" position="right" fill="#e2e8f0" fontSize={11} />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

// 3c. Top Recidivist Assets Chart (Last 30 Days)
const TopAssetsChart = ({ filteredData, historyData }: { filteredData: Incident[], historyData: Incident[] }) => {
  const chartData = useMemo(() => {

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const getAssetKey = (i: Incident) => i.asset || i.tag_asset || i.serial_number || 'N/A';

    // 1. Identify Items from the FILTERED list (The "Target List")
    // e.g. If I select "Sospesi", I only want to see assets that are CURRENTLY Suspended.
    // e.g. If I select "Lombardia", I only want assets currently in Lombardia.
    const targetAssets = new Set<string>();
    filteredData.forEach(i => {
      const key = getAssetKey(i);
      if (key !== 'N/A') targetAssets.add(key);
    });

    // 2. Count incidents for these assets in the last 30 days using HISTORY data
    // "How many times has this SPECIFIC asset appeared in the region's history?"
    // This allows us to see if a currently suspended asset has a history of issues.
    const counts: Record<string, number> = {};

    historyData.forEach(i => {
      const d = i.data_apertura ? new Date(i.data_apertura) : null;
      // Must be recent
      if (!d || d < thirtyDaysAgo) return;

      const key = getAssetKey(i);
      // Must be one of the targeted assets
      if (targetAssets.has(key)) {
        counts[key] = (counts[key] || 0) + 1;
      }
    });

    // Sort by count desc and take top 10
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([name, value]) => ({ name, value }));
  }, [filteredData, historyData]);

  const height = Math.max(chartData.length * 35, 300);

  return (
    <div className="w-full pr-2" style={{ height: 'auto' }}>
      <div style={{ height: `${height}px`, minHeight: '300px' }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart layout="vertical" data={chartData} margin={{ top: 5, right: 30, left: 100, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" horizontal={false} />
            <XAxis type="number" stroke="#94a3b8" allowDecimals={false} />
            <YAxis dataKey="name" type="category" width={120} tickFormatter={(val) => val.length > 15 ? val.substring(0, 15) + '...' : val} style={{ fontSize: '11px', fill: '#cbd5e1' }} stroke="#94a3b8" />
            <Tooltip
              contentStyle={{ backgroundColor: 'rgba(15, 23, 42, 0.9)', borderColor: 'rgba(255,255,255,0.1)', color: '#fff', borderRadius: '12px', backdropFilter: 'blur(10px)' }}
              itemStyle={{ color: '#fff' }}
              cursor={{ fill: 'rgba(255,255,255,0.05)' }}
            />
            {/* Red color for recidivists */}
            <Bar dataKey="value" fill="#ef4444" radius={[0, 4, 4, 0]}>
              <LabelList dataKey="value" position="right" fill="#e2e8f0" fontSize={11} />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

// 3d. Raw Data Modal
const RawDataModal = ({ data, onClose }: { data: any, onClose: () => void }) => {
  if (!data) return null;
  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[60] flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-slate-900 border border-slate-700 w-full max-w-4xl max-h-[85vh] rounded-2xl overflow-hidden flex flex-col shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="p-4 border-b border-slate-700 flex justify-between items-center bg-slate-800/50">
          <h3 className="text-lg font-bold text-white flex items-center gap-2">
            <FileSpreadsheet className="text-blue-400" /> Raw Data Extract
          </h3>
          <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full transition-colors text-slate-400 hover:text-white">
            <X size={20} />
          </button>
        </div>
        <div className="p-6 overflow-y-auto font-mono text-xs text-slate-300">
          <pre>{JSON.stringify(data, null, 2)}</pre>
        </div>
      </div>
    </div>
  );
};

// 3e. Planning Modal
const PlanningModal = ({ current, onSave, onClose }: { current?: string, onSave: (date: string) => void, onClose: () => void }) => {
  // Initialize with current value or empty. Format for date is YYYY-MM-DD
  const formatForInput = (isoString?: string) => {
    if (!isoString) return '';
    try {
      return new Date(isoString).toISOString().split('T')[0];
    } catch (e) { return ''; }
  };

  const [value, setValue] = useState(formatForInput(current));

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[70] flex items-center justify-center p-4 animate-in fade-in duration-200" onClick={onClose}>
      <div className="bg-slate-900 border border-slate-700 w-full max-w-sm rounded-xl p-6 shadow-2xl relative" onClick={e => e.stopPropagation()}>
        <button onClick={onClose} className="absolute top-4 right-4 text-slate-500 hover:text-white">
          <X size={20} />
        </button>
        <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
          <CalendarPlus className="text-amber-500" /> Pianifica Intervento
        </h3>
        <p className="text-sm text-slate-400 mb-6">Seleziona la data prevista per l'intervento.</p>

        <input
          type="date"
          value={value}
          onChange={e => setValue(e.target.value)}
          className="w-full bg-slate-950 border border-slate-700 text-white rounded-lg p-3 mb-6 focus:ring-2 focus:ring-amber-500 outline-none"
        />

        <div className="flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 text-sm text-slate-400 hover:text-white font-medium">Annulla</button>
          <button
            onClick={() => {
              if (value) {
                // Append fixed time 00:00:00
                const dateWithTime = new Date(`${value}T00:00:00.000Z`); // UTC midnight
                onSave(dateWithTime.toISOString());
              } else {
                onSave('');
              }
              onClose();
            }}
            className="px-4 py-2 text-sm bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-lg shadow-lg"
          >
            Salva Pianificazione
          </button>
        </div>
      </div>
    </div>
  );
};

// 3c. Detail Modal
const IncidentDetailModal = ({ incident, onClose, onIncidentUpdate }: { incident: Incident, onClose: () => void, onIncidentUpdate?: (updated: Incident) => void }) => {
  const [showRaw, setShowRaw] = useState(false);
  const [showPlanning, setShowPlanning] = useState(false); // New state for planning modal
  const [notesHistory, setNotesHistory] = useState(incident.note_laser || '');

  // Parts Request State
  const [selectedParts, setSelectedParts] = useState<string[]>(incident.parti_richieste ? incident.parti_richieste.split('|') : []);
  const [isDeviceRequested, setIsDeviceRequested] = useState(incident.richiesta_apparato || false);

  // Sync state if prop changes (e.g. if opened different incident or external update)
  useEffect(() => {
    setNotesHistory(incident.note_laser || '');
    setSelectedParts(incident.parti_richieste ? incident.parti_richieste.split('|') : []);
    setIsDeviceRequested(incident.richiesta_apparato || false);
  }, [incident.note_laser, incident.parti_richieste, incident.richiesta_apparato]);

  const handlePartsSave = async () => {
    // Logic: If timestamp is empty and we are making a request, set it.
    // If request is cleared (parts empty AND device false), maybe clear timestamp? Or keep history?
    // Requirement: "timestamp di quando viene spuntata la prima parte...".
    // Usually keep existing timestamp if already set.

    let timestamp = incident.data_richiesta_parti;
    const isRequestActive = selectedParts.length > 0 || isDeviceRequested;

    if (isRequestActive && !timestamp) {
      timestamp = new Date().toISOString();
    }

    const updates = {
      parti_richieste: selectedParts.join('|'),
      richiesta_apparato: isDeviceRequested,
      data_richiesta_parti: timestamp,
      stato_richiesta: incident.stato_richiesta || 'Pending' // Persist current status or default
    };

    const { error } = await supabase.from('incidents').update(updates).eq('numero', incident.numero);

    if (error) {
      alert('Errore salvataggio richiesta: ' + error.message);
    } else {
      if (onIncidentUpdate) {
        onIncidentUpdate({ ...incident, ...updates });
      }
      alert('Richiesta salvata correttamente.');
    }
  };

  const handlePlanningSave = async (date: string) => {
    const updates = { pianificazione: date };
    const { error } = await supabase.from('incidents').update(updates).eq('numero', incident.numero);

    if (error) {
      alert('Errore salvataggio pianificazione: ' + error.message);
    } else {
      if (onIncidentUpdate) {
        onIncidentUpdate({ ...incident, ...updates });
      }
      // alert('Pianificazione aggiornata.');
    }
  };

  const togglePart = (part: string) => {
    if (isDeviceRequested) {
      // If Device is selected, Parts are inhibited. 
      // User must uncheck Device first. Or auto-uncheck Device?
      // Requirement: "Quando verrà spuntata questa casella (Apparato) verrà inibita o cancellata la selezione di parti".
      // Vice-versa usually implies checking a part might clear Apparato or be blocked.
      // Let's Auto-Unlock: Checking a part clears "Apparato" (Device).
      setIsDeviceRequested(false);
    }

    setSelectedParts(prev =>
      prev.includes(part) ? prev.filter(p => p !== part) : [...prev, part]
    );
  };

  const toggleDevice = () => {
    const newValue = !isDeviceRequested;
    setIsDeviceRequested(newValue);
    if (newValue) {
      // If checking Device, clear all parts
      setSelectedParts([]);
    }
  };

  if (!incident) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60] flex justify-center items-start pt-8 pb-8 px-4 animate-in fade-in duration-200 overflow-y-auto" onClick={onClose}>
      <div className="bg-[#0f172a] w-full max-w-6xl h-auto max-h-[90vh] rounded-2xl overflow-hidden flex flex-col border border-slate-700 shadow-2xl relative" onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="px-6 py-5 border-b border-slate-700 flex justify-between items-start bg-slate-900/50">
          <div className="flex gap-4 items-start">
            {/* ... Header Content (Keep Existing) ... */}
            <div>
              <div className="flex items-center gap-3 mb-1">
                <h2 className="text-2xl font-bold text-white tracking-tight">{incident.numero}</h2>
                {/* Status Badge */}
                <span className={cn("px-2.5 py-0.5 rounded-full text-xs font-bold border uppercase tracking-wider",
                  incident.stato === 'Aperto' ? 'bg-red-500/10 text-red-500 border-red-500/20' :
                    (incident.stato === 'In Lavorazione' || incident.stato === 'In Corso') ? 'bg-purple-500/10 text-purple-400 border-purple-500/20' :
                      incident.stato === 'Chiuso' ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' :
                        'bg-yellow-500/10 text-yellow-500 border-yellow-500/20'
                )}>
                  {incident.stato || 'N/A'}
                </span>

                {/* SLA Icon */}
                {isSlaBreach(incident.violazione_avvenuta) ?
                  <span className="text-red-500 flex items-center" title="SLA Violation"><AlertTriangle size={18} /></span> :
                  <span className="text-emerald-500/50 flex items-center" title="SLA OK"><CheckCircle size={18} /></span>
                }
              </div>

              {/* Localization Stacked */}
              <div className="flex flex-col gap-0.5 text-xs text-slate-400 mt-2 font-mono">
                <div className="flex items-baseline gap-2">
                  <span className="text-slate-600 min-w-[80px] uppercase text-[10px]">Località:</span>
                  <span className="text-slate-300 whitespace-normal max-w-[400px] leading-tight">
                    {incident.sede_presidiata || incident.indirizzo_intervento || incident.ag_indirizzo}
                  </span>
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="text-slate-600 min-w-[80px] uppercase text-[10px]">Città:</span>
                  <span className="text-slate-300">{incident.citta}</span>
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="text-slate-600 min-w-[80px] uppercase text-[10px]">Regione:</span>
                  <span className="text-slate-300">{incident.regione}</span>
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="text-slate-600 min-w-[80px] uppercase text-[10px]">Beneficiario:</span>
                  <span className="text-slate-300">{incident.beneficiario || '-'}</span>
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="text-slate-600 min-w-[80px] uppercase text-[10px]">Fornitore:</span>
                  <div className="flex items-center gap-1.5 mt-1">
                    {incident.fornitore ? (
                      <span className="text-amber-500 font-bold bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20 text-xs">
                        {incident.fornitore}
                      </span>
                    ) : (
                      <span className="text-slate-500 italic text-xs">-</span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button onClick={() => setShowRaw(true)} className="p-2 hover:bg-white/10 rounded-lg text-slate-400 hover:text-blue-400 transition-colors" title="Raw Data">
              <FileSpreadsheet size={20} />
            </button>
            <button onClick={onClose} className="p-2 hover:bg-red-500/20 rounded-lg text-slate-400 hover:text-red-400 transition-colors">
              <X size={24} />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6 bg-slate-900/30">
          {/* Grid Layout */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

            {/* Col 1: Target Asset (Left) - Span 3 */}
            <div className="lg:col-span-3 space-y-6">
              {/* ... (existing asset content) ... */}
              <div className="glass-card p-4 border-l-2 border-blue-500">
                <h4 className="text-xs uppercase text-slate-500 font-bold mb-3 tracking-wider flex items-center gap-2">
                  <LayoutDashboard size={14} /> Target Asset
                </h4>
                <div className="space-y-4">
                  <div>
                    <p className="text-[10px] text-slate-500 uppercase">Prodotto (Item)</p>
                    <p className="text-sm font-medium text-white break-words">{incident.item || '-'}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-slate-500 uppercase">Modello</p>
                    <p className="text-[10px] text-slate-300 break-words">{incident.hw_model || '-'}</p>
                  </div>
                  <div className="p-2 bg-slate-800/50 rounded-lg border border-white/5">
                    <div className="mb-2 pb-2 border-b border-white/5">
                      <p className="text-[10px] text-slate-500 uppercase mb-0.5">Serial Number</p>
                      <p className="text-sm font-mono text-blue-300 break-all leading-tight">{incident.serial_number || '-'}</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-slate-500 uppercase mb-0.5">Tag Asset</p>
                      <p className="text-xs font-mono text-purple-300 break-all leading-tight">{incident.tag_asset || '-'}</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Col 2: Technical Details (Center) - Span 6 */}
            <div className="lg:col-span-6 space-y-6">
              <div className="glass-card p-5">
                <h4 className="text-xs uppercase text-slate-500 font-bold mb-3 tracking-wider">Descrizione Problema</h4>
                <div className="bg-slate-950/50 p-4 rounded-xl border border-white/5 min-h-[120px]">
                  <p className="text-sm text-slate-300 leading-relaxed whitespace-pre-wrap">{incident.descrizione || incident.breve_descrizione || 'Nessuna descrizione disponibile.'}</p>
                </div>
              </div>
            </div>

            {/* Col 3: Timeline (Right) - Span 3 */}
            <div className="lg:col-span-3 space-y-6">
              <div className="glass-card p-5 h-full border-l-2 border-purple-500 relative overflow-hidden">
                <div className="flex justify-between items-center mb-6">
                  <h4 className="text-xs uppercase text-slate-500 font-bold tracking-wider flex items-center gap-2">
                    <Clock size={14} /> Timeline Eventi
                  </h4>
                  <button onClick={() => setShowPlanning(true)} className="text-amber-500 hover:text-white transition-colors" title="Aggiungi Pianificazione">
                    <CalendarPlus size={16} />
                  </button>
                </div>

                <div className="absolute top-0 right-0 p-3 opacity-5 pointer-events-none">
                  <Clock size={100} />
                </div>

                <div className="space-y-6 relative z-10 border-l border-slate-700/50 ml-2 pl-6">
                  {/* ... (existing timeline) ... */}
                  {/* Apertura */}
                  <div className="relative">
                    <div className="absolute -left-[31px] top-1.5 w-3 h-3 rounded-full bg-slate-900 border border-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.5)]"></div>
                    <p className="text-[10px] text-blue-400 font-mono mb-0.5">{formatDate(incident.data_apertura)}</p>
                    <p className="text-white text-xs font-bold">Apertura Ticket</p>
                  </div>

                  {/* Aggiornamento */}
                  {incident.data_aggiornamento && (
                    <div className="relative">
                      <div className="absolute -left-[31px] top-1.5 w-3 h-3 rounded-full bg-slate-900 border border-purple-500"></div>
                      <p className="text-[10px] text-purple-400 font-mono mb-0.5">{formatDate(incident.data_aggiornamento)}</p>
                      <p className="text-white text-xs font-bold">Aggiornamento</p>
                    </div>
                  )}

                  {/* Richiesta Parti (NEW) */}
                  {incident.data_richiesta_parti && (
                    <div className="relative">
                      <div className="absolute -left-[31px] top-1.5 w-3 h-3 rounded-full bg-slate-900 border border-amber-500 shadow-[0_0_10px_rgba(245,158,11,0.5)]"></div>
                      <p className="text-[10px] text-amber-400 font-mono mb-0.5">{formatDate(incident.data_richiesta_parti)}</p>
                      <p className="text-white text-xs font-bold">Richiesta Parti/Apparato</p>
                    </div>
                  )}

                  {/* Pianificazione */}
                  {incident.pianificazione && (
                    <div className="relative">
                      <div className="absolute -left-[31px] top-1.5 w-3 h-3 rounded-full bg-slate-900 border border-amber-500"></div>
                      <p className="text-[10px] text-amber-400 font-mono mb-0.5">{formatDate(incident.pianificazione)}</p>
                      <p className="text-white text-xs font-bold">Intervento Pianificato</p>
                    </div>
                  )}

                  {/* Chiusura */}
                  <div className="relative">
                    <div className={cn("absolute -left-[31px] top-1.5 w-3 h-3 rounded-full bg-slate-900 border",
                      incident.chiuso ? "border-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]" : "border-slate-600"
                    )}></div>
                    <p className={cn("text-[10px] font-mono mb-0.5", incident.chiuso ? "text-emerald-400" : "text-slate-600")}>
                      {incident.chiuso ? formatDate(incident.chiuso) : 'In Attesa'}
                    </p>
                    <p className={cn("text-xs font-bold", incident.chiuso ? "text-white" : "text-slate-500")}>Chiusura</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Split Bottom Row: Parts Request (Left) & Notes (Right) */}

            {/* Parts Request Section (Span 3) */}
            <div className="lg:col-span-3">
              <div className="glass-card p-3 border-t-4 border-amber-500/50 h-full flex flex-col">
                <h4 className="text-[10px] uppercase text-slate-500 font-bold mb-2 tracking-wider flex items-center gap-2">
                  <Settings size={12} className="text-amber-400" /> Richiesta Parti / Apparato
                </h4>

                <div className="flex-1 space-y-2">
                  {/* Parts List */}
                  <div className={cn("space-y-1 transition-opacity duration-300", isDeviceRequested ? "opacity-50 pointer-events-none grayscale" : "opacity-100")}>
                    <div className="flex flex-col gap-1.5">
                      {['Scheda Madre', 'ADF', 'Display', 'Cassetto'].map(part => (
                        <label key={part} className="flex items-center gap-2 p-1.5 rounded bg-slate-800/50 border border-white/5 cursor-pointer hover:bg-slate-800 transition-colors">
                          <input
                            type="checkbox"
                            checked={selectedParts.includes(part)}
                            onChange={() => togglePart(part)}
                            className="w-3.5 h-3.5 rounded border-slate-600 text-amber-500 focus:ring-amber-500/20 bg-slate-900"
                          />
                          <span className="text-xs text-slate-300">{part}</span>
                        </label>
                      ))}
                    </div>
                  </div>

                  {/* Divider */}
                  <div className="border-t border-white/5 relative my-2">
                    <span className="absolute left-1/2 -translate-x-1/2 -top-2 bg-[#0f172a] px-1 text-[8px] text-slate-500 uppercase">O</span>
                  </div>

                  {/* Device Request */}
                  <div className="bg-red-500/10 p-2 rounded-lg border border-red-500/20">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={isDeviceRequested}
                        onChange={toggleDevice}
                        className="w-4 h-4 rounded border-red-500/50 text-red-500 focus:ring-red-500/20 bg-slate-900"
                      />
                      <div>
                        <span className="text-red-400 font-bold text-xs block">Richiesta Apparato</span>
                      </div>
                    </label>
                  </div>
                </div>

                {/* Save Button & Status */}
                <div className="mt-3 flex flex-col gap-1 pt-2 border-t border-white/5">
                  {/* Status Cycle Button - Only visible after request is saved (timestamp exists) */}
                  {incident.data_richiesta_parti && (
                    <button
                      onClick={async () => {
                        const states = ['Pending', 'In gestione', 'Disponibile', 'Evasione'];
                        const current = incident.stato_richiesta || 'Pending';

                        // Terminal state check
                        if (current === 'Evasione') return;

                        const nextIndex = states.indexOf(current) + 1;
                        const nextState = states[nextIndex];

                        // Immediate update local & DB
                        const updates: Partial<Incident> = { stato_richiesta: nextState as "Pending" | "In gestione" | "Disponibile" | "Evasione" };
                        if (onIncidentUpdate) onIncidentUpdate({ ...incident, ...updates }); // Optimistic

                        const { error } = await supabase.from('incidents').update(updates).eq('numero', incident.numero);
                        if (error) console.error("Status update failed", error);
                      }}
                      className={cn("w-full px-2 py-1.5 text-xs font-bold rounded transition-colors shadow-sm mb-1 uppercase tracking-wider",
                        (incident.stato_richiesta || 'Pending') === 'Pending' ? "bg-slate-700 text-slate-300 hover:bg-slate-600" :
                          (incident.stato_richiesta) === 'In gestione' ? "bg-blue-500/20 text-blue-400 hover:bg-blue-500/30 border border-blue-500/30" :
                            (incident.stato_richiesta) === 'Disponibile' ? "bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 border border-emerald-500/30" :
                              "bg-purple-500/20 text-purple-400 border border-purple-500/30 cursor-not-allowed opacity-80" // Evasione (Disabled style)
                      )}
                      disabled={incident.stato_richiesta === 'Evasione'}
                    >
                      {incident.stato_richiesta || 'Pending'}
                    </button>
                  )}

                  <button
                    onClick={() => {
                      console.log("Saving parts:", selectedParts, "Device:", isDeviceRequested);
                      handlePartsSave();
                    }}
                    className="w-full px-2 py-1.5 bg-amber-600 hover:bg-amber-700 text-white text-xs font-medium rounded transition-colors shadow-md flex items-center justify-center gap-1.5"
                  >
                    <Save size={12} /> Salva
                  </button>
                  <div className="text-[9px] text-slate-500 font-mono text-center h-3">
                    {incident.data_richiesta_parti ? `${new Date(incident.data_richiesta_parti).toLocaleDateString()} ${new Date(incident.data_richiesta_parti).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : ''}
                  </div>
                </div>
              </div>
            </div>

            {/* Note LASER Section (Span 9) */}
            <div className="lg:col-span-9">
              <div className="glass-card p-5 border-t-4 border-blue-500/50 h-full flex flex-col">
                <h4 className="text-xs uppercase text-slate-500 font-bold mb-3 tracking-wider flex items-center gap-2">
                  <Edit3 size={14} className="text-blue-400" /> Note LASER
                </h4>

                <div className="flex-1 space-y-4 flex flex-col">
                  {/* History View (Read Only) */}
                  <div className="bg-slate-950 p-4 rounded-xl border border-white/5 flex-1 min-h-[150px] overflow-y-auto custom-scrollbar">
                    <p className="text-xs text-slate-500 mb-2 font-bold uppercase tracking-wider">Storico Note:</p>
                    <div className="text-sm text-slate-300 font-mono whitespace-pre-wrap leading-relaxed">
                      {notesHistory || 'Nessuna nota presente.'}
                    </div>
                  </div>

                  {/* New Note Input */}
                  <div className="bg-slate-900/50 p-4 rounded-xl border border-white/5 relative group mt-auto">
                    <textarea
                      className="w-full bg-transparent border-none focus:ring-0 text-sm text-white placeholder-slate-600 resize-none min-h-[60px]"
                      placeholder="Nuova nota..."
                      id={`new-note-${incident.numero}`}
                    />
                    <div className="flex justify-end mt-2">
                      <button
                        onClick={async () => {
                          const noteInput = document.getElementById(`new-note-${incident.numero}`) as HTMLTextAreaElement;
                          const newText = noteInput.value.trim();
                          if (!newText) return;

                          const timestamp = new Date().toLocaleString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
                          const entry = `[${timestamp}] ${newText}`;

                          // Append to existing
                          const updatedNotes = (notesHistory ? notesHistory + "\n\n" : "") + entry;

                          // Update DB
                          const { error } = await supabase.from('incidents').update({ note_laser: updatedNotes }).eq('numero', incident.numero);

                          if (error) {
                            alert('Errore salvataggio: ' + error.message);
                          } else {
                            // Clear input
                            noteInput.value = '';

                            // 1. Update LOCAL state immediately (Instant Feedback)
                            setNotesHistory(updatedNotes);

                            // 2. Propagate to Parent (for persistence on re-open)
                            if (onIncidentUpdate) {
                              onIncidentUpdate({ ...incident, note_laser: updatedNotes });
                            }
                          }
                        }}
                        className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium rounded-lg transition-colors shadow-md"
                      >
                        Aggiungi
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      {showRaw && <RawDataModal data={incident} onClose={() => setShowRaw(false)} />}
      {showPlanning && <PlanningModal current={incident.pianificazione} onSave={handlePlanningSave} onClose={() => setShowPlanning(false)} />}
    </div>
  );
};

// 3d. Parts Request Table (New for v0.5)
// 3d. Parts Request Table (New for v0.5)
const PartsRequestTable = ({ data, onSelect }: { data: Incident[], onSelect: (inc: Incident) => void }) => {
  // Filter only having parts or device request
  const requests = data.filter(i => i.data_richiesta_parti || i.parti_richieste || i.richiesta_apparato);

  if (requests.length === 0) {
    return (
      <div className="glass-card p-8 flex flex-col items-center justify-center text-center h-96">
        <Settings size={48} className="text-slate-600 mb-4 animate-spin-slow" />
        <h3 className="text-xl font-bold text-slate-300">Nessuna Richiesta</h3>
        <p className="text-slate-500 mt-2 max-w-md">Non ci sono richieste di ricambi o apparati attive al momento.</p>
      </div>
    );
  }

  return (
    <div className="glass-card overflow-hidden">
      <div className="px-6 py-4 border-b border-slate-700/50 flex justify-between items-center bg-slate-800/20">
        <h3 className="font-bold text-slate-200 flex items-center gap-2">
          <Settings size={18} className="text-purple-400" />
          Gestione Richieste Ricambi / Apparati
        </h3>
        <span className="text-xs bg-slate-700 text-slate-300 px-2 py-1 rounded-full">{requests.length} richieste</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="text-xs text-slate-400 border-b border-slate-700/50 bg-slate-900/40">
              <th className="px-4 py-3 font-semibold uppercase tracking-wider">Numero</th>
              <th className="px-4 py-3 font-semibold uppercase tracking-wider">Stato Incident</th>
              <th className="px-4 py-3 font-semibold uppercase tracking-wider">Regione</th>
              <th className="px-4 py-3 font-semibold uppercase tracking-wider">Fornitore</th>
              <th className="px-4 py-3 font-semibold uppercase tracking-wider">Item / Asset</th>
              <th className="px-4 py-3 font-semibold uppercase tracking-wider">Data Richiesta</th>
              <th className="px-4 py-3 font-semibold uppercase tracking-wider text-center">Ricambi?</th>
              <th className="px-4 py-3 font-semibold uppercase tracking-wider text-center">Apparato?</th>
              <th className="px-4 py-3 font-semibold uppercase tracking-wider">Stato Richiesta</th>
            </tr>
          </thead>
          <tbody className="text-sm divide-y divide-slate-700/30">
            {requests.map(inc => (
              <tr key={inc.numero} onClick={() => onSelect(inc)} className="hover:bg-slate-700/20 transition-colors group cursor-pointer">
                <td className="px-4 py-3 font-mono text-slate-300 group-hover:text-blue-400">{inc.numero}</td>
                <td className="px-4 py-3">
                  <span className={cn("px-2 py-0.5 rounded text-[10px] font-bold uppercase",
                    inc.stato === 'Aperto' ? 'bg-red-500/10 text-red-500' : 'bg-slate-600/10 text-slate-400'
                  )}>{inc.stato}</span>
                </td>
                <td className="px-4 py-3 text-slate-400">{inc.regione || '-'}</td>
                <td className="px-4 py-3">
                  {inc.fornitore ? (
                    <span className="text-xs bg-amber-500/10 text-amber-500 px-2 py-1 rounded border border-amber-500/20">{inc.fornitore}</span>
                  ) : '-'}
                </td>
                <td className="px-4 py-3 text-slate-400">{inc.item || inc.tag_asset || '-'}</td>
                <td className="px-4 py-3 text-slate-300 font-mono">
                  {inc.data_richiesta_parti ? new Date(inc.data_richiesta_parti).toLocaleDateString() : '-'}
                </td>
                <td className="px-4 py-3 text-center">
                  {inc.parti_richieste ? (
                    <span className="text-xs bg-purple-500/10 text-purple-400 px-2 py-1 rounded border border-purple-500/20">SI ({inc.parti_richieste.split('|').length})</span>
                  ) : <span className="text-slate-600 text-[10px]">-</span>}
                </td>
                <td className="px-4 py-3 text-center">
                  {inc.richiesta_apparato ? (
                    <span className="text-xs bg-amber-500/10 text-amber-400 px-2 py-1 rounded border border-amber-500/20">SI</span>
                  ) : <span className="text-slate-600 text-[10px]">-</span>}
                </td>
                <td className="px-4 py-3">
                  <span className={cn("px-2 py-0.5 rounded text-[10px] font-bold uppercase border",
                    inc.stato_richiesta === 'Pending' ? 'bg-slate-500/10 text-slate-400 border-slate-500/20' :
                      inc.stato_richiesta === 'In gestione' ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' :
                        inc.stato_richiesta === 'Disponibile' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
                          'bg-purple-500/10 text-purple-400 border-purple-500/10'
                  )}>
                    {inc.stato_richiesta || 'PENDING'}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

const IncidentTable = ({ data, onSelect }: { data: Incident[], onIncidentUpdate?: (updated: Incident) => void, onSelect: (inc: Incident) => void }) => {
  const [filter, setFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState<'tutti' | 'backlog' | 'chiusi' | 'violazioni'>('tutti');
  const [page, setPage] = useState(1);
  const pageSize = 12; // Slightly more dense

  // Sync selectedIncident when data updates (e.g. after save)
  // Sync selectedIncident when data updates (e.g. after save) - REMOVED LOCAL SYNC, handled by Parent if needed or Re-render
  // If parent holds state, and 'data' updates, the 'selectedIncident' passed back to Modal should also be updated via App logic if needed.
  // Actually, App needs to know if selectedIncident is stale.
  // We'll handle that in App or just let it close/refresh.

  // ... (useMemo etc remains same) ...
  const filteredData = useMemo(() => {
    let res = data;
    if (statusFilter === 'backlog') res = res.filter(i => ['Aperto', 'In Corso', 'In Lavorazione', 'Sospeso', 'Suspended'].includes(i.stato || ''));
    else if (statusFilter === 'chiusi') res = res.filter(i => ['Chiuso', 'Closed'].includes(i.stato || ''));
    else if (statusFilter === 'violazioni') res = res.filter(i => isSlaBreach(i.violazione_avvenuta));

    if (!filter) return res;
    const lower = filter.toLowerCase();
    return res.filter(i =>
      i.numero.toLowerCase().includes(lower) ||
      (i.regione && i.regione.toLowerCase().includes(lower)) ||
      (i.citta && i.citta.toLowerCase().includes(lower)) ||
      (i.item && i.item.toLowerCase().includes(lower))
    );
  }, [data, filter, statusFilter]);

  useEffect(() => { setPage(1); }, [filter, statusFilter]);

  const paginatedData = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredData.slice(start, start + pageSize);
  }, [filteredData, page]);

  const totalPages = Math.ceil(filteredData.length / pageSize);

  const exportCSV = () => {
    const ws = XLSX.utils.json_to_sheet(filteredData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Incidents");
    XLSX.writeFile(wb, "export_incidents.xlsx");
  };

  return (
    <div className="glass-card p-6">
      {/* ... (Header/Filters remain same) ... */}
      <div className="flex flex-col gap-4 mb-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {['tutti', 'backlog', 'chiusi', 'violazioni'].map((s) => (
            <div key={s} onClick={() => setStatusFilter(s as any)} className={cn("p-3 rounded-xl border cursor-pointer transition-all flex items-center justify-center font-medium uppercase text-xs tracking-wider", statusFilter === s ? "bg-blue-500/20 border-blue-500 text-white shadow-lg shadow-blue-500/10" : "bg-white/5 border-white/5 text-slate-400 hover:bg-white/10 hover:border-white/10")}>{s}</div>
          ))}
        </div>
        <div className="flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="relative w-full md:w-1/3">
            <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none"><Search size={16} className="text-slate-400" /></div>
            <input type="text" className="bg-slate-900/50 border border-white/10 text-white text-sm rounded-xl focus:ring-blue-500/50 focus:border-blue-500/50 block w-full pl-10 p-3 placeholder-slate-500 backdrop-blur-sm transition-all" placeholder="Cerca..." value={filter} onChange={e => setFilter(e.target.value)} />
          </div>
          <button onClick={exportCSV} className="flex items-center px-4 py-2.5 text-sm font-medium text-white bg-emerald-600/80 hover:bg-emerald-600 rounded-xl transition-all shadow-lg hover:shadow-emerald-500/20 backdrop-blur-sm"><Download size={16} className="mr-2" /> Export XLSX</button>
        </div>
      </div>

      <div className="overflow-x-auto rounded-lg border border-white/5">
        <table className="w-full text-xs text-left text-slate-300 whitespace-nowrap">
          <thead className="text-[10px] text-slate-400 uppercase bg-slate-900/60 font-semibold tracking-wider">
            <tr>
              <th className="px-3 py-1.5">Numero</th>
              <th className="px-3 py-1.5">Stato</th>
              <th className="px-3 py-1.5 text-center">SLA</th>
              <th className="px-3 py-1.5">Item</th>
              <th className="px-3 py-1.5">Regione</th>
              <th className="px-3 py-1.5">Città</th>
              <th className="px-3 py-1.5">Apertura</th>
              <th className="px-3 py-1.5">Riassegnazione</th>
              <th className="px-3 py-1.5 text-right">Pianificazione</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {paginatedData.map((row) => (
              <tr key={row.numero} className="bg-transparent hover:bg-white/5 transition-colors cursor-pointer group" onClick={() => onSelect(row)}>
                <td className="px-3 py-1.5 font-medium text-white group-hover:text-blue-300 transition-colors">{row.numero}</td>
                <td className="px-3 py-1.5">
                  <span className={cn("px-2 py-0.5 rounded text-[10px] font-bold border uppercase tracking-wider",
                    row.stato === 'Aperto' ? 'bg-red-500/10 text-red-500 border-red-500/20' :
                      (row.stato === 'In Lavorazione' || row.stato === 'In Corso') ? 'bg-purple-500/10 text-purple-400 border-purple-500/20' :
                        row.stato === 'Chiuso' ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' :
                          'bg-yellow-500/10 text-yellow-500 border-yellow-500/20'
                  )}>
                    {row.stato || 'N/A'}
                  </span>
                </td>
                <td className="px-3 py-1.5 text-center">
                  {isSlaBreach(row.violazione_avvenuta) ? <span className="text-red-500 flex justify-center"><AlertTriangle size={14} /></span> : <span className="text-emerald-500/50 flex justify-center"><CheckCircle size={14} /></span>}
                </td>
                <td className="px-3 py-1.5 text-slate-400 max-w-[150px] truncate" title={row.item}>{row.item || '-'}</td>
                <td className="px-3 py-1.5">{row.regione}</td>
                <td className="px-3 py-1.5 text-slate-400 max-w-[120px] truncate" title={row.citta}>{row.citta || '-'}</td>
                <td className="px-3 py-1.5 font-mono text-slate-500">{formatDate(row.data_apertura)}</td>
                <td className="px-3 py-1.5 font-mono text-purple-400">{formatDate(row.data_ultima_riassegnazione)}</td>
                <td className="px-3 py-1.5 text-right font-mono text-amber-500 font-bold">{row.pianificazione ? formatDate(row.pianificazione) : '-'}</td>
              </tr>
            ))}
            {paginatedData.length === 0 && (
              <tr><td colSpan={9} className="text-center py-8 text-slate-500">Nessun dato trovato</td></tr>
            )}
          </tbody>
        </table>
      </div>
      <div className="flex justify-between items-center mt-6 p-2">
        <span className="text-sm text-slate-500">Pagina {page} di {totalPages || 1}</span>
        <div className="inline-flex gap-2">
          <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="flex items-center justify-center px-4 py-2 text-sm font-medium text-white bg-slate-700/50 rounded-lg hover:bg-slate-700 disabled:opacity-50 transition-all"><ChevronLeft size={16} /> Prev</button>
          <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page >= totalPages} className="flex items-center justify-center px-4 py-2 text-sm font-medium text-white bg-slate-700/50 rounded-lg hover:bg-slate-700 disabled:opacity-50 transition-all">Next <ChevronRight size={16} /></button>
        </div>
      </div>

    </div>
  );
};

// 5. Importer
const ImportPage = ({ refreshData }: { refreshData: () => void }) => {
  const [logs, setLogs] = useState<string[]>([]);
  const [processing, setProcessing] = useState(false);

  const addLog = (msg: string) => setLogs(p => [...p, `[${new Date().toLocaleTimeString()}] ${msg}`]);

  const processFile = async (file: File) => {
    addLog(`Reading file: ${file.name}`);

    // Pre-fetch suppliers mapping
    let suppliersMap: Record<string, string> = {};
    const { data: suppliers } = await supabase.from('fornitori').select('*');
    if (suppliers) {
      suppliers.forEach((s: any) => {
        suppliersMap[s.provincia] = s.fornitore;
      });
      addLog(`Loaded ${suppliers.length} suppliers mappings.`);
    }

    const reader = new FileReader();

    reader.onload = async (e) => {
      const data = new Uint8Array(e.target?.result as ArrayBuffer);
      const workbook = XLSX.read(data, { type: 'array' });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      let json: any[] = XLSX.utils.sheet_to_json(worksheet);

      addLog(`Parsed ${json.length} rows.`);

      const processExcelDate = (val: any) => {
        if (!val) return null;
        if (val instanceof Date) return val.toISOString();
        if (typeof val === 'number') {
          // Excel Serial Date -> JS Date
          // (Serial - 25569) * 86400 * 1000
          const date = new Date((val - 25569) * 86400000);
          return date.toISOString();
        }
        return val; // Assume string or compatible format
      };

      // SPECIAL HANDLING: PLANNING IMPORT
      if (file.name.toUpperCase().includes("PIANIFICAZIONI")) {
        addLog("⚠️ Detected Planning Import Mode (Update Only)");
        let updatedCount = 0;
        let skippedCount = 0;
        let errorCount = 0;

        // Process sequentially to be safe
        for (const row of json) {
          const numero = row['Numero'];
          let pianificazione = row['Pianificazione'];

          if (!numero) {
            skippedCount++; continue;
          }

          pianificazione = processExcelDate(pianificazione);

          if (pianificazione) {
            const { error } = await supabase
              .from('incidents')
              .update({ pianificazione: pianificazione })
              .eq('numero', numero);

            if (error) {
              // console.error('Update error', error);
              errorCount++;
            } else {
              updatedCount++;
            }
          } else {
            skippedCount++;
          }
        }
        addLog(`Done! Updated: ${updatedCount}, Skipped/Missing: ${skippedCount}, Errors: ${errorCount}`);
        refreshData();
        setProcessing(false);
        return;
      }

      // Normalization Logic
      let normalizedBuffer: any[] = [];

      const fileNameUpper = file.name.toUpperCase();

      // FILE 1: AAA... MTZ OUT -> Incident con violazione SLA
      if (fileNameUpper.includes('MTZ OUT')) {
        addLog('Detected Type: MTZ OUT (SLA)');
        // Match only on Numero. Fields: Numero, Ora violazione, Violazione avvenuta
        normalizedBuffer = json.map(row => ({
          numero: row['Numero'],
          ora_violazione: processExcelDate(row['Ora violazione']),
          violazione_avvenuta: (() => {
            const v = row['Violazione avvenuta'];
            if (v === true) return true;
            if (!v) return false;
            const s = String(v).toUpperCase().trim();
            return ['VERO', 'TRUE', 'SI', 'YES', '1'].includes(s);
          })()
        }));
      }
      // FILE 2: AAA... MTZ -> PRINCIPALE
      else if (fileNameUpper.includes('MTZ') && !fileNameUpper.includes('OUT')) {
        addLog('Detected Type: MTZ MAIN');
        // Source fields: Numero, Breve descrizione, Stato, Data apertura, etc...
        // Map keys to snake_case db columns if needed, assuming XLSX headers match user spec
        normalizedBuffer = json.map(row => ({
          numero: row['Numero'],
          breve_descrizione: row['Breve descrizione'],
          stato: row['Stato'],
          data_apertura: processExcelDate(row['Data apertura']),
          data_esecuzione: processExcelDate(row['Data di esecuzione']),
          data_pianificazione_intervento: processExcelDate(row['Data di pianificazione intervento']),
          in_carico_a: row['In carico a'],
          beneficiario: row['Beneficiario'],
          indirizzo_intervento: row['Indirizzo di Intervento'],
          recall: row['Recall'],
          data_aggiornamento: processExcelDate(row['Data aggiornamento']),
          item: row['Item'] || row['item'] || row['ITEM'],
          regione: row['Regione'],
          sede_presidiata: row['Sede Presidiata'],
          hw_model: row['HW Model'],
          provincia_stato: row['Provincia/Stato'],
          categoria_manutentiva: row['Categoria Manutentiva'],
          citta: row['Città'],
          asset: row['Asset'],
          serial_number: row['Serial number'],
          data_ultima_riassegnazione: processExcelDate(row['Data Ultima Riassegnazione']),
          ambito: row['Ambito'],
          chiuso: processExcelDate(row['Chiuso']),
          gruppo_assegnazione: row['Gruppo di assegnazione'],
          fornitore: (() => {
            // Auto-assign supplier based on Province matching
            const prov = row['Provincia/Stato'];
            if (!prov) return null;
            // Try exact match first, maybe trim?
            const key = String(prov).trim().toUpperCase();
            return suppliersMap[key] || null;
          })()
        }));
      }
      // FILE 3: POST VENDITA - RENAME REQUIRED
      else if (fileNameUpper.includes('POST VENDITA')) {
        addLog('Detected Type: POST VENDITA');
        // Rules: 1. Numero -> Task, 2. Incidente -> Numero
        normalizedBuffer = json.map(row => ({
          task: row['Numero'],        // Orig 'Numero' is Task
          numero: row['Incidente'],   // Orig 'Incidente' is Numero (Key)
          item: row['Item'] || row['item'] || row['ITEM'],
          nome: row['Nome'],
          tag_asset: row['Tag asset'],
          numero_di_serie: row['Numero di serie'],
          motivo_stato: row['Motivo Stato'],
          note_appuntamento: row['Note appuntamento'],
          chiuso: processExcelDate(row['Chiuso']),
          descrizione_classe_guasto: row['Descrizione classe guasto'],
          descrizione_guasto_effettivo: row['Descrizione guasto effettivo'],
          descrizione: row['Descrizione']
        }));
      }
      // FILE 4 & 5: LDS FILIALI / SEDI
      else if (fileNameUpper.includes('LDS')) {
        addLog('Detected Type: LDS');
        // Rule: Remove row 1 (SheetJS usually handles header row, if row 1 is garbage, we might need manual slice).
        // Assuming user means the header is on row 2, or row 1 is title.
        // If sheet_to_json picked wrong header, we might have bad keys.
        // Assuming standard header row for now.
        // Rename IdTicket -> Numero
        normalizedBuffer = json.map(row => ({
          numero: row['IdTicket'],
          manutentore: row['Manutentore'],
          clone: row['Clone'],
          data_pr_trasf: processExcelDate(row['DataPrTrasf']),
          data_sol_guasto: processExcelDate(row['DataSolGuasto']),
          data_chiusura: processExcelDate(row['DataChiusura']),
          classe_app: row['ClasseApp'],
          servizio_hd: row['ServizioHD'],
          causale: row['Causale'],
          durata: row['Durata'],
          in_sla: row['inSla'],
          dbanca: row['DBANCA'],
          citta: row['Citta'],
          indirizzo: row['Indirizzo'],
          regione: row['Regione'],
          area_metro: row['AreaMetro'],
          descrizione_dipendenza: row['Descrizione_Dipendenza'],
          modello: row['Modello'],
          classe_hw: row['Classe_HW'],
          tipo_apparato: row['Tipo_Apparato']
        }));
      }
      // FILE 5: DISTRIBUZIONE TERRITORIALE (SUPPLIERS)
      else if (fileNameUpper.includes('DISTRIBUZIONE TERRITORIALE')) {
        addLog('Detected Type: DISTRIBUZIONE TERRITORIALE (Suppliers Update)');

        // Map row to supplier object
        const suppliersData = json.map(row => {
          // Try to find province key (could be 'Provincia/Stato', 'provincia stato', etc.)
          const provincia = row['Provincia/Stato'] || row['provincia stato'] || row['Provincia'] || row['provincia'];
          const fornitore = row['Fornitore'] || row['fornitore'];

          if (!provincia || !fornitore) return null;

          return {
            provincia: String(provincia).trim().toUpperCase(),
            fornitore: String(fornitore).trim()
          };
        }).filter(Boolean); // Remove nulls

        addLog(`Found ${suppliersData.length} supplier mappings to update.`);

        if (suppliersData.length > 0) {
          const { error } = await supabase.from('fornitori').upsert(suppliersData, { onConflict: 'provincia' });
          if (error) {
            addLog(`Error updating suppliers: ${error.message}`);
          } else {
            addLog(`Successfully updated ${suppliersData.length} suppliers.`);
          }
        }

        setProcessing(false);
        refreshData(); // Refresh to ensure new mappings are loaded if needed
        return;
      } else {
        addLog('Unknown file type. Skipping.');
        return;
      }

      // Filter invalid rows
      const validRows: any[] = normalizedBuffer.filter(r => r.numero); // Numero is mandatory
      addLog(`Valid rows to upsert: ${validRows.length}`);

      if (validRows.length === 0) return;

      // UPSERT BATCH
      const { error } = await supabase.from('incidents').upsert(validRows, { onConflict: 'numero' });

      if (error) {
        addLog(`ERROR: ${error.message}`);
        console.error(error);
      } else {
        addLog('Success: Data upserted.');
        refreshData();
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setProcessing(true);
    const files = Array.from(e.dataTransfer.files);
    for (const f of files) {
      await processFile(f);
    }
    setProcessing(false);
  };

  return (
    <div className="glass-card p-8 transition-all hover:shadow-[0_0_30px_rgba(59,130,246,0.1)]">
      <h2 className="text-2xl font-bold mb-6 text-white text-center tracking-tight flex items-center justify-center gap-2">
        <Upload className="text-blue-400" />
        Importazione Dati
      </h2>
      <div
        onDragOver={e => e.preventDefault()}
        onDrop={handleDrop}
        className="flex flex-col items-center justify-center w-full h-64 border-2 border-dashed border-slate-600 rounded-2xl cursor-pointer bg-slate-800/30 hover:bg-slate-700/50 hover:border-blue-500/50 transition-all group"
      >
        <div className="flex flex-col items-center justify-center pt-5 pb-6">
          <div className="w-16 h-16 mb-4 rounded-full bg-slate-700/50 flex items-center justify-center group-hover:scale-110 transition-transform">
            <Upload className="w-8 h-8 text-slate-400 group-hover:text-blue-400" />
          </div>
          <p className="mb-2 text-sm text-slate-400"><span className="font-semibold text-white">Clicca per caricare</span> o trascina il file</p>
          <p className="text-xs text-slate-500">XLSX files (MTZ, LDS, PostVendita)</p>
        </div>
        <input type="file" className="hidden" multiple onChange={async e => {
          if (e.target.files) {
            setProcessing(true);
            await Promise.all(Array.from(e.target.files).map(processFile));
            setProcessing(false);
          }
        }} />
      </div>

      <div className="mt-6 p-4 bg-slate-950/80 text-emerald-400 font-mono text-xs rounded-xl h-48 overflow-y-auto border border-white/5 custom-scrollbar shadow-inner">
        {processing && <div className="animate-pulse text-blue-400 mb-2">Processing files...</div>}
        {logs.length === 0 && <div className="text-slate-600 italic">In attesa di log...</div>}
        {logs.map((l, i) => <div key={i} className="mb-1 border-b border-white/5 pb-1 last:border-0">{l}</div>)}
      </div>
    </div>
  )
};

// 6. Settings Page
// 6. Settings Page
const SettingsPage = () => {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingUser, setEditingUser] = useState<UserProfile | null>(null);

  // Fetch users (Admin Only usually, but logic allows Manager view)
  const fetchUsers = async () => {
    setLoading(true);
    const { data, error } = await supabase.from('profiles').select('*').order('email');
    if (error) {
      console.error('Error fetching profiles:', error);
    } else {
      setUsers(data as UserProfile[]);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleSaveUser = async (updated: UserProfile) => {
    const { error } = await supabase
      .from('profiles')
      .update({ role: updated.role, regions: updated.regions })
      .eq('id', updated.id);

    if (error) {
      alert('Errore aggiornamento utente: ' + error.message);
    } else {
      fetchUsers(); // Refresh
      setEditingUser(null);
    }
  };

  return (
    <div className="glass-card p-8 min-h-[500px]">
      <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-2">
        <Settings className="text-blue-400" />
        Impostazioni Generali
      </h2>

      <div className="space-y-8">
        {/* User Management Section */}
        <div className="bg-slate-800/40 rounded-xl border border-white/5 overflow-hidden">
          <div className="px-6 py-4 border-b border-white/5 flex justify-between items-center bg-slate-900/30">
            <h3 className="font-bold text-slate-200">Gestione Utenti</h3>
            <button onClick={fetchUsers} className="text-xs text-blue-400 hover:text-blue-300">Refresh</button>
          </div>

          {loading ? (
            <div className="p-8 text-center text-slate-500">Caricamento utenti...</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="text-xs text-slate-400 uppercase bg-slate-900/50">
                  <tr>
                    <th className="px-6 py-3">Email / Utente</th>
                    <th className="px-6 py-3">Ruolo</th>
                    <th className="px-6 py-3">Regioni Assegnate</th>
                    <th className="px-6 py-3 text-right">Azioni</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {users.map(u => (
                    <tr key={u.id} className="hover:bg-white/5 transition-colors">
                      <td className="px-6 py-4 font-medium text-slate-200">{u.email}</td>
                      <td className="px-6 py-4">
                        <span className={cn("px-2 py-1 rounded text-[10px] font-bold uppercase border",
                          u.role === 'admin' ? 'bg-red-500/10 text-red-400 border-red-500/20' :
                            u.role === 'manager' ? 'bg-purple-500/10 text-purple-400 border-purple-500/20' :
                              u.role === 'responsabile' ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' :
                                'bg-blue-500/10 text-blue-400 border-blue-500/20'
                        )}>
                          {u.role}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-slate-400 text-xs max-w-xs truncate" title={u.regions?.join(', ')}>
                        {u.role === 'responsabile' ? (
                          u.regions && u.regions.length > 0 ? u.regions.join(', ') : <span className="text-red-500 italic">Nessuna</span>
                        ) : (
                          <span className="opacity-30">Tutte (Implicito)</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <button
                          onClick={() => setEditingUser(u)}
                          className="p-1.5 hover:bg-slate-700 rounded-lg text-slate-400 hover:text-white transition-colors"
                        >
                          <Edit3 size={16} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Other Settings Placeholder */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 opacity-60 pointer-events-none grayscale">
          <div className="p-6 rounded-xl bg-slate-800/50 border border-slate-700/50">
            <h3 className="text-lg font-bold text-slate-300 mb-2">Parametri di Sistema</h3>
            <p className="text-sm text-slate-500">Configurazione SLA e timeout sessione.</p>
          </div>
        </div>
      </div>

      {/* Edit User Modal */}
      {editingUser && (
        <UserEditModal
          user={editingUser}
          onClose={() => setEditingUser(null)}
          onSave={handleSaveUser}
        />
      )}
    </div>
  );
};

const UserEditModal = ({ user, onClose, onSave }: { user: UserProfile, onClose: () => void, onSave: (u: UserProfile) => void }) => {
  const [role, setRole] = useState(user.role || 'operatore');
  const [regions, setRegions] = useState<string[]>(user.regions || []);

  const toggleRegion = (reg: string) => {
    setRegions(prev =>
      prev.includes(reg) ? prev.filter(r => r !== reg) : [...prev, reg]
    );
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[70] flex justify-center items-center p-4" onClick={onClose}>
      <div className="bg-[#0f172a] w-full max-w-lg rounded-2xl border border-slate-700 shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="px-6 py-4 border-b border-slate-700 flex justify-between items-center bg-slate-900 top-0 sticky z-10">
          <h3 className="text-lg font-bold text-white">Modifica Utente</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-white"><X size={20} /></button>
        </div>

        <div className="p-6 max-h-[70vh] overflow-y-auto">
          <div className="mb-6">
            <label className="block text-xs uppercase text-slate-500 font-bold mb-2">Utente</label>
            <input disabled value={user.email} className="w-full bg-slate-800 border-none rounded-lg text-slate-400 px-4 py-2 cursor-not-allowed" />
          </div>

          <div className="mb-6">
            <label className="block text-xs uppercase text-slate-500 font-bold mb-2">Ruolo</label>
            <select
              value={role}
              onChange={e => setRole(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg text-white px-4 py-2 focus:ring-2 focus:ring-blue-500 outline-none"
            >
              <option value="admin">Admin</option>
              <option value="manager">Manager</option>
              <option value="responsabile">Responsabile di Zona</option>
              <option value="operatore">Operatore</option>
            </select>
            <p className="text-xs text-slate-500 mt-2">
              {role === 'admin' && "Accesso completo a tutto."}
              {role === 'manager' && "Visualizza tutto ma non può modificare configurazioni."}
              {role === 'responsabile' && "Vede solo gli incident delle regioni assegnate."}
              {role === 'operatore' && "Accesso standard."}
            </p>
          </div>

          {role === 'responsabile' && (
            <div>
              <label className="block text-xs uppercase text-slate-500 font-bold mb-2">Regioni Assegnate</label>
              <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto p-2 bg-slate-900/50 rounded-lg border border-slate-700">
                {REGIONS.map(r => (
                  <label key={r} className="flex items-center space-x-2 text-sm text-slate-300 cursor-pointer hover:bg-white/5 p-1 rounded">
                    <input
                      type="checkbox"
                      checked={regions.includes(r)}
                      onChange={() => toggleRegion(r)}
                      className="rounded bg-slate-700 border-slate-600 text-blue-500 focus:ring-blue-500 focus:ring-offset-slate-900"
                    />
                    <span>{r}</span>
                  </label>
                ))}
              </div>
              <p className="text-xs text-amber-500 mt-2 flex items-center gap-1">
                <AlertTriangle size={12} /> Seleziona almeno una regione per il Responsabile.
              </p>
            </div>
          )}
        </div>

        <div className="p-4 bg-slate-900/50 border-t border-slate-700 flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 text-sm text-slate-400 hover:text-white transition-colors">Annulla</button>
          <button
            onClick={() => onSave({ ...user, role, regions })}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-bold rounded-lg shadow-lg shadow-blue-500/20 transition-all"
          >
            Salva Modifiche
          </button>
        </div>
      </div>
    </div>
  );
};

// --- App Main ---

function App() {
  const [session, setSession] = useState<any>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [view, setView] = useState<ViewMode>('dashboard');
  const [isDark] = useState(true); // Default to Dark Mode
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedIncident, setSelectedIncident] = useState<Incident | null>(null); // Hoisted State for Modal

  // Regional/Status Filters for Dashboard
  const [selectedRegion, setSelectedRegion] = useState<string | null>(null);
  const [selectedStatus, setSelectedStatus] = useState<string | null>(null);

  // Theme
  useEffect(() => {
    if (isDark) document.documentElement.classList.add('dark');
    else document.documentElement.classList.remove('dark');
  }, [isDark]);

  // Auth & Data
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session) fetchProfile(session.user.id);
      else setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session) fetchProfile(session.user.id);
    });

    return () => subscription.unsubscribe();
  }, []);

  const fetchProfile = async (userId: string) => {
    try {
      let { data } = await supabase.from('profiles').select('*').eq('id', userId).single();
      if (data) {
        setUserProfile(data);
        fetchIncidents(data.role, data.regions);
      } else {
        // Fallback: try fetching incidents anyway to test RLS
        fetchIncidents('unknown', []);
      }
    } catch (e: any) {
      console.error(e);
    }
  };

  const fetchIncidents = async (_role: string, _userRegions: string[]) => {
    setLoading(true);
    let allData: any[] = [];
    let page = 0;
    const pageSize = 1000;
    let hasMore = true;

    try {
      while (hasMore) {
        const { data, error } = await supabase
          .from('incidents')
          .select('*')
          .range(page * pageSize, (page + 1) * pageSize - 1);

        if (error) throw error;

        if (data) {
          allData = [...allData, ...data];
          if (data.length < pageSize) {
            hasMore = false;
          } else {
            page++;
          }
        } else {
          hasMore = false;
        }
      }
      setIncidents(allData);
    } catch (error) {
      console.error("Error fetching incidents:", error);
    } finally {
      setLoading(false);
    }
  };

  // Auth Form
  const AuthForm = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [isSignUp, setIsSignUp] = useState(false);
    const [loading, setLoading] = useState(false);

    const handleAuth = async (e: React.FormEvent) => {
      e.preventDefault();
      setLoading(true);
      try {
        const { error } = isSignUp
          ? await supabase.auth.signUp({ email, password })
          : await supabase.auth.signInWithPassword({ email, password });
        if (error) alert(error.message);
        else if (isSignUp) alert("Account created! Check your email or sign in (if confirmation disabled).");
      } finally {
        setLoading(false);
      }
    };

    return (
      <div className="flex items-center justify-center min-h-screen">
        <form onSubmit={handleAuth} className="p-8 glass-card w-96 relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500"></div>
          <h2 className="text-3xl font-bold mb-6 text-white text-center text-glow">{isSignUp ? 'Registrazione' : 'Accesso'}</h2>

          <div className="mb-4">
            <label className="block text-xs text-slate-400 uppercase tracking-wider mb-1">Email</label>
            <input className="w-full p-3 bg-slate-900/50 border border-white/10 rounded-xl text-white focus:ring-2 focus:ring-blue-500/50 outline-none transition-all" type="email" placeholder="nome@azienda.it" value={email} onChange={e => setEmail(e.target.value)} />
          </div>

          <div className="mb-6">
            <label className="block text-xs text-slate-400 uppercase tracking-wider mb-1">Password</label>
            <input className="w-full p-3 bg-slate-900/50 border border-white/10 rounded-xl text-white focus:ring-2 focus:ring-blue-500/50 outline-none transition-all" type="password" placeholder="••••••••" value={password} onChange={e => setPassword(e.target.value)} />
          </div>

          <button disabled={loading} className="w-full p-3 bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 text-white font-semibold rounded-xl shadow-lg shadow-blue-500/20 transition-all transform hover:scale-[1.02] mb-4">
            {loading ? 'Attendi...' : (isSignUp ? 'Registrati' : 'Accedi')}
          </button>

          <div className="text-center">
            <button type="button" onClick={() => setIsSignUp(!isSignUp)} className="text-sm text-slate-400 hover:text-white transition-colors underline decoration-slate-600 hover:decoration-white">
              {isSignUp ? 'Hai già un account? Accedi' : 'Non hai un account? Registrati'}
            </button>
          </div>
        </form>
      </div>
    );
  };

  // Filter Data Globally
  const dashboardData = useMemo(() => {
    let data = incidents;

    // Status Filter
    if (selectedStatus) {
      if (selectedStatus === 'Backlog') {
        data = data.filter(i => ['Aperto', 'In Corso', 'In Lavorazione', 'Sospeso', 'Suspended'].includes(i.stato || ''));
      } else if (selectedStatus === 'In Lavorazione') {
        data = data.filter(i => ['Aperto', 'In Corso', 'In Lavorazione'].includes(i.stato || ''));
      } else if (selectedStatus === 'Sospesi') {
        data = data.filter(i => ['Sospeso', 'Suspended'].includes(i.stato || ''));
      } else if (selectedStatus === 'Chiusi Oggi') {
        data = data.filter(i => isToday(i.chiuso));
      } else if (selectedStatus === 'Aperti Oggi') {
        // User requested Data_ultima_riassegnazione for "Aperti Oggi" context
        data = data.filter(i => isToday(i.data_ultima_riassegnazione));
      } else if (selectedStatus === 'Violazioni SLA') {
        data = data.filter(i => isSlaBreach(i.violazione_avvenuta));
      }
    }

    return data;
  }, [incidents, selectedStatus]);

  const fullyFilteredData = useMemo(() => {
    if (!selectedRegion) return dashboardData;
    return dashboardData.filter(i => i.regione === selectedRegion);
  }, [dashboardData, selectedRegion]);

  // Stats (calculated on RAW incidents or Filtered? Requirement: "Le Card in alto... filtreranno i grafici". The KPIs themselves usually show Total context, but often dashboards allow them to filter.
  // BUT: If I click "In Lavorazione", should "Totale" change to only "In Lavorazione"? Usually no, KPIs act as top-level summary.
  // HOWEVER, if selectedRegion is active, KPIs *should* reflect that region.
  // So KPIs should be based on `incidents` filtered by `selectedRegion` ONLY, but NOT filtered by `selectedStatus` (otherwise clicking one zeroes the others).
  const statsData = useMemo(() => {
    // Filter only by Region for the KPI numbers, so we see context
    if (!selectedRegion) return incidents;
    return incidents.filter(i => i.regione === selectedRegion);
  }, [incidents, selectedRegion]);

  const stats = useMemo(() => {
    // Stats logic: use fullyFilteredData if we want stats to reflect selected region (+ status if selected, but usually stats are 'top level')
    // Actually, user wants "KPI filtreranno i grafici". The KPIs *themselves* usually show totals.
    // If I select "Lombardia", KPIs show Lombardia totals.
    // If I select "Backlog", KPIs.... well, if I click Backlog, the "Closed" card should probably fade or zero out?
    // Let's stick to: KPIs reflect selectedRegion, but NOT selectedStatus (so they remain clickable to switch status).
    // The previous logic was `statsData` = `incidents` filtered by `selectedRegion`. This is correct.
    const total = statsData.length;
    // States: In Lavorazione (legacy: Aperto, In Corso), Sospeso, Chiuso
    const open = statsData.filter(i => ['Aperto', 'In Corso', 'In Lavorazione'].includes(i.stato || '')).length;
    const suspended = statsData.filter(i => ['Sospeso', 'Suspended'].includes(i.stato || '')).length;
    const closed = statsData.filter(i => ['Chiuso', 'Closed'].includes(i.stato || '')).length;

    const slaBreach = statsData.filter(i => isSlaBreach(i.violazione_avvenuta)).length;

    const openedToday = statsData.filter(i => isToday(i.data_ultima_riassegnazione)).length;
    const closedToday = statsData.filter(i => isToday(i.chiuso)).length;

    return { total, open, closed, slaBreach, suspended, openedToday, closedToday };
  }, [statsData]);

  const handleIncidentUpdate = (updatedIncident: Incident) => {
    setIncidents(prev => prev.map(i => i.numero === updatedIncident.numero ? updatedIncident : i));
    // Also update selectedIncident if open
    if (selectedIncident && selectedIncident.numero === updatedIncident.numero) {
      setSelectedIncident(updatedIncident);
    }
  };

  if (!session) return <AuthForm />;

  return (
    <div className={cn("min-h-screen text-slate-900 dark:text-slate-100 selection:bg-blue-500/30 bg-[#dbe4ee] dark:bg-slate-900 transition-colors duration-300", isDark ? 'dark' : '')}>
      <Sidebar
        currentView={view}
        setView={setView}
        isOpen={isSidebarOpen}
        toggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)}
        user={userProfile}
        loading={loading}
      />

      <div className={cn("p-4 transition-all", isSidebarOpen ? "lg:ml-64" : "")}>

        <div className="flex justify-between items-center mb-8">
          <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="p-2 rounded-lg hover:bg-white/5 text-slate-300 hover:text-white transition-colors">
            <Menu />
          </button>
          <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-purple-400 tracking-tight">Maintenance Analytics</h1>
        </div>

        {view === 'dashboard' && (
          <>
            {(selectedRegion || selectedStatus) && (
              <div className="glass-card mb-6 p-4 border-l-4 border-blue-500 bg-blue-500/10 flex justify-between items-center group">
                {/* ... (keep existing) ... */}
                <div className="flex items-center gap-6">
                  {selectedRegion && (
                    <div className="flex items-center">
                      <span className="flex h-3 w-3 relative mr-3">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-3 w-3 bg-blue-500"></span>
                      </span>
                      <p className="text-white text-sm tracking-wide">Regione: <strong className="text-blue-300 ml-1 font-bold">{selectedRegion}</strong></p>
                    </div>
                  )}
                  {selectedStatus && (
                    <div className="flex items-center">
                      <span className="flex h-3 w-3 relative mr-3">
                        <span className="rounded-full h-3 w-3 bg-purple-500"></span>
                      </span>
                      <p className="text-white text-sm tracking-wide">Stato: <strong className="text-purple-300 ml-1 font-bold">{selectedStatus}</strong></p>
                    </div>
                  )}
                </div>
                <div className="flex gap-4">
                  {selectedRegion && <button onClick={() => setSelectedRegion(null)} className="text-xs text-slate-400 hover:text-white hover:underline transition-all">Reset Regione</button>}
                  {selectedStatus && <button onClick={() => setSelectedStatus(null)} className="text-xs text-slate-400 hover:text-white hover:underline transition-all">Reset Stato</button>}
                  <button onClick={() => { setSelectedRegion(null); setSelectedStatus(null); }} className="text-xs font-bold text-red-400 hover:text-red-300 hover:underline transition-all">Reset Tutto</button>
                </div>
              </div>
            )}

            <KPICards stats={stats} selectedStatus={selectedStatus} onStatusSelect={setSelectedStatus} />

            <div className="glass-card mb-8 overflow-hidden flex flex-col">
              <div className="p-6 pb-0">
                <h3 className="text-lg font-semibold mb-4 text-white flex items-center gap-2">
                  <div className="w-1 h-6 bg-blue-500 rounded-full"></div>
                  {selectedStatus ? `Distribuzione ${selectedStatus}` : 'Distribuzione Backlog'}
                  <span className="text-xs font-normal text-slate-500 ml-2">(Seleziona Regione)</span>
                </h3>
              </div>
              <div className="flex-1 overflow-hidden p-2">
                <RegionalStatsTable
                  data={dashboardData}
                  onFilterChange={(region, status) => {
                    setSelectedRegion(region);
                    if (status) setSelectedStatus(status);
                  }}
                />

                {/* Locker Stats Table */}
                <LockerStatsTable data={dashboardData} />
              </div>
            </div>

            {/* NEW: Item Analysis */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
              <div className="glass-card p-6">
                <h3 className="text-lg font-bold text-white mb-6 flex items-center gap-2">
                  <div className="w-1 h-6 bg-blue-500 rounded-full"></div>
                  Asset in Backlog
                </h3>
                <ItemBarChart data={
                  selectedStatus
                    ? fullyFilteredData
                    : fullyFilteredData.filter(i => ['Aperto', 'In Corso', 'In Lavorazione', 'Sospeso', 'Suspended'].includes(i.stato || ''))
                } />
                <p className="text-xs text-center text-slate-500 mt-4 italic">Distribuzione per Tipologia (Backlog)</p>
              </div>

              <div className="glass-card p-6">
                <h3 className="text-lg font-bold text-white mb-6 flex items-center gap-2">
                  <div className="w-1 h-6 bg-red-500 rounded-full"></div>
                  Asset recidivi
                </h3>
                <TopAssetsChart
                  filteredData={fullyFilteredData}
                  historyData={statsData}
                />
                <p className="text-xs text-center text-slate-500 mt-4 italic">Top 10 Asset con più interventi (Ultimi 30gg)</p>
              </div>
            </div>
          </>
        )}

        {view === 'incidents' && <IncidentTable data={incidents} onIncidentUpdate={handleIncidentUpdate} onSelect={setSelectedIncident} />}

        {view === 'requests' && <PartsRequestTable data={incidents} onSelect={setSelectedIncident} />}

        {view === 'import' && <ImportPage refreshData={() => session && fetchProfile(session.user.id)} />}

        {view === 'settings' && <SettingsPage />}
      </div>

      {/* Root Level Modal */}
      {selectedIncident && <IncidentDetailModal incident={selectedIncident} onClose={() => setSelectedIncident(null)} onIncidentUpdate={handleIncidentUpdate} />}
    </div>
  );
}

export default App;

