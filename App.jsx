import React, { useState, useEffect, useRef } from 'react';
import {
  Search, Plus, Camera, CheckCircle, AlertCircle, Wrench, DollarSign,
  QrCode, MessageCircle, History, X, Trash2, Save, ChevronLeft, PenTool,
  Phone, User, Filter, Image as ImageIcon, Video, ShieldCheck, FileText,
  Clock, Package, LayoutDashboard, Printer, Tag, TrendingUp, ListChecks, Settings,
  Bell, CalendarClock, AlertTriangle
} from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { createCloudTicket, deleteCloudTicket, loadCloudTickets, loadPublicTicket, updateCloudTicket } from './cloud.js';

/* ---------- konstanta ---------- */

const STATUS = [
  { key: 'diterima', label: 'Diterima', color: 'bg-sky-500', text: 'text-sky-400', ring: 'ring-sky-500/30' },
  { key: 'dicek', label: 'Dicek Teknisi', color: 'bg-amber-500', text: 'text-amber-400', ring: 'ring-amber-500/30' },
  { key: 'gagal', label: 'Gagal Servis', color: 'bg-rose-600', text: 'text-rose-400', ring: 'ring-rose-500/30' },
  { key: 'proses', label: 'Proses Perbaikan', color: 'bg-orange-500', text: 'text-orange-400', ring: 'ring-orange-500/30' },
  { key: 'selesai', label: 'Selesai', color: 'bg-emerald-500', text: 'text-emerald-400', ring: 'ring-emerald-500/30' },
  { key: 'diambil', label: 'Sudah Diambil', color: 'bg-slate-500', text: 'text-slate-400', ring: 'ring-slate-500/30' },
  { key: 'komplain', label: 'Komplain', color: 'bg-fuchsia-600', text: 'text-fuchsia-400', ring: 'ring-fuchsia-500/30' },
  { key: 'komplain_selesai', label: 'Selesai Komplain', color: 'bg-teal-500', text: 'text-teal-400', ring: 'ring-teal-500/30' },
];

const CHECKLIST_PARTS = ['LCD / Layar', 'Frame / Casing', 'Tombol On/Off', 'Tombol Volume', 'Kamera Depan', 'Kamera Belakang', 'Sinyal', 'Wi-Fi', 'Kaca Kamera Depan', 'Kaca Kamera Belakang', 'Speaker', 'Mic', 'Buzzer', 'Sidik Jari', 'Lampu Flash', 'Konektor Charging', 'Baterai', 'Battery Health', 'Face ID'];
// Kode kunci untuk menghapus servis. Ganti angka ini sesuai keinginan Anda.
const HAPUS_PIN = '1982';
const COMPLETENESS_ITEMS = ['Silikon / Case', 'Backcover', 'SIM Tray', 'SIM Card', 'MMC', 'Kabel Charger', 'Kepala Charger'];
const COND_OPTIONS = ['Tidak Bisa Dicek', 'Baik', 'Kurang Baik', 'Lecet', 'Rusak', 'Tidak Ada'];
const CONDCOLOR = { 'Tidak Bisa Dicek': 'text-sky-400', 'Baik': 'text-emerald-400', 'Kurang Baik': 'text-orange-400', 'Lecet': 'text-amber-400', 'Rusak': 'text-red-400', 'Tidak Ada': 'text-slate-500' };

function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 8); }
function fmtDate(ts) { return new Date(ts).toLocaleString('id-ID', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }); }
function fmtRupiah(n) { return 'Rp' + (Number(n) || 0).toLocaleString('id-ID'); }
function statusInfo(key) { return STATUS.find(s => s.key === key) || STATUS[0]; }
function emptyChecklist() { const o = {}; CHECKLIST_PARTS.forEach(p => o[p] = { cond: 'Tidak Bisa Dicek', note: '' }); return o; }
function emptyCompleteness() { return Object.fromEntries(COMPLETENESS_ITEMS.map(x => [x, false])); }
function completenessText(ticket) {
  const items = COMPLETENESS_ITEMS.filter(x => ticket.completeness?.[x]);
  if (ticket.completenessOther) items.push(ticket.completenessOther);
  return items.length ? items.join(', ') : 'Unit saja / tidak ada kelengkapan';
}

function PhotoAddButtons({ onFiles, busy }) {
  return (
    <>
      <label className="flex h-20 w-20 cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-slate-600 text-slate-400 hover:border-amber-500 hover:text-amber-400">
        <Camera className="h-5 w-5" />
        <span className="text-[10px]">{busy ? '...' : 'Kamera'}</span>
        <input type="file" accept="image/*" capture="environment" className="hidden" onChange={e => onFiles(e.target.files)} />
      </label>
      <label className="flex h-20 w-20 cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-slate-600 text-slate-400 hover:border-amber-500 hover:text-amber-400">
        <ImageIcon className="h-5 w-5" />
        <span className="text-[10px]">{busy ? '...' : 'Galeri'}</span>
        <input type="file" accept="image/*" multiple className="hidden" onChange={e => onFiles(e.target.files)} />
      </label>
    </>
  );
}

function CompletenessToggle({ checked, onChange, label }) {
  return (
    <button type="button" onClick={() => onChange(!checked)} className="flex items-center gap-2 text-sm text-slate-300">
      <span className={`flex h-5 w-5 flex-shrink-0 items-center justify-center rounded border text-xs font-bold ${checked ? 'border-emerald-500 bg-emerald-500/20 text-emerald-400' : 'border-red-500 bg-red-500/10 text-red-400'}`}>
        {checked ? '✓' : '✕'}
      </span>
      {label}
    </button>
  );
}

function daysBetween(a, b) { return Math.floor((b - a) / 86400000); }

// Kapan status tiket ini terakhir berubah (dipakai untuk menghitung "sudah berapa
// hari nganggur di status ini"). Kalau belum pernah ada log perubahan status,
// pakai waktu tiket dibuat.
function statusChangedAt(ticket) {
  const logs = (ticket.auditLog || []).filter(l => l.action && l.action.startsWith('Status diubah'));
  if (logs.length) return logs[logs.length - 1].at;
  return ticket.createdAt;
}

// Menentukan apakah tiket ini perlu diingatkan, dan pesan apa yang paling
// relevan sesuai posisi status saat ini:
//  - diterima -> ingatkan untuk segera dicek teknisi
//  - dicek    -> ingatkan untuk segera mulai proses perbaikan
//  - proses   -> ingatkan supaya tidak lupa menyelesaikan
function ticketReminder(ticket) {
  if (ticket.status === 'selesai' || ticket.status === 'diambil' || ticket.status === 'gagal' || ticket.status === 'komplain_selesai') return null;
  const today = new Date(); today.setHours(0, 0, 0, 0);

  // Lama diam di status yang sekarang
  const since = new Date(statusChangedAt(ticket)); since.setHours(0, 0, 0, 0);
  const diam = daysBetween(since, today);

  // Status Komplain punya hitungan sendiri: dihitung sejak status diubah ke Komplain,
  // hari pertama = hari ke-1 (bukan dari tanggal servis awal).
  if (ticket.status === 'komplain') {
    const hari = diam + 1;
    if (hari >= 3) {
      return { level: 'tinjau', badge: '🔴 TERLAMBAT', label: 'Sudah melewati batas penanganan — segera tangani', days: diam, umur: hari };
    }
    if (hari === 2) {
      return { level: 'perhatian', badge: '🟡 BATAS PENANGANAN', label: 'Harus ditangani hari ini', days: diam, umur: hari };
    }
    return { level: 'baru', badge: '🟢 SEGERA DITANGANI', label: 'Segera tangani komplain ini', days: diam, umur: hari };
  }

  // Umur servis keseluruhan: hari diterima dihitung sebagai hari ke-1
  const masuk = new Date(ticket.createdAt); masuk.setHours(0, 0, 0, 0);
  const umur = daysBetween(masuk, today) + 1;

  const nextAction = {
    diterima: `Segera pindahkan ke status "Dicek Teknisi"`,
    dicek: `Segera mulai "Proses Perbaikan"`,
    proses: `Segera selesaikan servis ini`,
  }[ticket.status] || 'Segera ditindaklanjuti';

  // Prioritas tertinggi: umur servis sudah 7 hari atau lebih
  if (umur >= 7) {
    return {
      level: 'tinjau',
      badge: '🔴 WAJIB DITINJAU ULANG',
      label: `${nextAction} — mohon ditinjau ulang`,
      days: diam, umur,
    };
  }
  if (diam >= 3) {
    return {
      level: 'terlambat',
      badge: '🟠 TERLAMBAT',
      label: nextAction,
      days: diam, umur,
    };
  }
  if (diam >= 2) {
    return {
      level: 'perhatian',
      badge: '🟡 PERINGATAN',
      label: nextAction,
      days: diam, umur,
    };
  }
  // Walau status baru saja diubah, servis yang umurnya sudah 2 hari atau lebih
  // tetap wajib muncul di notifikasi.
  if (umur >= 2) {
    return {
      level: 'perhatian',
      badge: '🟡 PERINGATAN',
      label: nextAction,
      days: diam, umur,
    };
  }
  return null;
}

function youtubeUrl(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  try {
    const url = new URL(raw);
    const host = url.hostname.replace(/^www\./, '').toLowerCase();
    return ['youtube.com', 'm.youtube.com', 'youtu.be'].includes(host) ? url.toString() : '';
  } catch { return ''; }
}

