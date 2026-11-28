"""Assemble measured browser screenshots into four annotated comparisons."""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
from tempfile import TemporaryDirectory
import hashlib,json,subprocess

ROOT=Path(__file__).resolve().parents[2]
OUT=ROOT/'evidence/ux/regressions'
frames=OUT/'frames'
def both(base,legacy,release):
    return [(base+'-old-'+a,b) for a,b in legacy]+[(base+'-new-'+a,b) for a,b in release]
groups={
    'S01':[(v+'-'+a,b) for v in ['old','new'] for a,b in [
        ('01-setup','Pilih paket P001, dua soal.'),
        ('02-five','Ketik 5 pada soal 0 + 5. Tekan Next tanpa Periksa.'),
        ('03-four','Ketik 4 pada soal 0 + 4. Buka konfirmasi.'),
        ('04-preview','Periksa jumlah jawaban dan soal kosong sebelum kirim.'),
        ('05-result','Hasil aktual setelah kedua jawaban dikirim.')]],
    'TB-01':both('tb01',[('01-personal','Laporan berasal dari latihan pribadi.'),('02-demo','Reset mengalihkan pratinjau ke Demo 01.')],
                        [('01-personal','Sumber dan siswa pribadi dipilih.'),('02-personal','Sesudah reset, siswa dan sumber pribadi tetap terpilih.')]),
    'TB-02':both('tb02',[('01-detail','Buka detail siswa Demo 04.'),('02-recipient','Form tugas menampilkan Demo 01.')],
                        [('01-detail','Buka detail siswa Demo 04.'),('02-recipient','Form tugas menampilkan Demo 04 dari kelas 4B.')]),
    'TB-03':both('tb03',[('01-note','Tulis catatan pada detail Demo 04.'),('02-note','Ganti bahasa ke Inggris. Isian menjadi kosong.')],
                        [('01-note','Tulis catatan pada detail Demo 04.'),('02-note','Ganti bahasa ke Inggris. Kalimat asli tetap tersedia.')])
}
def filehash(p):
    with p.open('rb') as f:return hashlib.file_digest(f,'sha256').hexdigest()
def font(name,size):
    try:return ImageFont.truetype(name,size)
    except OSError:return ImageFont.load_default(size=size)
reports={}
for case,steps in groups.items():
    with TemporaryDirectory() as tmp:
        tmp=Path(tmp)
        seen=[]
        for i,(stem,caption) in enumerate(steps):
            src=frames/(stem+'.jpg')
            with Image.open(src) as page:
                w=(page.width+1)//2*2; h=(page.height+1)//2*2
                image=Image.new('RGB',(w,h+84),'#f1f4f0');image.paste(page.convert('RGB'),(0,84))
            draw=ImageDraw.Draw(image)
            older='old-' in stem
            draw.text((22,8),f'{case}   ·   KALIBATAKU  '+('1.0.0' if older else '1.1.0'),font=font('DejaVuSans-Bold.ttf',19),fill='#145c4b')
            draw.text((22,41),caption,font=font('DejaVuSans.ttf',23),fill='#172b27')
            image.save(tmp/f'frame-{i:02d}.png')
            seen.append({'file':src.relative_to(OUT).as_posix(),'sha256':filehash(src),'caption':caption,'version':'1.0.0' if older else '1.1.0'})
        target=OUT/(case+'.mp4')
        subprocess.run(['ffmpeg','-v','error','-nostdin','-y','-framerate','1/2','-i',str(tmp/'frame-%02d.png'),
            '-vf','fps=24,format=yuv420p','-c:v','libx264','-preset','fast','-crf','19','-threads','2','-movflags','+faststart',str(target)],check=True)
        info=json.loads(subprocess.check_output(['ffprobe','-v','error','-select_streams','v:0','-show_entries','stream=codec_name,width,height,duration','-of','json',str(target)]))
        assert abs(float(info['streams'][0]['duration'])-2*len(steps)) < 0.05
        reports[case]={'mp4':target.name,'sha256':filehash(target),'duration_s':float(info['streams'][0]['duration']),'frames':seen}
manifest=json.loads((ROOT/'dist/offline-assets.json').read_bytes())
(OUT/'index.json').write_text(json.dumps({'final_offline_release':manifest['release'],
  'baseline_archive_sha256':'47594d89f492b440b365a080ba7654f136eef3bcd1537c5d241333c27f9cf3e9',
  'method':'Key-state screenshots captured from actual browser interactions, displayed for two seconds each. The MP4 sequences use editorial playback timing. Original unmodified captures are under frames/.',
  'clips':reports},ensure_ascii=False,indent=2)+'\n')
print({k:d['duration_s'] for k,d in reports.items()})
