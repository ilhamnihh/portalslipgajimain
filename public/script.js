let currentUser = JSON.parse(localStorage.getItem('currentUser')) || null;
let authToken = localStorage.getItem('authToken') || null;

function authHeaders(headers = {}) {
    return { ...headers, Authorization: `Bearer ${authToken}` };
}

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
        localStorage.setItem('currentUser', JSON.stringify(currentUser));
        localStorage.setItem('authToken', authToken);
        initDashboard();
    } else {
        alert(data.message || "Gagal masuk, periksa kembali ID dan password.");
    }
});

function logout() {
    currentUser = null;
    authToken = null;
    localStorage.removeItem('currentUser');
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
        loadAdminComplaints();
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

function toggleSelectAll(source) {
    const checkboxes = document.querySelectorAll('.emp-checkbox');
    checkboxes.forEach(cb => cb.checked = source.checked);
}

function toggleSelectAllSlips(source) {
    const checkboxes = document.querySelectorAll('.slip-checkbox');
    checkboxes.forEach(cb => cb.checked = source.checked);
}

async function loadAdminData() {
    const empRes = await fetch('/api/employees', { headers: authHeaders() });
    const employees = await empRes.json();
    
    renderEmployeeTable(employees);

    const slipRes = await fetch('/api/slips', { headers: authHeaders() });
    const slips = await slipRes.json();
    
    const selectAllSlipsCb = document.getElementById('select-all-slips-checkbox');
    if (selectAllSlipsCb) selectAllSlipsCb.checked = false;

    document.getElementById('all-slips-table-body').innerHTML = slips.length === 0 ? `<tr><td colspan="5" class="p-4 text-center text-slate-400">Belum ada file slip gaji.</td></tr>` : 
    slips.map(s => `
        <tr class="border-b hover:bg-slate-50/50">
            <td class="p-3 text-center">
                <input type="checkbox" value="${s.id}" class="slip-checkbox rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer">
            </td>
            <td class="p-3 font-semibold">${s.employee_id}</td>
            <td class="p-3">${s.month} ${s.year}</td>
            <td class="p-3 text-slate-600">${s.file_name}</td>
            <td class="p-3 flex space-x-2">
                <a href="${s.file_url}" target="_blank" class="px-3 py-1.5 bg-blue-50 text-blue-600 rounded-lg text-xs font-semibold hover:bg-blue-100 transition">
                    <i class="fa-solid fa-eye mr-1"></i> Buka
                </a>
                <button onclick="deleteSlip('${s.id}', '${s.file_name}')" class="px-3 py-1.5 bg-rose-50 text-rose-600 rounded-lg text-xs font-semibold hover:bg-rose-100 transition">
                    <i class="fa-solid fa-trash mr-1"></i> Hapus
                </button>
            </td>
        </tr>
    `).join('');
}

// Fungsi Pencarian Karyawan Real-time
async function searchEmployees(keyword) {
    const res = await fetch(`/api/employees/search?q=${encodeURIComponent(keyword)}`, { headers: authHeaders() });
    const employees = await res.json();
    renderEmployeeTable(employees);
}

function renderEmployeeTable(employees) {
    const selectAllCb = document.getElementById('select-all-checkbox');
    if (selectAllCb) selectAllCb.checked = false;

    document.getElementById('employee-table-body').innerHTML = employees.length === 0 ? 
        `<tr><td colspan="5" class="p-4 text-center text-slate-400">Karyawan tidak ditemukan.</td></tr>` : 
        employees.map(e => `
        <tr class="border-b hover:bg-slate-50/50">
            <td class="p-3 text-center">
                <input type="checkbox" value="${e.employee_id}" class="emp-checkbox rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer">
            </td>
            <td class="p-3 font-semibold text-blue-600">${e.employee_id}</td>
            <td class="p-3">${e.full_name}</td>
            <td class="p-3 text-slate-500">${e.position}</td>
            <td class="p-3 flex space-x-2">
                <button onclick="openEditModal('${e.employee_id}', '${e.full_name}', '${e.position}')" class="px-3 py-1.5 bg-amber-50 text-amber-600 rounded-lg text-xs font-semibold hover:bg-amber-100 transition">
                    <i class="fa-solid fa-pen-to-square mr-1"></i> Edit
                </button>
                <button onclick="deleteEmployee('${e.employee_id}', '${e.full_name}')" class="px-3 py-1.5 bg-rose-50 text-rose-600 rounded-lg text-xs font-semibold hover:bg-rose-100 transition">
                    <i class="fa-solid fa-trash mr-1"></i> Hapus
                </button>
            </td>
        </tr>
    `).join('');
}

// Fitur Komplain Karyawan & Admin
async function loadAdminComplaints() {
    const res = await fetch('/api/complaints', { headers: authHeaders() });
    const complaints = await res.json();

    const tbody = document.getElementById('admin-complaints-table-body');
    if (!tbody) return;

    tbody.innerHTML = complaints.length === 0 ? 
        `<tr><td colspan="4" class="p-4 text-center text-slate-400">Belum ada komplain dari karyawan.</td></tr>` : 
        complaints.map(c => `
        <tr class="border-b hover:bg-slate-50/50">
            <td class="p-3"><b>${c.employee_id}</b><br><span class="text-xs text-slate-500">${c.employee_name}</span></td>
            <td class="p-3 text-slate-700 whitespace-pre-wrap">${c.message}</td>
            <td class="p-3 text-xs text-slate-400">${new Date(c.created_at).toLocaleString('id-ID')}</td>
            <td class="p-3">
                <button onclick="deleteComplaint(${c.id})" class="px-3 py-1.5 bg-emerald-50 text-emerald-600 rounded-lg text-xs font-semibold hover:bg-emerald-100 transition">
                    <i class="fa-solid fa-check mr-1"></i> Selesaikan
                </button>
            </td>
        </tr>
    `).join('');
}

async function deleteComplaint(id) {
    if (!confirm("Tandai komplain ini sebagai selesai?")) return;
    const res = await fetch(`/api/complaints/${id}`, { method: 'DELETE', headers: authHeaders() });
    const data = await res.json();
    alert(data.message);
    if (data.success) loadAdminComplaints();
}

const complaintForm = document.getElementById('complaint-form');
if (complaintForm) {
    complaintForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const message = document.getElementById('complaint-message').value;

        try {
            const res = await fetch('/api/complaints', {
                method: 'POST',
                headers: authHeaders({ 'Content-Type': 'application/json' }),
                body: JSON.stringify({ message })
            });
            const data = await res.json();

            alert(data.message);
            if (data.success) {
                complaintForm.reset();
            }
        } catch (err) {
            alert("Gagal mengirim komplain.");
        }
    });
}

