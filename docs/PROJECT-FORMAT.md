# Format proyek Casecraft

`.casecraft.json` adalah format terbuka untuk pertukaran workspace Casecraft. Spesifikasi normatifnya berada di [`casecraft-project.schema.json`](./casecraft-project.schema.json) dan menggunakan JSON Schema 2020-12.

## Envelope

```json
{
  "format": "casecraft-project",
  "formatVersion": 1,
  "exportedAt": "2026-11-05T00:00:00.000Z",
  "collection": {
    "version": 3,
    "activeFeatureId": "checkout-abc123",
    "features": []
  }
}
```

- `formatVersion` mengatur kompatibilitas envelope file. Reader harus menolak versi mayor yang belum didukung.
- `collection.version` mengatur migrasi model workspace internal. Casecraft saat ini menormalisasi collection versi 2 dan 3 ke versi 3.
- Properti yang tidak dikenal di dalam collection dipertahankan sebisa mungkin agar ekstensi alat lain tidak langsung hilang. Envelope tetap ketat.
- ID requirement, test case, cycle, dan feature harus stabil. Alat lain tidak boleh mengganti ID hanya karena label berubah.
- Semua teks menggunakan UTF-8. Waktu memakai ISO 8601 ketika tersedia.

## Aturan interoperabilitas

1. Generator eksternal harus memakai empat key kategori: `happy`, `negative`, `edge`, atau `regression`.
2. Status QA memakai `Belum diuji`, `Lulus`, `Gagal`, atau `Terblokir` supaya file dapat dibuka kembali tanpa mapping tersembunyi.
3. Hubungan requirement–test case disimpan melalui `criterionIds`, bukan inferensi dari judul.
4. Hasil eksekusi berada di `cycle.results[caseId]`. Field status pada test case hanya merupakan proyeksi cycle aktif.
5. Data produksi asli, credential, token, dan secret tidak boleh dimasukkan. Gunakan Test Data Studio atau masking sebelum ekspor.
6. Automation result dapat menyimpan `automationRetries` dan `automationFlaky`; field tersebut adalah evidence, bukan diagnosis final.

## Kompatibilitas dan vendor lock-in

Schema ini boleh digunakan alat lain untuk membaca atau menghasilkan proyek tanpa menjalankan Casecraft. Implementasi tidak perlu memakai generator Casecraft, tetapi harus mematuhi ID, kategori, status, dan relasi yang dinyatakan schema. Tidak ada field yang membutuhkan layanan jaringan atau akun Casecraft.
