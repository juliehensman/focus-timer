import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Settings, Play, Pause, SkipForward, RotateCcw, X, Plus, Minus, Trash2, Check, Volume2, VolumeX, Zap, ZapOff } from 'lucide-react';

const DEFAULT_PRESETS = [
  { id: 'classic',   name: 'Classic',    focus: 25, shortBreak: 5,  longBreak: 15, sessions: 4, builtIn: true },
  { id: 'deep-work', name: 'Deep Work',  focus: 50, shortBreak: 10, longBreak: 20, sessions: 3, builtIn: true },
  { id: 'sprint',    name: 'Sprint',     focus: 15, shortBreak: 3,  longBreak: 15, sessions: 6, builtIn: true },
  { id: 'ultradian', name: 'Ultradian',  focus: 90, shortBreak: 20, longBreak: 30, sessions: 2, builtIn: true },
];

const COLORS = {
  bg:        '#F2EDE4',
  card:      '#FAF7F0',
  ink:       '#1C1A17',
  muted:     '#8A8175',
  faint:     '#B8AE9E',
  border:    '#E0D8C8',
  focus:     '#A8451F',
  shortBrk:  '#4F6B4F',
  longBrk:   '#2E5266',
};

const PHASE_META = {
  focus:      { label: 'focus',       color: COLORS.focus,    full: 'focus session' },
  shortBreak: { label: 'short break', color: COLORS.shortBrk, full: 'short break' },
  longBreak:  { label: 'long break',  color: COLORS.longBrk,  full: 'long break' },
};

const SERIF = "'Fraunces', 'Iowan Old Style', 'Hoefler Text', Georgia, serif";
const MONO  = "'JetBrains Mono', ui-monospace, 'SF Mono', Menlo, monospace";
const SANS  = "'Geist', -apple-system, BlinkMacSystemFont, 'Helvetica Neue', sans-serif";

function NumberField({ value, onChange, min = 1, max = 180, unit = 'min' }) {
  return (
    <div className="flex items-center gap-2" style={{ fontFamily: MONO }}>
      <button
        onClick={() => onChange(Math.max(min, value - 1))}
        className="w-7 h-7 flex items-center justify-center rounded-full transition-colors"
        style={{ background: COLORS.bg, color: COLORS.ink }}
        aria-label="Decrease"
      >
        <Minus size={13} strokeWidth={1.8} />
      </button>
      <div className="w-14 text-center text-sm tabular-nums" style={{ color: COLORS.ink }}>
        {value}<span style={{ color: COLORS.faint, marginLeft: 3 }}>{unit}</span>
      </div>
      <button
        onClick={() => onChange(Math.min(max, value + 1))}
        className="w-7 h-7 flex items-center justify-center rounded-full transition-colors"
        style={{ background: COLORS.bg, color: COLORS.ink }}
        aria-label="Increase"
      >
        <Plus size={13} strokeWidth={1.8} />
      </button>
    </div>
  );
}

function Toggle({ on, onChange, iconOn, iconOff }) {
  return (
    <button
      onClick={() => onChange(!on)}
      className="relative inline-flex items-center transition-colors rounded-full"
      style={{
        width: 44,
        height: 24,
        background: on ? COLORS.ink : COLORS.border,
      }}
      aria-pressed={on}
    >
      <span
        className="absolute flex items-center justify-center rounded-full transition-all"
        style={{
          width: 18,
          height: 18,
          top: 3,
          left: on ? 23 : 3,
          background: COLORS.card,
          color: COLORS.ink,
        }}
      >
        {on ? iconOn : iconOff}
      </span>
    </button>
  );
}

