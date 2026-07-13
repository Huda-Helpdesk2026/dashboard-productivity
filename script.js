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
        rawSheetData = []; // Reset penampung global

        // Konversi nama bulan untuk keperluan display filter
        const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

        for(let i = 1; i < rows.length; i++) {
            const cols = rows[i];
            // Validasi agar memastikan kolom nama agen (kolom 1 / B) tidak kosong
            if(cols.length >= 7 && cols[1] && cols[1].trim() !== "") {
                const dateRaw = cols[0].trim().replace(/"/g, ''); // Kolom A: Date
                
                // Cari data penanda Tanggal, Bulan, dan Minggu dari objek Date asli Javascript
                let cleanDateStr = "Unknown";
                let monthStr = "Unknown";
                let weekStr = "Unknown";

                if (dateRaw) {
                    // Normalisasi pemisah tanggal jika menggunakan strip (-) diubah ke slash (/)
                    const normalizedDate = dateRaw.replace(/-/g, '/');
                    const dateParts = normalizedDate.split('/');
                    
                    if(dateParts.length === 3) {
                        let day = parseInt(dateParts[0]);
                        let month = parseInt(dateParts[1]) - 1; // bulan js dimulai dari indeks 0
                        let year = parseInt(dateParts[2]);
                        if(year < 100) year += 2000; // handle format tahun 2 digit '26' -> 2026

                        const parsedDate = new Date(year, month, day);
                        if (!isNaN(parsedDate.getTime())) {
                            cleanDateStr = dateRaw; // simpan string aslinya untuk filter harian
                            monthStr = monthNames[parsedDate.getMonth()];
                            
                            // Hitung perkiraan urutan minggu dalam bulan tersebut
                            const weekNum = Math.ceil(parsedDate.getDate() / 7);
                            weekStr = `Week ${weekNum}`;
                        }
                    }
                }

                rawSheetData.push({
                    date: cleanDateStr,
                    month: monthStr,
                    week: weekStr,
                    agent: cols[1].trim(),
                    ticket: parseInt(cols[2]) || 0,
                    art: parseTimeToSeconds(cols[3]),
                    responseCount: parseInt(cols[4]) || 0,
                    aht: parseTimeToSeconds(cols[5]),
                    timeSpan: parseTimeToSeconds(cols[6])
                });
            }
        }

        // Generate isi pilihan option pada menu dropdown filter secara otomatis sesuai isi sheet
        populateFilterDropdowns();

        document.getElementById('loader').style.display = 'none';
        document.getElementById('filter-container').classList.remove('hidden');
        document.getElementById('dashboard-content').classList.remove('hidden');

        // Proses render data awal (menampilkan semua data sebelum difilter)
        processAndRenderData();

    } catch (error) {
        console.error("Gagal memproses data:", error);
        document.getElementById('loader').innerText = "Gagal memproses sinkronisasi data Sheets.";
    }
}

// Fungsi mendeteksi data unik untuk mengisi list opsi dropdown filter
function populateFilterDropdowns() {
    const months = new Set();
    const weeks = new Set();
    const dates = new Set();

    rawSheetData.forEach(item => {
        if(item.month !== "Unknown") months.add(item.month);
        if(item.week !== "Unknown") weeks.add(item.week);
        if(item.date !== "Unknown") dates.add(item.date);
    });

    const selectMonth = document.getElementById('filter-month');
    const selectWeek = document.getElementById('filter-week');
    const selectDate = document.getElementById('filter-date');

    // Mengurutkan & memasukkan opsi ke Dropdown Bulan
    Array.from(months).forEach(m => {
        selectMonth.insertAdjacentHTML('beforeend', `<option value="${m}">${m}</option>`);
    });

    // Mengurutkan & memasukkan opsi ke Dropdown Minggu
    Array.from(weeks).sort().forEach(w => {
        selectWeek.insertAdjacentHTML('beforeend', `<option value="${w}">${w}</option>`);
    });

    // Mengurutkan & memasukkan opsi ke Dropdown Tanggal Spesifik
    Array.from(dates).sort().forEach(d => {
        selectDate.insertAdjacentHTML('beforeend', `<option value="${d}">${d}</option>`);
    });
}

function setupFilterListeners() {
    const filters = ['filter-month', 'filter-week', 'filter-date'];
    filters.forEach(id => {
        document.getElementById(id).addEventListener('change', processAndRenderData);
    });
}

// Fungsi inti menyaring data berdasarkan filter aktif, lalu mengirim ke visualisasi tabel/grafik
function processAndRenderData() {
    const selectedMonth = document.getElementById('filter-month').value;
    const selectedWeek = document.getElementById('filter-week').value;
    const selectedDate = document.getElementById('filter-date').value;

    // Lakukan pencocokan kriteria filter
    const filteredData = rawSheetData.filter(item => {
        const matchMonth = (selectedMonth === "ALL" || item.month === selectedMonth);
        const matchWeek = (selectedWeek === "ALL" || item.week === selectedWeek);
        const matchDate = (selectedDate === "ALL" || item.date === selectedDate);
        return matchMonth && matchWeek && matchDate;
    });

    // Agregasikan/Satukan data agen yang terfilter
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

    // Tampilkan data akhir ke grafik dan tabel
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
        tableBody.innerHTML = `<tr><td colspan="5" class="text-center py-8 text-slate-500">Tidak ada data agen di periode tanggal ini.</td></tr>`;
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
