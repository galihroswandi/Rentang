# 0001. Mencatat keputusan arsitektur

- **Status:** Diterima
- **Tanggal:** 2026-10-17

## Konteks

Proyek ini dipamerkan sebagai portofolio. Pembaca (recruiter, calon klien, atau saya sendiri beberapa bulan lagi) perlu memahami _mengapa_ sesuatu dibuat begitu, bukan hanya _apa_ yang dibuat. Alasan yang hanya ada di kepala atau di riwayat chat akan hilang.

## Keputusan

Setiap keputusan arsitektur yang tidak sepele dicatat sebagai ADR singkat di `docs/adr/`, dengan nama `NNNN-judul-kebab.md` dan bagian:

- **Status:** Diusulkan, Diterima, Digantikan oleh NNNN, atau Ditolak.
- **Konteks:** masalah dan batasan yang ada.
- **Keputusan:** apa yang dipilih.
- **Alternatif:** opsi lain yang dipertimbangkan dan alasan tidak dipilih.
- **Konsekuensi:** dampak positif dan negatif yang diterima.

ADR yang sudah diterima tidak diubah isinya. Bila keputusan berubah, buat ADR baru yang menggantikannya dan perbarui status ADR lama.

## Alternatif

- **Tanpa catatan:** paling cepat, tapi alasan keputusan hilang dan sulit dijelaskan saat wawancara.
- **Satu dokumen desain besar:** cepat usang dan sulit ditelusuri per keputusan.
- **Wiki atau alat eksternal:** terpisah dari kode dan tidak ikut versi repo.

## Konsekuensi

- Ada sedikit biaya menulis per keputusan (±10–15 menit).
- Riwayat keputusan ikut versi kode dan bisa ditinjau lewat PR.
- Indeks di `docs/adr/README.md` perlu diperbarui setiap ADR baru.
