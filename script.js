const view = document.querySelector('#view');
const refresh = document.querySelector('#refresh');
const status = document.querySelector('#status');
const cities = {
  mosul: { name: 'Mosul', country: 'Iraq', latitude: 36.34, longitude: 43.13 },
  toronto: { name: 'Toronto', country: 'Canada', latitude: 43.65, longitude: -79.38 }
};
let city = 'mosul';
let driving = false;
let wipers = false;
let requestNumber = 0;
let clockZone = null;

function updateClock() {
  if (!clockZone) return;
  const time = new Intl.DateTimeFormat('en', {
    timeZone: clockZone, hour: 'numeric', minute: '2-digit'
  }).format(new Date());
  document.querySelector('#local-time').textContent = cities[city].name + ' · ' + time;
}

function showWeather(data) {
  const weather = data.current;
  const day = weather.is_day === 1;
  const warm = weather.temperature_2m >= 18;
  const wet = weather.precipitation > 0;
  const snow = [71, 73, 75, 77, 85, 86].includes(weather.weather_code);
  view.classList.toggle('day', day);
  view.classList.toggle('night', !day);
  view.classList.toggle('snow', snow);
  view.style.setProperty('--sky-top', day ? (warm ? '#b3b5a0' : '#789bac') : '#182635');
  view.style.setProperty('--sky-bottom', day ? (warm ? '#e5c59d' : '#c2d0cf') : '#74717b');
  view.style.setProperty('--cloud', weather.cloud_cover / 100 * .7);
  view.style.setProperty('--wind-speed', Math.max(1.5, 12 - weather.wind_speed_10m / 4) + 's');
  view.style.setProperty('--wind-angle', (weather.wind_direction_10m / 360 * 30 - 15) + 'deg');
  view.style.setProperty('--rain-opacity', wet ? Math.min(.85, .25 + weather.precipitation / 4) : 0);
  let mood = 'Could stay out a little longer.';
  let description = 'Nothing to rush back for. Watch the city go by.';
  if (snow) {
    mood = 'Snow on the window.';
    description = 'The street looks different with a little white on it.';
  } else if (wet) {
    mood = 'Rain makes the ride better.';
    description = 'From the passenger seat, anyway. Try the wipers.';
  } else if (!day) {
    mood = 'Everyone’s asleep. Almost.';
    description = 'A few lights are still on. We can take another turn.';
  } else if (weather.apparent_temperature < 10) {
    mood = 'Windows up. It’s cold out.';
    description = 'Happy to watch this one from inside the car.';
  }
  document.querySelector('#mood').textContent = mood;
  document.querySelector('#description').textContent = description;
  document.querySelector('#temperature').textContent = Math.round(weather.apparent_temperature) + '°C';
  document.querySelector('#wind').textContent = Math.round(weather.wind_speed_10m) + ' km/h';
  document.querySelector('#cloud').textContent = weather.cloud_cover + '%';
  document.querySelector('#scene-state').textContent = (day ? 'DAYLIGHT' : 'AFTER DARK') + (wet ? (snow ? ' / SNOW' : ' / RAIN') : ' / DRY');
  document.querySelector('#precipitation').textContent = 'Precipitation: ' + weather.precipitation + ' mm in the current interval. Air temperature: ' + weather.temperature_2m + '°C.';
  document.querySelector('#json').textContent = JSON.stringify({ timezone: data.timezone, current_units: data.current_units, current: weather }, null, 2);
  view.setAttribute('aria-label', 'Illustrated car-window view of ' + cities[city].name + '. ' + (day ? 'Daylight' : 'Nighttime') + ', ' + weather.cloud_cover + '% cloud cover, ' + weather.precipitation + ' mm precipitation.');
  clockZone = data.timezone;
  updateClock();
  status.textContent = 'Weather time: ' + weather.time.replace('T', ' at ') + ' (' + data.timezone + '). Checked at ' + new Date().toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'}) + ' your time.';
}

async function getWeather() {
  const thisRequest = ++requestNumber;
  const place = cities[city];
  refresh.disabled = true;
  view.classList.add('loading');
  clockZone = null;
  document.querySelector('#local-time').textContent = 'Checking ' + place.name + '…';
  document.querySelector('#weather').setAttribute('aria-busy', 'true');
  document.querySelector('#place-label').textContent = (place.name + ', ' + place.country).toUpperCase();
  document.querySelector('#scene-state').textContent = 'WAITING FOR LIVE WEATHER';
  document.querySelector('#mood').textContent = 'Let’s see what it’s like.';
  document.querySelector('#description').textContent = 'Getting the current weather in ' + place.name + '.';
  for (const id of ['temperature', 'wind', 'cloud']) document.getElementById(id).textContent = '—';
  document.querySelector('#json').textContent = 'Waiting for the API response.';
  document.querySelector('#precipitation').textContent = 'Precipitation: waiting for data.';
  status.textContent = 'Connecting to Open-Meteo…';
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12000);
  try {
    const fields = 'temperature_2m,apparent_temperature,is_day,precipitation,cloud_cover,wind_speed_10m,wind_direction_10m,weather_code';
    const url = 'https://api.open-meteo.com/v1/forecast?latitude=' + place.latitude + '&longitude=' + place.longitude + '&current=' + fields + '&timezone=auto';
    const response = await fetch(url, {signal: controller.signal});
    if (!response.ok) throw new Error('Weather request failed');
    const data = await response.json();
    if (thisRequest !== requestNumber) return;
    if (!data.current || fields.split(',').some(field => !Number.isFinite(data.current[field]))) throw new Error('Missing weather data');
    showWeather(data);
    view.classList.remove('loading');
  } catch (error) {
    if (thisRequest !== requestNumber) return;
    document.querySelector('#mood').textContent = 'Lost the weather for a second.';
    document.querySelector('#description').textContent = 'Try Check the weather again. The view isn’t current.';
    document.querySelector('#scene-state').textContent = 'WEATHER UNAVAILABLE';
    view.setAttribute('aria-label', 'Weather unavailable. The illustrated view is not current.');
    status.textContent = 'Could not load live data. Check your connection and try again.';
  } finally {
    clearTimeout(timeout);
    if (thisRequest === requestNumber) {
      refresh.disabled = false;
      document.querySelector('#weather').setAttribute('aria-busy', 'false');
    }
  }
}

document.querySelectorAll('.city').forEach(button => {
  button.addEventListener('click', () => {
    city = button.dataset.city;
    document.querySelectorAll('.city').forEach(item => {
      item.classList.toggle('active', item === button);
      item.setAttribute('aria-pressed', item === button);
    });
    getWeather();
  });
});
document.querySelector('#drive').addEventListener('click', event => {
  driving = !driving;
  view.classList.toggle('parked', !driving);
  event.currentTarget.setAttribute('aria-pressed', driving);
  event.currentTarget.textContent = driving ? 'Pull over for a bit' : 'Take the long way';
  document.querySelector('#drive-note').textContent = driving ? 'No rush. Just looking out.' : 'Parked for a minute.';
});
document.querySelector('#wipers').addEventListener('click', event => {
  wipers = !wipers;
  view.classList.toggle('wiping', wipers);
  event.currentTarget.setAttribute('aria-pressed', wipers);
  event.currentTarget.textContent = wipers ? 'Wipers on' : 'Wipers off';
});
refresh.addEventListener('click', getWeather);
setInterval(getWeather, 5 * 60 * 1000);
setInterval(updateClock, 30000);
getWeather();
