/** Shared health contract used by Fitness Tracker and Morning Macros. */
const SHARED_SCHEMA_VERSION = '2.0.0';
const SHEET_HEALTH_GOALS = 'HealthGoals';
const SHEET_PLANNED_DAYTIME = 'PlannedDaytime';
const SHEET_GOAL_ADJUSTMENTS = 'GoalAdjustments';

const HEALTH_GOAL_HEADERS = [
  'profile_id','schema_version','age','sex','height_in','current_weight_lb',
  'body_fat_pct','target_body_fat_pct','physique_goal','activity_level',
  'loss_aggressiveness','target_loss_pct_week','estimated_maintenance_calories',
  'calorie_target','protein_min_g','goal_version','updated_at','updated_by'
];

const PLANNED_DAYTIME_HEADERS = [
  'date','plan_id','planned_calories','planned_protein_g','calorie_target',
  'protein_min_g','intended_evening_calorie_budget','goal_version','updated_at','source'
];

const GOAL_ADJUSTMENT_HEADERS = [
  'adjustment_id','created_at','status','target_loss_pct_week','actual_loss_pct_week',
  'old_calorie_target','recommended_calorie_target','accepted_calorie_target',
  'goal_version_before','goal_version_after','trend_start_date','trend_end_date','notes'
];

function isSharedGetAction_(action) {
  return ['getSharedState','getHealthGoals','getPlannedDaytime'].indexOf(action) >= 0;
}

function isSharedPostAction_(action) {
  return ['saveHealthGoals','savePlannedDaytime','decideGoalAdjustment'].indexOf(action) >= 0;
}

function handleSharedGet_(action, params) {
  if (action === 'getHealthGoals') return jsonOut({ ok:true, shared:sharedState_().goal });
  if (action === 'getPlannedDaytime') {
    return jsonOut({ ok:true, rows:plannedDaytimeRange_(String(params.start||''), String(params.end||'')) });
  }
  return jsonOut({ ok:true, shared:sharedState_() });
}

function handleSharedPost_(action, body) {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    if (action === 'saveHealthGoals') return jsonOut(saveHealthGoals_(body.goal||{}, body.expectedGoalVersion));
    if (action === 'savePlannedDaytime') return jsonOut(savePlannedDaytime_(body.rows||[]));
    if (action === 'decideGoalAdjustment') return jsonOut(decideGoalAdjustment_(body));
    return jsonOut({ok:false,error:'Unknown shared action'});
  } finally {
    lock.releaseLock();
  }
}

function sharedState_() {
  getGoalAdjustmentsSheet_();
  const goal = currentHealthGoal_();
  const today = Utilities.formatDate(new Date(), Session.getScriptTimeZone() || 'America/New_York', 'yyyy-MM-dd');
  return {
    schemaVersion: SHARED_SCHEMA_VERSION,
    goal: goal,
    plannedDaytime: plannedDaytimeRange_(today, today)[0] || null,
    serverTime: new Date().toISOString()
  };
}

function currentHealthGoal_() {
  const sheet = getHealthGoalsSheet_();
  const rows = rowsAsObjects_(sheet).filter(r => String(r.profile_id||'') === 'primary');
  if (!rows.length) return null;
  rows.sort((a,b) => Number(b.goal_version||0)-Number(a.goal_version||0) || String(b.updated_at||'').localeCompare(String(a.updated_at||'')));
  return normalizeGoalRow_(rows[0]);
}

function normalizeGoalRow_(row) {
  if (!row) return null;
  const numeric = ['age','height_in','current_weight_lb','body_fat_pct','target_body_fat_pct','target_loss_pct_week','estimated_maintenance_calories','calorie_target','protein_min_g','goal_version'];
  const out = {};
  HEALTH_GOAL_HEADERS.forEach(h => out[h] = numeric.indexOf(h)>=0 && row[h]!=='' ? Number(row[h]) : row[h]);
  return out;
}

function saveHealthGoals_(goal, expectedVersion) {
  const sheet = getHealthGoalsSheet_();
  const current = currentHealthGoal_();
  const currentVersion = current ? Number(current.goal_version||0) : 0;
  if (expectedVersion !== null && expectedVersion !== undefined && Number(expectedVersion) !== currentVersion) {
    return {ok:false,conflict:true,error:'A newer goal already exists.',shared:sharedState_()};
  }
  const next = {
    profile_id:'primary', schema_version:SHARED_SCHEMA_VERSION,
    age:numOrBlank_(goal.age), sex:String(goal.sex||''), height_in:numOrBlank_(goal.height_in),
    current_weight_lb:numOrBlank_(goal.current_weight_lb), body_fat_pct:numOrBlank_(goal.body_fat_pct),
    target_body_fat_pct:numOrBlank_(goal.target_body_fat_pct), physique_goal:String(goal.physique_goal||''),
    activity_level:String(goal.activity_level||''), loss_aggressiveness:String(goal.loss_aggressiveness||'moderate'),
    target_loss_pct_week:numOrBlank_(goal.target_loss_pct_week),
    estimated_maintenance_calories:numOrBlank_(goal.estimated_maintenance_calories),
    calorie_target:numOrBlank_(goal.calorie_target), protein_min_g:numOrBlank_(goal.protein_min_g),
    goal_version:currentVersion+1, updated_at:new Date().toISOString(), updated_by:'fitness_tracker'
  };
  if (!next.calorie_target || !next.protein_min_g || !next.target_loss_pct_week) throw new Error('Calorie, protein, and weekly-loss targets are required.');
  replaceSingleRow_(sheet, HEALTH_GOAL_HEADERS, next);
  writeSettingsMap_({calories_goal:next.calorie_target,protein_goal:next.protein_min_g,shared_goal_version:next.goal_version,shared_schema_version:SHARED_SCHEMA_VERSION});
  return {ok:true,shared:sharedState_()};
}

