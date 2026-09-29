const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const XLSX = require('xlsx');
const { createClient } = require('@supabase/supabase-js');

const app = express();

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

const excelStorage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, UPLOAD_DIR);
    },
    filename: (req, file, cb) => {
        cb(null, 'excel-' + Date.now() + '-' + file.originalname);
    }
});
const uploadExcel = multer({
    storage: excelStorage,
    fileFilter: (req, file, cb) => {
        const ext = path.extname(file.originalname).toLowerCase();
        if (ext !== '.xlsx' && ext !== '.xls') {
            return cb(new Error('Hanya file Excel (.xlsx atau .xls) yang diizinkan.'));
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

app.post('/api/login', async (req, res) => {
    try {
        const { employee_id, password } = req.body;
        const { data: user, error } = await supabase
            .from('users')
            .select('employee_id, full_name, role, position')
            .eq('employee_id', employee_id)
            .eq('password', password)
            .maybeSingle();

        if (error) {
            return res.status(401).json({ success: false, message: error.message });
        }

        if (!user) {
            return res.status(401).json({ success: false, message: 'ID Karyawan atau Password salah!' });
        }

        res.json({ success: true, user, token: createToken(user) });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

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

app.post('/api/employees', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { employee_id, password, full_name, position } = req.body;
        
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

app.put('/api/employees/:employee_id', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { employee_id } = req.params;
        const { full_name, position, password } = req.body;

        const updateData = {
            full_name,
            position: position || 'Staff'
        };

        if (password && password.trim() !== '') {
            updateData.password = password;
        }

        const { data, error } = await supabase
            .from('users')
            .update(updateData)
            .eq('employee_id', employee_id)
            .select()
            .single();

        if (error) throw error;

        res.json({ success: true, message: 'Data karyawan berhasil diperbarui!', user: data });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

app.delete('/api/employees/:employee_id', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { employee_id } = req.params;

        const { error } = await supabase
            .from('users')
            .delete()
            .eq('employee_id', employee_id);

        if (error) throw error;

        res.json({ success: true, message: 'Karyawan berhasil dihapus dari sistem!' });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

app.post('/api/employees/import', authenticateToken, requireAdmin, uploadExcel.single('employee_file'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ success: false, message: 'Tidak ada file Excel yang diunggah!' });
        }

        const workbook = XLSX.readFile(req.file.path);
        const sheetName = workbook.SheetNames[0];
        const sheetData = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName]);

        await fs.promises.unlink(req.file.path).catch(() => {});

        if (!sheetData || sheetData.length === 0) {
            return res.status(400).json({ success: false, message: 'File Excel kosong atau format tidak sesuai.' });
        }

        let importedCount = 0;

        for (const row of sheetData) {
            const employee_id = String(row.employee_id || row.ID || '').trim();
            const password = String(row.password || row.Password || '').trim();
            const full_name = String(row.full_name || row.Nama || '').trim();
            const position = String(row.position || row.Jabatan || 'Staff').trim();

            if (!employee_id || !password || !full_name) {
                continue;
            }

            const { data: existing } = await supabase
                .from('users')
                .select('employee_id')
                .eq('employee_id', employee_id)
                .maybeSingle();

            if (!existing) {
                const { error: insertError } = await supabase
                    .from('users')
                    .insert([{
                        employee_id,
                        password,
                        full_name,
                        role: 'employee',
                        position
                    }]);

                if (!insertError) {
                    importedCount++;
                }
            }
        }

        res.json({ 
            success: true, 
            message: `Berhasil mengimpor ${importedCount} karyawan baru dari file Excel!` 
        });

    } catch (err) {
        if (req.file) await fs.promises.unlink(req.file.path).catch(() => {});
        res.status(500).json({ success: false, error: err.message });
    }
});

// API Upload Multiple PDF Slips dengan Pencocokan Ketat (Strict Regex Matching)
app.post('/api/upload-slips', authenticateToken, requireAdmin, upload.array('slip_files'), async (req, res) => {
    try {
        const { month, year } = req.body;
        const files = req.files;

        if (!files || files.length === 0) {
            return res.status(400).json({ success: false, message: 'Tidak ada file PDF yang diunggah!' });
        }

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

                const idRegex = new RegExp(`(^|[^a-z0-9])${empIdClean}([^a-z0-9]|$)`, 'i');
                const nameRegex = new RegExp(`(^|[^a-z0-9])${empNameClean}([^a-z0-9]|$)`, 'i');

                return idRegex.test(fileNameClean) || nameRegex.test(fileNameClean);
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
            res.status(400).json({ success: false, message: 'Gagal mencocokkan nama file dengan ID Karyawan. Pastikan nama file mengandung ID karyawan secara utuh (contoh: 1234_sahrul.pdf).' });
        }
    } catch (err) {
        console.log("❌ ERROR SAAT UPLOAD SLIP:", err.message);
        await Promise.all((req.files || []).map(file => fs.promises.unlink(file.path).catch(() => {})));
        res.status(500).json({ success: false, error: err.message });
    }
});

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

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server berjalan di http://localhost:${PORT}`);
});