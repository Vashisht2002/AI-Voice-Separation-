// App.js — AI Remix Generator | Glass + Waveform Theme
// © 2026 Vashisht

import React, { useState, useRef, useEffect } from 'react';
import './App.css';

const EFFECTS = [
  { id: 'bollywood', label: 'Bollywood',  icon: '🎬', description: 'Cinematic style'  },
  { id: 'slowdown',  label: 'Slow Down',  icon: '🐢', description: 'Lo-fi tempo'      },
  { id: 'bass',      label: 'Bass Boost', icon: '🔊', description: 'Deep low-end'     },
  { id: 'reverb',    label: 'Reverb',     icon: '🏛️', description: 'Hall echo'        },
  { id: 'pitchup',   label: 'Pitch Up',   icon: '⬆️', description: 'Higher tone'      },
  { id: 'pitchdown', label: 'Pitch Down', icon: '⬇️', description: 'Deeper tone'      },
  { id: 'echo',      label: 'Echo',       icon: '〰️', description: 'Echo waves'       },
  { id: 'lofi',      label: 'Lo-Fi',      icon: '📻', description: 'Vintage sound'    },
];

// Generate animated waveform bars
const BARS = Array.from({ length: 80 }, (_, i) => ({
  id: i,
  height: Math.random() * 60 + 20,
  duration: Math.random() * 1.2 + 0.6,
  delay: Math.random() * 2,
  x: (i / 80) * 100,
}));

