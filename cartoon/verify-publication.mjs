import fs from 'node:fs';
import {readConfirmedEdition,cartoonMatches} from '../newspaper/edition-contract.mjs';
const paper=JSON.parse(fs.readFileSync('newspaper.json','utf8'));
const cartoon=JSON.parse(fs.readFileSync('editorial-cartoon.json','utf8'));
if(!cartoonMatches(readConfirmedEdition('.'),paper,cartoon))throw Error('Cartoon does not belong to the current completed editions');
console.log('Illustration belongs to the completed normal and paper editions');
