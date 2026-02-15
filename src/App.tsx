import React, { useState, useEffect, useMemo } from 'react';
import { createClient } from '@supabase/supabase-js';
import { createPortal } from 'react-dom';
import * as XLSX from 'xlsx';

import { LayoutDashboard, FileSpreadsheet, Menu, X, LogOut, AlertTriangle, AlertCircle, Lightbulb, CheckCircle, Clock, Table as TableIcon, Upload, Edit3, Settings, Save, Search, ChevronLeft, ChevronRight, ChevronUp, ChevronDown, Download, CalendarPlus, List, Activity, Monitor, History, BarChart2, Award, TrendingUp, MapPin } from 'lucide-react';
/* import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LabelList
} from 'recharts'; */

import ItalyMap from './components/ItalyMap';
import GhostResolutionModal from './components/GhostResolutionModal';
import InsightListModal from './components/InsightListModal';
import ExecutiveDashboard from './components/ExecutiveDashboard';
import SupplierScorecard from './components/SupplierScorecard';
import TrendAnalysisPage from './components/TrendAnalysisPage';

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
  durata?: number | string; // Duration in minutes
  created_at?: string;
  data_chiusura_prevista?: string; // New field
  pianificazione?: string; // New field for planned intervention date
  note_laser?: string; // New field for operator notes
  data_richiesta_parti?: string;
  parti_richieste?: string;
  richiesta_apparato?: boolean;
  stato_richiesta?: 'Pending' | 'In gestione' | 'Disponibile' | 'Evasione' | 'Bocciato' | 'Annullato' | 'CONSEGNATO';
  ldv?: string;
  data_consegna?: string;
  gruppo_assegnazione?: string; // EUS_LOCKER_LASER_MICROINF_INC or EUS_LASER_MICROINF_INC
  fornitore?: string;
  provincia_stato?: string; // Phase 66: Used for Supplier Lookup
  ora_violazione?: string; // Date of SLA violation
  [key: string]: any; // Allow dynamic access
}

interface UserProfile {
  id: string;
  email: string;
  role: string;
  regions: string[];
  display_name?: string;
}

type ViewMode = 'dashboard' | 'incidents' | 'import' | 'requests' | 'settings' | 'scorecard' | 'trends';

// --- Utils ---
const formatDate = (dateString?: string) => {
  if (!dateString) return '-';
  return new Date(dateString).toLocaleDateString('it-IT', {
    day: '2-digit', month: '2-digit', year: 'numeric'
  });
};

