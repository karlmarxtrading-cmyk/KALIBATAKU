"""Write 00_MULAI_DI_SINI.html (root guide) and evidence/v13/00_INDEKS.html from the
verified binding and the generated registers. Run after `npm run qa:assess`."""
import csv, html, io, json
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
E = html.escape


def rows(name):
    return list(csv.DictReader(io.StringIO((ROOT / name).read_text(encoding='utf-8-sig'))))


CSS = """:root{--bg:#f6f7f4;--card:#fff;--ink:#172b27;--muted:#4f625b;--line:#c7d2cc;--green:#145c4b;--ok:#155e3a;--okb:#e7f5ec;--warn:#8a3b0d;--warnb:#fdf0e7;--info:#1a4f7a;--infob:#e8f1fb}
@media(prefers-color-scheme:dark){:root{--bg:#111d1a;--card:#192b25;--ink:#f1f6f1;--muted:#b4c9be;--line:#3d5c4f;--green:#8bd5b5;--ok:#a6e8c3;--okb:#173527;--warn:#ffc9a3;--warnb:#3b2316;--info:#b6d9f7;--infob:#172c40}}
*{box-sizing:border-box}body{margin:0;font:16px/1.55 system-ui,"Noto Sans",sans-serif;background:var(--bg);color:var(--ink)}main{max-width:72rem;margin:auto;padding:2rem clamp(1rem,4vw,3rem)}
h1{font-size:clamp(1.8rem,4vw,2.4rem);margin:.2rem 0 .6rem;letter-spacing:-.03em}h2{margin:2rem 0 .6rem}a{color:var(--green)}.muted{color:var(--muted)}
.card{background:var(--card);border:1px solid var(--line);border-radius:14px;padding:1rem 1.2rem;margin:.8rem 0}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(15rem,1fr));gap:.8rem}
table{border-collapse:collapse;width:100%;font-size:.93rem}th,td{border-bottom:1px solid var(--line);padding:.45rem .5rem;text-align:left;vertical-align:top}th{color:var(--muted);font-weight:650}
.b{display:inline-block;border-radius:999px;padding:.05rem .6rem;font-weight:700;font-size:.82rem;white-space:nowrap}.PASS,.FIXED_VERIFIED,.PREVIEW_PASS{background:var(--okb);color:var(--ok)}
.HOLD,.FAIL,.OPEN{background:var(--warnb);color:var(--warn)}.BLOCKED,.BLOCKED_ENV,.NOT_RUN,.NOT_PERFORMED,.DEFERRED_BY_SCOPE,.TECHNICAL_PASS_USABILITY_NOT_VALIDATED{background:var(--infob);color:var(--info)}
code{font-size:.9em;word-break:break-all}.verdict{font-size:1.15rem}img{max-width:100%;border:1px solid var(--line);border-radius:8px}figure{margin:0}figcaption{font-size:.85rem;color:var(--muted)}"""


def badge(s):
    return f'<span class="b {E(s)}">{E(s)}</span>'


def page(title, body):
    return f'<!doctype html><html lang="id"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>{E(title)}</title><style>{CSS}</style></head><body><main>{body}</main></body></html>\n'


