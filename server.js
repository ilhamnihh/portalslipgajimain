
const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { createClient } = require('@supabase/supabase-js');

const app = express();

// Konfigurasi Supabase
const SUPABASE_URL = 'https://vcasurmurhbtlnxrqkdi.supabase.co'; 
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZjYXN1cm11cmhidGxueHJxa2RpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTAzMTIxMzYsImV4cCI6MjEwNTg4ODEzNn0.REy2C3gsZqK-7zbmorYDvIVubpfxN9tyW0ojoodshGc'; 

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const UPLOAD_DIR = process.env.UPLOAD_DIR || path.join(__dirname, 'uploads');
const AUTH_SECRET = process.env.AUTH_SECRET;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(UPLOAD_DIR));

fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, UPLOAD_DIR);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + '-' + file.originalname);
    }
});
const upload = multer({
    storage,
    limits: { fileSize: 20 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        if (path.extname(file.originalname).toLowerCase() !== '.pdf') {
            return cb(new Error('Hanya file PDF yang dapat diunggah.'));
        }
        cb(null, true);
    }
});

function createToken(user) {
    if (!AUTH_SECRET) throw new Error('AUTH_SECRET belum dikonfigurasi di hosting.');
    const payload = Buffer.from(JSON.stringify({
        employee_id: user.employee_id,
        role: user.role,
        exp: Math.floor(Date.now() / 1000) + (8 * 60 * 60)
    })).toString('base64url');
    const signature = crypto.createHmac('sha256', AUTH_SECRET).update(payload).digest('base64url');
    return `${payload}.${signature}`;
}

function authenticateToken(req, res, next) {
    const authorization = req.headers.authorization || '';
    const [scheme, token] = authorization.split(' ');
    if (scheme !== 'Bearer' || !token || !AUTH_SECRET) {
        return res.status(401).json({ success: false, message: 'Sesi tidak valid atau sudah berakhir. Silakan login kembali.' });
    }

    try {
        const [payload, signature] = token.split('.');
        if (!payload || !signature) throw new Error('Token tidak valid');
        const expected = crypto.createHmac('sha256', AUTH_SECRET).update(payload).digest();
        const received = Buffer.from(signature, 'base64url');
        if (expected.length !== received.length || !crypto.timingSafeEqual(expected, received)) {
            throw new Error('Tanda tangan token tidak valid');
        }

        const user = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
        if (!user.employee_id || !user.role || user.exp <= Math.floor(Date.now() / 1000)) {
            throw new Error('Token kedaluwarsa atau tidak lengkap');
        }
        req.user = user;
        next();
    } catch (err) {
        return res.status(401).json({ success: false, message: 'Sesi tidak valid atau sudah berakhir. Silakan login kembali.' });
    }
}

function requireAdmin(req, res, next) {
    if (req.user.role !== 'admin') {
        return res.status(403).json({ success: false, message: 'Akses khusus administrator.' });
    }
    next();
}

// API Login
app.post('/api/login', async (req, res) => {
    try {
        const { employee_id, password } = req.body;
        console.log(`> Mencoba login untuk ID: "${employee_id}"`);
        
        const { data: user, error } = await supabase
            .from('users')
            .select('employee_id, full_name, role, position')
            .eq('employee_id', employee_id)
            .eq('password', password);

        if (error) {
            console.log("❌ Error dari Supabase:", error.message);
            // ... lanjutkan sisa kode kamu di bawahnya ...
        }

        if (error || !user) {
            return res.status(401).json({ success: false, message: 'ID Karyawan atau Password salah!' });
        }

        console.log("✅ Login Berhasil untuk:", user.full_name);
        res.json({ success: true, user, token: createToken(user) });
    } catch (err) {
        console.log("❌ Server Error:", err.message);
        res.status(500).json({ success: false, error: err.message });
    }
});

