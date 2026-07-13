// ISI DENGAN URL CSV GOOGLE SHEETS ANDA
const csvUrl = "https://docs.google.com/spreadsheets/d/e/2PACX-1vT_I84HddcHmrqfAGsN22vjT7h4m8uBDvArKdThs747mhBS2jGmubz5No0aooRKlkxmAsUL7-IdAmVk/pub?gid=407332327&single=true&output=csv";

let rawSheetData = [];

window.addEventListener('load', () => {
    fetchData();
    setupFilterListeners();
});

// Fungsi pembagi baris yang aman dari masalah tanda koma desimal
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

        if (lines.length < 2) return;

        // Ambil header untuk mendeteksi posisi nama-nama Agent secara dinamis
        const headers = parseCSVLine(lines[0]).map(h => h.replace(/"/g, ''));
        
        // Sesuai gambar: Kolom A=Date(0), B=Day(1), C=Month(2), D=Week(3)
        // Agent dimulai dari Indeks 4 (Kolom E) sampai sebelum kolom 'Average'
        const agentColumns = [];
        for (let j = 4; j < headers.length; j++) {
            if (headers[j] && headers[j].toLowerCase() !== 'average' && headers[j] !== '') {
                agentColumns.push({ index: j, name: headers[j] });
            }
        }

        // Looping baris data (Mulai dari baris ke-2)
        for(let i = 1; i < lines.length; i++) {
            if (!lines[i]) continue;
            
            const cols = parseCSVLine(lines[i]);
            if (cols.length < 4) continue;

            const dateVal = cols[0].replace(/"/g, '');
            const dayVal = cols[1].replace(/"/g, '');
            const monthVal = cols[2].replace(/"/g, '');
            const weekVal = cols[3].replace(/"/g, '');

            // Lewati jika baris kosong atau baris duplikat header
            if (dateVal.toLowerCase() === 'date' || !dateVal) continue;

            // Karena format mendatar, pecah baris ini menjadi per agent agar bisa difilter fleksibel
            agentColumns.forEach(ag => {
                const durationStr = cols[ag.index] ? cols[ag.index].replace(/"/g, '') : "";
                
                // Hanya masukkan ke data jika agent memiliki catatan durasi/aktivitas pada hari itu
                if (durationStr && durationStr !== "0:00:00") {
                    rawSheetData.push({
                        date: dateVal,
                        day: dayVal,
                        month: monthVal,
                        week: weekVal,
                        agent: ag.name,
                        duration: parseTimeToSeconds(durationStr)
                    });
                }
            });
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

    // 1. Urutkan Agen secara Alfabetis biasa
    Array.from(agents).sort().forEach(a => selectAgent.insertAdjacentHTML('beforeend', `<option value="${a}">${a}</option>`));
    
    // 2. Urutkan Nama Hari sesuai urutan kalender mingguan
    const dayOrder = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
    Array.from(days).sort((a, b) => dayOrder.indexOf(a) - dayOrder.indexOf(b)).forEach(d => selectDay.insertAdjacentHTML('beforeend', `<option value="${d}">${d}</option>`));
    
    // 3. Urutkan Minggu secara Alfabetis (Week 1, Week 2, dst)
    Array.from(weeks).sort().forEach(w => selectWeek.insertAdjacentHTML('beforeend', `<option value="${w}">${w}</option>`));
    
    // 4. Urutkan Nama Bulan sesuai urutan kalender tahunan
    const monthOrder = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
    Array.from(months).sort((a, b) => monthOrder.indexOf(a) - monthOrder.indexOf(b)).forEach(m => selectMonth.insertAdjacentHTML('beforeend', `<option value="${m}">${m}</option>`));
    
    // 5. PERBAIKAN UTAMA: Mengurutkan Tanggal DD/MM/YY berdasarkan kronologi waktu kalender asli
    Array.from(dates).sort((a, b) => {
        const partsA = a.split('/');
        const partsB = b.split('/');
        
        // Buat objek tanggal standar (Tahun, Bulan [0-11], Hari) untuk dibandingkan nilai timestamp-nya
        // Masukkan angka '20' sebelum YY agar terbaca sebagai tahun 2026 ke atas
        const dateA = new Date(parseInt('20' + partsA[2]), parseInt(partsA[1]) - 1, parseInt(partsA[0]));
        const dateB = new Date(parseInt('20' + partsB[2]), parseInt(partsB[1]) - 1, parseInt(partsB[0]));
        
        return dateA - dateB;
    }).forEach(d => selectDate.insertAdjacentHTML('beforeend', `<option value="${d}">${d}</option>`));
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
                activityCount: 1, // Berapa kali handle/bekerja pada filter terpilih
                totalDurationSeconds: item.duration
            };
        } else {
            agentAggregation[item.agent].activityCount += 1;
            agentAggregation[item.agent].totalDurationSeconds += item.duration;
        }
    });

    const chartAgents = [];
    const chartActivities = [];
    const tableData = [];

    Object.values(agentAggregation).forEach(agent => {
        chartAgents.push(agent.name);
        // Grafik menampilkan frekuensi aktivitas/kasus yang ditangani berdasarkan filter
        chartActivities.push(agent.activityCount); 
        
        const avgSeconds = agent.totalDurationSeconds / agent.activityCount;

        tableData.push({
            name: agent.name,
            activity: agent.activityCount,
            totalDuration: formatSecondsToCustomHMS(agent.totalDurationSeconds),
            avgDuration: formatSecondsToCustomHMS(avgSeconds)
        });
    });

    renderChart(chartAgents, chartActivities);
    renderAgentTable(tableData);
}

function parseTimeToSeconds(timeStr) {
    if (!timeStr) return 0;
    timeStr = timeStr.trim();
    if (timeStr.includes(':')) {
        const parts = timeStr.split(':').map(Number);
        if (parts.length === 3) return (parts[0] * 3600) + (parts[1] * 60) + parts[2];
        if (parts.length === 2) return (parts[0] * 60) + parts[1];
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

function renderChart(agents, activities) {
    const chartStatus = Chart.getChart("ticketChart");
    if (chartStatus != undefined) chartStatus.destroy();

    // Hitung total tiket keseluruhan yang sedang aktif di filter untuk ditampilkan di judul grafik
    const totalTicketsActive = activities.reduce((a, b) => a + b, 0);

    new Chart(document.getElementById('ticketChart'), {
        type: 'bar',
        data: {
            labels: agents,
            datasets: [{
                label: 'Jumlah Tiket',
                data: activities,
                backgroundColor: [
                    'rgba(59, 130, 246, 0.8)',   // Blue
                    'rgba(16, 185, 129, 0.8)',   // Emerald
                    'rgba(245, 158, 11, 0.8)',   // Amber
                    'rgba(239, 68, 68, 0.8)',    // Red
                    'rgba(139, 92, 246, 0.8)'    // Purple
                ],
                borderColor: [
                    '#3b82f6', '#10b981', '#f59d11', '#ef4444', '#8b5cf6'
                ],
                borderWidth: 1,
                borderRadius: 6
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: { 
                y: { 
                    beginAtZero: true, 
                    grid: { color: '#334155' }, 
                    ticks: { color: '#94a3b8', stepSize: 1 } // Menggunakan angka bulat untuk hitungan tiket
                }, 
                x: { 
                    grid: { display: false }, 
                    ticks: { color: '#94a3b8' } 
                } 
            },
            plugins: { 
                legend: { display: false },
                // Menampilkan tooltip jumlah tiket saat batang grafik disentuh/di-hover
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            return ` Menangani: ${context.raw} Tiket/Hari`;
                        }
                    }
                }
            }
        }
    });

    // Opsional: Mengupdate judul grafik agar dinamis menampilkan total tiket terfilter
    const chartHeader = document.querySelector("#dashboard-content > div:nth-child(1) > h3");
    if (chartHeader) {
        chartHeader.innerText = `TOTAL PENGERJAAN TIKET (${totalTicketsActive})`;
    }
}
function renderAgentTable(dataList) {
    const tableBody = document.getElementById('agent-table-body');
    tableBody.innerHTML = ""; 
    
    if(dataList.length === 0) {
        tableBody.innerHTML = `<tr><td colspan="4" class="text-center py-8 text-slate-500">Tidak ada data di rentang filter ini.</td></tr>`;
        return;
    }

    dataList.forEach(item => {
        const rowHTML = `
            <tr class="hover:bg-slate-700/50 transition-colors">
                <td class="py-3 px-4 font-semibold text-white">${item.name}</td>
                <td class="py-3 px-4 text-center text-blue-400 font-bold">${item.activity}</td>
                <td class="py-3 px-4 text-right font-mono text-emerald-400">${item.avgDuration}</td>
                <td class="py-3 px-4 text-right font-mono text-amber-400">${item.totalDuration}</td>
            </tr>
        `;
        tableBody.insertAdjacentHTML('beforeend', rowHTML);
    });
}
