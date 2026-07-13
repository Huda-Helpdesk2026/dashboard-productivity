// URL Google Sheets CSV hasil dari 'Publish to Web'
const csvUrl = "SALIN_URL_CSV_GOOGLE_SHEETS_DISINI";

window.addEventListener('load', () => {
    fetchData();
});

async function fetchData() {
    try {
        const response = await fetch(csvUrl);
        const dataText = await response.text();
        
        // Parsing data CSV sederhana ke Array
        const rows = dataText.split("\n").map(row => row.split(","));
        
        // Ambil baris data (Lewati baris 0 jika itu header)
        // Data Anda: Date, Agent, Ticket, ART, Response, AHT, Time Span
        const agents = [];
        const tickets = [];
        const arts = [];
        const responses = [];
        const ahts = [];
        const timeSpans = [];

        for(let i = 1; i < rows.length; i++) {
            const cols = rows[i];
            if(cols.length >= 7 && cols[1].trim() !== "") {
                agents.push(cols[1]); // Kolom B: Agent
                tickets.push(parseInt(cols[2]) || 0); // Kolom C: Ticket
                
                // Rumus Konversi: (Nilai / 86400) * 86400 / 60 = Nilai * 24 * 60 = Nilai * 1440
                const artMinutes = (parseFloat(cols[3]) || 0) * 1440;
                const ahtMinutes = (parseFloat(cols[5]) || 0) * 1440;
                const timeSpanMinutes = (parseFloat(cols[6]) || 0) * 1440;
                
                arts.push(parseFloat(artMinutes.toFixed(1)));
                responses.push(parseInt(cols[4]) || 0);
                ahts.push(parseFloat(ahtMinutes.toFixed(1)));
                timeSpans.push(parseFloat(timeSpanMinutes.toFixed(1)));
            }
        }

        // Tampilkan dashboard, sembunyikan loader
        document.getElementById('loader').style.display = 'none';
        document.getElementById('dashboard-content').classList.remove('hidden');

        renderCharts(agents, tickets, arts, ahts, timeSpans);

    } catch (error) {
        console.error("Gagal memuat data:", error);
        document.getElementById('loader').innerText = "Gagal memproses sinkronisasi data Sheets.";
    }
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

    // 2. Chart Komparasi Durasi Waktu (Grouped Bar Chart)
    new Chart(document.getElementById('timeMetricsChart'), {
        type: 'bar',
        data: {
            labels: agents,
            datasets: [
                {
                    label: 'ART (Menit)',
                    data: arts,
                    backgroundColor: '#10b981'
                },
                {
                    label: 'AHT (Menit)',
                    data: ahts,
                    backgroundColor: '#ef4444'
                },
                {
                    label: 'Time Span (Menit)',
                    data: timeSpans,
                    backgroundColor: '#f59e0b'
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: { 
                y: { 
                    beginAtZero: true, 
                    title: { display: true, text: 'Menit', color: '#94a3b8' },
                    grid: { color: '#334155' } 
                }, 
                x: { grid: { display: false } } 
            }
        }
    });
}