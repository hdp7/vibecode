// Simple Weather App using Open‑Meteo APIs (no key needed)
// Docs: https://open-meteo.com/

const qs = (sel, el = document) => el.querySelector(sel);
const qsa = (sel, el = document) => [...el.querySelectorAll(sel)];
const $status = qs('#status');
const $sugs = qs('#suggestions');
const $current = qs('#current');
const $hourly = qs('#hourly');
const $daily = qs('#daily');

function setStatus(msg, type = 'info') {
  $status.textContent = msg || '';
  $status.className = type === 'error' ? 'muted error' : 'muted';
}

function fmtTemp(v) { return `${Math.round(v)}°F`; }
function fmtTime(iso, opts) { return new Date(iso).toLocaleString(undefined, opts); }
function iconFor(code) {
  // Minimal mapping; extend as needed
  const map = {
    0: '☀️', 1: '🌤️', 2: '⛅', 3: '☁️', 45: '🌫️', 48: '🌫️', 51: '🌦️', 61: '🌧️', 71: '🌨️', 80: '🌧️', 95: '⛈️'
  };
  return map[code] || '🌡️';
}

async function geocode(q) {
  const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(q)}&count=5&language=en&format=json`;
  const res = await fetch(url);
  if (!res.ok) throw new Error('Geocoding failed');
  const data = await res.json();
  return (data.results || []).map(r => ({
    name: `${r.name}, ${r.admin1 || r.country}`, lat: r.latitude, lon: r.longitude
  }));
}

async function forecast(lat, lon) {
  const params = new URLSearchParams({
    latitude: lat, longitude: lon,
    current: 'temperature_2m,apparent_temperature,relative_humidity_2m,wind_speed_10m,weather_code',
    hourly: 'temperature_2m,apparent_temperature,precipitation_probability,weather_code',
    daily: 'weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum',
    temperature_unit: 'fahrenheit', wind_speed_unit: 'mph', precipitation_unit: 'inch',
    timezone: 'auto'
  });
  const url = `https://api.open-meteo.com/v1/forecast?${params.toString()}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error('Forecast failed');
  return res.json();
}

function renderCurrent(place, data) {
  const c = data.current;
  $current.classList.remove('hidden');
  $current.innerHTML = `
    <h2>Now in ${place}</h2>
    <div class="grid">
      <div class="tile"><div class="kv"><span>Condition</span><strong>${iconFor(c.weather_code)} ${c.weather_code}</strong></div></div>
      <div class="tile"><div class="kv"><span>Temperature</span><strong>${fmtTemp(c.temperature_2m)}</strong></div></div>
      <div class="tile"><div class="kv"><span>Feels like</span><strong>${fmtTemp(c.apparent_temperature)}</strong></div></div>
      <div class="tile"><div class="kv"><span>Humidity</span><strong>${c.relative_humidity_2m}%</strong></div></div>
      <div class="tile"><div class="kv"><span>Wind</span><strong>${Math.round(c.wind_speed_10m)} mph</strong></div></div>
    </div>`;
}

function renderHourly(data) {
  const h = data.hourly;
  $hourly.classList.remove('hidden');
  const nowIdx = h.time.findIndex(t => new Date(t) > new Date());
  const start = Math.max(0, nowIdx - 1);
  const end = Math.min(h.time.length, start + 24);
  let html = '<h2>Next 24 hours</h2><div class="scroll-x">';
  for (let i = start; i < end; i++) {
    html += `<div class="hour">
      <div class="small">${fmtTime(h.time[i], {hour: 'numeric', minute: '2-digit'})}</div>
      <div style="font-size:1.4rem">${iconFor(h.weather_code[i])}</div>
      <div class="temp">${fmtTemp(h.temperature_2m[i])}</div>
      <div class="small">Feels ${fmtTemp(h.apparent_temperature[i])}</div>
      <div class="small">Rain ${h.precipitation_probability[i] ?? 0}%</div>
    </div>`;
  }
  html += '</div>';
  $hourly.innerHTML = html;
}

function renderDaily(data) {
  const d = data.daily;
  $daily.classList.remove('hidden');
  let rows = '';
  for (let i = 0; i < d.time.length; i++) {
    rows += `<div class="day">
      <div><strong>${fmtTime(d.time[i], { weekday: 'long', month: 'short', day: 'numeric'})}</strong></div>
      <div>${iconFor(d.weather_code[i])}</div>
      <div class="temp">${fmtTemp(d.temperature_2m_max[i])} / ${fmtTemp(d.temperature_2m_min[i])}</div>
      <div class="small muted">Precip: ${d.precipitation_sum[i]} in</div>
    </div>`;
  }
  $daily.innerHTML = `<h2>7‑Day Forecast</h2>${rows}`;
}

async function loadPlace(place, lat, lon) {
  setStatus('Loading forecast…');
  try {
    const data = await forecast(lat, lon);
    renderCurrent(place, data);
    renderHourly(data);
    renderDaily(data);
    setStatus('');
  } catch (e) {
    console.error(e);
    setStatus('Could not load forecast. Please try again.', 'error');
  }
}

// Search form
qs('#search-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const q = qs('#q').value.trim();
  if (!q) return;
  setStatus('Searching…');
  $sugs.innerHTML = '';
  try {
    const results = await geocode(q);
    setStatus(results.length ? 'Pick a location:' : 'No matches');
    $sugs.innerHTML = results.map(r => `<div class="suggestion" data-lat="${r.lat}" data-lon="${r.lon}" data-name="${r.name}">${r.name}</div>`).join('');
  } catch (e) {
    console.error(e);
    setStatus('Search failed', 'error');
  }
});

$sugs.addEventListener('click', (e) => {
  const el = e.target.closest('.suggestion');
  if (!el) return;
  const lat = Number(el.dataset.lat);
  const lon = Number(el.dataset.lon);
  const name = el.dataset.name;
  $sugs.innerHTML = '';
  loadPlace(name, lat, lon);
});

// GPS button
qs('#use-gps').addEventListener('click', () => {
  if (!navigator.geolocation) {
    setStatus('Geolocation is not supported in this browser.', 'error');
    return;
  }
  setStatus('Getting your location…');
  navigator.geolocation.getCurrentPosition(async (pos) => {
    const { latitude: lat, longitude: lon } = pos.coords;
    // Reverse geocode to get a name
    try {
      const url = `https://geocoding-api.open-meteo.com/v1/reverse?latitude=${lat}&longitude=${lon}&language=en&format=json`;
      const res = await fetch(url);
      const data = await res.json();
      const place = data && data.results && data.results[0] ? `${data.results[0].name}, ${data.results[0].admin1 || data.results[0].country}` : 'Your location';
      loadPlace(place, lat, lon);
    } catch {
      loadPlace('Your location', lat, lon);
    }
  }, (err) => setStatus(err.message || 'Location failed', 'error'), { enableHighAccuracy: true, timeout: 10000 });
});

// If user has geolocation, offer to load immediately (quietly)
setTimeout(() => {
  if ('geolocation' in navigator) {
    // no auto-run to respect privacy; user clicks 📍
  }
}, 500);