const getWorkingDaysDiff = (startDateStr?: string, endDate: Date = new Date()) => {
  if (!startDateStr) return 0;
  const start = new Date(startDateStr);
  if (isNaN(start.getTime())) return 0;

  // Clone to avoid modifying original
  let current = new Date(start);
  current.setHours(0, 0, 0, 0);
  const end = new Date(endDate);
  end.setHours(0, 0, 0, 0);

  let count = 0;
  while (current < end) {
    // 0 = Sunday, 6 = Saturday
    const day = current.getDay();
    if (day !== 0 && day !== 6) {
      count++;
    }
    current.setDate(current.getDate() + 1);
  }
  return count;
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
  if (['Chiuso', 'Closed', 'Riassegnato'].includes(i.stato || '')) return false;
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
          <div className="flex items-center px-4 py-2">
            <img
              src="/mvs_logo.png"
              alt="MVS Logo"
              className="h-10 w-auto object-contain"
            />
          </div>
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
          <li>
            <a
              href="https://techlab4.vercel.app/"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center p-3 rounded-xl w-full text-left group transition-all duration-300 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/5 hover:text-slate-900 dark:hover:text-white hover:pl-4"
            >
              <FileSpreadsheet size={20} />
              <span className="ml-3">Laboratorio</span>
            </a>
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
              {user.display_name ? (
                <>
                  <p className="text-sm font-semibold text-white truncate">{user.display_name}</p>
                  <p className="text-[10px] text-slate-400 truncate">{user.email}</p>
                </>
              ) : (
                <p className="text-sm font-semibold text-white truncate">{user.email}</p>
              )}
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
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4 mb-6">
      <div
        onClick={() => onStatusSelect(selectedStatus === 'Backlog' ? null : 'Backlog')}
        className={cn("glass-card p-4 relative overflow-hidden group cursor-pointer transition-all duration-300", getActiveClass('Backlog'))}
      >
        <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity">
          <Clock size={40} className="text-white" />
        </div>
        <p className="text-slate-400 text-xs font-medium uppercase tracking-wider mb-1">Backlog Totale</p>
        <h3 className="text-2xl font-bold text-white mb-0.5">{stats.open + stats.suspended}</h3>
        <p className="text-[10px] text-slate-500">In Lavorazione + Sospesi</p>
      </div>

      <div
        onClick={() => onStatusSelect('In Lavorazione')}
        className={cn("glass-card p-4 relative overflow-hidden group cursor-pointer transition-all duration-300", getActiveClass('In Lavorazione'))}
      >
        <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity">
          <LayoutDashboard size={40} className="text-purple-400" />
        </div>
        <p className="text-slate-400 text-xs font-medium uppercase tracking-wider mb-1">In Lavorazione</p>
        <h3 className="text-2xl font-bold text-purple-400 mb-0.5">{stats.open}</h3>
        <p className="text-[10px] text-purple-500/60">Ticket Attivi</p>
      </div>

      <div
        onClick={() => onStatusSelect('Sospesi')}
        className={cn("glass-card p-4 relative overflow-hidden group cursor-pointer transition-all duration-300", getActiveClass('Sospesi'))}
      >
        <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity">
          <Clock size={40} className="text-yellow-400" />
        </div>
        <p className="text-slate-400 text-xs font-medium uppercase tracking-wider mb-1">Sospesi</p>
        <h3 className="text-2xl font-bold text-yellow-400 mb-0.5">{stats.suspended}</h3>
        <p className="text-[10px] text-yellow-500/60">In Attesa</p>
      </div>

      {/* Aperti Oggi */}
      <div
        onClick={() => onStatusSelect('Aperti Oggi')}
        className={cn("glass-card p-4 relative overflow-hidden group cursor-pointer transition-all duration-300", getActiveClass('Aperti Oggi'))}
      >
        <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity">
          <CheckCircle size={40} className="text-sky-400" />
        </div>
        <p className="text-slate-400 text-xs font-medium uppercase tracking-wider mb-1">Aperti Oggi</p>
        <h3 className="text-2xl font-bold text-sky-400 mb-0.5">{stats.openedToday}</h3>
        <p className="text-[10px] text-sky-500/60">Nuovi Ticket</p>
      </div>

      <div
        onClick={() => onStatusSelect('Chiusi Oggi')}
        className={cn("glass-card p-4 relative overflow-hidden group cursor-pointer transition-all duration-300", getActiveClass('Chiusi Oggi'))}
      >
        <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity">
          <CheckCircle size={40} className="text-emerald-400" />
        </div>
        <p className="text-slate-400 text-xs font-medium uppercase tracking-wider mb-1">Chiusi Oggi</p>
        <h3 className="text-2xl font-bold text-emerald-400 mb-0.5">{stats.closedToday}</h3>
        <p className="text-[10px] text-emerald-500/60">Risolti in giornata</p>
      </div>

      <div
        onClick={() => onStatusSelect('Violazioni SLA')}
        className={cn("glass-card p-4 relative overflow-hidden group cursor-pointer transition-all duration-300", getActiveClass('Violazioni SLA'))}
      >
        <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity">
          <AlertTriangle size={40} className="text-red-500" />
        </div>
        <p className="text-slate-400 text-xs font-medium uppercase tracking-wider mb-1">Violazioni SLA</p>
        <h3 className="text-2xl font-bold text-red-500 mb-0.5">{stats.slaBreach}</h3>
        <p className="text-[10px] text-red-500/60">Attenzione Richiesta</p>
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

const RegionalStatsTable = ({ data, onDrillDown }: { data: Incident[], onDrillDown: (title: string, list: Incident[]) => void }) => {
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
              <th className="px-3 py-1.5 min-w-[120px]">Regione</th>
              <th className="px-3 py-1.5 text-right text-slate-300">Backlog</th>
              <th className="px-3 py-1.5 text-right text-yellow-500">Sospesi</th>
              <th className="px-3 py-1.5 text-right text-slate-400">Lockers</th>
              <th className="px-3 py-1.5 text-right text-red-500">Viol. SLA</th>
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
              if (s.backlog === 0) return null;

              const regionIncidents = data.filter(i => (i.regione === s.region));
              const expiringToday = regionIncidents.filter(i => isSlaExpiringToday(i));

              const getBacklog = () => regionIncidents.filter(i => !['Chiuso', 'Closed'].includes(i.stato || ''));
              const getSuspended = () => regionIncidents.filter(i => ['Sospeso', 'Suspended'].includes(i.stato || '') && !['Chiuso', 'Closed'].includes(i.stato || ''));
              const getLockers = () => regionIncidents.filter(i => i.gruppo_assegnazione === 'EUS_LOCKER_LASER_MICROINF_INC' && !['Chiuso', 'Closed'].includes(i.stato || ''));
              const getSlaBreach = () => regionIncidents.filter(i => isSlaBreach(i.violazione_avvenuta) && !['Chiuso', 'Closed'].includes(i.stato || ''));
              const getPlanned = () => regionIncidents.filter(i => i.pianificazione && isToday(i.pianificazione));
              const getOpenedToday = () => regionIncidents.filter(i => isToday(i.data_apertura));
              const getClosedToday = () => regionIncidents.filter(i => isToday(i.chiuso));

              return (
                <tr key={s.region} className="hover:bg-white/5 transition-colors cursor-pointer group">
                  <td className="px-3 py-1.5 font-medium text-white group-hover:text-blue-400 transition-colors"
                    onClick={() => onDrillDown(`Backlog: ${s.region}`, getBacklog())}
                  >{s.region}</td>

                  <td className="px-3 py-1.5 text-right font-bold text-slate-300 bg-slate-500/5 hover:bg-slate-500/20"
                    onClick={() => onDrillDown(`Backlog: ${s.region}`, getBacklog())}
                  >{s.backlog}</td>

                  <td className="px-3 py-1.5 text-right font-bold text-yellow-500 cursor-pointer hover:underline hover:bg-yellow-500/10"
                    onClick={(e) => { e.stopPropagation(); onDrillDown(`Sospesi: ${s.region}`, getSuspended()); }}>{s.suspended}</td>

                  <td className="px-3 py-1.5 text-right font-bold text-slate-400 bg-slate-500/5 hover:bg-slate-500/20"
                    onClick={(e) => { e.stopPropagation(); onDrillDown(`Lockers: ${s.region}`, getLockers()); }}>{s.lockers}</td>

                  <td className="px-3 py-1.5 text-right font-bold text-red-500 cursor-pointer hover:underline hover:bg-red-500/10"
                    onClick={(e) => { e.stopPropagation(); onDrillDown(`Violazioni SLA: ${s.region}`, getSlaBreach()); }}>{s.slaBreach}</td>

                  <td className="px-3 py-1.5 text-right font-bold text-orange-400 cursor-pointer hover:underline hover:bg-orange-500/10"
                    onClick={(e) => { e.stopPropagation(); onDrillDown(`In Scadenza Oggi: ${s.region}`, expiringToday); }}>{expiringToday.length}</td>

                  <td className="px-3 py-1.5 text-right font-bold text-amber-500 cursor-pointer hover:underline hover:bg-amber-500/10"
                    onClick={(e) => { e.stopPropagation(); onDrillDown(`Pianificati Oggi: ${s.region}`, getPlanned()); }}>{s.plannedToday}</td>

                  <td className="px-3 py-1.5 text-right font-mono text-blue-300 border-l border-white/5">{s.openedYesterday}</td>
                  <td className="px-3 py-1.5 text-right font-mono text-emerald-300">{s.closedYesterday}</td>

                  <td className="px-3 py-1.5 text-right font-mono text-cyan-300 border-l border-white/5 cursor-pointer hover:underline hover:bg-cyan-500/10"
                    onClick={(e) => { e.stopPropagation(); onDrillDown(`Aperti Oggi: ${s.region}`, getOpenedToday()); }}>{s.openedToday}</td>

                  <td className="px-3 py-1.5 text-right font-mono text-emerald-400 cursor-pointer hover:underline hover:bg-emerald-500/10"
                    onClick={(e) => { e.stopPropagation(); onDrillDown(`Chiusi Oggi: ${s.region}`, getClosedToday()); }}>{s.closedToday}</td>
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
const LockerStatsTable = ({ data, onDrillDown }: { data: Incident[], onDrillDown: (title: string, list: Incident[]) => void }) => {
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
              <th className="px-3 py-1.5 text-right text-slate-300">Backlog</th>
              <th className="px-3 py-1.5 text-right text-yellow-500">Sospesi</th>
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
              if (s.backlog === 0) return null;

              const cityIncidents = lockerData.filter(i => (i.citta === s.region));
              const expiringToday = cityIncidents.filter(i => isSlaExpiringToday(i));

              const getBacklog = () => cityIncidents.filter(i => !['Chiuso', 'Closed'].includes(i.stato || ''));
              const getSuspended = () => cityIncidents.filter(i => ['Sospeso', 'Suspended'].includes(i.stato || '') && !['Chiuso', 'Closed'].includes(i.stato || ''));
              const getLockers = () => cityIncidents.filter(i => !['Chiuso', 'Closed'].includes(i.stato || '')); // All here are lockers
              const getSlaBreach = () => cityIncidents.filter(i => isSlaBreach(i.violazione_avvenuta) && !['Chiuso', 'Closed'].includes(i.stato || ''));
              const getPlanned = () => cityIncidents.filter(i => i.pianificazione && isToday(i.pianificazione));
              const getOpenedToday = () => cityIncidents.filter(i => isToday(i.data_apertura));
              const getClosedToday = () => cityIncidents.filter(i => isToday(i.chiuso));

              return (
                <tr key={s.region} className="hover:bg-white/5 transition-colors cursor-pointer group">
                  <td className="px-3 py-1.5 font-medium text-white group-hover:text-blue-400 transition-colors"
                    onClick={() => onDrillDown(`Locker Backlog: ${s.region}`, getBacklog())}
                  >{s.region}</td>

                  <td className="px-3 py-1.5 text-right font-bold text-slate-300 bg-slate-500/5 hover:bg-slate-500/20"
                    onClick={() => onDrillDown(`Locker Backlog: ${s.region}`, getBacklog())}
                  >{s.backlog}</td>

                  <td className="px-3 py-1.5 text-right font-bold text-yellow-500 cursor-pointer hover:underline hover:bg-yellow-500/10"
                    onClick={(e) => { e.stopPropagation(); onDrillDown(`Locker Sospesi: ${s.region}`, getSuspended()); }}>{s.suspended}</td>

                  <td className="px-3 py-1.5 text-right font-bold text-slate-400 bg-slate-500/5 hover:bg-slate-500/20"
                    onClick={(e) => { e.stopPropagation(); onDrillDown(`Locker Totali: ${s.region}`, getLockers()); }}>{s.lockers}</td>

                  <td className="px-3 py-1.5 text-right font-bold text-red-500 cursor-pointer hover:underline hover:bg-red-500/10"
                    onClick={(e) => { e.stopPropagation(); onDrillDown(`Locker SLA Violati: ${s.region}`, getSlaBreach()); }}>{s.slaBreach}</td>

                  <td className="px-3 py-1.5 text-right font-bold text-orange-400 cursor-pointer hover:underline hover:bg-orange-500/10"
                    onClick={(e) => { e.stopPropagation(); onDrillDown(`Locker In Scadenza: ${s.region}`, expiringToday); }}>{expiringToday.length}</td>

                  <td className="px-3 py-1.5 text-right font-bold text-amber-500 cursor-pointer hover:underline hover:bg-amber-500/10"
                    onClick={(e) => { e.stopPropagation(); onDrillDown(`Locker Pianificati: ${s.region}`, getPlanned()); }}>{s.plannedToday}</td>

                  <td className="px-3 py-1.5 text-right font-mono text-blue-300 border-l border-white/5">{s.openedYesterday}</td>
                  <td className="px-3 py-1.5 text-right font-mono text-emerald-300">{s.closedYesterday}</td>

                  <td className="px-3 py-1.5 text-right font-mono text-cyan-300 border-l border-white/5 cursor-pointer hover:underline hover:bg-cyan-500/10"
                    onClick={(e) => { e.stopPropagation(); onDrillDown(`Locker Aperti Oggi: ${s.region}`, getOpenedToday()); }}>{s.openedToday}</td>

                  <td className="px-3 py-1.5 text-right font-mono text-emerald-400 cursor-pointer hover:underline hover:bg-emerald-500/10"
                    onClick={(e) => { e.stopPropagation(); onDrillDown(`Locker Chiusi Oggi: ${s.region}`, getClosedToday()); }}>{s.closedToday}</td>
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

// --- Regional SLA Table (New - Phase 33 & 34) ---
const RegionalSLATable = ({ stats }: { stats: any[] }) => {
  // Logic lifted to parent (App)

  const renderCell = (num: number, total: number, target: number) => {
    if (total === 0) return <span className="text-slate-600 font-normal">-</span>;
    const pct = (num / total) * 100;
    const isMet = pct >= target;
    return (
      <div className="flex flex-col items-end leading-none">
        <span className={cn("font-bold text-[11px]", isMet ? "text-emerald-400" : "text-red-500")}>
          {pct.toFixed(1)}%
        </span>
        <span className="text-[9px] text-slate-500 font-normal opacity-70">
          {num}/{total}
        </span>
      </div>
    );
  };

  // Controllo Cell: Display Compliance % (Total - Violations)
  const renderControlloCell = (violations: number, total: number, target: number) => {
    if (total === 0) return <span className="text-slate-600 font-normal">-</span>;
    const compliant = total - violations;
    const pct = (compliant / total) * 100;
    const isMet = pct >= target;
    return (
      <div className="flex flex-col items-end leading-none">
        <span className={cn("font-bold text-[11px]", isMet ? "text-emerald-400" : "text-red-500")}>
          {pct.toFixed(1)}%
        </span>
        <span className="text-[9px] text-slate-500 font-normal opacity-70">
          {compliant}/{total}
        </span>
      </div>
    );
  };

  // Regionale Cell: 100% (Green) if passed (>=80%), 0% (Red) if failed. Empty = Standard dash
  const renderRegionaleCell = (pct: number, total: number) => {
    if (total === 0) return <span className="text-slate-600 font-normal">-</span>;

    const passed = pct >= 80;
    return (
      <div className="flex flex-col items-end leading-none">
        <span className={cn("font-bold text-[11px]", passed ? "text-emerald-400" : "text-red-500")}>
          {passed ? '100.0%' : '0.0%'}
        </span>
        <span className="text-[9px] text-slate-500 font-normal opacity-70">
          {passed ? 'Pass' : 'Fail'}
        </span>
      </div>
    );
  };

  return (
    <div className="glass-card overflow-hidden w-full">
      <div className="p-4 border-b border-white/5 flex justify-between items-center bg-slate-900/50">
        <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
          <Activity size={16} className="text-emerald-400" /> Livelli di Servizio - Regioni
        </h3>
        <span className="text-[10px] text-slate-500 font-mono">Mese Corrente</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="text-[10px] text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-white/5 bg-slate-50 dark:bg-slate-900/60 font-semibold uppercase tracking-wider">
              <th className="px-2 py-1 min-w-[120px]">Regione</th>
              <th className="px-2 py-1 text-right text-slate-300">Compl. Filiali <span className="text-[9px] opacity-50 block font-normal">(Target 80%)</span></th>
              <th className="px-2 py-1 text-right text-slate-300">Compl. Presidi <span className="text-[9px] opacity-50 block font-normal">(Target 80%)</span></th>
              <th className="px-2 py-1 text-right text-slate-300 border-l border-white/5">Controllo Filiali <span className="text-[9px] opacity-50 block font-normal">(Target 99%)</span></th>
              <th className="px-2 py-1 text-right text-slate-300">Controllo Presidi <span className="text-[9px] opacity-50 block font-normal">(Target 99%)</span></th>
              <th className="px-2 py-1 text-right text-slate-300 border-l border-white/5">Regionale Filiali <span className="text-[9px] opacity-50 block font-normal">(Target 100%)</span></th>
              <th className="px-2 py-1 text-right text-slate-300">Regionale Presidi <span className="text-[9px] opacity-50 block font-normal">(Target 100%)</span></th>
            </tr>
          </thead>
          <tbody className="text-xs text-slate-300 divide-y divide-white/5">
            {stats.length === 0 ? (
              <tr><td colSpan={7} className="text-center py-4 text-slate-500 italic text-xs">Nessun dato SLA disponibile per il mese corrente</td></tr>
            ) : (
              stats.map(s => {
                const filPct = s.fil_tot > 0 ? (s.fil_si / s.fil_tot) * 100 : 0;
                const presPct = s.pres_tot > 0 ? (s.pres_si / s.pres_tot) * 100 : 0;
                return (
                  <tr key={s.region} className="hover:bg-white/5 transition-colors">
                    <td className="px-2 py-1 font-medium text-white">{s.region}</td>
                    <td className="px-2 py-1 text-right border-slate-800">{renderCell(s.fil_si, s.fil_tot, 80)}</td>
                    <td className="px-2 py-1 text-right border-slate-800">{renderCell(s.pres_si, s.pres_tot, 80)}</td>
                    <td className="px-2 py-1 text-right border-l border-white/5 border-slate-800 bg-slate-900/20">{renderControlloCell(s.fil_ctrl_viol, s.fil_ctrl_tot, 99)}</td>
                    <td className="px-2 py-1 text-right border-slate-800 bg-slate-900/20">{renderControlloCell(s.pres_ctrl_viol, s.pres_ctrl_tot, 99)}</td>
                    <td className="px-2 py-1 text-right border-l border-white/5 border-slate-800">{renderRegionaleCell(filPct, s.fil_tot)}</td>
                    <td className="px-2 py-1 text-right border-slate-800">{renderRegionaleCell(presPct, s.pres_tot)}</td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

// 3b. Item Analysis Chart
/* const ItemBarChart = ({ data }: { data: Incident[] }) => {
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
}; */

// 3c. Top Recidivist Assets Chart (Last 30 Days)
/* const TopAssetsChart = ({ filteredData, historyData }: { filteredData: Incident[], historyData: Incident[] }) => {
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
            <Bar dataKey="value" fill="#ef4444" radius={[0, 4, 4, 0]}>
              <LabelList dataKey="value" position="right" fill="#e2e8f0" fontSize={11} />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}; */

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
const IncidentDetailModal = ({ incident, onClose, onIncidentUpdate, user }: { incident: Incident, onClose: () => void, onIncidentUpdate?: (updated: Incident) => void, user: UserProfile | null }) => {
  const [showRaw, setShowRaw] = useState(false);
  const [showPlanning, setShowPlanning] = useState(false); // New state for planning modal
  const [notesHistory, setNotesHistory] = useState(incident.note_laser || '');

  // Parts Request State
  const [selectedParts, setSelectedParts] = useState<string[]>(incident.parti_richieste ? incident.parti_richieste.split('|') : []);
  const [isDeviceRequested, setIsDeviceRequested] = useState(incident.richiesta_apparato || false);
  const [ldv, setLdv] = useState(incident.ldv || '');
  const [dataConsegna, setDataConsegna] = useState(incident.data_consegna || '');

  const [confirmAction, setConfirmAction] = useState<'Bocciato' | 'Annullato' | null>(null);

  const handleConfirmAction = async () => {
    if (!confirmAction) return;
    const updates: Partial<Incident> = { stato_richiesta: confirmAction };

    // Optimistic Update
    if (onIncidentUpdate) onIncidentUpdate({ ...incident, ...updates });

    const { error } = await supabase.from('incidents').update(updates).eq('numero', incident.numero);

    if (error) {
      alert('Errore aggiornamento stato: ' + error.message);
      // Revert optimistic? Complex without proper state management, assuming success usually.
    }
    setConfirmAction(null);
  };

  // Sync state if prop changes (e.g. if opened different incident or external update)
  useEffect(() => {
    setNotesHistory(incident.note_laser || '');
    setSelectedParts(incident.parti_richieste ? incident.parti_richieste.split('|') : []);
    setIsDeviceRequested(incident.richiesta_apparato || false);
    setLdv(incident.ldv || '');
    setDataConsegna(incident.data_consegna || '');
  }, [incident.note_laser, incident.parti_richieste, incident.richiesta_apparato, incident.ldv, incident.data_consegna]);

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

    const updates: any = {
      parti_richieste: selectedParts.join('|'),
      richiesta_apparato: isDeviceRequested,
      data_richiesta_parti: timestamp,
      stato_richiesta: incident.stato_richiesta || 'Pending', // Persist current status or default
      ldv: ldv || null,
      data_consegna: dataConsegna || null
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
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex justify-center items-start pt-8 pb-8 px-4 animate-in fade-in duration-200 overflow-y-auto" onClick={onClose}>
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
                  incident.stato === 'Aperto' ? 'bg-slate-500/10 text-slate-300 border-slate-500/20' :
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
                      {['Scheda Madre', 'ADF', 'Display', 'Cassetto', 'Mouse', 'Tastiera', 'Alimentatore', 'Docking'].map(part => (
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
                  {/* LDV & Data Consegna Inputs */}
                  <div className="grid grid-cols-2 gap-2 mb-2">
                    <div>
                      <label className="text-[9px] text-slate-500 uppercase font-bold block mb-1">LDV</label>
                      <input
                        type="text"
                        value={ldv}
                        onChange={(e) => setLdv(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-700 text-xs text-white rounded px-2 py-1 focus:ring-amber-500 focus:border-amber-500"
                        placeholder="Lett. Vettura"
                      />
                    </div>
                    <div>
                      <label className="text-[9px] text-slate-500 uppercase font-bold block mb-1">Data Consegna</label>
                      <input
                        type="date"
                        value={dataConsegna}
                        onChange={(e) => setDataConsegna(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-700 text-xs text-white rounded px-2 py-1 focus:ring-amber-500 focus:border-amber-500"
                      />
                    </div>
                  </div>

                  {/* Status Cycle Button - Only visible after request is saved (timestamp exists) */}
                  {incident.data_richiesta_parti && (
                    <button
                      onClick={async () => {
                        const states = ['Pending', 'In gestione', 'Disponibile', 'Evasione', 'CONSEGNATO'];
                        const current = incident.stato_richiesta || 'Pending';

                        // Terminal state check
                        if (current === 'CONSEGNATO') return;

                        const nextIndex = states.indexOf(current) + 1;
                        const nextState = states[nextIndex];

                        // Validation for CONSEGNATO
                        if (nextState === 'CONSEGNATO' && !dataConsegna) {
                          alert('Devi inserire la Data Consegna prima di impostare lo stato su CONSEGNATO.');
                          return;
                        }

                        // Immediate update local & DB
                        const updates: Partial<Incident> = {
                          stato_richiesta: nextState as any
                        };

                        if (onIncidentUpdate) onIncidentUpdate({ ...incident, ...updates }); // Optimistic

                        const { error } = await supabase.from('incidents').update(updates).eq('numero', incident.numero);
                        if (error) console.error("Status update failed", error);
                      }}
                      className={cn("w-full px-2 py-1.5 text-xs font-bold rounded transition-colors shadow-sm mb-1 uppercase tracking-wider",
                        (incident.stato_richiesta || 'Pending') === 'Pending' ? "bg-slate-700 text-slate-300 hover:bg-slate-600" :
                          (incident.stato_richiesta) === 'In gestione' ? "bg-blue-500/20 text-blue-400 hover:bg-blue-500/30 border border-blue-500/30" :
                            (incident.stato_richiesta) === 'Disponibile' ? "bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 border border-emerald-500/30" :
                              (incident.stato_richiesta) === 'Evasione' ? "bg-purple-500/20 text-purple-400 hover:bg-purple-500/30 border border-purple-500/30" :
                                "bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 cursor-not-allowed opacity-80" // CONSEGNATO
                      )}
                      disabled={incident.stato_richiesta === 'CONSEGNATO' || incident.stato_richiesta === 'Bocciato' || incident.stato_richiesta === 'Annullato'}
                    >
                      {incident.stato_richiesta || 'Pending'}
                    </button>
                  )}

                  {/* Action Buttons (Bocciato / Annullato) - Only if request exists */}
                  {incident.data_richiesta_parti && (
                    <div className="grid grid-cols-2 gap-2 mb-1">
                      <button
                        onClick={() => setConfirmAction('Bocciato')}
                        disabled={incident.stato_richiesta === 'Bocciato'}
                        className={cn("px-2 py-1.5 text-[10px] font-bold uppercase tracking-wider rounded border transition-colors flex items-center justify-center gap-1",
                          incident.stato_richiesta === 'Bocciato'
                            ? "bg-red-500/20 text-red-400 border-red-500/30 cursor-default"
                            : "bg-slate-800 text-slate-400 border-slate-700 hover:bg-red-900/20 hover:text-red-400 hover:border-red-500/30"
                        )}
                      >
                        <X size={12} /> Boccia
                      </button>
                      <button
                        onClick={() => setConfirmAction('Annullato')}
                        disabled={incident.stato_richiesta === 'Annullato'}
                        className={cn("px-2 py-1.5 text-[10px] font-bold uppercase tracking-wider rounded border transition-colors flex items-center justify-center gap-1",
                          incident.stato_richiesta === 'Annullato'
                            ? "bg-slate-500/20 text-slate-300 border-slate-500/30 cursor-default"
                            : "bg-slate-800 text-slate-400 border-slate-700 hover:bg-slate-700 hover:text-white"
                        )}
                      >
                        <LogOut size={12} className="rotate-180" /> Annulla
                      </button>
                    </div>
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
                          const author = user?.display_name || user?.email || 'Utente';
                          const entry = `[${timestamp}] [${author}] ${newText}`;

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

      {/* Confirmation Modal Overlay */}
      {confirmAction && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-[2px] z-[80] flex items-center justify-center p-6 animate-in fade-in duration-200" onClick={() => setConfirmAction(null)}>
          <div className="bg-slate-900 border border-slate-700 p-6 rounded-xl shadow-2xl max-w-sm w-full relative" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-white mb-2 flex items-center gap-2">
              {confirmAction === 'Bocciato' ? <AlertTriangle className="text-red-500" /> : <LogOut className="text-slate-400" />}
              Conferma Azione
            </h3>
            <p className="text-sm text-slate-400 mb-6">
              Sei sicuro di voler impostare lo stato della richiesta a <span className={confirmAction === 'Bocciato' ? "text-red-400 font-bold" : "text-white font-bold"}>{confirmAction}</span>?
              {confirmAction === 'Bocciato' && <span className="block mt-1 text-xs text-red-500/80">Questa azione non è reversibile dal flusso standard.</span>}
            </p>
            <div className="flex justify-end gap-3">
              <button onClick={() => setConfirmAction(null)} className="px-3 py-1.5 text-xs text-slate-400 hover:text-white transition-colors">Annulla</button>
              <button
                onClick={handleConfirmAction}
                className={cn("px-4 py-2 text-sm font-bold rounded-lg shadow-lg transition-colors",
                  confirmAction === 'Bocciato' ? "bg-red-600 hover:bg-red-700 text-white" : "bg-slate-600 hover:bg-slate-500 text-white"
                )}
              >
                Conferma
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// 3d. Parts Request Table (New for v0.5)
// 3d. Parts Request Table (New for v0.5)
const RequestKPICards = ({ stats, selectedStatus, onStatusSelect }: { stats: any, selectedStatus: string | null, onStatusSelect: (s: string | null) => void }) => {
  const getActiveClass = (status: string | null) => {
    if (selectedStatus === status) return "ring-2 ring-white scale-105 shadow-2xl brightness-125";
    if (selectedStatus && selectedStatus !== status) return "opacity-50 blur-[1px] grayscale hover:grayscale-0 hover:opacity-100 hover:blur-none";
    return "";
  };

  return (
    <div className="grid grid-cols-7 gap-2 mb-6 w-full">
      <div
        onClick={() => onStatusSelect(null)}
        className={cn("glass-card p-2 md:p-3 relative overflow-hidden group cursor-pointer transition-all duration-300", !selectedStatus ? "ring-2 ring-white/20" : "opacity-70 hover:opacity-100")}
      >
        <p className="text-slate-400 text-[9px] font-bold uppercase tracking-wider mb-0.5 truncate">Totale</p>
        <h3 className="text-lg md:text-xl font-bold text-white leading-tight">{stats.total}</h3>
      </div>

      <div
        onClick={() => onStatusSelect('Pending')}
        className={cn("glass-card p-2 md:p-3 relative overflow-hidden group cursor-pointer transition-all duration-300", getActiveClass('Pending'))}
      >
        <div className="absolute top-1 right-1 opacity-10"><Clock size={16} className="text-slate-400" /></div>
        <p className="text-slate-400 text-[9px] font-bold uppercase tracking-wider mb-0.5 truncate">Pending</p>
        <h3 className="text-lg md:text-xl font-bold text-slate-400 leading-tight">{stats.pending}</h3>
      </div>

      <div
        onClick={() => onStatusSelect('In gestione')}
        className={cn("glass-card p-2 md:p-3 relative overflow-hidden group cursor-pointer transition-all duration-300", getActiveClass('In gestione'))}
      >
        <div className="absolute top-1 right-1 opacity-10"><Activity size={16} className="text-blue-400" /></div>
        <p className="text-slate-400 text-[9px] font-bold uppercase tracking-wider mb-0.5 truncate">In Gestione</p>
        <h3 className="text-lg md:text-xl font-bold text-blue-400 leading-tight">{stats.ingestione}</h3>
      </div>

      <div
        onClick={() => onStatusSelect('Disponibile')}
        className={cn("glass-card p-2 md:p-3 relative overflow-hidden group cursor-pointer transition-all duration-300", getActiveClass('Disponibile'))}
      >
        <div className="absolute top-1 right-1 opacity-10"><CheckCircle size={16} className="text-emerald-400" /></div>
        <p className="text-slate-400 text-[9px] font-bold uppercase tracking-wider mb-0.5 truncate">Disponibile</p>
        <h3 className="text-lg md:text-xl font-bold text-emerald-400 leading-tight">{stats.disponibile}</h3>
      </div>

      <div
        onClick={() => onStatusSelect('Evasione')}
        className={cn("glass-card p-2 md:p-3 relative overflow-hidden group cursor-pointer transition-all duration-300", getActiveClass('Evasione'))}
      >
        <div className="absolute top-1 right-1 opacity-10"><Settings size={16} className="text-purple-400" /></div>
        <p className="text-slate-400 text-[9px] font-bold uppercase tracking-wider mb-0.5 truncate">Evasione</p>
        <h3 className="text-lg md:text-xl font-bold text-purple-400 leading-tight">{stats.evasione}</h3>
      </div>

      <div
        onClick={() => onStatusSelect('Bocciato')}
        className={cn("glass-card p-2 md:p-3 relative overflow-hidden group cursor-pointer transition-all duration-300", getActiveClass('Bocciato'))}
      >
        <div className="absolute top-1 right-1 opacity-10"><X size={16} className="text-red-400" /></div>
        <p className="text-slate-400 text-[9px] font-bold uppercase tracking-wider mb-0.5 truncate">Bocciato</p>
        <h3 className="text-lg md:text-xl font-bold text-red-500 leading-tight">{stats.bocciato}</h3>
      </div>

      <div
        onClick={() => onStatusSelect('CONSEGNATO')}
        className={cn("glass-card p-2 md:p-3 relative overflow-hidden group cursor-pointer transition-all duration-300", getActiveClass('CONSEGNATO'))}
      >
        <div className="absolute top-1 right-1 opacity-10"><CheckCircle size={16} className="text-cyan-400" /></div>
        <p className="text-slate-400 text-[9px] font-bold uppercase tracking-wider mb-0.5 truncate">Consegnato</p>
        <h3 className="text-lg md:text-xl font-bold text-cyan-400 leading-tight">{stats.consegnato}</h3>
      </div>
    </div>
  );
};

const PartsRequestTable = ({ data, onSelect }: { data: Incident[], onSelect: (inc: Incident) => void }) => {
  const [filter, setFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [sortConfig, setSortConfig] = useState<{ key: string, direction: 'asc' | 'desc' } | null>(null);

  const requestSort = (key: string) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  // 1. Filter: Base (Has Request) AND Not Closed
  const baseData = useMemo(() => {
    return data.filter(i =>
      (i.data_richiesta_parti || i.parti_richieste || i.richiesta_apparato) &&
      !['Chiuso', 'Closed'].includes(i.stato || '')
    );
  }, [data]);

  // 2. Stats Calculation
  const stats = useMemo(() => {
    return {
      total: baseData.length,
      pending: baseData.filter(i => !i.stato_richiesta || i.stato_richiesta === 'Pending').length,
      ingestione: baseData.filter(i => i.stato_richiesta === 'In gestione').length,
      disponibile: baseData.filter(i => i.stato_richiesta === 'Disponibile').length,
      evasione: baseData.filter(i => i.stato_richiesta === 'Evasione').length,
      bocciato: baseData.filter(i => i.stato_richiesta === 'Bocciato').length,
      annullato: baseData.filter(i => i.stato_richiesta === 'Annullato').length,
      consegnato: baseData.filter(i => i.stato_richiesta === 'CONSEGNATO').length,
    };
  }, [baseData]);

  // 3. Final Filtering (Search & Status)
  const filteredRequests = useMemo(() => {
    let res = baseData;

    // Status Filter
    if (statusFilter) {
      if (statusFilter === 'Pending') res = res.filter(i => !i.stato_richiesta || i.stato_richiesta === 'Pending');
      else res = res.filter(i => i.stato_richiesta === statusFilter);
    }

    // Search Filter
    if (filter) {
      const lower = filter.toLowerCase();
      res = res.filter(i =>
        i.numero.toLowerCase().includes(lower) ||
        (i.stato && i.stato.toLowerCase().includes(lower)) ||
        (i.regione && i.regione.toLowerCase().includes(lower)) ||
        (i.fornitore && i.fornitore.toLowerCase().includes(lower)) ||
        (i.item && i.item.toLowerCase().includes(lower)) ||
        (i.tag_asset && i.tag_asset.toLowerCase().includes(lower)) ||
        (i.parti_richieste && i.parti_richieste.toLowerCase().includes(lower)) ||
        (i.stato_richiesta && i.stato_richiesta.toLowerCase().includes(lower)) ||
        (i.data_richiesta_parti && new Date(i.data_richiesta_parti).toLocaleDateString().includes(lower)) ||
        (i.ldv && i.ldv.toLowerCase().includes(lower))
      );
    }



    // Sorting
    if (sortConfig) {
      res.sort((a: any, b: any) => {
        if (a[sortConfig.key] < b[sortConfig.key]) {
          return sortConfig.direction === 'asc' ? -1 : 1;
        }
        if (a[sortConfig.key] > b[sortConfig.key]) {
          return sortConfig.direction === 'asc' ? 1 : -1;
        }
        return 0;
      });
    }

    return res;
  }, [baseData, filter, statusFilter, sortConfig]);

  if (baseData.length === 0) {
    return (
      <div className="glass-card p-8 flex flex-col items-center justify-center text-center h-96">
        <Settings size={48} className="text-slate-600 mb-4 animate-spin-slow" />
        <h3 className="text-xl font-bold text-slate-300">Nessuna Richiesta Attiva</h3>
        <p className="text-slate-500 mt-2 max-w-md">Non ci sono richieste di ricambi o apparati attive per incidenti aperti.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <RequestKPICards stats={stats} selectedStatus={statusFilter} onStatusSelect={setStatusFilter} />

      <div className="glass-card overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-700/50 flex flex-col md:flex-row justify-between items-center gap-4 bg-slate-800/20">
          <h3 className="font-bold text-slate-200 flex items-center gap-2">
            <Settings size={18} className="text-purple-400" />
            Gestione Richieste Ricambi / Apparati
          </h3>

          <div className="relative w-full md:w-64">
            <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none"><Search size={14} className="text-slate-400" /></div>
            <input
              type="text"
              className="bg-slate-900/50 border border-slate-700 text-slate-300 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full pl-9 p-2 placeholder-slate-500"
              placeholder="Cerca richiesta..."
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
            />
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left text-slate-300 whitespace-nowrap border-collapse">
            <thead>
              <tr className="text-xs text-slate-400 border-b border-slate-700/50 bg-slate-900/40">
                <th className="px-4 py-3 font-semibold uppercase tracking-wider cursor-pointer hover:text-white" onClick={() => requestSort('numero')}>
                  <div className="flex items-center gap-1">Numero {sortConfig?.key === 'numero' && (sortConfig.direction === 'asc' ? <ChevronUp size={12} /> : <ChevronDown size={12} />)}</div>
                </th>
                <th className="px-4 py-3 font-semibold uppercase tracking-wider cursor-pointer hover:text-white" onClick={() => requestSort('stato')}>
                  <div className="flex items-center gap-1">Stato {sortConfig?.key === 'stato' && (sortConfig.direction === 'asc' ? <ChevronUp size={12} /> : <ChevronDown size={12} />)}</div>
                </th>
                <th className="px-4 py-3 font-semibold uppercase tracking-wider text-center cursor-pointer hover:text-white" onClick={() => requestSort('violazione_avvenuta')}>
                  <div className="flex items-center justify-center gap-1">SLA {sortConfig?.key === 'violazione_avvenuta' && (sortConfig.direction === 'asc' ? <ChevronUp size={12} /> : <ChevronDown size={12} />)}</div>
                </th>
                <th className="px-4 py-3 font-semibold uppercase tracking-wider cursor-pointer hover:text-white" onClick={() => requestSort('regione')}>
                  <div className="flex items-center gap-1">Regione {sortConfig?.key === 'regione' && (sortConfig.direction === 'asc' ? <ChevronUp size={12} /> : <ChevronDown size={12} />)}</div>
                </th>
                <th className="px-4 py-3 font-semibold uppercase tracking-wider cursor-pointer hover:text-white" onClick={() => requestSort('fornitore')}>
                  <div className="flex items-center gap-1">Fornitore {sortConfig?.key === 'fornitore' && (sortConfig.direction === 'asc' ? <ChevronUp size={12} /> : <ChevronDown size={12} />)}</div>
                </th>
                <th className="px-4 py-3 font-semibold uppercase tracking-wider cursor-pointer hover:text-white" onClick={() => requestSort('item')}>
                  <div className="flex items-center gap-1">Item / Asset {sortConfig?.key === 'item' && (sortConfig.direction === 'asc' ? <ChevronUp size={12} /> : <ChevronDown size={12} />)}</div>
                </th>
                <th className="px-4 py-3 font-semibold uppercase tracking-wider cursor-pointer hover:text-white" onClick={() => requestSort('data_richiesta_parti')}>
                  <div className="flex items-center gap-1">Data Richiesta {sortConfig?.key === 'data_richiesta_parti' && (sortConfig.direction === 'asc' ? <ChevronUp size={12} /> : <ChevronDown size={12} />)}</div>
                </th>
                <th className="px-4 py-3 font-semibold uppercase tracking-wider cursor-pointer hover:text-white" onClick={() => requestSort('ldv')}>
                  <div className="flex items-center gap-1">LDV {sortConfig?.key === 'ldv' && (sortConfig.direction === 'asc' ? <ChevronUp size={12} /> : <ChevronDown size={12} />)}</div>
                </th>
                <th className="px-4 py-3 font-semibold uppercase tracking-wider cursor-pointer hover:text-white" onClick={() => requestSort('data_consegna')}>
                  <div className="flex items-center gap-1">Data Consegna {sortConfig?.key === 'data_consegna' && (sortConfig.direction === 'asc' ? <ChevronUp size={12} /> : <ChevronDown size={12} />)}</div>
                </th>
                <th className="px-4 py-3 font-semibold uppercase tracking-wider text-center cursor-pointer hover:text-white" onClick={() => requestSort('parti_richieste')}>
                  <div className="flex items-center justify-center gap-1">Ricambi? {sortConfig?.key === 'parti_richieste' && (sortConfig.direction === 'asc' ? <ChevronUp size={12} /> : <ChevronDown size={12} />)}</div>
                </th>
                <th className="px-4 py-3 font-semibold uppercase tracking-wider text-center cursor-pointer hover:text-white" onClick={() => requestSort('richiesta_apparato')}>
                  <div className="flex items-center justify-center gap-1">Apparato? {sortConfig?.key === 'richiesta_apparato' && (sortConfig.direction === 'asc' ? <ChevronUp size={12} /> : <ChevronDown size={12} />)}</div>
                </th>
                <th className="px-4 py-3 font-semibold uppercase tracking-wider cursor-pointer hover:text-white" onClick={() => requestSort('stato_richiesta')}>
                  <div className="flex items-center gap-1">Stato Richiesta {sortConfig?.key === 'stato_richiesta' && (sortConfig.direction === 'asc' ? <ChevronUp size={12} /> : <ChevronDown size={12} />)}</div>
                </th>
              </tr>
            </thead>
            <tbody className="text-xs divide-y divide-slate-700/30">
              {filteredRequests.map(inc => (
                <tr key={inc.numero} onClick={() => onSelect(inc)} className="hover:bg-slate-700/20 transition-colors group cursor-pointer">
                  <td className="px-4 py-3 font-mono text-slate-300 group-hover:text-blue-400">{inc.numero}</td>
                  <td className="px-4 py-3">
                    <span className={cn("px-2 py-0.5 rounded text-[10px] font-bold uppercase",
                      inc.stato === 'Aperto' ? 'bg-red-500/10 text-red-500' : 'bg-slate-600/10 text-slate-400'
                    )}>{inc.stato}</span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    {inc.violazione_avvenuta ? (
                      <span className="text-red-500 flex justify-center" title="Violazione SLA"><AlertTriangle size={14} /></span>
                    ) : (
                      <span className="text-emerald-500/30 flex justify-center" title="SLA OK"><CheckCircle size={14} /></span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-slate-400">{inc.regione || '-'}</td>
                  <td className="px-4 py-3">
                    {inc.fornitore ? (
                      <span className="text-[10px] bg-amber-500/10 text-amber-500 px-2 py-1 rounded border border-amber-500/20">{inc.fornitore}</span>
                    ) : '-'}
                  </td>
                  <td className="px-4 py-3 text-slate-400 text-[10px]">{inc.item || inc.tag_asset || '-'}</td>
                  <td className="px-4 py-3 text-slate-300 font-mono">
                    {inc.data_richiesta_parti ? new Date(inc.data_richiesta_parti).toLocaleDateString() : '-'}
                  </td>
                  <td className="px-4 py-3 text-slate-400 font-mono text-xs">{inc.ldv || '-'}</td>
                  <td className="px-4 py-3 text-slate-400 font-mono text-xs">
                    {inc.data_consegna ? new Date(inc.data_consegna).toLocaleDateString() : '-'}
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
                      (!inc.stato_richiesta || inc.stato_richiesta === 'Pending') ? 'bg-slate-500/10 text-slate-400 border-slate-500/20' :
                        inc.stato_richiesta === 'In gestione' ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' :
                          inc.stato_richiesta === 'Disponibile' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
                            inc.stato_richiesta === 'Evasione' ? 'bg-purple-500/10 text-purple-400 border-purple-500/10' :
                              inc.stato_richiesta === 'CONSEGNATO' ? 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20' :
                                inc.stato_richiesta === 'Bocciato' ? 'bg-red-500/10 text-red-400 border-red-500/10' :
                                  'bg-slate-500/5 text-slate-500 border-slate-500/10' // Annullato
                    )}>
                      {inc.stato_richiesta || 'PENDING'}
                    </span>
                  </td>
                </tr>
              ))}
              {filteredRequests.length === 0 && (
                <tr>
                  <td colSpan={9} className="text-center py-8 text-slate-500 italic">Nessuna richiesta trovata con i filtri attuali.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

const IncidentTable = ({
  data,
  onSelect,
  insightData,
  onSelectInsight,
  selectedInsight,
  insightRules = INSIGHT_RULES // Default for retro compatibility or safety
}: {
  data: Incident[],
  onIncidentUpdate?: (updated: Incident) => void,
  onSelect: (inc: Incident) => void,
  insightData: Incident[],
  onSelectInsight: (ruleId: string | null) => void,
  selectedInsight: string | null,
  insightRules?: InsightRule[]
}) => {
  const [filter, setFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState<'tutti' | 'backlog' | 'in_lavorazione' | 'sospesi' | 'chiusi' | 'violazioni' | 'riassegnati'>('tutti');
  const [page, setPage] = useState(1);
  const pageSize = 50;
  const [sortConfig, setSortConfig] = useState<{ key: keyof Incident, direction: 'asc' | 'desc' } | null>(null);

  const requestSort = (key: keyof Incident) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  // Tooltip State
  const [hoveredIncident, setHoveredIncident] = useState<{ id: string, data: Incident, rect: DOMRect, type: 'main' | 'parts' | 'device' } | null>(null);

  // Stats for Cards
  const stats = useMemo(() => {
    return {
      total: data.length,
      backlog: data.filter(i => ['Aperto', 'In Corso', 'In Lavorazione', 'Sospeso', 'Suspended'].includes(i.stato || '') && !['Chiuso', 'Closed'].includes(i.stato || '')).length,
      in_lavorazione: data.filter(i => ['In Corso', 'In Lavorazione'].includes(i.stato || '')).length,
      suspended: data.filter(i => ['Sospeso', 'Suspended'].includes(i.stato || '')).length,
      closed: data.filter(i => ['Chiuso', 'Closed'].includes(i.stato || '')).length,
      sla_breach: data.filter(i => isSlaBreach(i.violazione_avvenuta)).length,
      riassegnati: data.filter(i => ['Riassegnato'].includes(i.stato || '')).length
    };
  }, [data]);

  const sortData = (data: Incident[], config: { key: keyof Incident, direction: 'asc' | 'desc' }) => {
    return [...data].sort((a: any, b: any) => {
      if (a[config.key] < b[config.key]) {
        return config.direction === 'asc' ? -1 : 1;
      }
      if (a[config.key] > b[config.key]) {
        return config.direction === 'asc' ? 1 : -1;
      }
      return 0;
    });
  };

  const filteredData = useMemo(() => {
    let res = data;
    if (statusFilter === 'backlog') res = res.filter(i => ['Aperto', 'In Corso', 'In Lavorazione', 'Sospeso', 'Suspended'].includes(i.stato || '') && !['Chiuso', 'Closed'].includes(i.stato || ''));
    else if (statusFilter === 'in_lavorazione') res = res.filter(i => ['In Corso', 'In Lavorazione'].includes(i.stato || ''));
    else if (statusFilter === 'sospesi') res = res.filter(i => ['Sospeso', 'Suspended'].includes(i.stato || ''));
    else if (statusFilter === 'chiusi') res = res.filter(i => ['Chiuso', 'Closed'].includes(i.stato || ''));
    else if (statusFilter === 'violazioni') res = res.filter(i => isSlaBreach(i.violazione_avvenuta));
    else if (statusFilter === 'riassegnati') res = res.filter(i => ['Riassegnato'].includes(i.stato || ''));

    // Insight Filter (Specific to this Table, Phase 59)
    if (selectedInsight) {
      const rule = insightRules.find(r => r.id === selectedInsight);
      if (rule) {
        res = res.filter(rule.check);
      }
    }

    if (!filter) return sortConfig ? sortData(res, sortConfig) : res;
    const lower = filter.toLowerCase();
    const filtered = res.filter(i =>
      i.numero.toLowerCase().includes(lower) ||
      (i.regione && i.regione.toLowerCase().includes(lower)) ||
      (i.citta && i.citta.toLowerCase().includes(lower)) ||
      (i.item && i.item.toLowerCase().includes(lower))
    );
    return sortConfig ? sortData(filtered, sortConfig) : filtered;
  }, [data, filter, statusFilter, sortConfig, selectedInsight]);

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
      {/* Filters Cards */}
      <div className="grid grid-cols-7 gap-2 mb-4 w-full">
        <div
          onClick={() => setStatusFilter('tutti')}
          className={cn("glass-card p-2 md:p-3 relative overflow-hidden group cursor-pointer transition-all duration-300", statusFilter === 'tutti' ? "ring-2 ring-white scale-105 shadow-2xl brightness-125" : "opacity-70 hover:opacity-100")}
        >
          <p className="text-slate-400 text-[9px] font-bold uppercase tracking-wider mb-0.5 truncate">Totale</p>
          <h3 className="text-lg md:text-xl font-bold text-white leading-tight">{stats.total}</h3>
        </div>

        <div
          onClick={() => setStatusFilter('backlog')}
          className={cn("glass-card p-2 md:p-3 relative overflow-hidden group cursor-pointer transition-all duration-300", statusFilter === 'backlog' ? "ring-2 ring-white scale-105 shadow-2xl brightness-125" : "opacity-70 hover:opacity-100")}
        >
          <div className="absolute top-1 right-1 opacity-10"><Clock size={16} className="text-slate-400" /></div>
          <p className="text-slate-400 text-[9px] font-bold uppercase tracking-wider mb-0.5 truncate">Backlog Tot</p>
          <h3 className="text-lg md:text-xl font-bold text-slate-300 leading-tight">{stats.backlog}</h3>
        </div>

        <div
          onClick={() => setStatusFilter('in_lavorazione')}
          className={cn("glass-card p-2 md:p-3 relative overflow-hidden group cursor-pointer transition-all duration-300", statusFilter === 'in_lavorazione' ? "ring-2 ring-white scale-105 shadow-2xl brightness-125" : "opacity-70 hover:opacity-100")}
        >
          <div className="absolute top-1 right-1 opacity-10"><Activity size={16} className="text-purple-400" /></div>
          <p className="text-slate-400 text-[9px] font-bold uppercase tracking-wider mb-0.5 truncate">In Lavorazione</p>
          <h3 className="text-lg md:text-xl font-bold text-purple-400 leading-tight">{stats.in_lavorazione}</h3>
        </div>

        <div
          onClick={() => setStatusFilter('sospesi')}
          className={cn("glass-card p-2 md:p-3 relative overflow-hidden group cursor-pointer transition-all duration-300", statusFilter === 'sospesi' ? "ring-2 ring-white scale-105 shadow-2xl brightness-125" : "opacity-70 hover:opacity-100")}
        >
          <div className="absolute top-1 right-1 opacity-10"><Clock size={16} className="text-yellow-400" /></div>
          <p className="text-slate-400 text-[9px] font-bold uppercase tracking-wider mb-0.5 truncate">Sospesi</p>
          <h3 className="text-lg md:text-xl font-bold text-yellow-400 leading-tight">{stats.suspended}</h3>
        </div>

        <div
          onClick={() => setStatusFilter('chiusi')}
          className={cn("glass-card p-2 md:p-3 relative overflow-hidden group cursor-pointer transition-all duration-300", statusFilter === 'chiusi' ? "ring-2 ring-white scale-105 shadow-2xl brightness-125" : "opacity-70 hover:opacity-100")}
        >
          <div className="absolute top-1 right-1 opacity-10"><CheckCircle size={16} className="text-emerald-400" /></div>
          <p className="text-slate-400 text-[9px] font-bold uppercase tracking-wider mb-0.5 truncate">Chiusi</p>
          <h3 className="text-lg md:text-xl font-bold text-emerald-400 leading-tight">{stats.closed}</h3>
        </div>

        <div
          onClick={() => setStatusFilter('violazioni')}
          className={cn("glass-card p-2 md:p-3 relative overflow-hidden group cursor-pointer transition-all duration-300", statusFilter === 'violazioni' ? "ring-2 ring-white scale-105 shadow-2xl brightness-125" : "opacity-70 hover:opacity-100")}
        >
          <div className="absolute top-1 right-1 opacity-10"><AlertTriangle size={16} className="text-red-400" /></div>
          <p className="text-slate-400 text-[9px] font-bold uppercase tracking-wider mb-0.5 truncate">Violazioni SLA</p>
          <h3 className="text-lg md:text-xl font-bold text-red-500 leading-tight">{stats.sla_breach}</h3>
        </div>

        <div
          onClick={() => setStatusFilter('riassegnati')}
          className={cn("glass-card p-2 md:p-3 relative overflow-hidden group cursor-pointer transition-all duration-300", statusFilter === 'riassegnati' ? "ring-2 ring-white scale-105 shadow-2xl brightness-125" : "opacity-70 hover:opacity-100")}
        >
          <div className="absolute top-1 right-1 opacity-10"><LogOut size={16} className="text-indigo-400" /></div>
          <p className="text-slate-400 text-[9px] font-bold uppercase tracking-wider mb-0.5 truncate">Riassegnati</p>
          <h3 className="text-lg md:text-xl font-bold text-indigo-400 leading-tight">{stats.riassegnati}</h3>
        </div>
      </div>

      {/* NEW: Compact Insight Panel (Phase 58) */}
      <InsightPanel data={insightData} onSelectRule={onSelectInsight} selectedRule={selectedInsight} compact={true} rules={insightRules} />

      <div className="flex flex-col md:flex-row justify-between items-center gap-4 mt-6">
        <div className="relative w-full md:w-1/3">
          <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none"><Search size={16} className="text-slate-400" /></div>
          <input type="text" className="bg-slate-900/50 border border-white/10 text-white text-sm rounded-xl focus:ring-blue-500/50 focus:border-blue-500/50 block w-full pl-10 p-3 placeholder-slate-500 backdrop-blur-sm transition-all" placeholder="Cerca..." value={filter} onChange={e => setFilter(e.target.value)} />
        </div>
        <button
          onClick={exportCSV}
          className="p-3 bg-emerald-600/80 hover:bg-emerald-600 rounded-xl transition-all shadow-lg hover:shadow-emerald-500/20 backdrop-blur-sm group"
          title="Export XLSX"
        >
          <Download size={18} className="text-white group-hover:scale-110 transition-transform" />
        </button>
      </div>


      <div className="overflow-x-auto rounded-lg border border-white/5">
        <table className="w-full text-xs text-left text-slate-300 whitespace-nowrap border-collapse">
          <thead>
            <tr className="text-xs text-slate-400 border-b border-slate-700/50 bg-slate-900/40">
              <th className="px-3 py-2 font-semibold uppercase tracking-wider cursor-pointer hover:text-white" onClick={() => requestSort('numero')}>
                <div className="flex items-center gap-1">Numero {sortConfig?.key === 'numero' && (sortConfig.direction === 'asc' ? <ChevronUp size={12} /> : <ChevronDown size={12} />)}</div>
              </th>
              <th className="px-3 py-2 font-semibold uppercase tracking-wider cursor-pointer hover:text-white" onClick={() => requestSort('stato')}>
                <div className="flex items-center gap-1">Stato {sortConfig?.key === 'stato' && (sortConfig.direction === 'asc' ? <ChevronUp size={12} /> : <ChevronDown size={12} />)}</div>
              </th>
              <th className="px-3 py-2 font-semibold uppercase tracking-wider text-center cursor-pointer hover:text-white" onClick={() => requestSort('violazione_avvenuta')}>
                <div className="flex items-center justify-center gap-1">SLA {sortConfig?.key === 'violazione_avvenuta' && (sortConfig.direction === 'asc' ? <ChevronUp size={12} /> : <ChevronDown size={12} />)}</div>
              </th>
              <th className="px-3 py-2 font-semibold uppercase tracking-wider text-center cursor-pointer hover:text-white" onClick={() => requestSort('richiesta_apparato')}>
                <div className="flex items-center justify-center gap-1">Rich. {sortConfig?.key === 'richiesta_apparato' && (sortConfig.direction === 'asc' ? <ChevronUp size={12} /> : <ChevronDown size={12} />)}</div>
              </th>
              <th className="px-3 py-2 font-semibold uppercase tracking-wider cursor-pointer hover:text-white" onClick={() => requestSort('item')}>
                <div className="flex items-center gap-1">Item / Asset {sortConfig?.key === 'item' && (sortConfig.direction === 'asc' ? <ChevronUp size={12} /> : <ChevronDown size={12} />)}</div>
              </th>
              <th className="px-3 py-2 font-semibold uppercase tracking-wider cursor-pointer hover:text-white" onClick={() => requestSort('regione')}>
                <div className="flex items-center gap-1">Regione {sortConfig?.key === 'regione' && (sortConfig.direction === 'asc' ? <ChevronUp size={12} /> : <ChevronDown size={12} />)}</div>
              </th>
              <th className="px-3 py-2 font-semibold uppercase tracking-wider cursor-pointer hover:text-white" onClick={() => requestSort('citta')}>
                <div className="flex items-center gap-1">Città {sortConfig?.key === 'citta' && (sortConfig.direction === 'asc' ? <ChevronUp size={12} /> : <ChevronDown size={12} />)}</div>
              </th>
              <th className="px-3 py-2 font-semibold uppercase tracking-wider cursor-pointer hover:text-white" onClick={() => requestSort('data_apertura')}>
                <div className="flex items-center gap-1">Apertura {sortConfig?.key === 'data_apertura' && (sortConfig.direction === 'asc' ? <ChevronUp size={12} /> : <ChevronDown size={12} />)}</div>
              </th>
              <th className="px-3 py-2 font-semibold uppercase tracking-wider cursor-pointer hover:text-white" onClick={() => requestSort('data_ultima_riassegnazione')}>
                <div className="flex items-center gap-1">Riassegnazione {sortConfig?.key === 'data_ultima_riassegnazione' && (sortConfig.direction === 'asc' ? <ChevronUp size={12} /> : <ChevronDown size={12} />)}</div>
              </th>
              <th className="px-3 py-2 font-semibold uppercase tracking-wider text-right cursor-pointer hover:text-white" onClick={() => requestSort('pianificazione')}>
                <div className="flex items-center justify-end gap-1">Pianificazione {sortConfig?.key === 'pianificazione' && (sortConfig.direction === 'asc' ? <ChevronUp size={12} /> : <ChevronDown size={12} />)}</div>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {paginatedData.map((row) => (
              <tr key={row.numero}
                className={cn("bg-transparent hover:bg-white/5 transition-colors cursor-pointer group",
                  row.stato === 'Riassegnato' ? "opacity-60 grayscale hover:grayscale-0 hover:opacity-100 border-l-2 border-indigo-500/50 pl-2" : ""
                )}
                onClick={() => onSelect(row)}>
                <td
                  className="px-3 py-1.5 font-medium text-white hover:text-blue-300 transition-colors cursor-help"
                  onMouseEnter={(e) => {
                    const rect = e.currentTarget.getBoundingClientRect();
                    setHoveredIncident({ id: row.numero, data: row, rect, type: 'main' });
                  }}
                  onMouseLeave={() => setHoveredIncident(null)}
                >
                  {row.numero}
                </td>
                <td className="px-3 py-1.5">
                  <span className={cn("px-2 py-0.5 rounded text-[10px] font-bold border uppercase tracking-wider",
                    ['Aperto', 'Open', 'New'].includes(row.stato || '') ? 'bg-slate-500/10 text-slate-300 border-slate-500/20' :
                      ['In Lavorazione', 'In Corso', 'WIP', 'Assigned', 'Active'].includes(row.stato || '') ? 'bg-purple-500/10 text-purple-400 border-purple-500/20' :
                        ['Sospeso', 'Suspended', 'Pending'].includes(row.stato || '') ? 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20' :
                          ['Chiuso', 'Closed', 'Resolved'].includes(row.stato || '') ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' :
                            ['Riassegnato'].includes(row.stato || '') ? 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20' :
                              'bg-slate-800 text-slate-500 border-slate-700'
                  )}>
                    {row.stato || 'N/A'}
                  </span>
                </td>
                <td className="px-3 py-1.5 text-center">
                  {isSlaBreach(row.violazione_avvenuta) ? <AlertTriangle size={14} className="text-red-500 mx-auto" /> : <div className="w-3.5 h-3.5 mx-auto rounded-full bg-emerald-500/20 text-emerald-500 flex items-center justify-center"><CheckCircle size={10} /></div>}
                </td>
                <td className="px-3 py-1.5 text-center">
                  {row.richiesta_apparato ? (
                    <div className="flex justify-center" onMouseEnter={(e) => {
                      const rect = e.currentTarget.getBoundingClientRect();
                      setHoveredIncident({ id: row.numero, data: row, rect, type: 'device' });
                    }} onMouseLeave={() => setHoveredIncident(null)}>
                      <Monitor size={14} className="text-red-400 cursor-help" />
                    </div>
                  ) : row.parti_richieste ? (
                    <div className="flex justify-center" onMouseEnter={(e) => {
                      const rect = e.currentTarget.getBoundingClientRect();
                      setHoveredIncident({ id: row.numero, data: row, rect, type: 'parts' });
                    }} onMouseLeave={() => setHoveredIncident(null)}>
                      <Settings size={14} className="text-amber-400 cursor-help" />
                    </div>
                  ) : (
                    <span className="text-slate-600 text-[10px]">-</span>
                  )}
                </td>
                <td className="px-3 py-1.5 text-slate-400 truncate max-w-[150px]" title={row.item}>{row.item || '-'}</td>
                <td className="px-3 py-1.5">{row.regione}</td>
                <td className="px-3 py-1.5 text-slate-400 max-w-[120px] truncate" title={row.citta}>{row.citta || '-'}</td>
                <td className="px-3 py-1.5 font-mono text-slate-500">{formatDate(row.data_apertura)}</td>
                <td className="px-3 py-1.5 font-mono text-purple-400">{formatDate(row.data_ultima_riassegnazione)}</td>
                <td className="px-3 py-1.5 text-right font-mono text-amber-500 font-bold">{row.pianificazione ? formatDate(row.pianificazione) : '-'}</td>
              </tr>
            ))}
            {paginatedData.length === 0 && (
              <tr><td colSpan={11} className="text-center py-8 text-slate-500">Nessun dato trovato</td></tr>
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

      {hoveredIncident && createPortal(
        <div
          className="fixed z-[9999] w-[480px] bg-[#0f172a] border border-slate-600 rounded-xl shadow-2xl overflow-hidden text-left pointer-events-none animate-in fade-in zoom-in-95 duration-100"
          style={{
            top: (hoveredIncident.rect.top + 300 > window.innerHeight)
              ? hoveredIncident.rect.top - 10
              : hoveredIncident.rect.top,
            left: hoveredIncident.rect.right + 10,
            transform: (hoveredIncident.rect.top + 300 > window.innerHeight) ? 'translateY(-100%)' : 'none'
          }}
        >
          <div className="absolute inset-0 bg-slate-900/90 backdrop-blur-sm -z-10" />
          <div className="relative">
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

            {/* PARTS TOOLTIP */}
            {hoveredIncident.type === 'parts' && (
              <>
                <div className="bg-slate-900/95 p-4 border-b border-slate-700/50">
                  <p className="text-[10px] text-amber-500 uppercase font-bold mb-1 flex justify-between items-center">
                    <span>Richiesta Parti</span>
                    <Settings size={12} />
                  </p>
                  <div className="text-xs text-slate-200 leading-relaxed whitespace-normal font-mono bg-slate-800/50 p-2 rounded border border-white/5">
                    {hoveredIncident.data.parti_richieste ? hoveredIncident.data.parti_richieste.split('|').map((p, i) => (
                      <div key={i} className="mb-0.5 last:mb-0 text-amber-200/80">• {p}</div>
                    )) : 'Nessuna parte specificata'}
                  </div>
                </div>
                <div className="p-4 bg-[#0f172a]/95">
                  <p className="text-[10px] text-blue-400 uppercase font-bold mb-2 flex items-center gap-2">
                    <Edit3 size={12} /> Note Incident
                  </p>
                  <div className="text-[11px] text-slate-300 font-mono whitespace-pre-wrap leading-relaxed max-h-[300px] overflow-y-auto custom-scrollbar p-2 bg-slate-900/50 rounded border border-white/5">
                    {hoveredIncident.data.note_laser || 'Nessuna nota.'}
                  </div>
                </div>
              </>
            )}

            {/* DEVICE TOOLTIP */}
            {hoveredIncident.type === 'device' && (
              <div className="bg-slate-900/95 p-4">
                <p className="text-[10px] text-red-500 uppercase font-bold mb-2 flex justify-between items-center">
                  <span>Richiesta Apparato</span>
                  <Monitor size={12} />
                </p>
                <div className="text-sm font-bold text-white mb-4">
                  {hoveredIncident.data.hw_model || 'Modello Non Specificato'}
                </div>
                <div className="pt-3 border-t border-white/5">
                  <p className="text-[10px] text-blue-400 uppercase font-bold mb-2 flex items-center gap-2">
                    <Edit3 size={12} /> Note Incident
                  </p>
                  <div className="text-[11px] text-slate-300 font-mono whitespace-pre-wrap leading-relaxed max-h-[200px] overflow-y-auto custom-scrollbar p-2 bg-slate-900/50 rounded border border-white/5">
                    {hoveredIncident.data.note_laser || 'Nessuna nota.'}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>,
        document.body
      )}

    </div>
  );
};

// 5. Importer
const ImportPage = ({ refreshData, onGhostDetected, onImportReady }: {
  refreshData: () => void,
  onGhostDetected: (ghosts: any[], data: any[]) => void,
  onImportReady: (data: any[]) => void
}) => {
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

      // Special handling for LDS files: Row 1 is title, Row 2 is Header.
      const isLDS = file.name.toUpperCase().includes('LDS');
      let json: any[] = XLSX.utils.sheet_to_json(worksheet, isLDS ? { range: 1 } : undefined);

      addLog(`Parsed ${json.length} rows.`);

      const processExcelDate = (val: any, stripTime = false) => {
        if (!val) return null;
        let dateObj: Date | null = null;

        if (val instanceof Date) {
          dateObj = val;
        } else if (typeof val === 'number') {
          // Excel Serial Date -> JS Date
          // (Serial - 25569) * 86400 * 1000
          dateObj = new Date((val - 25569) * 86400000);
        } else {
          // Try string parsing
          dateObj = new Date(val);
        }

        if (dateObj && !isNaN(dateObj.getTime())) {
          if (stripTime) {
            // Return YYYY-MM-DD
            const y = dateObj.getFullYear();
            const m = String(dateObj.getMonth() + 1).padStart(2, '0');
            const d = String(dateObj.getDate()).padStart(2, '0');
            return `${y}-${m}-${d}`;
          }
          return dateObj.toISOString();
        }
        return val;
      };

      // SPECIAL HANDLING: PLANNING IMPORT
      if (file.name.toUpperCase().includes("PIANIFICAZIONI")) {
        addLog("⚠️ Detected Planning Import Mode (Update Only)");
        let updatedCount = 0;
        let skippedCount = 0;
        let errorCount = 0;

        // Process sequentially to be safe
        for (const row of json) {
          const numero = row['Numero'] || row['numero'];
          let pianificazione = row['Pianificazione'] || row['pianificazione'];

          if (!numero || !pianificazione) {
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
        if (json.length > 0) {
          console.log('DEBUG: Excel Valid Keys:', JSON.stringify(Object.keys(json[0])));
        }
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
          in_sla: row['In SLA'], // ADDED MAPPING
          indirizzo_intervento: row['Indirizzo di Intervento'],
          indirizzo_beneficiario: row['Indirizzo beneficiario'], // NEW MAPPING
          recall: row['Recall'],
          data_aggiornamento: processExcelDate(row['Data aggiornamento']),
          item: row['Item'] || row['item'] || row['ITEM'],
          regione: row['Regione'],
          sede_presidiata: row['Sede Presidiata'],
          hw_model: row['HW Model'],
          provincia_stato: row['Provincia/Stato'],
          categoria_manutentiva: row['Categoria Manutentiva'],
          citta: row['Città'],
          asset: row['Asset'], // Keep existing just in case
          tag_asset: row['Tag_Asset'] || row['Tag Asset'] || row['Asset Tag'] || row['Asset'], // NEW MAPPING (Priority to 'Tag_Asset', then 'Asset Tag', fallback to 'Asset')
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
        // Helper to find ID column
        const findId = (r: any) => r['IdTicket'] || r['ID Ticket'] || r['Numero'] || r['Ticket'] || r['id_ticket'] || r['IDTicket'];

        if (json.length > 0) {
          const firstRow = json[0];
          if (!findId(firstRow)) {
            addLog("⚠️ Warning: Could not find 'IdTicket' or 'Numero' column. Available keys: " + Object.keys(firstRow).join(", "));
          }
        }

        normalizedBuffer = json.map(row => ({
          // Defaults for CREATE (if incident doesn't exist)
          stato: 'Chiuso', // Force status to Closed for LDS-only records
          gruppo_assegnazione: 'EUS_LASER_MICROINF_INC',
          breve_descrizione: 'Incidente importato da LDS - Dati parziali',

          numero: findId(row),
          manutentore: row['Manutentore'],
          clone: row['Clone'],
          data_pr_trasf: processExcelDate(row['DataPrTrasf'], true),
          data_sol_guasto: processExcelDate(row['DataSolGuasto'], true),
          data_chiusura: processExcelDate(row['DataChiusura'], true),

          // Ensure dates are populated for new records to avoid null constraints or logic errors
          // Use DataChiusura as fallback for opening date if missing, to maintain consistency
          data_apertura: processExcelDate(row['DataChiusura'], true), // Fallback

          classe_app: row['ClasseApp'],
          servizio_hd: row['ServizioHD'],
          causale: row['Causale'],
          durata: row['Durata'],
          in_sla: row['inSla'],
          dbanca: row['DBANCA'],
          citta: row['Citta'],
          indirizzo_intervento: row['Indirizzo'], // Mapped to correct DB column
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

      // --- GHOST DETECTION Logic (Phase 68) ---
      // Only for MTZ MAIN files (which define the Backlog)
      if (fileNameUpper.includes('MTZ') && !fileNameUpper.includes('OUT') && validRows.length > 0) {
        addLog('Checking for Ghost Incidents (reassigned externally)...');

        // 1. Get Imported IDs
        const importedIds = new Set(validRows.map(r => r.numero));

        // 2. Fetch DB Candidates (Open/Suspended)
        // We only care about tickets that ARE CURRENTLY in the Backlog but MISSING from the file.
        // Statuses to check: Aperto, In Corso, In Lavorazione, Sospeso, Suspended
        const { data: dbBacklog } = await supabase
          .from('incidents')
          .select('numero, regione, stato, descrizione, breve_descrizione')
          .in('stato', ['Aperto', 'Open', 'In Corso', 'In Lavorazione', 'Sospeso', 'Suspended']);

        if (dbBacklog) {
          const ghosts: any[] = [];
          dbBacklog.forEach(dbItem => {
            // If DB item is NOT in the new file -> It is a Ghost
            if (!importedIds.has(dbItem.numero)) {
              ghosts.push(dbItem);
            }
          });

          if (ghosts.length > 0) {
            addLog(`⚠️ Found ${ghosts.length} Ghost Incidents! Pausing for user review.`);
            // DELEGATE TO APP
            onGhostDetected(ghosts, validRows);
            setProcessing(false);
            return; // EXIT FUNCTION, wait for Modal
          }
        }
      }

      // 4. UPSERT Logic (Standard) via App Delegate
      onImportReady(validRows);
      addLog('Success: Data ready for upsert.');
      refreshData();
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
      console.error('SettingsPage: Error fetching profiles:', error);
    } else {
      setUsers(data as UserProfile[]);
    }
    setLoading(false);
  };

  // --- Region Management (Phase 74) ---
  const [regionSettings, setRegionSettings] = useState<any[]>([]);

  const fetchRegionSettings = async () => {
    const { data, error } = await supabase.from('regions').select('*').order('name');
    if (error) {
      console.error("SettingsPage: Error fetching regions:", error);
    } else {
      setRegionSettings(data || []);
    }
  };

  const toggleRegionVisibility = async (regionName: string, currentVisible: boolean) => {
    const newVal = !currentVisible;
    // Optimistic Update
    setRegionSettings(prev => prev.map(r => r.name === regionName ? { ...r, visible: newVal } : r));

    const { error } = await supabase.from('regions').update({ visible: newVal }).eq('name', regionName);
    if (error) {
      console.error("SettingsPage: Error updating region visibility:", error);
      fetchRegionSettings(); // Revert on error
      alert("Errore aggiornamento regione: " + error.message);
    }
  };

  useEffect(() => {
    fetchUsers();
    fetchRegionSettings();
  }, []);

  const handleSaveUser = async (updated: UserProfile) => {
    const { error } = await supabase
      .from('profiles')
      .update({ role: updated.role, regions: updated.regions, display_name: updated.display_name })
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

        {/* Region Visibility Management (Phase 74) - Table View */}
        <div className="bg-slate-800/40 rounded-xl border border-white/5 overflow-hidden">
          <div className="px-6 py-4 border-b border-white/5 flex justify-between items-center bg-slate-900/30">
            <h3 className="font-bold text-slate-200 flex items-center gap-2">
              <Award size={16} className="text-emerald-400" />
              Gestione Visibilità Regioni
            </h3>
            <button onClick={fetchRegionSettings} className="text-xs text-blue-400 hover:text-blue-300">Refresh</button>
          </div>
          <div className="p-0">
            <div className="p-4 bg-slate-900/20 border-b border-white/5 text-xs text-slate-500">
              Le regioni disabilitate ("Non di Competenza") verranno nascoste nei filtri e segnalate come N.d.C.
            </div>
            <div className="overflow-x-auto max-h-[400px] overflow-y-auto">
              <table className="w-full text-left text-sm">
                <thead className="text-xs text-slate-400 uppercase bg-slate-900/50 sticky top-0 z-10 backdrop-blur-sm">
                  <tr>
                    <th className="px-6 py-3">Regione</th>
                    <th className="px-6 py-3 text-center">Stato</th>
                    <th className="px-6 py-3 text-right">Azione</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {regionSettings.map(r => {
                    const isVisible = r.visible !== false; // Default true (if null)
                    return (
                      <tr key={r.name} className="hover:bg-white/5 transition-colors group">
                        <td className="px-6 py-3 font-medium text-slate-200">{r.name}</td>
                        <td className="px-6 py-3 text-center">
                          <span className={cn("px-2 py-1 rounded text-[10px] font-bold uppercase border inline-flex items-center gap-1",
                            isVisible
                              ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                              : "bg-slate-500/10 text-slate-400 border-slate-500/20"
                          )}>
                            <div className={cn("w-1.5 h-1.5 rounded-full", isVisible ? "bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.5)]" : "bg-slate-500")}></div>
                            {isVisible ? 'Attiva' : 'Disabilitata'}
                          </span>
                        </td>
                        <td className="px-6 py-3 text-right">
                          <button
                            onClick={() => toggleRegionVisibility(r.name, isVisible)}
                            className={cn("px-3 py-1.5 rounded-md text-xs font-bold border transition-all",
                              isVisible
                                ? "bg-slate-800 text-slate-400 border-slate-700 hover:text-red-400 hover:border-red-500/30"
                                : "bg-emerald-600 text-white border-emerald-500 hover:bg-emerald-500 shadow-lg shadow-emerald-500/20"
                            )}
                          >
                            {isVisible ? 'Disabilita' : 'Attiva Regione'}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                  {regionSettings.length === 0 && (
                    <tr>
                      <td colSpan={3} className="px-6 py-8 text-center text-slate-500 italic">
                        Nessuna regione trovata.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
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
  const [displayName, setDisplayName] = useState(user.display_name || '');

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
          <div className="mb-4">
            <label className="block text-xs uppercase text-slate-500 font-bold mb-2">Email (Login)</label>
            <input disabled value={user.email} className="w-full bg-slate-800 border-none rounded-lg text-slate-400 px-4 py-2 cursor-not-allowed text-sm" />
          </div>

          <div className="mb-6">
            <label className="block text-xs uppercase text-slate-500 font-bold mb-2">Nome Utente (Visualizzato)</label>
            <input
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Es. Mario Rossi"
              className="w-full bg-slate-800 border border-slate-700 rounded-lg text-white px-4 py-2 focus:ring-2 focus:ring-blue-500 outline-none placeholder:text-slate-600"
            />
            <p className="text-[10px] text-slate-500 mt-1">Se compilato, verrà mostrato nella sidebar al posto dell'email.</p>
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
            onClick={() => onSave({ ...user, role, regions, display_name: displayName })}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-bold rounded-lg shadow-lg shadow-blue-500/20 transition-all"
          >
            Salva Modifiche
          </button>
        </div>
      </div>
    </div>
  );
};

// --- Insight System ---
type InsightLevel = 'danger' | 'warning' | 'info';

interface InsightRule {
  id: string;
  name: string;
  type: InsightLevel;
  check: (incident: Incident) => boolean;
  message: (count: number) => string;
  icon: React.ElementType;
}

const INSIGHT_RULES: InsightRule[] = [
  {
    id: 'keyword_cassa',
    name: 'Cassa',
    type: 'danger',
    icon: AlertTriangle,
    check: (i) => {
      // Exclude closed
      if (['Chiuso', 'Closed', 'Resolved', 'Annullato'].includes(i.stato || '')) return false;
      const text = (i.breve_descrizione || '' + i.descrizione || '').toLowerCase();
      // "Cassa", "casse", "cassunica"
      return /cass[ae]|cassunica/i.test(text);
    },
    message: (c) => `${c}`
  },
  {
    id: 'lamentele',
    name: 'Lamentele',
    type: 'warning',
    icon: Lightbulb,
    check: (i) => {
      // Exclude closed
      if (['Chiuso', 'Closed', 'Resolved', 'Annullato'].includes(i.stato || '')) return false;
      const text = ((i.breve_descrizione || '') + ' ' + (i.descrizione || '')).toUpperCase();
      // Keywords: explicit "URGENTE", "SOLLECITO", or excessive exclamation marks
      return text.includes('!!!') || text.includes('URGENTE') || text.includes('SOLLECITO');
    },
    message: (c) => `${c}`
  },
  {
    id: 'sla_risk_44',
    name: 'Rischio SLA44',
    type: 'danger',
    icon: AlertCircle,
    check: (i) => {
      if (!i.ora_violazione) return false;
      // Check if open (not closed)
      if (['Chiuso', 'Closed', 'Resolved', 'Annullato'].includes(i.stato || '')) return false;
      return getWorkingDaysDiff(i.ora_violazione) >= 2;
    },
    message: (c) => `${c}`
  },
  {
    id: 'indirizzi_diversi',
    name: 'Indirizzi Diversi',
    type: 'warning',
    icon: MapPin,
    check: (i) => {
      // Exclude closed
      if (['Chiuso', 'Closed', 'Resolved', 'Annullato'].includes(i.stato || '')) return false;

      const addrIntervento = (i.indirizzo_intervento || '').trim().toLowerCase();
      const addrBeneficiario = (i.indirizzo_beneficiario || '').trim().toLowerCase();

      // If one is missing, we can't compare, assume match (return false) or mismatch? 
      // Usually if beneficiario is empty, it's not a mismatch.
      if (!addrIntervento || !addrBeneficiario) return false;

      return addrIntervento !== addrBeneficiario;
    },
    message: (c) => `${c}`
  }
];

const InsightPanel = ({ data, onSelectRule, selectedRule, compact = false, rules, showTitle = true }: { data: Incident[], onSelectRule: (ruleId: string | null) => void, selectedRule: string | null, compact?: boolean, rules: InsightRule[], showTitle?: boolean }) => {
  const activeInsights = useMemo(() => {
    return rules.map(rule => {
      const count = data.filter(rule.check).length;
      return { ...rule, count };
    }).filter(r => r.count > 0);
  }, [data, rules]);

  if (activeInsights.length === 0) return null;

  return (
    <>
      {showTitle && !compact && <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2"><Lightbulb className="text-yellow-400" /> Insights & Suggerimenti</h3>}
      <div className={cn("grid gap-3 mb-4 animate-in slide-in-from-top-4 duration-500", compact ? "grid-cols-2 md:grid-cols-4 lg:grid-cols-6" : "grid-cols-2 md:grid-cols-4 lg:grid-cols-6")}>
        {activeInsights.map(insight => (
          <div
            key={insight.id}
            onClick={() => onSelectRule(selectedRule === insight.id ? null : insight.id)}
            className={cn(
              "relative overflow-hidden cursor-pointer transition-all duration-300 rounded-lg border backdrop-blur-md group select-none flex items-center justify-between",
              compact ? "p-2 h-[42px]" : "p-3",
              selectedRule === insight.id ? "scale-105 shadow-xl ring-2" : "hover:scale-[1.02]",
              insight.type === 'danger'
                ? (selectedRule === insight.id ? "bg-red-500/20 border-red-500 ring-red-400" : "bg-red-500/10 border-red-500/30 hover:bg-red-500/20")
                : (selectedRule === insight.id ? "bg-amber-500/20 border-amber-500 ring-amber-400" : "bg-amber-500/10 border-amber-500/30 hover:bg-amber-500/20")
            )}
          >
            {compact ? (
              // Compact Layout: Single Line (Icon | Title: Count) OR (Title Count | Icon) ? User asked "totale incident e titolo su una sola riga".
              // Let's do: Title (Left) .... Count (Right) or Title (Count)
              // Proposed: Icon (Left) Title (Left) ... Count (Right)
              <>
                <div className="flex items-center gap-2 min-w-0 overflow-hidden">
                  <div className={cn("rounded-full p-1 shrink-0", insight.type === 'danger' ? "bg-red-500/20 text-red-400" : "bg-amber-500/20 text-amber-400")}>
                    <insight.icon size={14} />
                  </div>
                  <span className={cn("text-xs font-bold uppercase truncate", insight.type === 'danger' ? "text-red-400" : "text-amber-400")}>{insight.name}</span>
                </div>
                <span className={cn("text-sm font-bold ml-2", insight.type === 'danger' ? "text-red-100" : "text-amber-100")}>{insight.count}</span>
              </>
            ) : (
              // Standard Layout (Already Refined)
              <>
                <div className="flex items-center justify-between gap-2 w-full">
                  <div className="min-w-0">
                    <h3 className={cn("text-xl font-bold leading-none truncate mb-1",
                      insight.type === 'danger' ? "text-red-100" : "text-amber-100"
                    )}>
                      {insight.message(insight.count)}
                    </h3>
                    <p className={cn("text-[10px] font-bold uppercase tracking-wider truncate",
                      insight.type === 'danger' ? "text-red-400" : "text-amber-400"
                    )}>
                      {insight.name}
                    </p>
                  </div>
                  <div className={cn("p-2 rounded-lg shrink-0",
                    insight.type === 'danger' ? "bg-red-500/20 text-red-400" : "bg-amber-500/20 text-amber-400"
                  )}>
                    <insight.icon size={18} />
                  </div>
                </div>
                <div className="absolute bottom-0 left-0 h-0.5 bg-current opacity-20 w-full" />
                <div className={cn("absolute bottom-0 left-0 h-0.5 transition-all duration-1000",
                  insight.type === 'danger' ? "bg-red-500" : "bg-amber-500"
                )} style={{ width: '100%' }} />
              </>
            )}

            {!compact && (
              <>
                {/* Progress Bar / Indicator for Standard Mode (Already included in fragment above? No, I split it logic-wise) -> Wait, logic above separates content. Progress bar can stay for both or just standard. Let's keep specific style for compact. */}
              </>
            )}
          </div>
        ))}
      </div>
    </>
  );
};



// --- App Main ---



function App() {
  // Insight System (Phase 51)
  const [selectedInsightRule, setSelectedInsightRule] = useState<string | null>(null);
  const [showInsightModal, setShowInsightModal] = useState(false);

  const [session, setSession] = useState<any>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [view, setView] = useState<ViewMode>('dashboard');
  const [isDark] = useState(true); // Default to Dark Mode
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedIncident, setSelectedIncident] = useState<Incident | null>(null);
  const [viewMode, setViewMode] = useState<'operational' | 'executive'>('operational'); // Hoisted State for Modal

  // Phase 66: Region Visibility (Whitelist)
  const [allowedRegions, setAllowedRegions] = useState<Set<string>>(new Set(REGIONS)); // Default to static list until fetched

  // Regional/Status Filters for Dashboard
  const [selectedRegion, setSelectedRegion] = useState<string | null>(null);
  const [selectedStatus, setSelectedStatus] = useState<string | null>(null);
  const [selectedSupplier, setSelectedSupplier] = useState<string | null>(null);

  // Phase 66: Supplier Lookup Map (Provincia -> Fornitore) - Removed unused state
  // const [supplierMap, setSupplierMap] = useState<Map<string, string>>(new Map());

  // Phase 68: Ghost Handling State
  const [isProcessingGhosts, setIsProcessingGhosts] = useState(false);
  const [ghostIncidents, setGhostIncidents] = useState<any[]>([]);
  const [pendingImportData, setPendingImportData] = useState<any[] | null>(null);

  // DrillDown Modal State (Phase 69)
  const [drillDownData, setDrillDownData] = useState<{ title: string, incidents: any[] } | null>(null);

  const handleDrillDown = (title: string, list: any[]) => {
    setDrillDownData({ title, incidents: list });
  };

  // --- Handlers for Ghosts ---
  const ghostDebounce = React.useRef(false);

  const handleGhostDetected = (ghosts: any[], data: any[]) => {
    if (ghostDebounce.current) return;
    ghostDebounce.current = true;
    setTimeout(() => { ghostDebounce.current = false; }, 2000);

    setGhostIncidents(ghosts);
    setPendingImportData(data);
    setIsProcessingGhosts(true);
  };

  const handleImportReady = async (data: any[]) => {
    // Direct Upsert
    const { error } = await supabase.from('incidents').upsert(data, { onConflict: 'numero' });
    if (error) {
      console.error("Import Error", error);
      alert("Errore importazione: " + error.message);
    } else {
      if (session?.user?.id) await fetchProfile(session.user.id);

      // check for auto-snapshot (Phase 43)
      const now = new Date();
      // If it is after 17:00, we assume this is the EOD import.
      if (now.getHours() >= 17) {
        // Trigger SQL function
        const { error: snapError } = await supabase.rpc('generate_daily_snapshot', { target_date: now.toISOString().split('T')[0] });
        if (snapError) console.error("Snapshot Error", snapError);
        else console.log("Daily Snapshot Generated");

        setTimeout(() => alert("Importazione completata e Snapshot Giornaliero generato!"), 100);
      } else {
        setTimeout(() => alert("Importazione completata con successo!"), 100);
      }
    }
  };

  const handleGhostReassign = async (id: string) => {
    const { error } = await supabase.from('incidents').update({ stato: 'Riassegnato' }).eq('numero', id);
    if (!error) setGhostIncidents(prev => prev.filter(g => g.numero !== id));
  };

  const handleGhostReassignAll = async () => {
    const ids = ghostIncidents.map(g => g.numero);
    const { error } = await supabase.from('incidents').update({ stato: 'Riassegnato' }).in('numero', ids);
    if (!error) setGhostIncidents([]);
  };

  const handleGhostClose = () => {
    if (pendingImportData) {
      handleImportReady(pendingImportData);
    }
    setIsProcessingGhosts(false);
    setPendingImportData(null);
  };

  // Theme
  useEffect(() => {
    if (isDark) document.documentElement.classList.add('dark');
    else document.documentElement.classList.remove('dark');
  }, [isDark]);

  // Phase 66: Load Suppliers Reference - Removed unused logic
  // useEffect(() => {
  //   const loadSuppliers = async () => {
  //     try {
  //       const { data } = await supabase.from('fornitori').select('provincia, fornitore');
  //       if (data) {
  //         const map = new Map<string, string>();
  //         data.forEach((row: any) => {
  //           if (row.provincia && row.fornitore) {
  //             map.set(row.provincia.trim().toUpperCase(), row.fornitore);
  //           }
  //         });
  //         // setSupplierMap(map);
  //       }
  //     } catch (e) { console.error("Error loading suppliers:", e); }
  //   };
  //   loadSuppliers();
  // }, []);

  // Auth & Data
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session) fetchProfile(session.user.id);
      else setLoading(false);
    });

    // Phase 66: Fetch Allowed Regions
    const fetchRegions = async () => {
      try {
        const { data } = await supabase.from('regions').select('name, visible');
        if (data) {
          const visibleRegions = new Set<string>();
          data.forEach((r: any) => {
            if (r.visible !== false) { // Default true
              visibleRegions.add(r.name);
            }
          });
          if (visibleRegions.size > 0) setAllowedRegions(visibleRegions);
        }
      } catch (e) { console.error("Error loading regions:", e); }
    };
    fetchRegions();

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
          .in('gruppo_assegnazione', ['EUS_LASER_MICROINF_INC', 'EUS_LOCKER_LASER_MICROINF_INC'])
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
  // --- Insight Logic: Repeated Assets ---
  const repeatedAssets = useMemo(() => {
    const map = new Map<string, number[]>();
    const repeated = new Set<string>();

    // 1. Group dates by Asset
    incidents.forEach(i => {
      if (!i.asset) return;
      const asset = i.asset.trim().toUpperCase();
      // Use data_apertura or created_at
      const dateStr = i.data_apertura || i.created_at;
      if (!dateStr) return;
      const time = new Date(dateStr).getTime();
      if (isNaN(time)) return;

      if (!map.has(asset)) map.set(asset, []);
      map.get(asset)!.push(time);
    });

    // 2. Check for repetitions within 30 days
    map.forEach((dates, asset) => {
      if (dates.length < 2) return;
      dates.sort((a, b) => a - b);

      for (let i = 1; i < dates.length; i++) {
        const diffMs = dates[i] - dates[i - 1];
        const diffDays = diffMs / (1000 * 60 * 60 * 24);
        if (diffDays <= 30) {
          repeated.add(asset);
          break; // Found a repetition, mark asset
        }
      }
    });

    return repeated;
  }, [incidents]);

  // --- Construct Dynamic Rules ---
  const allInsightRules = useMemo(() => {
    const rules = [...INSIGHT_RULES];
    if (repeatedAssets.size > 0) {
      rules.push({
        id: 'repeated_asset',
        name: 'Recidivi',
        type: 'warning',
        icon: History,
        // Only show OPEN tickets that are part of a repetition chain
        check: (i) => {
          if (!i.asset) return false;
          const status = (i.stato || '').trim().toUpperCase();
          // Strict open check
          if (['CHIUSO', 'CLOSED', 'RESOLVED', 'ANNULLATO', 'CANCELED'].includes(status)) return false;
          return repeatedAssets.has(String(i.asset).trim().toUpperCase());
        },
        message: (c) => `${c}`
      });
    }
    return rules;
  }, [repeatedAssets]);

  // Phase 67: N.d.C. Rule (Non di Competenza)
  // This rule must run on RAW data (or data before Whitelist filter)
  const allInsightRulesWithNDC = useMemo(() => {
    const rules = [...allInsightRules];
    // Only add if we have allowedRegions loaded
    if (allowedRegions.size > 0) {
      rules.push({
        id: 'ndc_warning',
        name: 'N.d.C.',
        type: 'danger', // Red Alert
        icon: AlertTriangle,
        check: (i) => {
          // Show if Open AND Region is NOT in allowed list (or explicitly false)
          const status = (i.stato || '').trim().toUpperCase();
          if (['CHIUSO', 'CLOSED', 'RESOLVED', 'ANNULLATO', 'CANCELED'].includes(status)) return false;

          const region = i.regione;
          // If region is missing, or not in allowed set -> It is N.d.C.
          // Note: allowedRegions contains only visible=true regions.
          return !region || !allowedRegions.has(region);
        },
        message: (c) => `${c}`
      });
    }
    return rules;
  }, [allInsightRules, allowedRegions]);

  // Base Data: Filtered by User Selections (Status, Supplier, Region)
  // BUT NOT Filtered by Whitelist (so Insights can see hidden stuff)
  const baseFilteredData = useMemo(() => {
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
        data = data.filter(i => isToday(i.data_ultima_riassegnazione));
      } else if (selectedStatus === 'Violazioni SLA') {
        data = data.filter(i => isSlaBreach(i.violazione_avvenuta));
      }
    }

    // Supplier Filter
    if (selectedSupplier) {
      data = data.filter(i => i.fornitore === selectedSupplier);
    }

    // Region Filter 
    if (selectedRegion) {
      data = data.filter(i => i.regione === selectedRegion);
    }

    return data;
  }, [incidents, selectedStatus, selectedSupplier, selectedRegion]);

  // Dashboard Data: Base Data + WHITELIST (For Maps/Tables)
  const dashboardData = useMemo(() => {
    let data = baseFilteredData;

    // Region Visibility Whitelist (Phase 66)
    if (allowedRegions.size > 0) {
      data = data.filter(i => i.regione && allowedRegions.has(i.regione));
    }

    return data;
  }, [baseFilteredData, allowedRegions]);

  // Insight Filtered Data (Specific for Modal List)
  const insightFilteredData = useMemo(() => {
    // If N.d.C. is selected, we must use baseFilteredData (to see hidden)
    // If other rules, we technically could use dashboardData, but consistent to use baseFilteredData for Insights
    let data = baseFilteredData;

    if (selectedInsightRule) {
      const rule = allInsightRulesWithNDC.find(r => r.id === selectedInsightRule);
      if (rule) {
        data = data.filter(rule.check);
      }
    }
    return data;
  }, [baseFilteredData, selectedInsightRule, allInsightRulesWithNDC]);

  /* const fullyFilteredData = useMemo(() => {
    if (!selectedRegion) return dashboardData;
    return dashboardData.filter(i => i.regione === selectedRegion);
  }, [dashboardData, selectedRegion]); */

  // Stats (calculated on RAW incidents or Filtered? Requirement: "Le Card in alto... filtreranno i grafici". The KPIs themselves usually show Total context, but often dashboards allow them to filter.
  // BUT: If I click "In Lavorazione", should "Totale" change to only "In Lavorazione"? Usually no, KPIs act as top-level summary.
  // HOWEVER, if selectedRegion is active, KPIs *should* reflect that region.
  // So KPIs should be based on `incidents` filtered by `selectedRegion` ONLY, but NOT filtered by `selectedStatus` (otherwise clicking one zeroes the others).
  // The previous logic was `statsData` = `incidents` filtered by `selectedRegion`. This is correct.
  const statsData = useMemo(() => {
    // Filter by Region AND Supplier (Context), but NOT Status (Selector)
    let res = incidents;
    if (selectedRegion) res = res.filter(i => i.regione === selectedRegion);
    if (selectedSupplier) res = res.filter(i => i.fornitore === selectedSupplier);
    return res;
  }, [incidents, selectedRegion, selectedSupplier]);

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
    const closed = statsData.filter(i => ['Chiuso', 'Closed', 'Riassegnato'].includes(i.stato || '')).length;

    const slaBreach = statsData.filter(i => isSlaBreach(i.violazione_avvenuta) && !['Chiuso', 'Closed', 'Riassegnato'].includes(i.stato || '')).length;

    const openedToday = statsData.filter(i => isToday(i.data_ultima_riassegnazione)).length;
    const closedToday = statsData.filter(i => isToday(i.chiuso)).length;

    return { total, open, closed, slaBreach, suspended, openedToday, closedToday };
  }, [statsData]);

  // NEW: State for Map Mode
  const [mapMode, setMapMode] = useState<'SLA' | 'BACKLOG'>('SLA');
  // NEW: State for SLA History (Phase 63)
  const [slaDate, setSlaDate] = useState(new Date());

  // Extract unique Suppliers for Filter UI
  const supplierList = useMemo(() => {
    const s = new Set<string>();
    incidents.forEach(i => {
      if (i.fornitore) s.add(i.fornitore);
    });
    return Array.from(s).sort();
  }, [incidents]);

  // NEW: Calculate Regional Stats for Table AND Map (Lifted Logic)
  const regionalStats = useMemo(() => {
    const data = dashboardData || []; // Use currently available data
    const currentMonth = slaDate.getMonth();
    const currentYear = slaDate.getFullYear();

    // Base Filter: Has in_sla
    // Fix Phase 61: Do NOT filter entire dataset by date. Backlog needs all active tickets.
    // SLA stats need closed in current month.

    const map = new Map<string, {
      region: string;
      fil_si: number; fil_tot: number;
      pres_si: number; pres_tot: number;
      fil_ctrl_viol: number; fil_ctrl_tot: number;
      pres_ctrl_viol: number; pres_ctrl_tot: number;
      backlog: number; // Added for Map
      sla_breach: number; // Added for Map
    }>();

    data.forEach(i => {
      const region = i.regione || 'N/D';
      const normalizedRegion = region; // Pass raw DB name (Map handles normalization now)


      // Filter: Hide "Non di Competenza" (Check Supplier via Map fallback)
      // DISABLED per user request (Step 6822)
      // const supplierName = i.fornitore || supplierMap.get((i.provincia_stato || '').trim().toUpperCase()) || '';
      // if (supplierName.toLowerCase().includes('competen')) return; This caused issues.

      if (!map.has(normalizedRegion)) {
        map.set(normalizedRegion, {
          region: normalizedRegion,
          fil_si: 0, fil_tot: 0,
          pres_si: 0, pres_tot: 0,
          fil_ctrl_viol: 0, fil_ctrl_tot: 0,
          pres_ctrl_viol: 0, pres_ctrl_tot: 0,
          backlog: 0,
          sla_breach: 0
        });
      }
      const s = map.get(normalizedRegion)!;

      const isClosed = ['Chiuso', 'Closed'].includes(i.stato || '');


      // BACKLOG LOGIC (All active)
      if (!isClosed) {
        s.backlog++;
        if (isSlaBreach(i.violazione_avvenuta)) s.sla_breach++;
      }

      // SLA LOGIC (Closed in Current Month)
      let isInReportingPeriod = false;
      if (isClosed && i.data_chiusura) {
        try {
          const d = new Date(i.data_chiusura);
          if (!isNaN(d.getTime()) && d.getMonth() === currentMonth && d.getFullYear() === currentYear) {
            isInReportingPeriod = true;
          }
        } catch (e) { }
      }

      if (isInReportingPeriod) {
        const service = String(i.servizio_hd || '').trim().toUpperCase();
        const slaVal = String(i.in_sla || '').trim().toUpperCase();
        const duration = Number(i.durata);

        // Validate SLA Value (SI/NO only)
        const isValidSla = slaVal === 'SI' || slaVal === 'NO';
        const isSi = slaVal === 'SI';

        // Complessivo (SI / Total)
        if (isValidSla) {
          if (service === 'TECNOFIL') {
            s.fil_tot++;
            if (isSi) s.fil_si++;
          } else if (service === 'TECNODIR') {
            s.pres_tot++;
            if (isSi) s.pres_si++;
          }
        }

        // Controllo (Compliance / Total)
        if (isValidSla) {
          const isViolation = !isNaN(duration) && duration > 2640;
          if (service === 'TECNOFIL') {
            s.fil_ctrl_tot++;
            if (isViolation) s.fil_ctrl_viol++;
          } else if (service === 'TECNODIR') {
            s.pres_ctrl_tot++;
            if (isViolation) s.pres_ctrl_viol++;
          }
        }
      }
    });

    return Array.from(map.values()).sort((a, b) => a.region.localeCompare(b.region));
  }, [dashboardData, slaDate]);

  const handleIncidentUpdate = (updatedIncident: Incident) => {
    setIncidents(prev => prev.map(i => i.numero === updatedIncident.numero ? updatedIncident : i));
    // Also update selectedIncident if open
    if (selectedIncident && selectedIncident.numero === updatedIncident.numero) {
      setSelectedIncident(updatedIncident);
    }
  };

  // Last Update Calculation (Phase 65)
  const lastUpdateDate = useMemo(() => {
    if (incidents.length === 0) return null;
    let maxTime = 0;
    incidents.forEach(i => {
      // Use created_at (import time) or possibly updated_at if we want edits.
      // User asked for "Last update of data file", which typically corresponds to recent `created_at`.
      const t = new Date(i.created_at || '').getTime();
      if (!isNaN(t) && t > maxTime) maxTime = t;
    });
    return maxTime > 0 ? new Date(maxTime) : null;
  }, [incidents]);

  // Phase 71: Backlog Alert Logic
  const snapshotNeeded = useMemo(() => {
    if (!lastUpdateDate) return false;
    const now = new Date();

    // Condition 1: Time is past 17:10
    const isLate = now.getHours() > 17 || (now.getHours() === 17 && now.getMinutes() >= 10);
    if (!isLate) return false;

    // Condition 2: Data is OLD (last update was before today 17:00)
    const todayCutoff = new Date();
    todayCutoff.setHours(17, 0, 0, 0);

    return lastUpdateDate < todayCutoff;
  }, [lastUpdateDate]);

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

        <div className="flex items-center mb-8 gap-4">
          <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="p-2 rounded-lg hover:bg-white/5 text-slate-300 hover:text-white transition-colors">
            <Menu />
          </button>

          <div className="flex flex-col">
            <h1 className="text-3xl font-bold text-slate-200 tracking-tight">Monitor ISP</h1>
            {/* Phase 71: Snapshot Alert */}
            {snapshotNeeded && (
              <div className="flex items-center gap-2 mt-1 animate-pulse">
                <AlertTriangle size={14} className="text-amber-500" />
                <span className="text-xs font-bold text-amber-500 uppercase tracking-wider">
                  Attenzione: Dati non aggiornati dopo le 17:00. Importa il file MTZ.
                </span>
              </div>
            )}
          </div>

          <div className="flex bg-slate-900/50 p-1 rounded-lg border border-white/5 ml-4">
            <button
              onClick={() => { setView('dashboard'); setViewMode('operational'); }}
              className={cn("p-1.5 rounded-md transition-all",
                view === 'dashboard' && viewMode === 'operational' ? "bg-blue-600 text-white shadow-lg" : "text-slate-500 hover:text-slate-300"
              )}
              title="Dashboard Operativa"
            >
              <LayoutDashboard size={18} />
            </button>
            <button
              onClick={() => { setView('dashboard'); setViewMode('executive'); }}
              className={cn("p-1.5 rounded-md transition-all",
                view === 'dashboard' && viewMode === 'executive' ? "bg-purple-600 text-white shadow-lg" : "text-slate-500 hover:text-slate-300"
              )}
              title="Dashboard Direzionale"
            >
              <BarChart2 size={18} />
            </button>
            <button
              onClick={() => { setView('trends'); setViewMode('executive'); }}
              className={cn("p-1.5 rounded-md transition-all",
                view === 'trends' ? "bg-emerald-600 text-white shadow-lg" : "text-slate-500 hover:text-slate-300"
              )}
              title="Analisi Trend Storici"
            >
              <TrendingUp size={18} />
            </button>
            <button
              onClick={() => setView('scorecard')}
              className={cn("p-1.5 rounded-md transition-all",
                view === 'scorecard' ? "bg-amber-500 text-white shadow-lg" : "text-slate-500 hover:text-slate-300"
              )}
              title="Scorecard Fornitori"
            >
              <Award size={18} />
            </button>
          </div>
          {lastUpdateDate && (
            <div className="flex flex-col items-end ml-auto">
              <span className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">Ultimo Aggiornamento</span>
              <span className="text-xs text-slate-400 font-mono">
                {lastUpdateDate.toLocaleDateString('it-IT')} {lastUpdateDate.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
          )}
        </div>

        {view === 'dashboard' && (
          <>
            {viewMode === 'executive' ? (
              <ExecutiveDashboard data={incidents} supabaseClient={supabase} />
            ) : (
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

                {/* Insight System (Phase 51) - Updated to Compact (Phase 60) */}
                {/* Insight System (Phase 51) - Updated to Compact (Phase 60) */}
                <InsightPanel
                  data={baseFilteredData} // Use Base Data (includes N.d.C.)
                  onSelectRule={(ruleId) => {
                    setSelectedInsightRule(ruleId);
                    if (ruleId) setShowInsightModal(true);
                  }}
                  selectedRule={selectedInsightRule}
                  compact={true}
                  rules={allInsightRulesWithNDC}
                />



                {/* Supplier Filter Cards (Phase 36) */}
                <div className="flex flex-wrap gap-2 mb-8">
                  <button
                    onClick={() => setSelectedSupplier(null)}
                    className={cn("px-3 py-1.5 rounded-lg border text-[10px] font-bold uppercase tracking-wider transition-all",
                      !selectedSupplier ? "bg-white text-slate-900 border-white shadow-lg shadow-white/10 scale-105" : "bg-slate-800/50 text-slate-400 border-white/5 hover:bg-slate-800 hover:text-white"
                    )}
                  >
                    Tutti i Fornitori
                  </button>
                  {supplierList.map(sup => (
                    <button
                      key={sup}
                      onClick={() => setSelectedSupplier(selectedSupplier === sup ? null : sup)}
                      className={cn("px-3 py-1.5 rounded-lg border text-[10px] font-bold uppercase tracking-wider transition-all",
                        selectedSupplier === sup ? "bg-amber-500 text-white border-amber-500 shadow-lg shadow-amber-500/20 scale-105" : "bg-slate-800/50 text-slate-400 border-white/5 hover:bg-slate-800 hover:text-white"
                      )}
                    >
                      {sup}
                    </button>
                  ))}
                </div>

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
                      onDrillDown={handleDrillDown}
                    />

                    {/* Locker Stats Table */}
                    <LockerStatsTable
                      data={dashboardData}
                      onDrillDown={handleDrillDown}
                    />
                  </div>
                </div>

                {/* NEW SECTION: Livelli di Servizio */}
                <div className="glass-card mb-8 overflow-hidden flex flex-col">
                  <div className="p-6 pb-0 mb-4">
                    <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                      <div className="w-1 h-6 bg-emerald-500 rounded-full"></div>
                      Livelli di Servizio
                      <div className="flex gap-2 ml-4">
                        <select
                          className="bg-slate-700/50 border border-slate-600 text-white text-xs rounded p-1 focus:ring-2 focus:ring-blue-500 outline-none"
                          value={slaDate.getMonth()}
                          onChange={(e) => {
                            const d = new Date(slaDate);
                            d.setMonth(parseInt(e.target.value));
                            setSlaDate(d);
                          }}
                          onClick={(e) => e.stopPropagation()}
                        >
                          {Array.from({ length: 12 }, (_, i) => (
                            <option key={i} value={i} className="bg-slate-800 text-white">
                              {new Date(0, i).toLocaleString('it-IT', { month: 'long' }).replace(/^\w/, c => c.toUpperCase())}
                            </option>
                          ))}
                        </select>
                        <select
                          className="bg-slate-700/50 border border-slate-600 text-white text-xs rounded p-1 focus:ring-2 focus:ring-blue-500 outline-none"
                          value={slaDate.getFullYear()}
                          onChange={(e) => {
                            const d = new Date(slaDate);
                            d.setFullYear(parseInt(e.target.value));
                            setSlaDate(d);
                          }}
                          onClick={(e) => e.stopPropagation()}
                        >
                          {[2024, 2025, 2026].map(y => (
                            <option key={y} value={y} className="bg-slate-800 text-white">{y}</option>
                          ))}
                        </select>
                      </div>
                    </h3>
                  </div>

                  <div className="p-6 pt-0 flex flex-col gap-4">
                    {(() => {
                      // SAFETY: Ensure data exists
                      if (!dashboardData || !Array.isArray(dashboardData)) return null;

                      const now = new Date(slaDate);
                      const currentMonth = now.getMonth();
                      const currentYear = now.getFullYear();

                      // Base Filter: Has in_sla AND Closed in Current Month
                      const baseLdsData = dashboardData.filter(i => {
                        if (!i || !i.in_sla || !i.data_chiusura) return false;

                        // Filter: Hide "Non di Competenza" (Check Supplier via Map fallback)
                        // DISABLED per user request (Step 6822)
                        // const supplierName = i.fornitore || supplierMap.get((i.provincia_stato || '').trim().toUpperCase()) || '';
                        // if (supplierName.toLowerCase().includes('competen')) return false;

                        try {
                          const d = new Date(i.data_chiusura);
                          if (isNaN(d.getTime())) return false;
                          return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
                        } catch (e) { return false; }
                      });

                      const renderCard = (title: string, filterFn: (i: Incident) => boolean) => {
                        const subset = baseLdsData.filter(filterFn);
                        // Strict counting: SI / (SI + NO)
                        const siCount = subset.filter(i => i.in_sla && String(i.in_sla).trim().toUpperCase() === 'SI').length;
                        const noCount = subset.filter(i => i.in_sla && String(i.in_sla).trim().toUpperCase() === 'NO').length;
                        const totalValid = siCount + noCount;

                        if (totalValid === 0) return (
                          <div className="glass-card p-3 flex flex-col justify-center w-full max-w-[320px] border-l-4 border-slate-700 bg-slate-800/30 min-h-[70px]">
                            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">{title}</span>
                            <span className="text-sm text-slate-600 italic">Nessun dato (SI/NO)</span>
                          </div>
                        );

                        const percentage = (siCount / totalValid) * 100;
                        const isTargetMet = percentage >= 90;

                        return (
                          <div className={cn("glass-card p-3 flex flex-col justify-center w-full max-w-[320px] border-l-4 transition-all hover:bg-white/5 min-h-[70px]",
                            isTargetMet ? "border-emerald-500 bg-emerald-500/5" : "border-red-500 bg-red-500/5"
                          )}>
                            <div className="flex justify-between items-center">
                              <div className="flex flex-col">
                                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">{title}</span>
                                <span className="text-[10px] text-slate-500">{siCount} su {totalValid} interventi</span>
                              </div>
                              <span className={cn("text-2xl font-bold", isTargetMet ? "text-emerald-400" : "text-red-500")}>
                                {percentage === 100 ? '100%' : percentage.toFixed(1) + '%'}
                              </span>
                            </div>
                          </div>
                        );
                      };

                      const renderControlloCard = (title: string, filterFn: (i: Incident) => boolean) => {
                        const subset = baseLdsData.filter(filterFn);
                        // Denominator: Total (SI + NO)
                        const siCount = subset.filter(i => i.in_sla && String(i.in_sla).trim().toUpperCase() === 'SI').length;
                        const noCount = subset.filter(i => i.in_sla && String(i.in_sla).trim().toUpperCase() === 'NO').length;
                        const totalValid = siCount + noCount;

                        if (totalValid === 0) return (
                          <div className="glass-card p-3 flex flex-col justify-center w-full max-w-[320px] border-l-4 border-slate-700 bg-slate-800/30 min-h-[70px]">
                            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">{title}</span>
                            <span className="text-sm text-slate-600 italic">Nessun dato (SI/NO)</span>
                          </div>
                        );

                        const violations = subset.filter(i => {
                          const slaVal = String(i.in_sla || '').trim().toUpperCase();
                          if (slaVal !== 'SI' && slaVal !== 'NO') return false;
                          const d = Number(i.durata);
                          return !isNaN(d) && d > 2640;
                        }).length;

                        const complianceCount = totalValid - violations;
                        const percentage = (complianceCount / totalValid) * 100;
                        const isTargetMet = percentage >= 99; // Target 99%

                        return (
                          <div className={cn("glass-card p-3 flex flex-col justify-center w-full max-w-[320px] border-l-4 transition-all hover:bg-white/5 min-h-[70px]",
                            isTargetMet ? "border-emerald-500 bg-emerald-500/5" : "border-red-500 bg-red-500/5"
                          )}>
                            <div className="flex justify-between items-center">
                              <div className="flex flex-col">
                                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">{title}</span>
                                <span className="text-[10px] text-slate-500">{complianceCount} su {totalValid} OK</span>
                                <span className="text-[9px] text-slate-600 mt-0.5">({violations} violazioni)</span>
                              </div>
                              <span className={cn("text-2xl font-bold", isTargetMet ? "text-emerald-400" : "text-red-500")}>
                                {percentage === 100 ? '100%' : percentage.toFixed(1) + '%'}
                              </span>
                            </div>
                          </div>
                        );
                      };

                      if (baseLdsData.length === 0) return <div className="text-slate-500 italic text-sm w-full">Nessun intervento chiuso nel mese corrente con dati SLA.</div>;

                      return (
                        <div className="flex flex-col lg:flex-row gap-8 justify-center">

                          {/* COLUMN 1: Complessivo */}
                          <div className="flex flex-col gap-2 flex-1 max-w-sm items-end">
                            <h4 className="text-xs font-bold text-slate-500 uppercase tracking-widest border-b border-white/5 pb-2 w-full text-left flex items-center justify-between">
                              Complessivo <span className="text-[10px] opacity-70">(Target 90%)</span>
                            </h4>
                            {renderCard("Filiali (TECNOFIL)", (i) => (i.servizio_hd || '').trim().toUpperCase() === 'TECNOFIL')}
                            {renderCard("Presidi (TECNODIR)", (i) => (i.servizio_hd || '').trim().toUpperCase() === 'TECNODIR')}
                          </div>

                          {/* COLUMN 2: Controllo */}
                          <div className="flex flex-col gap-2 flex-1 max-w-sm items-end">
                            <h4 className="text-xs font-bold text-slate-500 uppercase tracking-widest border-b border-white/5 pb-2 flex items-center justify-between w-full">
                              Controllo <span className="text-[10px] opacity-70">(&le; 2640 min)</span>
                            </h4>
                            {renderControlloCard("Filiali (TECNOFIL)", (i) => (i.servizio_hd || '').trim().toUpperCase() === 'TECNOFIL')}
                            {renderControlloCard("Presidi (TECNODIR)", (i) => (i.servizio_hd || '').trim().toUpperCase() === 'TECNODIR')}
                          </div>

                          {/* COLUMN 3: Regionale (New - Phase 34) */}
                          <div className="flex flex-col gap-2 flex-1 max-w-sm items-end">
                            <h4 className="text-xs font-bold text-slate-500 uppercase tracking-widest border-b border-white/5 pb-2 flex items-center justify-between w-full">
                              Regionale <span className="text-[10px] opacity-70">(% Regioni OK)</span>
                            </h4>
                            {/* Calculate Regionale Logic Here:
                            1. Group by Region
                            2. Calculate Complessivo (Target 80%)
                            3. Count passing regions
                        */}
                            {(() => {
                              const regions = [...new Set(baseLdsData.map(i => i.regione || 'N/D'))];
                              const totalRegions = regions.length;

                              const renderRegionaleCard = (title: string, service: string) => {
                                if (totalRegions === 0) return null;
                                let passingRegions = 0;

                                regions.forEach(reg => {
                                  const regionSubset = baseLdsData.filter(i => (i.regione || 'N/D') === reg && (i.servizio_hd || '').trim().toUpperCase() === service);
                                  const si = regionSubset.filter(i => String(i.in_sla).trim().toUpperCase() === 'SI').length;
                                  const no = regionSubset.filter(i => String(i.in_sla).trim().toUpperCase() === 'NO').length;
                                  const total = si + no;

                                  // If no tickets for this service in this region, does it pass? 
                                  // Assuming N/A doesn't count against, but also doesn't count for? 
                                  // Let's assume we only count regions with ACTIVE tickets for this service.
                                  if (total > 0) {
                                    const pct = (si / total) * 100;
                                    if (pct >= 80) passingRegions++;
                                  } else {
                                    // Empty region counts as Pass
                                    passingRegions++;
                                  }
                                });

                                // Denominator: Total Regions (since Empty = Pass logic applies to all)
                                const denom = totalRegions;

                                // If totalRegions is 0 (no data at all in file), handle gracefully
                                if (denom === 0) return (
                                  <div className="glass-card p-3 flex flex-col justify-center w-full max-w-[320px] border-l-4 border-slate-700 bg-slate-800/30 min-h-[70px]">
                                    <span className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">{title}</span>
                                    <span className="text-sm text-slate-600 italic">Nessun dato regionale</span>
                                  </div>
                                );

                                const pct = (passingRegions / denom) * 100;
                                const isTargetMet = pct >= 100;

                                return (
                                  <div className={cn("glass-card p-3 flex flex-col justify-center w-full max-w-[320px] border-l-4 transition-all hover:bg-white/5 min-h-[70px]",
                                    isTargetMet ? "border-emerald-500 bg-emerald-500/5" : "border-red-500 bg-red-500/5"
                                  )}>
                                    <div className="flex justify-between items-center">
                                      <div className="flex flex-col">
                                        <span className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">{title}</span>
                                        <span className="text-[10px] text-slate-500">{passingRegions} su {denom} Regioni OK</span>
                                      </div>
                                      <span className={cn("text-2xl font-bold", isTargetMet ? "text-emerald-400" : "text-red-500")}>
                                        {pct === 100 ? '100%' : pct.toFixed(0) + '%'}
                                      </span>
                                    </div>
                                  </div>
                                );
                              };

                              return (
                                <>
                                  {renderRegionaleCard("Filiali (TECNOFIL)", 'TECNOFIL')}
                                  {renderRegionaleCard("Presidi (TECNODIR)", 'TECNODIR')}
                                </>
                              );
                            })()}
                          </div>

                        </div>
                      );
                    })()}
                  </div>
                </div>

                {/* NEW SECTION: Livelli di Servizio - Regioni & Mappa (Phase 35) */}
                <div className="flex flex-col xl:flex-row gap-6 mb-8">
                  {/* Table Section */}
                  <div className="flex-1 xl:max-w-[66%] xl:flex-[2]">
                    <RegionalSLATable stats={regionalStats} />
                  </div>

                  {/* Map Section */}
                  <div className="flex-1 glass-card p-4 flex flex-col min-h-[500px] xl:max-w-[34%] xl:flex-[1]">
                    <div className="flex justify-between items-center mb-4 pb-4 border-b border-white/5">
                      <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                        <div className="w-1 h-4 bg-blue-500 rounded-full"></div>
                        Distribuzione Geografica
                      </h3>
                      <div className="flex bg-slate-900/50 p-1 rounded-lg border border-white/5">
                        <button
                          onClick={() => setMapMode('SLA')}
                          className={cn("px-3 py-1 text-[10px] font-bold uppercase tracking-wider rounded-md transition-all",
                            mapMode === 'SLA' ? "bg-blue-600 text-white shadow-lg" : "text-slate-500 hover:text-slate-300"
                          )}
                        >
                          SLA Status
                        </button>
                        <button
                          onClick={() => setMapMode('BACKLOG')}
                          className={cn("px-3 py-1 text-[10px] font-bold uppercase tracking-wider rounded-md transition-all",
                            mapMode === 'BACKLOG' ? "bg-amber-600 text-white shadow-lg" : "text-slate-500 hover:text-slate-300"
                          )}
                        >
                          Backlog (Vol)
                        </button>
                      </div>
                    </div>
                    <div className="flex-1 relative">
                      <ItalyMap data={regionalStats} mode={mapMode} />
                    </div>
                    <div className="mt-4 flex gap-4 justify-center text-[10px] text-slate-500 font-mono">
                      {mapMode === 'SLA' ? (
                        <>
                          <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-emerald-500"></div> Target Raggiunto</div>
                          <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-red-500"></div> Sotto Soglia</div>
                        </>
                      ) : (
                        <>
                          <div className="flex items-center gap-1 bg-gradient-to-r from-cyan-900 to-cyan-400 w-24 h-2 rounded opacity-80"></div> Volume
                        </>
                      )}
                    </div>
                  </div>
                </div>


              </>
            )}
          </>
        )}

        {view === 'incidents' && (
          <IncidentTable
            data={incidents}
            onIncidentUpdate={handleIncidentUpdate}
            onSelect={setSelectedIncident}
            insightData={dashboardData}
            onSelectInsight={(ruleId) => {
              setSelectedInsightRule(ruleId);
              // In this view, we FILTER the table, we DO NOT open the modal (Phase 59)
            }}
            selectedInsight={selectedInsightRule}
            insightRules={allInsightRules}
          />
        )}

        {view === 'requests' && <PartsRequestTable data={incidents} onSelect={setSelectedIncident} />}

        {view === 'scorecard' && <SupplierScorecard data={incidents} />}

        {view === 'import' && <ImportPage
          refreshData={() => session && fetchProfile(session.user.id)}
          onGhostDetected={handleGhostDetected}
          onImportReady={handleImportReady}
        />}

        {view === 'settings' && <SettingsPage />}

        {view === 'trends' && <TrendAnalysisPage supabaseClient={supabase} />}
      </div>

      {/* Root Level Modal */}
      {selectedIncident && <IncidentDetailModal incident={selectedIncident} onClose={() => setSelectedIncident(null)} onIncidentUpdate={handleIncidentUpdate} user={userProfile} />}

      {/* Ghost Resolution Modal (Phase 68) */}
      {isProcessingGhosts && (
        <GhostResolutionModal
          ghosts={ghostIncidents}
          onReassign={handleGhostReassign}
          onReassignAll={handleGhostReassignAll}
          onClose={handleGhostClose}
        />
      )}

      {/* DrillDown Modal (Phase 69) */}
      {/* DrillDown Modal (Phase 69 - Refactored to use InsightListModal) */}
      {drillDownData && (
        <InsightListModal
          data={drillDownData.incidents}
          title={drillDownData.title}
          subtitle={`${drillDownData.incidents.length} segnalazioni`}
          icon={List}
          colorTheme="blue"
          onClose={() => setDrillDownData(null)}
          onSelectIncident={(incident) => {
            setDrillDownData(null);
            setSelectedIncident(incident);
          }}
        />
      )}

      {/* Insight List Modal (Phase 53) */}
      {showInsightModal && selectedInsightRule && (
        <InsightListModal
          data={insightFilteredData}
          title={allInsightRulesWithNDC.find(r => r.id === selectedInsightRule)?.name || 'Insight'}
          subtitle="Analisi Dettagliata"
          icon={allInsightRulesWithNDC.find(r => r.id === selectedInsightRule)?.icon || AlertTriangle}
          colorTheme={allInsightRulesWithNDC.find(r => r.id === selectedInsightRule)?.type || 'warning'}
          ruleId={selectedInsightRule} // NEW: Pass the ID to enable custom columns
          onClose={() => { setShowInsightModal(false); setSelectedInsightRule(null); }}
          onSelectIncident={(incident) => {
            setSelectedIncident(incident);
          }}
        />
      )}
    </div >
  );
}


export default App;