function compressImage(file, maxW = 700, quality = 0.55) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const scale = Math.min(1, maxW / img.width);
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(img.width * scale));
        canvas.height = Math.max(1, Math.round(img.height * scale));
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.onerror = reject;
      img.src = e.target.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function readMediaFile(file, maxBytes = 45 * 1024 * 1024) {
  return new Promise((resolve, reject) => {
    if (file.size > maxBytes) return reject(new Error('Video maksimal 45 MB'));
    const reader = new FileReader();
    reader.onload = e => resolve(e.target.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/* ---------- komponen kecil ---------- */

function Badge({ statusKey }) {
  const s = statusInfo(statusKey);
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ring-1 ${s.ring} ${s.text} bg-slate-900/60`}>
      <span className={`h-1.5 w-1.5 rounded-full ${s.color}`} />
      {s.label}
    </span>
  );
}

function SignaturePad({ onSave, onCancel }) {
  const canvasRef = useRef(null);
  const drawing = useRef(false);
  const last = useRef({ x: 0, y: 0 });

  const pos = (e) => {
    const rect = canvasRef.current.getBoundingClientRect();
    const cx = e.clientX ?? (e.touches && e.touches[0].clientX);
    const cy = e.clientY ?? (e.touches && e.touches[0].clientY);
    return { x: cx - rect.left, y: cy - rect.top };
  };

  const start = (e) => { drawing.current = true; last.current = pos(e); };
  const move = (e) => {
    if (!drawing.current) return;
    const ctx = canvasRef.current.getContext('2d');
    const p = pos(e);
    ctx.strokeStyle = '#e2e8f0';
    ctx.lineWidth = 2.2;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(last.current.x, last.current.y);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    last.current = p;
  };
  const end = () => { drawing.current = false; };
  const clear = () => {
    const ctx = canvasRef.current.getContext('2d');
    ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
  };

  return (
    <div className="rounded-xl border border-slate-700 bg-slate-900 p-3">
      <p className="mb-2 text-xs text-slate-400">Minta pelanggan tanda tangan di area bawah sebagai bukti persetujuan.</p>
      <canvas
        ref={canvasRef}
        width={480}
        height={180}
        className="w-full touch-none rounded-lg bg-slate-950 border border-slate-800"
        onMouseDown={start} onMouseMove={move} onMouseUp={end} onMouseLeave={end}
        onTouchStart={start} onTouchMove={move} onTouchEnd={end}
      />
      <div className="mt-3 flex gap-2">
        <button onClick={clear} className="rounded-lg border border-slate-700 px-3 py-1.5 text-sm text-slate-300 hover:bg-slate-800">Hapus</button>
        <button onClick={() => onSave(canvasRef.current.toDataURL('image/png'))} className="rounded-lg bg-amber-500 px-3 py-1.5 text-sm font-medium text-slate-950 hover:bg-amber-400">Simpan Tanda Tangan</button>
        <button onClick={onCancel} className="ml-auto rounded-lg px-3 py-1.5 text-sm text-slate-400 hover:text-slate-200">Batal</button>
      </div>
    </div>
  );
}

/* ---------- halaman pelacakan pelanggan (read-only) ---------- */

function CustomerTrack({ ticket }) {
  if (ticket === 'notfound' || !ticket) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950 p-6 text-center">
        <div>
          <AlertCircle className="mx-auto mb-3 h-10 w-10 text-red-400" />
          <h1 className="text-lg font-semibold text-slate-100">Servis tidak ditemukan</h1>
          <p className="mt-1 text-sm text-slate-400">Periksa kembali link atau nomor segel yang diberikan toko.</p>
        </div>
      </div>
    );
  }
  const s = statusInfo(ticket.status);
  const MediaSection = ({ title, photos = [], videos = [] }) => {
    if (!photos.length && !videos.length) return null;
    return (
      <div className="mt-4 rounded-xl border border-slate-800 bg-slate-900/60 p-4">
        <p className="mb-3 text-sm font-medium text-slate-200">{title}</p>
        <div className="grid grid-cols-2 gap-2">
          {photos.map((src, i) => <a key={`p-${i}`} href={src} target="_blank" rel="noreferrer"><img src={src} className="aspect-square w-full rounded-lg border border-slate-700 object-cover" /></a>)}
          {videos.map((src, i) => <video key={`v-${i}`} src={src} controls preload="metadata" playsInline className="col-span-2 max-h-72 w-full rounded-lg border border-slate-700 bg-black" />)}
        </div>
      </div>
    );
  };
  return (
    <div className="min-h-screen bg-slate-950 p-5 text-slate-100">
      <div className="mx-auto max-w-md">
        <div className="flex items-center gap-2 text-amber-400"><Wrench className="h-5 w-5" /><span className="font-mono text-xs">SEGEL #{ticket.segelNumber || '-'}</span></div>
        <h1 className="mt-2 text-xl font-semibold">{ticket.phoneModel}</h1>
        <p className="text-sm text-slate-400">Pelanggan: {ticket.customerName}</p>

        <div className="mt-6 rounded-xl border border-slate-800 bg-slate-900/60 p-4">
          <Badge statusKey={ticket.status} />
          {ticket.status === 'gagal' ? (
            <div className="mt-4 rounded-lg border border-rose-800/60 bg-rose-950/30 p-3 text-sm">
              <p className="font-medium text-rose-300">Servis tidak dapat diselesaikan</p>
              <p className="mt-1 text-slate-300">{ticket.gagalReason || 'Silakan hubungi toko untuk penjelasan lebih lanjut.'}</p>
            </div>
          ) : (
          <div className="mt-4 space-y-3">
            {(() => {
              const visible = STATUS.filter(st => st.key !== 'gagal');
              const vIdx = visible.findIndex(x => x.key === ticket.status);
              return visible.map((st, i) => (
                <div key={st.key} className="flex items-center gap-3">
                  <div className={`h-2.5 w-2.5 rounded-full ${i <= vIdx ? st.color : 'bg-slate-700'}`} />
                  <span className={i <= vIdx ? 'text-slate-200' : 'text-slate-500'}>{st.label}</span>
                </div>
              ));
            })()}
          </div>
          )}
        </div>

        {ticket.biayaEstimasi ? (
          <div className="mt-4 rounded-xl border border-slate-800 bg-slate-900/60 p-4 text-sm">
            <p className="text-slate-400">Estimasi biaya</p>
            <p className="text-lg font-semibold text-emerald-400">{fmtRupiah(ticket.biayaEstimasi)}</p>
          </div>
        ) : null}

        <MediaSection title="Saat Diterima" photos={ticket.photosBefore} videos={ticket.videosBefore} />
        <MediaSection title="Proses Pengerjaan" photos={ticket.photosProses || []} videos={[]} />
        <MediaSection title="Setelah Servis Selesai" photos={ticket.photosSesudah} videos={ticket.videosAfter} />

        {ticket.videoBeforeLink ? <a href={ticket.videoBeforeLink} target="_blank" rel="noreferrer" className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-red-600 px-4 py-3 text-sm font-semibold text-white hover:bg-red-500"><Video className="h-5 w-5" />Video Saat Diterima / Dibongkar</a> : null}
        {ticket.videoAfterLink ? <a href={ticket.videoAfterLink} target="_blank" rel="noreferrer" className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-red-600 px-4 py-3 text-sm font-semibold text-white hover:bg-red-500"><Video className="h-5 w-5" />Video Setelah Servis Selesai</a> : null}

        <p className="mt-6 text-center text-xs text-slate-500">Hubungi toko jika ada pertanyaan mengenai servis ini.</p>
      </div>
    </div>
  );
}

/* ---------- form tiket baru ---------- */

function NewTicketForm({ onCreate, onCancel }) {
  const [sumberServis, setSumberServis] = useState('');
  const [form, setForm] = useState({ customerName: '', customerPhone: '', phoneModel: '', imei: '', sparepartReplaced: '', segelNumber: '', videoBeforeLink: '', videoProsesLink: '', videoAfterLink: '', biayaEstimasi: '', keluhan: '', completenessOther: '', sim1Brand: '', sim2Brand: '', mmcSize: '', mmcBrand: '', unlockType: 'tidak_ada', unlockValue: '', downPayment: '', cashPayment: '', paymentStatus: '' });
  const [checklist, setChecklist] = useState(emptyChecklist());
  const [completeness, setCompleteness] = useState(emptyCompleteness());
  const [photos, setPhotos] = useState([]);
  const [photosInternal, setPhotosInternal] = useState([]);
  const [busy, setBusy] = useState(false);
  const [validationError, setValidationError] = useState(null);

  const handlePhotos = async (files, setter) => {
    setBusy(true);
    const arr = [];
    for (const f of Array.from(files)) {
      try { arr.push(await compressImage(f)); } catch (e) {}
    }
    setter(p => [...p, ...arr]);
    setBusy(false);
  };

  const submit = () => {
    if (!sumberServis) { setValidationError(['Sumber Servis (TUSER atau CUSTOMER)']); return; }
    const missing = [];
    if (!form.customerName.trim()) missing.push('Nama Pelanggan');
    if (!form.phoneModel.trim()) missing.push('Merek & Tipe HP');
    if (!form.sparepartReplaced.trim()) missing.push('Sparepart Diganti');
    if (!form.keluhan.trim()) missing.push('Keluhan Pelanggan');
    if (form.unlockType === 'pin' && !form.unlockValue.trim()) missing.push('PIN / Kode Kunci Layar');
    if (form.unlockType === 'pola' && !form.unlockValue.trim()) missing.push('Pola Kunci Layar');
    if (!form.paymentStatus) missing.push('Status Pembayaran');
    if (!photos.length) missing.push('Foto Kondisi Sebelum Servis');
    if (missing.length) { setValidationError(missing); return; }
    if ((form.videoBeforeLink && !youtubeUrl(form.videoBeforeLink)) || (form.videoProsesLink && !youtubeUrl(form.videoProsesLink)) || (form.videoAfterLink && !youtubeUrl(form.videoAfterLink))) return alert('Gunakan link YouTube atau youtu.be yang benar.');
    onCreate({ ...form, sumberServis, videoBeforeLink: youtubeUrl(form.videoBeforeLink), videoProsesLink: youtubeUrl(form.videoProsesLink), videoAfterLink: youtubeUrl(form.videoAfterLink), checklist, completeness, photosBefore: photos, photosBeforeInternal: photosInternal });
  };

  return (
    <div className="mx-auto max-w-4xl">
      <button onClick={onCancel} className="mb-4 flex items-center gap-1 text-sm text-slate-400 hover:text-slate-200"><ChevronLeft className="h-4 w-4" />Kembali</button>
      <h2 className="text-lg font-semibold text-slate-100">Servis Masuk Baru</h2>

      <div className="mt-4">
        <label className="text-xs text-slate-400">Sumber Servis *</label>
        <div className="mt-1 grid grid-cols-2 gap-2">
          <button type="button" onClick={() => setSumberServis('customer')} className={`rounded-lg border px-4 py-2.5 text-sm font-semibold ${sumberServis === 'customer' ? 'border-amber-500 bg-amber-500/10 text-amber-400' : 'border-slate-700 text-slate-300 hover:bg-slate-800'}`}>CUSTOMER</button>
          <button type="button" onClick={() => setSumberServis('tuser')} className={`rounded-lg border px-4 py-2.5 text-sm font-semibold ${sumberServis === 'tuser' ? 'border-amber-500 bg-amber-500/10 text-amber-400' : 'border-slate-700 text-slate-300 hover:bg-slate-800'}`}>TUSER</button>
        </div>
        {!sumberServis && <p className="mt-1.5 text-[11px] text-amber-400">Pilih salah satu dahulu untuk membuka form di bawah.</p>}
      </div>

      <fieldset disabled={!sumberServis} className={!sumberServis ? 'pointer-events-none opacity-50' : ''}>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div>
          <label className="text-xs text-slate-400">Nama Pelanggan *</label>
          <input value={form.customerName} onChange={e => setForm({ ...form, customerName: e.target.value })} className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 outline-none focus:border-amber-500" />
        </div>
        <div>
          <label className="text-xs text-slate-400">No. WhatsApp</label>
          <input value={form.customerPhone} onChange={e => setForm({ ...form, customerPhone: e.target.value })} placeholder="08..." className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 outline-none focus:border-amber-500" />
        </div>
        <div>
          <label className="text-xs text-slate-400">Merek & Tipe HP *</label>
          <input value={form.phoneModel} onChange={e => setForm({ ...form, phoneModel: e.target.value })} placeholder="cth: Samsung A20s" className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 outline-none focus:border-amber-500" />
        </div>
        <div>
          <label className="text-xs text-slate-400">Nomor Segel</label>
          <div className="mt-1 rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-emerald-400">
            Dibuat otomatis saat disimpan
          </div>
          <p className="mt-1 text-[10px] text-slate-500">Contoh: HN82-260817-0001</p>
        </div>
        <div>
          <label className="text-xs text-slate-400">Estimasi Biaya (Rp)</label>
          <input
            type="text"
            inputMode="numeric"
            value={form.biayaEstimasi ? 'Rp' + Number(form.biayaEstimasi).toLocaleString('id-ID') : ''}
            onChange={e => setForm({ ...form, biayaEstimasi: e.target.value.replace(/\D/g, '') })}
            placeholder="Rp0"
            className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 outline-none focus:border-amber-500"
          />
        </div>
        <div><label className="text-xs text-slate-400">IMEI HP</label><input value={form.imei} onChange={e => setForm({ ...form, imei: e.target.value.replace(/\D/g, '').slice(0, 15) })} className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100" /></div>
        <div><label className="text-xs text-slate-400">Sparepart Diganti *</label><input value={form.sparepartReplaced} onChange={e => setForm({ ...form, sparepartReplaced: e.target.value })} className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100" /></div>
        <div>
          <label className="text-xs text-slate-400">Status Pembayaran *</label>
          <select value={form.paymentStatus} onChange={e => setForm({ ...form, paymentStatus: e.target.value, downPayment: e.target.value === 'dp' ? form.downPayment : '' })} className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 outline-none focus:border-amber-500">
            <option value="">— Belum dipilih —</option>
            <option value="cash">Cash (Lunas)</option>
            <option value="dp">DP</option>
            <option value="belum">Belum Bayar</option>
          </select>
        </div>
        {form.paymentStatus === 'dp' && (
          <div>
            <label className="text-xs text-slate-400">Nominal DP (Rp)</label>
            <input
              type="text"
              inputMode="numeric"
              value={form.downPayment ? 'Rp' + Number(form.downPayment).toLocaleString('id-ID') : ''}
              onChange={e => setForm({ ...form, downPayment: e.target.value.replace(/\D/g, '') })}
              placeholder="Rp0"
              className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 outline-none focus:border-amber-500"
            />
            <p className="mt-1 text-[11px] text-amber-400">Sisa: {fmtRupiah(Math.max(0, Number(form.biayaEstimasi || 0) - Number(form.downPayment || 0)))}</p>
          </div>
        )}
      </div>

      <div className="mt-6">
        <label className="text-xs text-slate-400">Keluhan Pelanggan *</label>
        <textarea value={form.keluhan} onChange={e => setForm({ ...form, keluhan: e.target.value })} rows={2} className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 outline-none focus:border-amber-500" />
      </div>

      <h3 className="mt-6 text-sm font-medium text-slate-200">Kunci Layar</h3>
      <div className="mt-2 grid gap-3 sm:grid-cols-2">
        <select value={form.unlockType} onChange={e => setForm({ ...form, unlockType: e.target.value, unlockValue: '' })} className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100">
          <option value="tidak_ada">Tidak ada / tidak diberikan</option><option value="pin">PIN / Kode</option><option value="pola">Pola</option>
        </select>
        {form.unlockType === 'pin' && <input value={form.unlockValue} onChange={e => setForm({ ...form, unlockValue: e.target.value.replace(/\D/g, '') })} placeholder="Masukkan PIN" className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 outline-none focus:border-amber-500" />}
      </div>
      {form.unlockType === 'pola' && (
        <div className="mt-2 inline-block rounded-lg border border-slate-700 bg-slate-900 p-3">
          <p className="mb-1 text-center text-[11px] text-slate-400">Gambar polanya di sini (usap dari titik ke titik)</p>
          <PatternInput value={form.unlockValue} onChange={v => setForm({ ...form, unlockValue: v })} />
        </div>
      )}

      <h3 className="mt-6 text-sm font-medium text-slate-200">Kelengkapan yang Diserahkan</h3>
      <div className="mt-2 grid gap-2 rounded-lg border border-slate-800 p-3 sm:grid-cols-3">
        {COMPLETENESS_ITEMS.map(item => <CompletenessToggle key={item} checked={!!completeness[item]} onChange={v => setCompleteness({ ...completeness, [item]: v })} label={item} />)}
        <input value={form.completenessOther} onChange={e => setForm({ ...form, completenessOther: e.target.value })} placeholder="Lainnya (opsional)" className="sm:col-span-3 rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 outline-none focus:border-amber-500" />
        <input value={form.sim1Brand} onChange={e => setForm({ ...form, sim1Brand: e.target.value })} placeholder="SIM 1 / Merek" className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm" />
        <input value={form.sim2Brand} onChange={e => setForm({ ...form, sim2Brand: e.target.value })} placeholder="SIM 2 / Merek" className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm" />
        <input value={form.mmcSize} onChange={e => setForm({ ...form, mmcSize: e.target.value })} placeholder="Ukuran MMC (GB)" className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm" />
        <input value={form.mmcBrand} onChange={e => setForm({ ...form, mmcBrand: e.target.value })} placeholder="Merek MMC" className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm" />
      </div>

      <h3 className="mt-6 text-sm font-medium text-slate-200">Checklist Kondisi Awal</h3>
      <div className="mt-2 divide-y divide-slate-800 rounded-lg border border-slate-800">
        {CHECKLIST_PARTS.map(part => (
          <div key={part} className="flex flex-wrap items-center gap-2 p-2.5">
            <span className="w-36 text-sm text-slate-300">{part}</span>
            <select value={checklist[part].cond} onChange={e => setChecklist({ ...checklist, [part]: { ...checklist[part], cond: e.target.value } })} className={`rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-xs ${CONDCOLOR[checklist[part].cond]}`}>
              {COND_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
            </select>
            <input value={checklist[part].note} onChange={e => setChecklist({ ...checklist, [part]: { ...checklist[part], note: e.target.value } })} placeholder="catatan (opsional)" className="min-w-[120px] flex-1 rounded-md border border-slate-800 bg-slate-950 px-2 py-1 text-xs text-slate-300 outline-none focus:border-amber-500" />
          </div>
        ))}
      </div>

      <h3 className="mt-6 text-sm font-medium text-slate-200">Foto Kondisi Sebelum Servis *</h3>
      <p className="text-[11px] text-slate-500">Tampil otomatis kepada pelanggan setelah QR dipindai.</p>
      <div className="mt-2 flex flex-wrap gap-2">
        {photos.map((p, i) => (
          <div key={i} className="relative h-20 w-20 overflow-hidden rounded-lg border border-slate-700">
            <img src={p} className="h-full w-full object-cover" />
            <button onClick={() => setPhotos(photos.filter((_, j) => j !== i))} className="absolute right-0.5 top-0.5 rounded-full bg-slate-950/80 p-0.5"><X className="h-3 w-3 text-red-400" /></button>
          </div>
        ))}
        <PhotoAddButtons busy={busy} onFiles={files => handlePhotos(files, setPhotos)} />
      </div>

      <h3 className="mt-6 text-sm font-medium text-slate-200">Foto Kondisi Sebelum Servis (Internal)</h3>
      <p className="text-[11px] text-slate-500">Arsip internal toko saja, tidak tampil ke pelanggan.</p>
      <div className="mt-2 flex flex-wrap gap-2">
        {photosInternal.map((p, i) => (
          <div key={i} className="relative h-20 w-20 overflow-hidden rounded-lg border border-slate-700">
            <img src={p} className="h-full w-full object-cover" />
            <button onClick={() => setPhotosInternal(photosInternal.filter((_, j) => j !== i))} className="absolute right-0.5 top-0.5 rounded-full bg-slate-950/80 p-0.5"><X className="h-3 w-3 text-red-400" /></button>
          </div>
        ))}
        <PhotoAddButtons busy={busy} onFiles={files => handlePhotos(files, setPhotosInternal)} />
      </div>

      <button onClick={submit} className="mt-6 w-full rounded-lg bg-amber-500 py-2.5 text-sm font-semibold text-slate-950 hover:bg-amber-400">Simpan Servis Masuk</button>
      </fieldset>

      {validationError && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4">
          <div className="w-full max-w-sm rounded-xl border border-rose-800 bg-slate-900 p-5 shadow-xl">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 flex-shrink-0 text-rose-500" />
              <p className="text-sm font-semibold text-rose-400">Servis belum bisa disimpan!</p>
            </div>
            <p className="mt-3 text-xs text-slate-400">Mohon lengkapi dulu bagian menu berikut:</p>
            <ul className="mt-2 space-y-1.5">
              {validationError.map((m, i) => (
                <li key={i} className="text-sm font-extrabold uppercase tracking-wide text-red-500">- {m}</li>
              ))}
            </ul>
            <button onClick={() => setValidationError(null)} className="mt-5 w-full rounded-lg bg-amber-500 py-2 text-sm font-semibold text-slate-950 hover:bg-amber-400">Oke</button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ---------- detail tiket ---------- */

// Input angka Rupiah: tampil terformat "Rp1.000" sambil mengetik, tapi baru
// dikirim ke server (onCommit) saat kolom ditinggalkan (blur) — sama seperti
// pola input lain di halaman detail servis ini (menghindari simpan tiap huruf).
function RupiahBlurInput({ defaultValue, onCommit, placeholder = 'Rp0', className }) {
  const [raw, setRaw] = useState(String(defaultValue || '').replace(/\D/g, ''));
  useEffect(() => { setRaw(String(defaultValue || '').replace(/\D/g, '')); }, [defaultValue]);
  return (
    <input
      type="text"
      inputMode="numeric"
      value={raw ? 'Rp' + Number(raw).toLocaleString('id-ID') : ''}
      onChange={e => setRaw(e.target.value.replace(/\D/g, ''))}
      onBlur={() => onCommit(raw)}
      placeholder={placeholder}
      className={className}
    />
  );
}

// Baris kosong "siap isi" untuk sparepart baru — begitu salah satu kolom
// (nama atau harga) diisi lalu ditinggalkan (blur), otomatis tersimpan sebagai
// item baru dan baris ini kembali kosong untuk sparepart berikutnya. Tidak
// perlu tombol "Tambah" sama sekali.
function SparepartDraftRow({ onAdd, initialName = '' }) {
  const [name, setName] = useState(initialName);
  const [rawHarga, setRawHarga] = useState('');
  const commit = () => {
    if (name.trim() || rawHarga) {
      onAdd({ id: uid(), name: name.trim(), harga: rawHarga });
    }
  };
  return (
    <div className="flex flex-wrap gap-2">
      <input
        value={name}
        onChange={e => setName(e.target.value)}
        onBlur={commit}
        placeholder="Nama sparepart"
        className="min-w-[140px] flex-1 rounded-lg border border-dashed border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 outline-none focus:border-amber-500"
      />
      <input
        type="text"
        inputMode="numeric"
        value={rawHarga ? 'Rp' + Number(rawHarga).toLocaleString('id-ID') : ''}
        onChange={e => setRawHarga(e.target.value.replace(/\D/g, ''))}
        onBlur={commit}
        placeholder="Harga modal"
        className="w-28 min-w-[100px] flex-1 rounded-lg border border-dashed border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 outline-none focus:border-amber-500"
      />
      <div className="w-9 flex-shrink-0" />
    </div>
  );
}

function TicketDetail({ ticket, onBack, onUpdate, onDelete, staff, portalUrl, toko, hapusSetting }) {
  const [tab, setTab] = useState('info');
  const [showSig, setShowSig] = useState(false);
  const [noteText, setNoteText] = useState('');
  const [busy, setBusy] = useState(false);
  const [printMode, setPrintMode] = useState(null); // null | 'invoice' | 'label'
  const [previewPhoto, setPreviewPhoto] = useState(null);

  const log = (action) => ({ at: Date.now(), by: staff || 'Staff', action });

  const patch = (fields, action) => {
    onUpdate({ ...ticket, ...fields, auditLog: [...(ticket.auditLog || []), log(action)] });
  };

  const setStatus = (key) => {
    if (key === 'gagal') {
      const reason = window.prompt('Keterangan alasan gagal servis (wajib diisi):', ticket.gagalReason || '');
      if (reason === null) return; // batal, status tidak diubah
      if (!reason.trim()) return alert('Keterangan alasan gagal servis wajib diisi.');
      patch({ status: key, gagalReason: reason.trim() }, `Status diubah menjadi "Gagal Servis" — ${reason.trim()}`);
      return;
    }
    if (key === 'diambil') {
      patch({ status: key, diambilAt: Date.now() }, `Status diubah menjadi "${statusInfo(key).label}"`);
      return;
    }
    patch({ status: key }, `Status diubah menjadi "${statusInfo(key).label}"`);
  };

  const addPhotos = async (files, field) => {
    setBusy(true);
    const arr = [];
    for (const f of Array.from(files)) { try { arr.push(await compressImage(f)); } catch (e) {} }
    patch({ [field]: [...(ticket[field] || []), ...arr] }, field === 'photosBefore' ? 'Menambah foto sebelum servis' : field === 'photosBeforeInternal' ? 'Menambah foto internal sebelum servis' : field === 'photosProses' ? 'Menambah foto proses pengerjaan' : field === 'photosSesudah' ? 'Menambah foto sesudah servis' : 'Menambah dokumen');
    setBusy(false);
  };

  const removePhoto = (field, idx) => {
    const arr = (ticket[field] || []).filter((_, i) => i !== idx);
    patch({ [field]: arr }, 'Menghapus foto');
  };

  const addNote = () => {
    if (!noteText.trim()) return;
    patch({ notes: [...(ticket.notes || []), { text: noteText, by: staff || 'Staff', at: Date.now() }] }, 'Menambah catatan');
    setNoteText('');
  };

  const waLink = () => {
    const s = statusInfo(ticket.status);
    let msg;
    if (ticket.status === 'selesai') {
      const jam = new Date().getHours();
      const salam = jam < 11 ? 'pagi' : jam < 15 ? 'siang' : jam < 18 ? 'sore' : 'malam';
      const biaya = ticket.biayaFinal || ticket.biayaEstimasi;
      msg = `Selamat ${salam} bapak/ibu ${ticket.customerName} 🙏\nServis ${ticket.phoneModel} sudah selesai dan sudah bisa diambil ya, Pak.\nBiaya servis ${fmtRupiah(biaya)}.\nWajib membawa nota servis saat pengambilan.\nTerima kasih 🙏`;
    } else {
      msg = `Halo ${ticket.customerName}, update servis ${ticket.phoneModel} (segel #${ticket.segelNumber || '-'}): status saat ini *${s.label}*.` + (ticket.biayaEstimasi ? ` Estimasi biaya ${fmtRupiah(ticket.biayaEstimasi)}.` : '');
    }
    const phone = (ticket.customerPhone || '').replace(/[^0-9]/g, '').replace(/^0/, '62');
    return `https://wa.me/${phone}?text=${encodeURIComponent(msg)}`;
  };

  const trackUrl = `${portalUrl || import.meta.env.VITE_PUBLIC_APP_URL || (window.location.origin + window.location.pathname)}?track=${ticket.publicToken || ticket.id}`;
  const qrSrc = `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(trackUrl)}`;

  const tabs = [
    { key: 'info', label: 'Info & Checklist', icon: FileText },
    { key: 'foto', label: 'Foto & Dokumen', icon: ImageIcon },
    { key: 'proses', label: 'Status & Biaya', icon: Wrench },
    { key: 'komunikasi', label: 'Pelanggan', icon: MessageCircle },
    { key: 'log', label: 'Audit Log', icon: History },
  ];

  return (
    <div className="mx-auto max-w-5xl">
      <div className="flex items-center justify-between">
        <button onClick={onBack} className="flex items-center gap-1 text-sm text-slate-400 hover:text-slate-200"><ChevronLeft className="h-4 w-4" />Kembali</button>
        <button onClick={() => {
          if (hapusSetting?.enabled) {
            const pin = window.prompt('Masukkan kode kunci untuk menghapus servis ini:');
            if (pin === null) return;
            if (pin !== HAPUS_PIN && pin !== (hapusSetting.pin || '')) return alert('Kode kunci salah. Servis tidak dihapus.');
          }
          if (confirm('Hapus tiket servis ini?')) onDelete(ticket.id);
        }} className="flex items-center gap-1 text-xs text-red-400 hover:text-red-300"><Trash2 className="h-3.5 w-3.5" />Hapus</button>
      </div>

      <div className="mt-3 flex flex-wrap items-start justify-between gap-2 rounded-xl border border-slate-800 bg-slate-900/60 p-4"
        style={{ borderLeftStyle: 'dashed', borderLeftWidth: 3 }}>
        <div>
          <p className="font-mono text-xs text-amber-400">SEGEL #{ticket.segelNumber || '—'}</p>
          <h2 className="text-lg font-semibold text-slate-100">{ticket.phoneModel}</h2>
          <p className="text-sm text-slate-400">{ticket.customerName} · {ticket.customerPhone || 'tanpa no. HP'}</p>
        </div>
        <Badge statusKey={ticket.status} />
      </div>

      {ticket.status === 'gagal' && (
        <div className="mt-2 flex items-start gap-2 rounded-lg border border-rose-800/60 bg-rose-950/30 px-3 py-2 text-sm text-rose-300">
          <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" />
          <div><span className="font-medium">Gagal Servis:</span> {ticket.gagalReason || 'Belum ada keterangan — isi di tab Status & Biaya.'}</div>
        </div>
      )}

      <div className="mt-4 flex flex-wrap gap-1 border-b border-slate-800">
        {tabs.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)} className={`flex items-center gap-1.5 whitespace-nowrap border-b-2 px-3 py-2 text-sm ${tab === t.key ? 'border-amber-500 text-amber-400' : 'border-transparent text-slate-400 hover:text-slate-200'}`}>
            <t.icon className="h-3.5 w-3.5" />{t.label}
          </button>
        ))}
      </div>

      <div className="py-4">
        {tab === 'info' && (
          <div className="space-y-4">
            {ticket.keluhan ? <div><p className="text-xs text-slate-400">Keluhan</p><p className="text-sm text-slate-200">{ticket.keluhan}</p></div> : null}
            <div>
              <p className="mb-2 text-xs text-slate-400">Checklist Kondisi Awal</p>
              <div className="divide-y divide-slate-800 rounded-lg border border-slate-800">
                {CHECKLIST_PARTS.map(part => {
                  const c = (ticket.checklist || {})[part] || { cond: '-', note: '' };
                  return (
                    <div key={part} className="flex items-center justify-between p-2.5 text-sm">
                      <span className="text-slate-300">{part}</span>
                      <span className="flex items-center gap-2">
                        {c.note ? <span className="text-xs text-slate-500">{c.note}</span> : null}
                        <span className={`text-xs font-medium ${CONDCOLOR[c.cond] || 'text-slate-500'}`}>{c.cond}</span>
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
            {ticket.signature ? (
              <div>
                <p className="mb-1 text-xs text-slate-400">Tanda Tangan Persetujuan</p>
                <img src={ticket.signature} className="h-28 rounded-lg border border-slate-800 bg-slate-950" />
              </div>
            ) : (
              <button onClick={() => setShowSig(true)} className="flex items-center gap-1.5 rounded-lg border border-slate-700 px-3 py-2 text-sm text-slate-300 hover:bg-slate-800"><PenTool className="h-4 w-4" />Ambil Tanda Tangan Persetujuan</button>
            )}
            {showSig && <div className="mt-2"><SignaturePad onCancel={() => setShowSig(false)} onSave={(d) => { patch({ signature: d }, 'Tanda tangan persetujuan disimpan'); setShowSig(false); }} /></div>}
            <div className="grid gap-3 rounded-xl border border-slate-800 p-3 sm:grid-cols-2">
              <div><p className="mb-2 text-xs text-slate-400">Kelengkapan</p><div className="space-y-1.5">{COMPLETENESS_ITEMS.map(item => <CompletenessToggle key={item} checked={!!ticket.completeness?.[item]} onChange={v => patch({ completeness: { ...(ticket.completeness || {}), [item]: v } }, 'Kelengkapan diperbarui')} label={item} />)}</div><input defaultValue={ticket.completenessOther || ''} onBlur={e => patch({ completenessOther: e.target.value }, 'Kelengkapan lain diperbarui')} placeholder="Kelengkapan lainnya" className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-900 px-2 py-1.5 text-sm text-slate-100" /></div>
              <div><p className="mb-2 text-xs text-slate-400">Kunci layar</p><select value={ticket.unlockType || 'tidak_ada'} onChange={e => patch({ unlockType: e.target.value, unlockValue: '' }, 'Jenis kunci layar diperbarui')} className="w-full rounded-lg border border-slate-700 bg-slate-900 px-2 py-2 text-sm text-slate-100"><option value="tidak_ada">Tidak ada</option><option value="pin">PIN / Kode</option><option value="pola">Pola</option></select>{(ticket.unlockType || 'tidak_ada') === 'pin' && <input defaultValue={ticket.unlockValue || ''} onBlur={e => patch({ unlockValue: e.target.value.replace(/\D/g, '') }, 'Kunci layar diperbarui')} placeholder="PIN / kode" className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-900 px-2 py-2 text-sm text-slate-100" />}{ticket.unlockType === 'pola' && <div className="mt-2 rounded-lg border border-slate-700 bg-slate-900 p-2"><p className="mb-1 text-center text-[11px] text-slate-400">Gambar polanya (usap titik ke titik)</p><PatternInput value={ticket.unlockValue || ''} onChange={v => patch({ unlockValue: v }, 'Pola kunci layar diperbarui')} /></div>}</div>
            </div>
            <div className="flex flex-wrap gap-2"><button onClick={() => setPrintMode('invoice')} className="flex items-center gap-1.5 rounded-lg bg-amber-500 px-3 py-2 text-sm font-semibold text-slate-950 hover:bg-amber-400"><Printer className="h-4 w-4" />Cetak Nota Lengkap + QR</button><button onClick={() => setPrintMode('label')} className="flex items-center gap-1.5 rounded-lg border border-slate-700 px-3 py-2 text-sm text-slate-300 hover:bg-slate-800"><FileText className="h-4 w-4" />Cetak Nota Komplain/Garansi</button><button onClick={() => setPrintMode('thermal')} className="flex items-center gap-1.5 rounded-lg border border-slate-700 px-3 py-2 text-sm text-slate-300 hover:bg-slate-800"><Tag className="h-4 w-4" />Cetak Label Thermal 40×20mm</button></div>
          </div>
        )}

        {tab === 'foto' && (
          <div className="space-y-6">
            {[['photosBefore', 'Foto Saat Diterima'], ['photosBeforeInternal', 'Foto Kondisi Sebelum Servis (Internal - tidak tampil ke pelanggan)'], ['photosProses', 'Foto Saat Proses Pengerjaan'], ['photosSesudah', 'Foto Setelah Servis Selesai'], ['documents', 'Dokumen Internal (tidak tampil ke pelanggan)']].map(([field, label]) => (
              <div key={field}>
                <p className="mb-2 text-xs text-slate-400">{label}</p>
                <div className="flex flex-wrap gap-2">
                  {(ticket[field] || []).map((p, i) => (
                    <div key={i} className="relative h-20 w-20 overflow-hidden rounded-lg border border-slate-700">
                      <img src={p} onClick={() => setPreviewPhoto(p)} className="h-full w-full cursor-pointer object-cover" />
                      <button onClick={() => removePhoto(field, i)} className="absolute right-0.5 top-0.5 rounded-full bg-slate-950/80 p-0.5"><X className="h-3 w-3 text-red-400" /></button>
                    </div>
                  ))}
                  <PhotoAddButtons busy={busy} onFiles={files => addPhotos(files, field)} />
                </div>
              </div>
            ))}
            {[['videoBeforeLink', 'Video Saat Diterima / Dibongkar', true], ['videoProsesLink', 'Video Saat Proses Pengerjaan', false], ['videoAfterLink', 'Video Setelah Servis Selesai', true]].map(([field, label, publicVisible]) => (
              <div key={field}>
                <p className="mb-2 text-xs text-slate-400">{label}</p>
                <div className="flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-900 px-3 py-2">
                  <Video className="h-4 w-4 text-red-400" />
                  <input type="url" defaultValue={ticket[field] || ''} onBlur={e => { const value = youtubeUrl(e.target.value); if (e.target.value.trim() && !value) return alert('Link YouTube tidak valid.'); patch({ [field]: value }, `${label} diperbarui`); }} placeholder="Tempel link https://youtu.be/..." className="min-w-0 flex-1 bg-transparent text-sm text-slate-100 outline-none" />
                </div>
                <p className="mt-1 text-[10px] text-slate-500">{publicVisible ? 'Tampil otomatis kepada pelanggan setelah QR dipindai.' : 'Hanya untuk arsip internal, belum tampil di halaman pelanggan.'}</p>
              </div>
            ))}
          </div>
        )}

        {tab === 'proses' && (
          <div className="space-y-5">
            <div>
              <p className="mb-2 text-xs text-slate-400">Ubah Status Servis</p>
              <div className="flex flex-wrap gap-2">
                {STATUS.map(s => (
                  <button key={s.key} onClick={() => setStatus(s.key)} className={`rounded-full px-3 py-1.5 text-xs font-medium ring-1 ${ticket.status === s.key ? `${s.color} text-slate-950` : `${s.ring} ${s.text} bg-slate-900/60`}`}>{s.label}</button>
                ))}
              </div>
            </div>
            {ticket.status === 'gagal' && (
              <div className="rounded-lg border border-rose-800/60 bg-rose-950/30 p-3">
                <label className="flex items-center gap-1.5 text-xs font-medium text-rose-300"><AlertTriangle className="h-3.5 w-3.5" />Keterangan Gagal Servis</label>
                <textarea defaultValue={ticket.gagalReason || ''} onBlur={e => { if (!e.target.value.trim()) return alert('Keterangan alasan gagal servis wajib diisi.'); patch({ gagalReason: e.target.value.trim() }, 'Keterangan gagal servis diperbarui'); }} rows={2} className="mt-1.5 w-full rounded-lg border border-rose-800/60 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none focus:border-rose-500" />
              </div>
            )}
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="text-xs text-slate-400">Estimasi Biaya (Rp)</label>
                <RupiahBlurInput defaultValue={ticket.biayaEstimasi} onCommit={v => patch({ biayaEstimasi: v }, 'Estimasi biaya diperbarui')} className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 outline-none focus:border-amber-500" />
              </div>
              <div>
                <label className="text-xs text-slate-400">Biaya Final (Rp)</label>
                <RupiahBlurInput defaultValue={ticket.biayaFinal} onCommit={v => patch({ biayaFinal: v }, 'Biaya final diperbarui')} className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 outline-none focus:border-amber-500" />
              </div>
              <div><label className="text-xs text-slate-400">Teknisi</label>
                <input defaultValue={ticket.teknisi} onBlur={e => patch({ teknisi: e.target.value }, 'Teknisi ditugaskan')} className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 outline-none focus:border-amber-500" />
              </div>
              <label className="mt-1 flex items-center gap-2 text-sm text-slate-300">
                <input type="checkbox" checked={!!ticket.dibayar} onChange={e => { const checked = e.target.checked; patch({ dibayar: checked, dibayarAt: checked ? Date.now() : null }, checked ? 'Ditandai sudah dibayar' : 'Ditandai belum dibayar'); }} className="h-4 w-4 accent-amber-500" />
                Sudah dibayar
              </label>
            </div>

            <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
              <p className="mb-3 flex items-center gap-1.5 text-xs text-slate-400"><DollarSign className="h-3.5 w-3.5" />Rincian Modal & Laba Bersih</p>

              <div>
                <label className="text-xs text-slate-400">Harga Servis / Jasa (Rp)</label>
                <RupiahBlurInput defaultValue={ticket.jasaBiaya} onCommit={v => patch({ jasaBiaya: v }, 'Harga servis/jasa diperbarui')} className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 outline-none focus:border-amber-500" />
              </div>

              <div className="mt-4">
                <p className="mb-2 text-xs text-slate-400">Sparepart (Modal)</p>
                <div className="space-y-2">
                  {(ticket.sparepartList || []).map((item, i) => (
                    <div key={item.id || i} className="flex flex-wrap gap-2">
                      <input
                        defaultValue={item.name}
                        onBlur={e => { const list = (ticket.sparepartList || []).map((it, j) => j === i ? { ...it, name: e.target.value } : it); patch({ sparepartList: list }, 'Nama sparepart diperbarui'); }}
                        placeholder="Nama sparepart"
                        className="min-w-[140px] flex-1 rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 outline-none focus:border-amber-500"
                      />
                      <RupiahBlurInput
                        defaultValue={item.harga}
                        onCommit={v => { const list = (ticket.sparepartList || []).map((it, j) => j === i ? { ...it, harga: v } : it); patch({ sparepartList: list }, 'Harga modal sparepart diperbarui'); }}
                        placeholder="Harga modal"
                        className="w-28 min-w-[100px] flex-1 rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 outline-none focus:border-amber-500"
                      />
                      <button onClick={() => { const list = (ticket.sparepartList || []).filter((_, j) => j !== i); patch({ sparepartList: list }, 'Sparepart dihapus'); }} className="flex-shrink-0 rounded-lg border border-slate-700 px-2 text-slate-400 hover:bg-slate-800 hover:text-red-400"><X className="h-4 w-4" /></button>
                    </div>
                  ))}
                  <SparepartDraftRow
                    key={(ticket.sparepartList || []).length}
                    initialName={(ticket.sparepartList || []).length === 0 ? (ticket.sparepartReplaced || '') : ''}
                    onAdd={(item) => patch({ sparepartList: [...(ticket.sparepartList || []), item] }, 'Sparepart ditambahkan')}
                  />
                </div>
              </div>

              {(() => {
                const modalSparepart = (ticket.sparepartList || []).reduce((s, it) => s + Number(it.harga || 0), 0);
                const totalDibayar = Number(ticket.biayaFinal || ticket.biayaEstimasi || 0);
                const labaBersih = totalDibayar - modalSparepart;
                return (
                  <div className="mt-4 rounded-lg border border-slate-800 bg-slate-950 p-3 text-sm">
                    <div className="flex justify-between"><span className="text-slate-400">Harga Servis / Jasa</span><span className="text-slate-200">{fmtRupiah(ticket.jasaBiaya)}</span></div>
                    {(ticket.sparepartList || []).filter(it => it.name || it.harga).length > 0 && (
                      <div className="mt-2 space-y-0.5 border-t border-slate-800 pt-2">
                        {(ticket.sparepartList || []).filter(it => it.name || it.harga).map((it, i) => (
                          <div key={it.id || i} className="flex justify-between text-xs text-slate-400"><span>{it.name || '(tanpa nama)'}</span><span>{fmtRupiah(it.harga)}</span></div>
                        ))}
                      </div>
                    )}
                    <div className="mt-2 flex justify-between border-t border-slate-800 pt-2"><span className="text-slate-400">Modal Sparepart</span><span className="text-slate-200">{fmtRupiah(modalSparepart)}</span></div>
                    <div className="mt-1 flex justify-between border-t border-slate-800 pt-2"><span className="text-slate-400">Total Dibayar</span><span className="font-semibold text-slate-100">{fmtRupiah(totalDibayar)}</span></div>
                    <div className="mt-1 flex justify-between"><span className="font-medium text-slate-300">Laba Bersih</span><span className={`text-base font-bold ${labaBersih >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>{fmtRupiah(labaBersih)}</span></div>
                  </div>
                );
              })()}
            </div>

            <button onClick={() => setPrintMode('invoice')} className="flex items-center gap-1.5 rounded-lg bg-amber-500 px-3 py-2 text-sm font-semibold text-slate-950 hover:bg-amber-400"><Printer className="h-4 w-4" />Cetak Nota Lengkap + QR</button>
            <div>
              <p className="mb-2 text-xs text-slate-400">Catatan Internal</p>
              <div className="mb-2 space-y-2">
                {(ticket.notes || []).slice().reverse().map((n, i) => (
                  <div key={i} className="rounded-lg border border-slate-800 bg-slate-900/60 p-2 text-sm">
                    <p className="text-slate-200">{n.text}</p>
                    <p className="mt-0.5 text-[11px] text-slate-500">{n.by} · {fmtDate(n.at)}</p>
                  </div>
                ))}
              </div>
              <div className="flex gap-2">
                <input value={noteText} onChange={e => setNoteText(e.target.value)} placeholder="Tulis catatan..." className="flex-1 rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 outline-none focus:border-amber-500" />
                <button onClick={addNote} className="rounded-lg bg-slate-800 px-3 text-sm text-slate-200 hover:bg-slate-700">Tambah</button>
              </div>
            </div>
          </div>
        )}

        {tab === 'komunikasi' && (
          <div className="space-y-5">
            <a href={waLink()} target="_blank" rel="noreferrer" className="flex items-center justify-center gap-2 rounded-lg bg-emerald-600 py-2.5 text-sm font-medium text-white hover:bg-emerald-500">
              <MessageCircle className="h-4 w-4" />Kirim Update Status via WhatsApp
            </a>
            <p className="text-center text-xs text-slate-500">Pesan otomatis disiapkan, Anda tetap perlu menekan kirim di WhatsApp.</p>

            <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 text-center">
              <p className="mb-2 flex items-center justify-center gap-1.5 text-xs text-slate-400"><QrCode className="h-3.5 w-3.5" />QR Lacak Status untuk Pelanggan</p>
              <img src={qrSrc} alt="QR lacak status" className="mx-auto h-36 w-36 rounded-lg bg-white p-1" />
              <p className="mt-2 break-all font-mono text-[11px] text-slate-500">{trackUrl}</p>
              <p className="mt-2 text-[11px] text-amber-400/80">Agar bisa dibuka pelanggan dari luar, aplikasi ini perlu di-hosting sendiri (lihat catatan di bawah aplikasi).</p>
            </div>
          </div>
        )}

        {tab === 'log' && (
          <div className="space-y-2">
            {(ticket.auditLog || []).slice().reverse().map((l, i) => (
              <div key={i} className="flex items-start gap-2 rounded-lg border border-slate-800 bg-slate-900/60 p-2.5 text-sm">
                <History className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-slate-500" />
                <div>
                  <p className="text-slate-200">{l.action}</p>
                  <p className="text-[11px] text-slate-500">{l.by} · {fmtDate(l.at)}</p>
                </div>
              </div>
            ))}
            {!(ticket.auditLog || []).length && <p className="text-sm text-slate-500">Belum ada aktivitas tercatat.</p>}
          </div>
        )}
      </div>

      {previewPhoto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/90 p-4" onClick={() => setPreviewPhoto(null)}>
          <button onClick={() => setPreviewPhoto(null)} className="absolute right-4 top-4 rounded-full bg-slate-800 p-2 text-slate-200 hover:bg-slate-700"><X className="h-5 w-5" /></button>
          <img src={previewPhoto} className="max-h-full max-w-full rounded-lg object-contain" onClick={e => e.stopPropagation()} />
        </div>
      )}

      {printMode === 'invoice' && <PrintOverlay onClose={() => setPrintMode(null)}><InvoiceView ticket={ticket} toko={toko} trackUrl={trackUrl} qrSrc={qrSrc} /></PrintOverlay>}
      {printMode === 'label' && <PrintOverlay onClose={() => setPrintMode(null)}><LabelView ticket={ticket} toko={toko} trackUrl={trackUrl} qrSrc={qrSrc} /></PrintOverlay>}
      {printMode === 'thermal' && <ThermalPrintOverlay onClose={() => setPrintMode(null)}><ThermalLabelView ticket={ticket} toko={toko} /></ThermalPrintOverlay>}
    </div>
  );
}

/* ---------- kas / pembukuan ---------- */

/* ---------- laporan keuntungan (harian / bulanan / tahunan) ---------- */

function LaporanView({ tickets }) {
  const [mode, setMode] = useState('harian');
  const [expanded, setExpanded] = useState(() => new Set());

  const paid = tickets.filter(t => t.status === 'diambil');
  const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
  const paidSinceToday = paid.filter(t => (t.diambilAt || t.dibayarAt || t.createdAt) >= todayStart.getTime());
  const totalKeuntunganSemua = paidSinceToday.reduce((s, t) => {
    const omset = Number(t.biayaFinal || t.biayaEstimasi || 0);
    const modal = (t.sparepartList || []).reduce((s2, it) => s2 + Number(it.harga || 0), 0);
    return s + (omset - modal);
  }, 0);

  const groups = {};
  for (const t of paid) {
    const d = new Date(t.diambilAt || t.dibayarAt || t.createdAt);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    // Laporan Harian sengaja tidak menampilkan bulan Agustus 2026 (permintaan
    // pemilik toko). Ini hanya menyembunyikan dari tampilan laporan — data
    // servis aslinya tetap utuh, tidak terhapus.
    if (mode === 'harian' && `${yyyy}-${mm}` === '2026-08') continue;
    const key = mode === 'harian' ? `${yyyy}-${mm}-${dd}` : mode === 'bulanan' ? `${yyyy}-${mm}` : `${yyyy}`;
    const omset = Number(t.biayaFinal || t.biayaEstimasi || 0);
    const modal = (t.sparepartList || []).reduce((s2, it) => s2 + Number(it.harga || 0), 0);
    if (!groups[key]) groups[key] = { omset: 0, modal: 0, laba: 0, count: 0, tickets: [] };
    groups[key].omset += omset;
    groups[key].modal += modal;
    groups[key].laba += (omset - modal);
    groups[key].count += 1;
    groups[key].tickets.push(t);
  }

  const rows = Object.entries(groups).sort((a, b) => b[0].localeCompare(a[0]));

  const labelFor = (key) => {
    if (mode === 'harian') {
      const [y, m, d] = key.split('-').map(Number);
      return new Date(y, m - 1, d).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
    }
    if (mode === 'bulanan') {
      const [y, m] = key.split('-').map(Number);
      return new Date(y, m - 1, 1).toLocaleDateString('id-ID', { month: 'long', year: 'numeric' });
    }
    return key;
  };

  const toggle = (key) => {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };

  return (
    <div>
      <h1 className="text-lg font-semibold">Laporan Keuntungan</h1>

      <div className="mt-3 rounded-xl border border-amber-700/40 bg-amber-950/20 p-4">
        <p className="text-xs text-amber-400/80">Total Keuntungan Hari Ini</p>
        <p className={`mt-1 text-2xl font-bold ${totalKeuntunganSemua >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>{fmtRupiah(totalKeuntunganSemua)}</p>
        <p className="mt-0.5 text-[11px] text-slate-500">Dari {paidSinceToday.length} servis yang sudah diambil hari ini (Total Dibayar − Modal Sparepart)</p>
      </div>

      <div className="mt-4 flex gap-1 border-b border-slate-800">
        {[['harian', 'Harian'], ['bulanan', 'Bulanan'], ['tahunan', 'Tahunan']].map(([key, label]) => (
          <button key={key} onClick={() => setMode(key)} className={`border-b-2 px-3 py-2 text-sm font-medium ${mode === key ? 'border-amber-500 text-amber-400' : 'border-transparent text-slate-400 hover:text-slate-200'}`}>{label}</button>
        ))}
      </div>

      <div className="mt-4 space-y-2">
        {rows.map(([key, g]) => (
          <div key={key} className="rounded-lg border border-slate-800 bg-slate-900/50 p-3">
            <button onClick={() => toggle(key)} className="flex w-full items-center justify-between text-left">
              <p className="text-sm font-medium text-slate-200">{labelFor(key)}</p>
              <span className="flex items-center gap-2 text-[11px] text-slate-500">{g.count} servis <ChevronLeft className={`h-3.5 w-3.5 transition-transform ${expanded.has(key) ? '-rotate-90' : 'rotate-180'}`} /></span>
            </button>
            <div className="mt-2 grid grid-cols-3 gap-2 text-xs">
              <div><p className="text-slate-500">Omset</p><p className="font-medium text-slate-200">{fmtRupiah(g.omset)}</p></div>
              <div><p className="text-slate-500">Modal</p><p className="font-medium text-slate-200">{fmtRupiah(g.modal)}</p></div>
              <div><p className="text-slate-500">Laba Bersih</p><p className={`font-semibold ${g.laba >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>{fmtRupiah(g.laba)}</p></div>
            </div>

            {expanded.has(key) && (
              <div className="mt-3 space-y-2 border-t border-slate-800 pt-3">
                {g.tickets.slice().sort((a, b) => a.createdAt - b.createdAt).map(t => {
                  const omset = Number(t.biayaFinal || t.biayaEstimasi || 0);
                  const modal = (t.sparepartList || []).reduce((s2, it) => s2 + Number(it.harga || 0), 0);
                  const laba = omset - modal;
                  return (
                    <div key={t.id} className="rounded-md border border-slate-800 bg-slate-950/60 p-2.5">
                      <p className="font-mono text-[11px] text-amber-400">#{t.segelNumber || '—'}</p>
                      <p className="text-sm font-medium text-slate-200">{t.phoneModel}</p>
                      <p className="text-[11px] text-slate-500">{t.customerName} · {fmtDate(t.diambilAt || t.dibayarAt || t.createdAt)}</p>
                      <div className="mt-1.5 grid grid-cols-3 gap-2 text-[11px]">
                        <div><p className="text-slate-500">Total</p><p className="font-medium text-slate-200">{fmtRupiah(omset)}</p></div>
                        <div><p className="text-slate-500">Modal Sparepart</p><p className="font-medium text-slate-200">{fmtRupiah(modal)}</p></div>
                        <div><p className="text-slate-500">Laba Bersih</p><p className={`font-semibold ${laba >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>{fmtRupiah(laba)}</p></div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ))}
        {!rows.length && <p className="py-10 text-center text-sm text-slate-500">Belum ada servis yang sudah dibayar untuk direkap.</p>}
      </div>
    </div>
  );
}

function KasView({ kas, onAdd, onDelete }) {
  const [type, setType] = useState('masuk');
  const [amount, setAmount] = useState('');
  const [desc, setDesc] = useState('');

  const total = kas.reduce((sum, k) => sum + (k.type === 'masuk' ? Number(k.amount) : -Number(k.amount)), 0);
  const masuk = kas.filter(k => k.type === 'masuk').reduce((s, k) => s + Number(k.amount), 0);
  const keluar = kas.filter(k => k.type === 'keluar').reduce((s, k) => s + Number(k.amount), 0);

  const submit = () => {
    if (!amount || !desc.trim()) return;
    onAdd({ id: uid(), type, amount, desc, at: Date.now() });
    setAmount(''); setDesc('');
  };

  return (
    <div className="mx-auto max-w-4xl">
      <h2 className="text-lg font-semibold text-slate-100">Pembukuan Kas</h2>
      <div className="mt-3 grid grid-cols-3 gap-2">
        <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-3"><p className="text-[11px] text-slate-400">Pemasukan</p><p className="text-sm font-semibold text-emerald-400">{fmtRupiah(masuk)}</p></div>
        <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-3"><p className="text-[11px] text-slate-400">Pengeluaran</p><p className="text-sm font-semibold text-red-400">{fmtRupiah(keluar)}</p></div>
        <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-3"><p className="text-[11px] text-slate-400">Saldo</p><p className="text-sm font-semibold text-slate-100">{fmtRupiah(total)}</p></div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2 rounded-xl border border-slate-800 bg-slate-900/60 p-3">
        <select value={type} onChange={e => setType(e.target.value)} className="rounded-lg border border-slate-700 bg-slate-900 px-2 py-2 text-sm text-slate-200">
          <option value="masuk">Pemasukan</option>
          <option value="keluar">Pengeluaran</option>
        </select>
        <input
          type="text"
          inputMode="numeric"
          value={amount ? 'Rp' + Number(amount).toLocaleString('id-ID') : ''}
          onChange={e => setAmount(e.target.value.replace(/\D/g, ''))}
          placeholder="Rp0"
          className="w-32 rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 outline-none focus:border-amber-500"
        />
        <input value={desc} onChange={e => setDesc(e.target.value)} placeholder="Keterangan" className="flex-1 min-w-[140px] rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 outline-none focus:border-amber-500" />
        <button onClick={submit} className="rounded-lg bg-amber-500 px-4 py-2 text-sm font-medium text-slate-950 hover:bg-amber-400">Catat</button>
      </div>

      <div className="mt-4 space-y-1.5">
        {kas.slice().reverse().map(k => (
          <div key={k.id} className="flex items-center justify-between rounded-lg border border-slate-800 bg-slate-900/40 p-2.5 text-sm">
            <div>
              <p className="text-slate-200">{k.desc}</p>
              <p className="text-[11px] text-slate-500">{fmtDate(k.at)}</p>
            </div>
            <div className="flex items-center gap-3">
              <span className={k.type === 'masuk' ? 'text-emerald-400' : 'text-red-400'}>{k.type === 'masuk' ? '+' : '-'}{fmtRupiah(k.amount)}</span>
              <button onClick={() => onDelete(k.id)}><Trash2 className="h-3.5 w-3.5 text-slate-500 hover:text-red-400" /></button>
            </div>
          </div>
        ))}
        {!kas.length && <p className="text-sm text-slate-500">Belum ada transaksi.</p>}
      </div>
    </div>
  );
}

/* ---------- dashboard statistik ---------- */

const PIE_COLORS = { diterima: '#0ea5e9', dicek: '#f59e0b', proses: '#fb923c', selesai: '#10b981', diambil: '#64748b', gagal: '#e11d48', komplain: '#c026d3', komplain_selesai: '#14b8a6' };

function Dashboard({ tickets, kas, toko, onSaveToko, hapusSetting, onSaveHapusSetting }) {
  const now = new Date();
  const inMonth = (ts) => { const d = new Date(ts); return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear(); };

  const total = tickets.length;
  const dalamProses = tickets.filter(t => t.status === 'dicek' || t.status === 'proses').length;
  const siapDiambil = tickets.filter(t => t.status === 'selesai').length;
  const pendapatanBulanIni = tickets.filter(t => t.status === 'diambil' && inMonth(t.diambilAt || t.dibayarAt || t.createdAt)).reduce((s, t) => s + Number(t.biayaFinal || t.biayaEstimasi || 0), 0)
    + kas.filter(k => k.type === 'masuk' && inMonth(k.at)).reduce((s, k) => s + Number(k.amount), 0);
  const modalSparepartBulanIni = tickets.filter(t => t.status === 'diambil' && inMonth(t.diambilAt || t.dibayarAt || t.createdAt)).reduce((s, t) => s + (t.sparepartList || []).reduce((s2, it) => s2 + Number(it.harga || 0), 0), 0);
  const labaBersihBulanIni = pendapatanBulanIni - modalSparepartBulanIni;

  const pieData = STATUS.map(s => ({ name: s.label, key: s.key, value: tickets.filter(t => t.status === s.key).length })).filter(d => d.value > 0);

  const [tokoForm, setTokoForm] = useState(toko);
  useEffect(() => setTokoForm(toko), [toko]);

  const [hapusForm, setHapusForm] = useState(hapusSetting);
  const [showPin, setShowPin] = useState(false);
  const [ownerUnlocked, setOwnerUnlocked] = useState(false);
  useEffect(() => setHapusForm(hapusSetting), [hapusSetting]);

  return (
    <div>
      <h1 className="text-lg font-semibold">Dashboard</h1>
      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-3.5">
          <p className="flex items-center gap-1.5 text-[11px] text-slate-400"><ListChecks className="h-3.5 w-3.5" />Total Servis</p>
          <p className="mt-1 text-xl font-semibold text-slate-100">{total}</p>
        </div>
        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-3.5">
          <p className="flex items-center gap-1.5 text-[11px] text-slate-400"><Wrench className="h-3.5 w-3.5" />Dalam Proses</p>
          <p className="mt-1 text-xl font-semibold text-amber-400">{dalamProses}</p>
        </div>
        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-3.5">
          <p className="flex items-center gap-1.5 text-[11px] text-slate-400"><CheckCircle className="h-3.5 w-3.5" />Siap Diambil</p>
          <p className="mt-1 text-xl font-semibold text-emerald-400">{siapDiambil}</p>
        </div>
        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-3.5">
          <p className="flex items-center gap-1.5 text-[11px] text-slate-400"><TrendingUp className="h-3.5 w-3.5" />Omset Bulan Ini</p>
          <p className="mt-1 text-xl font-semibold text-slate-100">{fmtRupiah(pendapatanBulanIni)}</p>
          <p className="mt-1.5 flex items-center gap-1.5 text-[11px] text-slate-400"><DollarSign className="h-3 w-3" />Laba Bersih</p>
          <p className={`text-sm font-semibold ${labaBersihBulanIni >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>{fmtRupiah(labaBersihBulanIni)}</p>
        </div>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
          <p className="mb-2 text-xs text-slate-400">Distribusi Status Servis</p>
          {pieData.length ? (
            <div className="h-52">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={pieData} dataKey="value" nameKey="name" innerRadius={45} outerRadius={75} paddingAngle={2}>
                    {pieData.map((d, i) => <Cell key={i} fill={PIE_COLORS[d.key]} stroke="none" />)}
                  </Pie>
                  <Tooltip contentStyle={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: 8, fontSize: 12 }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          ) : <p className="py-10 text-center text-sm text-slate-500">Belum ada data.</p>}
          <div className="mt-1 flex flex-wrap gap-2">
            {STATUS.map(s => (
              <span key={s.key} className="flex items-center gap-1 text-[11px] text-slate-400"><span className={`h-2 w-2 rounded-full ${s.color}`} />{s.label}</span>
            ))}
          </div>
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
          <p className="mb-3 flex items-center gap-1.5 text-xs text-slate-400"><Settings className="h-3.5 w-3.5" />Info Toko (dipakai di invoice & label)</p>
          <div className="space-y-2">
            <input value={tokoForm.nama} onChange={e => setTokoForm({ ...tokoForm, nama: e.target.value })} placeholder="Nama toko" className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 outline-none focus:border-amber-500" />
            <input value={tokoForm.alamat} onChange={e => setTokoForm({ ...tokoForm, alamat: e.target.value })} placeholder="Alamat" className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 outline-none focus:border-amber-500" />
            <input value={tokoForm.telepon} onChange={e => setTokoForm({ ...tokoForm, telepon: e.target.value })} placeholder="No. telepon" className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 outline-none focus:border-amber-500" />
            <button onClick={() => onSaveToko(tokoForm)} className="w-full rounded-lg bg-slate-800 py-2 text-sm text-slate-200 hover:bg-slate-700">Simpan Info Toko</button>
          </div>
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
          <p className="mb-3 flex items-center gap-1.5 text-xs text-slate-400"><ShieldCheck className="h-3.5 w-3.5" />Keamanan Hapus Servis</p>
          {!ownerUnlocked ? (
            <div className="flex flex-col items-center gap-2 py-4 text-center">
              <ShieldCheck className="h-6 w-6 text-slate-600" />
              <p className="text-xs text-slate-500">Khusus pemilik toko. Karyawan tidak bisa membuka atau melihat pengaturan ini.</p>
              <button
                onClick={() => {
                  const pin = window.prompt('Masukkan kode pemilik untuk membuka pengaturan ini:');
                  if (pin === null) return;
                  if (pin !== HAPUS_PIN) return alert('Kode salah.');
                  setOwnerUnlocked(true);
                }}
                className="mt-1 rounded-lg border border-slate-700 px-4 py-2 text-sm text-slate-300 hover:bg-slate-800"
              >Buka Pengaturan (khusus pemilik)</button>
            </div>
          ) : (
            <>
              <label className="flex items-center gap-2 text-sm text-slate-300">
                <input type="checkbox" checked={!!hapusForm.enabled} onChange={e => setHapusForm({ ...hapusForm, enabled: e.target.checked })} className="h-4 w-4 accent-amber-500" />
                Wajibkan kode kunci saat menghapus servis
              </label>
              {hapusForm.enabled && (
                <div className="mt-2 flex gap-2">
                  <input
                    type={showPin ? 'text' : 'password'}
                    value={hapusForm.pin}
                    onChange={e => setHapusForm({ ...hapusForm, pin: e.target.value.replace(/\s/g, '') })}
                    placeholder="Buat kode kunci sendiri"
                    className="flex-1 rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 outline-none focus:border-amber-500"
                  />
                  <button type="button" onClick={() => setShowPin(v => !v)} className="rounded-lg border border-slate-700 px-3 text-xs text-slate-300 hover:bg-slate-800">{showPin ? 'Sembunyikan' : 'Lihat'}</button>
                </div>
              )}
              <div className="mt-3 flex gap-2">
                <button onClick={() => onSaveHapusSetting(hapusForm)} className="flex-1 rounded-lg bg-slate-800 py-2 text-sm text-slate-200 hover:bg-slate-700">Simpan Pengaturan Keamanan</button>
                <button onClick={() => { setOwnerUnlocked(false); setShowPin(false); }} className="rounded-lg border border-slate-700 px-3 text-xs text-slate-400 hover:bg-slate-800">Kunci Lagi</button>
              </div>
              <p className="mt-2 text-[11px] text-slate-500">Kalau kode kunci ini lupa, masih ada kode cadangan yang tersimpan di kode program (hanya Anda yang bisa lihat/ubah lewat GitHub).</p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/* ---------- overlay cetak (invoice & label) ---------- */

function PrintOverlay({ onClose, children }) {
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-950/90 p-4">
      <style>{`@page { size: A4 portrait; margin: 0; } @media print { html, body, #root { width: 210mm !important; height: 297mm !important; margin: 0 !important; padding: 0 !important; overflow: hidden !important; background: white !important; } body * { visibility: hidden !important; } #print-area, #print-area * { visibility: visible !important; } #print-area { position: fixed !important; left: 4mm !important; top: 4mm !important; width: 202mm !important; height: 289mm !important; box-sizing: border-box !important; margin: 0 !important; padding: 1.5mm !important; border-radius: 0 !important; box-shadow: none !important; overflow: hidden !important; break-inside: avoid-page !important; page-break-inside: avoid !important; page-break-after: avoid !important; print-color-adjust: exact !important; -webkit-print-color-adjust: exact !important; } .print-invoice { width: 100% !important; min-height: 100% !important; box-sizing: border-box !important; } .no-print { display: none !important; } }`}</style>
      <div className="w-full max-w-[794px]">
        <div className="no-print mb-2 flex justify-end gap-2">
          <button onClick={() => window.print()} className="flex items-center gap-1.5 rounded-lg bg-amber-500 px-3 py-1.5 text-sm font-medium text-slate-950 hover:bg-amber-400"><Printer className="h-3.5 w-3.5" />Cetak</button>
          <button onClick={onClose} className="rounded-lg bg-slate-800 px-3 py-1.5 text-sm text-slate-200 hover:bg-slate-700">Tutup</button>
        </div>
        <div id="print-area" className="rounded-xl bg-white p-5 text-slate-900">
          {children}
        </div>
      </div>
    </div>
  );
}

function ThermalPrintOverlay({ onClose, children }) {
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-950/90 p-4">
      <style>{`@page { size: 45mm 20mm; margin: 0; } .print-only-thermal { display: none; } @media print { html, body, #root { width: 45mm !important; height: 20mm !important; margin: 0 !important; padding: 0 !important; overflow: hidden !important; background: white !important; } body * { visibility: hidden !important; } .print-only-thermal, .print-only-thermal * { visibility: visible !important; } .print-only-thermal { display: block !important; position: absolute !important; left: 0 !important; top: 0 !important; width: 45mm !important; height: 20mm !important; box-sizing: border-box !important; margin: 0 !important; padding: 1mm !important; overflow: hidden !important; print-color-adjust: exact !important; -webkit-print-color-adjust: exact !important; } .no-print { display: none !important; } }`}</style>
      <div className="w-full max-w-xs">
        <div className="no-print mb-2 flex justify-end gap-2">
          <button onClick={() => window.print()} className="flex items-center gap-1.5 rounded-lg bg-amber-500 px-3 py-1.5 text-sm font-medium text-slate-950 hover:bg-amber-400"><Printer className="h-3.5 w-3.5" />Cetak</button>
          <button onClick={onClose} className="rounded-lg bg-slate-800 px-3 py-1.5 text-sm text-slate-200 hover:bg-slate-700">Tutup</button>
        </div>
        <p className="no-print mb-2 text-center text-[11px] text-slate-500">Pratinjau diperbesar untuk kejelasan — akan tercetak tegak pada label 20×45mm.</p>
        {/* Pratinjau di layar saja — sengaja diperbesar supaya gampang dibaca */}
        <div className="no-print mx-auto" style={{ width: '45mm', transform: 'scale(4)', transformOrigin: 'top center', marginBottom: '70mm' }}>
          <div style={{ width: '45mm', height: '20mm', boxSizing: 'border-box', overflow: 'hidden' }} className="bg-white p-[0.5mm] text-black">
            {children}
          </div>
        </div>
        {/* Konten asli yang benar-benar dikirim ke printer — ukuran 100%, tidak ada induk yang di-scale */}
        <div className="print-only-thermal bg-white text-black">
          {children}
        </div>
      </div>
    </div>
  );
}

function ThermalLabelView({ ticket, toko }) {
  const total = Number(ticket.biayaFinal || ticket.biayaEstimasi || 0);
  const hasSim = !!(ticket.completeness?.['SIM Card']);
  const hasMmc = !!(ticket.completeness?.['MMC']);
  const sparepartUpdated = (ticket.sparepartList || []).map(it => it.name).filter(Boolean).join(', ');
  const keluhanLines = String(sparepartUpdated || ticket.sparepartReplaced || '').split('\n').map(s => s.trim()).filter(Boolean);
  const bayarText = ticket.paymentStatus === 'cash' ? 'CASH' : ticket.paymentStatus === 'dp' ? 'DP' : ticket.paymentStatus === 'belum' ? 'BELUM BAYAR' : '-';
  const isPola = ticket.unlockType === 'pola' && ticket.unlockValue;

  // Hitung perkiraan jumlah baris (teks panjang bisa turun jadi 2 baris),
  // lalu pilih ukuran font supaya semuanya tetap muat di tinggi 20mm.
  // Kolom teks menyempit saat ada gambar pola di sebelah kanan.
  const CHARS_PER_LINE = isPola ? 20 : 30;
  const keluhanRows = keluhanLines.reduce((sum, k) => sum + Math.max(1, Math.ceil(k.length / CHARS_PER_LINE)), 0);
  const totalRows = 1 + keluhanRows + 2 + (hasMmc && ticket.mmcSize ? 1 : 0) + 1
    + (bayarText !== '-' ? 1 : 0) + (ticket.unlockType === 'pola' || ticket.unlockType === 'pin' ? 1 : 0);
  const fontPt = totalRows <= 6 ? 7 : totalRows === 7 ? 6.3 : totalRows === 8 ? 5.6 : 5;

  const line = (text, bold) => <div style={{ fontSize: `${fontPt}pt`, fontWeight: bold ? 'bold' : 'normal', wordBreak: 'break-word' }}>{text}</div>;

  return (
    <div style={{
      fontFamily: 'Arial, sans-serif',
      lineHeight: 1.12,
      width: '45mm',
      height: '20mm',
      boxSizing: 'border-box',
      padding: '0.4mm',
      overflow: 'hidden',
      display: 'flex',
      alignItems: 'stretch',
      gap: '0.8mm',
    }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        {line(`${ticket.customerName || '-'}`, true)}
        {keluhanLines.map((k, i) => <React.Fragment key={i}>{line(k.toUpperCase())}</React.Fragment>)}
        {line(hasSim ? `SIM 1 ${(ticket.sim1Brand || '-').toUpperCase()}` : 'NO SIM')}
        {line(hasMmc ? `MMC ${(ticket.mmcBrand || '-').toUpperCase()}` : 'NO MMC')}
        {hasMmc && ticket.mmcSize && line(`${ticket.mmcSize}GB`)}
        {line(`Rp${total.toLocaleString('id-ID')}`, true)}
        {bayarText !== '-' && line(bayarText)}
        {ticket.unlockType === 'pola' ? line(`POLA ${ticket.unlockValue || '-'}`) : ticket.unlockType === 'pin' ? line(`PIN ${ticket.unlockValue || '-'}`) : null}
      </div>
      {isPola && (
        <div style={{ width: '16mm', flexShrink: 0, marginLeft: '-1mm', alignSelf: 'stretch', display: 'flex', alignItems: 'stretch', justifyContent: 'center' }}>
          <PatternDiagramThermal value={ticket.unlockValue} />
        </div>
      )}
    </div>
  );
}

function PatternInput({ value, onChange }) {
  const svgRef = useRef(null);
  const drawing = useRef(false);
  const seq = String(value || '').split('').map(Number).filter(n => n >= 1 && n <= 9);
  const point = n => ({ x: 34 + ((n - 1) % 3) * 32, y: 18 + Math.floor((n - 1) / 3) * 32 });

  // Cari titik terdekat dari posisi jari/kursor
  const nodeAt = (clientX, clientY) => {
    const rect = svgRef.current.getBoundingClientRect();
    const x = ((clientX - rect.left) / rect.width) * 116;
    const y = ((clientY - rect.top) / rect.height) * 100;
    for (const n of [1,2,3,4,5,6,7,8,9]) {
      const p = point(n);
      if (Math.hypot(p.x - x, p.y - y) <= 13) return n;
    }
    return null;
  };

  const addNode = (clientX, clientY) => {
    const n = nodeAt(clientX, clientY);
    if (!n) return;
    const current = String(value || '');
    if (current.includes(String(n))) return; // titik tidak boleh dipakai dua kali
    onChange(current + n);
  };

  const pos = e => e.touches?.[0] || e;
  const start = e => { e.preventDefault(); drawing.current = true; onChange(''); const p = pos(e); addNode(p.clientX, p.clientY); };
  const move = e => { if (!drawing.current) return; e.preventDefault(); const p = pos(e); addNode(p.clientX, p.clientY); };
  const end = () => { drawing.current = false; };

  return (
    <div>
      <svg
        ref={svgRef}
        viewBox="0 0 116 100"
        className="mx-auto h-[14rem] w-[17rem] touch-none select-none"
        onMouseDown={start} onMouseMove={move} onMouseUp={end} onMouseLeave={end}
        onTouchStart={start} onTouchMove={move} onTouchEnd={end}
      >
        {seq.slice(1).map((n, i) => { const a = point(seq[i]), b = point(n); return <line key={`${i}-${n}`} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="#f59e0b" strokeWidth="3" />; })}
        {[1,2,3,4,5,6,7,8,9].map(n => {
          const p = point(n), order = seq.indexOf(n);
          return (
            <g key={n}>
              <text x={p.x - 12} y={p.y + 6} textAnchor="middle" fontSize="18" fontWeight="bold" fill="#94a3b8">{n}</text>
              <circle cx={p.x} cy={p.y} r="12" fill="transparent" />
              <circle cx={p.x} cy={p.y} r="7" fill={order >= 0 ? '#f59e0b' : '#1e293b'} stroke="#94a3b8" strokeWidth="2" />
              {order >= 0 && <text x={p.x} y={p.y + 3} textAnchor="middle" fontSize="8" fill="#0f172a" fontWeight="bold">{order + 1}</text>}
            </g>
          );
        })}
      </svg>
      <div className="mt-1 flex items-center justify-center gap-3">
        <span className="font-mono text-sm text-amber-400">{value || '—'}</span>
        <button type="button" onClick={() => onChange('')} className="rounded border border-slate-700 px-2 py-0.5 text-xs text-slate-300 hover:bg-slate-800">Hapus</button>
      </div>
    </div>
  );
}

function PatternDiagram({ value }) {
  const seq = String(value || '').split('').map(Number).filter(n => n >= 1 && n <= 9);
  const point = n => ({ x: 34 + ((n - 1) % 3) * 32, y: 18 + Math.floor((n - 1) / 3) * 32 });
  return <svg viewBox="0 0 116 100" className="mx-auto h-16 w-[19mm]">{seq.slice(1).map((n, i) => { const a = point(seq[i]), b = point(n); return <line key={`${i}-${n}`} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="#111827" strokeWidth="3" />; })}{[1,2,3,4,5,6,7,8,9].map(n => { const p = point(n), order = seq.indexOf(n); return <g key={n}><text x={p.x - 12} y={p.y + 6} textAnchor="middle" fontSize="18" fontWeight="bold" fill="#111827">{n}</text><circle cx={p.x} cy={p.y} r="7" fill={order >= 0 ? '#111827' : 'white'} stroke="#111827" strokeWidth="2" />{order >= 0 && <text x={p.x} y={p.y + 3} textAnchor="middle" fontSize="8" fill="white">{order + 1}</text>}</g>; })}</svg>;
}

function PatternDiagramThermal({ value }) {
  const seq = String(value || '').split('').map(Number).filter(n => n >= 1 && n <= 9);
  const point = n => ({ x: 34 + ((n - 1) % 3) * 32, y: 18 + Math.floor((n - 1) / 3) * 32 });
  return (
    <svg viewBox="0 0 116 100" preserveAspectRatio="none" style={{ width: '100%', height: '100%' }}>
      {seq.slice(1).map((n, i) => { const a = point(seq[i]), b = point(n); return <line key={`${i}-${n}`} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="#111827" strokeWidth="3.5" />; })}
      {[1,2,3,4,5,6,7,8,9].map(n => {
        const p = point(n), order = seq.indexOf(n);
        return (
          <g key={n}>
            <text x={p.x - 15} y={p.y + 7} textAnchor="middle" fontSize="24" fontWeight="bold" fill="#111827">{n}</text>
            <circle cx={p.x} cy={p.y} r="9.5" fill={order >= 0 ? '#111827' : 'white'} stroke="#111827" strokeWidth="3" />
            {order >= 0 && <text x={p.x} y={p.y + 5} textAnchor="middle" fontSize="14" fill="white" fontWeight="bold">{order + 1}</text>}
          </g>
        );
      })}
    </svg>
  );
}

function InvoiceView({ ticket, toko, trackUrl, qrSrc }) {
  const total = Number(ticket.biayaFinal || ticket.biayaEstimasi || 0), dp = Number(ticket.downPayment || 0), cash = Number(ticket.cashPayment || 0);
  const remaining = Math.max(0, total - dp - cash);
  const yesMark = item => ticket.completeness?.[item]
    ? <span style={{ color: '#16a34a', fontWeight: 'bold' }}>☑</span>
    : <span style={{ color: '#dc2626', fontWeight: 'bold' }}>☒</span>;
  const value = part => {
    const c = ticket.checklist?.[part];
    if (!c) return '-';
    return c.note ? `${c.cond} (${c.note})` : c.cond;
  };
  const CONDCOLOR_PRINT = { 'Tidak Bisa Dicek': '#6b7280', 'Baik': '#16a34a', 'Kurang Baik': '#ea580c', 'Lecet': '#d97706', 'Rusak': '#dc2626', 'Tidak Ada': '#9333ea' };
  const condColor = part => CONDCOLOR_PRINT[ticket.checklist?.[part]?.cond] || '#000';
  const chunk = Math.ceil(CHECKLIST_PARTS.length / 3);
  const cols = [CHECKLIST_PARTS.slice(0, chunk), CHECKLIST_PARTS.slice(chunk, chunk * 2), CHECKLIST_PARTS.slice(chunk * 2)];
  const upper = text => String(text || '-').toUpperCase();
  const finalCols = [CHECKLIST_PARTS.slice(0, chunk), CHECKLIST_PARTS.slice(chunk, chunk * 2), CHECKLIST_PARTS.slice(chunk * 2)];
  const storePhone = toko.telepon || '0851 1755 4834';
  return <div className="print-invoice border border-black p-1.5 text-[9px] leading-tight text-black">
    <header className="flex justify-between border-b-2 border-black pb-1"><div><div className="text-2xl font-black">HN82 CELL</div><div className="font-bold">SERVICE HANDPHONE</div><div>WhatsApp: 0851 1755 4834</div></div><div className="text-right"><div className="text-xl font-black">TANDA TERIMA SERVIS</div><div className="font-bold">#{ticket.segelNumber || ticket.id.slice(-6).toUpperCase()}</div><div>{fmtDate(ticket.createdAt)}</div></div></header>
    <div className="mt-1 grid grid-cols-[1fr_40mm] gap-3"><div>
      <section className="grid grid-cols-2 rounded border border-black text-[13px] font-black uppercase"><div className="space-y-1 border-r border-black p-2"><p>NAMA PELANGGAN　:　{upper(ticket.customerName)}</p><p>MEREK & TIPE HP　:　{upper(ticket.phoneModel)}</p><p>IMEI HP　　　　 :　{upper(ticket.imei)}</p></div><div className="space-y-1 p-2"><p>NO. HP　　　　　:　{upper(ticket.customerPhone)}</p><p>KELUHAN / KERUSAKAN :　{upper(ticket.keluhan)}</p><p>SPAREPART DIGANTI　 :　{upper(ticket.sparepartReplaced)}</p></div></section>
      <section className="mt-1 rounded border border-black p-0.5"><b className="text-[9px]">KELENGKAPAN HP</b><table className="mt-0.5 w-full border-collapse text-[8px]"><tbody><tr><td className="border border-black px-1 py-0.5">{yesMark('Silikon / Case')}　Silikon / Case</td><td className="border border-black px-1 py-0.5">{yesMark('Backcover')}　Backcover</td><td className="border border-black px-1 py-0.5">{yesMark('SIM Tray')}　SIM Tray</td></tr><tr><td className="border border-black px-1 py-0.5">{yesMark('SIM Card')}　SIM Card</td><td className="border border-black px-1 py-0.5">SIM1: {ticket.sim1Brand || '____'}</td><td className="border border-black px-1 py-0.5">SIM2: {ticket.sim2Brand || '____'}</td></tr><tr><td className="border border-black px-1 py-0.5">{yesMark('MMC')}　MMC</td><td className="border border-black px-1 py-0.5">Ukuran: {ticket.mmcSize || '__'} GB</td><td className="border border-black px-1 py-0.5">Merek: {ticket.mmcBrand || '____'}</td></tr><tr><td className="border border-black px-1 py-0.5">{yesMark('Kabel Charger')}　Kabel Charger</td><td className="border border-black px-1 py-0.5">{yesMark('Kepala Charger')}　Kepala Charger</td><td className="border border-black px-1 py-0.5">{ticket.completenessOther ? `Lain: ${ticket.completenessOther}` : ''}</td></tr></tbody></table></section>
    </div><aside className="rounded border border-black p-1 text-center"><b className="text-[7px] leading-tight">📱 SCAN DI SINI UNTUK CEK STATUS SERVIS</b><div className="text-[5.5px] leading-tight">Arahkan kamera HP ke QR Code ini</div><img src={qrSrc} className="mx-auto mt-0.5 aspect-square w-full max-w-[34mm]"/><div className="break-all text-[5.5px] leading-tight">{trackUrl}</div></aside></div>
    <section className="mt-1 rounded border border-black p-1"><b className="text-[11px]">KONDISI AWAL / TES KENORMALAN</b><div className="mt-0.5 grid grid-cols-3">{cols.map((col, ci) => <table key={ci} className="w-full border-collapse text-[9px]"><tbody>{col.map(part => <tr key={part}><td className="border border-black px-1 py-[2px]">{part}</td><td className="border border-black px-1 py-[2px] text-right font-bold" style={{ color: condColor(part) }}>{value(part)}</td></tr>)}</tbody></table>)}</div></section>
    <div className="mt-0.5 grid grid-cols-2 gap-2"><section className="h-[24mm] rounded border border-black p-1 text-center"><b className="text-[11px]">KUNCI LAYAR</b>{ticket.unlockType === 'pin' ? <div className="mt-3 text-lg font-black tracking-[.3em]">{ticket.unlockValue || '-'}</div> : ticket.unlockType === 'pola' ? <PatternDiagram value={ticket.unlockValue}/> : <div className="mt-5">TIDAK DIBERIKAN</div>}<div className="text-[8px]">{ticket.unlockType === 'pin' ? 'PIN / KODE' : ticket.unlockType === 'pola' ? 'POLA' : ''}</div></section><section className="rounded border border-black p-1"><b className="text-[11px]">RINCIAN PEMBAYARAN</b><table className="mt-0.5 w-full text-[10px]"><tbody><tr><td>Estimasi Harga</td><td className="text-right">{fmtRupiah(ticket.biayaEstimasi)}</td></tr><tr><td>Total</td><td className="text-right font-black">{fmtRupiah(total)}</td></tr><tr><td>DP</td><td className="text-right">{fmtRupiah(dp)}</td></tr><tr><td>Cash / Bayar</td><td className="text-right">{fmtRupiah(cash)}</td></tr><tr className="border-t border-black"><td className="font-black">Sisa</td><td className="text-right font-black">{fmtRupiah(remaining)}</td></tr></tbody></table></section></div>
    <section className="mt-0.5 h-[40mm] rounded border border-black p-1.5"><b className="text-[11px]">PERSETUJUAN & TANDA TERIMA</b><ol className="mt-0.5 list-decimal space-y-0.5 pl-3 text-[6.5px] leading-tight"><li>Pelanggan menyatakan data kondisi dan kelengkapan di atas sudah sesuai. Simpan nota ini untuk pengambilan unit.</li><li className="italic">Proses servis dapat didokumentasikan sebagai bukti pengerjaan. Dokumentasi tidak dipublikasikan tanpa izin pelanggan.</li><li className="font-bold">Unit servis yang tidak diambil dalam waktu 3 bulan sejak pemberitahuan selesai bukan lagi menjadi tanggung jawab HN82 CELL.</li></ol><div className="mt-1 grid h-[23mm] grid-cols-2 gap-3 text-center"><div className="flex flex-col justify-end rounded border border-black px-3 pb-1"><div className="border-t border-black pt-1 font-bold uppercase">Pelanggan / Penerima</div></div><div className="flex flex-col justify-end rounded border border-black px-3 pb-1"><div className="border-t border-black pt-1 font-bold uppercase">Teknisi: {ticket.teknisi || '____________'}</div></div></div></section>

    <div className="my-4 flex items-center gap-2 text-[8px] text-black">
      <div className="flex-1 border-t-2 border-dashed border-black" />
      <span className="whitespace-nowrap">✂ GUNTING / LIPAT DI SINI — BAGIAN BAWAH UNTUK SAAT PENGAMBILAN ✂</span>
      <div className="flex-1 border-t-2 border-dashed border-black" />
    </div>

    <section className="mt-1 rounded border border-black p-1">
      <b className="text-[11px]">TES KENORMALAN SAAT PENYERAHAN / PENGAMBILAN</b>
      <div className="mt-0.5 flex items-center justify-between rounded border border-black bg-black/5 px-1.5 py-1 text-[9px] font-bold uppercase">
        <span>#{ticket.segelNumber || '-'}　·　{upper(ticket.customerName)}</span>
        <span>{upper(ticket.phoneModel)}</span>
      </div>
      <p className="mt-0.5 text-[7px]">Centang setelah fungsi diperiksa bersama pelanggan dan dinyatakan normal.</p>
      <div className="mt-0.5 grid grid-cols-3">{finalCols.map((col, ci) => <table key={ci} className="w-full border-collapse text-[8px]"><tbody>{col.map(part => <tr key={part}><td className="border border-black px-1 py-px">☐　{part}</td><td className="border border-black px-1 py-px text-center">Normal</td></tr>)}</tbody></table>)}</div>
    </section>

    <section className="mt-1 rounded border border-black p-1"><b className="text-[11px]">PENYERAHAN UNIT & GARANSI</b><div className="mt-0.5 grid grid-cols-2 gap-x-5 text-[8px]"><div className="text-[12px]">☐ HP sudah diambil pelanggan</div><div className="text-[12px] font-bold">Tanggal / Jam: ________________________</div><div className="text-[12px]">Masa garansi: ______ hari / ______ bulan</div><div className="text-[12px] font-bold">Garansi berlaku untuk: __________________</div><div className="col-span-2 text-[12px]">Servis / sparepart yang digaransi: <span className="font-bold">{upper(ticket.sparepartReplaced)}</span> __________________________________</div></div><p className="mt-0.5 border-t border-black pt-0.5 text-[6.5px]">Garansi hanya berlaku pada kerusakan atau sparepart yang dikerjakan/diganti. Tidak berlaku akibat jatuh, terkena air, benturan, segel rusak, atau kerusakan lain di luar pekerjaan servis.</p></section>

    <section className="mt-0.5 h-[32mm] rounded border border-black p-1.5"><b className="text-[11px]">TANDA TANGAN PENGAMBILAN</b><div className="mt-1 grid h-[23mm] grid-cols-2 gap-3 text-center"><div className="flex flex-col justify-end rounded border border-black px-3 pb-1"><div className="border-t border-black pt-1 font-bold uppercase">Pelanggan / Penerima</div></div><div className="flex flex-col justify-end rounded border border-black px-3 pb-1"><div className="border-t border-black pt-1 font-bold uppercase">Teknisi: __________________</div></div></div></section>
    <p className="mt-1 text-center text-[7px]">HN82 CELL · WhatsApp {storePhone} · Terima kasih telah mempercayakan servis HP Anda kepada kami.</p>
  </div>;
}

function LabelView({ ticket, toko, trackUrl, qrSrc }) {
  const storePhone = toko.telepon || '0851 1755 4834';
  const row = (label, value) => (
    <tr>
      <td className="w-[38mm] border border-black px-2 py-1.5 font-bold uppercase">{label}</td>
      <td className="border border-black px-2 py-1.5 uppercase">{value || '-'}</td>
    </tr>
  );
  const kunciCell = ticket.unlockType === 'pola'
    ? (
      <div className="flex items-center gap-3">
        <span className="font-bold">POLA: {ticket.unlockValue || '-'}</span>
        <div className="w-[22mm]"><PatternDiagram value={ticket.unlockValue} /></div>
      </div>
    )
    : ticket.unlockType === 'pin' ? `PIN: ${ticket.unlockValue || '-'}`
    : 'TIDAK DIBERIKAN';

  return (
    <div className="text-[13px]">
      <div className="flex items-start justify-between border-b-2 border-black pb-2">
        <div>
          <p className="text-2xl font-black">{toko.nama || 'HN82 CELL'}</p>
          <p className="text-[11px] font-bold uppercase">Service Handphone</p>
          <p className="text-[11px]">WhatsApp: {storePhone}</p>
        </div>
        <div className="text-right">
          <p className="text-xl font-black uppercase">Tanda Terima Komplain / Garansi</p>
          <p className="font-mono text-xs">#{ticket.segelNumber || ticket.id.slice(-6).toUpperCase()}</p>
          <p className="text-[11px]">{fmtDate(Date.now())}</p>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-[1fr_40mm] gap-3">
        <table className="w-full border-collapse">
          <tbody>
            {row('Nama Pelanggan', ticket.customerName)}
            {row('No. HP', ticket.customerPhone)}
            {row('Merek & Tipe HP', ticket.phoneModel)}
            {row('IMEI HP', ticket.imei)}
            {row('Kerusakan / Keluhan', ticket.keluhan)}
            {row('Sparepart Diganti', ticket.sparepartReplaced)}
            {row('Kunci Layar', kunciCell)}
            {row('Tanggal Servis Awal', fmtDate(ticket.createdAt))}
          </tbody>
        </table>
        <aside className="rounded border border-black p-1 text-center">
          <b className="text-[7px] leading-tight">📱 SCAN DI SINI UNTUK CEK STATUS SERVIS</b>
          <div className="text-[6px] leading-tight">Arahkan kamera HP ke QR Code ini</div>
          <img src={qrSrc} className="mx-auto mt-0.5 aspect-square w-full max-w-[34mm]" />
          <div className="break-all text-[6px] leading-tight">{trackUrl}</div>
        </aside>
      </div>

      <section className="mt-3 rounded border border-black p-1.5">
        <b className="text-[12px] uppercase">Kelengkapan HP yang Diserahkan</b>
        <table className="mt-1 w-full border-collapse text-[12px]">
          <tbody>
            <tr>
              <td className="border border-black px-2 py-1.5">☐　Silikon / Case</td>
              <td className="border border-black px-2 py-1.5">☐　Backcover</td>
              <td className="border border-black px-2 py-1.5">☐　SIM Tray</td>
            </tr>
            <tr>
              <td className="border border-black px-2 py-1.5">☐　SIM Card</td>
              <td className="border border-black px-2 py-1.5">SIM 1: ____________</td>
              <td className="border border-black px-2 py-1.5">SIM 2: ____________</td>
            </tr>
            <tr>
              <td className="border border-black px-2 py-1.5">☐　MMC</td>
              <td className="border border-black px-2 py-1.5">Ukuran: ______ GB</td>
              <td className="border border-black px-2 py-1.5">Merek: ____________</td>
            </tr>
            <tr>
              <td className="border border-black px-2 py-1.5">☐　Kabel Charger</td>
              <td className="border border-black px-2 py-1.5">☐　Kepala Charger</td>
              <td className="border border-black px-2 py-1.5">Lainnya: __________</td>
            </tr>
          </tbody>
        </table>
      </section>

      <div className="mt-4 grid h-[34mm] grid-cols-2 gap-4 text-center">
        <div className="flex flex-col justify-end rounded border border-black px-3 pb-1">
          <div className="border-t border-black pt-1 font-bold uppercase">Pelanggan / Penerima</div>
        </div>
        <div className="flex flex-col justify-end rounded border border-black px-3 pb-1">
          <div className="border-t border-black pt-1 font-bold uppercase">Teknisi: ____________</div>
        </div>
      </div>

      <p className="mt-3 border-t border-black pt-2 text-center text-[10px]">
        {toko.nama || 'HN82 CELL'} · WhatsApp {storePhone} · Simpan nota ini sebagai bukti komplain/garansi.
      </p>
    </div>
  );
}

/* ---------- app utama ---------- */

/* ---------- jadwal kerja / pengingat ---------- */

function JadwalKerja({ tickets, onOpen, notifOn, onToggleNotif, notifSupported }) {
  const RANK = { tinjau: 4, terlambat: 3, perhatian: 2, baru: 1 };
  const pending = tickets
    .filter(t => t.status !== 'selesai' && t.status !== 'diambil' && t.status !== 'gagal' && t.status !== 'komplain_selesai')
    .map(t => ({ t, r: ticketReminder(t) }))
    .sort((a, b) => {
      const ar = a.r ? RANK[a.r.level] * 1000 + a.r.umur : 0;
      const br = b.r ? RANK[b.r.level] * 1000 + b.r.umur : 0;
      return br - ar;
    });

  const urgentCount = pending.filter(p => p.r).length;
  const pendingCustomer = pending.filter(p => (p.t.sumberServis || 'customer') === 'customer');
  const pendingTuser = pending.filter(p => (p.t.sumberServis || 'customer') === 'tuser');
  const boxClass = level => level === 'tinjau' ? 'border-red-700 bg-red-950/30'
    : level === 'terlambat' ? 'border-orange-700/70 bg-orange-950/20'
    : level === 'perhatian' ? 'border-amber-700/70 bg-amber-950/20'
    : level === 'baru' ? 'border-emerald-700/70 bg-emerald-950/20'
    : 'border-slate-800 bg-slate-900/40';
  const textClass = level => level === 'tinjau' ? 'text-red-400'
    : level === 'terlambat' ? 'text-orange-400'
    : level === 'baru' ? 'text-emerald-400'
    : 'text-amber-400';
  const renderJadwalCard = ({ t, r }) => (
    <button key={t.id} onClick={() => onOpen(t.id)}
      style={{ borderLeftStyle: 'dashed', borderLeftWidth: 3 }}
      className={`flex w-full items-start justify-between gap-3 rounded-xl border p-3.5 text-left ${boxClass(r?.level)}`}>
      <div>
        <p className="font-mono text-[11px] text-amber-400">#{t.segelNumber || '—'}</p>
        <p className="font-medium text-slate-100">{t.phoneModel} <span className="text-slate-400">· {t.customerName}</span></p>
        {r ? (
          <>
            <p className={`mt-1 text-xs font-bold ${textClass(r.level)}`}>{r.badge}</p>
            <p className={`text-xs ${textClass(r.level)}`}>{r.label}</p>
          </>
        ) : (
          <p className="mt-0.5 flex items-center gap-1 text-xs text-slate-500"><CalendarClock className="h-3 w-3" />Masih dalam batas wajar</p>
        )}
        <p className="mt-0.5 text-[11px] text-slate-500">{t.status === 'komplain' ? `Komplain: hari ke-${r?.umur || 1}` : `Umur servis: hari ke-${(() => { const a = new Date(t.createdAt); a.setHours(0,0,0,0); const b = new Date(); b.setHours(0,0,0,0); return daysBetween(a, b) + 1; })()}`}</p>
      </div>
      <Badge statusKey={t.status} />
    </button>
  );

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-lg font-semibold">Jadwal Kerja</h1>
        <button onClick={onToggleNotif} className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs ${notifOn ? 'border-emerald-700 text-emerald-400' : 'border-slate-700 text-slate-300 hover:bg-slate-800'}`}>
          <Bell className="h-3.5 w-3.5" />{notifOn ? 'Notifikasi Aktif' : 'Aktifkan Notifikasi Browser'}
        </button>
      </div>
      {!notifSupported && <p className="mt-1 text-[11px] text-slate-500">Notifikasi browser hanya berfungsi setelah aplikasi ini di-hosting sendiri (bukan di preview builder).</p>}

      {urgentCount > 0 && (
        <div className="mt-3 flex items-center gap-2 rounded-lg border border-red-800/60 bg-red-950/30 px-3 py-2 text-sm text-red-300">
          <AlertTriangle className="h-4 w-4 flex-shrink-0" />
          Ada {urgentCount} servis yang perlu ditindaklanjuti — lihat daftar bertanda di bawah.
        </div>
      )}

      {/* HP: satu daftar gabungan seperti biasa */}
      <div className="mt-4 space-y-2 sm:hidden">
        {pending.map(renderJadwalCard)}
        {!pending.length && <p className="py-10 text-center text-sm text-slate-500">Semua servis sudah selesai/diambil. Tidak ada pekerjaan tertunda 🎉</p>}
      </div>

      {/* PC: Customer & TUSER berdampingan sekaligus */}
      <div className="mt-4 hidden gap-4 sm:grid sm:grid-cols-2">
        <div>
          <p className="mb-2 text-sm font-semibold text-amber-400">CUSTOMER</p>
          <div className="space-y-2">
            {pendingCustomer.map(renderJadwalCard)}
            {!pendingCustomer.length && <p className="py-6 text-center text-sm text-slate-500">Tidak ada pekerjaan tertunda untuk Customer 🎉</p>}
          </div>
        </div>
        <div>
          <p className="mb-2 text-sm font-semibold text-amber-400">TUSER</p>
          <div className="space-y-2">
            {pendingTuser.map(renderJadwalCard)}
            {!pendingTuser.length && <p className="py-6 text-center text-sm text-slate-500">Tidak ada pekerjaan tertunda untuk TUSER 🎉</p>}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ServisHPApp() {
  const [loaded, setLoaded] = useState(false);
  const [tickets, setTickets] = useState([]);
  const [kas, setKas] = useState([]);
  const [staff, setStaff] = useState('');
  const [view, setView] = useState('stats');
  const [activeId, setActiveId] = useState(null);
  // Supaya tombol "kembali" di HP (Android) berfungsi seperti tombol Kembali
  // di aplikasi, bukan langsung menutup aplikasi.
  const navRef = useRef({ view: 'stats', activeId: null, skip: false });

  useEffect(() => {
    const onPop = e => {
      const s = e.state && e.state.hn82;
      navRef.current.skip = true; // jangan dorong riwayat baru saat mundur
      if (s) {
        setView(s.view);
        setActiveId(s.activeId ?? null);
        navRef.current = { view: s.view, activeId: s.activeId ?? null, skip: true };
      } else {
        setView('stats');
        setActiveId(null);
        navRef.current = { view: 'stats', activeId: null, skip: true };
      }
    };
    window.history.replaceState({ hn82: { view: 'stats', activeId: null } }, '');
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  useEffect(() => {
    const prev = navRef.current;
    if (prev.skip) { navRef.current = { view, activeId, skip: false }; return; }
    if (prev.view === view && prev.activeId === activeId) return;
    navRef.current = { view, activeId, skip: false };
    window.history.pushState({ hn82: { view, activeId } }, '');
  }, [view, activeId]);

  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('semua');
  const [sumberTab, setSumberTab] = useState('customer');
  const [portalUrl, setPortalUrl] = useState('');
  const [customerMode, setCustomerMode] = useState(undefined);
  const [errMsg, setErrMsg] = useState('');
  const [toko, setToko] = useState({ nama: '', alamat: '', telepon: '' });
  const [hapusSetting, setHapusSetting] = useState({ enabled: false, pin: '' });
  const [notifOn, setNotifOn] = useState(false);
  const notifSupported = typeof window !== 'undefined' && typeof Notification !== 'undefined';

  useEffect(() => {
    (async () => {
      const params = new URLSearchParams(window.location.search);
      const track = params.get('track');
      if (track) {
        try {
          const publicTicket = await loadPublicTicket(track);
          setCustomerMode(publicTicket || 'notfound');
        } catch (e) {
          setErrMsg(`Gagal membuka status servis: ${e.message}`);
          setCustomerMode('notfound');
        }
        setLoaded(true);
        return;
      }
      let list = [];
      try {
        list = await loadCloudTickets();
      } catch (e) {
        const r = await window.storage.get('sh_tickets', true);
        list = r ? JSON.parse(r.value) : [];
        setErrMsg(`Supabase belum dapat dibaca. Menampilkan cadangan lokal: ${e.message}`);
      }
      setTickets(list);
      setCustomerMode(null);

      try {
        const rk = await window.storage.get('sh_kas', true);
        setKas(rk ? JSON.parse(rk.value) : []);
      } catch (e) { setKas([]); }

      try {
        const rp = await window.storage.get('sh_portal_url', true);
        setPortalUrl(rp ? rp.value : '');
      } catch (e) {}

      try {
        const rt = await window.storage.get('sh_toko', true);
        setToko(rt ? JSON.parse(rt.value) : { nama: '', alamat: '', telepon: '' });
      } catch (e) {}

      try {
        const rh = await window.storage.get('sh_hapus_setting', true);
        setHapusSetting(rh ? JSON.parse(rh.value) : { enabled: false, pin: '' });
      } catch (e) {}

      setLoaded(true);
    })();
  }, []);

  // Notifikasi browser: cek status izin saat load, lalu kirim satu notifikasi
  // ringkas per sesi kalau ada servis yang belum ditindaklanjuti (lihat ticketReminder).
  useEffect(() => {
    if (!notifSupported) return;
    setNotifOn(Notification.permission === 'granted');
  }, [notifSupported]);

  useEffect(() => {
    if (!loaded || !notifOn || !notifSupported) return;
    const urgent = tickets.filter(t => ticketReminder(t));
    if (urgent.length) {
      try {
        new Notification('Servis HP — ada pekerjaan tertunda', {
          body: `${urgent.length} servis perlu ditindaklanjuti:\n${urgent.slice(0, 3).map(t => { const r = ticketReminder(t); return `${r?.badge || ''} ${t.phoneModel} (${t.customerName})`; }).join('\n')}`,
        });
      } catch (e) {}
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded, notifOn]);

  const toggleNotif = async () => {
    if (!notifSupported) return;
    if (Notification.permission === 'granted') { setNotifOn(v => !v); return; }
    const perm = await Notification.requestPermission();
    setNotifOn(perm === 'granted');
  };

  const saveLocalBackup = async (next) => {
    setTickets(next);
    try { await window.storage.set('sh_tickets', JSON.stringify(next), true); }
    catch (e) { setErrMsg('Gagal menyimpan data ke penyimpanan. Perubahan mungkin tidak tersimpan.'); }
  };
  const persistKas = async (next) => {
    setKas(next);
    try { await window.storage.set('sh_kas', JSON.stringify(next), true); }
    catch (e) { setErrMsg('Gagal menyimpan data kas.'); }
  };
  const saveToko = async (next) => {
    setToko(next);
    try { await window.storage.set('sh_toko', JSON.stringify(next), true); }
    catch (e) { setErrMsg('Gagal menyimpan info toko.'); }
  };
  const saveHapusSetting = async (next) => {
    setHapusSetting(next);
    try { await window.storage.set('sh_hapus_setting', JSON.stringify(next), true); }
    catch (e) { setErrMsg('Gagal menyimpan pengaturan keamanan.'); }
  };

  if (!loaded) return <div className="flex min-h-screen items-center justify-center bg-slate-950 text-slate-400">Memuat...</div>;

  if (customerMode !== null && customerMode !== undefined) {
    return <CustomerTrack ticket={customerMode} />;
  }

  const createTicket = async (data) => {
    const t = {
      id: uid(), createdAt: Date.now(), status: 'diterima',
      sumberServis: data.sumberServis || '',
      customerName: data.customerName, customerPhone: data.customerPhone, phoneModel: data.phoneModel,
      imei: data.imei, sparepartReplaced: data.sparepartReplaced,
      segelNumber: data.segelNumber, keluhan: data.keluhan, videoBeforeLink: data.videoBeforeLink, videoProsesLink: data.videoProsesLink, videoAfterLink: data.videoAfterLink,
      biayaEstimasi: data.biayaEstimasi, biayaFinal: '', dibayar: false, teknisi: '',
      completeness: data.completeness || {}, completenessOther: data.completenessOther || '',
      sim1Brand: data.sim1Brand || '', sim2Brand: data.sim2Brand || '', mmcSize: data.mmcSize || '', mmcBrand: data.mmcBrand || '',
      unlockType: data.unlockType || 'tidak_ada', unlockValue: data.unlockValue || '',
      downPayment: data.downPayment || '', cashPayment: data.cashPayment || '', paymentStatus: data.paymentStatus || '',
      checklist: data.checklist, photosBefore: data.photosBefore || [], photosBeforeInternal: data.photosBeforeInternal || [], videosBefore: data.videosBefore || [],
      photosSesudah: [], photosProses: [], videosAfter: [], documents: [],
      signature: null, notes: [],
      auditLog: [{ at: Date.now(), by: staff || 'Staff', action: 'Servis diterima & dicatat' }],
    };
    try {
      setErrMsg('Menyimpan data dan foto ke Supabase…');
      const saved = await createCloudTicket(t);
      await saveLocalBackup([saved, ...tickets]);
      setErrMsg('');
      setView('servis');
    } catch (e) {
      setErrMsg(`Gagal menyimpan ke Supabase: ${e.message}`);
    }
  };

  const updateTicket = async (t) => {
    try {
      setErrMsg('Menyimpan perubahan ke Supabase…');
      const saved = await updateCloudTicket(t);
      await saveLocalBackup(tickets.map(x => x.id === saved.id ? saved : x));
      setErrMsg('');
    } catch (e) { setErrMsg(`Gagal memperbarui Supabase: ${e.message}`); }
  };
  const deleteTicket = async (id) => {
    try {
      const target = tickets.find(x => x.id === id);
      await deleteCloudTicket(target);
      await saveLocalBackup(tickets.filter(x => x.id !== id));
      setView('servis');
    } catch (e) { setErrMsg(`Gagal menghapus dari Supabase: ${e.message}`); }
  };

  const filtered = tickets.filter(t => {
    const okStatus = statusFilter === 'semua' || t.status === statusFilter;
    const okSumber = (t.sumberServis || 'customer') === sumberTab;
    const q = query.toLowerCase();
    const okQuery = !q || t.customerName.toLowerCase().includes(q) || t.phoneModel.toLowerCase().includes(q) || (t.segelNumber || '').toLowerCase().includes(q);
    return okStatus && okSumber && okQuery;
  });

  // Khusus tampilan PC: dua daftar terpisah (Customer & TUSER) supaya bisa
  // ditampilkan berdampingan sekaligus, tanpa perlu klik tab.
  const filterBySumber = (sumber) => tickets.filter(t => {
    const okStatus = statusFilter === 'semua' || t.status === statusFilter;
    const okSumber = (t.sumberServis || 'customer') === sumber;
    const q = query.toLowerCase();
    const okQuery = !q || t.customerName.toLowerCase().includes(q) || t.phoneModel.toLowerCase().includes(q) || (t.segelNumber || '').toLowerCase().includes(q);
    return okStatus && okSumber && okQuery;
  });
  const filteredCustomerPC = filterBySumber('customer');
  const filteredTuserPC = filterBySumber('tuser');
  const renderTicketCard = (t) => {
    const r = ticketReminder(t);
    return (
      <button key={t.id} onClick={() => { setActiveId(t.id); setView('detail'); }}
        style={{ borderLeftStyle: 'dashed', borderLeftWidth: 3 }}
        className={`flex w-full items-center justify-between rounded-xl border p-3.5 text-left hover:border-amber-600/50 ${r?.level === 'tinjau' ? 'border-red-700 bg-red-950/20' : r?.level === 'terlambat' ? 'border-orange-700/70 bg-orange-950/15' : r?.level === 'perhatian' ? 'border-amber-700/70 bg-amber-950/15' : 'border-slate-800 bg-slate-900/50'}`}>
        <div>
          <p className="font-mono text-[11px] text-amber-400">#{t.segelNumber || '—'}</p>
          <p className="font-medium text-slate-100">{t.phoneModel}</p>
          <p className="text-xs text-slate-400">{t.customerName} · {fmtDate(t.createdAt)}</p>
          {r ? <p className={`mt-0.5 text-[11px] font-medium ${r.level === 'tinjau' ? 'text-red-400' : r.level === 'terlambat' ? 'text-orange-400' : 'text-amber-400'}`}>{r.badge} · {r.label}</p> : null}
        </div>
        <Badge statusKey={t.status} />
      </button>
    );
  };

  const active = tickets.find(t => t.id === activeId);
  const urgentCount = tickets.filter(t => ticketReminder(t)).length;

  return (
    <div className="flex min-h-screen overflow-x-hidden bg-slate-950 text-slate-100">
      {/* Sidebar — tampil mulai layar tablet/PC ke atas */}
      <aside className="hidden w-56 flex-shrink-0 flex-col border-r border-slate-800 bg-slate-900/60 sm:flex">
        <div className="flex items-center gap-2 border-b border-slate-800 px-4 py-4">
          <div className="rounded-lg bg-amber-500/10 p-1.5"><Wrench className="h-4 w-4 text-amber-400" /></div>
          <span className="text-sm font-semibold tracking-tight">Servis HP</span>
        </div>
        <nav className="flex-1 space-y-1 px-2 py-3">
          {[
            { key: 'stats', label: 'Dashboard', icon: LayoutDashboard },
            { key: 'servis', label: 'Servis', icon: Wrench },
            { key: 'jadwal', label: 'Jadwal Kerja', icon: CalendarClock, badge: urgentCount },
            { key: 'kas', label: 'Pembukuan Kas', icon: DollarSign },
            { key: 'laporan', label: 'Laporan', icon: TrendingUp },
          ].map(item => {
            const isActive = view === item.key || (item.key === 'servis' && (view === 'detail' || view === 'new'));
            return (
              <button key={item.key} onClick={() => setView(item.key)} className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm ${isActive ? 'bg-amber-500/10 text-amber-400' : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'}`}>
                <item.icon className="h-4 w-4 flex-shrink-0" />
                <span className="flex-1 text-left">{item.label}</span>
                {!!item.badge && <span className="rounded-full bg-red-500/20 px-1.5 text-[10px] text-red-400">{item.badge}</span>}
              </button>
            );
          })}
        </nav>
        <div className="border-t border-slate-800 p-3">
          <input value={staff} onChange={e => setStaff(e.target.value)} placeholder="Nama staf (untuk log)" className="w-full rounded-lg border border-slate-700 bg-slate-900 px-2.5 py-1.5 text-xs text-slate-200 outline-none focus:border-amber-500" />
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
      <div className="border-b border-slate-800 bg-slate-900/60 px-4 py-3 sm:hidden">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <div className="rounded-lg bg-amber-500/10 p-1.5"><Wrench className="h-4 w-4 text-amber-400" /></div>
            <span className="text-sm font-semibold tracking-tight">Servis HP · Manajemen</span>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setView('jadwal')} className="relative rounded-lg border border-slate-700 p-1.5 text-slate-300 hover:bg-slate-800">
              <Bell className="h-4 w-4" />
              {urgentCount > 0 && <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">{urgentCount}</span>}
            </button>
            <input value={staff} onChange={e => setStaff(e.target.value)} placeholder="Nama staf (untuk log)" className="w-40 rounded-lg border border-slate-700 bg-slate-900 px-2.5 py-1.5 text-xs text-slate-200 outline-none focus:border-amber-500" />
          </div>
        </div>
        <div className="mx-auto mt-2 max-w-7xl text-sm">
          <div>
            <button onClick={() => setView('stats')} className={`flex items-center gap-1 ${view === 'stats' ? 'text-amber-400' : 'text-slate-400 hover:text-slate-200'}`}><LayoutDashboard className="h-3.5 w-3.5" />Dashboard</button>
          </div>
          <div className="mt-2 flex flex-wrap gap-4">
            <button onClick={() => setView('servis')} className={view === 'servis' || view === 'detail' || view === 'new' ? 'text-amber-400' : 'text-slate-400 hover:text-slate-200'}>Servis</button>
            <button onClick={() => setView('jadwal')} className={`flex items-center gap-1 ${view === 'jadwal' ? 'text-amber-400' : 'text-slate-400 hover:text-slate-200'}`}>Jadwal Kerja{urgentCount > 0 ? <span className="rounded-full bg-red-500/20 px-1.5 text-[10px] text-red-400">{urgentCount}</span> : null}</button>
            <button onClick={() => setView('kas')} className={view === 'kas' ? 'text-amber-400' : 'text-slate-400 hover:text-slate-200'}>Pembukuan Kas</button>
            <button onClick={() => setView('laporan')} className={view === 'laporan' ? 'text-amber-400' : 'text-slate-400 hover:text-slate-200'}>Laporan</button>
          </div>
        </div>
      </div>

      {/* Header ringkas khusus PC — sidebar sudah menangani menu & nama staf */}
      <div className="hidden border-b border-slate-800 bg-slate-900/60 px-4 py-3 sm:block">
        <div className="mx-auto flex max-w-7xl items-center justify-end">
          <button onClick={() => setView('jadwal')} className="relative rounded-lg border border-slate-700 p-1.5 text-slate-300 hover:bg-slate-800">
            <Bell className="h-4 w-4" />
            {urgentCount > 0 && <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">{urgentCount}</span>}
          </button>
        </div>
      </div>

      {errMsg && (
        <div className="mx-auto mt-3 max-w-7xl rounded-lg border border-red-800 bg-red-950/40 px-3 py-2 text-xs text-red-300">{errMsg}</div>
      )}

      <div className="mx-auto max-w-7xl px-4 py-6">
        {view === 'stats' && <Dashboard tickets={tickets} kas={kas} toko={toko} onSaveToko={saveToko} hapusSetting={hapusSetting} onSaveHapusSetting={saveHapusSetting} />}

        {view === 'jadwal' && (
          <JadwalKerja tickets={tickets} notifOn={notifOn} onToggleNotif={toggleNotif} notifSupported={notifSupported}
            onOpen={(id) => { setActiveId(id); setView('detail'); }} />
        )}

        {view === 'servis' && (
          <div>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h1 className="text-lg font-semibold">Daftar Servis</h1>
              <button onClick={() => setView('new')} className="flex items-center gap-1.5 rounded-lg bg-amber-500 px-3 py-2 text-sm font-medium text-slate-950 hover:bg-amber-400"><Plus className="h-4 w-4" />Servis Baru</button>
            </div>

            <div className="mt-4 flex gap-1 border-b border-slate-800 sm:hidden">
              <button onClick={() => setSumberTab('customer')} className={`border-b-2 px-3 py-2 text-sm font-medium ${sumberTab === 'customer' ? 'border-amber-500 text-amber-400' : 'border-transparent text-slate-400 hover:text-slate-200'}`}>CUSTOMER</button>
              <button onClick={() => setSumberTab('tuser')} className={`border-b-2 px-3 py-2 text-sm font-medium ${sumberTab === 'tuser' ? 'border-amber-500 text-amber-400' : 'border-transparent text-slate-400 hover:text-slate-200'}`}>TUSER</button>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              <div className="relative flex-1 min-w-[160px]">
                <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-slate-500" />
                <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Cari nama, tipe HP, no. segel..." className="w-full rounded-lg border border-slate-700 bg-slate-900 px-8 py-2 text-sm text-slate-100 outline-none focus:border-amber-500" />
              </div>
              <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="rounded-lg border border-slate-700 bg-slate-900 px-2 py-2 text-sm text-slate-200">
                <option value="semua">Semua Status</option>
                {STATUS.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
              </select>
            </div>

            {/* HP: satu daftar sesuai tab yang dipilih */}
            <div className="mt-4 space-y-2 sm:hidden">
              {filtered.map(renderTicketCard)}
              {!filtered.length && <p className="py-10 text-center text-sm text-slate-500">Belum ada servis yang tercatat.</p>}
            </div>

            {/* PC: Customer & TUSER tampil berdampingan sekaligus, tidak perlu klik tab */}
            <div className="mt-4 hidden gap-4 sm:grid sm:grid-cols-2">
              <div>
                <p className="mb-2 text-sm font-semibold text-amber-400">CUSTOMER</p>
                <div className="space-y-2">
                  {filteredCustomerPC.map(renderTicketCard)}
                  {!filteredCustomerPC.length && <p className="py-6 text-center text-sm text-slate-500">Belum ada servis Customer.</p>}
                </div>
              </div>
              <div>
                <p className="mb-2 text-sm font-semibold text-amber-400">TUSER</p>
                <div className="space-y-2">
                  {filteredTuserPC.map(renderTicketCard)}
                  {!filteredTuserPC.length && <p className="py-6 text-center text-sm text-slate-500">Belum ada servis TUSER.</p>}
                </div>
              </div>
            </div>
          </div>
        )}

        {view === 'new' && <NewTicketForm onCreate={createTicket} onCancel={() => setView('servis')} />}

        {view === 'detail' && active && (
          <TicketDetail ticket={active} staff={staff} portalUrl={portalUrl} toko={toko} hapusSetting={hapusSetting}
            onBack={() => setView('servis')} onUpdate={updateTicket} onDelete={deleteTicket} />
        )}

        {view === 'kas' && (
          <KasView kas={kas} onAdd={(e) => persistKas([...kas, e])} onDelete={(id) => persistKas(kas.filter(k => k.id !== id))} />
        )}

        {view === 'laporan' && <LaporanView tickets={tickets} />}
      </div>

      <div className="mx-auto max-w-7xl px-4 pb-8">
        <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-3 text-[11px] text-slate-500">
          <p className="mb-1 font-medium text-slate-400">Catatan URL Portal Pelanggan (untuk QR)</p>
          <input value={portalUrl} onChange={e => { setPortalUrl(e.target.value); window.storage.set('sh_portal_url', e.target.value, true).catch(() => {}); }}
            placeholder="isi setelah aplikasi ini di-hosting sendiri, cth: https://servishp.tokosaya.com"
            className="w-full rounded-md border border-slate-800 bg-slate-950 px-2 py-1.5 text-xs text-slate-300 outline-none focus:border-amber-500" />
        </div>
      </div>
      </div>
    </div>
  );
}
