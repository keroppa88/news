import fs from 'node:fs';
import {readConfirmedEdition,verifyPaper} from './edition-contract.mjs';
verifyPaper(readConfirmedEdition('.'),JSON.parse(fs.readFileSync('newspaper.json','utf8')));
console.log('Paper date, normal source hash, article count and every assigned source verified');