// Handler Ganti Password Mandiri oleh Karyawan
const changePasswordForm = document.getElementById('change-password-form');
if (changePasswordForm) {
    changePasswordForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const currentPassword = document.getElementById('current-password').value;
        const newPassword = document.getElementById('new-password').value;

        try {
            const res = await fetch('/api/employee/change-password', {
                method: 'PUT',
                headers: authHeaders({ 'Content-Type': 'application/json' }),
                body: JSON.stringify({ current_password: currentPassword, new_password: newPassword })
            });
            const data = await res.json();

            alert(data.message || data.error);
            if (data.success) {
                changePasswordForm.reset();
            }
        } catch (err) {
            alert("Terjadi kesalahan saat mengubah password.");
        }
    });
}

function openEditModal(id, name, position) {
    document.getElementById('edit-emp-id-hidden').value = id;
    document.getElementById('edit-emp-id-display').value = id;
    document.getElementById('edit-emp-name').value = name;
    document.getElementById('edit-emp-position').value = position;
    document.getElementById('edit-emp-pass').value = '';
    document.getElementById('edit-modal').classList.remove('hidden');
}

function closeEditModal() {
    document.getElementById('edit-modal').classList.add('hidden');
}

document.getElementById('edit-employee-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const employee_id = document.getElementById('edit-emp-id-hidden').value;
    const payload = {
        full_name: document.getElementById('edit-emp-name').value,
        position: document.getElementById('edit-emp-position').value,
        password: document.getElementById('edit-emp-pass').value
    };

    try {
        const res = await fetch(`/api/employees/${employee_id}`, {
            method: 'PUT',
            headers: authHeaders({ 'Content-Type': 'application/json' }),
            body: JSON.stringify(payload)
        });
        const data = await res.json();
        
        alert(data.message || data.error || "Berhasil memperbarui data");
        if (data.success) {
            closeEditModal();
            loadAdminData();
        }
    } catch (err) {
        alert("Terjadi kesalahan saat memperbarui data karyawan.");
    }
});

