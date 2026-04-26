import React, { useState, useEffect, useCallback } from 'react';
import { FolderPlus, Trash2, RefreshCw, Monitor, Sliders, Music2, Database, Radio, ExternalLink, CheckCircle2, XCircle, Info, Github, Heart } from 'lucide-react';
import { THEMES } from '../../utils';
import EqualizerPanel from '../EqualizerPanel';

const TABS = [
  { id: 'library',      label: 'Biblioteka',  icon: Database },
  { id: 'player',       label: 'Odtwarzacz',  icon: Music2 },
  { id: 'general',      label: 'Ogólne',      icon: Sliders },
  { id: 'appearance',   label: 'Wygląd',      icon: Monitor },
  { id: 'integrations', label: 'Integracje',  icon: Radio },
  { id: 'about',        label: 'Info',        icon: Info },
];

export default function SettingsView({ musicPaths, library, scanInfo, onAddFolder, onRemovePath, onRescan, settings, onSettingChange, setEqGain, eqFiltersRef, EQ_FREQS }) {
  const [activeTab, setActiveTab] = useState('library');

  // Last.fm state
  const API_URL = (typeof window !== 'undefined' && window.location?.protocol === 'http:') ? '/api' : 'http://localhost:3001/api';
  const [lfmConfig,   setLfmConfig]   = useState(null);
  const [lfmApiKey,   setLfmApiKey]   = useState('');
  const [lfmSecret,   setLfmSecret]   = useState('');
  const [lfmSaving,   setLfmSaving]   = useState(false);
  const [lfmMsg,      setLfmMsg]      = useState('');
  const [updateInfo,  setUpdateInfo]  = useState(null);
  const [checkingUpd, setCheckingUpd] = useState(false);

  const loadLfmConfig = useCallback(async () => {
    try { const r = await fetch(`${API_URL}/lastfm/config`); if (r.ok) setLfmConfig(await r.json()); } catch {}
  }, [API_URL]);

  useEffect(() => { loadLfmConfig(); }, [loadLfmConfig]);

  const saveLfmConfig = async () => {
    if (!lfmApiKey.trim() || !lfmSecret.trim()) { setLfmMsg('Uzupełnij oba pola'); return; }
    setLfmSaving(true); setLfmMsg('');
    try {
      const r = await fetch(`${API_URL}/lastfm/config`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ apiKey: lfmApiKey.trim(), apiSecret: lfmSecret.trim() }) });
      if (r.ok) { setLfmMsg('Zapisano! Teraz kliknij Połącz z Last.fm'); await loadLfmConfig(); }
      else setLfmMsg('Błąd zapisu');
    } catch { setLfmMsg('Błąd połączenia'); } finally { setLfmSaving(false); }
  };

  const connectLastfm = () => {
    if (!lfmConfig?.apiKey) { setLfmMsg('Najpierw zapisz API Key'); return; }
    const cb = encodeURIComponent('http://localhost:3001/api/lastfm/callback');
    window.open(`https://www.last.fm/api/auth/?api_key=${lfmConfig.apiKey}&cb=${cb}`, '_blank');
    setLfmMsg('Po autoryzacji wróć tutaj i kliknij "Weryfikuj token"');
  };

  const [lfmToken, setLfmToken] = useState('');
  const verifyToken = async () => {
    if (!lfmToken.trim()) { setLfmMsg('Wklej token z URL'); return; }
    setLfmSaving(true); setLfmMsg('');
    try {
      const r = await fetch(`${API_URL}/lastfm/auth`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token: lfmToken.trim() }) });
      const d = await r.json();
      if (d.ok) { setLfmMsg(`Zalogowano jako ${d.username} ✓`); await loadLfmConfig(); setLfmToken(''); }
      else setLfmMsg(d.error || 'Błąd weryfikacji');
    } catch { setLfmMsg('Błąd połączenia'); } finally { setLfmSaving(false); }
  };

  const disconnectLastfm = async () => {
    await fetch(`${API_URL}/lastfm/config`, { method: 'DELETE' });
    setLfmConfig(null); setLfmMsg('Wylogowano');
  };

  const checkUpdate = async () => {
    setCheckingUpd(true); setUpdateInfo(null);
    try { const r = await fetch(`${API_URL}/update/check`); if (r.ok) setUpdateInfo(await r.json()); } catch {}
    finally { setCheckingUpd(false); }
  };

  return (
    <div className="p-8 max-w-3xl mx-auto">
      <h2 className="text-3xl font-black mb-6 tracking-tight">Ustawienia</h2>

      {/* Tab bar */}
      <div className="flex gap-1 mb-6 bg-zinc-900/60 p-1 rounded-xl border border-zinc-800">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-sm font-medium transition-all ${
              activeTab === id
                ? 'text-white shadow-lg accent-gradient'
                : 'text-zinc-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <Icon size={14} />
            <span className="hidden sm:inline">{label}</span>
          </button>
        ))}
      </div>

      <div className="space-y-4">

        {/* ── BIBLIOTEKA ── */}
        {activeTab === 'library' && (<>
          <Card title="Foldery muzyki" subtitle="NeonPulse skanuje te foldery i obserwuje nowe pliki w czasie rzeczywistym"
            action={
              <button onClick={onRescan} disabled={scanInfo.isScanning}
                className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full border transition-colors ${
                  scanInfo.isScanning ? 'border-zinc-700 text-zinc-600 cursor-not-allowed' : 'border-zinc-700 text-zinc-400 hover:border-zinc-500 hover:text-white'
                }`}>
                <RefreshCw size={11} className={scanInfo.isScanning ? 'animate-spin' : ''} />
                {scanInfo.isScanning ? `${scanInfo.scanned||0}/${scanInfo.total||0}` : 'Reskan'}
              </button>
            }
          >
            {musicPaths.length === 0 ? (
              <div className="border border-dashed border-zinc-800 rounded-lg py-8 text-center">
                <Database size={28} className="mx-auto mb-2 text-zinc-700" />
                <p className="text-sm text-zinc-600">Brak folderów. Dodaj poniżej.</p>
              </div>
            ) : (
              <div className="space-y-2 mb-4">
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
              className="w-full py-2.5 rounded-lg flex items-center justify-center gap-2 font-semibold transition-colors text-sm accent-gradient hover:opacity-90">
              <FolderPlus size={16} /> Dodaj folder z muzyką
            </button>
          </Card>

          <Card title="Statystyki">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                ['Utwory', library.length],
                ['Foldery', musicPaths.length],
                ['Silnik', 'SQLite'],
                ['Tryb', 'WAL'],
              ].map(([label, val]) => (
                <div key={label} className="bg-black/30 rounded-lg p-3 text-center">
                  <p className="text-[10px] text-zinc-600 uppercase tracking-wide mb-1">{label}</p>
                  <p className="text-lg font-black accent-text">{val}</p>
                </div>
              ))}
            </div>
          </Card>
        </>)}

        {/* ── ODTWARZACZ ── */}
        {activeTab === 'player' && (<>
          <Card title="Zachowanie">
            {[
              { id:'autoPlayLast',    label:'Odtwarzaj ostatni utwór przy starcie',     desc:'Wznawia od miejsca gdzie skończyłeś' },
              { id:'continueOnStart', label:'Wznów odtwarzanie po uruchomieniu',        desc:'Jeśli był aktywny, wznowi automatycznie' },
              { id:'gaplessPlayback', label:'Odtwarzanie bez przerw (gapless)',         desc:'Minimalizuje ciszę między utworami' },
              { id:'crossfade',       label:'Crossfade między utworami (2s)',           desc:'Płynne przejście – eksperymentalne' },
              { id:'fadeInOnPlay',    label:'Fade-in przy starcie utworu (0.8s)',       desc:'Delikatne wejście głośności zamiast nagłego startu' },
              { id:'replayGainEnabled', label:'ReplayGain – normalizacja głośności',   desc:'Wyrównuje głośność między utworami na podstawie tagów' },
            ].map(({ id, label, desc }) => <Toggle key={id} label={label} desc={desc} value={settings[id]??false} onChange={v=>onSettingChange(id,v)} />)}
          </Card>
          <Card title="Domyślne">
            {[
              { id:'defaultShuffle', label:'Domyślnie włącz shuffle', desc:'Shuffle aktywny po uruchomieniu' },
              { id:'rememberVolume', label:'Zapamiętuj głośność',     desc:'Przywróć ostatnią głośność przy starcie' },
              { id:'rememberQueue',  label:'Zapamiętuj kolejkę',      desc:'Przywróć kolejkę po restarcie' },
            ].map(({ id, label, desc }) => <Toggle key={id} label={label} desc={desc} value={settings[id]??false} onChange={v=>onSettingChange(id,v)} />)}
          </Card>
          {setEqGain && (
            <EqualizerPanel setEqGain={setEqGain} eqFiltersRef={eqFiltersRef} EQ_FREQS={EQ_FREQS} />
          )}
        </>)}

        {/* ── OGÓLNE ── */}
        {activeTab === 'general' && (<>
          <Card title="Ikona systemowa (Tray)">
            {[
              { id:'minimizeToTray',   label:'Minimalizuj do traya przy zamknięciu', desc:'Zamiast zamykać, ukryj w zasobniku systemowym' },
              { id:'startMinimized',   label:'Uruchom zminimalizowany',              desc:'Aplikacja startuje w tle bez okna' },
              { id:'showTrayControls', label:'Pokaż Play/Pause/Next w menu traya',  desc:'Dodatkowe kontrolki w kontekstowym menu traya' },
            ].map(({ id, label, desc }) => <Toggle key={id} label={label} desc={desc} value={settings[id]??true} onChange={v=>onSettingChange(id,v)} />)}
          </Card>
          <Card title="System i integracje">
            {[
              { id:'mprisEnabled',  label:'Integracja MPRIS (Linux)',  desc:'Kontrola z klawiszy multimedialnych i panelu systemu' },
              { id:'hardwareAccel', label:'Akceleracja sprzętowa',     desc:'Lepsza wydajność renderowania – wymaga restartu' },
            ].map(({ id, label, desc }) => <Toggle key={id} label={label} desc={desc} value={settings[id]??true} onChange={v=>onSettingChange(id,v)} />)}
          </Card>
        </>)}

        {/* ── WYGLĄD ── */}
        {activeTab === 'appearance' && (<>
          <Card title="Motyw kolorystyczny" subtitle="Zmienia kolor akcentu w całym interfejsie – od razu">
            <div className="grid grid-cols-5 gap-3">
              {THEMES.map(t => {
                const active = (settings.theme || 'fuchsia') === t.id;
                return (
                  <button key={t.id} onClick={() => onSettingChange('theme', t.id)}
                    title={t.label}
                    className={`relative aspect-square rounded-xl border-2 transition-all overflow-hidden group ${
                      active ? 'border-white shadow-lg scale-[1.04]' : 'border-transparent hover:border-zinc-500 hover:scale-[1.02]'
                    }`}
                    style={{ background: `linear-gradient(135deg, ${t.from}, ${t.to})` }}
                  >
                    {/* Aktywny – checkmark */}
                    {active && (
                      <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                        <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                          <path d="M4 10l4 4 8-8" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      </div>
                    )}
                    {/* Nazwa na hover */}
                    <div className="absolute bottom-0 left-0 right-0 py-1 bg-black/40 text-white text-[10px] font-medium text-center opacity-0 group-hover:opacity-100 transition-opacity">
                      {t.label}
                    </div>
                  </button>
                );
              })}
            </div>
          </Card>

          <Card title="Interfejs">
            {[
              { id:'animationsEnabled', label:'Animacje przejść',                desc:'Płynne przejścia przy zmianie zakładek' },
              { id:'showVisualizer',    label:'Wizualizator audio',               desc:'Słupki częstotliwości na ekranie głównym' },
              { id:'compactMode',       label:'Tryb kompaktowy',                  desc:'Mniejsze wiersze na listach – więcej utworów widocznych naraz' },
              { id:'showAlbumColors',   label:'Kolor ambientu z okładki albumu',  desc:'Subtelne tło dopasowane do koloru aktualnie grającej okładki' },
            ].map(({ id, label, desc }) => <Toggle key={id} label={label} desc={desc} value={settings[id]??true} onChange={v=>onSettingChange(id,v)} />)}
          </Card>
        </>)}

        {activeTab === 'integrations' && (<>
          <Card title="Last.fm – Scrobbling" subtitle="Automatyczne zapisywanie słuchanych utworów do Twojego profilu Last.fm">
            {lfmConfig?.hasSession ? (
              <div className="py-2">
                <div className="flex items-center gap-2 mb-3">
                  <CheckCircle2 size={16} className="text-green-400 flex-shrink-0" />
                  <span className="text-sm text-green-400 font-medium">Zalogowany jako <strong>{lfmConfig.username}</strong></span>
                </div>
                <button onClick={disconnectLastfm} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-red-400 bg-red-400/10 hover:bg-red-400/20 transition-colors">
                  <XCircle size={12} /> Wyloguj z Last.fm
                </button>
              </div>
            ) : (
              <div className="space-y-3 py-2">
                <p className="text-xs text-zinc-500">
                  Potrzebujesz darmowego konta na{' '}
                  <a href="https://www.last.fm/api/account/create" target="_blank" rel="noreferrer" className="accent-text hover:underline inline-flex items-center gap-0.5">last.fm <ExternalLink size={10} /></a>
                  {' '}i własnego API Key.
                </p>
                <div className="grid grid-cols-1 gap-2">
                  <div>
                    <label className="text-[11px] text-zinc-500 mb-1 block">API Key</label>
                    <input value={lfmApiKey} onChange={e => setLfmApiKey(e.target.value)} placeholder="32-znakowy klucz API"
                      className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-xs text-white placeholder-zinc-600 focus:outline-none focus:border-zinc-500" />
                  </div>
                  <div>
                    <label className="text-[11px] text-zinc-500 mb-1 block">Shared Secret</label>
                    <input value={lfmSecret} onChange={e => setLfmSecret(e.target.value)} type="password" placeholder="Shared secret"
                      className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-xs text-white placeholder-zinc-600 focus:outline-none focus:border-zinc-500" />
                  </div>
                </div>
                <div className="flex gap-2 flex-wrap">
                  <button onClick={saveLfmConfig} disabled={lfmSaving}
                    className="px-3 py-1.5 rounded-lg text-xs bg-zinc-700 hover:bg-zinc-600 text-white disabled:opacity-50 transition-colors">
                    {lfmSaving ? 'Zapisuję…' : 'Zapisz klucze'}
                  </button>
                  {lfmConfig?.apiKey && (
                    <button onClick={connectLastfm}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs accent-bg accent-text border accent-border transition-colors">
                      <ExternalLink size={11} /> Połącz z Last.fm
                    </button>
                  )}
                </div>
                {lfmConfig?.apiKey && (
                  <div>
                    <p className="text-[11px] text-zinc-500 mb-1">Po autoryzacji wklej token z URL (parametr <code className="text-zinc-400">token=...</code>):</p>
                    <div className="flex gap-2">
                      <input value={lfmToken} onChange={e => setLfmToken(e.target.value)} placeholder="token z URL"
                        className="flex-1 bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-xs text-white placeholder-zinc-600 focus:outline-none focus:border-zinc-500" />
                      <button onClick={verifyToken} disabled={lfmSaving}
                        className="px-3 py-1.5 rounded-lg text-xs accent-bg accent-text border accent-border disabled:opacity-50 transition-colors">
                        Weryfikuj
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
          <div className="flex flex-col items-center text-center py-8 mb-6">
            <div className="w-24 h-24 rounded-3xl overflow-hidden mb-4 shadow-2xl border border-zinc-700/50">
              <img src="/icons/neonpulse-player.png" onError={e => { e.target.style.display='none'; }} alt="NeonPulse" className="w-full h-full object-cover" />
            </div>
            <h2 className="text-3xl font-black tracking-tight mb-1">
              <span className="accent-text">NEON</span>PULSE
            </h2>
            <p className="text-zinc-500 text-sm mb-3">Audio Engine</p>
            <div className="flex items-center gap-2 px-4 py-1.5 rounded-full bg-zinc-800 border border-zinc-700/50 text-xs text-zinc-400 mb-1">
              <span className="w-2 h-2 rounded-full bg-green-400 inline-block"></span>
              Wersja <strong className="text-white ml-1">3.4.0</strong>
            </div>
            <p className="text-xs text-zinc-600 mt-2">Produkcja 2026</p>
          </div>

          <Card title="Autor" subtitle="Twórca projektu">
            <div className="flex items-center gap-3 py-2">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center flex-shrink-0 text-white font-bold text-sm">P</div>
              <div>
                <p className="text-sm font-semibold text-white">Paffcio</p>
                <p className="text-xs text-zinc-500">Programista, projektant UI</p>
              </div>
              <Heart size={14} className="text-red-400 ml-auto flex-shrink-0" />
            </div>
          </Card>

          <Card title="Aktualizacje" subtitle="Sprawdź czy jest dostępna nowa wersja NeonPulse Player">
            <div className="py-2 space-y-3">
              <button onClick={checkUpdate} disabled={checkingUpd}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs bg-zinc-800 hover:bg-zinc-700 text-white disabled:opacity-50 transition-colors">
                <RefreshCw size={12} className={checkingUpd ? 'animate-spin' : ''} />
                {checkingUpd ? 'Sprawdzam…' : 'Sprawdź aktualizacje'}
              </button>
              {updateInfo && (
                <div className={`flex items-start gap-2 p-3 rounded-xl border text-xs ${
                  updateInfo.hasUpdate
                    ? 'bg-green-950/40 border-green-800/50 text-green-300'
                    : 'bg-zinc-800/50 border-zinc-700/50 text-zinc-400'
                }`}>
                  {updateInfo.hasUpdate
                    ? <><CheckCircle2 size={14} className="text-green-400 flex-shrink-0 mt-0.5" /><div>
                        <p className="font-medium">Dostępna wersja {updateInfo.latest}!</p>
                        <p className="text-zinc-400 mt-0.5">Aktualna: {updateInfo.current}</p>
                        {updateInfo.url && <a href={updateInfo.url} target="_blank" rel="noreferrer"
                          className="inline-flex items-center gap-1 mt-1 accent-text hover:underline">
                          Pobierz <ExternalLink size={10} />
                        </a>}
                      </div></>
                    : <><CheckCircle2 size={14} className="flex-shrink-0 mt-0.5" /><p>Masz najnowszą wersję ({updateInfo.current})</p></>
                  }
                </div>
              )}
            </div>
          </Card>

          <Card title="Użyte technologie" subtitle="Stack technologiczny projektu">
            <div className="grid grid-cols-2 gap-2 py-2">
              {[
                { name: 'Electron',       desc: 'Silnik aplikacji',       color: 'text-blue-400' },
                { name: 'React 18',       desc: 'Interfejs użytkownika',  color: 'text-cyan-400' },
                { name: 'Vite',           desc: 'Bundler / dev server',   color: 'text-yellow-400' },
                { name: 'Tailwind CSS',   desc: 'Style i layout',         color: 'text-teal-400' },
                { name: 'SQLite',         desc: 'Baza danych biblioteki', color: 'text-orange-400' },
                { name: 'Express.js',     desc: 'Backend API',            color: 'text-green-400' },
                { name: 'music-metadata', desc: 'Odczyt tagów audio',     color: 'text-pink-400' },
                { name: 'Last.fm API',    desc: 'Scrobbling',             color: 'text-red-400' },
                { name: 'Web Audio API',  desc: 'Wizualizacja i EQ',      color: 'text-purple-400' },
                { name: 'MPRIS D-Bus',    desc: 'Integracja z Linux',     color: 'text-indigo-400' },
                { name: 'Lucide React',   desc: 'Ikony',                  color: 'text-zinc-400' },
                { name: 'Node.js',        desc: 'Środowisko wykonania',   color: 'text-lime-400' },
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

          <Card title="Licencja i informacje" subtitle="">
            <div className="py-2 space-y-2 text-xs text-zinc-500">
              <p>NeonPulse Player jest oprogramowaniem stworzonym z pasji do muzyki i programowania.</p>
              <p>Projekt rozwijany jako open-source. Wszelkie prawa zastrzeżone © Paffcio 2026.</p>
              <div className="flex gap-2 mt-3">
                <a href="https://github.com/paffcio/neonpulse" target="_blank" rel="noreferrer"
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 transition-colors">
                  <Github size={12} /> GitHub
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
    <div className="rounded-xl border border-zinc-800/60 overflow-hidden" style={{ background: 'linear-gradient(160deg, rgba(39,39,42,0.7) 0%, rgba(24,24,27,0.8) 100%)' }}>
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

function Toggle({ label, desc, value, onChange }) {
  return (
    <label className="flex items-center justify-between py-2.5 cursor-pointer group" style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
      <div className="pr-4">
        <p className="text-sm font-medium text-zinc-300 group-hover:text-white transition-colors leading-snug">{label}</p>
        {desc && <p className="text-xs text-zinc-600 mt-0.5 leading-snug">{desc}</p>}
      </div>
      <div
        onClick={(e) => { e.preventDefault(); onChange(!value); }}
        className={`relative w-10 h-5 rounded-full transition-all duration-200 flex-shrink-0 ${value ? 'accent-gradient' : 'bg-zinc-800 border border-zinc-700'}`}
        style={value ? { boxShadow: '0 0 8px var(--accent-glow)' } : {}}
      >
        <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow-md transition-all duration-200 ${value ? 'left-[22px]' : 'left-0.5'}`} />
      </div>
    </label>
  );
}
