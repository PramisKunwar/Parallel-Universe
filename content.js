(function () {
  'use strict';

  let enabled = true;
  let mode = 'active'; 

  chrome.storage.local.get(['survEnabled', 'survMode'], (data) => {
    enabled = data.survEnabled !== false;
    mode = data.survMode || 'active';
    if (!enabled) document.body.classList.add('surv-disabled');
    if (mode === 'passive') document.body.classList.add('surv-passive');
    init();
  });

  chrome.runtime.onMessage.addListener((msg) => {
    if (msg.type === 'SURV_TOGGLE') {
      enabled = msg.enabled;
      document.body.classList.toggle('surv-disabled', !enabled);
    }
    if (msg.type === 'SURV_MODE') {
      mode = msg.mode;
      document.body.classList.toggle('surv-passive', mode === 'passive');
    }
  });

  function init() {
    injectHUD();
    injectScanlines();
    injectTargetReticle();
    injectRadar();
    injectAlertPanel();
    startTextTransformation();
    startFeedLabeling();
    startAlerts();
    startMetrics();
    startGlitch();
  }
  const TEXT_MAP = [
    [/\bSubscribe\b/gi, 'Join the cult'],
    [/\bSubscribed\b/gi, 'Locked In'],
    [/\bUnsubscribe\b/gi, 'Dip Out'],
    [/\bLike\b/gi, 'Approved'],
    [/\bDislike\b/gi, 'Weak'],
    [/\bShare\b/gi, 'Send it'],
    [/\bComment\b/gi, 'Talk'],
    [/\bComments\b/gi, 'Talk Zone'],
    [/\bRecommended\b/gi, 'Your Vibe'],
    [/\bTrending\b/gi, 'Viral Now'],
    [/\bLive\b/gi, 'Happening Now'],
    [/\bWatch later\b/gi, 'Queue Up'],
    [/\bHistory\b/gi, 'Your past'],
    [/\bLibrary\b/gi, 'Collection'],
    [/\bHome\b/gi, 'Main Feed'],
    [/\bExplore\b/gi, 'Dive in'],
    [/\bShorts\b/gi, 'Clips'],
    [/\bPlaylist\b/gi, 'Mix'],
    [/\bPlaylists\b/gi, 'Mixes'],
    [/\bChannel\b/gi, 'Subject Profile'],
    [/\bchannels\b/gi, 'Subject Profiles'],
    [/\bNotifications?\b/gi, 'Pings'],
    [/\bSearch\b/gi, 'Scan database'],
    [/\bSave\b/gi, 'Bookmark'],
    [/\bDownload\b/gi, 'Take Offline'],
    [/\bReport\b/gi, 'Flag'],
    [/\bSettings\b/gi, 'Control Panel'],
    [/\bviews\b/gi, 'Hits 👀'],
    [/\bView\b/gi, 'Hit'],
    [/\bago\b/gi, 'Back'],
    [/\bsubscribers?\b/gi, 'Crew'],
    [/\bvideos?\b/gi, 'FEEDS'],
  ];

  function transformText(root) {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null);
    let node;
    while ((node = walker.nextNode())) {
      const tag = node.parentElement?.tagName;
      if (tag === 'SCRIPT' || tag === 'STYLE' || tag === 'TEXTAREA' || tag === 'INPUT') continue;
      
      let text = node.nodeValue;
      let changed = false;
      for (const [pattern, replacement] of TEXT_MAP) {
        if (pattern.test(text)) {
          text = text.replace(pattern, replacement);
          changed = true;
        }
      }
      if (changed) node.nodeValue = text;
    }
  }

  function startTextTransformation() {
    transformText(document.body);
    const observer = new MutationObserver((mutations) => {
      if (!enabled) return;
      for (const m of mutations) {
        for (const added of m.addedNodes) {
          if (added.nodeType === Node.ELEMENT_NODE) transformText(added);
          else if (added.nodeType === Node.TEXT_NODE) transformText(added.parentElement || document.body);
        }
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }

  function injectHUD() {
    const topBar = document.createElement('div');
    topBar.id = 'surv-hud-top';
    topBar.innerHTML = `
      <div class="surv-status-item"><span class="surv-dot"></span> SYSTEM: ONLINE</div>
      <div class="surv-status-item">ACTIVE TARGETS: <span id="surv-target-count">24</span></div>
      <div class="surv-status-item">SIGNAL: <span id="surv-signal-strength">87</span>%</div>
      <div class="surv-status-item">DATA FLOW: <span id="surv-data-flow">342</span> KB/s</div>
    `;
    document.body.appendChild(topBar);
    const corners = [
      { id: 'surv-corner-tl', html: 'SECTOR: GLOBAL<br>CLEARANCE: LEVEL 5' },
      { id: 'surv-corner-tr', html: 'ENCRYPTION: AES-256<br>UPLINK: STABLE' },
      { id: 'surv-corner-bl', html: `TIMESTAMP: <span id="surv-timestamp">${getTimestamp()}</span>` },
    ];
    corners.forEach(({ id, html }) => {
      const el = document.createElement('div');
      el.id = id;
      el.className = 'surv-corner-panel';
      el.innerHTML = html;
      document.body.appendChild(el);
    });
    setInterval(() => {
      const ts = document.getElementById('surv-timestamp');
      if (ts) ts.textContent = getTimestamp();
    }, 1000);
  }

  function getTimestamp() {
    return new Date().toISOString().replace('T', ' ').substring(0, 19) + ' UTC';
  }

  function injectScanlines() {
    const el = document.createElement('div');
    el.id = 'surv-scanline-overlay';
    document.body.appendChild(el);
  }

  function injectTargetReticle() {
    const reticle = document.createElement('div');
    reticle.id = 'surv-target-reticle';
    reticle.innerHTML = `
      <div class="surv-reticle-corner-tr"></div>
      <div class="surv-reticle-corner-bl"></div>
      <div id="surv-target-label">TARGET IDENTIFIED // STATUS: ACTIVE</div>
    `;
    document.body.appendChild(reticle);

    const TARGETS = 'ytd-rich-item-renderer, ytd-video-renderer, ytd-compact-video-renderer, ytd-grid-video-renderer, a#thumbnail';

    document.addEventListener('mouseover', (e) => {
      if (!enabled) return;
      const target = e.target.closest(TARGETS);
      if (!target) {
        reticle.classList.remove('active');
        return;
      }
      const rect = target.getBoundingClientRect();
      Object.assign(reticle.style, {
        top: rect.top + window.scrollY + 'px',
        left: rect.left + 'px',
        width: rect.width + 'px',
        height: rect.height + 'px',
        position: 'absolute',
      });
      reticle.classList.add('active');
    });

    document.addEventListener('mouseout', (e) => {
      const target = e.target.closest(TARGETS);
      if (target && !target.contains(e.relatedTarget)) {
        reticle.classList.remove('active');
      }
    });
  }

  const LABEL_TYPES = ['LIVE FEED', 'ARCHIVED', 'TRACKING'];
  const LABEL_CLASSES = ['live', 'archived', 'tracking'];

  function labelThumbnails() {
    const thumbs = document.querySelectorAll('ytd-thumbnail:not([data-surv-labeled])');
    thumbs.forEach((thumb) => {
      thumb.setAttribute('data-surv-labeled', 'true');
      thumb.style.position = 'relative';
      const idx = Math.floor(Math.random() * LABEL_TYPES.length);
      const label = document.createElement('div');
      label.className = `surv-feed-label ${LABEL_CLASSES[idx]}`;
      label.textContent = LABEL_TYPES[idx];
      thumb.appendChild(label);
    });
  }

  function startFeedLabeling() {
    labelThumbnails();
    setInterval(labelThumbnails, 3000);
  }

  const ALERT_MESSAGES = [
    { text: '⚠ SUBJECT MOVEMENT DETECTED — SECTOR 7', red: true },
    { text: 'SIGNAL LOCKED — FEED SYNCHRONIZED', red: false },
    { text: 'DATA STREAM ACTIVE — BANDWIDTH NOMINAL', red: false },
    { text: '⚠ ANOMALY DETECTED IN FEED CLUSTER', red: true },
    { text: 'TARGET PROFILE UPDATED — CROSS-REFERENCING', red: false },
    { text: 'PERIMETER SCAN COMPLETE — NO THREATS', red: false },
    { text: '⚠ UNAUTHORIZED ACCESS ATTEMPT — BLOCKED', red: true },
    { text: 'INTEL PACKAGE RECEIVED — DECRYPTING', red: false },
    { text: 'UPLINK HANDSHAKE CONFIRMED', red: false },
  ];

  function injectAlertPanel() {
    const panel = document.createElement('div');
    panel.id = 'surv-alert-panel';
    document.body.appendChild(panel);
  }

  function startAlerts() {
    function showAlert() {
      if (!enabled || mode === 'passive') return;
      const panel = document.getElementById('surv-alert-panel');
      if (!panel) return;

      const alert = ALERT_MESSAGES[Math.floor(Math.random() * ALERT_MESSAGES.length)];
      panel.textContent = alert.text;
      panel.classList.toggle('alert-red', alert.red);
      panel.classList.add('visible');

      setTimeout(() => panel.classList.remove('visible'), 3500);
    }

    setTimeout(() => {
      showAlert();
      setInterval(showAlert, Math.random() * 8000 + 7000);
    }, 5000);
  }

  function injectRadar() {
    const radar = document.createElement('div');
    radar.id = 'surv-radar';

    const grid = document.createElement('div');
    grid.className = 'radar-grid';
    radar.appendChild(grid);

    const sweep = document.createElement('div');
    sweep.className = 'radar-sweep';
    radar.appendChild(sweep);

    for (let i = 0; i < 6; i++) {
      const dot = document.createElement('div');
      dot.className = 'radar-dot';
      const angle = Math.random() * Math.PI * 2;
      const dist = Math.random() * 40 + 8;
      dot.style.left = (60 + Math.cos(angle) * dist - 2) + 'px';
      dot.style.top = (60 + Math.sin(angle) * dist - 2) + 'px';
      dot.style.animationDelay = (Math.random() * 2) + 's';
      radar.appendChild(dot);
    }

    const label = document.createElement('div');
    label.className = 'radar-label';
    label.textContent = 'PROXIMITY SCAN';
    radar.appendChild(label);

    document.body.appendChild(radar);
  }

  function startMetrics() {
    setInterval(() => {
      if (!enabled) return;
      const tc = document.getElementById('surv-target-count');
      const ss = document.getElementById('surv-signal-strength');
      const df = document.getElementById('surv-data-flow');
      if (tc) tc.textContent = Math.floor(Math.random() * 30 + 12);
      if (ss) ss.textContent = Math.floor(Math.random() * 15 + 82);
      if (df) df.textContent = Math.floor(Math.random() * 400 + 150);
    }, 2500);
  }

  function startGlitch() {
    setInterval(() => {
      if (!enabled || mode === 'passive') return;
      if (Math.random() > 0.7) {
        document.body.classList.add('surv-glitch-flash');
        setTimeout(() => document.body.classList.remove('surv-glitch-flash'), 150);
      }
    }, 12000);
  }

})();