function savePlannedDaytime_(rows) {
  if (!Array.isArray(rows)) throw new Error('rows must be an array');
  const sheet = getPlannedDaytimeSheet_();
  let saved = 0;
  rows.forEach(input => {
    const date = String(input.date||'');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return;
    const existing = rowsAsObjects_(sheet).find(r => String(r.date||'')===date);
    const incomingAt = String(input.updated_at||new Date().toISOString());
    if (existing && String(existing.updated_at||'') > incomingAt) return;
    const calories = Math.max(0, Math.round(Number(input.planned_calories||0)));
    const protein = Math.max(0, Math.round(Number(input.planned_protein_g||0)));
    const goal = currentHealthGoal_();
    const calorieTarget = goal ? Number(goal.calorie_target) : Number(input.calorie_target||0);
    const proteinMin = goal ? Number(goal.protein_min_g) : Number(input.protein_min_g||0);
    upsertObjectByKey_(sheet, PLANNED_DAYTIME_HEADERS, 'date', {
      date, plan_id:String(input.plan_id||''), planned_calories:calories, planned_protein_g:protein,
      calorie_target:calorieTarget, protein_min_g:proteinMin,
      intended_evening_calorie_budget:Math.max(0,calorieTarget-calories),
      goal_version:goal ? Number(goal.goal_version||0) : Number(input.goal_version||0),
      updated_at:incomingAt, source:'morning_macros'
    });
    saved++;
  });
  return {ok:true,saved,shared:sharedState_()};
}

function decideGoalAdjustment_(body) {
  const goal = currentHealthGoal_();
  if (!goal) return {ok:false,error:'Complete Set My Goals first.'};
  const expected = Number(body.expectedGoalVersion);
  if (expected !== Number(goal.goal_version)) return {ok:false,conflict:true,error:'A newer goal already exists.',shared:sharedState_()};
  const status = body.accept === true ? 'accepted' : 'kept_current';
  const recommended = Math.round(Number(body.recommendedCalorieTarget||goal.calorie_target));
  let updatedGoal = goal;
  if (body.accept === true) {
    updatedGoal = Object.assign({}, goal, {calorie_target:recommended});
    const result = saveHealthGoals_(updatedGoal, expected);
    if (!result.ok) return result;
    updatedGoal = result.shared.goal;
  }
  const row = {
    adjustment_id:Utilities.getUuid(), created_at:new Date().toISOString(), status,
    target_loss_pct_week:numOrBlank_(body.targetLossPctWeek), actual_loss_pct_week:numOrBlank_(body.actualLossPctWeek),
    old_calorie_target:Number(goal.calorie_target), recommended_calorie_target:recommended,
    accepted_calorie_target:body.accept===true?recommended:'', goal_version_before:expected,
    goal_version_after:Number(updatedGoal.goal_version||expected), trend_start_date:String(body.trendStartDate||''),
    trend_end_date:String(body.trendEndDate||''), notes:String(body.notes||'')
  };
  appendObjectRow_(getGoalAdjustmentsSheet_(), GOAL_ADJUSTMENT_HEADERS, row);
  return {ok:true,status,shared:sharedState_()};
}

function plannedDaytimeRange_(start, end) {
  return rowsAsObjects_(getPlannedDaytimeSheet_()).filter(r => {
    const d=String(r.date||''); return d && (!start||d>=start) && (!end||d<=end);
  });
}

function getHealthGoalsSheet_(){ return ensureSharedSheet_(SHEET_HEALTH_GOALS,HEALTH_GOAL_HEADERS); }
function getPlannedDaytimeSheet_(){ return ensureSharedSheet_(SHEET_PLANNED_DAYTIME,PLANNED_DAYTIME_HEADERS); }
function getGoalAdjustmentsSheet_(){ return ensureSharedSheet_(SHEET_GOAL_ADJUSTMENTS,GOAL_ADJUSTMENT_HEADERS); }

function ensureSharedSheet_(name,headers){
  const sheet=ensureSheet_(name,headers);
  sheet.setFrozenRows(1);
  sheet.getRange(1,1,1,headers.length).setFontWeight('bold').setBackground('#1f4e3d').setFontColor('#ffffff');
  return sheet;
}

function replaceSingleRow_(sheet, headers, obj) {
  const last=sheet.getLastRow(); if(last>1) sheet.deleteRows(2,last-1);
  appendObjectRow_(sheet,headers,obj);
}

function appendObjectRow_(sheet, headers, obj){ sheet.appendRow(headers.map(h => obj[h]===undefined?'':obj[h])); }

function upsertObjectByKey_(sheet, headers, key, obj) {
  const currentHeaders=getHeaders_(sheet), keyIdx=currentHeaders.indexOf(key);
  const row=currentHeaders.map(h=>obj[h]===undefined?'':obj[h]);
  let rowNum=0;
  if(sheet.getLastRow()>1){
    const vals=sheet.getRange(2,keyIdx+1,sheet.getLastRow()-1,1).getValues();
    const idx=vals.findIndex(r=>String(r[0])===String(obj[key])); if(idx>=0) rowNum=idx+2;
  }
  if(rowNum) sheet.getRange(rowNum,1,1,currentHeaders.length).setValues([row]); else sheet.appendRow(row);
}

function numOrBlank_(value){ const n=Number(value); return Number.isFinite(n)?n:''; }
