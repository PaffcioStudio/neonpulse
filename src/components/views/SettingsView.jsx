import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { i18n, changeLanguage, AVAILABLE_LANGUAGES } from '../../i18n';
import {
  FolderPlus, Trash2, RefreshCw, Monitor, Sliders, Music2,
  Database, Radio, ExternalLink, CheckCircle2, XCircle, Info,
  Github, Heart, AlertTriangle, Globe
} from 'lucide-react';
import { THEMES } from '../../utils';
import EqualizerPanel from '../EqualizerPanel';
import { ipcRenderer } from '../../ipc';

function formatBytes(bytes) {
  const n = Number(bytes) || 0;
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let value = n;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit++;
  }
  const decimals = unit <= 1 || value >= 100 ? 0 : 1;
  return `${value.toFixed(decimals)} ${units[unit]}`;
}

export default function SettingsView({ musicPaths, library, scanInfo, onAddFolder, onRemovePath, onRescan, settings, onSettingChange, lastfm, setEqGain, eqFiltersRef, EQ_FREQS }) {
  const { t } = useTranslation(['common', 'settings']);

  const TABS = [
    { id: 'library',      label: t('library', { ns: 'common' }),  icon: Database },
    { id: 'player',       label: t('player', { ns: 'common' }),  icon: Music2 },
    { id: 'general',      label: t('general', { ns: 'common' }),      icon: Sliders },
    { id: 'appearance',   label: t('appearance', { ns: 'common' }),      icon: Monitor },
    { id: 'integrations', label: t('integrations', { ns: 'common' }),  icon: Radio },
    { id: 'about',        label: t('about', { ns: 'common' }),        icon: Info },
  ];

  const VISUALIZER_MODES = [
    { id: 'nebula', label: t('visualizerModes.nebula', { ns: 'settings' }), desc: t('visualizerModes.nebulaDesc', { ns: 'settings' }) },
    { id: 'bars', label: t('visualizerModes.bars', { ns: 'settings' }), desc: t('visualizerModes.barsDesc', { ns: 'settings' }) },
    { id: 'tunnel', label: t('visualizerModes.tunnel', { ns: 'settings' }), desc: t('visualizerModes.tunnelDesc', { ns: 'settings' }) },
    { id: 'aurora', label: t('visualizerModes.aurora', { ns: 'settings' }), desc: t('visualizerModes.auroraDesc', { ns: 'settings' }) },
  ];
  const [activeTab, setActiveTab]   = useState('library');
  const [visible,   setVisible]     = useState(true);
  const [animDir,   setAnimDir]     = useState(1);
  const [appVersion, setAppVersion] = useState('…');
  const [appIcon,    setAppIcon]    = useState(null);
  const animRef = useRef(null);

  const API_URL = (typeof window !== 'undefined' && window.location?.protocol === 'http:') ? '/api' : 'http://localhost:3001/api';

  // Pobierz wersję dynamicznie z server.js który czyta package.json
  useEffect(() => {
    fetch(`${API_URL}/version`).then(r => r.json()).then(d => setAppVersion(d.version)).catch(() => {});
    ipcRenderer.invoke('get-app-icon').then(src => { if (src) setAppIcon(src); }).catch(() => {});
  }, []);
  const [lfmConfig,   setLfmConfig]   = useState(null);
  const [lfmApiKey,   setLfmApiKey]   = useState('');
  const [lfmSecret,   setLfmSecret]   = useState('');
  const [lfmSaving,   setLfmSaving]   = useState(false);
  const [lfmMsg,      setLfmMsg]      = useState('');
  const [updateInfo,  setUpdateInfo]  = useState(null);
  const [checkingUpd, setCheckingUpd] = useState(false);
  const [lfmToken,    setLfmToken]    = useState('');

  const loadLfmConfig = useCallback(async () => {
    try { const r = await fetch(`${API_URL}/lastfm/config`); if (r.ok) setLfmConfig(await r.json()); } catch {}
  }, [API_URL, t]);
  const lastfmLoadConfig = lastfm?.loadConfig;
  const toggleLastfm = lastfm?.toggleLastfm;

  useEffect(() => { loadLfmConfig(); }, [loadLfmConfig]);

  useEffect(() => {
    const es = new EventSource(`${API_URL}/events`);
    es.addEventListener('lastfm_connected', async (e) => {
      await loadLfmConfig();
      await lastfmLoadConfig?.();
      toggleLastfm?.(true);
      const d = JSON.parse(e.data);
      setLfmMsg(`Zalogowano jako ${d.username} ✓`);
    });
    return () => es.close();
  }, [API_URL, loadLfmConfig, lastfmLoadConfig, toggleLastfm]);

  const switchTab = (id) => {
    if (id === activeTab) return;
    const currentIdx = TABS.findIndex(t => t.id === activeTab);
    const nextIdx    = TABS.findIndex(t => t.id === id);
    setAnimDir(nextIdx > currentIdx ? 1 : -1);
    setVisible(false);
    clearTimeout(animRef.current);
    animRef.current = setTimeout(() => {
      setActiveTab(id);
      setVisible(true);
    }, 110);
  };

  const saveLfmConfig = async () => {
    if (!lfmApiKey.trim() || !lfmSecret.trim()) { setLfmMsg(t('lastfmFillBothFields', { ns: 'settings' })); return; }
    setLfmSaving(true); setLfmMsg('');
    try {
      const r = await fetch(`${API_URL}/lastfm/config`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ apiKey: lfmApiKey.trim(), apiSecret: lfmSecret.trim() }) });
      if (r.ok) { setLfmMsg(t('lastfmSaved', { ns: 'settings' })); await loadLfmConfig(); }
      else setLfmMsg(t('lastfmError', { ns: 'settings' }));
    } catch { setLfmMsg(t('lastfmConnectionError', { ns: 'settings' })); } finally { setLfmSaving(false); }
  };

  const connectLastfm = () => {
    if (!lfmConfig?.apiKey) { setLfmMsg(t('lastfmSaveConfigFirst', { ns: 'settings' })); return; }
    const cb  = encodeURIComponent('http://localhost:3001/api/lastfm/callback');
    const url = `https://www.last.fm/api/auth/?api_key=${lfmConfig.apiKey}&cb=${cb}`;
    ipcRenderer.invoke('open-external', url);
    setLfmMsg(t('lastfmAuthInBrowser', { ns: 'settings' }));
  };

  const verifyToken = async () => {
    if (!lfmToken.trim()) { setLfmMsg(t('lastfmPasteToken', { ns: 'settings' })); return; }
    setLfmSaving(true); setLfmMsg('');
    try {
      const r = await fetch(`${API_URL}/lastfm/auth`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token: lfmToken.trim() }) });
      const d = await r.json();
      if (d.ok) {
        setLfmMsg(t('lastfmConnected', { ns: 'settings', username: d.username }) + ' ✓');
        await loadLfmConfig();
        await lastfmLoadConfig?.();
        toggleLastfm?.(true);
        setLfmToken('');
      }
      else setLfmMsg(d.error || t('lastfmVerificationError', { ns: 'settings' }));
    } catch { setLfmMsg(t('lastfmConnectionError', { ns: 'settings' })); } finally { setLfmSaving(false); }
  };

  const disconnectLastfm = async () => {
    await fetch(`${API_URL}/lastfm/config`, { method: 'DELETE' });
    toggleLastfm?.(false);
    await lastfmLoadConfig?.();
    setLfmConfig(null); setLfmMsg(t('lastfmLoggedOut', { ns: 'settings' }));
  };

  const checkUpdate = async () => {
    setCheckingUpd(true); setUpdateInfo(null);
    try { const r = await fetch(`${API_URL}/update/check`); if (r.ok) setUpdateInfo(await r.json()); } catch {}
    finally { setCheckingUpd(false); }
  };

  /* Logika zależności między opcjami */
  const handleSettingChange = (id, val) => {
    if (id === 'crossfade' && val && settings.gaplessPlayback)
      onSettingChange('gaplessPlayback', false);
    if (id === 'gaplessPlayback' && val && settings.crossfade)
      onSettingChange('crossfade', false);
    if (id === 'minimizeToTray' && !val) {
      if (settings.startMinimized)   onSettingChange('startMinimized', false);
      if (settings.showTrayControls) onSettingChange('showTrayControls', false);
    }
    onSettingChange(id, val);
  };

  const s = settings;
  const librarySize = library.reduce((sum, song) => sum + (Number(song.filesize) || 0), 0);

  return (
    <div className="p-8 max-w-3xl mx-auto">
      <h2 className="text-3xl font-black mb-6 tracking-tight">{t('settings', { ns: 'common' })}</h2>

      {/* ─── Tab bar ─── */}
      <div className="relative flex gap-1 mb-6 bg-zinc-900/60 p-1 rounded-2xl border border-zinc-800/80">
        {TABS.map(({ id }, i) => (
          <div
            key={id}
            className="absolute inset-y-1 rounded-xl pointer-events-none transition-all duration-300 ease-out"
            style={{
              opacity:    activeTab === id ? 1 : 0,
              left:       `calc(${i} * (100% / ${TABS.length}) + 4px)`,
              width:      `calc(100% / ${TABS.length} - 8px)`,
              background: 'linear-gradient(135deg, var(--accent-from), var(--accent-to))',
              boxShadow:  activeTab === id ? '0 2px 14px var(--accent-glow)' : 'none',
            }}
          />
        ))}
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => switchTab(id)}
            className={`relative z-10 flex-1 flex items-center justify-center gap-2 py-2.5 px-2 rounded-xl text-xs font-semibold transition-colors duration-150
              ${activeTab === id ? 'text-white' : 'text-zinc-500 hover:text-zinc-200'}`}
          >
            <Icon size={13} className="flex-shrink-0" />
            <span className="hidden sm:inline truncate">{label}</span>
          </button>
        ))}
      </div>

      {/* ─── Zawartość z animacją ─── */}
      <div
        className="space-y-4"
        style={{
          opacity:    visible ? 1 : 0,
          transform:  visible ? 'translateX(0)' : `translateX(${animDir * 16}px)`,
          transition: 'opacity 110ms ease-out, transform 110ms ease-out',
        }}
      >

        {activeTab === 'library' && (<>
          <Card title={t('musicFolders', { ns: 'settings' })} subtitle={t('musicFoldersDesc', { ns: 'settings' })}
            action={
              <button onClick={onRescan} disabled={scanInfo.isScanning}
                className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full border transition-colors ${
                  scanInfo.isScanning ? 'border-zinc-700 text-zinc-600 cursor-not-allowed' : 'border-zinc-700 text-zinc-400 hover:border-zinc-500 hover:text-white'
                }`}>
                <RefreshCw size={11} className={scanInfo.isScanning ? 'animate-spin' : ''} />
                {scanInfo.isScanning ? `${scanInfo.scanned||0}/${scanInfo.total||0}` : t('rescan', { ns: 'common' })}
              </button>
            }
          >
            {musicPaths.length === 0 ? (
              <div className="border border-dashed border-zinc-800 rounded-lg py-8 text-center">
                <Database size={28} className="mx-auto mb-2 text-zinc-700" />
                <p className="text-sm text-zinc-600">{t('addFolder', { ns: 'common' })} {t('below', { ns: 'common' })}.</p>
              </div>
            ) : (
              <div className="space-y-2 mb-4 overflow-y-auto custom-scrollbar pr-1" style={{ maxHeight: '220px' }}>
                {musicPaths.map(p => (
                  <div key={p} className="flex justify-between items-center bg-black/30 px-4 py-2.5 rounded-lg border border-zinc-800/60 group">
                    <span className="font-mono text-xs text-zinc-300 truncate">{p}</span>
                    <button onClick={() => onRemovePath(p)} className="text-zinc-700 hover:text-red-400 transition-colors flex-shrink-0 ml-3 opacity-0 group-hover:opacity-100">
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>
            )}
            <button onClick={onAddFolder}
              className="w-full py-2.5 rounded-xl flex items-center justify-center gap-2 font-semibold transition-all text-sm accent-gradient hover:opacity-90"
              onMouseEnter={e => e.currentTarget.style.boxShadow = '0 4px 18px var(--accent-glow)'}
              onMouseLeave={e => e.currentTarget.style.boxShadow = 'none'}
            >
              <FolderPlus size={16} /> {t('addMusicFolder', { ns: 'settings' })}
            </button>
          </Card>
          <Card title={t('libraryStats', { ns: 'settings' })}>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                [t('tracks', { ns: 'settings' }), library.length], 
                [t('folders', { ns: 'settings' }), musicPaths.length], 
                [t('storage', { ns: 'settings' }), formatBytes(librarySize)], 
                [t('databaseType', { ns: 'settings' }), 'SQLite']
              ].map(([label, val]) => (
                <div key={label} className="bg-black/30 rounded-xl p-3 text-center border border-zinc-800/40">
                  <p className="text-[10px] text-zinc-600 uppercase tracking-wide mb-1">{label}</p>
                  <p className="text-lg font-black accent-text">{val}</p>
                </div>
              ))}
            </div>
          </Card>
        </>)}

        {activeTab === 'player' && (<>
          <Card title={t('playerBehavior', { ns: 'settings' })}>
            <Toggle label={t('playLastOnStart', { ns: 'settings' })} desc={t('playLastOnStartDesc', { ns: 'settings' })}
              value={s.autoPlayLast??false} onChange={v => handleSettingChange('autoPlayLast', v)} />
            <Toggle label={t('fadeInOnPlay', { ns: 'settings' })} desc={t('fadeInOnPlayDesc', { ns: 'settings' })}
              value={s.fadeInOnPlay??false} onChange={v => handleSettingChange('fadeInOnPlay', v)} />
            <Toggle label={t('replayGain', { ns: 'settings' })} desc={t('replayGainDesc', { ns: 'settings' })}
              value={s.replayGainEnabled??false} onChange={v => handleSettingChange('replayGainEnabled', v)} />
          </Card>

          <Card title={t('transitions', { ns: 'settings' })} subtitle={t('transitionsDesc', { ns: 'settings' })}>
            <Toggle label={t('gaplessPlayback', { ns: 'settings' })} desc={t('gaplessPlaybackDesc', { ns: 'settings' })}
              value={s.gaplessPlayback??false} onChange={v => handleSettingChange('gaplessPlayback', v)} />
            <Toggle label={t('crossfade', { ns: 'settings' })} desc={t('crossfadeDesc', { ns: 'settings' })}
              value={s.crossfade??false} onChange={v => handleSettingChange('crossfade', v)} />
            {s.gaplessPlayback && s.crossfade && (
              <Warn>{t('gaplessCrossfadeConflict', { ns: 'settings' })}</Warn>
            )}
          </Card>

          <Card title={t('defaultSettings', { ns: 'settings' })}>
            {[
              { id:'defaultShuffle', label:t('defaultShuffle', { ns: 'settings' }),  desc:t('defaultShuffleDesc', { ns: 'settings' }) },
              { id:'rememberVolume', label:t('rememberVolume', { ns: 'settings' }),      desc:t('rememberVolumeDesc', { ns: 'settings' }) },
              { id:'rememberQueue',  label:t('rememberQueue', { ns: 'settings' }),       desc:t('rememberQueueDesc', { ns: 'settings' }) },
            ].map(({ id, label, desc }) => (
              <Toggle key={id} label={label} desc={desc} value={s[id]??false} onChange={v => handleSettingChange(id, v)} />
            ))}
          </Card>

          {setEqGain && <EqualizerPanel setEqGain={setEqGain} eqFiltersRef={eqFiltersRef} EQ_FREQS={EQ_FREQS} />}
        </>)}

        {activeTab === 'general' && (<>
          <Card title={t('traySettings', { ns: 'settings' })} subtitle={t('traySettingsDesc', { ns: 'settings' })}>
            <Toggle label={t('minimizeToTray', { ns: 'settings' })} desc={t('minimizeToTrayDesc', { ns: 'settings' })}
              value={s.minimizeToTray??true} onChange={v => handleSettingChange('minimizeToTray', v)} />
            <Toggle label={t('startMinimized', { ns: 'settings' })} desc={t('startMinimizedDesc', { ns: 'settings' })}
              value={s.startMinimized??false} onChange={v => handleSettingChange('startMinimized', v)}
              disabled={!s.minimizeToTray} disabledReason={t('requiresMinimizeToTray', { ns: 'settings' })} />
            <Toggle label={t('showTrayControls', { ns: 'settings' })} desc={t('showTrayControlsDesc', { ns: 'settings' })}
              value={s.showTrayControls??true} onChange={v => handleSettingChange('showTrayControls', v)}
              disabled={!s.minimizeToTray} disabledReason={t('requiresMinimizeToTray', { ns: 'settings' })} />
          </Card>

          <Card title={t('systemIntegrations', { ns: 'settings' })}>
            <Toggle label={t('mprisEnabled', { ns: 'settings' })} desc={t('mprisEnabledDesc', { ns: 'settings' })}
              value={s.mprisEnabled??true} onChange={v => handleSettingChange('mprisEnabled', v)} />
          </Card>

          <Card title={t('language', { ns: 'common' })} subtitle={t('selectLanguage', { ns: 'common' })}>
            <div className="grid grid-cols-2 gap-2">
              {AVAILABLE_LANGUAGES.map(lang => {
                const currentLang = i18n.language || 'pl';
                const active = currentLang.startsWith(lang);
                const langName = lang === 'pl' ? t('polish', { ns: 'common' }) : t('english', { ns: 'common' });
                return (
                  <button
                    key={lang}
                    onClick={() => changeLanguage(lang)}
                    className={`text-left p-3 rounded-xl border transition-all ${
                      active
                        ? 'accent-bg accent-border text-white shadow-[0_0_18px_var(--accent-glow)]'
                        : 'bg-black/25 border-zinc-800 text-zinc-400 hover:border-zinc-600 hover:text-zinc-200'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <Globe size={16} className={active ? 'accent-text' : 'text-zinc-500'} />
                      <span className="text-sm font-semibold">{langName}</span>
                    </div>
                    <p className="text-[11px] text-zinc-500 mt-1">{lang.toUpperCase()}</p>
                  </button>
                );
              })}
            </div>
          </Card>
        </>)}

        {activeTab === 'appearance' && (<>
          <Card title={t('theme', { ns: 'settings' })} subtitle={t('themeDesc', { ns: 'settings' })}>
            <div className="grid grid-cols-5 gap-3">
              {THEMES.map(theme => {
                const active = (s.theme || 'fuchsia') === theme.id;
                return (
                  <button key={theme.id} onClick={() => handleSettingChange('theme', theme.id)} title={theme.label}
                    className={`relative aspect-square rounded-xl border-2 transition-all duration-200 overflow-hidden group ${
                      active ? 'border-white scale-[1.06]' : 'border-transparent hover:border-zinc-500 hover:scale-[1.03]'
                    }`}
                    style={{
                      background: `linear-gradient(135deg, ${theme.from}, ${theme.to})`,
                      boxShadow: active ? `0 4px 20px ${theme.from}55` : undefined,
                    }}
                  >
                    {active && (
                      <div className="absolute inset-0 flex items-center justify-center bg-black/25">
                        <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                          <path d="M4 10l4 4 8-8" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      </div>
                    )}
                    <div className="absolute bottom-0 left-0 right-0 py-1 bg-black/40 text-white text-[10px] font-medium text-center opacity-0 group-hover:opacity-100 transition-opacity">
                      {theme.label}
                    </div>
                  </button>
                );
              })}
            </div>
          </Card>

          <Card title={t('interface', { ns: 'settings' })}>
            <Toggle label={t('transitionAnimations', { ns: 'settings' })} desc={t('transitionAnimationsDesc', { ns: 'settings' })}
              value={s.animationsEnabled??true} onChange={v => handleSettingChange('animationsEnabled', v)} />
            <Toggle label={t('audioVisualizer', { ns: 'settings' })} desc={t('audioVisualizerDesc', { ns: 'settings' })}
              value={s.showVisualizer??true} onChange={v => handleSettingChange('showVisualizer', v)} />
            <Toggle label={t('compactMode', { ns: 'settings' })} desc={t('compactModeDesc', { ns: 'settings' })}
              value={s.compactMode??false} onChange={v => handleSettingChange('compactMode', v)} />
            <Toggle label={t('albumColors', { ns: 'settings' })} desc={t('albumColorsDesc', { ns: 'settings' })}
              value={s.showAlbumColors??true} onChange={v => handleSettingChange('showAlbumColors', v)} />
          </Card>

          <Card title={t('visualizerSettings', { ns: 'settings' })} subtitle={t('visualizerSettingsDesc', { ns: 'settings' })}>
            <Toggle label={t('visualizerBackdrop', { ns: 'settings' })} desc={t('visualizerBackdropDesc', { ns: 'settings' })}
              value={s.showVisualizerBackdrop??true} onChange={v => handleSettingChange('showVisualizerBackdrop', v)}
              disabled={!s.showVisualizer || !s.showAlbumColors}
              disabledReason={!s.showVisualizer ? t('requiresVisualizer', { ns: 'settings' }) : t('requiresAlbumColors', { ns: 'settings' })} />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {VISUALIZER_MODES.map(mode => {
                const active = (s.visualizerMode || 'nebula') === mode.id;
                return (
                  <button
                    key={mode.id}
                    onClick={() => handleSettingChange('visualizerMode', mode.id)}
                    className={`text-left p-3 rounded-xl border transition-all ${
                      active
                        ? 'accent-bg accent-border text-white shadow-[0_0_18px_var(--accent-glow)]'
                        : 'bg-black/25 border-zinc-800 text-zinc-400 hover:border-zinc-600 hover:text-zinc-200'
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <div
                        className="w-10 h-5 rounded-full border border-white/10"
                        style={{
                          background: mode.id === 'bars'
                            ? 'repeating-linear-gradient(90deg, var(--accent-from) 0 4px, transparent 4px 8px)'
                            : mode.id === 'tunnel'
                            ? 'radial-gradient(circle, transparent 28%, var(--accent-from) 30%, transparent 34%, var(--accent-to) 48%, transparent 52%)'
                            : mode.id === 'aurora'
                            ? 'linear-gradient(135deg, transparent, var(--accent-from), var(--accent-to), transparent)'
                            : 'radial-gradient(circle, var(--accent-from), var(--accent-to), transparent)',
                        }}
                      />
                      <span className="text-sm font-semibold">{mode.label}</span>
                    </div>
                    <p className="text-[11px] text-zinc-500">{mode.desc}</p>
                  </button>
                );
              })}
            </div>
          </Card>

          <Card title={t('playerBarButtons', { ns: 'settings' })} subtitle={t('playerBarButtonsDesc', { ns: 'settings' })}>
            <Toggle
              label={t('showNowPlaying', { ns: 'settings' })}
              desc={t('showNowPlayingDesc', { ns: 'settings' })}
              value={s.showBtnNowPlaying??false}
              onChange={v => handleSettingChange('showBtnNowPlaying', v)}
            />
            <Toggle
              label={t('showEqualizer', { ns: 'settings' })}
              desc={t('showEqualizerDesc', { ns: 'settings' })}
              value={s.showBtnEqualizer??true}
              onChange={v => handleSettingChange('showBtnEqualizer', v)}
            />
            <Toggle
              label={t('showSleepTimer', { ns: 'settings' })}
              desc={t('showSleepTimerDesc', { ns: 'settings' })}
              value={s.showBtnSleepTimer??true}
              onChange={v => handleSettingChange('showBtnSleepTimer', v)}
            />
          </Card>
        </>)}

        {activeTab === 'integrations' && (<>
          <Card title={t('lastfm', { ns: 'settings' })} subtitle={t('lastfmDesc', { ns: 'settings' })}>
            {lfmConfig?.hasSession ? (
              <div className="py-2">
                <div className="flex items-center gap-2 mb-3">
                  <CheckCircle2 size={16} className="text-green-400 flex-shrink-0" />
                  <span className="text-sm text-green-400 font-medium">{t('lastfmConnected', { ns: 'settings', username: lfmConfig.username })}</span>
                </div>
                <Toggle
                  label={t('lastfmScrobbling', { ns: 'settings' })}
                  desc={t('lastfmScrobblingDesc', { ns: 'settings' })}
                  value={lastfm?.lastfmOn ?? true}
                  onChange={v => lastfm?.toggleLastfm?.(v)}
                />
                <button onClick={disconnectLastfm} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-red-400 bg-red-400/10 hover:bg-red-400/20 transition-colors">
                  <XCircle size={12} /> {t('lastfmDisconnect', { ns: 'settings' })}
                </button>
              </div>
            ) : (
              <div className="space-y-3 py-2">
                <p className="text-xs text-zinc-500">
                  {t('lastfmNeedAccountPart1', { ns: 'settings' })}
                  <a onClick={() => ipcRenderer.invoke('open-external', 'https://www.last.fm/api/account/create')} className="accent-text hover:underline inline-flex items-center gap-0.5 cursor-pointer">last.fm <ExternalLink size={10} /></a>
                  {t('lastfmNeedAccountPart2', { ns: 'settings' })}
                </p>
                <div className="grid grid-cols-1 gap-2">
                  <div>
                    <label className="text-[11px] text-zinc-500 mb-1 block">{t('lastfmApiKey', { ns: 'settings' })}</label>
                    <input value={lfmApiKey} onChange={e => setLfmApiKey(e.target.value)} placeholder={t('lastfmApiKeyPlaceholder', { ns: 'settings' })}
                      className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-xs text-white placeholder-zinc-600 focus:outline-none focus:border-zinc-500" />
                  </div>
                  <div>
                    <label className="text-[11px] text-zinc-500 mb-1 block">{t('lastfmSharedSecret', { ns: 'settings' })}</label>
                    <input value={lfmSecret} onChange={e => setLfmSecret(e.target.value)} type="password" placeholder={t('lastfmSharedSecretPlaceholder', { ns: 'settings' })}
                      className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-xs text-white placeholder-zinc-600 focus:outline-none focus:border-zinc-500" />
                  </div>
                </div>
                <div className="flex gap-2 flex-wrap">
                  <button onClick={saveLfmConfig} disabled={lfmSaving}
                    className="px-3 py-1.5 rounded-lg text-xs bg-zinc-700 hover:bg-zinc-600 text-white disabled:opacity-50 transition-colors">
                    {lfmSaving ? t('saving', { ns: 'common' }) : t('lastfmSaveKeys', { ns: 'settings' })}
                  </button>
                  {lfmConfig?.apiKey && (
                    <button onClick={connectLastfm}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs accent-bg accent-text border accent-border transition-colors">
                      <ExternalLink size={11} /> {t('lastfmConnect', { ns: 'settings' })}
                    </button>
                  )}
                </div>
                {lfmConfig?.apiKey && (
                  <div>
                    <p className="text-[11px] text-zinc-500 mb-1">{t('lastfmEnterToken', { ns: 'settings', token: <code className="text-zinc-400">token=...</code> })}</p>
                    <div className="flex gap-2">
                      <input value={lfmToken} onChange={e => setLfmToken(e.target.value)} placeholder={t('lastfmPasteToken', { ns: 'settings' })}
                        className="flex-1 bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-xs text-white placeholder-zinc-600 focus:outline-none focus:border-zinc-500" />
                      <button onClick={verifyToken} disabled={lfmSaving}
                        className="px-3 py-1.5 rounded-lg text-xs accent-bg accent-text border accent-border disabled:opacity-50 transition-colors">
                        {t('lastfmVerify', { ns: 'settings' })}
                      </button>
                    </div>
                  </div>
                )}
                {lfmMsg && <p className="text-xs text-zinc-400 mt-1">{lfmMsg}</p>}
              </div>
            )}
          </Card>
        </>)}

        {activeTab === 'about' && (<>
          <div className="flex flex-col items-center text-center py-8 mb-2">
            <div className="w-24 h-24 rounded-3xl overflow-hidden mb-4 shadow-2xl border border-zinc-700/50">
              <img src={appIcon || '/icons/neonpulse-player.png'} onError={e => { e.target.style.display='none'; }} alt="NeonPulse" className="w-full h-full object-cover" />
            </div>
            <h2 className="text-3xl font-black tracking-tight mb-1">
              <span className="accent-text">NEON</span>PULSE
            </h2>
            <p className="text-zinc-500 text-sm mb-3">{t('audioEngine', { ns: 'settings' })}</p>
            <div className="flex items-center gap-2 px-4 py-1.5 rounded-full bg-zinc-800 border border-zinc-700/50 text-xs text-zinc-400 mb-1">
              <span className="w-2 h-2 rounded-full bg-green-400 inline-block"></span>
              {t('version', { ns: 'common' })}) <strong className="text-white ml-1">{appVersion}</strong>
            </div>
            <p className="text-xs text-zinc-600 mt-2">{t('production', { ns: 'settings', year: 2026 })}</p>
          </div>

          <Card title={t('author', { ns: 'common' })} subtitle={t('projectCreator', { ns: 'settings' })}>
            <div className="flex items-center gap-3 py-2">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center flex-shrink-0 text-white font-bold text-sm">P</div>
              <div>
                <p className="text-sm font-semibold text-white">Paffcio</p>
                <p className="text-xs text-zinc-500">{t('developerAndUIDesigner', { ns: 'settings' })}</p>
              </div>
              <Heart size={14} className="text-red-400 ml-auto flex-shrink-0" />
            </div>
          </Card>

          <Card title={t('updateCheck', { ns: 'settings' })} subtitle={t('updateCheckDesc', { ns: 'settings' })}>
            <div className="py-2 space-y-3">
              <button onClick={checkUpdate} disabled={checkingUpd}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs bg-zinc-800 hover:bg-zinc-700 text-white disabled:opacity-50 transition-colors">
                <RefreshCw size={12} className={checkingUpd ? 'animate-spin' : ''} />
                {checkingUpd ? t('checkingForUpdates', { ns: 'settings' }) : t('checkForUpdates', { ns: 'settings' })}
              </button>
              {updateInfo && (
                <div className={`flex items-start gap-2 p-3 rounded-xl border text-xs ${
                  updateInfo.hasUpdate ? 'bg-green-950/40 border-green-800/50 text-green-300' : 'bg-zinc-800/50 border-zinc-700/50 text-zinc-400'
                }`}>
                  {updateInfo.hasUpdate
                    ? <><CheckCircle2 size={14} className="text-green-400 flex-shrink-0 mt-0.5" /><div>
                        <p className="font-medium">{t('updateAvailable', { ns: 'settings', version: updateInfo.latest })}!</p>
                        <p className="text-zinc-400 mt-0.5">{t('currentVersion', { ns: 'settings', version: updateInfo.current })}</p>
                        <div className="flex gap-2 mt-2 flex-wrap">
                          {updateInfo.downloads?.appimage && (
                            <a onClick={() => ipcRenderer.invoke('open-external', updateInfo.downloads.appimage)}
                              className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-zinc-700 hover:bg-zinc-600 text-zinc-200 cursor-pointer transition-colors">
                              <ExternalLink size={10} /> {t('downloadAppImage', { ns: 'settings' })}
                            </a>
                          )}
                          {updateInfo.downloads?.deb && (
                            <a onClick={() => ipcRenderer.invoke('open-external', updateInfo.downloads.deb)}
                              className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-zinc-700 hover:bg-zinc-600 text-zinc-200 cursor-pointer transition-colors">
                              <ExternalLink size={10} /> {t('downloadDeb', { ns: 'settings' })}
                            </a>
                          )}
                          {updateInfo.pageUrl && (
                            <a onClick={() => ipcRenderer.invoke('open-external', updateInfo.pageUrl)}
                              className="inline-flex items-center gap-1 accent-text hover:underline cursor-pointer">
                              <ExternalLink size={10} /> {t('githubRelease', { ns: 'settings' })}
                            </a>
                          )}
                        </div>
                      </div></>
                    : <><CheckCircle2 size={14} className="flex-shrink-0 mt-0.5" /><p>{t('upToDate', { ns: 'settings', version: updateInfo.current })}</p></>
                  }
                </div>
              )}
            </div>
          </Card>

          <Card title={t('technologies', { ns: 'settings' })} subtitle={t('technologiesDesc', { ns: 'settings' })}>
            <div className="grid grid-cols-2 gap-2 py-2">
              {[
                { name: 'Electron',       desc: t('electronDesc', { ns: 'settings' }),       color: 'text-blue-400' },
                { name: 'React 18',       desc: t('reactDesc', { ns: 'settings' }),       color: 'text-cyan-400' },
                { name: 'Vite',           desc: t('viteDesc', { ns: 'settings' }),           color: 'text-yellow-400' },
                { name: 'Tailwind CSS',   desc: t('tailwindDesc', { ns: 'settings' }),   color: 'text-teal-400' },
                { name: 'SQLite',         desc: t('sqliteDesc', { ns: 'settings' }),         color: 'text-orange-400' },
                { name: 'Express.js',     desc: t('expressDesc', { ns: 'settings' }),     color: 'text-green-400' },
                { name: 'music-metadata', desc: t('musicMetadataDesc', { ns: 'settings' }), color: 'text-pink-400' },
                { name: 'Last.fm API',    desc: t('lastfmApiDesc', { ns: 'settings' }),    color: 'text-red-400' },
                { name: 'Web Audio API',  desc: t('webAudioDesc', { ns: 'settings' }),  color: 'text-purple-400' },
                { name: 'MPRIS D-Bus',    desc: t('mprisDesc', { ns: 'settings' }),    color: 'text-indigo-400' },
                { name: 'Lucide React',   desc: t('lucideDesc', { ns: 'settings' }),   color: 'text-zinc-400' },
                { name: 'Node.js',        desc: t('nodejsDesc', { ns: 'settings' }),        color: 'text-lime-400' },
              ].map(({ name, desc, color }) => (
                <div key={name} className="flex items-start gap-2 p-2 rounded-lg bg-zinc-800/40 border border-zinc-700/30">
                  <span className={`text-[10px] font-bold mt-0.5 flex-shrink-0 ${color}`}>●</span>
                  <div>
                    <p className="text-xs font-semibold text-white">{name}</p>
                    <p className="text-[10px] text-zinc-500">{desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </Card>

          <Card title={t('info', { ns: 'settings' })} subtitle={t('infoDesc', { ns: 'settings' })}>
            <div className="py-2 space-y-2 text-xs text-zinc-500">
              <p>{t('neonPulseDescription', { ns: 'settings' })}</p>
              <p>{t('openSource', { ns: 'settings', year: 2026 })}</p>
              <div className="flex gap-2 mt-3 flex-wrap">
                <a onClick={() => ipcRenderer.invoke('open-external', 'https://github.com/PaffcioStudio/neonpulse')}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 transition-colors cursor-pointer">
                  <Github size={12} /> {t('github', { ns: 'common' })}
                </a>
                <a onClick={() => ipcRenderer.invoke('open-external', 'mailto:pawelpotrykus94@gmail.com')}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 transition-colors cursor-pointer text-xs">
                  pawelpotrykus94@gmail.com
                </a>
              </div>
            </div>
          </Card>
        </>)}

      </div>
    </div>
  );
}

function Card({ title, subtitle, action, children }) {
  return (
    <div className="rounded-2xl border border-zinc-800/60 overflow-hidden" style={{ background: 'linear-gradient(160deg, rgba(39,39,42,0.7) 0%, rgba(24,24,27,0.8) 100%)' }}>
      <div className="px-5 py-4 flex items-start justify-between" style={{ borderBottom: '1px solid rgba(255,255,255,0.04)', background: 'rgba(255,255,255,0.015)' }}>
        <div>
          <h3 className="font-semibold text-sm text-white tracking-tight">{title}</h3>
          {subtitle && <p className="text-xs text-zinc-500 mt-0.5 leading-snug">{subtitle}</p>}
        </div>
        {action}
      </div>
      <div className="px-5 py-3">{children}</div>
    </div>
  );
}

function Warn({ children }) {
  return (
    <div className="flex items-start gap-2 mt-2 mb-1 px-3 py-2.5 rounded-xl border text-xs"
      style={{ background: 'rgba(245,158,11,0.07)', borderColor: 'rgba(245,158,11,0.25)', color: '#fbbf24' }}>
      <AlertTriangle size={13} className="flex-shrink-0 mt-0.5" />
      <span>{children}</span>
    </div>
  );
}

function Toggle({ label, desc, value, onChange, disabled = false, disabledReason }) {
  return (
    <label
      className={`flex items-center justify-between py-2.5 group ${disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}`}
      style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}
      title={disabled && disabledReason ? disabledReason : undefined}
    >
      <div className="pr-4 min-w-0">
        <p className="text-sm font-medium text-zinc-300 group-hover:text-white transition-colors leading-snug">{label}</p>
        {desc && <p className="text-xs text-zinc-600 mt-0.5 leading-snug">{desc}</p>}
        {disabled && disabledReason && (
          <p className="text-[11px] mt-0.5 flex items-center gap-1" style={{ color: 'rgba(251,191,36,0.7)' }}>
            <AlertTriangle size={10} className="flex-shrink-0" /> {disabledReason}
          </p>
        )}
      </div>
      <div
        onClick={(e) => { e.preventDefault(); if (!disabled) onChange(!value); }}
        className={`relative w-10 h-5 rounded-full transition-all duration-200 flex-shrink-0 ${
          value && !disabled ? 'accent-gradient' : 'bg-zinc-800 border border-zinc-700'
        }`}
        style={value && !disabled ? { boxShadow: '0 0 8px var(--accent-glow)' } : {}}
      >
        <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow-md transition-all duration-200 ${value ? 'left-[22px]' : 'left-0.5'}`} />
      </div>
    </label>
  );
}