export default function FocusTimer() {
  // Inject Google Fonts
  useEffect(() => {
    const id = 'focus-timer-fonts';
    if (document.getElementById(id)) return;
    const link = document.createElement('link');
    link.id = id;
    link.rel = 'stylesheet';
    link.href = 'https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,200..600&family=JetBrains+Mono:wght@400;500&family=Geist:wght@400;500;600&display=swap';
    document.head.appendChild(link);
  }, []);

  // ── State ──────────────────────────────────────────────────────────────
  const [customPresets, setCustomPresets] = useState([]);
  const [storageReady, setStorageReady] = useState(false);

  const [settings, setSettings] = useState(DEFAULT_PRESETS[0]);
  const [activePresetId, setActivePresetId] = useState('classic');

  const [phase, setPhase] = useState('focus');           // focus | shortBreak | longBreak
  const [sessionIndex, setSessionIndex] = useState(0);   // completed focus sessions in current cycle
  const [running, setRunning] = useState(false);
  const [endTime, setEndTime] = useState(null);
  const [pausedRemaining, setPausedRemaining] = useState(null);
  const [now, setNow] = useState(Date.now());

  const [autoStart, setAutoStart] = useState(false);
  const [soundOn, setSoundOn]     = useState(true);

  const [settingsOpen, setSettingsOpen] = useState(false);
  const [saveOpen, setSaveOpen]         = useState(false);
  const [newName, setNewName]           = useState('');

  // ── Load + persist presets / prefs ─────────────────────────────────────
  useEffect(() => {
    (async () => {
      try {
        const p = await window.storage.get('focus:presets');
        if (p?.value) setCustomPresets(JSON.parse(p.value));
      } catch (e) { /* none saved */ }
      try {
        const pr = await window.storage.get('focus:prefs');
        if (pr?.value) {
          const v = JSON.parse(pr.value);
          if (typeof v.autoStart === 'boolean') setAutoStart(v.autoStart);
          if (typeof v.soundOn === 'boolean')   setSoundOn(v.soundOn);
          if (v.lastPresetId) {
            const all = [...DEFAULT_PRESETS, ...(JSON.parse((await window.storage.get('focus:presets'))?.value || '[]'))];
            const found = all.find(x => x.id === v.lastPresetId);
            if (found) { setSettings(found); setActivePresetId(found.id); }
          }
        }
      } catch (e) { /* none saved */ }
      setStorageReady(true);
    })();
  }, []);

  useEffect(() => {
    if (!storageReady) return;
    window.storage.set('focus:presets', JSON.stringify(customPresets)).catch(() => {});
  }, [customPresets, storageReady]);

  useEffect(() => {
    if (!storageReady) return;
    window.storage.set('focus:prefs', JSON.stringify({
      autoStart, soundOn, lastPresetId: activePresetId,
    })).catch(() => {});
  }, [autoStart, soundOn, activePresetId, storageReady]);

  const allPresets = [...DEFAULT_PRESETS, ...customPresets];

  // ── Timer tick ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => setNow(Date.now()), 200);
    return () => clearInterval(id);
  }, [running]);

  const phaseMinutes =
    phase === 'focus'      ? settings.focus      :
    phase === 'shortBreak' ? settings.shortBreak :
                             settings.longBreak;
  const phaseDurationMs = phaseMinutes * 60 * 1000;

  const remainingMs = running
    ? Math.max(0, (endTime ?? 0) - now)
    : (pausedRemaining ?? phaseDurationMs);

  const remainingSec = Math.ceil(remainingMs / 1000);
  const mins = Math.floor(remainingSec / 60);
  const secs = remainingSec % 60;

  const progress = 1 - Math.max(0, Math.min(1, remainingMs / phaseDurationMs));

  // ── Chime ──────────────────────────────────────────────────────────────
  const playChime = useCallback(() => {
    if (!soundOn) return;
    try {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      const ctx = new Ctx();
      const notes = [523.25, 659.25, 783.99]; // C5, E5, G5 — soft triad
      notes.forEach((freq, i) => {
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.connect(g);
        g.connect(ctx.destination);
        o.frequency.value = freq;
        o.type = 'sine';
        const t = ctx.currentTime + i * 0.12;
        g.gain.setValueAtTime(0, t);
        g.gain.linearRampToValueAtTime(0.18, t + 0.04);
        g.gain.exponentialRampToValueAtTime(0.001, t + 1.4);
        o.start(t);
        o.stop(t + 1.5);
      });
    } catch (e) { /* audio unavailable */ }
  }, [soundOn]);

  // ── Phase transition ───────────────────────────────────────────────────
  const transitionedRef = useRef(false);

  const advancePhase = useCallback(() => {
    let nextPhase, nextIndex = sessionIndex;
    if (phase === 'focus') {
      nextIndex = sessionIndex + 1;
      if (nextIndex >= settings.sessions) {
        nextPhase = 'longBreak';
        nextIndex = 0;
      } else {
        nextPhase = 'shortBreak';
      }
    } else {
      nextPhase = 'focus';
    }
    setPhase(nextPhase);
    setSessionIndex(nextIndex);
    setPausedRemaining(null);
    setRunning(false);

    if (autoStart) {
      const dur =
        nextPhase === 'focus'      ? settings.focus      :
        nextPhase === 'shortBreak' ? settings.shortBreak :
                                     settings.longBreak;
      setTimeout(() => {
        setEndTime(Date.now() + dur * 60 * 1000);
        setRunning(true);
      }, 700);
    }
  }, [phase, sessionIndex, settings, autoStart]);

  useEffect(() => {
    if (running && remainingMs <= 0 && !transitionedRef.current) {
      transitionedRef.current = true;
      playChime();
      advancePhase();
    }
    if (remainingMs > 200) transitionedRef.current = false;
  }, [running, remainingMs, playChime, advancePhase]);

  // ── Controls ───────────────────────────────────────────────────────────
  const start = () => {
    const dur = pausedRemaining ?? phaseDurationMs;
    setEndTime(Date.now() + dur);
    setPausedRemaining(null);
    setRunning(true);
  };
  const pauseTimer = () => {
    setPausedRemaining(remainingMs);
    setRunning(false);
  };
  const reset = () => {
    setRunning(false);
    setPausedRemaining(null);
    setPhase('focus');
    setSessionIndex(0);
  };
  const skip = () => {
    setRunning(false);
    setPausedRemaining(null);
    playChime();
    advancePhase();
  };

  const selectPreset = (p) => {
    setActivePresetId(p.id);
    setSettings(p);
    setRunning(false);
    setPausedRemaining(null);
    setPhase('focus');
    setSessionIndex(0);
  };

  const updateSetting = (key, value) => {
    setSettings(s => ({ ...s, [key]: value }));
    setActivePresetId(null);
    setRunning(false);
    setPausedRemaining(null);
  };

  const savePreset = () => {
    const name = newName.trim();
    if (!name) return;
    const np = {
      id: 'custom-' + Date.now(),
      name,
      focus: settings.focus,
      shortBreak: settings.shortBreak,
      longBreak: settings.longBreak,
      sessions: settings.sessions,
      builtIn: false,
    };
    setCustomPresets(arr => [...arr, np]);
    setActivePresetId(np.id);
    setSettings(np);
    setNewName('');
    setSaveOpen(false);
  };

  const deletePreset = (id) => {
    setCustomPresets(arr => arr.filter(x => x.id !== id));
    if (activePresetId === id) selectPreset(DEFAULT_PRESETS[0]);
  };

  const phaseColor = PHASE_META[phase].color;
  const fmt = (n) => String(n).padStart(2, '0');

  // ── Render ─────────────────────────────────────────────────────────────
  return (
    <div
      className="min-h-screen w-full flex items-center justify-center p-4"
      style={{
        background: COLORS.bg,
        fontFamily: SANS,
        color: COLORS.ink,
        backgroundImage: `radial-gradient(circle at 20% 0%, rgba(168,69,31,0.04), transparent 60%), radial-gradient(circle at 80% 100%, rgba(46,82,102,0.04), transparent 60%)`,
      }}
    >
      <div className="w-full max-w-md">
        {/* ── Header ───────────────────────────────────────────────── */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <div
              className="text-[10px] uppercase tracking-[0.25em]"
              style={{ color: COLORS.muted, fontFamily: MONO }}
            >
              Focus
            </div>
            <div
              className="text-2xl leading-none mt-1"
              style={{ fontFamily: SERIF, fontWeight: 300, fontStyle: 'italic', letterSpacing: '-0.01em' }}
            >
              Deep work, on a timer.
            </div>
          </div>
          <button
            onClick={() => setSettingsOpen(true)}
            className="w-10 h-10 flex items-center justify-center rounded-full transition-all"
            style={{ background: COLORS.card, border: `1px solid ${COLORS.border}`, color: COLORS.ink }}
            aria-label="Settings"
          >
            <Settings size={16} strokeWidth={1.5} />
          </button>
        </div>

        {/* ── Preset chips ─────────────────────────────────────────── */}
        <div className="-mx-1 mb-8 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
          <style>{`.preset-scroll::-webkit-scrollbar { display: none; }`}</style>
          <div className="preset-scroll flex gap-2 px-1 pb-1" style={{ scrollbarWidth: 'none' }}>
            {allPresets.map(p => {
              const active = activePresetId === p.id;
              return (
                <button
                  key={p.id}
                  onClick={() => selectPreset(p)}
                  className="px-4 py-2 rounded-full whitespace-nowrap transition-all text-xs"
                  style={{
                    background: active ? COLORS.ink : COLORS.card,
                    color: active ? COLORS.card : COLORS.ink,
                    border: `1px solid ${active ? COLORS.ink : COLORS.border}`,
                    fontFamily: MONO,
                    fontWeight: 500,
                    letterSpacing: '0.02em',
                  }}
                >
                  {p.name}
                </button>
              );
            })}
            {activePresetId === null && (
              <div
                className="px-4 py-2 rounded-full whitespace-nowrap text-xs flex items-center gap-1.5"
                style={{
                  background: 'transparent',
                  color: COLORS.muted,
                  border: `1px dashed ${COLORS.border}`,
                  fontFamily: MONO,
                  fontStyle: 'italic',
                }}
              >
                Custom
              </div>
            )}
          </div>
        </div>

        {/* ── Main card ────────────────────────────────────────────── */}
        <div
          className="relative rounded-2xl overflow-hidden"
          style={{
            background: COLORS.card,
            border: `1px solid ${COLORS.border}`,
            boxShadow: '0 1px 0 rgba(0,0,0,0.02), 0 30px 60px -30px rgba(28,26,23,0.12)',
          }}
        >
          {/* phase indicator strip */}
          <div className="flex items-center justify-between px-6 pt-6 pb-2">
            <div className="flex items-center gap-2">
              <span
                className="inline-block rounded-full"
                style={{ width: 6, height: 6, background: phaseColor }}
              />
              <span
                className="text-[10px] uppercase tracking-[0.25em]"
                style={{ color: COLORS.muted, fontFamily: MONO }}
              >
                {PHASE_META[phase].full}
              </span>
            </div>
            <span
              className="text-[10px] uppercase tracking-[0.25em] tabular-nums"
              style={{ color: COLORS.muted, fontFamily: MONO }}
            >
              {phase === 'focus' ? `${sessionIndex + 1} / ${settings.sessions}` : '—'}
            </span>
          </div>

          {/* timer */}
          <div className="px-6 pt-6 pb-8 flex flex-col items-center">
            <div
              className="tabular-nums leading-none select-none"
              style={{
                fontFamily: SERIF,
                fontWeight: 250,
                fontSize: 'clamp(86px, 22vw, 132px)',
                letterSpacing: '-0.04em',
                color: COLORS.ink,
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              {fmt(mins)}<span style={{ color: COLORS.faint, fontWeight: 200 }}>:</span>{fmt(secs)}
            </div>

            {/* progress hairline */}
            <div
              className="w-full mt-8 rounded-full overflow-hidden"
              style={{ height: 2, background: COLORS.border }}
            >
              <div
                className="h-full transition-all"
                style={{
                  width: `${progress * 100}%`,
                  background: phaseColor,
                  transitionDuration: running ? '200ms' : '300ms',
                }}
              />
            </div>

            {/* session dots */}
            <div className="flex items-center gap-2 mt-6">
              {Array.from({ length: settings.sessions }).map((_, i) => {
                const done = i < sessionIndex;
                const current = i === sessionIndex && phase === 'focus';
                return (
                  <span
                    key={i}
                    className="rounded-full transition-all"
                    style={{
                      width: current ? 18 : 6,
                      height: 6,
                      background: done || current ? COLORS.focus : COLORS.border,
                    }}
                  />
                );
              })}
            </div>
          </div>

          {/* controls */}
          <div className="px-6 pb-6 flex items-center justify-center gap-3">
            <button
              onClick={reset}
              className="w-12 h-12 flex items-center justify-center rounded-full transition-all"
              style={{ background: 'transparent', border: `1px solid ${COLORS.border}`, color: COLORS.muted }}
              aria-label="Reset"
            >
              <RotateCcw size={15} strokeWidth={1.5} />
            </button>

            <button
              onClick={running ? pauseTimer : start}
              className="h-14 px-8 flex items-center justify-center gap-2 rounded-full transition-all"
              style={{
                background: COLORS.ink,
                color: COLORS.card,
                minWidth: 160,
                fontFamily: MONO,
                fontSize: 12,
                fontWeight: 500,
                letterSpacing: '0.18em',
                textTransform: 'uppercase',
              }}
            >
              {running ? <Pause size={14} strokeWidth={2} fill={COLORS.card} /> : <Play size={14} strokeWidth={2} fill={COLORS.card} />}
              {running ? 'Pause' : (pausedRemaining ? 'Resume' : 'Begin')}
            </button>

            <button
              onClick={skip}
              className="w-12 h-12 flex items-center justify-center rounded-full transition-all"
              style={{ background: 'transparent', border: `1px solid ${COLORS.border}`, color: COLORS.muted }}
              aria-label="Skip phase"
            >
              <SkipForward size={15} strokeWidth={1.5} />
            </button>
          </div>
        </div>

        {/* ── Footer hint ─────────────────────────────────────────── */}
        <div
          className="mt-6 text-center text-[10px] uppercase tracking-[0.25em]"
          style={{ color: COLORS.faint, fontFamily: MONO }}
        >
          {settings.focus}m focus · {settings.shortBreak}m short · {settings.longBreak}m long · ×{settings.sessions}
        </div>
      </div>

      {/* ── Settings sheet ──────────────────────────────────────────── */}
      {settingsOpen && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center"
          style={{ background: 'rgba(28,26,23,0.4)', backdropFilter: 'blur(4px)' }}
          onClick={() => setSettingsOpen(false)}
        >
          <div
            className="w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl overflow-hidden"
            style={{
              background: COLORS.card,
              border: `1px solid ${COLORS.border}`,
              maxHeight: '90vh',
              overflowY: 'auto',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* header */}
            <div
              className="flex items-center justify-between px-6 py-4 sticky top-0"
              style={{ background: COLORS.card, borderBottom: `1px solid ${COLORS.border}` }}
            >
              <div>
                <div
                  className="text-[10px] uppercase tracking-[0.25em]"
                  style={{ color: COLORS.muted, fontFamily: MONO }}
                >
                  Customize
                </div>
                <div
                  className="text-xl mt-0.5"
                  style={{ fontFamily: SERIF, fontWeight: 300, fontStyle: 'italic' }}
                >
                  {activePresetId
                    ? allPresets.find(p => p.id === activePresetId)?.name ?? 'Custom'
                    : 'Custom'}
                </div>
              </div>
              <button
                onClick={() => setSettingsOpen(false)}
                className="w-9 h-9 flex items-center justify-center rounded-full"
                style={{ background: COLORS.bg, color: COLORS.ink }}
                aria-label="Close"
              >
                <X size={16} strokeWidth={1.5} />
              </button>
            </div>

            {/* durations */}
            <div className="px-6 py-5">
              <div
                className="text-[10px] uppercase tracking-[0.25em] mb-4"
                style={{ color: COLORS.muted, fontFamily: MONO }}
              >
                Durations
              </div>
              <div className="space-y-3">
                {[
                  { key: 'focus',      label: 'Focus',         max: 180, color: COLORS.focus    },
                  { key: 'shortBreak', label: 'Short break',   max: 60,  color: COLORS.shortBrk },
                  { key: 'longBreak',  label: 'Long break',    max: 90,  color: COLORS.longBrk  },
                ].map(row => (
                  <div key={row.key} className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span
                        className="inline-block rounded-full"
                        style={{ width: 6, height: 6, background: row.color }}
                      />
                      <span style={{ fontSize: 14, color: COLORS.ink }}>{row.label}</span>
                    </div>
                    <NumberField
                      value={settings[row.key]}
                      onChange={(v) => updateSetting(row.key, v)}
                      min={1}
                      max={row.max}
                    />
                  </div>
                ))}
                <div className="flex items-center justify-between pt-1">
                  <div className="flex items-center gap-3">
                    <span
                      className="inline-block rounded-full"
                      style={{ width: 6, height: 6, background: COLORS.faint }}
                    />
                    <span style={{ fontSize: 14, color: COLORS.ink }}>Sessions per cycle</span>
                  </div>
                  <NumberField
                    value={settings.sessions}
                    onChange={(v) => updateSetting('sessions', v)}
                    min={1}
                    max={10}
                    unit="×"
                  />
                </div>
              </div>
            </div>

            <div style={{ borderTop: `1px solid ${COLORS.border}` }} />

            {/* options */}
            <div className="px-6 py-5">
              <div
                className="text-[10px] uppercase tracking-[0.25em] mb-4"
                style={{ color: COLORS.muted, fontFamily: MONO }}
              >
                Options
              </div>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <div style={{ fontSize: 14, color: COLORS.ink }}>Auto-start next phase</div>
                    <div className="text-xs mt-0.5" style={{ color: COLORS.muted }}>
                      Roll into the next session without tapping
                    </div>
                  </div>
                  <Toggle
                    on={autoStart}
                    onChange={setAutoStart}
                    iconOn={<Zap size={10} strokeWidth={2} fill={COLORS.ink} />}
                    iconOff={<ZapOff size={10} strokeWidth={2} />}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <div style={{ fontSize: 14, color: COLORS.ink }}>Chime on transition</div>
                    <div className="text-xs mt-0.5" style={{ color: COLORS.muted }}>
                      Soft triad when a phase ends
                    </div>
                  </div>
                  <Toggle
                    on={soundOn}
                    onChange={setSoundOn}
                    iconOn={<Volume2 size={10} strokeWidth={2} />}
                    iconOff={<VolumeX size={10} strokeWidth={2} />}
                  />
                </div>
              </div>
            </div>

            <div style={{ borderTop: `1px solid ${COLORS.border}` }} />

            {/* save / delete */}
            <div className="px-6 py-5">
              <div
                className="text-[10px] uppercase tracking-[0.25em] mb-4"
                style={{ color: COLORS.muted, fontFamily: MONO }}
              >
                Preset
              </div>

              {saveOpen ? (
                <div className="space-y-3">
                  <input
                    type="text"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="Preset name"
                    autoFocus
                    className="w-full px-4 py-3 rounded-xl outline-none"
                    style={{
                      background: COLORS.bg,
                      border: `1px solid ${COLORS.border}`,
                      fontSize: 14,
                      color: COLORS.ink,
                      fontFamily: SANS,
                    }}
                    onKeyDown={(e) => { if (e.key === 'Enter') savePreset(); }}
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={() => { setSaveOpen(false); setNewName(''); }}
                      className="flex-1 py-3 rounded-xl transition-all"
                      style={{
                        background: 'transparent',
                        border: `1px solid ${COLORS.border}`,
                        color: COLORS.muted,
                        fontFamily: MONO,
                        fontSize: 11,
                        letterSpacing: '0.18em',
                        textTransform: 'uppercase',
                      }}
                    >
                      Cancel
                    </button>
                    <button
                      onClick={savePreset}
                      disabled={!newName.trim()}
                      className="flex-1 py-3 rounded-xl transition-all flex items-center justify-center gap-2"
                      style={{
                        background: newName.trim() ? COLORS.ink : COLORS.border,
                        color: newName.trim() ? COLORS.card : COLORS.muted,
                        fontFamily: MONO,
                        fontSize: 11,
                        letterSpacing: '0.18em',
                        textTransform: 'uppercase',
                      }}
                    >
                      <Check size={12} strokeWidth={2} />
                      Save
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => setSaveOpen(true)}
                  className="w-full py-3 rounded-xl transition-all flex items-center justify-center gap-2"
                  style={{
                    background: 'transparent',
                    border: `1px dashed ${COLORS.border}`,
                    color: COLORS.ink,
                    fontFamily: MONO,
                    fontSize: 11,
                    letterSpacing: '0.18em',
                    textTransform: 'uppercase',
                  }}
                >
                  <Plus size={12} strokeWidth={2} />
                  Save current as preset
                </button>
              )}

              {customPresets.length > 0 && (
                <div className="mt-5">
                  <div
                    className="text-[10px] uppercase tracking-[0.25em] mb-3"
                    style={{ color: COLORS.muted, fontFamily: MONO }}
                  >
                    Your presets
                  </div>
                  <div className="space-y-1">
                    {customPresets.map(p => (
                      <div
                        key={p.id}
                        className="flex items-center justify-between py-2 px-3 rounded-lg"
                        style={{ background: COLORS.bg }}
                      >
                        <div>
                          <div style={{ fontSize: 13, color: COLORS.ink }}>{p.name}</div>
                          <div
                            className="text-[10px] tabular-nums mt-0.5"
                            style={{ color: COLORS.muted, fontFamily: MONO }}
                          >
                            {p.focus}m · {p.shortBreak}m · {p.longBreak}m · ×{p.sessions}
                          </div>
                        </div>
                        <button
                          onClick={() => deletePreset(p.id)}
                          className="w-8 h-8 flex items-center justify-center rounded-full transition-all"
                          style={{ color: COLORS.muted }}
                          aria-label={`Delete ${p.name}`}
                        >
                          <Trash2 size={13} strokeWidth={1.5} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="h-2" />
          </div>
        </div>
      )}
    </div>
  );
}
