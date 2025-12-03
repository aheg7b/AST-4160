// ====== Globals =======
let refreshRate = 1000; // ms
let offlineThreshold = 5000; // ms
let deviceData = {};
let deviceLastSeen = {};
let devicePing = {};
let deviceNames = {};
let showFields = {
  mac: true,
  name: true,
  tempC: true,
  tempF: true,
  mic: true,
  x: true,
  y: true,
  z: true,
  ping: true,
  lastSeen: true
};

const pigModelPath = 'static/assets/pig.glb'; // adjust path as needed

// ====== Helpers =======

// Format timestamp nicely
function formatTimestamp(ts) {
  if (!ts) return '------';
  const d = new Date(ts);
  return d.toLocaleTimeString();
}

// Color ping latency
function pingColor(ping) {
  if (ping === null || ping === undefined) return 'gray';
  if (ping < 100) return 'green';
  if (ping < 300) return 'yellow';
  return 'red';
}

// Check if offline
function isOffline(lastSeen) {
  if (!lastSeen) return true;
  return (Date.now() - lastSeen) > offlineThreshold;
}

// Sanitize text input (simple)
function sanitize(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// ====== Render Functions ======

function renderMenu() {
  const menu = document.getElementById('menu');
  menu.innerHTML = '';

  // Show fields checkboxes
  const fields = Object.keys(showFields);
  fields.forEach(field => {
    const id = `chk_${field}`;
    const label = document.createElement('label');
    label.style.marginRight = '10px';

    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.id = id;
    checkbox.checked = showFields[field];
    checkbox.onchange = () => {
      showFields[field] = checkbox.checked;
      renderTable();
    };

    label.appendChild(checkbox);
    label.appendChild(document.createTextNode(' ' + field));
    menu.appendChild(label);
  });

  menu.appendChild(document.createElement('br'));
  menu.appendChild(document.createElement('br'));

  // Refresh Rate slider
  const rrLabel = document.createElement('label');
  rrLabel.textContent = `Refresh Rate (ms): ${refreshRate}`;
  rrLabel.style.marginRight = '10px';

  const rrSlider = document.createElement('input');
  rrSlider.type = 'range';
  rrSlider.min = 100;
  rrSlider.max = 5000;
  rrSlider.step = 100;
  rrSlider.value = refreshRate;
  rrSlider.oninput = () => {
    refreshRate = +rrSlider.value;
    rrLabel.textContent = `Refresh Rate (ms): ${refreshRate}`;
  };

  menu.appendChild(rrLabel);
  menu.appendChild(rrSlider);

  menu.appendChild(document.createElement('br'));
  menu.appendChild(document.createElement('br'));

  // Offline threshold slider
  const offLabel = document.createElement('label');
  offLabel.textContent = `Offline Threshold (ms): ${offlineThreshold}`;
  offLabel.style.marginRight = '10px';

  const offSlider = document.createElement('input');
  offSlider.type = 'range';
  offSlider.min = 1;
  offSlider.max = 5000;
  offSlider.step = 10;
  offSlider.value = offlineThreshold;
  offSlider.oninput = () => {
    offlineThreshold = +offSlider.value;
    offLabel.textContent = `Offline Threshold (ms): ${offlineThreshold}`;
  };

  menu.appendChild(offLabel);
  menu.appendChild(offSlider);
}

function createRenameInput(mac) {
  const input = document.createElement('input');
  input.type = 'text';
  input.value = deviceNames[mac] || '';
  input.placeholder = 'Rename device...';
  input.style.width = '120px';

  input.onchange = () => {
    deviceNames[mac] = input.value.trim();
    // Optionally, save to server/localStorage here
    renderTable();
  };

  return input;
}

function openPigModel(mac) {
  const data = deviceData[mac];
  if (!data) return alert('No data for this device.');

  // Create popup window for 3D pig model
  const popup = window.open('', `pig_${mac}`, 'width=400,height=400');
  if (!popup) {
    alert('Popup blocked. Please allow popups for this site.');
    return;
  }

  // Basic HTML for model viewer
  popup.document.write(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Pig Model - ${sanitize(deviceNames[mac] || mac)}</title>
      <style> body { margin: 0; } canvas { width: 100%; height: 100% } </style>
    </head>
    <body>
      <button id="resetBtn" style="position:absolute;z-index:10;">Reset Position</button>
      <div id="container"></div>
      <script src="https://cdn.jsdelivr.net/npm/three@0.152.2/build/three.min.js"></script>
      <script src="https://cdn.jsdelivr.net/npm/three@0.152.2/examples/js/loaders/GLTFLoader.js"></script>
      <script>
        let scene, camera, renderer, model;
        let defaultRotation = {x:0, y:0, z:0};

        function init() {
          scene = new THREE.Scene();
          camera = new THREE.PerspectiveCamera(75, window.innerWidth/window.innerHeight, 0.1, 1000);
          renderer = new THREE.WebGLRenderer({antialias:true});
          renderer.setSize(window.innerWidth, window.innerHeight);
          document.body.appendChild(renderer.domElement);

          const light = new THREE.HemisphereLight(0xffffff, 0x444444);
          light.position.set(0, 20, 0);
          scene.add(light);

          const dirLight = new THREE.DirectionalLight(0xffffff);
          dirLight.position.set(0, 20, 10);
          scene.add(dirLight);

          const loader = new THREE.GLTFLoader();
          loader.load('${pigModelPath}', gltf => {
            model = gltf.scene;
            scene.add(model);
            model.rotation.set(defaultRotation.x, defaultRotation.y, defaultRotation.z);
          });

          camera.position.z = 5;

          window.addEventListener('resize', onWindowResize, false);

          document.getElementById('resetBtn').onclick = () => {
            if(model) {
              model.rotation.set(defaultRotation.x, defaultRotation.y, defaultRotation.z);
            }
          };

          animate();
        }

        function onWindowResize() {
          camera.aspect = window.innerWidth / window.innerHeight;
          camera.updateProjectionMatrix();
          renderer.setSize(window.innerWidth, window.innerHeight);
        }

        function animate() {
          requestAnimationFrame(animate);
          if(model) {
            // Update rotation based on latest data from opener
            try {
              const data = window.opener.deviceData['${mac}'];
              if(data) {
                // data.x, data.y, data.z (floats)
                model.rotation.x = data.x || 0;
                model.rotation.y = data.y || 0;
                model.rotation.z = data.z || 0;
              }
            } catch (e) {}
          }
          renderer.render(scene, camera);
        }

        init();
      </script>
    </body>
    </html>
  `);
}

function renderTable() {
  const tbody = document.getElementById('data-table-body');
  tbody.innerHTML = '';

  const macs = Object.keys(deviceData);
  macs.sort();

  macs.forEach(mac => {
    const tr = document.createElement('tr');

    // Determine offline state
    const offline = isOffline(deviceLastSeen[mac]);

    // Helper for displaying data or dashes
    const displayOrDash = (val) => (offline || val === undefined || val === null) ? '------' : val;

    if (showFields.mac) {
      const td = document.createElement('td');
      td.textContent = mac;
      tr.appendChild(td);
    }

    if (showFields.name) {
      const td = document.createElement('td');
      const renameInput = createRenameInput(mac);
      td.appendChild(renameInput);
      tr.appendChild(td);
    }

    if (showFields.tempC) {
      const td = document.createElement('td');
      td.textContent = displayOrDash(deviceData[mac]?.tempC?.toFixed(2));
      tr.appendChild(td);
    }

    if (showFields.tempF) {
      const td = document.createElement('td');
      td.textContent = displayOrDash(deviceData[mac]?.tempF?.toFixed(2));
      tr.appendChild(td);
    }

    if (showFields.mic) {
      const td = document.createElement('td');
      td.textContent = displayOrDash(deviceData[mac]?.mic?.toFixed(2));
      tr.appendChild(td);
    }

    if (showFields.x) {
      const td = document.createElement('td');
      td.textContent = displayOrDash(deviceData[mac]?.x?.toFixed(2));
      tr.appendChild(td);
    }

    if (showFields.y) {
      const td = document.createElement('td');
      td.textContent = displayOrDash(deviceData[mac]?.y?.toFixed(2));
      tr.appendChild(td);
    }

    if (showFields.z) {
      const td = document.createElement('td');
      td.textContent = displayOrDash(deviceData[mac]?.z?.toFixed(2));
      tr.appendChild(td);
    }

    if (showFields.ping) {
      const td = document.createElement('td');
      const ping = devicePing[mac];
      td.textContent = offline ? '------' : (ping !== undefined ? ping + ' ms' : 'N/A');
      td.style.color = pingColor(ping);
      tr.appendChild(td);
    }

    if (showFields.lastSeen) {
      const td = document.createElement('td');
      td.textContent = offline ? 'Offline' : formatTimestamp(deviceLastSeen[mac]);
      tr.appendChild(td);
    }

    // Pig model button
    const td = document.createElement('td');
    const btn = document.createElement('button');
    btn.textContent = 'Show Pig';
    btn.onclick = () => openPigModel(mac);
    td.appendChild(btn);
    tr.appendChild(td);

    tbody.appendChild(tr);
  });
}

// ====== Data Fetching ======

async function fetchData() {
  try {
    const res = await fetch('/data');
    if (!res.ok) throw new Error('Network response was not ok');
    const json = await res.json();

    // json = { devices: { mac: { tempC, tempF, mic, x, y, z, ping, lastSeen }, ... } }

    for (const mac in json.devices) {
      const dev = json.devices[mac];

      deviceData[mac] = {
        tempC: dev.tempC,
        tempF: dev.tempF,
        mic: dev.mic,
        x: dev.x,
        y: dev.y,
        z: dev.z
      };
      deviceLastSeen[mac] = dev.lastSeen ? new Date(dev.lastSeen).getTime() : null;
      devicePing[mac] = dev.ping;
      // Preserve existing names or set empty
      if (!(mac in deviceNames)) deviceNames[mac] = '';
    }

    renderTable();
  } catch (err) {
    console.error('Failed to fetch data:', err);
  }
}

function startAutoRefresh() {
  fetchData();
  setInterval(fetchData, refreshRate);
}

// ====== Init ======

window.onload = () => {
  renderMenu();
  startAutoRefresh();
};
