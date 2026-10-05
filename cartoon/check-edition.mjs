// Read the completed news workflow's steps; never modify or rerun it.
let runId=process.env.NEWS_RUN_ID;
if(!runId){
  const runs=await fetch(`https://api.github.com/repos/${process.env.GITHUB_REPOSITORY}/actions/workflows/run.yml/runs?branch=main&status=success&per_page=1`,{headers:{Authorization:`Bearer ${process.env.GITHUB_TOKEN}`,Accept:'application/vnd.github+json'}});
  if(!runs.ok)throw Error(`Cannot find a completed news edition: HTTP ${runs.status}`);
  runId=String((await runs.json()).workflow_runs?.[0]?.id||'');
}
if(!/^\d+$/.test(runId||''))throw Error('Missing completed news run ID');
const response=await fetch(`https://api.github.com/repos/${process.env.GITHUB_REPOSITORY}/actions/runs/${runId}/jobs?per_page=100`,{headers:{Authorization:`Bearer ${process.env.GITHUB_TOKEN}`,Accept:'application/vnd.github+json'}});
if(!response.ok)throw Error(`Cannot verify edition completion: HTTP ${response.status}`);
const {jobs}=await response.json();
const steps=jobs.find(j=>j.name==='build')?.steps||[];
for(const name of ['Save news and normal web page','Generate optional newspaper edition','Save newspaper edition']){
  if(!steps.some(s=>s.name===name&&s.conclusion==='success'))throw Error(`Cartoon skipped: edition step did not succeed: ${name}`);
}
console.log('Both editions completed successfully');
