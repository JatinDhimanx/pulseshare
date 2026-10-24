/**
 * PulseShare — Master Application Controller
 * Pure Browser RAM Peer-to-Peer Transfer Engine (Zero Database)
 */

(function () {
  'use strict';

  const MAX_FILE = 2 * 1024 * 1024 * 1024; // 2 GB per file
  const MAX_FILES = 20;
  const TTL = 10 * 60 * 1000; // 10 minutes

  // Icons library matching PulseShare SVG set
  const ICONS = {
    bolt: '<path d="M13 2 4 14h7l-1 8 9-12h-7z"/>',
    upload: '<path d="M12 16V4"/><path d="m7 9 5-5 5 5"/><path d="M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3"/>',
    download: '<path d="M12 4v12"/><path d="m7 11 5 5 5-5"/><path d="M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3"/>',
    file: '<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5"/>',
    image: '<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="1.6"/><path d="m21 16-5-5-8 8"/>',
    archive: '<rect x="3" y="4" width="18" height="4" rx="1"/><path d="M5 8v10a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8"/><path d="M10 12h4"/>',
    film: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="m10 9 5 3-5 3z"/>',
    music: '<path d="M9 18V6l10-2v12"/><circle cx="7" cy="18" r="2.5"/><circle cx="17" cy="16" r="2.5"/>',
    x: '<path d="M6 6l12 12M18 6 6 18"/>',
    copy: '<rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V6a2 2 0 0 1 2-2h9"/>',
    check: '<path d="m5 12 5 5 9-10"/>',
    shield: '<path d="M12 3 5 6v6c0 4.5 3 7.5 7 9 4-1.5 7-4.5 7-9V6z"/><path d="m9 12 2 2 4-4"/>',
    devices: '<rect x="3" y="5" width="13" height="10" rx="1.5"/><path d="M7 19h5M9.5 15v4"/><rect x="18" y="9" width="3.5" height="8" rx="1"/>',
    userx: '<circle cx="10" cy="8" r="3.5"/><path d="M3.5 20a6.5 6.5 0 0 1 13 0"/><path d="m17 8 5 5M22 8l-5 5"/>',
    arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>',
    menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    alert: '<path d="M12 3 2.5 20h19z"/><path d="M12 10v4M12 17.5v.5"/>',
    refresh: '<path d="M20 12a8 8 0 1 1-2.5-5.8"/><path d="M20 4v5h-5"/>',
    route: '<circle cx="6" cy="18" r="2.5"/><circle cx="18" cy="6" r="2.5"/><path d="M8.5 18H15a3 3 0 0 0 0-6H9a3 3 0 0 1 0-6h6.5"/>',
    lock: '<rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    trash: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4h6v3"/>',
    info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 7.5v.5"/>',
    note: '<path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>',
    qr: '<rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>'
  };

  const ic = (n, c) => `<svg class="ic${c ? ' ' + c : ''}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[n] || ''}</svg>`;
  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

  function fmtBytes(b) {
    if (b < 1024) return b + ' B';
    const u = ['KB', 'MB', 'GB', 'TB'];
    let i = -1;
    do { b /= 1024; i++; } while (b >= 1024 && i < 3);
    return (b >= 100 ? b.toFixed(0) : b.toFixed(1)) + ' ' + u[i];
  }

  function fmtDur(s) {
    if (!isFinite(s)) return '–';
    s = Math.max(0, Math.round(s));
    if (s < 1) return '<1s';
    if (s < 60) return s + 's';
    const m = Math.floor(s / 60), r = s % 60;
    return m + 'm ' + String(r).padStart(2, '0') + 's';
  }

  function fmtClock(ms) {
    const s = Math.max(0, Math.ceil(ms / 1000));
    return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
  }

  function kind(name, type) {
    const e = (name.split('.').pop() || '').toLowerCase();
    if (/^image\//.test(type) || /(png|jpe?g|gif|webp|svg|heic|avif)$/.test(e)) return 'image';
    if (/^video\//.test(type) || /(mp4|mov|mkv|webm|avi)$/.test(e)) return 'film';
    if (/^audio\//.test(type) || /(mp3|wav|flac|m4a|ogg)$/.test(e)) return 'music';
    if (/(zip|rar|7z|tar|gz|tgz)$/.test(e)) return 'archive';
    return 'file';
  }

  // Real WebRTC Engine
  const engine = new window.PeerTransferEngine();

  // Application State
  const S = {
    screen: 'home',
    mode: 'file', // 'file' or 'note'
    files: [],
    seq: 0,
    noteTitle: '',
    noteText: '',
    session: null,
    sendErr: '',
    showQr: false,
    rx: { digits: ['', '', '', '', '', ''], err: '', busy: false, attempts: 0, lockUntil: 0 },
    conn: null,
    xfer: null,
    timers: [],
    tick: null,
    genBusy: false
  };

  function later(ms, fn) {
    const id = setTimeout(fn, ms);
    S.timers.push(id);
    return id;
  }

  function clearAll() {
    S.timers.forEach(clearTimeout);
    S.timers = [];
    clearInterval(S.tick);
    S.tick = null;
  }

  // Toast Notifications
  function toast(msg, kindName) {
    const t = document.createElement('div');
    t.className = 'toast ' + (kindName || '');
    t.innerHTML = ic(kindName === 'err' ? 'alert' : kindName === 'info' ? 'info' : 'check') + '<span></span>';
    t.lastChild.textContent = msg;
    const container = $('#toasts');
    if (container) {
      container.appendChild(t);
      setTimeout(() => t.remove(), 3600);
    }
  }

  // Confirmation Modal Dialog
  function confirmBox(o, onYes) {
    const prev = document.activeElement;
    const m = $('#modal');
    m.innerHTML = `
      <div class="ovl" role="presentation">
        <div class="dlg" role="alertdialog" aria-modal="true" aria-labelledby="dt" aria-describedby="dd">
          <h2 id="dt">${esc(o.title)}</h2>
          <p id="dd">${esc(o.body)}</p>
          <div class="actions">
            <button type="button" class="btn btn-ghost" data-m="no">${esc(o.no || 'Keep going')}</button>
            <button type="button" class="btn ${o.danger ? 'btn-danger' : 'btn-primary'}" data-m="yes">${esc(o.yes)}</button>
          </div>
        </div>
      </div>
    `;

    const close = () => {
      m.innerHTML = '';
      document.removeEventListener('keydown', key, true);
      if (prev && prev.focus) prev.focus();
    };

    const key = e => {
      if (e.key === 'Escape') { e.preventDefault(); close(); }
      if (e.key === 'Tab') {
        const b = $$('button', m);
        const i = b.indexOf(document.activeElement);
        e.preventDefault();
        b[(i + (e.shiftKey ? -1 : 1) + b.length) % b.length].focus();
      }
    };

    document.addEventListener('keydown', key, true);
    m.onclick = e => {
      const b = e.target.closest('[data-m]');
      if (e.target.classList.contains('ovl')) { close(); return; }
      if (!b) return;
      close();
      if (b.dataset.m === 'yes') onYes();
    };
    $('[data-m="yes"]', m).focus();
  }

  // Vector Art Component (Laptop to Phone with animated dots)
  function deviceArt(o) {
    const p = 'M222 182 C 290 108, 356 256, 424 182';
    return `
      <svg class="art" viewBox="0 0 560 340" role="img" aria-label="${esc(o.label)}">
        <defs>
          <linearGradient id="pg" x1="0" x2="1">
            <stop offset="0" stop-color="#FF762F" stop-opacity="0"/>
            <stop offset=".5" stop-color="#FF762F"/>
            <stop offset="1" stop-color="#FF762F" stop-opacity="0"/>
          </linearGradient>
        </defs>
        <path class="dev" d="M8 250h228l-8 14a8 8 0 0 1-7 4H23a8 8 0 0 1-7-4z"/>
        <rect class="dev" x="24" y="118" width="196" height="132" rx="12"/>
        <rect class="scr" x="36" y="130" width="172" height="108" rx="6"/>
        <rect class="fc" x="54" y="148" width="62" height="72" rx="7"/>
        <path class="fl" d="M66 172h38M66 184h38M66 196h24"/>
        <path class="ico" d="M148 166h40M148 182h28M148 198h34" style="stroke:var(--line2)"/>
        
        <rect class="dev" x="424" y="70" width="104" height="204" rx="20"/>
        <rect class="scr" x="434" y="86" width="84" height="172" rx="12"/>
        <rect class="fc" x="460" y="128" width="32" height="42" rx="5"/>
        <path class="fl" d="M467 146h18M467 156h12"/>
        <rect class="trk" x="446" y="204" width="60" height="6" rx="3"/>
        <rect class="fillbar" x="446" y="204" width="${o.fill || 36}" height="6" rx="3"/>
        <path class="fl" d="M452 226h48" style="stroke:var(--line2)"/>
        
        <path class="pl" d="${p}"/>
        <path d="${p}" fill="none" stroke="url(#pg)" stroke-width="2.4" stroke-linecap="round" opacity=".9"/>
        <circle r="7" fill="#FF762F">
          <animateMotion dur="2.6s" repeatCount="indefinite" path="${p}"/>
        </circle>
        <circle r="5" fill="#FF8A4C" opacity=".7">
          <animateMotion dur="2.6s" begin="-1.3s" repeatCount="indefinite" path="${p}"/>
        </circle>
        <g transform="translate(323 78)">
          <rect class="chip" x="-58" y="-17" width="116" height="34" rx="17"/>
          <text class="chiptx" text-anchor="middle" y="5">${esc(o.chip)}</text>
        </g>
        <text class="lbl" x="122" y="306">${esc(o.a)}</text>
        <text class="lbl" x="476" y="306">${esc(o.b)}</text>
      </svg>
    `;
  }

  function fileRow(f, opts = {}) {
    return `
      <li class="f">
        <span class="fi">${ic(kind(f.name, f.type || ''))}</span>
        <div style="min-width:0">
          <div class="nm" title="${esc(f.name)}">${esc(f.name)}</div>
          <div class="mt">${fmtBytes(f.size)}${f.size === 0 ? ' · empty file' : ''}</div>
        </div>
        ${opts.remove ? `<button type="button" class="icon-btn" data-act="remove" data-id="${f.id}" aria-label="Remove ${esc(f.name)}">${ic('x')}</button>` : '<span></span>'}
      </li>
    `;
  }

  const total = a => a.reduce((s, f) => s + f.size, 0);
  const lnk = (to, txt, cls) => `<a class="${cls || ''}" href="#${to}" data-go="${to}">${txt}</a>`;

  // Views Object
  const V = {};

  // 1. HOME VIEW
  V.home = function () {
    return `
      <section class="hero">
        <div class="glow"></div>
        <div class="wrap hero-grid">
          <div class="hero-copy">
            <span class="badge">FAST <i>•</i> PRIVATE <i>•</i> ZERO DATABASE</span>
            <h1>Share files instantly with a <span class="hl">6-digit code.</span></h1>
            <p class="lede">Send files and secret notes between devices directly in your browser. Zero cloud database, zero server disk storage. Pure RAM direct browser streaming.</p>
            <div class="row">
              <a class="btn btn-primary btn-lg" href="#send" data-go="send">Send a File ${ic('arrow')}</a>
              <a class="btn btn-secondary btn-lg" href="#receive" data-go="receive">Receive a File</a>
              <button type="button" class="btn btn-secondary btn-lg" data-act="open-scanner" style="display:inline-flex;gap:8px;align-items:center;">
                <svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
                  <circle cx="12" cy="13" r="4"/>
                </svg>
                <span>Scan QR</span>
              </button>
            </div>
            <p class="fine">Files travel directly between browsers via encrypted WebRTC. ${lnk('how', 'See how it works')}</p>
          </div>
          <div class="hero-art">
            ${deviceArt({ chip: '482 917', a: 'SENDER', b: 'RECEIVER', label: 'Laptop sending a file to phone via WebRTC' })}
          </div>
        </div>
      </section>

      <section class="wrap features">
        <div class="feat">
          <div>${ic('route')}<h3>Direct Transfer</h3><p>End-to-end direct encrypted streaming directly between browser tabs.</p></div>
          <div>${ic('shield')}<h3>100% Zero Database</h3><p>Zero database & zero disk storage. Files exist only in temporary RAM.</p></div>
          <div>${ic('devices')}<h3>Any Device</h3><p>Seamlessly transfer between PC, Mac, iPhone, iPad, Android, or Linux.</p></div>
          <div>${ic('userx')}<h3>No Account</h3><p>Start sharing instantly without registration, passwords, or emails.</p></div>
        </div>
      </section>

      <section class="wrap">
        <h2 class="sec-h">Three steps, zero sign-up</h2>
        <p class="sec-sub">The sender picks files and gets a 6-digit code. The receiver enters it on their device. Browsers handle the direct transfer.</p>
        <div class="steps">
          <div class="step">
            <span class="n">Step 1</span>
            <h3>Choose a file or note</h3>
            <p>Pick any file or write a note. It stays safely in your browser's RAM memory until a receiver connects.</p>
          </div>
          <div class="step">
            <span class="n">Step 2</span>
            <h3>Share your 6-digit code</h3>
            <p>Read it out, message it, or let them scan the QR code. The code pairs the two devices directly.</p>
          </div>
          <div class="step">
            <span class="n">Step 3</span>
            <h3>Connect and download</h3>
            <p>The other person enters the code. WebRTC establishes a direct tunnel and automatically downloads the file.</p>
          </div>
        </div>

        <div class="cta-band">
          <div>
            <h2>Ready to send something?</h2>
            <p>Pick a file or note and generate a live code in seconds.</p>
          </div>
          <div class="row">
            <a class="btn btn-primary btn-lg" href="#send" data-go="send">Send a File</a>
            <a class="btn btn-secondary btn-lg" href="#receive" data-go="receive">Enter a Code</a>
          </div>
        </div>
      </section>
      <div style="height:88px"></div>
    `;
  };

  // 2. SEND VIEW
  function dropzoneHTML(has) {
    return `
      <div class="dz${has ? ' compact' : ''}" id="dz" role="button" tabindex="0" aria-label="Choose files or drop them here">
        <div class="big">${ic('upload')}</div>
        <h2>Drag and drop your files here</h2>
        <div class="or">or</div>
        <button type="button" class="btn btn-primary" data-act="pick" tabindex="-1">Choose Files</button>
        ${has ? '' : `<div class="lim">Any size up to Chrome's RAM limits. Files stay strictly in your browser until receiver downloads.</div>`}
      </div>
    `;
  }

  V.send = function () {
    const f = S.files;
    let contentBox = '';

    if (S.mode === 'file') {
      let list = '';
      if (f.length) {
        list = `
          <div class="list">
            <div class="list-h">Selected files <span>${f.length} ${f.length === 1 ? 'file' : 'files'} · ${fmtBytes(total(f))} total</span></div>
            <ul class="files">${f.map(x => fileRow(x, { remove: true })).join('')}</ul>
          </div>
        `;
      }
      contentBox = dropzoneHTML(f.length) + list;
    } else {
      contentBox = `
        <div class="note-box">
          <input type="text" id="noteTitleInput" class="note-input-title" placeholder="Note Title (Optional, e.g. WiFi Password, Secret Key...)" value="${esc(S.noteTitle)}">
          <textarea id="noteTextInput" class="note-textarea" placeholder="Type or paste your secret note or text here...">${esc(S.noteText)}</textarea>
          <div style="display:flex;justify-content:space-between;color:var(--muted);font-size:13px;">
            <span id="noteCharCount">${S.noteText.length} characters</span>
            <span>Zero-DB Direct Stream</span>
          </div>
        </div>
      `;
    }

    const canGenerate = (S.mode === 'file' && f.length > 0) || (S.mode === 'note' && S.noteText.trim().length > 0);

    return `
      <section class="page">
        <div class="wrap">
          <div class="ph">
            <h1>Send a File or Note</h1>
            <p>Choose what you want to share directly with another device.</p>
          </div>

          <!-- Format Switcher -->
          <div class="format-tabs">
            <button type="button" class="format-tab-btn ${S.mode === 'file' ? 'active' : ''}" data-act="mode-file">
              ${ic('file')}<span>Files</span>
            </button>
            <button type="button" class="format-tab-btn ${S.mode === 'note' ? 'active' : ''}" data-act="mode-note">
              ${ic('note')}<span>Secret Note / Text</span>
            </button>
          </div>

          <div class="split">
            <div>
              ${contentBox}
              ${S.sendErr ? `<p class="inline-err" role="alert">${ic('alert')}<span>${esc(S.sendErr)}</span></p>` : ''}
              
              <div class="actions">
                ${S.mode === 'file' && f.length ? `
                  <button type="button" class="btn btn-secondary" data-act="pick">${ic('plus')}Add More Files</button>
                  <button type="button" class="btn btn-ghost" data-act="clear">${ic('trash')}Clear All</button>
                ` : ''}
                <span class="grow"></span>
                <button type="button" class="btn btn-primary btn-lg" data-act="gen" ${canGenerate && !S.genBusy ? '' : 'disabled'}>
                  ${S.genBusy ? '<span class="spin"></span>Creating live code…' : 'Generate 6-Digit Code'}
                </button>
              </div>
            </div>

            <aside class="card aside">
              <h3>What happens next</h3>
              <ol>
                <li>${ic('lock')}<div><b>You get a temporary 6-digit code</b><span>Created in your browser RAM only. Valid for 10 minutes.</span></div></li>
                <li>${ic('devices')}<div><b>The receiver enters it</b><span>On their phone, laptop, or tablet.</span></div></li>
                <li>${ic('route')}<div><b>Direct memory stream</b><span>Transfers straight between browsers over WebRTC.</span></div></li>
              </ol>
              <div class="note">
                ${ic('shield')}
                <span><strong>Zero Database:</strong> Nothing is uploaded to any server. Keep this tab open until the transfer finishes!</span>
              </div>
            </aside>
          </div>
        </div>
      </section>
    `;
  };

  // 3. SESSION VIEW (Sender Hosting)
  V.session = function () {
    const s = S.session;
    if (!s) return '';
    const exp = s.status === 'expired';
    const con = s.status === 'connected';
    const digits = s.code.split('').join(' ');
    const left = s.expires - Date.now();

    const statusPill = exp
      ? '<span class="pill err"><span class="dot"></span>Code expired</span>'
      : con
      ? '<span class="pill ok"><span class="dot"></span>Receiver connected! Ready...</span>'
      : '<span class="pill info live"><span class="dot"></span>Waiting for receiver…</span>';

    return `
      <section class="page">
        <div class="wrap">
          <div class="sess">
            <div class="card code-card">
              <div class="okc ${exp ? 'err' : ''}">${ic(exp ? 'clock' : 'check')}</div>
              <h1>${exp ? 'This code has expired' : 'Your transfer is live!'}</h1>
              <p class="sub">${exp ? 'Generate a new code to continue sharing.' : 'Share this 6-digit code with the receiver device.'}</p>

              <!-- 6 Digit Block Tiles -->
              <div class="code ${exp ? 'dead' : ''}" id="codeEl" role="img" aria-label="Sharing code: ${digits}">
                ${s.code.split('').map(d => `<span>${d}</span>`).join('')}
              </div>

              <div class="row center">
                ${exp ? `
                  <button type="button" class="btn btn-primary btn-lg" data-act="new-code">${ic('refresh')}Create New Code</button>
                ` : `
                  <button type="button" class="btn btn-primary btn-lg" data-act="copy">${ic('copy')}Copy Code</button>
                  <button type="button" class="btn btn-secondary btn-lg" data-act="toggle-qr">${ic('qr')}QR Code</button>
                `}
              </div>

              ${S.showQr && !exp ? `
                <div class="qr-box" id="qrContainer">
                  <div id="qrcodeEl"></div>
                  <div style="color:#080B10;font-size:12px;font-weight:600;margin-top:8px;text-align:center;">Scan with mobile camera to connect</div>
                </div>
              ` : ''}

              <div style="margin-top:22px">${statusPill}</div>
              ${exp ? '' : `<p class="fine" style="margin-top:14px">⚠️ <strong>Keep this tab open!</strong> Files live in browser RAM. Zero database used.</p>`}
            </div>

            <div class="stack">
              <div class="card">
                <div class="list-h" style="padding:0;border:0">
                  ${s.payloadType === 'file' ? `
                    Files <span>${s.files.length} ${s.files.length === 1 ? 'file' : 'files'} · ${fmtBytes(total(s.files))}</span>
                  ` : `
                    Secret Note <span>${s.noteTitle || 'Shared Note'}</span>
                  `}
                </div>
                ${s.payloadType === 'file' ? `
                  <ul class="files list-lite">${s.files.map(f => fileRow(f)).join('')}</ul>
                ` : `
                  <div style="background:var(--bg2);border:1px solid var(--line);border-radius:10px;padding:12px;margin-top:12px;font-size:13.5px;color:var(--text2);max-height:100px;overflow-y:auto;white-space:pre-wrap;">${esc(s.noteText)}</div>
                `}

                <dl class="dl">
                  <div>
                    <dt>Expires in</dt>
                    <dd class="mono" id="cd">${exp ? '0:00' : fmtClock(left)}</dd>
                  </div>
                  <div style="padding-top:0;border:0">
                    <div class="bar ${left < 60000 ? 'warn' : ''}" style="width:100%" aria-hidden="true">
                      <i id="cdbar" style="width:${exp ? 0 : clamp(left / TTL * 100, 0, 100)}%"></i>
                    </div>
                  </div>
                </dl>

                <div class="actions" style="margin-top:12px">
                  <button type="button" class="btn btn-danger btn-sm" data-act="cancel-session">Cancel Session</button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    `;
  };

  // 4. RECEIVE VIEW
  V.receive = function () {
    const r = S.rx;
    const locked = r.lockUntil > Date.now();
    const off = r.busy || locked;

    let inputs = '';
    for (let i = 0; i < 6; i++) {
      inputs += `
        <input id="d${i}" class="dgt ${r.err ? 'bad' : ''}" inputmode="numeric" pattern="[0-9]*" maxlength="1" autocomplete="${i ? 'off' : 'one-time-code'}" aria-label="Digit ${i + 1} of 6" aria-invalid="${r.err ? 'true' : 'false'}" value="${r.digits[i] || ''}" ${off ? 'disabled' : ''}>
      `;
    }

    return `
      <section class="page">
        <div class="wrap">
          <div class="rx">
            <div class="card rx-card">
              <div class="badge-ic">${ic('download')}</div>
              <h1>Receive a File</h1>
              <p class="sub">Scan the sender's live QR code or enter their 6-digit code.</p>

              <!-- In-built Live QR Camera Scanner Button -->
              <button type="button" class="btn btn-primary btn-lg scan-qr-hero-btn" data-act="open-scanner">
                <svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
                  <circle cx="12" cy="13" r="4"/>
                </svg>
                <span>Scan Live QR Code</span>
                <span class="scan-pill-tag">CAMERA</span>
              </button>

              <div class="or-divider">
                <span>OR ENTER 6-DIGIT CODE</span>
              </div>
              
              <form id="rxForm" novalidate>
                <fieldset class="digits" style="border:0;margin-left:0;margin-right:0;padding:0">
                  <legend class="sr">6-digit sharing code</legend>
                  ${inputs}
                </fieldset>
                
                <p class="inline-err" id="rxErr" role="alert">
                  ${r.err ? `${ic('alert')}<span>${esc(r.err)}</span>` : ''}
                </p>
                
                <div class="row" style="margin-top:14px;gap:10px;">
                  <button type="button" class="btn btn-secondary" data-act="paste-code" style="flex:1;">
                    ${ic('copy')}<span>Paste</span>
                  </button>
                  <button type="submit" class="btn btn-primary btn-lg" id="rxBtn" style="flex:2;" ${off ? 'disabled' : ''}>
                    ${r.busy ? '<span class="spin"></span>Looking up live sender…' : 'Connect'}
                  </button>
                </div>
              </form>

              <p class="more">${lnk('how', 'How does it work?')}</p>
            </div>
          </div>
        </div>
      </section>
    `;
  };

  // 5. CONNECT VIEW (Real Handshake)
  const STEPS = [
    'Validating 6-digit code',
    'Locating sender peer in memory',
    'Exchanging WebRTC network signals',
    'Opening direct P2P DataChannel',
    'Ready for memory stream',
    'Connected'
  ];

  function stepsHTML(c) {
    return STEPS.map((t, i) => {
      let cls = '', mk = '', st = '';
      if (c.failed && i === c.step) {
        cls = 'bad'; mk = ic('x'); st = 'Failed';
      } else if (i < c.step || (i === c.step && c.step === STEPS.length - 1 && !c.failed)) {
        cls = 'done'; mk = ic('check'); st = 'Done';
      } else if (i === c.step && !c.failed) {
        cls = 'now'; mk = '<span class="spin"></span>'; st = 'In progress';
      } else {
        st = 'Waiting';
      }
      return `<li class="${cls}"><span class="mk">${mk}</span><span>${t}</span><span class="st">${st}</span></li>`;
    }).join('');
  }

  V.connect = function () {
    const c = S.conn;
    if (!c) return '';
    const head = c.failed ? 'Couldn’t connect' : c.step >= STEPS.length - 1 ? 'Connected' : 'Connecting to sender…';
    const sub = c.failed ? 'The sender peer could not be reached.' : 'Establishing direct peer connection to sender browser RAM...';

    return `
      <section class="page">
        <div class="wrap">
          <div class="cn">
            <div class="card cn-card">
              ${deviceArt({ chip: c.failed ? 'NO LINK' : 'LINKING', a: 'SENDER', b: 'YOU', fill: c.failed ? 8 : 20, label: 'Linking sender and receiver' })}
              <h1 id="cnH">${head}</h1>
              <p class="sub" id="cnS">${sub}</p>
              <ul class="cs" id="cnSteps">${stepsHTML(c)}</ul>
              
              ${c.failed ? `
                <div class="fail">
                  <p><b>Could not connect to code "${esc(c.code)}".</b> Make sure the sender still has their browser tab open! Because this app uses Zero Database, if the sender closes their tab, the transfer link expires.</p>
                  <div class="row">
                    <button type="button" class="btn btn-primary" data-act="retry">${ic('refresh')}Try Again</button>
                    <a class="btn btn-secondary" href="#receive" data-go="receive">Back to Receive</a>
                  </div>
                </div>
              ` : `
                <div class="row center" style="margin-top:22px">
                  <button type="button" class="btn btn-ghost btn-sm" data-act="abort-connect">Cancel</button>
                </div>
              `}
            </div>
          </div>
        </div>
      </section>
    `;
  };

  // 6. TRANSFER & COMPLETE VIEW
  V.transfer = function () {
    const x = S.xfer;
    if (!x) return '';
    const recv = x.role === 'receiver';
    const chip = '<span class="pill ok"><span class="dot"></span>Peer connection active</span>';

    // Transfer Done Screen
    if (x.phase === 'done') {
      return `
        <section class="page">
          <div class="wrap">
            <div class="tx">
              <div class="card tx-card">
                <div class="done-hd">
                  <div class="okc">${ic('check')}</div>
                  <h1>Transfer Complete!</h1>
                  <p class="sub">
                    ${x.payloadType === 'file'
                      ? `Received "${esc(x.name)}" (${fmtBytes(x.size)}) directly from sender's browser RAM.`
                      : `Received "${esc(x.title || 'Note')}".`}
                  </p>
                </div>

                ${x.payloadType === 'file' ? `
                  <ul class="q">
                    <li class="done">
                      <span class="ck">${ic('check')}</span>
                      <div style="min-width:0"><div class="nm2" title="${esc(x.name)}">${esc(x.name)}</div></div>
                      <span class="s">${fmtBytes(x.size)}</span>
                    </li>
                  </ul>
                  ${x.mimeType && x.mimeType.startsWith('image/') && x.url ? `
                    <div style="text-align:center;margin:16px 0;">
                      <img src="${x.url}" alt="Preview" style="max-height:220px;border-radius:10px;border:1px solid var(--line);">
                    </div>
                  ` : ''}
                ` : `
                  <div class="note-read-box" id="noteResultBox">${esc(x.text)}</div>
                `}

                <div class="actions" style="margin-top:28px">
                  ${recv ? `
                    ${x.payloadType === 'file' ? `
                      <button type="button" class="btn btn-primary btn-lg" data-act="download-file">${ic('download')}Save File Again</button>
                    ` : `
                      <button type="button" class="btn btn-primary btn-lg" data-act="copy-note">${ic('copy')}Copy Note Text</button>
                    `}
                    <button type="button" class="btn btn-secondary btn-lg" data-act="again">Receive Another Code</button>
                  ` : `
                    <button type="button" class="btn btn-primary btn-lg" data-act="again">Send More Files</button>
                    <a class="btn btn-secondary btn-lg" href="#home" data-go="home">Back to Home</a>
                  `}
                </div>
                <p class="fine center" style="margin-top:18px">Zero Database architecture: data has been safely delivered.</p>
              </div>
            </div>
          </div>
        </section>
      `;
    }

    // Active Streaming Screen
    const pct = Math.floor(x.percent || 0);
    const sum = fmtBytes(x.totalBytes || x.size || 0);
    const transferred = fmtBytes(x.transferredBytes || 0);
    const speed = ((x.speedBytesPerSec || 0) / 1024 / 1024).toFixed(1);

    return `
      <section class="page">
        <div class="wrap">
          <div class="tx">
            <div class="card tx-card">
              <div class="tx-top">
                <h1>${recv ? 'Receiving data stream' : 'Streaming data to receiver'}</h1>
                ${chip}
              </div>

              <div class="cur">
                <div class="nm" id="xName">${esc(x.name || x.title || 'Data transfer')}</div>
                <div class="mt"><span id="xTotalLabel">${sum} total</span></div>
              </div>

              <div class="big-pct">
                <span id="xPct">${pct}%</span>
                <small id="xBytes">${transferred} / ${sum}</small>
              </div>

              <div class="bar" role="progressbar" aria-label="Overall progress" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${pct}" id="xBarWrap">
                <i id="xBar" style="width:${pct}%"></i>
              </div>

              <dl class="stats">
                <div><dt>Live Speed</dt><dd id="xSpeed">${speed} MB/s</dd></div>
                <div><dt>Chunks</dt><dd id="xChunks">${x.currentChunk || 0} / ${x.totalChunks || 1}</dd></div>
                <div><dt>Status</dt><dd style="font-size:16px;color:var(--ok);" id="xStatus">Active Stream</dd></div>
              </dl>

              <div class="actions" style="margin-top:26px">
                <button type="button" class="btn btn-danger" data-act="cancel-xfer">Cancel Transfer</button>
              </div>
            </div>
          </div>
        </div>
      </section>
    `;
  };

  // 7. HOW IT WORKS VIEW
  V.how = function () {
    return `
      <section class="page">
        <div class="wrap">
          <div class="doc">
            <div class="ph doc-h">
              <h1>How PulseShare Works</h1>
              <p>A short-lived 6-digit code pairs two browsers. After that, files transfer directly between devices with Zero Database.</p>
            </div>

            <div class="steps" style="margin-bottom:48px;">
              <div class="step">
                <span class="n">Step 1</span>
                <h3>Choose a file or note</h3>
                <p>The sender selects files or types a secret note. It is held in browser RAM memory only.</p>
              </div>
              <div class="step">
                <span class="n">Step 2</span>
                <h3>Share your 6-digit code</h3>
                <p>A temporary WebRTC peer code is generated for pairing.</p>
              </div>
              <div class="step">
                <span class="n">Step 3</span>
                <h3>Direct memory stream</h3>
                <p>The receiver enters the code. WebRTC streams 64KB binary chunks directly to the receiver's disk.</p>
              </div>
            </div>

            <div class="doc-row">
              <h2>Zero Database Architecture</h2>
              <div>
                <p>PulseShare does not have a database (no MongoDB, SQL, Firebase, or disk storage). The sender's browser RAM acts as the temporary host.</p>
                <p>Because no server database is used, the sender must keep their browser tab open until the receiver finishes downloading.</p>
              </div>
            </div>

            <div class="doc-row">
              <h2>Direct Encrypted WebRTC</h2>
              <div>
                <p>Files travel over an encrypted WebRTC DataChannel directly between the two browsers whenever networks allow it.</p>
                <p>Data is chunked into 64KB binary slices with backpressure management, allowing large files without crashing browser memory.</p>
              </div>
            </div>

            <div class="doc-row" id="privacy">
              <h2>Privacy & Safety</h2>
              <div>
                <p>No accounts, no tracking, no cookies, no analytics. Codes are random 6-digit numbers that expire after 10 minutes or upon closing the tab.</p>
                <p>Once the download is complete or the tab is closed, the files disappear from browser memory permanently.</p>
              </div>
            </div>

            <div class="doc-row" id="terms">
              <h2>Local Network & Mobile</h2>
              <div>
                <p>You can transfer between your PC and Mobile phone seamlessly. Both devices can be on the same Wi-Fi or connected over the internet.</p>
              </div>
            </div>

            <div class="actions">
              <a class="btn btn-primary btn-lg" href="#send" data-go="send">Send a File</a>
              <a class="btn btn-secondary btn-lg" href="#receive" data-go="receive">Receive a File</a>
            </div>
          </div>
        </div>
      </section>
    `;
  };

  // Router Controller
  function navKey() {
    const s = S.screen;
    if (s === 'session') return 'send';
    if (s === 'connect') return 'receive';
    if (s === 'transfer') return S.xfer && S.xfer.role === 'sender' ? 'send' : 'receive';
    return s;
  }

  function updateNav() {
    const k = navKey();
    $$('[data-nav]').forEach(a => {
      if (a.dataset.nav === k) a.setAttribute('aria-current', 'page');
      else a.removeAttribute('aria-current');
    });
    const cta = $('#navCta');
    if (cta) cta.hidden = (S.screen !== 'home');
  }

  function go(screen, opts) {
    if (screen === 'session' && !S.session) screen = 'send';
    if (screen === 'transfer' && !S.xfer) screen = 'receive';
    clearAll();
    S.screen = screen;
    const nav = $('#nav');
    if (nav) nav.classList.remove('open');
    const menuBtn = $('#menuBtn');
    if (menuBtn) menuBtn.setAttribute('aria-expanded', 'false');

    render();

    const h = opts && opts.hash && document.getElementById(opts.hash);
    if (h) h.scrollIntoView();
    else {
      window.scrollTo(0, 0);
      const main = $('#main');
      if (main) main.focus({ preventScroll: true });
    }
  }

  function render() {
    clearInterval(S.tick);
    S.tick = null;
    const main = $('#main');
    if (main && V[S.screen]) {
      main.innerHTML = V[S.screen]();
    }
    if (AFTER[S.screen]) AFTER[S.screen]();
    updateNav();
  }

  const AFTER = {};

  // Lifecycle after session view renders
  AFTER.session = function () {
    const s = S.session;
    if (!s) return;

    // QR Code rendering if enabled
    if (S.showQr && !s.exp) {
      const qrEl = document.getElementById('qrcodeEl');
      if (qrEl) {
        qrEl.innerHTML = '';
        const shareUrl = `${window.location.origin}${window.location.pathname}?code=${s.code}`;
        new QRCode(qrEl, {
          text: shareUrl,
          width: 160,
          height: 160,
          colorDark: '#080B10',
          colorLight: '#ffffff',
          correctLevel: QRCode.CorrectLevel.M
        });
      }
    }

    if (s.status === 'waiting') {
      S.tick = setInterval(() => {
        if (S.screen !== 'session' || !S.session) return;
        const left = s.expires - Date.now();
        if (left <= 0 && s.status === 'waiting') {
          s.status = 'expired';
          render();
          return;
        }
        const el = $('#cd');
        if (el) el.textContent = fmtClock(left);
        const b = $('#cdbar');
        if (b) {
          b.style.width = clamp(left / TTL * 100, 0, 100) + '%';
          b.parentNode.classList.toggle('warn', left < 60000);
        }
      }, 1000);
    }
  };

  // Lifecycle after receive view renders
  AFTER.receive = function () {
    const r = S.rx;
    const ins = $$('.dgt');
    const sync = () => { r.digits = ins.map(i => i.value); };

    ins.forEach((el, i) => {
      el.addEventListener('input', () => {
        const d = el.value.replace(/\D/g, '');
        if (d.length > 1) { fillFrom(d, i); return; }
        el.value = d.slice(-1);
        sync();
        r.err = '';
        const rxErr = $('#rxErr');
        if (rxErr) rxErr.innerHTML = '';
        ins.forEach(x => { x.classList.remove('bad'); x.setAttribute('aria-invalid', 'false'); });
        if (d && i < 5) ins[i + 1].focus();
      });

      el.addEventListener('keydown', e => {
        if (e.key === 'Backspace' && !el.value && i > 0) {
          ins[i - 1].value = '';
          ins[i - 1].focus();
          sync();
          e.preventDefault();
        } else if (e.key === 'ArrowLeft' && i > 0) {
          ins[i - 1].focus();
          e.preventDefault();
        } else if (e.key === 'ArrowRight' && i < 5) {
          ins[i + 1].focus();
          e.preventDefault();
        }
      });

      el.addEventListener('focus', () => el.select());
      el.addEventListener('paste', e => {
        const t = (e.clipboardData || window.clipboardData).getData('text').replace(/\D/g, '');
        if (t) {
          e.preventDefault();
          fillFrom(t, i === 0 ? 0 : i);
        }
      });
    });

    function fillFrom(txt, start) {
      const d = txt.slice(0, 6 - start).split('');
      d.forEach((ch, k) => { ins[start + k].value = ch; });
      sync();
      r.err = '';
      const rxErr = $('#rxErr');
      if (rxErr) rxErr.innerHTML = '';
      ins.forEach(x => x.classList.remove('bad'));
      ins[Math.min(5, start + d.length)].focus();
    }

    const first = ins.find(i => !i.value) || ins[5];
    if (first && !r.busy && !(r.lockUntil > Date.now())) first.focus();
  };

  // --- Send Workflow ---
  function addFiles(list) {
    const errs = [];
    for (const file of Array.from(list)) {
      if (S.files.length >= MAX_FILES) {
        errs.push(`You can share up to ${MAX_FILES} files at once.`);
        break;
      }
      if (file.size > MAX_FILE) {
        errs.push(`“${file.name}” is larger than the ${fmtBytes(MAX_FILE)} limit.`);
        continue;
      }
      S.files.push({ id: ++S.seq, file, name: file.name, size: file.size, type: file.type || '' });
    }
    S.sendErr = errs.join(' ');
    if (errs.length) toast(errs[0], 'err');
    if (S.screen !== 'send') go('send');
    else render();
  }

  function createLiveSession() {
    S.genBusy = true;
    render();

    const code = engine.generateRandomCode();
    let payload = null;

    if (S.mode === 'file') {
      payload = { type: 'file', file: S.files[0].file };
    } else {
      payload = {
        type: 'note',
        title: S.noteTitle.trim() || 'Shared Note',
        text: S.noteText
      };
    }

    engine.hostSession(code, payload).then(() => {
      S.genBusy = false;
      S.session = {
        code,
        payloadType: S.mode,
        files: S.mode === 'file' ? S.files.map(f => ({ id: f.id, name: f.name, size: f.size, type: f.type })) : [],
        noteTitle: S.noteTitle,
        noteText: S.noteText,
        expires: Date.now() + TTL,
        status: 'waiting'
      };

      // Set beforeunload alert
      window.onbeforeunload = e => {
        e.preventDefault();
        e.returnValue = 'Transfer session is live in browser RAM. Closing this tab will cancel it!';
        return e.returnValue;
      };

      go('session');
      toast(`Live code ${code.slice(0, 3)} ${code.slice(3)} is broadcasting!`, 'info');
    }).catch(err => {
      S.genBusy = false;
      S.sendErr = err.message || 'Failed to initialize P2P session.';
      render();
      toast(S.sendErr, 'err');
    });
  }

  // --- Receive Workflow ---
  function doConnect() {
    const r = S.rx;
    if (r.busy || r.lockUntil > Date.now()) return;
    const code = r.digits.join('');

    if (!/^\d{6}$/.test(code)) {
      r.err = 'Enter a valid 6-digit code.';
      render();
      const i = r.digits.findIndex(d => !d);
      const el = $('#d' + Math.max(0, i));
      if (el) el.focus();
      return;
    }

    r.busy = true;
    r.err = '';
    render();

    S.conn = { code, step: 0, failed: false };
    go('connect');
    runConnect(code);
  }

  async function runConnect(code) {
    const c = S.conn;

    const paint = () => {
      if (S.screen !== 'connect' || S.conn !== c) return;
      const ul = $('#cnSteps');
      if (ul) ul.innerHTML = stepsHTML(c);
      const h = $('#cnH');
      if (h) h.textContent = c.step >= STEPS.length - 1 ? 'Connected' : 'Connecting to sender…';
    };

    // Step simulation progression while real WebRTC connects
    c.step = 1; paint();
    await new Promise(r => setTimeout(r, 400));
    c.step = 2; paint();
    await new Promise(r => setTimeout(r, 400));
    c.step = 3; paint();

    try {
      await engine.connectAndReceive(code);
      c.step = 4; paint();
      await new Promise(r => setTimeout(r, 300));
      c.step = 5; paint();
    } catch (err) {
      console.warn('Connection failed:', err);
      c.failed = true;
      render();
    }
  }

  // --- Real Engine Callback Integration ---
  engine.onReceiverConnected = () => {
    if (S.session) {
      S.session.status = 'connected';
      toast('Receiver device connected!', 'ok');
      render();
    }
  };

  engine.onReceiverDisconnected = () => {
    if (S.session && S.session.status === 'connected') {
      S.session.status = 'waiting';
      toast('Receiver disconnected', 'info');
      render();
    }
  };

  engine.onTransferStart = data => {
    S.xfer = {
      role: data.role,
      phase: 'running',
      payloadType: data.payloadType,
      name: data.name,
      size: data.size,
      totalBytes: data.size,
      transferredBytes: 0,
      percent: 0,
      currentChunk: 0,
      totalChunks: data.totalChunks,
      speedBytesPerSec: 0
    };
    go('transfer');
  };

  engine.onProgress = data => {
    if (!S.xfer) return;
    S.xfer.percent = data.percent;
    S.xfer.transferredBytes = data.transferredBytes;
    S.xfer.totalBytes = data.totalBytes;
    S.xfer.currentChunk = data.currentChunk;
    S.xfer.totalChunks = data.totalChunks;
    S.xfer.speedBytesPerSec = data.speedBytesPerSec;

    // Update transfer UI elements smoothly
    const bar = $('#xBar');
    if (bar) bar.style.width = data.percent + '%';
    const pct = $('#xPct');
    if (pct) pct.textContent = data.percent + '%';
    const bytes = $('#xBytes');
    if (bytes) bytes.textContent = `${fmtBytes(data.transferredBytes)} / ${fmtBytes(data.totalBytes)}`;
    const speed = $('#xSpeed');
    if (speed) speed.textContent = `${(data.speedBytesPerSec / 1024 / 1024).toFixed(1)} MB/s`;
    const chunks = $('#xChunks');
    if (chunks) chunks.textContent = `${data.currentChunk} / ${data.totalChunks}`;
  };

  engine.onTransferComplete = data => {
    if (window.confetti) {
      window.confetti({ particleCount: 70, spread: 60, origin: { y: 0.6 } });
    }

    if (data.role === 'receiver') {
      S.xfer = {
        role: 'receiver',
        phase: 'done',
        payloadType: data.type,
        name: data.name,
        size: data.size,
        mimeType: data.mimeType,
        url: data.url,
        text: data.text,
        title: data.title
      };

      // Trigger auto-download if it's a file
      if (data.type === 'file' && data.url) {
        triggerDownload(data.url, data.name);
      }
      toast('Transfer completed successfully!', 'ok');
      go('transfer');
    } else {
      // Sender side completed
      toast('File was received by the other device!', 'ok');
      if (S.xfer) {
        S.xfer.phase = 'done';
        render();
      }
    }
  };

  engine.onError = errMsg => {
    toast(errMsg, 'err');
    if (S.conn) {
      S.conn.failed = true;
      render();
    }
  };

  function triggerDownload(url, filename) {
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => a.remove(), 100);
  }

  // --- Live In-built QR Scanner & Code Extraction ---
  let html5QrScannerInstance = null;
  let currentCameraFacing = 'environment';
  let availableCameras = [];

  function extractCode(text) {
    if (!text) return null;
    const matchParam = text.match(/[?&]code=(\d{6})/i);
    if (matchParam) return matchParam[1];
    const matchDigits = text.match(/\b\d{6}\b/);
    if (matchDigits) return matchDigits[0];
    const matchAny = text.match(/(\d{6})/);
    if (matchAny) return matchAny[1];
    return null;
  }

  function fillCodeAndConnect(code) {
    S.rx.digits = code.split('');
    S.rx.err = '';
    if (S.screen !== 'receive') {
      go('receive');
    } else {
      for (let i = 0; i < 6; i++) {
        const inp = $(`#d${i}`);
        if (inp) inp.value = code[i] || '';
      }
    }
    toast(`Code ${code.slice(0, 3)} ${code.slice(3)} scanned! Connecting…`, 'ok');
    try { if (navigator.vibrate) navigator.vibrate([50, 70, 50]); } catch (_) {}
    try { if (window.confetti) confetti({ particleCount: 35, spread: 65, origin: { y: 0.6 } }); } catch (_) {}
    setTimeout(() => {
      doConnect();
    }, 350);
  }

  function pasteCodeFromClipboard() {
    if (navigator.clipboard && navigator.clipboard.readText) {
      navigator.clipboard.readText().then(text => {
        const code = extractCode(text);
        if (code) {
          fillCodeAndConnect(code);
        } else {
          toast('No 6-digit code found in clipboard text', 'err');
        }
      }).catch(() => {
        toast('Clipboard access was blocked or not allowed', 'err');
      });
    } else {
      toast('Clipboard paste is not supported in this browser', 'err');
    }
  }

  function openQrScanner() {
    if (S.scannerActive) return;
    S.scannerActive = true;

    const modal = $('#modal');
    if (!modal) return;

    modal.innerHTML = `
      <div class="ovl qr-scanner-modal" id="qrScannerModal" role="dialog" aria-modal="true" aria-label="Live QR Code Scanner">
        <div class="dlg scanner-dlg">
          <div class="scanner-header">
            <div class="scanner-title">
              <span class="scanner-dot live-pulse"></span>
              <h3>Live QR Scanner</h3>
            </div>
            <button type="button" class="icon-btn close-scanner-btn" data-act="close-scanner" aria-label="Close scanner">
              ${ic('x')}
            </button>
          </div>

          <div class="scanner-body">
            <div class="scanner-viewport-wrap">
              <div id="qrReader"></div>
              
              <div class="scanner-hud" id="scannerHud">
                <div class="viewfinder-box">
                  <span class="corner tl"></span>
                  <span class="corner tr"></span>
                  <span class="corner bl"></span>
                  <span class="corner br"></span>
                  <div class="laser-beam"></div>
                </div>
              </div>

              <div class="scanner-status-overlay" id="scannerStatus">
                <div class="spin"></div>
                <span id="scannerStatusText">Starting live camera…</span>
              </div>
            </div>

            <p class="scanner-instruction" id="scannerHint">
              Point your camera at the QR code on the sender's screen.
            </p>

            <div class="scanner-controls">
              <button type="button" class="btn btn-secondary btn-sm" id="flipCameraBtn" data-act="flip-camera" title="Switch between front and back camera">
                <svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M20 10c0-4.418-3.582-8-8-8s-8 3.582-8 8c0 2.21.896 4.21 2.343 5.657L4 18h6v-6l-2.05 2.05A5.96 5.96 0 0 1 6 10c0-3.314 2.686-6 6-6s6 2.686 6 6c0 1.657-.672 3.157-1.757 4.243l1.414 1.414A7.96 7.96 0 0 0 20 10z"/>
                </svg>
                <span>Switch Camera</span>
              </button>

              <button type="button" class="btn btn-secondary btn-sm" id="uploadQrFileBtn" data-act="upload-qr-file" title="Upload QR Code screenshot or photo">
                <svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                  <circle cx="8.5" cy="8.5" r="1.5"/>
                  <polyline points="21 15 16 10 5 21"/>
                </svg>
                <span>Upload Image</span>
              </button>
              <input type="file" id="qrImageFileInput" accept="image/*" style="display:none">
            </div>
          </div>
        </div>
      </div>
    `;

    // Hook upload input
    const qrFileInput = $('#qrImageFileInput');
    if (qrFileInput) {
      qrFileInput.addEventListener('change', e => {
        if (e.target.files && e.target.files.length) {
          scanQrImageFile(e.target.files[0]);
        }
      });
    }

    requestCameraPermissionAndStart();
  }

  async function requestCameraPermissionAndStart() {
    const statusOverlay = $('#scannerStatus');
    const statusText = $('#scannerStatusText');
    if (statusOverlay) statusOverlay.classList.remove('hidden');
    if (statusText) statusText.textContent = 'Requesting camera access…';

    // Verify browser mediaDevices support
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      const isSecure = window.isSecureContext;
      let msg = 'Camera access is not supported in this browser environment.';
      if (!isSecure && location.protocol !== 'https:' && location.hostname !== 'localhost') {
        msg = 'Mobile browsers require HTTPS for camera. Please open https://giant-emus-join.loca.lt or use "Snap / Choose QR Photo"!';
      }
      showScannerError(msg);
      return;
    }

    // Explicitly prompt user for permission
    try {
      const testStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: currentCameraFacing }
      });
      // Permission granted! Stop test track so html5-qrcode can mount cleanly
      testStream.getTracks().forEach(t => t.stop());
    } catch (permErr) {
      console.warn('getUserMedia prompt result:', permErr);
      if (permErr.name === 'NotAllowedError' || permErr.name === 'PermissionDeniedError') {
        showScannerError('Camera permission was denied. Please allow camera access in browser settings, or tap below.');
        return;
      }
      // If error is just constraint-related on desktop webcam, continue to fallback
    }

    startCameraStream();
  }

  function startCameraStream() {
    const statusOverlay = $('#scannerStatus');
    const statusText = $('#scannerStatusText');
    if (statusOverlay) statusOverlay.classList.remove('hidden');
    if (statusText) statusText.textContent = 'Starting camera preview…';

    if (typeof Html5Qrcode === 'undefined') {
      showScannerError('QR Scanner library not loaded. Check internet or choose an image file.');
      return;
    }

    // Clear any previous instance
    if (html5QrScannerInstance) {
      try {
        if (html5QrScannerInstance.isScanning) {
          html5QrScannerInstance.stop().catch(() => {});
        }
      } catch (_) {}
      html5QrScannerInstance = null;
    }

    setTimeout(() => {
      try {
        html5QrScannerInstance = new Html5Qrcode("qrReader", { verbose: false });
      } catch (err) {
        console.error('Html5Qrcode init error:', err);
        showScannerError('Camera initialization failed.');
        return;
      }

      const qrSuccessCallback = (decodedText) => {
        console.log('QR Code scanned:', decodedText);
        const code = extractCode(decodedText);
        if (code) {
          closeQrScanner();
          fillCodeAndConnect(code);
        } else {
          toast('Scanned content did not contain a 6-digit code: ' + decodedText, 'info');
        }
      };

      const config = {
        fps: 15,
        qrbox: (viewfinderWidth, viewfinderHeight) => {
          const edge = Math.min(viewfinderWidth || 240, viewfinderHeight || 240);
          const size = Math.max(170, Math.floor(edge * 0.78));
          return { width: size, height: size };
        },
        aspectRatio: 1.0
      };

      html5QrScannerInstance.start(
        { facingMode: currentCameraFacing },
        config,
        qrSuccessCallback,
        () => {}
      ).then(() => {
        if (statusOverlay) statusOverlay.classList.add('hidden');
      }).catch(err => {
        console.warn('Camera start with facingMode failed:', err);
        Html5Qrcode.getCameras().then(devices => {
          availableCameras = devices;
          if (devices && devices.length) {
            const backCam = devices.find(d => /back|rear|environment/i.test(d.label)) || devices[0];
            return html5QrScannerInstance.start(
              backCam.id,
              config,
              qrSuccessCallback,
              () => {}
            ).then(() => {
              if (statusOverlay) statusOverlay.classList.add('hidden');
            });
          } else {
            showScannerError('No camera found on this device.');
          }
        }).catch(camErr => {
          console.error('getCameras error:', camErr);
          const isSecure = window.isSecureContext;
          let msg = 'Camera access blocked or permission denied.';
          if (!isSecure && location.protocol !== 'https:' && location.hostname !== 'localhost') {
            msg = 'Camera requires HTTPS or Localhost. Open https://giant-emus-join.loca.lt or use "Snap / Choose QR Photo"!';
          }
          showScannerError(msg);
        });
      });
    }, 60);
  }

  function showScannerError(msg) {
    const statusOverlay = $('#scannerStatus');
    if (statusOverlay) {
      statusOverlay.classList.remove('hidden');
      statusOverlay.innerHTML = `
        <div style="font-size:32px;">📷</div>
        <p style="font-size:13.5px;color:var(--text);margin:0;max-width:280px;line-height:1.5;">${esc(msg)}</p>
        <button type="button" class="btn btn-primary btn-sm" data-act="request-camera-perm" style="margin-top:8px;">
          Allow Camera / Try Again
        </button>
        <button type="button" class="btn btn-secondary btn-sm" data-act="upload-qr-file" style="margin-top:6px;">
          Snap / Choose QR Photo
        </button>
      `;
    }
  }

  function flipCamera() {
    currentCameraFacing = (currentCameraFacing === 'environment') ? 'user' : 'environment';
    if (html5QrScannerInstance) {
      try {
        if (html5QrScannerInstance.isScanning) {
          html5QrScannerInstance.stop().then(() => {
            requestCameraPermissionAndStart();
          }).catch(() => {
            requestCameraPermissionAndStart();
          });
          return;
        }
      } catch (_) {}
    }
    requestCameraPermissionAndStart();
  }

  function scanQrImageFile(file) {
    if (!file) return;
    const statusOverlay = $('#scannerStatus');
    const statusText = $('#scannerStatusText');
    if (statusOverlay) {
      statusOverlay.classList.remove('hidden');
      if (statusText) statusText.textContent = 'Scanning image file…';
    }

    const scanner = html5QrScannerInstance || new Html5Qrcode("qrReader");
    scanner.scanFile(file, true).then(decodedText => {
      const code = extractCode(decodedText);
      if (code) {
        closeQrScanner();
        fillCodeAndConnect(code);
      } else {
        toast('Image scanned, but no 6-digit code found: ' + decodedText, 'err');
        if (statusOverlay) statusOverlay.classList.add('hidden');
      }
    }).catch(err => {
      console.warn('scanFile error:', err);
      toast('Could not find a valid QR code in this image. Try another photo or enter code manually.', 'err');
      if (statusOverlay) statusOverlay.classList.add('hidden');
    });
  }

  function closeQrScanner() {
    S.scannerActive = false;
    if (html5QrScannerInstance) {
      try {
        if (html5QrScannerInstance.isScanning) {
          html5QrScannerInstance.stop().then(() => {
            try { html5QrScannerInstance.clear(); } catch (_) {}
            html5QrScannerInstance = null;
          }).catch(() => {
            html5QrScannerInstance = null;
          });
        } else {
          try { html5QrScannerInstance.clear(); } catch (_) {}
          html5QrScannerInstance = null;
        }
      } catch (e) {
        html5QrScannerInstance = null;
      }
    }
    const modal = $('#modal');
    if (modal) modal.innerHTML = '';
  }

  // --- Event Delegation ---
  const ACT = {
    'hide-strip': () => { const s = $('#strip'); if (s) s.hidden = true; },
    menu: () => {
      const n = $('#nav');
      const o = n.classList.toggle('open');
      const mb = $('#menuBtn');
      if (mb) mb.setAttribute('aria-expanded', String(o));
    },
    'open-scanner': () => openQrScanner(),
    'close-scanner': () => closeQrScanner(),
    'flip-camera': () => flipCamera(),
    'request-camera-perm': () => requestCameraPermissionAndStart(),
    'upload-qr-file': () => {
      const fi = $('#qrImageFileInput');
      if (fi) fi.click();
    },
    'paste-code': () => pasteCodeFromClipboard(),
    'mode-file': () => { S.mode = 'file'; render(); },
    'mode-note': () => { S.mode = 'note'; render(); },
    pick: () => $('#fileInput').click(),
    clear: () => { S.files = []; S.sendErr = ''; render(); },
    remove: t => {
      S.files = S.files.filter(f => f.id !== +t.dataset.id);
      S.sendErr = '';
      render();
    },
    gen: () => {
      if (S.mode === 'file' && !S.files.length) {
        S.sendErr = 'Choose at least one file first.';
        render();
        return;
      }
      if (S.mode === 'note' && !S.noteText.trim()) {
        S.sendErr = 'Enter your note text first.';
        render();
        return;
      }
      createLiveSession();
    },
    'new-code': () => {
      engine.destroy();
      S.session = null;
      createLiveSession();
    },
    copy: () => {
      if (!S.session) return;
      const code = S.session.code;
      navigator.clipboard.writeText(code).then(() => {
        toast(`Code ${code.slice(0, 3)} ${code.slice(3)} copied to clipboard!`, 'info');
      }).catch(() => {
        toast(`Code: ${code}`, 'info');
      });
    },
    'toggle-qr': () => {
      S.showQr = !S.showQr;
      render();
    },
    'cancel-session': () => {
      confirmBox({
        title: 'Cancel this live session?',
        body: 'The code will expire and memory will be cleared. Connected receivers will disconnect.',
        yes: 'Cancel Session',
        no: 'Keep Sharing',
        danger: true
      }, () => {
        engine.destroy();
        window.onbeforeunload = null;
        S.session = null;
        go('send');
        toast('Session cancelled. Memory cleared.', 'info');
      });
    },
    retry: () => {
      if (S.conn) runConnect(S.conn.code);
    },
    'abort-connect': () => {
      engine.destroy();
      S.conn = null;
      go('receive');
    },
    'cancel-xfer': () => {
      confirmBox({
        title: 'Cancel active transfer?',
        body: 'Incomplete file data will be cleared from memory.',
        yes: 'Cancel Transfer',
        no: 'Keep Going',
        danger: true
      }, () => {
        engine.destroy();
        window.onbeforeunload = null;
        S.xfer = null;
        go('home');
        toast('Transfer cancelled', 'info');
      });
    },
    'download-file': () => {
      if (S.xfer && S.xfer.url) {
        triggerDownload(S.xfer.url, S.xfer.name);
        toast('Download triggered', 'ok');
      }
    },
    'copy-note': () => {
      if (S.xfer && S.xfer.text) {
        navigator.clipboard.writeText(S.xfer.text).then(() => {
          toast('Note copied to clipboard!', 'ok');
        });
      }
    },
    again: () => {
      engine.destroy();
      window.onbeforeunload = null;
      S.xfer = null;
      if (S.screen === 'transfer') go('receive');
      else go('send');
    }
  };

  document.addEventListener('click', e => {
    const g = e.target.closest('[data-go]');
    if (g) {
      e.preventDefault();
      const to = g.dataset.go;
      if (to === S.screen && !g.dataset.hash) {
        window.scrollTo(0, 0);
        return;
      }
      go(to, { hash: g.dataset.hash });
      return;
    }

    const a = e.target.closest('[data-act]');
    if (a && ACT[a.dataset.act]) {
      e.preventDefault();
      if (a.closest('#dz') && a.dataset.act === 'pick') {
        e.stopPropagation();
      }
      ACT[a.dataset.act](a);
    }
  });

  // Direct dropzone click
  document.addEventListener('click', e => {
    const dz = e.target.closest('#dz');
    if (dz && !e.target.closest('[data-act]')) {
      $('#fileInput').click();
    }
  });

  // Keyboard support for dropzone
  document.addEventListener('keydown', e => {
    const dz = e.target.closest && e.target.closest('#dz');
    if (dz && e.target === dz && (e.key === 'Enter' || e.key === ' ')) {
      e.preventDefault();
      $('#fileInput').click();
    }
  });

  // Note inputs syncing
  document.addEventListener('input', e => {
    if (e.target.id === 'noteTitleInput') {
      S.noteTitle = e.target.value;
    }
    if (e.target.id === 'noteTextInput') {
      S.noteText = e.target.value;
      const count = $('#noteCharCount');
      if (count) count.textContent = `${S.noteText.length} characters`;
      const btn = $('[data-act="gen"]');
      if (btn) btn.disabled = !S.noteText.trim();
    }
  });

  // Receive form submit
  document.addEventListener('submit', e => {
    if (e.target.id === 'rxForm') {
      e.preventDefault();
      doConnect();
    }
  });

  // File input change
  const fileInput = $('#fileInput');
  if (fileInput) {
    fileInput.addEventListener('change', e => {
      if (e.target.files.length) addFiles(e.target.files);
      e.target.value = '';
    });
  }

  // Drag and drop events
  ['dragenter', 'dragover'].forEach(t => {
    document.addEventListener(t, e => {
      e.preventDefault();
      const dz = e.target.closest && e.target.closest('#dz');
      if (dz) dz.classList.add('over');
    });
  });

  document.addEventListener('dragleave', e => {
    const dz = e.target.closest && e.target.closest('#dz');
    if (dz && !dz.contains(e.relatedTarget)) dz.classList.remove('over');
  });

  document.addEventListener('drop', e => {
    e.preventDefault();
    const dz = $('#dz');
    if (dz) dz.classList.remove('over');
    if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length) {
      addFiles(e.dataTransfer.files);
    }
  });

  // Auto-connect if ?code= in URL query params
  function checkUrlCode() {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    if (code && /^\d{6}$/.test(code)) {
      S.rx.digits = code.split('');
      go('receive');
      toast(`Code ${code} detected from link!`, 'info');
    }
  }

  // Initialize
  const initialHash = (location.hash || '').replace('#', '');
  S.screen = ['send', 'receive', 'how'].includes(initialHash) ? initialHash : 'home';
  render();
  checkUrlCode();

})();
