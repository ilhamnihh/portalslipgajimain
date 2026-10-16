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
        loadEmployeeComplaintsHistory();
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

function toggleMailboxDropdown() {
    const dropdown = document.getElementById('mailbox-dropdown');
    if (dropdown) {
        dropdown.classList.toggle('hidden');
    }
}

window.addEventListener('click', function(e) {
    const container = document.getElementById('admin-mailbox-container');
    const dropdown = document.getElementById('mailbox-dropdown');
    if (container && dropdown && !container.contains(e.target)) {
        dropdown.classList.add('hidden');
    }
});

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

async function loadAdminComplaints() {
    try {
        const res = await fetch('/api/complaints', { headers: authHeaders() });
        const complaints = await res.json();

        const mailboxContainer = document.getElementById('admin-mailbox-container');
        const mailboxBadge = document.getElementById('mailbox-badge');
        const mailboxCount = document.getElementById('mailbox-count');
        const mailboxItemsContainer = document.getElementById('mailbox-items-container');

        if (currentUser && currentUser.role === 'admin' && mailboxContainer) {
            mailboxContainer.classList.remove('hidden');
            
            const pendingComplaints = complaints.filter(c => c.status === 'Pending');

            if (pendingComplaints.length > 0) {
                mailboxBadge.innerText = pendingComplaints.length;
                mailboxBadge.classList.remove('hidden');
                mailboxCount.innerText = `${pendingComplaints.length} Pesan`;

                mailboxItemsContainer.innerHTML = pendingComplaints.map(c => {
                    let empName = c.employee_name || `Karyawan (${c.employee_id})`;
                    return `
                        <div class="p-3 bg-slate-50 hover:bg-slate-100 rounded-xl border transition space-y-1">
                            <div class="flex justify-between items-center font-semibold text-slate-800">
                                <span>${empName}</span>
                                <button onclick="openReplyModal(${c.id}, '${c.message ? c.message.replace(/'/g, "\\'") : ''}')" class="text-blue-600 hover:text-blue-700 font-bold text-[11px] bg-blue-50 px-2 py-0.5 rounded-md border border-blue-200">
                                    <i class="fa-solid fa-reply mr-1"></i> Balas
                                </button>
                            </div>
                            <p class="text-slate-600 whitespace-pre-wrap">${c.message || '-'}</p>
                            <p class="text-[10px] text-slate-400 text-right">${c.created_at ? new Date(c.created_at).toLocaleString('id-ID') : '-'}</p>
                        </div>
                    `;
                }).join('');
            } else {
                mailboxBadge.classList.add('hidden');
                mailboxCount.innerText = '0 Pesan';
                mailboxItemsContainer.innerHTML = `<p class="text-center text-slate-400 py-4">Tidak ada pesan komplain baru.</p>`;
            }
        }

        const tbody = document.getElementById('admin-complaints-table-body');
        if (tbody) {
            tbody.innerHTML = complaints.length === 0 ? 
                `<tr><td colspan="4" class="p-4 text-center text-slate-400">Belum ada komplain dari karyawan.</td></tr>` : 
                complaints.map(c => {
                    let empName = c.employee_name || `Karyawan (${c.employee_id})`;
                    const empId = c.employee_id || '-';
                    const messageText = c.message || '-';

                    const statusBadge = c.status === 'Dijawab' 
                        ? `<span class="px-2.5 py-1 bg-emerald-50 text-emerald-700 rounded-md text-[11px] font-semibold border border-emerald-200 inline-block"><i class="fa-solid fa-check-double mr-1"></i> Sudah dibaca & sudah dibalas</span>` 
                        : `<span class="px-2.5 py-1 bg-amber-50 text-amber-700 rounded-md text-[11px] font-semibold border border-amber-200 inline-block"><i class="fa-solid fa-clock mr-1"></i> Pending / Belum dibalas</span>`;

                    const replyContent = c.reply 
                        ? `<p class="text-xs text-slate-700 mt-2 bg-slate-50 p-2.5 rounded-lg border"><b>Balasan Anda:</b> ${c.reply}</p>` 
                        : `<p class="text-xs text-slate-400 mt-1 italic">Belum dibalas</p>`;

                    return `
                    <tr class="border-b hover:bg-slate-50/50 ${c.status === 'Dijawab' ? 'bg-slate-50/60 opacity-80' : ''}">
                        <td class="p-3"><b>${empId}</b><br><span class="text-xs text-slate-500">${empName}</span></td>
                        <td class="p-3 text-slate-700 whitespace-pre-wrap">${messageText}${replyContent}</td>
                        <td class="p-3">${statusBadge}</td>
                        <td class="p-3 text-center space-x-1 whitespace-nowrap">
                            <button onclick="openReplyModal(${c.id}, '${messageText.replace(/'/g, "\\'")}')" class="px-3 py-1.5 bg-blue-50 text-blue-600 rounded-lg text-xs font-semibold hover:bg-blue-100 transition">
                                <i class="fa-solid fa-reply mr-1"></i> ${c.reply ? 'Edit Balasan' : 'Balas'}
                            </button>
                            <button onclick="deleteComplaint(${c.id})" class="px-3 py-1.5 bg-rose-50 text-rose-600 rounded-lg text-xs font-semibold hover:bg-rose-100 transition" title="Hapus">
                                <i class="fa-solid fa-trash"></i>
                            </button>
                        </td>
                    </tr>
                `;
                }).join('');
        }
    } catch (err) {
        console.error("Gagal memuat komplain:", err);
    }
}

