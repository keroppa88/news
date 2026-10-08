import fs from 'node:fs';
import {normalEdition} from './edition-contract.mjs';
const edition=normalEdition(fs.readFileSync('summary2.txt','utf8'));
fs.writeFileSync('news-edition.json.tmp',JSON.stringify(edition,null,2)+'\n');
fs.renameSync('news-edition.json.tmp','news-edition.json');
console.log(`Confirmed normal edition: ${edition.date} ${edition.sourceHash}`);
