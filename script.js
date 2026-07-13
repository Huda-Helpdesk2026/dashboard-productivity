// URL Google Sheets CSV hasil dari 'Publish to Web'
const csvUrl = "https://docs.google.com/spreadsheets/d/e/2PACX-1vQCLXvz4_F7EfUppPoKWSKQawlesCjiYHhceQCIEDoV8ntbDjFrvKUorP416AGydpWYmxWlOLA3b1JL/pub?gid=549661576&single=true&output=csv";

window.addEventListener('load', () => {
    fetchData();
});

async function fetchData() {
    try {
        const response = await fetch(csvUrl);
        const dataText = await response.text();
        
        const rows = dataText.split("\n").map(row => row.split(","));
        
        const agents = [];
        const tickets = [];
        const arts = [];
        const ahts = [];
        const timeSpans = [];

        for(let i = 1; i < rows.length; i++) {
            const cols = rows[i];
            if(cols.length >= 7 && cols[1].trim() !== "") {
                agents.push(cols[1]); // Kolom B: Agent
                tickets.push(parseInt(cols[2]) || 0); // Kolom C: Ticket
                
                // Konversi data kolom waktu menjadi DETIK murni terlebih dahulu
                arts.push(parseTimeToSeconds(cols[3]));      // Kolom D: ART
                ahts.push(parseTimeToSeconds(cols[5]));      // Kolom F: AHT
                timeSpans.push(parseTimeToSeconds(cols[6])); // Kolom G: Time Span
            }
        }

        document.getElementById('loader').style.display = 'none';
        document.getElementById('dashboard-content').classList.remove('hidden');

        renderCharts(agents, tickets, arts, ahts, timeSpans);

    } catch (error) {
        console.error("Gagal memuat data:", error);
        document.getElementById('loader').innerText = "Gagal memproses sinkronisasi data Sheets.";
    }
}

// Fungsi bantu untuk mengubah inputan Google Sheets menjadi total detik murni
function parseTimeToSeconds(timeStr) {
    if (!timeStr) return 0;
    timeStr = timeStr.trim().replace(/"/g, ''); // bersihkan tanda kutip jika ada
    
    // Jika formatnya HH:MM:SS atau MM:SS (berisi titik dua)
    if (timeStr.includes(':')) {
        const parts = timeStr.split(':').map(Number);
        if (parts.length === 3) {
            return (parts[0] * 3600) + (parts[1] * 60) + parts[2]; // J:M:D
        } else if (parts.length === 2) {
            return (parts[0] * 60) + parts[1]; // M:D
        }
    }
    
    // Jika data berupa angka desimal mentah bawaan sistem serial Sheets
    const num = parseFloat(timeStr);
    if (!isNaN(num)) {
        // Jika angkanya sangat besar (mungkin detik mentah), jika kecil (< 1) berarti serial day pecahan Sheets
        if (num < 1) {
            return Math.round(num * 86400); 
        }
        return Math.round(num); // Asumsi sudah dalam bentuk detik murni
    }
    return 0;
}

// Fungsi bantu untuk mengubah total detik menjadi format string teks "JJ:MM:DD"
function formatSecondsToHMS(totalSeconds) {
    if (isNaN(totalSeconds) || totalSeconds <= 0) return "00:00:00";
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = Math.floor(totalSeconds % 60);
    
    const pad = (num) => String(num).padStart(2, '0');
    return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
}

function renderCharts(agents, tickets, arts, ahts, timeSpans) {
    // 1. Chart Pengerjaan Tiket (Bar)
    new Chart(document.getElementById('ticketChart'), {
        type: 'bar',
        data: {
            labels: agents,
            datasets: [{
                label: 'Jumlah Tiket',
                data: tickets,
                backgroundColor: '#3b82f6',
                borderRadius: 6
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: { y: { beginAtZero: true, grid: { color: '#334155' } }, x: { grid: { display: false } } }
        }
    });

    // 2. Chart Komparasi Durasi Waktu (Diubah sumbu Y-nya menjadi skala MENIT agar grafik tidak kepanjangan)
    new Chart(document.getElementById('timeMetricsChart'), {
        type: 'bar',
        data: {
            labels: agents,
            datasets: [
                {
                    label: 'ART',
                    data: arts.map(s => parseFloat((s / 60).toFixed(2))), // ubah ke menit untuk tinggi batang grafik
                    backgroundColor: '#10b981',
                    rawSeconds: arts // simpan data detik asli untuk tooltip
                },
                {
                    label: 'AHT',
                    data: ahts.map(s => parseFloat((s / 60).toFixed(2))),
                    backgroundColor: '#ef4444',
                    rawSeconds: ahts
                },
                {
                    label: 'Time Span',
                    data: timeSpans.map(s => parseFloat((s / 60).toFixed(2))),
                    backgroundColor: '#f59e0b',
                    rawSeconds: timeSpans
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: { 
                y: { 
                    beginAtZero: true, 
                    title: { display: true, text: 'Skala Durasi (Menit)', color: '#94a3b8' },
                    grid: { color: '#334155' } 
                }, 
                x: { grid: { display: false } } 
            },
            plugins: {
                tooltip: {
                    callbacks: {
                        // Kustomisasi Tooltip Pop-up agar memunculkan format teks 00:00:00
                        label: function(context) {
                            const dataset = context.dataset;
                            const index = context.dataIndex;
                            const totalSecs = dataset.rawSeconds[index];
                            const hmsString = formatSecondsToHMS(totalSecs);
                            return `${dataset.label}: ${hmsString}`;
                        }
                    }
                }
            }
        }
    });
}
