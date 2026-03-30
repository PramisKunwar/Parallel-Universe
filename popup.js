const $ = (sel) => document.querySelector(sel);

chrome.storage.local.get(['survEnabled', 'survMode'], (data) => {
  const enabled = data.survEnabled !== false; // default true
  const mode = data.survMode || 'active';

  $('#enableToggle').checked = enabled;
  updateStatusUI(enabled);
  setModeUI(mode);
});

$('#enableToggle').addEventListener('change', (e) => {
  const enabled = e.target.checked;
  chrome.storage.local.set({ survEnabled: enabled });
  updateStatusUI(enabled);
  sendToContent({ type: 'SURV_TOGGLE', enabled });
});

document.querySelectorAll('.mode-btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    const mode = btn.dataset.mode;
    chrome.storage.local.set({ survMode: mode });
    setModeUI(mode);
    sendToContent({ type: 'SURV_MODE', mode });
  });
});

function updateStatusUI(enabled) {
  const dot = $('#statusDot');
  const text = $('#statusText');
  if (enabled) {
    dot.classList.remove('offline');
    text.textContent = 'SYSTEM ONLINE';
  } else {
    dot.classList.add('offline');
    text.textContent = 'SYSTEM OFFLINE';
  }
}

function setModeUI(mode) {
  document.querySelectorAll('.mode-btn').forEach((b) => b.classList.remove('active'));
  $(`#${mode}Btn`).classList.add('active');
}

function sendToContent(msg) {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (tabs[0]?.id) chrome.tabs.sendMessage(tabs[0].id, msg);
  });
}

function updateMetrics() {
  $('#metricTargets').textContent = Math.floor(Math.random() * 40 + 10);
  $('#metricSignal').textContent = Math.floor(Math.random() * 20 + 78) + '%';
  $('#metricData').textContent = (Math.random() * 500 + 100).toFixed(0) + ' KB/s';
}
updateMetrics();
setInterval(updateMetrics, 2500);
