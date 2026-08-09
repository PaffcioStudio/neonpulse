import React from 'react';
import { useTranslation } from 'react-i18next';
import {
  Disc, ListMusic, Users, Library, Heart, CassetteTape,
  PartyPopper, Flame, Sparkles, Settings, Menu, RefreshCw,
  Tag, ListPlus, Music2, FileX2, Copy, Mic2, BarChart2, Radio
} from 'lucide-react';

export default function Sidebar({ activeView, setActiveView, isOpen, setOpen, scanInfo, libraryCount, onImportExport }) {
  const { t } = useTranslation(['common', 'library', 'settings', 'radio']);

  const NAV = [
    { id: 'home',      icon: Disc,      label: t('nowPlaying', { ns: 'common' }) },
    { id: 'favorites', icon: Heart,     label: t('favorites', { ns: 'common' }), iconClass: 'text-red-400' },
    'sep',
    { id: 'library',   icon: ListMusic, label: t('allTracks', { ns: 'library' }) },
    { id: 'artists',   icon: Users,     label: t('artists', { ns: 'common' }) },
    { id: 'albums',    icon: Library,   label: t('albums', { ns: 'common' }) },
    { id: 'genres',    icon: Tag,       label: t('genres', { ns: 'common' }) },
    'sep',
    { id: 'mix-80',    icon: CassetteTape, label: t('80sMix', { ns: 'library' }) },
    { id: 'mix-90',    icon: PartyPopper,  label: t('90sMix', { ns: 'library' }) },
    { id: 'mix-00',    icon: Flame,        label: t('2000sMix', { ns: 'library' }) },
    'sep',
    { id: 'smart',     icon: Sparkles,  label: t('smartMixes', { ns: 'library' }) },
    { id: 'playlists', icon: ListPlus,  label: t('playlists', { ns: 'common' }) },
    'sep',
    { id: 'radio',      icon: Radio,   label: t('radioStations', { ns: 'radio' }), iconClass: 'text-emerald-400' },
    'sep',
    { id: 'missing',    icon: FileX2,  label: t('missingFiles', { ns: 'library' }), iconClass: 'text-amber-400' },
    { id: 'duplicates', icon: Copy,    label: t('duplicates', { ns: 'library' }), iconClass: 'text-blue-400' },
    'sep',
    { id: 'lyrics',     icon: Mic2,    label: t('lyrics', { ns: 'player' }) },
    { id: 'stats',      icon: BarChart2, label: t('stats', { ns: 'common' }), iconClass: 'text-purple-400' },
    'sep',
    { id: 'settings',  icon: Settings,  label: t('settings', { ns: 'common' }) },
  ];
  return (
    <aside className={`${isOpen ? 'w-64' : 'w-[68px]'} flex-shrink-0 transition-[width] duration-300 ease-in-out bg-zinc-950 border-r border-zinc-800/60 flex flex-col z-20 overflow-hidden`}>

      {/* Logo */}
      <div className="px-4 py-4 flex items-center justify-between flex-shrink-0">
        <div className={`flex flex-col overflow-hidden transition-all duration-300 ${isOpen ? 'opacity-100 w-auto' : 'opacity-0 w-0'}`}>
          <h1 className="text-xl font-black italic tracking-tighter accent-gradient-text leading-none whitespace-nowrap">
            NEON<span className="text-white not-italic">PULSE</span>
          </h1>
          <span className="text-[10px] text-zinc-600 uppercase tracking-[0.2em] mt-0.5">{t('audioEngine', { ns: 'settings' })}</span>
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
            {t('importExportPlaylist', { ns: 'library' })}
          </button>
          {scanInfo.isScanning ? (
            <div className="flex items-center gap-1.5 text-[11px] accent-text animate-pulse">
              <RefreshCw size={10} className="animate-spin flex-shrink-0" />
              <span className="truncate">{t('scanning', { ns: 'common' })} {scanInfo.scanned||0}/{scanInfo.total||0}</span>
            </div>
          ) : (
            <p className="text-[11px] text-zinc-700 truncate">
              {libraryCount === 0 ? t('libraryEmpty', { ns: 'library' }) : t('tracksCount', { ns: 'common', count: libraryCount })}
            </p>
          )}
        </div>
      )}
    </aside>
  );
}
