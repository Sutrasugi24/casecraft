# Casecraft Self-hosted Team Edition — batas arsitektur

Dokumen ini mendefinisikan syarat sebelum edisi tim dibangun. Edisi lokal tetap browser-only, tanpa autentikasi, backend, atau sinkronisasi jaringan.

## Bukti kebutuhan sebelum implementasi

Pengembangan dimulai hanya jika riset penggunaan menunjukkan kebutuhan berulang untuk kepemilikan bersama workspace, konflik lintas pengguna, approval formal, dan retensi audit. Permintaan ekspor atau backup saja tidak cukup untuk membenarkan backend.

## Pemisahan edisi

- Paket lokal tidak boleh diam-diam mengaktifkan jaringan atau meminta akun.
- Team edition memakai entry point, konfigurasi, penyimpanan, dan kebijakan privasi terpisah.
- Format `.casecraft.json`, mesin generator, quality gate, dan Plugin SDK tetap menjadi core terbuka yang dapat dipakai kedua edisi.
- Sinkronisasi harus menjadi adapter di atas model proyek, bukan perubahan yang membuat file lokal tidak dapat dibaca.

## Kebijakan yang wajib tersedia

Sebelum kode backend dibuat, sumber otoritatif harus menetapkan:

1. autentikasi dan session lifecycle;
2. role serta permission untuk view, edit, execute, approve, dan administer;
3. aturan review approval dan pemisahan tugas;
4. audit trail immutable: actor, action, object, outcome, waktu, dan timezone;
5. klasifikasi PII, lokasi data, enkripsi, backup, retention, serta penghapusan;
6. conflict resolution, versioning, offline queue, dan idempotency;
7. tenant isolation, rate limit, observability, incident response, dan pemulihan bencana.

## Model awal yang disarankan

Role awal dapat dipertimbangkan sebagai `viewer`, `qa`, `reviewer`, dan `admin`, tetapi tidak menjadi kontrak sampai permission policy disetujui. Approval tidak boleh disimpulkan hanya dari role; event approval harus menyimpan versi requirement dan test case yang benar-benar ditinjau.

Audit log tidak dapat diedit atau dihapus melalui UI biasa. Koreksi menjadi event baru. Sinkronisasi memakai optimistic concurrency dengan version token; overwrite paksa memerlukan permission eksplisit dan meninggalkan audit event.

## Privacy gate

Team edition wajib menampilkan mode jaringan, tujuan sinkronisasi, jenis data yang dikirim, retention, dan administrator data sebelum koneksi pertama. Test Data Studio tetap mengingatkan agar data produksi tidak digunakan, dan secret tidak boleh disimpan dalam fixture atau project export.