async function deleteEmployee(employeeId, fullName) {
    if (!confirm(`Apakah Anda yakin ingin menghapus karyawan "${fullName}" (${employeeId})?`)) {
        return;
    }

    try {
        const res = await fetch(`/api/employees/${employeeId}`, {
            method: 'DELETE',
            headers: authHeaders()
        });
        const data = await res.json();

        alert(data.message || data.error || "Proses selesai");
        if (data.success) {
            loadAdminData();
        }
    } catch (err) {
        alert("Terjadi kesalahan saat menghapus data karyawan.");
    }
}

async function deleteSelectedEmployees() {
    const selectedCheckboxes = document.querySelectorAll('.emp-checkbox:checked');
    
    if (selectedCheckboxes.length === 0) {
        alert("Pilih setidaknya satu karyawan yang ingin dihapus!");
        return;
    }

    if (!confirm(`Apakah Anda yakin ingin menghapus ${selectedCheckboxes.length} karyawan yang dipilih?`)) {
        return;
    }

    const employeeIds = Array.from(selectedCheckboxes).map(cb => cb.value);

    try {
        const res = await fetch('/api/employees', {
            method: 'DELETE',
            headers: authHeaders({ 'Content-Type': 'application/json' }),
            body: JSON.stringify({ employee_ids: employeeIds })
        });
        const data = await res.json();

        alert(data.message || data.error || "Proses selesai");
        if (data.success) {
            loadAdminData();
        }
    } catch (err) {
        alert("Terjadi kesalahan saat menghapus data karyawan.");
    }
}

async function deleteSlip(slipId, fileName) {
    if (!confirm(`Apakah Anda yakin ingin menghapus file slip "${fileName}"?`)) {
        return;
    }

    try {
        const res = await fetch(`/api/slips/${slipId}`, {
            method: 'DELETE',
            headers: authHeaders()
        });
        const data = await res.json();

        alert(data.message || data.error || "Proses selesai");
        if (data.success) {
            loadAdminData();
        }
    } catch (err) {
        alert("Terjadi kesalahan saat menghapus slip gaji.");
    }
}

async function deleteSelectedSlips() {
    const selectedCheckboxes = document.querySelectorAll('.slip-checkbox:checked');
    
    if (selectedCheckboxes.length === 0) {
        alert("Pilih setidaknya satu slip gaji yang ingin dihapus!");
        return;
    }

    if (!confirm(`Apakah Anda yakin ingin menghapus ${selectedCheckboxes.length} slip gaji yang dipilih?`)) {
        return;
    }

    const slipIds = Array.from(selectedCheckboxes).map(cb => cb.value);

    try {
        const res = await fetch('/api/slips', {
            method: 'DELETE',
            headers: authHeaders({ 'Content-Type': 'application/json' }),
            body: JSON.stringify({ slip_ids: slipIds })
        });
        const data = await res.json();

        alert(data.message || data.error || "Proses selesai");
        if (data.success) {
            loadAdminData();
        }
    } catch (err) {
        alert("Terjadi kesalahan saat menghapus slip gaji.");
    }
}

document.getElementById('import-excel-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const fileInput = document.getElementById('excel-file-input');
    
    if (fileInput.files.length === 0) {
        alert("Pilih file Excel terlebih dahulu!");
        return;
    }

    const formData = new FormData();
    formData.append('employee_file', fileInput.files[0]);

    try {
        const res = await fetch('/api/employees/import', {
            method: 'POST',
            headers: authHeaders(),
            body: formData
        });
        const data = await res.json();

        alert(data.message || data.error || "Proses impor selesai.");
        if (data.success) {
            document.getElementById('import-excel-form').reset();
            loadAdminData();
        }
    } catch (err) {
        alert("Terjadi kesalahan saat mengunggah file Excel.");
    }
});

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
    alert(data.message || data.error || "Berhasil");
    if(data.success) { document.getElementById('add-employee-form').reset(); loadAdminData(); }
});

document.getElementById('upload-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const formData = new FormData();
    formData.append('month', document.getElementById('upload-month').value);
    formData.append('period', document.getElementById('upload-period').value);
    formData.append('year', document.getElementById('upload-year').value);
    
    const files = document.getElementById('slip-files-input').files;
    for (let i = 0; i < files.length; i++) { 
        formData.append('slip_files', files[i]); 
    }

    try {
        const res = await fetch('/api/upload-slips', { 
            method: 'POST', 
            headers: authHeaders(), 
            body: formData 
        });
        const data = await res.json();
        
        alert(data.message || data.error || "Proses upload selesai.");
        if (data.success) { 
            document.getElementById('upload-form').reset(); 
            loadAdminData(); 
        }
    } catch (err) {
        alert("Terjadi kesalahan pada server saat mengunggah file.");
    }
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