export default function App() {
  const [selectedFile,    setSelectedFile]    = useState(null);
  const [uploadedName,    setUploadedName]    = useState('');
  const [fileDuration,    setFileDuration]    = useState(null);
  const [activeTab,       setActiveTab]       = useState('remix');
  const [selectedEffect,  setSelectedEffect]  = useState('');
  const [remixUrl,        setRemixUrl]        = useState('');
  const [downloadName,    setDownloadName]    = useState('');
  const [separatedFiles,  setSeparatedFiles]  = useState(null);
  const [vocalsUrl,       setVocalsUrl]       = useState('');
  const [instrumentalUrl, setInstrumentalUrl] = useState('');
  const [message,         setMessage]         = useState('');
  const [messageType,     setMessageType]     = useState('');
  const [isUploading,     setIsUploading]     = useState(false);
  const [isProcessing,    setIsProcessing]    = useState(false);
  const [isSeparating,    setIsSeparating]    = useState(false);
  const [isDragging,      setIsDragging]      = useState(false);
  const [progress,        setProgress]        = useState(0);
  const [progressLabel,   setProgressLabel]   = useState('');
  const [originalUrl,     setOriginalUrl]     = useState('');

  const simulateProgress = (start, end, durationMs, label) => {
    setProgressLabel(label);
    setProgress(start);
    const steps = 60, interval = durationMs / steps;
    const inc = (end - start) / steps;
    let cur = start;
    const t = setInterval(() => {
      cur += inc;
      if (cur >= end) { cur = end; clearInterval(t); }
      setProgress(Math.round(cur));
    }, interval);
    return t;
  };

  const getAudioDuration = (file) =>
    new Promise((resolve) => {
      const a = document.createElement('audio');
      a.preload = 'metadata';
      a.onloadedmetadata = () => { resolve(a.duration); URL.revokeObjectURL(a.src); };
      a.onerror = () => resolve(null);
      a.src = URL.createObjectURL(file);
    });

  const processFile = async (file) => {
    if (!file) return;
    setRemixUrl(''); setOriginalUrl(''); setDownloadName('');
    setUploadedName(''); setSeparatedFiles(null);
    setVocalsUrl(''); setInstrumentalUrl('');
    setProgress(0); setProgressLabel('');
    setSelectedEffect(''); setMessage('');

    if (!file.type.startsWith('audio/')) {
      setMessageType('error');
      setMessage('Please select a valid audio file — MP3, WAV, OGG, FLAC or M4A.');
      setSelectedFile(null); return;
    }
    if (file.size > 50 * 1024 * 1024) {
      setMessageType('error');
      setMessage('File exceeds 50 MB. Please use a file under 5 minutes.');
      setSelectedFile(null); return;
    }
    const dur = await getAudioDuration(file);
    if (dur && dur > 300) {
      setMessageType('error');
      setMessage(`Audio is ${Math.floor(dur/60)}m ${Math.round(dur%60)}s — maximum is 5 minutes.`);
      setSelectedFile(null); return;
    }
    setFileDuration(dur);
    setSelectedFile(file);
    setOriginalUrl(URL.createObjectURL(file));
    setMessageType('success');
    setMessage(`"${file.name}" is ready to upload.`);
  };

  const handleFileChange = (e) => processFile(e.target.files[0]);
  const handleDragOver   = (e) => { e.preventDefault(); setIsDragging(true); };
  const handleDragLeave  = ()  => setIsDragging(false);
  const handleDrop       = (e) => {
    e.preventDefault(); setIsDragging(false);
    processFile(e.dataTransfer.files[0]);
  };

  const fmt = {
    duration: (s) => !s ? '--:--'
      : `${Math.floor(s/60)}:${Math.round(s%60).toString().padStart(2,'0')}`,
    size: (b) => b < 1048576
      ? (b/1024).toFixed(1)+' KB'
      : (b/1048576).toFixed(1)+' MB',
  };

  const handleUpload = async () => {
    if (!selectedFile) {
      setMessageType('error'); setMessage('Please select a file.'); return;
    }
    setIsUploading(true); setMessageType('info'); setMessage('Uploading…');
    simulateProgress(0, 85, 1800, 'Uploading');
    const fd = new FormData();
    fd.append('file', selectedFile);
    try {
      const res = await fetch('http://localhost:5000/upload', { method:'POST', body:fd });
      const d   = await res.json();
      if (res.ok) {
        setProgress(100); setProgressLabel('Done');
        setUploadedName(d.filename); setMessageType('success');
        setMessage(`"${d.filename}" uploaded successfully.`);
        setTimeout(() => { setProgress(0); setProgressLabel(''); }, 1200);
      } else { setProgress(0); setMessageType('error'); setMessage(d.error); }
    } catch {
      setProgress(0); setMessageType('error');
      setMessage('Cannot connect to server. Is the backend running?');
    }
    setIsUploading(false);
  };

  const handleProcess = async () => {
    if (!uploadedName || !selectedEffect) {
      setMessageType('error'); setMessage('Please upload a file and select an effect.'); return;
    }
    setIsProcessing(true); setRemixUrl(''); setMessageType('info');
    setMessage(`Applying ${EFFECTS.find(e=>e.id===selectedEffect)?.label}…`);
    simulateProgress(0, 90, 7000, 'Processing');
    try {
      const res = await fetch('http://localhost:5000/process', {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ filename: uploadedName, effect: selectedEffect }),
      });
      if (res.ok) {
        setProgress(100); setProgressLabel('Done');
        const blob = await res.blob();
        setRemixUrl(URL.createObjectURL(blob));
        setDownloadName(`${selectedEffect}_remix.mp3`);
        setMessageType('success'); setMessage('Your remix is ready.');
        setTimeout(() => { setProgress(0); setProgressLabel(''); }, 1200);
      } else {
        setProgress(0);
        const d = await res.json();
        setMessageType('error'); setMessage(d.error);
      }
    } catch {
      setProgress(0); setMessageType('error'); setMessage('Processing failed.');
    }
    setIsProcessing(false);
  };

  const handleSeparate = async () => {
    if (!uploadedName) {
      setMessageType('error'); setMessage('Please upload a file first.'); return;
    }
    setIsSeparating(true); setSeparatedFiles(null);
    setVocalsUrl(''); setInstrumentalUrl('');
    setMessageType('info');
    setMessage('Separating vocals — this takes 1 to 3 minutes. Please wait.');
    simulateProgress(0, 75, 480000, 'AI Separating');
    try {
      const res = await fetch('http://localhost:5000/separate', {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ filename: uploadedName }),
      });
      const d = await res.json();
      if (res.ok) {
        setProgress(100); setProgressLabel('Done');
        setSeparatedFiles(d.files);
        if (d.files.vocals) {
          const r = await fetch(`http://localhost:5000/download/${d.files.vocals}`);
          setVocalsUrl(URL.createObjectURL(await r.blob()));
        }
        if (d.files.no_vocals) {
          const r = await fetch(`http://localhost:5000/download/${d.files.no_vocals}`);
          setInstrumentalUrl(URL.createObjectURL(await r.blob()));
        }
        setMessageType('success'); setMessage('Separation complete.');
        setTimeout(() => { setProgress(0); setProgressLabel(''); }, 1200);
      } else { setProgress(0); setMessageType('error'); setMessage(d.error); }
    } catch {
      setProgress(0); setMessageType('error');
      setMessage('Separation failed. Check that the backend is running.');
    }
    setIsSeparating(false);
  };

  const handleReset = () => {
    [originalUrl, remixUrl, vocalsUrl, instrumentalUrl]
      .forEach(u => u && URL.revokeObjectURL(u));
    setSelectedFile(null);    setUploadedName('');
    setFileDuration(null);    setSelectedEffect('');
    setMessage('');           setMessageType('');
    setIsUploading(false);    setIsProcessing(false);
    setIsSeparating(false);   setIsDragging(false);
    setProgress(0);           setProgressLabel('');
    setOriginalUrl('');       setRemixUrl('');
    setDownloadName('');      setSeparatedFiles(null);
    setVocalsUrl('');         setInstrumentalUrl('');
    setActiveTab('remix');
  };

  useEffect(() => {
    return () => [originalUrl, remixUrl, vocalsUrl, instrumentalUrl]
      .forEach(u => u && URL.revokeObjectURL(u));
  }, []);

  return (
    <div className="App">

      {/* ── Deep gradient background ── */}
      <div className="bg-gradient" aria-hidden="true" />

      {/* ── Floating orbs ── */}
      <div className="orb orb-1" aria-hidden="true" />
      <div className="orb orb-2" aria-hidden="true" />
      <div className="orb orb-3" aria-hidden="true" />
      <div className="orb orb-4" aria-hidden="true" />

      {/* ── Animated waveform — bottom of screen ── */}
      <div className="waveform-stage" aria-hidden="true">
        {BARS.map(bar => (
          <div
            key={bar.id}
            className="wave-bar"
            style={{
              left:              `${bar.x}%`,
              height:            `${bar.height}px`,
              animationDuration: `${bar.duration}s`,
              animationDelay:    `${bar.delay}s`,
            }}
          />
        ))}
      </div>

      {/* ── Floating music notes ── */}
      <div className="notes-layer" aria-hidden="true">
        {['♩','♪','♫','♬','𝄞','♩','♪','♫','♬','𝄞','♩','♪'].map((n,i) => (
          <span key={i} className="float-note"
            style={{ '--ni': i, '--ntotal': 12 }}>
            {n}
          </span>
        ))}
      </div>

      <div className="page-wrapper">

        {/* ── Nav ── */}
        <nav className="glass-nav">
          <div className="nav-left">
            <span className="nav-icon">♫</span>
            <span className="nav-brand">AI Remix Generator</span>
          </div>
          <div className="nav-right">
            <span className="nav-copy">© 2026 Vashisht</span>
          </div>
        </nav>

        {/* ── Hero ── */}
        <section className="hero">
          <div className="hero-badge">AI Powered · Studio Quality</div>
          <h1 className="hero-title">Transform<br />Your Music.</h1>
          <p className="hero-sub">
            Upload any track · Apply studio effects · Separate vocals with AI
          </p>
        </section>

        {/* ── Glass Card ── */}
        <div className="glass-card">

          {/* Progress bar top */}
          {progress > 0 && (
            <div className="glass-progress">
              <div className="gp-fill" style={{ width:`${progress}%` }} />
            </div>
          )}

          <div className="card-body">

            {/* ── STEP 1: UPLOAD ── */}
            <div className="section-block">
              <div className="eyebrow">
                {uploadedName ? '✓  Track Loaded' : 'Step 1 of 3'}
              </div>
              <div className="sec-title">
                {uploadedName
                  ? uploadedName.replace(/_/g,' ').replace(/\.[^.]+$/,'')
                  : 'Upload Your Track'}
              </div>

              {!uploadedName && (
                <div
                  className={`drop-zone
                    ${isDragging   ? 'dz-drag' : ''}
                    ${selectedFile ? 'dz-ready': ''}`}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  onClick={() => document.getElementById('fi').click()}
                >
                  <input type="file" accept="audio/*" id="fi"
                    onChange={handleFileChange} style={{display:'none'}} />

                  {selectedFile ? (
                    <div className="dz-file">
                      <div className="dz-file-icon">🎵</div>
                      <div className="dz-file-text">
                        <span className="dz-fname">{selectedFile.name}</span>
                        <span className="dz-fmeta">
                          {fmt.size(selectedFile.size)}
                          {fileDuration && `  ·  ${fmt.duration(fileDuration)}`}
                        </span>
                      </div>
                      <div className="dz-check">✓</div>
                    </div>
                  ) : (
                    <div className="dz-empty">
                      <div className="dz-empty-icon">
                        <svg width="26" height="26" viewBox="0 0 24 24"
                          fill="none" stroke="currentColor" strokeWidth="1.5">
                          <path d="M9 19V6l12-3v13"/>
                          <circle cx="6"  cy="18" r="3"/>
                          <circle cx="18" cy="16" r="3"/>
                        </svg>
                      </div>
                      <p className="dz-title">Drop audio file here</p>
                      <p className="dz-hint">or click to browse</p>
                      <div className="dz-tags">
                        {['MP3','WAV','OGG','FLAC','M4A'].map(f=>(
                          <span key={f} className="dz-tag">{f}</span>
                        ))}
                      </div>
                      <p className="dz-limit">Max 5 minutes · 50 MB</p>
                    </div>
                  )}
                </div>
              )}

              {originalUrl && !uploadedName && (
                <div className="player-wrap">
                  <span className="player-label">Preview</span>
                  <audio controls src={originalUrl} className="glass-audio" />
                </div>
              )}

              {!uploadedName && (
                <button
                  className={`glass-btn primary ${isUploading?'btn-busy':''}`}
                  onClick={handleUpload}
                  disabled={isUploading || !selectedFile}
                >
                  {isUploading
                    ? <><span className="btn-ring"/>&nbsp;Uploading…</>
                    : 'Upload Track'}
                </button>
              )}

              {uploadedName && (
                <div className="meta-strip">
                  <div className="ms-item">
                    <span className="ms-label">Format</span>
                    <span className="ms-val">
                      {uploadedName.split('.').pop().toUpperCase()}
                    </span>
                  </div>
                  <div className="ms-sep"/>
                  <div className="ms-item">
                    <span className="ms-label">Duration</span>
                    <span className="ms-val">{fmt.duration(fileDuration)}</span>
                  </div>
                  <div className="ms-sep"/>
                  <div className="ms-item">
                    <span className="ms-label">Size</span>
                    <span className="ms-val">
                      {selectedFile ? fmt.size(selectedFile.size) : '—'}
                    </span>
                  </div>
                  <div className="ms-sep"/>
                  <div className="ms-item">
                    <span className="ms-label">Status</span>
                    <span className="ms-val ms-green">Ready ✓</span>
                  </div>
                </div>
              )}
            </div>

            {/* ── TABS ── */}
            {uploadedName && (
              <>
                <div className="glass-divider"/>

                <div className="glass-tabs">
                  <button
                    className={`gtab ${activeTab==='remix'?'gtab-active':''}`}
                    onClick={() => setActiveTab('remix')}
                  >
                    🎛️  Remix Effects
                  </button>
                  <button
                    className={`gtab ${activeTab==='separate'?'gtab-active':''}`}
                    onClick={() => setActiveTab('separate')}
                  >
                    🎤  Vocal Separation
                  </button>
                </div>

                {/* ════ TAB 1 — REMIX ════ */}
                {activeTab === 'remix' && (
                  <div className="section-block">
                    <div className="eyebrow">Step 2 of 3</div>
                    <div className="sec-title">Choose an Effect</div>

                    <div className="effects-grid">
                      {EFFECTS.map(eff => (
                        <button
                          key={eff.id}
                          className={`eff-tile ${selectedEffect===eff.id?'eff-sel':''}`}
                          onClick={() => setSelectedEffect(eff.id)}
                        >
                          <span className="eff-ico">{eff.icon}</span>
                          <span className="eff-lbl">{eff.label}</span>
                          <span className="eff-dsc">{eff.description}</span>
                          {selectedEffect===eff.id && (
                            <span className="eff-check">
                              <svg width="14" height="14" viewBox="0 0 14 14">
                                <circle cx="7" cy="7" r="7" fill="#007AFF"/>
                                <path d="M4 7l2 2 4-4" stroke="white"
                                  strokeWidth="1.5" strokeLinecap="round"
                                  fill="none"/>
                              </svg>
                            </span>
                          )}
                        </button>
                      ))}
                    </div>

                    <button
                      className={`glass-btn primary ${isProcessing?'btn-busy':''}`}
                      onClick={handleProcess}
                      disabled={isProcessing || !selectedEffect}
                    >
                      {isProcessing
                        ? <><span className="btn-ring"/>&nbsp;Processing…</>
                        : 'Apply Effect'}
                    </button>

                    {remixUrl && (
                      <>
                        <div className="glass-divider"/>
                        <div className="eyebrow">Step 3 of 3</div>
                        <div className="sec-title">Your Remix</div>
                        <div className="compare-grid">
                          <div className="player-wrap">
                            <span className="player-label">Original</span>
                            <audio controls src={originalUrl} className="glass-audio"/>
                          </div>
                          <div className="player-wrap player-blue">
                            <span className="player-label">
                              {EFFECTS.find(e=>e.id===selectedEffect)?.label} Remix
                            </span>
                            <audio controls src={remixUrl} className="glass-audio"/>
                          </div>
                        </div>
                        <a href={remixUrl} download={downloadName}
                          className="glass-btn green-btn">
                          ⬇  Download Remix
                        </a>
                      </>
                    )}
                  </div>
                )}

                {/* ════ TAB 2 — VOCAL SEPARATION ════ */}
                {activeTab === 'separate' && (
                  <div className="section-block">
                    <div className="eyebrow">AI Feature</div>
                    <div className="sec-title">Vocal Separation</div>

                    {/* Track list */}
                    <div className="track-list">

                      <div className="tl-header">
                        <span className="tlh tlh-num">#</span>
                        <span className="tlh tlh-name">Track</span>
                        <span className="tlh tlh-time">Time</span>
                        <span className="tlh tlh-dl">Download</span>
                      </div>

                      {/* Vocals row */}
                      <div className="tl-row">
                        <span className="tl-num">
                          {vocalsUrl
                            ? <span className="tl-play">♪</span>
                            : '1'}
                        </span>
                        <div className="tl-name">
                          <div className="tl-disc vocals-disc">V</div>
                          <div className="tl-info">
                            <span className="tl-title">Vocals</span>
                            <span className="tl-sub">Isolated voice track</span>
                          </div>
                        </div>
                        <span className="tl-time">
                          {fmt.duration(fileDuration)}
                        </span>
                        <span className="tl-dl">
                          {vocalsUrl
                            ? <a href={vocalsUrl}
                                download={separatedFiles?.vocals}
                                className="tl-btn vocals-btn">
                                ↓ MP3
                              </a>
                            : <span className="tl-pending">
                                {isSeparating ? '…' : '—'}
                              </span>}
                        </span>
                      </div>

                      {/* Instrumental row */}
                      <div className="tl-row tl-row-last">
                        <span className="tl-num">
                          {instrumentalUrl
                            ? <span className="tl-play">♪</span>
                            : '2'}
                        </span>
                        <div className="tl-name">
                          <div className="tl-disc instr-disc">I</div>
                          <div className="tl-info">
                            <span className="tl-title">Instrumental</span>
                            <span className="tl-sub">Music without vocals</span>
                          </div>
                        </div>
                        <span className="tl-time">
                          {fmt.duration(fileDuration)}
                        </span>
                        <span className="tl-dl">
                          {instrumentalUrl
                            ? <a href={instrumentalUrl}
                                download={separatedFiles?.no_vocals}
                                className="tl-btn instr-btn">
                                ↓ MP3
                              </a>
                            : <span className="tl-pending">
                                {isSeparating ? '…' : '—'}
                              </span>}
                        </span>
                      </div>

                    </div>

                    {/* Players after separation */}
                    {(vocalsUrl || instrumentalUrl) && (
                      <div className="compare-grid">
                        {vocalsUrl && (
                          <div className="player-wrap player-vocals">
                            <span className="player-label">🎤 Vocals</span>
                            <audio controls src={vocalsUrl}
                              className="glass-audio"/>
                          </div>
                        )}
                        {instrumentalUrl && (
                          <div className="player-wrap player-instr">
                            <span className="player-label">🎸 Instrumental</span>
                            <audio controls src={instrumentalUrl}
                              className="glass-audio"/>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Processing spinner */}
                    {isSeparating && (
                      <div className="processing-bar">
                        <div className="pb-ring"/>
                        <div className="pb-text">
                          <span className="pb-title">Processing Audio</span>
                          <span className="pb-sub">
                            1–3 minutes · Do not close this page
                          </span>
                        </div>
                      </div>
                    )}

                    {!separatedFiles && (
                      <button
                        className={`glass-btn primary ${isSeparating?'btn-busy':''}`}
                        onClick={handleSeparate}
                        disabled={isSeparating}
                      >
                        {isSeparating
                          ? <><span className="btn-ring"/>&nbsp;Separating…</>
                          : '🤖  Separate Vocals'}
                      </button>
                    )}
                  </div>
                )}
              </>
            )}

            {/* Status message */}
            {message && (
              <div className={`status-msg msg-${messageType}`}>
                <span className={`status-dot dot-${messageType}`}/>
                <span className="status-text">{message}</span>
              </div>
            )}

            {/* Reset */}
            {(remixUrl || separatedFiles) && (
              <button className="glass-btn ghost-btn" onClick={handleReset}>
                ↺  Start Over
              </button>
            )}

          </div>
        </div>

        {/* ── Footer ── */}
        <footer className="glass-footer">
          <div className="footer-inner">
            <span className="footer-brand">♫  AI Remix Generator</span>
            <span className="footer-sep">·</span>
            <span className="footer-copy">© 2026 Vashisht</span>
            <span className="footer-sep">·</span>
            <span className="footer-rights">All Rights Reserved</span>
          </div>
        </footer>

      </div>
    </div>
  );
}