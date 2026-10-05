import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
export function archiveName(manifest){
 if(!/^\d{4}-\d{2}-\d{2}$/.test(manifest.date||''))throw Error('Archive requires an edition date');
 const title=String(manifest.title||'').normalize('NFC').replace(/^「|」$/g,'').replace(/[<>:"/\\|?*\x00-\x1f]/g,'_').trim().replace(/[. ]+$/g,'');
 if(!title)throw Error('Archive requires a title');
 return manifest.date+'_'+[...title].slice(0,100).join('')+'.png';
}
export function archiveCartoon(root=ROOT){
 const image=path.join(root,'editorial-cartoon.png'),metadata=path.join(root,'editorial-cartoon.json');
 if(!fs.existsSync(image)||!fs.existsSync(metadata)){console.log('No cartoon to archive');return null;}
 const manifest=JSON.parse(fs.readFileSync(metadata,'utf8')),bytes=fs.readFileSync(image);
 const directory=path.join(root,'picturewarehohuse');fs.mkdirSync(directory,{recursive:true});
 const name=archiveName(manifest);let file=path.join(directory,name);
 if(fs.existsSync(file)){
  if(fs.readFileSync(file).equals(bytes)){console.log('Cartoon already archived: '+name);return file;}
  // Preserve both drawings if the same date and title is generated again.
  const suffix=crypto.createHash('sha256').update(bytes).digest('hex').slice(0,12);
  file=path.join(directory,name.slice(0,-4)+'_'+suffix+'.png');
  if(fs.existsSync(file)&&fs.readFileSync(file).equals(bytes))return file;
 }
 fs.writeFileSync(file,bytes,{flag:'wx'});console.log('Archived cartoon: '+path.basename(file));return file;
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))archiveCartoon();
