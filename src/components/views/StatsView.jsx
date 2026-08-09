import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { BarChart2, TrendingUp, Clock, Music2, RefreshCw, Play, Calendar, Heart } from 'lucide-react';
import { getCoverSrc, COVER_PLACEHOLDER, formatTime } from '../../utils';

const API_URL = (typeof window !== 'undefined' && window.location?.protocol === 'http:')
  ? '/api' : 'http://localhost:3001/api';

function formatHours(seconds) {
  if (!seconds) return '0m';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function formatSize(bytes) {
  if (!bytes || bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  const val = bytes / Math.pow(1024, i);
  return `${val % 1 === 0 ? val : val.toFixed(i >= 2 ? 1 : 0)} ${units[i]}`;
}

function formatDate(isoDay) {
  if (!isoDay) return '';
  const [, m, d] = isoDay.split('-');
  return `${d}.${m}`;
}

function MiniBarChart({ data, maxVal, t }) {
  if (!data?.length) return null;
  const peak = maxVal || Math.max(...data.map(d => d.count), 1);
  return (
    <div className="flex items-end gap-0.5 h-16 w-full">
      {data.map((d, i) => (
        <div key={i} className="flex-1 flex flex-col items-center gap-0.5 group">
          <div
            className="w-full rounded-sm accent-progress opacity-70 group-hover:opacity-100 transition-opacity"
            style={{ height: `${Math.max(2, (d.count / peak) * 56)}px` }}
            title={t('statsView.chartTitle', { ns: 'library', day: d.day, count: d.count })}
          />
        </div>
      ))}
    </div>
  );
}

export default function StatsView({ currentSong, onPlay, onContextMenu }) {
  const { t } = useTranslation(['library', 'common']);
  const [tab,      setTab]      = useState('top');
  const [summary,  setSummary]  = useState(null);
  const [top,      setTop]      = useState([]);
  const [daily,    setDaily]    = useState([]);
  const [unplayed, setUnplayed] = useState([]);
  const [artists,  setArtists]  = useState([]);
  const [albums,   setAlbums]   = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [days,     setDays]     = useState(30);
  const [unplayedDays, setUnplayedDays] = useState(60);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [sumR, topR, dailyR, unplayedR, artistsR, albumsR] = await Promise.all([
        fetch(`${API_URL}/stats/summary`),
        fetch(`${API_URL}/stats/top?limit=50`),
        fetch(`${API_URL}/stats/daily?days=${days}`),
        fetch(`${API_URL}/stats/unplayed?days=${unplayedDays}`),
        fetch(`${API_URL}/stats/artists?limit=25`),
        fetch(`${API_URL}/stats/albums?limit=25`),
      ]);
      if (sumR.ok)      setSummary(await sumR.json());
      if (topR.ok)      setTop(await topR.json());
      if (dailyR.ok)    setDaily(await dailyR.json());
      if (unplayedR.ok) setUnplayed(await unplayedR.json());
      if (artistsR.ok)  setArtists(await artistsR.json());
      if (albumsR.ok)   setAlbums(await albumsR.json());
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, [days, unplayedDays]);

  useEffect(() => { load(); }, [load]);

  const TABS = [
    { id: 'top',      label: t('statsView.top50', { ns: 'library' }),       icon: TrendingUp },
    { id: 'artists',  label: t('statsView.artists', { ns: 'library' }),      icon: Music2     },
    { id: 'albums',   label: t('statsView.albums', { ns: 'library' }),       icon: BarChart2  },
    { id: 'daily',    label: t('statsView.history', { ns: 'library' }),     icon: Calendar   },
    { id: 'unplayed', label: t('statsView.unplayed', { ns: 'library' }), icon: Clock      },
  ];

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-3 px-6 pt-6 pb-4 flex-shrink-0">
        <BarChart2 size={18} className="text-accent" />
        <h2 className="text-lg font-bold text-white">{t('statsView.title', { ns: 'library' })}</h2>
        <button onClick={load} className="ml-auto p-2 rounded-lg hover:bg-white/10 text-zinc-500 hover:text-zinc-300 transition-colors">
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      {/* Summary cards */}
      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 px-6 mb-4 flex-shrink-0">
          {[
            { label: t('statsView.playsToday', { ns: 'library' }),    value: summary.todayPlays,             sub: t('statsView.plays', { ns: 'library' }),           icon: Play     },
            { label: t('statsView.launchesToday', { ns: 'library' }),   value: summary.launchesToday,          sub: t('statsView.openedTimes', { ns: 'library' }),        icon: RefreshCw },
            { label: t('statsView.thisWeek', { ns: 'library' }),         value: summary.thisWeek,               sub: t('statsView.plays', { ns: 'library' }),           icon: Calendar },
            { label: t('statsView.totalPlays', { ns: 'library' }),   value: summary.totalPlays,             sub: t('statsView.all', { ns: 'library' }),          icon: Music2   },
            { label: t('statsView.listeningTime', { ns: 'library' }),      value: formatHours(summary.totalTime), sub: t('statsView.total', { ns: 'library' }),             icon: Clock    },
            { label: t('statsView.avgDailySession', { ns: 'library' }),   value: formatHours(summary.avgSessionLength), sub: t('statsView.perDay', { ns: 'library' }),     icon: BarChart2 },
            { label: t('statsView.librarySize', { ns: 'library' }),  value: formatSize(summary.totalSize),  sub: t('statsView.onDisk', { ns: 'library' }),            icon: TrendingUp },
            { label: t('statsView.favorites', { ns: 'library' }),            value: summary.favoritesCount,         sub: t('statsView.tracks', { ns: 'library' }),             icon: Heart    },
          ].map(({ label, value, icon: Icon, sub }) => (
            <div key={label} className="bg-zinc-800/40 border border-zinc-700/40 rounded-xl p-3">
              <div className="flex items-center gap-2 mb-1">
                <Icon size={12} className="text-accent opacity-70" />
                <span className="text-[11px] text-zinc-500">{label}</span>
              </div>
              <p className="text-xl font-bold text-white tabular-nums">{value ?? '—'}</p>
              <p className="text-[10px] text-zinc-600">{sub}</p>
            </div>
          ))}
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 px-6 mb-4 flex-shrink-0">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button key={id} onClick={() => setTab(id)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              tab === id
                ? 'accent-bg accent-text border accent-border'
                : 'text-zinc-500 hover:text-white hover:bg-zinc-800/50'
            }`}>
            <Icon size={12} /> {label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar px-6 pb-8">

        {/* ── TOP ARTYŚCI ── */}
        {tab === 'artists' && (
          <div className="space-y-1">
            {loading ? (
              <p className="text-zinc-600 text-sm text-center py-12">{t('loadingShort', { ns: 'common' })}</p>
            ) : artists.length === 0 ? (
              <div className="flex flex-col items-center gap-3 py-16 text-zinc-700">
                <Music2 size={40} className="opacity-20" />
                <p className="text-sm">{t('statsView.noHistory', { ns: 'library' })}</p>
              </div>
            ) : artists.map((a, i) => {
              const pct = (a.play_count / (artists[0]?.play_count || 1)) * 100;
              return (
                <div key={a.artist}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-white/[0.04] transition-colors group cursor-pointer"
                  onClick={() => onPlay({ artist: a.artist }, null, 'artist')}
                >
                  <span className={`w-6 text-center text-xs tabular-nums font-bold flex-shrink-0 ${
                    i === 0 ? 'text-yellow-400' : i === 1 ? 'text-zinc-400' : i === 2 ? 'text-orange-600' : 'text-zinc-700'
                  }`}>{i + 1}</span>
                  <div className="w-9 h-9 rounded-full bg-zinc-800 border border-zinc-700/50 flex items-center justify-center flex-shrink-0 overflow-hidden">
                    {a.cover ? (
                      <img
                        src={getCoverSrc(a.cover)}
                        onError={e => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'flex'; }}
                        alt="" className="w-full h-full object-cover"
                      />
                    ) : null}
                    <Music2 size={14} className="text-zinc-600" style={{ display: a.cover ? 'none' : 'flex' }} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold text-white truncate">{a.artist}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <div className="flex-1 bg-zinc-800/60 rounded-full h-1 overflow-hidden">
                        <div className="h-full accent-progress rounded-full" style={{ width: `${pct}%` }} />
                      </div>
                      <span className="text-[10px] text-zinc-600 flex-shrink-0">{a.track_count} {t('tracksShort', { ns: 'common' })}</span>
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-xs font-semibold accent-text tabular-nums">{a.play_count}×</p>
                    <p className="text-[10px] text-zinc-600">{formatHours(a.total_time)}</p>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* ── TOP ALBUMY ── */}
        {tab === 'albums' && (
          <div className="space-y-1">
            {loading ? (
              <p className="text-zinc-600 text-sm text-center py-12">{t('loadingShort', { ns: 'common' })}</p>
            ) : albums.length === 0 ? (
              <div className="flex flex-col items-center gap-3 py-16 text-zinc-700">
                <BarChart2 size={40} className="opacity-20" />
                <p className="text-sm">{t('statsView.noHistory', { ns: 'library' })}</p>
              </div>
            ) : albums.map((a, i) => {
              const pct = (a.play_count / (albums[0]?.play_count || 1)) * 100;
              return (
                <div key={`${a.album}-${a.artist}`}
                  className="flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-white/[0.04] transition-colors cursor-pointer"
                >
                  <span className={`w-6 text-center text-xs tabular-nums font-bold flex-shrink-0 ${
                    i === 0 ? 'text-yellow-400' : i === 1 ? 'text-zinc-400' : i === 2 ? 'text-orange-600' : 'text-zinc-700'
                  }`}>{i + 1}</span>
                  <img
                    src={getCoverSrc(a.cover)}
                    onError={e => { e.target.src = COVER_PLACEHOLDER; }}
                    alt="" className="w-9 h-9 rounded-lg object-cover flex-shrink-0 border border-zinc-800"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold text-white truncate">{a.album}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <p className="text-[11px] text-zinc-500 truncate flex-1">{a.artist}</p>
                      <div className="w-16 bg-zinc-800/60 rounded-full h-1 overflow-hidden flex-shrink-0">
                        <div className="h-full accent-progress rounded-full" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-xs font-semibold accent-text tabular-nums">{a.play_count}×</p>
                    <p className="text-[10px] text-zinc-600">{formatHours(a.total_time)}</p>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* ── TOP 50 ── */}
        {tab === 'top' && (
          <div className="space-y-1">
            {loading ? (
              <p className="text-zinc-600 text-sm text-center py-12">{t('loadingShort', { ns: 'common' })}</p>
            ) : top.length === 0 ? (
              <div className="flex flex-col items-center gap-3 py-16 text-zinc-700">
                <TrendingUp size={40} className="opacity-20" />
                <p className="text-sm">{t('statsView.noHistory', { ns: 'library' })}</p>
                <p className="text-xs text-zinc-700">{t('statsView.startListening', { ns: 'library' })}</p>
              </div>
            ) : top.map((song, i) => (
              <div key={song.id}
                className={`flex items-center gap-3 px-3 py-2 rounded-xl cursor-pointer transition-colors group ${
                  currentSong?.id === song.id ? 'bg-accent/10 border border-accent/20' : 'hover:bg-white/[0.04]'
                }`}
                onClick={() => onPlay(song, top)}
                onContextMenu={onContextMenu ? (e) => onContextMenu(e, song) : undefined}
              >
                <span className={`w-6 text-center text-xs tabular-nums flex-shrink-0 font-bold ${
                  i === 0 ? 'text-yellow-400' : i === 1 ? 'text-zinc-400' : i === 2 ? 'text-orange-600' : 'text-zinc-700'
                }`}>{i + 1}</span>
                <img
                  src={getCoverSrc(song.cover)}
                  onError={e => { e.target.src = COVER_PLACEHOLDER; }}
                  alt="" className="w-9 h-9 rounded-lg object-cover flex-shrink-0"
                />
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium text-white truncate">{song.title}</p>
                  <p className="text-[11px] text-zinc-500 truncate">{song.artist}</p>
                </div>
                <div className="flex-shrink-0 text-right">
                  <p className="text-xs font-semibold accent-text tabular-nums">{song.play_count}×</p>
                  <p className="text-[10px] text-zinc-600">{formatTime(song.duration)}</p>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ── HISTORIA DZIENNA ── */}
        {tab === 'daily' && (
          <div>
            <div className="flex items-center gap-3 mb-4">
              <span className="text-xs text-zinc-500">{t('statsView.range', { ns: 'library' })}</span>
              {[7, 14, 30, 90].map(d => (
                <button key={d} onClick={() => setDays(d)}
                  className={`px-2.5 py-1 rounded-lg text-xs transition-colors ${
                    days === d ? 'accent-bg accent-text' : 'text-zinc-500 hover:text-white bg-zinc-800/50'
                  }`}>
                  {d}d
                </button>
              ))}
            </div>

            {loading ? (
              <p className="text-zinc-600 text-sm text-center py-12">{t('loadingShort', { ns: 'common' })}</p>
            ) : daily.length === 0 ? (
              <div className="flex flex-col items-center gap-3 py-16 text-zinc-700">
                <Calendar size={40} className="opacity-20" />
                <p className="text-sm">{t('statsView.noDataForPeriod', { ns: 'library' })}</p>
              </div>
            ) : (
              <>
                {/* Bar chart */}
                <div className="bg-zinc-800/30 border border-zinc-700/30 rounded-xl p-4 mb-4">
                  <MiniBarChart data={daily} t={t} />
                  <div className="flex justify-between mt-2">
                    <span className="text-[10px] text-zinc-700">{formatDate(daily[0]?.day)}</span>
                    <span className="text-[10px] text-zinc-500 text-center">{t('statsView.playsPerDay', { ns: 'library' })}</span>
                    <span className="text-[10px] text-zinc-700">{formatDate(daily[daily.length-1]?.day)}</span>
                  </div>
                </div>

                {/* Table */}
                <div className="space-y-1">
                  {[...daily].reverse().map(d => (
                    <div key={d.day} className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-white/[0.03] transition-colors">
                      <span className="text-xs text-zinc-500 font-mono w-20 flex-shrink-0">{d.day}</span>
                      <div className="flex-1 bg-zinc-800/50 rounded-full h-1.5 overflow-hidden">
                        <div
                          className="h-full accent-progress"
                          style={{ width: `${(d.count / Math.max(...daily.map(x => x.count), 1)) * 100}%` }}
                        />
                      </div>
                      <span className="text-xs font-semibold text-white tabular-nums w-12 text-right">{d.count}×</span>
                      <span className="text-[11px] text-zinc-600 w-14 text-right">{formatHours(d.total_seconds)}</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        )}

        {/* ── NIE SŁUCHANE ── */}
        {tab === 'unplayed' && (
          <div>
            <div className="flex items-center gap-3 mb-4">
              <span className="text-xs text-zinc-500">{t('statsView.notListenedSince', { ns: 'library' })}</span>
              {[14, 30, 60, 90, 180].map(d => (
                <button key={d} onClick={() => setUnplayedDays(d)}
                  className={`px-2.5 py-1 rounded-lg text-xs transition-colors ${
                    unplayedDays === d ? 'accent-bg accent-text' : 'text-zinc-500 hover:text-white bg-zinc-800/50'
                  }`}>
                  {d}d
                </button>
              ))}
            </div>

            {loading ? (
              <p className="text-zinc-600 text-sm text-center py-12">{t('loadingShort', { ns: 'common' })}</p>
            ) : unplayed.length === 0 ? (
              <div className="flex flex-col items-center gap-3 py-16 text-zinc-700">
                <Clock size={40} className="opacity-20" />
                <p className="text-sm">{t('statsView.allRecentlyPlayed', { ns: 'library' })}</p>
              </div>
            ) : (
              <div className="space-y-1">
                <p className="text-xs text-zinc-600 mb-3">{t('statsView.unplayedSummary', { ns: 'library', count: unplayed.length, days: unplayedDays })}</p>
                {unplayed.map(song => (
                  <div key={song.id}
                    className={`flex items-center gap-3 px-3 py-2 rounded-xl cursor-pointer transition-colors group ${
                      currentSong?.id === song.id ? 'bg-accent/10 border border-accent/20' : 'hover:bg-white/[0.04]'
                    }`}
                    onClick={() => onPlay(song, unplayed)}
                    onContextMenu={onContextMenu ? (e) => onContextMenu(e, song) : undefined}
                  >
                    <img
                      src={getCoverSrc(song.cover)}
                      onError={e => { e.target.src = COVER_PLACEHOLDER; }}
                      alt="" className="w-9 h-9 rounded-lg object-cover flex-shrink-0"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-medium text-white truncate">{song.title}</p>
                      <p className="text-[11px] text-zinc-500 truncate">{song.artist}</p>
                    </div>
                    <div className="flex-shrink-0 text-right">
                      {song.last_played ? (
                        <p className="text-[11px] text-zinc-600">
                          {t('daysAgo', { ns: 'common', count: Math.floor((Date.now()/1000 - song.last_played) / 86400) })}
                        </p>
                      ) : (
                        <p className="text-[11px] text-zinc-700 italic">{t('statsView.never', { ns: 'library' })}</p>
                      )}
                      <p className="text-[10px] text-zinc-700">{formatTime(song.duration)}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