function openReplyModal(id, message) {
    document.getElementById('reply-complaint-id').value = id;
    document.getElementById('reply-original-message').innerText = message;
    document.getElementById('admin-reply-text').value = '';
    document.getElementById('reply-modal').classList.remove('hidden');
}

function closeReplyModal() {
    document.getElementById('reply-modal').classList.add('hidden');
}

const replyComplaintForm = document.getElementById('reply-complaint-form');
if (replyComplaintForm) {
    replyComplaintForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const id = document.getElementById('reply-complaint-id').value;
        const reply = document.getElementById('admin-reply-text').value;

        try {
            const res = await fetch(`/api/complaints/${id}/reply`, {
                method: 'PUT',
                headers: authHeaders({ 'Content-Type': 'application/json' }),
                body: JSON.stringify({ reply })
            });
            const data = await res.json();

            alert(data.message || data.error);
            if (data.success) {
                closeReplyModal();
                loadAdminComplaints();
            }
        } catch (err) {
            alert("Gagal mengirim balasan.");
        }
    });
}

async function deleteComplaint(id) {
    if (!confirm("Hapus komplain ini?")) return;
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
                loadEmployeeComplaintsHistory();
            }
        } catch (err) {
            alert("Gagal mengirim komplain.");
        }
    });
}

async function loadEmployeeComplaintsHistory() {
    const container = document.getElementById('employee-complaints-history');
    if (!container) return;

    try {
        const res = await fetch('/api/my-complaints', { headers: authHeaders() });
        const complaints = await res.json();

        container.innerHTML = complaints.length === 0 ? 
            `<p class="text-center text-slate-400 py-4 text-xs">Anda belum pernah mengirim komplain.</p>` :
            complaints.map(c => {
                const isReplied = c.status === 'Dijawab' || (c.reply && c.reply.trim() !== '');

                const statusBadge = isReplied 
                    ? `<span class="px-2.5 py-1 bg-emerald-50 text-emerald-700 rounded-md text-[10px] font-semibold border border-emerald-200"><i class="fa-solid fa-check-double mr-1"></i> Sudah dibaca & sudah dibalas</span>` 
                    : `<span class="px-2.5 py-1 bg-amber-50 text-amber-700 rounded-md text-[10px] font-semibold border border-emerald-200"><i class="fa-solid fa-clock mr-1"></i> Pending / Menunggu Respon</span>`;

                const replyBox = isReplied 
                    ? `<div class="mt-2 p-3 bg-blue-50/60 rounded-xl border border-blue-100 text-xs text-slate-700">
                           <p class="font-semibold text-blue-900 mb-0.5"><i class="fa-solid fa-user-shield mr-1"></i> Tanggapan Admin:</p>
                           <p>${c.reply}</p>
                       </div>` 
                    : `<p class="mt-2 text-[11px] text-slate-400 italic">Komplain sedang ditinjau oleh admin...</p>`;

                return `
                    <div class="p-4 bg-slate-50 rounded-xl border space-y-2 text-xs">
                        <div class="flex justify-between items-center">
                            <span class="text-slate-400">${c.created_at ? new Date(c.created_at).toLocaleString('id-ID') : ''}</span>
                            ${statusBadge}
                        </div>
                        <p class="text-slate-800 font-medium"><b>Komplain Anda:</b> ${c.message}</p>
                        ${replyBox}
                    </div>
                `;
            }).join('');
    } catch (err) {
        console.error("Gagal memuat riwayat komplain karyawan", err);
    }
}

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
    
    let files = document.getElementById('slip-files-input').files;
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