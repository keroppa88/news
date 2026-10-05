import path from 'node:path';
import {fileURLToPath} from 'node:url';
const required=['Save news and normal web page','Generate optional newspaper edition','Save newspaper edition'];
export async function verifyEdition({env=process.env,fetchImpl=fetch}={}){
  const headers={Authorization:`Bearer ${env.GITHUB_TOKEN}`,Accept:'application/vnd.github+json'};
  const get=async suffix=>{const r=await fetchImpl(`https://api.github.com/repos/${env.GITHUB_REPOSITORY}/actions/${suffix}`,{headers});if(!r.ok)throw Error(`Cannot verify edition: HTTP ${r.status}`);return r.json();};
  let runs;
  if(env.NEWS_RUN_ID){
    if(!/^\d+$/.test(env.NEWS_RUN_ID))throw Error('Invalid news run ID');
    runs=[{id:env.NEWS_RUN_ID}];
  }else{
    const response=await get('runs?per_page=30');
    runs=response.workflow_runs.filter(r=>r.name==='Daily News Update'&&r.head_branch==='main'&&r.status==='completed'&&r.conclusion==='success');
  }
  for(const run of runs){
    const {jobs}=await get(`runs/${run.id}/jobs?per_page=100`);
    const steps=jobs.find(j=>j.name==='build')?.steps||[];
    if(required.every(name=>steps.some(s=>s.name===name&&s.conclusion==='success'))){console.log(`Both editions completed successfully in news run ${run.id}`);return run.id;}
  }
  throw Error('Cartoon skipped: no verified successful normal and paper edition');
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))await verifyEdition();