// API Get Employees
app.get('/api/employees', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('users')
            .select('*')
            .eq('role', 'employee');

        if (error) throw error;
        res.json(data);
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// API Add Employee
app.post('/api/employees', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { employee_id, password, full_name, position } = req.body;
        
        // Cek apakah ID sudah terdaftar
        const { data: existing, error: lookupError } = await supabase
            .from('users')
            .select('employee_id')
            .eq('employee_id', employee_id)
            .maybeSingle();

        if (lookupError) throw lookupError;

        if (existing) {
            return res.status(400).json({ success: false, message: 'ID Karyawan sudah terdaftar!' });
        }

        const newUser = {
            employee_id,
            password,
            full_name,
            role: 'employee',
            position: position || 'Staff'
        };

        const { data, error } = await supabase
            .from('users')
            .insert([newUser])
            .select()
            .single();

        if (error) throw error;

        res.json({ success: true, message: 'Karyawan berhasil ditambahkan!', user: data });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// API Upload Multiple PDF Slips dengan Pencocokan Otomatis
app.post('/api/upload-slips', authenticateToken, requireAdmin, upload.array('slip_files'), async (req, res) => {
    try {
        const { month, year } = req.body;
        const files = req.files;

        if (req.body.username !== req.user.employee_id) {
            await Promise.all((files || []).map(file => fs.promises.unlink(file.path).catch(() => {})));
            return res.status(403).json({ success: false, message: 'Identitas sesi tidak cocok. Silakan login kembali.' });
        }

        if (!files || files.length === 0) {
            return res.status(400).json({ success: false, message: 'Tidak ada file PDF yang diunggah!' });
        }

        // Ambil semua data karyawan dari Supabase
        const { data: users, error: userError } = await supabase
            .from('users')
            .select('*')
            .eq('role', 'employee');

        if (userError) throw userError;

        let successCount = 0;
        let slipsToInsert = [];

        files.forEach((file) => {
            const fileNameClean = file.originalname.toLowerCase();

            const targetEmp = users.find(u => {
                const empIdClean = u.employee_id.toLowerCase();
                const empNameClean = u.full_name.toLowerCase().replace(/\s+/g, '');
                return fileNameClean.includes(empIdClean) || fileNameClean.includes(empNameClean);
            });

            if (targetEmp) {
                slipsToInsert.push({
                    employee_id: targetEmp.employee_id,
                    month: month || 'Januari',
                    year: year ? parseInt(year) : 2026,
                    file_url: `/uploads/${path.basename(file.filename)}`,
                    file_name: file.originalname
                });
                successCount++;
            }
        });

        if (slipsToInsert.length > 0) {
            const { error: insertError } = await supabase
                .from('salary_slips')
                .insert(slipsToInsert);

            if (insertError) throw insertError;

            const matchedNames = new Set(slipsToInsert.map(slip => path.basename(slip.file_url)));
            await Promise.all(files
                .filter(file => !matchedNames.has(file.filename))
                .map(file => fs.promises.unlink(file.path).catch(() => {})));

            res.json({ success: true, message: `${successCount} dari ${files.length} file slip gaji berhasil dicocokkan dan diunggah!` });
        } else {
            await Promise.all(files.map(file => fs.promises.unlink(file.path).catch(() => {})));
            res.status(400).json({ success: false, message: 'Gagal mencocokkan nama file dengan ID Karyawan. Pastikan nama file mengandung ID karyawan.' });
        }
    } catch (err) {
        await Promise.all((req.files || []).map(file => fs.promises.unlink(file.path).catch(() => {})));
        res.status(500).json({ success: false, error: err.message });
    }
});

// API Get Slips
app.get('/api/slips', authenticateToken, async (req, res) => {
    try {
        let query = supabase.from('salary_slips').select('*');

        if (req.user.role !== 'admin') {
            query = query.eq('employee_id', req.user.employee_id);
        }

        const { data, error } = await query;

        if (error) throw error;
        res.json(data);
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// --- PASTIKAN BAGIAN INI ADA DI ATAS app.listen ---
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
    console.log(`Server berjalan di http://localhost:${PORT}`);
});