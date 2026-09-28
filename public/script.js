let currentUser = JSON.parse(localStorage.getItem('currentUser')) || null;
let authToken = localStorage.getItem('authToken') || null;

function authHeaders(headers = {}) {
    return { ...headers, Authorization: `Bearer ${authToken}` };
}

// Cek sesi saat halaman pertama kali dibuka
window.onload = () => {
    if (currentUser) {
        initDashboard();
    }
};

document.getElementById('login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const employee_id = document.getElementById('login-id').value;
    const password = document.getElementById('login-password').value;

    const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ employee_id, password })
    });
    const data = await res.json();

    if (data.success) {
        currentUser = data.user;
        authToken = data.token;
        localStorage.setItem('currentUser', JSON.stringify(currentUser)); // Simpan sesi
        localStorage.setItem('authToken', authToken);
        initDashboard();
    } else {
        alert(data.message);
    }
});

function logout() {
    currentUser = null;
    authToken = null;
    localStorage.removeItem('currentUser'); // Hapus sesi
    localStorage.removeItem('authToken');
    document.getElementById('login-section').classList.remove('hidden');
    document.getElementById('app-section').classList.add('hidden');
    document.getElementById('login-form').reset();
}

function initDashboard() {
    document.getElementById('login-section').classList.add('hidden');
    document.getElementById('app-section').classList.remove('hidden');
    document.getElementById('user-display-name').innerText = currentUser.full_name;
    document.getElementById('user-display-role').innerText = currentUser.role === 'admin' ? 'Administrator' : currentUser.position;

    if (currentUser.role === 'admin') {
        document.getElementById('admin-dashboard').classList.remove('hidden');
        document.getElementById('employee-dashboard').classList.add('hidden');
        loadAdminData();
    } else {
        document.getElementById('admin-dashboard').classList.add('hidden');
        document.getElementById('employee-dashboard').classList.remove('hidden');
        document.getElementById('emp-welcome-name').innerText = currentUser.full_name;
        loadEmployeeSlips();
    }
}

function switchTab(tab) {
    if (tab === 'upload') {
        document.getElementById('content-upload').classList.remove('hidden');
        document.getElementById('content-employees').classList.add('hidden');
        document.getElementById('tab-upload').className = "px-4 py-2 bg-blue-600 text-white font-medium rounded-xl text-sm transition";
        document.getElementById('tab-employees').className = "px-4 py-2 bg-white text-slate-600 border rounded-xl text-sm transition";
    } else {
        document.getElementById('content-upload').classList.add('hidden');
        document.getElementById('content-employees').classList.remove('hidden');
        document.getElementById('tab-employees').className = "px-4 py-2 bg-blue-600 text-white font-medium rounded-xl text-sm transition";
        document.getElementById('tab-upload').className = "px-4 py-2 bg-white text-slate-600 border rounded-xl text-sm transition";
    }
}

async function loadAdminData() {
    const empRes = await fetch('/api/employees', { headers: authHeaders() });
    const employees = await empRes.json();
    document.getElementById('employee-table-body').innerHTML = employees.map(e => `
        <tr class="border-b"><td class="p-3 font-semibold text-blue-600">${e.employee_id}</td><td class="p-3">${e.full_name}</td><td class="p-3 text-slate-500">${e.position}</td></tr>
    `).join('');

    const slipRes = await fetch('/api/slips', { headers: authHeaders() });
    const slips = await slipRes.json();
    document.getElementById('all-slips-table-body').innerHTML = slips.length === 0 ? `<tr><td colspan="4" class="p-4 text-center text-slate-400">Belum ada file.</td></tr>` : 
    slips.map(s => `
        <tr class="border-b"><td class="p-3 font-semibold">${s.employee_id}</td><td class="p-3">${s.month} ${s.year}</td><td class="p-3 text-slate-600">${s.file_name}</td><td class="p-3"><a href="${s.file_url}" target="_blank" class="px-3 py-1.5 bg-blue-50 text-blue-600 rounded-lg text-xs font-semibold">Buka PDF</a></td></tr>
    `).join('');
}

document.getElementById('add-employee-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const payload = {
        employee_id: document.getElementById('new-emp-id').value,
        full_name: document.getElementById('new-emp-name').value,
        password: document.getElementById('new-emp-pass').value,
        position: document.getElementById('new-emp-position').value
    };
    const res = await fetch('/api/employees', { method: 'POST', headers: authHeaders({ 'Content-Type': 'application/json' }), body: JSON.stringify(payload) });
    const data = await res.json();
    alert(data.message);
    if(data.success) { document.getElementById('add-employee-form').reset(); loadAdminData(); }
});

document.getElementById('upload-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const formData = new FormData();
    formData.append('month', document.getElementById('upload-month').value);
    formData.append('year', document.getElementById('upload-year').value);
    formData.append('username', currentUser.employee_id);
    
    const files = document.getElementById('slip-files-input').files;
    for (let i = 0; i < files.length; i++) { formData.append('slip_files', files[i]); }

    const res = await fetch('/api/upload-slips', { method: 'POST', headers: authHeaders(), body: formData });
    const data = await res.json();
    alert(data.message);
    if(data.success) { document.getElementById('upload-form').reset(); loadAdminData(); }
});

async function loadEmployeeSlips() {
    const res = await fetch('/api/slips', { headers: authHeaders() });
    const slips = await res.json();
    document.getElementById('employee-slips-container').innerHTML = slips.length === 0 ? `
        <div class="col-span-2 p-8 text-center bg-slate-50 rounded-xl border text-slate-400">Belum ada slip gaji untuk Anda.</div>
    ` : slips.map(s => `
        <div class="p-5 rounded-2xl border bg-slate-50 flex justify-between items-center">
            <div>
                <h4 class="font-bold text-slate-900 text-base">Periode ${s.month} ${s.year}</h4>
                <p class="text-xs text-slate-500 mt-1"><i class="fa-solid fa-file-pdf text-rose-500 mr-1"></i> ${s.file_name}</p>
            </div>
            <a href="${s.file_url}" target="_blank" class="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold transition shadow-md">
                <i class="fa-solid fa-download mr-1"></i> Unduh PDF
            </a>
        </div>
    `).join('');
}