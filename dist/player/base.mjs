import {formula,mathProse} from '../math/view.mjs';
import {decimalPreference} from '../math/model.mjs';

export function node(tag,cls='',value) {
  const n=document.createElement(tag);if(cls)n.className=cls;if(value!=null)n.textContent=value;return n;
}
export function button(text,act,kind='') {
  const b=node('button','kp-btn '+kind,text);b.type='button';b.addEventListener('click',act);return b;
}
export function add(parent,...children) {parent.append(...children.filter(v=>v!==null&&v!==undefined));return parent;}
export const modeNames={practice:['Latihan','Practice'],speed:['Tantangan waktu','Speed'],assessment:['Evaluasi','Assessment'],adaptive:['Latihan adaptif','Adaptive practice'],recovery:['Perbaikan kesalahan','Mistake recovery']};
export const opNames={ADD:['Penjumlahan','Addition'],SUB:['Pengurangan','Subtraction'],MUL:['Perkalian','Multiplication'],DIV:['Pembagian','Division'],MIX:['Operasi campuran','Mixed operations']};
export const outcomes={correct:['Benar','Correct'],incorrect:['Salah','Incorrect'],skipped:['Dilewati','Skipped'],blank:['Kosong','Blank'],unseen:['Belum dilihat','Unseen']};
export const recommendations={collect:['Kumpulkan dua evaluasi sebanding untuk menentukan latihan berikutnya.','Complete two comparable assessments to guide your next practice.'],prerequisite:['Dua evaluasi terakhir di bawah 70%. Latihan ini menguatkan prasyarat.','Both recent assessments scored below 70%. This practice revisits a prerequisite.'],vary:['Coba variasi baru pada kompetensi yang sama.','Practise a different set within the same competency.'],assess:['Kedua evaluasi terakhir mencapai 90%. Coba form evaluasi berikutnya.','Both recent assessments reached 90%. Try the next assessment form.']};
export const statusText={not_started:['Belum dievaluasi','Not assessed'],insufficient_evidence:['Bukti terbatas','Limited evidence'],developing:['Sedang berkembang','Developing'],mastered_provisional:['Dikuasai sementara','Provisionally mastered']};
export function operation(a,L){return L(...(opNames[a.operation]||['Operasi','Operation']));}
export function mode(a,L){return L(...(modeNames[a.mode]||['Latihan','Practice']));}
export function fmtPct(n,l){return n==null?'—':new Intl.NumberFormat(l,{maximumFractionDigits:1,style:'percent'}).format(n/100);}
export function gradeLabel(a,L){return L('Kelas '+a.grade+' · Level '+a.level,'Grade '+a.grade+' · Level '+a.level);}
export function date(iso,l){return iso?new Intl.DateTimeFormat(l,{dateStyle:'medium',timeStyle:'short'}).format(new Date(iso)):'—';}
export function answerError(code,L) {
  const errors={
    EMPTY:['Isi jawaban dahulu.','Enter an answer first.'],
    WRONG_DECIMAL_SEPARATOR:['Gunakan pemisah desimal sesuai bahasa yang tercantum.','Use the decimal separator for the indicated language.'],
    INCOMPLETE:['Lengkapi angka atau pecahannya.','Finish entering your number or fraction.'],
    ZERO_DENOMINATOR:['Penyebut harus lebih besar dari nol.','The denominator must be greater than zero.'],
    DENOMINATOR_MUST_BE_POSITIVE:['Letakkan tanda minus pada pembilang.','Put the minus sign on the numerator.'],
    GROUPING_NOT_ALLOWED:['Tulis angka tanpa pemisah ribuan.','Enter the number without thousands separators.'],
    INPUT_TOO_LONG:['Gunakan paling banyak 80 karakter.','Use at most 80 characters.'],
    DIRTY_INVALID:['Perbaiki jawaban ini atau pilih “Tandai kosong” sebelum melanjutkan.','Correct this answer or choose “Mark blank” before continuing.'],
    LOCKED:['Sesi terbuka di tab lain.','This session is open in another tab.'],
    STALE_REVISION:['Sesi berubah di tab lain. Muat ulang untuk melihat respons terbaru.','This session changed in another tab. Reload to see the latest response.'],
    QUOTA_EXCEEDED:['Penyimpanan penuh. Unduh salinan sesi sebelum menutup halaman.','Storage is full. Download a session copy before closing the page.'],
    FINALIZED:['Sesi ini sudah selesai.','This session is already complete.']
  };
  return L(...(errors[code]||['Gunakan angka, tanda desimal, atau garis pecahan.','Use digits, a decimal separator, or a fraction slash.']));
}
export function downloadSession(a) {
  const url=URL.createObjectURL(new Blob([JSON.stringify(a,null,2)],{type:'application/json'}));
  const anchor=document.createElement('a');anchor.href=url;anchor.download='KALIBATAKU-session-'+a.attempt_id+'.json';anchor.click();setTimeout(()=>URL.revokeObjectURL(url),10000);
}

export function workedMethod(question,lang){
  const box=node('div'), explanation=question.explanation?.[lang], seen=new Set();
  if(explanation){add(box,mathProse(explanation,lang));seen.add(explanation.trim());}
  const list=node('ol');
  for(const step of question.solution_steps||[]){
    const text=step.text?.[lang]?.trim(), row=node('li');
    if(text&&!seen.has(text)){add(row,mathProse(text,lang));seen.add(text);}
    if(step.expression_ast?.kind==='binary'||!row.childElementCount){
      add(row,add(node('div','kp-step-expression'),formula(step.expression_ast,lang,decimalPreference(question))));
    }
    add(list,row);
  }
  if(list.children.length)add(box,list);
  return box;
}

// Steps for the feedback card and review: each step shows its full equivalent
// expression; its note is shown only when it adds something beyond the idea text.
export function stepList(question,lang){
  const list=node('ol','step-list'),idea=question.explanation?.[lang]?.trim();
  for(const step of question.solution_steps||[]){
    const row=node('li'),text=step.text?.[lang]?.trim(),final=step.expression_ast?.kind==='rational';
    if(final)row.className='final';
    add(row,add(node('div','kp-step-expression'),formula(step.expression_ast,lang,decimalPreference(question))));
    // The last step already shows the value; its sentence would only repeat it.
    if(text&&text!==idea&&!final)add(row,add(node('p','step-note'),mathProse(text,lang)));
    add(list,row);
  }
  return list;
}
