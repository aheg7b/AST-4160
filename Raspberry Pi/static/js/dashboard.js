let chartInstance = null;
let deviceDataGlobal = {};
let currentDevice = null;
const renameCache = {};
const MAX_HISTORY_POINTS = 50; // max points to show in chart

function fetchData(){
    fetch('/data')
        .then(res => res.json())
        .then(data => {
            deviceDataGlobal = data;
            renderDevices(data);
            if(currentDevice) updateLiveChartSmooth(currentDevice);
        });
}

function renderDevices(data){
    const container = document.getElementById('device-container');
    const now = new Date();
    for(const mac in data){
        const info = data[mac];
        let card = document.getElementById(`card-${mac}`);
        const nameValue = renameCache[mac] || info.name;

        if(!card){
            card = document.createElement('div');
            card.className = 'device-card';
            card.id = `card-${mac}`;
            container.appendChild(card);
            card.innerHTML = `
                <div class="card-title" id="title-${mac}">${info.name} (${mac})</div>
                <div class="sensor-row"><span class="sensor-label">Temp:</span> <span id="TEMP-${mac}">${info.TEMP} °C</span></div>
                <div class="sensor-row"><span class="sensor-label">Humidity:</span> <span id="HUM-${mac}">${info.HUM} %</span></div>
                <div class="sensor-row"><span class="sensor-label">Soil Moisture:</span> <span id="MOIST-${mac}">${info.MOIST}</span></div>
                <div class="sensor-row"><span class="sensor-label">Soil Temp:</span> <span id="SOILT-${mac}">${info.SOILT}</span></div>
                <div class="sensor-row"><span class="sensor-label">Light Sensor:</span> <span id="LIGHT_VAL-${mac}">${info.LIGHT_VAL}</span></div>
                <div class="sensor-row"><span class="sensor-label">Last Seen:</span> <span id="LAST-${mac}">${info.last_seen}</span></div>

                <div class="mt-2">
                    <label>Pump:</label>
                    <select class="form-select" id="PUMP-${mac}" onchange="toggle('${mac}','pump',this.value)">
                        <option value="OFF">OFF</option>
                        <option value="ON">ON</option>
                        <option value="AUTO">AUTO</option>
                    </select>
                    <label class="mt-2">Light:</label>
                    <select class="form-select" id="LIGHT-${mac}" onchange="toggle('${mac}','light',this.value)">
                        <option value="OFF">OFF</option>
                        <option value="ON">ON</option>
                        <option value="AUTO">AUTO</option>
                    </select>
                </div>

                <div class="form-rename mt-2">
                    <input type="text" id="rename-${mac}" value="${nameValue}" placeholder="Rename device">
                    <button class="btn btn-sm btn-secondary" onclick="renameDevice('${mac}')">Rename</button>
                </div>

                <button class="btn btn-primary mt-3 w-100" onclick="openCharts('${mac}')">View Charts</button>
            `;
        }

        // Update sensor values
        document.getElementById(`TEMP-${mac}`).innerText = info.TEMP + " °C";
        document.getElementById(`HUM-${mac}`).innerText = info.HUM + " %";
        document.getElementById(`MOIST-${mac}`).innerText = info.MOIST;
        document.getElementById(`SOILT-${mac}`).innerText = info.SOILT;
        document.getElementById(`LIGHT_VAL-${mac}`).innerText = info.LIGHT_VAL;
        document.getElementById(`LAST-${mac}`).innerText = info.last_seen;
        document.getElementById(`PUMP-${mac}`).value = info.PUMP;
        document.getElementById(`LIGHT-${mac}`).value = info.LIGHT;

        // Offline flash
        const lastSeenDate = new Date(info.last_seen);
        const diffSeconds = (now - lastSeenDate) / 1000;
        if(diffSeconds > 60){
            card.classList.add('offline');
            card.style.animation = 'flashRed 1s infinite alternate';
        } else {
            card.classList.remove('offline');
            card.style.animation = '';
        }
    }
}

// Toggle pump/light
function toggle(mac, device, state){
    fetch(`/rename`,{
        method:"POST",
        headers: {"Content-Type":"application/x-www-form-urlencoded"},
        body:`mac=${mac}&name=${mac}`
    });
}

// Rename device
function renameDevice(mac){
    const input = document.getElementById(`rename-${mac}`);
    const newName = input.value.trim();
    renameCache[mac] = newName;
    if(newName){
        fetch(`/rename`,{
            method:"POST",
            headers: {"Content-Type":"application/x-www-form-urlencoded"},
            body:`mac=${mac}&name=${newName}`
        }).then(()=> fetchData());
    }
}

// Open chart modal
function openCharts(mac){
    currentDevice = mac;
    const modal = new bootstrap.Modal(document.getElementById('chartModal'));
    modal.show();
    initLiveChart(mac);
}

// Initialize chart
function initLiveChart(mac){
    const info = deviceDataGlobal[mac];
    const history = info.history || [];
    const labels = history.slice(-MAX_HISTORY_POINTS).map(p => p.ts);

    const optionsMap = {
        TEMP: {label:'Temp (°C)', color:'red'},
        HUM: {label:'Humidity (%)', color:'blue'},
        MOIST: {label:'Soil Moisture', color:'green'},
        SOILT: {label:'Soil Temp', color:'orange'},
        LIGHT_VAL: {label:'Light', color:'purple'}
    };

    const datasets = [];
    for(const key in optionsMap){
        const checkbox = document.getElementById(`toggle${key}`);
        if(checkbox && checkbox.checked){
            datasets.push({
                label: optionsMap[key].label,
                data: history.slice(-MAX_HISTORY_POINTS).map(p => parseFloat(p[key])),
                borderColor: optionsMap[key].color,
                fill:false,
                tension:0.3 // smooth line
            });
        }
    }

    const ctx = document.getElementById('chartCanvas').getContext('2d');
    if(chartInstance) chartInstance.destroy();
    chartInstance = new Chart(ctx,{
        type:'line',
        data:{labels,datasets},
        options:{
            responsive:true,
            animation:{duration:500, easing:'easeOutQuart'},
            interaction:{mode:'index', intersect:false},
            plugins:{legend:{position:'top'}},
            scales:{x:{title:{display:true,text:'Timestamp'}},y:{title:{display:true,text:'Value'}}}
        }
    });
}

// Update chart incrementally for smooth animation
function updateLiveChartSmooth(mac){
    if(!chartInstance) return;
    const info = deviceDataGlobal[mac];
    const history = info.history || [];
    const lastPoints = history.slice(-MAX_HISTORY_POINTS);

    chartInstance.data.labels = lastPoints.map(p => p.ts);

    chartInstance.data.datasets.forEach(ds=>{
        const keyMap = {TEMP:'TEMP', HUM:'HUM', MOIST:'MOIST', SOILT:'SOILT', LIGHT_VAL:'LIGHT_VAL'};
        const key = Object.keys(keyMap).find(k=> ds.label.includes(k) || ds.label.includes(kMap[k]));
        if(key){
            ds.data = lastPoints.map(p => parseFloat(p[key]));
        }
    });
    chartInstance.update('active'); // smooth animated update
}

// Checkbox toggle for datasets
document.querySelectorAll('input[type=checkbox]').forEach(cb=>{
    cb.addEventListener('change', ()=>{ if(currentDevice) initLiveChart(currentDevice); });
});

// Auto-refresh every 5s
fetchData();
setInterval(fetchData,5000);
