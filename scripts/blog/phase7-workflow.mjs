const SHA40=/^[0-9a-f]{40}$/i;

export function assertPreparedBase(checkoutSha,remoteMainSha){
  if(!SHA40.test(String(checkoutSha||''))||!SHA40.test(String(remoteMainSha||'')))throw new Error('base_sha_unavailable');
  if(String(checkoutSha)!==String(remoteMainSha))throw new Error('main_advanced_during_prepare');
  return String(checkoutSha);
}

export function isConfirmedProgressResponse(httpOk,body,expectedStatus){
  return Boolean(httpOk&&body?.success===true&&body?.result?.status===expectedStatus);
}

function checkBucket(item){
  const bucket=String(item?.bucket||'').toLowerCase();
  if(bucket)return bucket;
  if(item?.__typename==='StatusContext'){
    const state=String(item?.state||'').toUpperCase();
    if(state==='SUCCESS')return 'pass';
    if(state==='FAILURE'||state==='ERROR')return 'fail';
    return 'pending';
  }
  const status=String(item?.status||'').toUpperCase();
  const conclusion=String(item?.conclusion||'').toUpperCase();
  if(status&&status!=='COMPLETED')return 'pending';
  if(['SUCCESS','NEUTRAL','SKIPPED'].includes(conclusion))return 'pass';
  if(['FAILURE','TIMED_OUT','ACTION_REQUIRED','CANCELLED','STALE','STARTUP_FAILURE'].includes(conclusion))return 'fail';
  return 'pending';
}

export function evaluateRemoteChecks({queryAvailable=true,requiredChecks=[],rollup=[],mergeStateStatus='',elapsedMs=0,discoveryGraceMs=60000,timeoutMs=600000}={}){
  if(!queryAvailable){
    return elapsedMs>=timeoutMs?{state:'block',code:'remote_checks_unavailable'}:{state:'wait',code:'remote_checks_unavailable'};
  }
  const required=Array.isArray(requiredChecks)?requiredChecks:[];
  const all=Array.isArray(rollup)?rollup:[];
  const requiredBuckets=required.map(checkBucket);
  if(requiredBuckets.includes('fail'))return {state:'block',code:'required_check_failed'};
  if(requiredBuckets.includes('pending'))return elapsedMs>=timeoutMs?{state:'block',code:'required_checks_timeout'}:{state:'wait',code:'required_checks_pending'};
  if(required.length>0)return {state:'pass',code:'required_checks_passed'};

  const mergeState=String(mergeStateStatus||'').toUpperCase();
  if(elapsedMs<discoveryGraceMs)return {state:'wait',code:'check_discovery_grace'};
  if(mergeState==='CLEAN')return {state:'pass',code:all.length?'no_required_checks_mergeable':'no_required_checks'};
  if(elapsedMs>=timeoutMs)return {state:'block',code:'checks_not_ready_or_merge_blocked'};
  return {state:'wait',code:'checks_not_ready_or_merge_blocked'};
}

export function validatePullRequestIdentity(pr,{expectedHeadSha='',expectedBaseSha='',expectedPaths=[]}={}){
  if(!pr||typeof pr!=='object')throw new Error('pr_identity_unavailable');
  if(!SHA40.test(String(expectedHeadSha||''))||!SHA40.test(String(expectedBaseSha||'')))throw new Error('expected_pr_identity_invalid');
  if(String(pr.state||'').toUpperCase()!=='OPEN')throw new Error('pr_not_open');
  if(Boolean(pr.isDraft))throw new Error('pr_is_draft');
  if(String(pr.headRefOid||'')!==String(expectedHeadSha))throw new Error('pr_head_changed');
  if(String(pr.baseRefOid||'')!==String(expectedBaseSha))throw new Error('pr_base_changed');
  if(String(pr.mergeable||'').toUpperCase()!=='MERGEABLE')throw new Error('pr_not_mergeable');
  const allowed=new Set((expectedPaths||[]).filter(Boolean).map(value=>String(value).replaceAll('\\','/')));
  const files=(pr.files||[]).map(item=>String(item?.path||'').replaceAll('\\','/')).filter(Boolean);
  if(files.length===0)throw new Error('pr_diff_unavailable');
  if(files.some(file=>!allowed.has(file)))throw new Error('pr_diff_outside_allowlist');
  for(const required of allowed)if(!files.includes(required))throw new Error('pr_expected_file_missing');
  return true;
}

export function classifyExternalFailure({externalEffectStarted=false,queryAvailable=true,pr=null,expectedHeadSha=''}={}){
  if(!externalEffectStarted)return {state:'safe-before-effect',code:'external_effect_not_started'};
  if(!queryAvailable)return {state:'uncertain',code:'github_reconciliation_unavailable'};
  if(!pr)return {state:'uncertain',code:'pull_request_not_confirmed'};
  if(expectedHeadSha&&String(pr.headRefOid||pr?.head?.sha||'')!==String(expectedHeadSha))return {state:'uncertain',code:'pull_request_head_mismatch'};
  if(pr.mergedAt||pr.merged_at||String(pr.state||'').toUpperCase()==='MERGED')return {state:'reconcile-merge',code:'merge_detected'};
  return {state:'safe-before-merge',code:'pull_request_confirmed_unmerged'};
}
