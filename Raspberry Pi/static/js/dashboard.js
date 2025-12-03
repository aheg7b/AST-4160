let chartInstance = null;
let deviceDataGlobal = {};
let currentDevice = null;

// Track rename inputs to prevent overwriting
const renameCache = {};

function fetchData(){
    fetch('/data')
        .then(res => res.json())
        .then(data => {
            deviceDataGlobal = data;
            renderDevices(data);
            if(currentDevice) updateChart(currentDevice);
        });
}

// Render device cards but do not remove rename inputs
function renderDevices(data){
    const container = document.getElementById('device-container');
    for(const mac in data){
        const info = data[mac];
        let card = document.getElementById(`card-${mac}`);
        const nameValue = renameCache[mac] || info.name;

        if(!card){
            card = document.createElement('div');
            card.className = 'device-card';
            card.id = `card-${mac}`;
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
            container.appendChild(card);
        }

        // Update values dynamically without overwriting rename input
        document.getElementById(`TEMP-${mac}`).innerText = info.TEMP + " °C";
        document.getElementById(`HUM-${mac}`).innerText = info.HUM + " %";
        document.getElementById(`MOIST-${mac}`).innerText = info.MOIST;
        document.getElementById(`SOILT-${mac}`).innerText = info.SOILT;
        document.getElementById(`LIGHT_VAL-${mac}`).innerText = info.LIGHT_VAL;
        document.getElementById(`LAST-${mac}`).innerText = info.last_seen;

        // Set select values
        document.getElementById(`PUMP-${mac}`).value = info.PUMP;
        document.getElementById(`LIGHT-${mac}`).value = info.LIGHT;

        // Update offline style
        if(!info.online) card.classList.add('offline'); else card.classList.remove('offline');
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

// Chart functions remain the same as previous dynamic charts...
function openCharts(mac){
    currentDevice = mac;
    const modal = new bootstrap.Modal(document.getElementById('chartModal'));
    modal.show();
    updateChart(mac);
}

// Update chart dynamically with animation
function updateChart(mac){
    const info = deviceDataGlobal[mac];
    if(!info) return;
    const history = info.history || [];
    const labels = history.map(p => p.ts);

    const datasets = [];
    const optionsMap = {
        TEMP: {label:'Temp (°C)', color:'red'},
        HUM: {label:'Humidity (%)', color:'blue'},
        MOIST: {label:'Soil Moisture', color:'green'},
        SOILT: {label:'Soil Temp', color:'orange'},
        LIGHT_VAL: {label:'Light', color:'purple'}
    };
    for(const key in optionsMap){
        const checkbox = document.getElementById(`toggle${key}`);
        if(checkbox && checkbox.checked){
            datasets.push({
                label: optionsMap[key].label,
                data: history.map(p => parseFloat(p[key])),
                borderColor: optionsMap[key].color,
                fill:false
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
            animation:{duration:500},
            interaction:{mode:'index', intersect:false},
            plugins:{legend:{position:'top'}},
            scales:{x:{title:{display:true,text:'Timestamp'}},y:{title:{display:true,text:'Value'}}}
        }
    });
}

// Toggle datasets dynamically
document.querySelectorAll('input[type=checkbox]').forEach(cb=>{
    cb.addEventListener('change', ()=>{ if(currentDevice) updateChart(currentDevice); });
});

// Initial fetch + auto-refresh
fetchData();
setInterval(fetchData,5000);
