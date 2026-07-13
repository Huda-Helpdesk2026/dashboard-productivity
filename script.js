// Gantilah teks di bawah ini dengan URL CSV Google Sheets Anda
const csvUrl = "https://docs.google.com/spreadsheets/d/e/2PACX-1vQCLXvz4_F7EfUppPoKWSKQawlesCjiYHhceQCIEDoV8ntbDjFrvKUorP416AGydpWYmxWlOLA3b1JL/pub?gid=549661576&single=true&output=csv";

let rawSheetData = [];

window.addEventListener('load', () => {
    fetchData();
    setupFilterListeners();
});

// Fungsi pemisah baris pintar agar angka ribuan ber-koma tidak merusak urutan kolom
function parseCSVLine(text) {
    const result = [];
    let insideQuote = false;
    let entry = "";
    
    for (let i = 0; i < text.length; i++) {
        const char = text[i];
        if (char === '"') {
            insideQuote = !insideQuote;
        } else if (char === ',' && !insideQuote) {
            result.push(entry.trim());
            entry = "";
        } else {
            entry += char;
        }
    }
    result.push(entry.trim());
    return result;
}

async function fetchData() {
    try {
        const antiCacheUrl = `${csvUrl}&cachebust=${new Date().getTime()}`;
        const response = await fetch(antiCacheUrl);
        const dataText = await response.text();
        
        const lines = dataText.split(/\r?\n/);
        rawSheetData = []; 

        for(let i = 1; i < lines.length; i++) {
            if (!lines[i]) continue;
            
            const cols = parseCSVLine(lines[i]);
            
            // Kolom E (Indeks 4) adalah Agent. Pastikan ada data dan bukan baris header
            if(cols && cols.length >= 10 && cols[4] && cols[4].toLowerCase() !== "agent") {
                rawSheetData.push({
                    date: cols[0].replace(/"/g, ''),
                    day: cols[1].replace(/"/g, ''),
                    month: cols[2].replace(/"/g, ''),
                    week: cols[3].replace(/"/g, ''),
                    agent: cols[4].replace(/"/g, ''),
                    ticket: parseInt(cols[5], 10) || 0,
                    art: parseTimeToSeconds(cols[6]),
                    responseCount: parseInt(cols[7], 10) || 0,
                    aht: parseTimeToSeconds(cols[8]),
                    timeSpan: parseTimeToSeconds(cols[9])
                });
            }
        }

        populateFilterDropdowns();

        document.getElementById('loader').style.display = 'none';
        document.getElementById('filter-container').classList.remove('hidden');
        document.getElementById('dashboard-content').classList.remove('hidden');

        processAndRenderData();

    } catch (error) {
        console.error("Gagal memproses data:", error);
        document.getElementById('loader').innerText = "Gagal memproses sinkronisasi data Sheets. Periksa URL CSV Anda.";
    }
}

function populateFilterDropdowns() {
    const agents = new Set();
    const days = new Set();
    const weeks = new Set();
    const months = new Set();
    const dates = new Set();

    rawSheetData.forEach(item => {
        if(item.agent) agents.add(item.agent);
        if(item.day) days.add(item.day);
        if(item.week) weeks.add(item.week);
        if(item.month) months.add(item.month);
        if(item.date) dates.add(item.date);
    });

    const selectAgent = document.getElementById('filter-agent');
    const selectDay = document.getElementById('filter-day');
    const selectWeek = document.getElementById('filter-week');
    const selectMonth = document.getElementById('filter-month');
    const selectDate = document.getElementById('filter-date');

    selectAgent.innerHTML = '<option value="ALL">All Agents</option>';
    selectDay.innerHTML = '<option value="ALL">All Days</option>';
    selectWeek.innerHTML = '<option value="ALL">All Weeks</option>';
    selectMonth.innerHTML = '<option value="ALL">All Months</option>';
    selectDate.innerHTML = '<option value="ALL">All Dates</option>';

    Array.from(agents).sort().forEach(a => selectAgent.insertAdjacentHTML('beforeend', `<option value="${a}">${a}</option>`));
    Array.from(days).sort().forEach(d => selectDay.insertAdjacentHTML('beforeend', `<option value="${d}">${d}</option>`));
    Array.from(weeks).sort().forEach(w => selectWeek.insertAdjacentHTML('beforeend', `<option value="${w}">${w}</option>`));
    Array.from(months).sort().forEach(m => selectMonth.insertAdjacentHTML('beforeend', `<option value="${m}">${m}</option>`));
    Array.from(dates).sort().forEach(d => selectDate.insertAdjacentHTML('beforeend', `<option value="${d}">${d}</option>`));
}

function setupFilterListeners() {
    const filters = ['filter-agent', 'filter-day', 'filter-week', 'filter-month', 'filter-date'];
    filters.forEach(id => {
        const el = document.getElementById(id);
        if(el) el.addEventListener('change', processAndRenderData);
    });
}

function processAndRenderData() {
    const selectedAgent = document.getElementById('filter-agent').value;
    const selectedDay = document.getElementById('filter-day').value;
    const selectedWeek = document.getElementById('filter-week').value;
    const selectedMonth = document.getElementById('filter-month').value;
    const selectedDate = document.getElementById('filter-date').value;

    // Filter data mentah berdasarkan kelima parameter dropdown sekaligus
    const filteredData = rawSheetData.filter(item => {
        const matchAgent = (selectedAgent === "ALL" || item.agent === selectedAgent);
        const matchDay = (selectedDay === "ALL" || item.day === selectedDay);
        const matchWeek = (selectedWeek === "ALL" || item.week === selectedWeek);
        const matchMonth = (selectedMonth === "ALL" || item.month === selectedMonth);
        const matchDate = (selectedDate === "ALL" || item.date === selectedDate);
        return matchAgent && matchDay && matchWeek && matchMonth && matchDate;
    });

    const agentAggregation = {};

    filteredData.forEach(item => {
        if (!agentAggregation[item.agent]) {
            agentAggregation[item.agent] = {
                name: item.agent,
                totalTickets: item.ticket,
                totalResponse: item.responseCount,
                artSecondsSum: item.art,
                ahtSecondsSum: item.aht,
                timeSpanSecondsSum: item.timeSpan,
                rowCount: 1
            };
        } else {
            agentAggregation[item.agent].totalTickets += item.ticket;
            agentAggregation[item.agent].totalResponse += item.responseCount;
            agentAggregation[item.agent].artSecondsSum += item.art;
            agentAggregation[item.agent].ahtSecondsSum += item.aht;
            agentAggregation[item.agent].timeSpanSecondsSum += item.timeSpan;
            agentAggregation[item.agent].rowCount += 1;
        }
    });

    const chartAgents = [];
    const chartTickets = [];
    const tableData = [];

    Object.values(agentAggregation).forEach(agent => {
        chartAgents.push(agent.name);
        chartTickets.push(agent.totalTickets);
        
        tableData.push({
            name: agent.name,
            ticket: agent.totalTickets,
            responseCount: agent.totalResponse,
            art: formatSecondsToCustomHMS(agent.artSecondsSum / agent.rowCount),
            aht: formatSecondsToCustomHMS(agent.ahtSecondsSum / agent.rowCount),
            timeSpan: formatSecondsToCustomHMS(agent.timeSpanSecondsSum / agent.rowCount)
        });
    });

    renderTicketChart(chartAgents, chartTickets);
    renderAgentTable(tableData);
}

function parseTimeToSeconds(timeStr) {
    if (!timeStr) return 0;
    timeStr = timeStr.trim().replace(/"/g, '');
    if (timeStr.includes(':')) {
        const parts = timeStr.split(':').map(Number);
        if (parts.length === 3) return (parts[0] * 3600) + (parts[1] * 60) + parts[2];
        if (parts.length === 2) return (parts[0] * 60) + parts[1];
    }
    const num = parseFloat(timeStr);
    if (!isNaN(num)) {
        if (num < 1) return Math.round(num * 86400); 
        return Math.round(num);
    }
    return 0;
}

function formatSecondsToCustomHMS(totalSeconds) {
    if (isNaN(totalSeconds) || totalSeconds <= 0) return "0m 0s";
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = Math.floor(totalSeconds % 60);
    if (hours > 0) return `${hours}h ${minutes}m ${seconds}s`;
    return `${minutes}m ${seconds}s`;
}

function renderTicketChart(agents, tickets) {
    const chartStatus = Chart.getChart("ticketChart");
    if (chartStatus != undefined) chartStatus.destroy();

    new Chart(document.getElementById('ticketChart'), {
        type: 'bar',
        data: {
            labels: agents,
            datasets: [{
                data: tickets,
                backgroundColor: '#3b82f6',
                borderRadius: 6
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: { 
                y: { beginAtZero: true, grid: { color: '#334155' } }, 
                x: { grid: { display: false }, ticks: { color: '#94a3b8' } } 
            },
            plugins: { legend: { display: false } }
        }
    });
}

function renderAgentTable(dataList) {
    const tableBody = document.getElementById('agent-table-body');
    tableBody.innerHTML = ""; 
    
    if(dataList.length === 0) {
        tableBody.innerHTML = `<tr><td colspan="6" class="text-center py-8 text-slate-500">Tidak ada data di rentang filter ini.</td></tr>`;
        return;
    }

    dataList.forEach(item => {
        const rowHTML = `
            <tr class="hover:bg-slate-700/50 transition-colors">
                <td class="py-3 px-4 font-semibold text-white">${item.name}</td>
                <td class="py-3 px-4 text-center text-blue-400 font-bold">${item.ticket}</td>
                <td class="py-3 px-4 text-center text-slate-400">${item.responseCount}</td>
                <td class="py-3 px-4 text-right font-mono text-emerald-400">${item.art}</td>
                <td class="py-3 px-4 text-right font-mono text-rose-400">${item.aht}</td>
                <td class="py-3 px-4 text-right font-mono text-amber-400">${item.timeSpan}</td>
            </tr>
        `;
        tableBody.insertAdjacentHTML('beforeend', rowHTML);
    });
}
