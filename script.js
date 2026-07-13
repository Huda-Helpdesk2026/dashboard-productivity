// Gantilah teks di bawah ini dengan URL CSV Google Sheets Anda
const csvUrl = "https://docs.google.com/spreadsheets/d/e/2PACX-1vQCLXvz4_F7EfUppPoKWSKQawlesCjiYHhceQCIEDoV8ntbDjFrvKUorP416AGydpWYmxWlOLA3b1JL/pub?gid=549661576&single=true&output=csv";

// Variabel global untuk menyimpan data mentah dari Sheets
let rawSheetData = [];

window.addEventListener('load', () => {
    fetchData();
    setupFilterListeners();
});

async function fetchData() {
    try {
        const antiCacheUrl = `${csvUrl}&cachebust=${new Date().getTime()}`;
        const response = await fetch(antiCacheUrl);
        const dataText = await response.text();
        
        const rows = dataText.split("\n").map(row => row.split(","));
        rawSheetData = []; // Reset data penampung

        for(let i = 1; i < rows.length; i++) {
            const cols = rows[i];
            
            // Validasi: Pastikan baris memiliki data dan kolom Agen (Indeks 4 / E) tidak kosong
            if(cols && cols.length >= 10 && cols[4] && cols[4].trim() !== "") {
                
                const dateRaw = cols[0].trim().replace(/"/g, '');   // Kolom A: Date
                const monthRaw = cols[2].trim().replace(/"/g, '');  // Kolom C: Month
                const weekRaw = cols[3].trim().replace(/"/g, '');   // Kolom D: Week
                const agentRaw = cols[4].trim().replace(/"/g, '');  // Kolom E: Agent

                rawSheetData.push({
                    date: dateRaw || "Unknown",
                    month: monthRaw || "All Months",
                    week: weekRaw || "All Weeks",
                    agent: agentRaw,
                    ticket: parseInt(cols[5], 10) || 0,             // Kolom F: Ticket
                    art: parseTimeToSeconds(cols[6]),               // Kolom G: ART
                    responseCount: parseInt(cols[7], 10) || 0,      // Kolom H: Response
                    aht: parseTimeToSeconds(cols[8]),               // Kolom I: AHT
                    timeSpan: parseTimeToSeconds(cols[9])           // Kolom J: Time Span
                });
            }
        }

        // Isi data pilihan pada menu filter dropdown otomatis dari Sheets
        populateFilterDropdowns();

        // Sembunyikan loader dan tampilkan dashboard
        document.getElementById('loader').style.display = 'none';
        document.getElementById('filter-container').classList.remove('hidden');
        document.getElementById('dashboard-content').classList.remove('hidden');

        // Render visualisasi awal
        processAndRenderData();

    } catch (error) {
        console.error("Gagal memproses data:", error);
        document.getElementById('loader').innerText = "Gagal memproses sinkronisasi data Sheets. Periksa URL CSV Anda.";
    }
}

function populateFilterDropdowns() {
    const months = new Set();
    const weeks = new Set();
    const dates = new Set();

    rawSheetData.forEach(item => {
        if(item.month && item.month !== "Month") months.add(item.month);
        if(item.week && item.week !== "Week") weeks.add(item.week);
        if(item.date && item.date !== "Date") dates.add(item.date);
    });

    const selectMonth = document.getElementById('filter-month');
    const selectWeek = document.getElementById('filter-week');
    const selectDate = document.getElementById('filter-date');

    // Reset opsi agar bersih
    selectMonth.innerHTML = '<option value="ALL">All Months</option>';
    selectWeek.innerHTML = '<option value="ALL">All Weeks</option>';
    selectDate.innerHTML = '<option value="ALL">All Dates</option>';

    // Urutkan dan masukkan ke elemen dropdown HTML
    Array.from(months).sort().forEach(m => selectMonth.insertAdjacentHTML('beforeend', `<option value="${m}">${m}</option>`));
    Array.from(weeks).sort().forEach(w => selectWeek.insertAdjacentHTML('beforeend', `<option value="${w}">${w}</option>`));
    Array.from(dates).sort().forEach(d => selectDate.insertAdjacentHTML('beforeend', `<option value="${d}">${d}</option>`));
}

function setupFilterListeners() {
    const filters = ['filter-month', 'filter-week', 'filter-date'];
    filters.forEach(id => {
        const el = document.getElementById(id);
        if(el) el.addEventListener('change', processAndRenderData);
    });
}

function processAndRenderData() {
    const selectedMonth = document.getElementById('filter-month').value;
    const selectedWeek = document.getElementById('filter-week').value;
    const selectedDate = document.getElementById('filter-date').value;

    const filteredData = rawSheetData.filter(item => {
        const matchMonth = (selectedMonth === "ALL" || item.month === selectedMonth);
        const matchWeek = (selectedWeek === "ALL" || item.week === selectedWeek);
        const matchDate = (selectedDate === "ALL" || item.date === selectedDate);
        return matchMonth && matchWeek && matchDate;
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

    const agents = [];
    const tickets = [];
    const tableData = [];

    Object.values(agentAggregation).forEach(agent => {
        agents.push(agent.name);
        tickets.push(agent.totalTickets);
        
        tableData.push({
            name: agent.name,
            ticket: agent.totalTickets,
            responseCount: agent.totalResponse,
            art: formatSecondsToCustomHMS(agent.artSecondsSum / agent.rowCount),
            aht: formatSecondsToCustomHMS(agent.ahtSecondsSum / agent.rowCount),
            timeSpan: formatSecondsToCustomHMS(agent.timeSpanSecondsSum / agent.rowCount)
        });
    });

    renderTicketChart(agents, tickets);
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
        tableBody.innerHTML = `<tr><td colspan="5" class="text-center py-8 text-slate-500">Tidak ada data agen di rentang filter ini.</td></tr>`;
        return;
    }

    dataList.forEach(item => {
        const rowHTML = `
            <tr class="hover:bg-slate-700/50 transition-colors">
                <td class="py-3 px-4 font-semibold text-white">${item.name}</td>
                <td class="py-3 px-4 text-center text-slate-400">${item.responseCount}</td>
                <td class="py-3 px-4 text-right font-mono text-emerald-400">${item.art}</td>
                <td class="py-3 px-4 text-right font-mono text-rose-400">${item.aht}</td>
                <td class="py-3 px-4 text-right font-mono text-amber-400">${item.timeSpan}</td>
            </tr>
        `;
        tableBody.insertAdjacentHTML('beforeend', rowHTML);
    });
}
