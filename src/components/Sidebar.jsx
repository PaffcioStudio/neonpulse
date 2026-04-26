import React from 'react';
import {
  Disc, ListMusic, Users, Library, Heart, CassetteTape,
  PartyPopper, Flame, Sparkles, Settings, Menu, RefreshCw,
  Tag, ListPlus, Music2, FileX2, Copy, Mic2, BarChart2
} from 'lucide-react';

const NAV = [
  { id: 'home',      icon: Disc,      label: 'Teraz gramy' },
  { id: 'favorites', icon: Heart,     label: 'Ulubione', iconClass: 'text-red-400' },
  'sep',
  { id: 'library',   icon: ListMusic, label: 'Wszystkie utwory' },
  { id: 'artists',   icon: Users,     label: 'Artyści' },
  { id: 'albums',    icon: Library,   label: 'Albumy' },
  { id: 'genres',    icon: Tag,       label: 'Gatunki' },
  'sep',
  { id: 'mix-80',    icon: CassetteTape, label: 'Lata 80.' },
  { id: 'mix-90',    icon: PartyPopper,  label: 'Lata 90.' },
  { id: 'mix-00',    icon: Flame,        label: 'Lata 2000+' },
  'sep',
  { id: 'smart',     icon: Sparkles,  label: 'Smart mixy' },
  { id: 'playlists', icon: ListPlus,  label: 'Listy odtwarzania' },
  'sep',
  { id: 'missing',    icon: FileX2,  label: 'Brakujące pliki', iconClass: 'text-amber-400' },
  { id: 'duplicates', icon: Copy,    label: 'Duplikaty',       iconClass: 'text-blue-400' },
  'sep',
  { id: 'lyrics',     icon: Mic2,    label: 'Tekst utworu' },
  { id: 'stats',      icon: BarChart2, label: 'Statystyki',   iconClass: 'text-purple-400' },
  'sep',
  { id: 'settings',  icon: Settings,  label: 'Ustawienia' },
];

export default function Sidebar({ activeView, setActiveView, isOpen, setOpen, scanInfo, libraryCount, onImportExport }) {
  return (
    <aside className={`${isOpen ? 'w-64' : 'w-[68px]'} flex-shrink-0 transition-[width] duration-300 ease-in-out bg-zinc-950 border-r border-zinc-800/60 flex flex-col z-20 overflow-hidden`}>

      {/* Logo */}
      <div className="px-4 py-4 flex items-center justify-between flex-shrink-0">
        <div className={`flex flex-col overflow-hidden transition-all duration-300 ${isOpen ? 'opacity-100 w-auto' : 'opacity-0 w-0'}`}>
          <h1 className="text-xl font-black italic tracking-tighter accent-gradient-text leading-none whitespace-nowrap">
            NEON<span className="text-white not-italic">PULSE</span>
          </h1>
          <span className="text-[10px] text-zinc-600 uppercase tracking-[0.2em] mt-0.5">Audio Engine</span>
        </div>
        <button
          onClick={() => setOpen(o => !o)}
          className="text-zinc-500 hover:text-white transition-colors flex-shrink-0 p-1 rounded-lg hover:bg-white/5"
        >
          <Menu size={19} />
        </button>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-2 overflow-y-auto custom-scrollbar pb-3 space-y-0.5">
        {NAV.map((item, i) => {
          if (item === 'sep') return (
            <div key={`sep-${i}`} className="my-1.5 mx-2 border-t border-zinc-800/60" />
          );
          const Icon = item.icon;
          const active = activeView === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActiveView(item.id)}
              title={!isOpen ? item.label : undefined}
              className={`w-full flex items-center ${isOpen ? 'gap-3 px-3' : 'justify-center px-0'} py-2 rounded-lg transition-all border-l-2 group ${
                active
                  ? 'bg-white/[0.06] text-white accent-sidebar-indicator'
                  : 'text-zinc-500 border-transparent hover:text-white hover:bg-white/[0.04]'
              }`}
            >
              <Icon
                size={17}
                className={active ? 'accent-text' : (item.iconClass || 'group-hover:text-zinc-300 transition-colors')}
              />
              {isOpen && (
                <span className="text-sm font-medium truncate">{item.label}</span>
              )}
            </button>
          );
        })}
      </nav>

      {/* Footer status */}
      {isOpen && (
        <div className="px-4 pb-3 pt-2 border-t border-zinc-800/40 flex-shrink-0 space-y-2">
          <button
            onClick={onImportExport}
            className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-zinc-500 hover:text-zinc-300 hover:bg-white/[0.04] transition-colors text-xs"
          >
            <ListMusic size={12} />
            Import / Eksport playlist
          </button>
          {scanInfo.isScanning ? (
            <div className="flex items-center gap-1.5 text-[11px] accent-text animate-pulse">
              <RefreshCw size={10} className="animate-spin flex-shrink-0" />
              <span className="truncate">Skanowanie… {scanInfo.scanned||0}/{scanInfo.total||0}</span>
            </div>
          ) : (
            <p className="text-[11px] text-zinc-700 truncate">
              {libraryCount === 0 ? 'Biblioteka pusta' : `${libraryCount} ${libraryCount < 5 ? libraryCount === 1 ? 'utwór' : 'utwory' : 'utworów'}`}
            </p>
          )}
        </div>
      )}
    </aside>
  );
}