def main():
    st = json.loads((ROOT / 'RELEASE_STATUS.json').read_bytes())
    binding = json.loads((ROOT / 'evidence/v13/qa/binding.json').read_bytes())
    ac, fm, qa, fd = rows('ACCEPTANCE_RESULTS.csv'), rows('ACCEPTANCE_FM.csv'), rows('PENUTUPAN_AUDIT_1.2.0.csv'), rows('TEMUAN_AUDIT_1.2.0.csv')
    tot = lambda xs: ' · '.join(f'{v} {k}' for k, v in sorted(Counter(xs).items()))
    scopes = ''.join(f"<tr><td>{E(k)}</td><td>{badge(v['status'])}</td><td>{E(v['claim_boundary'])}</td></tr>" for k, v in st['readiness'].items())
    finds = ''.join(f"<tr><td><b>{E(r['id'])}</b> {E(r['prioritas'])}</td><td>{E(r['judul'])}</td><td>{badge(r['status_1_3_0'])}</td><td class=muted>{E(r['tes_regresi'])}</td></tr>" for r in fd)
    open_rows = [(r['acceptance_id'], r['status'], r['sisa']) for r in ac if r['status'] != 'PASS'] + [(r['criterion_id'], r['status_new_build'], r['sisa']) for r in fm if r['status_new_build'] != 'PASS'] + [(r['id'], r['status_1_3_0'], r['sisa']) for r in qa if r['status_1_3_0'] != 'PASS']
    opens = ''.join(f"<tr><td>{E(a)}</td><td>{badge(b)}</td><td>{E(c)}</td></tr>" for a, b, c in open_rows)
    verdict = st['readiness']['static_application']['status']
    guide = f"""<p class=muted>KALIBATAKU · rilis statis</p><h1>KALIBATAKU {E(st['app_version'])}</h1>
<div class="card verdict">Status: {badge(verdict)} untuk produksi penuh. Folder yang di-host adalah <b>dist/</b>. Isi bank {E(st['bank_version'])} · build <code>{E(st['offline_release'])}</code>.</div>
<div class=grid>
<div class=card><h3>Menjalankan</h3><p><code>python3 tools/preview.py</code> lalu buka <code>http://127.0.0.1:4173/</code>. Deploy: <a href="docs/DEPLOY.md">docs/DEPLOY.md</a> (Cloudflare Pages, output <b>dist</b>).</p></div>
<div class=card><h3>Memeriksa</h3><p><code>npm run release:verify</code> memeriksa inventaris, checksum, sumber vs dist dan binding QA. Gerbang lengkap: <a href="docs/QA.md">docs/QA.md</a>.</p></div>
<div class=card><h3>Bukti</h3><p><a href="evidence/v13/00_INDEKS.html">Indeks bukti 1.3.0</a> · <a href="STATUS_RILIS.md">Status rilis</a> · <a href="TEMUAN_AUDIT_1.2.0.csv">Temuan audit</a></p></div>
<div class=card><h3>Perubahan</h3><p><a href="CHANGELOG_UIUX.md">Changelog</a> · <a href="DECISIONS.md">Keputusan</a> · <a href="docs/MIGRASI_1.3.md">Migrasi</a> · <a href="KNOWN_LIMITATIONS.md">Batas</a> · <a href="docs/PROTOKOL_GATE_EKSTERNAL.md">Protokol gate eksternal</a></p></div>
</div>
<h2>Status per lingkup</h2><div class=card><table><tr><th>Lingkup</th><th>Status</th><th>Batas klaim</th></tr>{scopes}</table></div>
<h2>Temuan audit 1.2.0</h2><div class=card><table><tr><th>ID</th><th>Judul</th><th>Status</th><th>Tes regresi</th></tr>{finds}</table></div>
<h2>Register</h2><div class=card><p>AC (80) · {E(tot(r['status'] for r in ac))}<br>FM (48) · {E(tot(r['status_new_build'] for r in fm))}<br>Kriteria penutupan audit (30) · {E(tot(r['status_1_3_0'] for r in qa))}</p>
<p>Gerbang produksi {badge(binding['status'])} · {len(binding['suites'])} suite · {binding['assertions']} assertion · dibuat {E(binding['created_utc'])}.</p></div>
<h2>Belum PASS</h2><div class=card><table><tr><th>ID</th><th>Status</th><th>Yang diperlukan</th></tr>{opens}</table></div>
<p class=muted>dist SHA-256 <code>{E(st['dist_tree_sha256'])}</code>. Tidak ada klaim pengujian perangkat fisik, pembaca layar, peserta, penelaah manusia atau deployment publik.</p>"""
    (ROOT / '00_MULAI_DI_SINI.html').write_text(page(f"KALIBATAKU {st['app_version']} · Mulai di sini", guide))
    suites = ''.join(f"<tr><td><code>{E(s['id'])}</code></td><td>{badge(s['status'])}</td><td>{s['assertions']}</td><td>{s['seconds']} s</td><td><a href='qa/{E(s['log'])}'>log</a> " + ' '.join(f"<a href='qa/{E(r['file'])}'>{E(Path(r['file']).name)}</a>" for r in s['receipts']) + f"</td><td class=muted>{E('; '.join(s['problems'])[:240])}</td></tr>" for s in binding['suites'])
    shots = ''.join(f"<figure class=card><img loading=lazy src='screens/{n}' alt=''><figcaption>{E(n)}</figcaption></figure>" for n in sorted(p.name for p in (ROOT / 'evidence/v13/screens').glob('*.png')))
    rt = binding['runtime']
    idx = f"""<p class=muted><a href="../../00_MULAI_DI_SINI.html">← Mulai di sini</a></p><h1>Bukti pengujian 1.3.0</h1>
<div class=card>Build <code>{E(binding['build']['offline_release'])}</code> · dist <code>{E(binding['build']['dist_tree_sha256'])}</code><br>Runtime: {E(rt['os'])} · Node {E(rt['node'])} · Python {E(rt['python'])} · {E(str(rt.get('chromium')))} · Playwright {E(str(rt.get('playwright')))}</div>
<p>Setiap baris berasal dari <a href="qa/binding.json">qa/binding.json</a>, yang memuat SHA-256 setiap log dan receipt dan diverifikasi ulang oleh <code>tools/assess.py</code>. Bukti 1.2.0 dan sebelumnya tetap di folder <code>evidence/</code> lain dan tidak diubah, kecuali bukti generasi bank (<code>evidence/bank/</code>) yang mengikuti bank 1.2.0; versi 1.1.0-nya diarsipkan di <a href="historical/bank-evidence-1.1.0.zip">historical/bank-evidence-1.1.0.zip</a>.</p>
<h2>Suite</h2><div class=card><table><tr><th>Suite</th><th>Status</th><th>Assertion</th><th>Durasi</th><th>Berkas</th><th>Catatan</th></tr>{suites}</table></div>
<h2>Bukti lain</h2><div class=card><ul>
<li><a href="audit-rerun/">audit-rerun/</a>: skrip reproduksi audit 1.2.0 dijalankan ulang pada rilis ini (verifier linear: 0 selisih).</li>
<li><a href="bank/">bank/</a>: identitas bank 1.1.0 per paket dan log editorial 1.1.0 → 1.2.0.</li>
<li><a href="historical/">historical/</a>: register 1.2.0, register temuan dan kriteria penutupan audit.</li>
<li><a href="release/">release/</a>: manifest rilis, dependensi dan uji arsip.</li></ul></div>
<h2>Sebelum dan sesudah</h2><p class=muted>Lihat <a href="screens/README.md">screens/README.md</a> untuk cara pembuatan.</p><div class=grid>{shots}</div>"""
    (ROOT / 'evidence/v13/00_INDEKS.html').write_text(page('KALIBATAKU 1.3.0 · Bukti pengujian', idx))
    print('wrote 00_MULAI_DI_SINI.html and evidence/v13/00_INDEKS.html')


if __name__ == '__main__':
    main()
