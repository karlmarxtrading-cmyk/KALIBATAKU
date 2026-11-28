// Offline operator utility. Private keys stay on the signer’s device; no network APIs are used.
import {generateKeyPairSync, createPublicKey, sign, verify} from 'node:crypto';
import {readFileSync, writeFileSync} from 'node:fs';
const [, , action, file, party, privatePath] = process.argv;
try {
  if (action === 'keygen') {
    const pair = generateKeyPairSync('ed25519');
    writeFileSync(file, pair.privateKey.export({type:'pkcs8',format:'pem'}), {flag:'wx',mode:0o600});
    console.log(pair.publicKey.export({type:'spki',format:'der'}).toString('base64'));
  } else if (action === 'sign' && ['operator','reviewer'].includes(party) && file.endsWith('.json')) {
    const signature = sign(null, readFileSync(file), readFileSync(privatePath));
    writeFileSync(file.slice(0,-5)+'.'+party+'.sig', signature.toString('base64')+'\n', {flag:'wx'});
  } else if (action === 'verify') {
    const records = JSON.parse(readFileSync(0,'utf8'));
    for (const {body,parties} of records) {
      for (const [key,sig] of parties) {
        const publicKey = createPublicKey({type:'spki',format:'der',key:Buffer.from(key,'base64')});
        if (publicKey.asymmetricKeyType !== 'ed25519' || !verify(null,Buffer.from(body,'base64'),publicKey,Buffer.from(sig,'base64'))) throw Error('Invalid signature');
      }
    }
  } else throw Error('Usage: keygen PRIVATE.pem | sign RECEIPT.json operator|reviewer PRIVATE.pem');
} catch (error) {
  console.error(error.message); process.exitCode=1;
}
