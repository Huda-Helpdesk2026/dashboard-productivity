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
        const tableData = [];

        for(let i = 1; i < rows.length; i++) {
            const cols = rows[i];
            if(cols.length >= 7 && cols[1].trim() !== "") {
                const agentName = cols[1].trim();
                const ticketCount = parseInt(cols[2]) || 0;
                
                agents.push(agentName);
                tickets.push(ticketCount);
                
                // Masukkan data mentah dan hasil konversinya ke penampung tabel
                tableData.push({
                    name: agentName,
                    ticket: ticketCount,
                    responseCount: parseInt(cols[4]) || 0,
                    art: formatSecondsToCustomHMS(parseTimeToSeconds(cols[3])),
                    aht: formatSecondsToCustomHMS(parseTimeToSeconds(cols[5])),
                    timeSpan: formatSecondsToCustomHMS(parseTimeToSeconds(cols[6]))
                });
            }
        }

        document.getElementById('loader').style.display = 'none';
        document.getElementById('dashboard-content').classList.remove('hidden');

        // Render Grafik Tiket
        renderTicketChart(agents, tickets);
        
        // Render Tabel Durasi Menit-Detik
        renderAgentTable(tableData);

    } catch (error) {
        console.error("Gagal memproses data:", error);
        document.getElementById('loader').innerText = "Gagal memproses sinkronisasi data Sheets.";
    }
}

// Mengubah format inputan Google Sheets menjadi total detik murni
function parseTimeToSeconds(timeStr) {
    if (!timeStr) return 0;
    timeStr = timeStr.trim().replace(/"/g, '');
    
    if (timeStr.includes(':')) {
        const parts = timeStr.split(':').map(Number);
        if (parts.length === 3) {
            return (parts[0] * 3600) + (parts[1] * 60) + parts[2];
        } else if (parts.length === 2) {
            return (parts[0] * 60) + parts[1];
        }
    }
    
    const num = parseFloat(timeStr);
    if (!isNaN(num)) {
        if (num < 1) {
            return Math.round(num * 86400); 
        }
        return Math.round(num);
    }
    return 0;
}

// Mengubah total detik menjadi format kustom teks seperti "5m 24s" atau "8m 14s"
function formatSecondsToCustomHMS(totalSeconds) {
    if (isNaN(totalSeconds) || totalSeconds <= 0) return "0m 0s";
    
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = Math.floor(totalSeconds % 60);
    
    if (hours > 0) {
        return `${hours}h ${minutes}m ${seconds}s`;
    }
    return `${minutes}m ${seconds}s`;
}

function renderTicketChart(agents, tickets) {
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
    tableBody.innerHTML = ""; // Bersihkan tabel terlebih dahulu
    
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
