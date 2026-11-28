import {invariant} from './common.js';

const utf8=new TextEncoder();
export const JSON_MAX_BYTES=50*1024*1024;

// JSON.stringify joins the entries of each array with one ASCII comma. Measure
// that exact wire representation a row at a time so a ZIP-sized profile never
// has to fit in one JavaScript string just to decide that it needs ZIP.
export function assertJsonBackupSize(backup){
  const tables=['attempts','events','records'];
  const empty=Object.fromEntries(tables.map(table=>[table,[]]));
  let bytes=utf8.encode(JSON.stringify({...backup,records:empty})).byteLength;
  invariant(bytes<=JSON_MAX_BYTES,'BACKUP_TOO_LARGE');
  for(const table of tables){
    const records=backup.records[table];
    bytes+=Math.max(0,records.length-1);
    for(const record of records){
      bytes+=utf8.encode(JSON.stringify(record)).byteLength;
      invariant(bytes<=JSON_MAX_BYTES,'BACKUP_TOO_LARGE');
    }
  }
}
