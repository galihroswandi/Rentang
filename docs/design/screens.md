# Layar

Acuan: kanvas desain "Contoh Desain Pelacak Gantt" milik pemilik proyek. Rincian tiap layar dibaca dari kanvas saat tahap yang membangunnya dimulai.

| No. | Layar                        | Tahap | Catatan                                                     |
| --- | ---------------------------- | ----- | ----------------------------------------------------------- |
| 1a  | Mulai (pertama kali dibuka)  | 1     | Impor `.gan`, buka `.rentang`, atau buat baru; pilih lokasi |
| 1b  | Laporan impor `.gan`         | 1     | Diimpor, diubah, dilewati                                   |
| 2   | Beranda (dibuka setiap hari) | 3     | Apa yang harus dikerjakan, lintas proyek                    |
| 3a  | Proyek › Gantt               | 1-2   | Tabel dan Gantt dalam satu kontainer scroll                 |
| 3b  | Gantt saat menyeret          | 2     | Pratinjau seret dan ubah durasi                             |
| 3c  | Proyek › Dokumen             | 3     | Halaman datar, editor TipTap                                |
| 4a  | Proyek › Resource            | 3     | Penugasan nama saja; pertama dipotong bila jadwal meleset   |
| 4b  | Proyek › Kalender            | 3     | Hari kerja dan hari libur                                   |
| 5   | Token dan komponen           | 0     | Diterapkan di [tokens.css](tokens.css)                      |

Prinsip UX dari kanvas:

1. Dua tingkat navigasi tetap: sidebar untuk posisi (Beranda, proyek per bidang), tab untuk tampilan di dalam proyek.
2. Beranda menjawab pertanyaan pertama setiap pagi: apa yang harus dikerjakan, lintas proyek.
3. Memperbarui harus murah: kemajuan diubah dengan sekali klik (0-25-50-75-100).
4. Pertama kali seperti draw.io: impor, buka, atau buat baru, lalu langsung pilih lokasi berkas.
5. Status simpan selalu terlihat di tempat yang sama.
6. Keyboard: N tugas baru, Enter ubah, Ctrl+Z urungkan, ? daftar pintasan.

Catatan skala: dengan 200 tugas, tabel dan Gantt berbagi satu kontainer scroll vertikal; header dan kolom nama menempel saat digulir.
