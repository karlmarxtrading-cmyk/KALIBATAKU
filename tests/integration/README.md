# Acceptance harness

Use the released folder as the working directory. First run `npm run build`. Running `npm run test:e2e` requires Python 3.10+, Playwright for Python, and its Chromium browser. To select an existing installation, set `CHROMIUM_PATH` to its executable. The production app has no dependency on Playwright or on this test server.

```bash
python3 -m pip install playwright
python3 -m playwright install chromium
npm run test:e2e
python3 tests/integration/budgets.py
```

For an interactive run, start `python3 tests/integration/fixture_server.py --port 5173` and open `http://127.0.0.1:5173/__qa/integration/`. Use a fresh isolated local browser profile. A button launches each set of checks with synthetic records. The test window is a real top-level browsing context so the release's anti-framing, CSP and MIME protections apply. Results are displayed and recorded under `evidence/acceptance/browser-*.json`. The server writes only named test receipts from its own origin. It serves `dist/` at both the root and `/school/math/`. Transient fault prefixes simulate one failed response or slow catalog requests. The release only deploys `dist/`.

The layout report distinguishes the requested viewport from the actual browser viewport. The browser's accessibility names and keyboard behavior are checked separately from a human assistive-technology evaluation. Transfer sizes recorded by the browser are measurements on the named test transport. The bundle report independently compresses the shipped bytes using gzip level 6. Local performance measurements are laboratory observations on the tested environment. Real-device virtual keyboards, screen reader speech, WebKit/Firefox, and field Core Web Vitals may only be reported as measured when the evidence explicitly names them.

## Uji perbaikan 1.1.0

Jalankan `python3 tests/integration/ux_server.py --port 5173`, lalu buka `http://127.0.0.1:5173/` pada profil browser sintetis. Konsol ini menguji interaksi siswa, guru, tema, dan tata letak terhadap `dist/`. Berikan `--baseline /path/ke/1.0.0/dist --guide /path/ke/00_BUKA_PANDUAN.html` untuk mengulang reproduksi asli. Bukti browser memuat waktu, mesin, perilaku teramati, dan identitas modul yang disajikan. Folder `evidence/ux/acceptance` menyimpan hasil. Pembesaran teks dua kali dan viewport CSS yang disimulasikan ditandai terpisah dari perangkat atau pembaca layar fisik.
