/** Shared health contract used by Fitness Tracker and Morning Macros. */
const SHARED_SCHEMA_VERSION = '3.0.0';
const SHEET_HEALTH_GOALS = 'HealthGoals';
const SHEET_PLANNED_DAYTIME = 'PlannedDaytime';
const SHEET_GOAL_ADJUSTMENTS = 'GoalAdjustments';
const SHEET_PENDING_GOALS = 'PendingGoals';
const SHEET_WEEKLY_CHECKINS = 'WeeklyCheckins';
const SHEET_WAIST_MEASUREMENTS = 'WaistMeasurements';
const SHEET_FOOD_CAPTURES = 'FoodCaptures';

const HEALTH_GOAL_HEADERS = [
  'profile_id','schema_version','age','sex','height_in','current_weight_lb',
  'body_fat_pct','target_body_fat_pct','physique_goal','activity_level',
  'loss_aggressiveness','target_loss_pct_week','estimated_maintenance_calories',
  'calorie_target','protein_min_g','goal_version','updated_at','updated_by',
  'planned_daily_steps','planned_strength_workouts_week','waist_in','goal_started_at','change_type',
  'final_daily_steps','step_ramp_start_date','baseline_daily_steps','server_updated_at'
];

const PLANNED_DAYTIME_HEADERS = [
  'date','plan_id','planned_calories','planned_protein_g','calorie_target',
  'protein_min_g','intended_evening_calorie_budget','goal_version','updated_at','source','server_updated_at'
];
const PENDING_GOAL_HEADERS = ['pending_id','status','effective_date','base_goal_version','proposed_calorie_target','created_at','server_updated_at','activated_at'];
const WEEKLY_CHECKIN_HEADERS = ['checkin_id','date','review_number','goal_version','goal_type','calorie_target','protein_min_g','target_weight_change_pct_week','valid_weight_count','trend_window_start','trend_window_end','observed_weight_change_pct_week','reference_body_weight','step_adherence','workout_adherence','food_adherence','waist_in','waist_measurement_date','implied_energy_gap_estimate','recommendation_type','proposed_calorie_target','user_decision','created_at','server_updated_at'];
const WAIST_HEADERS = ['measurement_id','date','waist_in','goal_version','created_at','server_updated_at'];
const FOOD_CAPTURE_HEADERS = ['capture_id','date','captured_at','raw_text','input_type','status','estimated_calories','estimated_protein_g','calorie_low','calorie_high','protein_low_g','protein_high_g','confidence','notes','processed_at','processor','updated_at','server_updated_at'];

const GOAL_ADJUSTMENT_HEADERS = [
  'adjustment_id','created_at','status','target_loss_pct_week','actual_loss_pct_week',
  'old_calorie_target','recommended_calorie_target','accepted_calorie_target',
  'goal_version_before','goal_version_after','trend_start_date','trend_end_date','notes','server_updated_at'
];

function isSharedGetAction_(action) {
  return ['getSharedState','getHealthGoals','getPlannedDaytime','getWeeklyCheckins','getFoodCaptures','getPendingFoodCaptures'].indexOf(action) >= 0;
}

function isSharedPostAction_(action) {
  return ['saveHealthGoals','savePlannedDaytime','decideGoalAdjustment','saveWeeklyCheckin','saveWaistMeasurement','saveFoodCapture','updateFoodCaptureEstimate'].indexOf(action) >= 0;
}

function handleSharedGet_(action, params) {
  if (action === 'getHealthGoals') return jsonOut({ ok:true, shared:sharedState_().goal });
  if (action === 'getPlannedDaytime') {
    return jsonOut({ ok:true, rows:plannedDaytimeRange_(String(params.start||''), String(params.end||'')) });
  }
  if (action === 'getWeeklyCheckins') return jsonOut({ok:true,rows:rowsAsObjects_(getWeeklyCheckinsSheet_())});
  if (action === 'getFoodCaptures') return jsonOut({ok:true,rows:foodCaptures_(String(params.date||''),false)});
  if (action === 'getPendingFoodCaptures') return jsonOut({ok:true,rows:foodCaptures_(String(params.date||''),true)});
  return jsonOut({ ok:true, shared:sharedState_() });
}

function handleSharedPost_(action, body) {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    if (action === 'saveHealthGoals') return jsonOut(saveHealthGoals_(body.goal||{}, body.expectedGoalVersion));
    if (action === 'savePlannedDaytime') return jsonOut(savePlannedDaytime_(body.rows||[]));
    if (action === 'decideGoalAdjustment') return jsonOut(decideGoalAdjustment_(body));
    if (action === 'saveWeeklyCheckin') return jsonOut(saveWeeklyCheckin_(body.checkin||{}));
    if (action === 'saveWaistMeasurement') return jsonOut(saveWaistMeasurement_(body.measurement||{}));
    if (action === 'saveFoodCapture') return jsonOut(saveFoodCapture_(body.capture||{}));
    if (action === 'updateFoodCaptureEstimate') return jsonOut(updateFoodCaptureEstimate_(body.estimate||body.capture||{}));
    return jsonOut({ok:false,error:'Unknown shared action'});
  } finally {
    lock.releaseLock();
  }
}

function sharedState_() {
  getGoalAdjustmentsSheet_();
  activateDuePendingGoal_();
  const goal = currentHealthGoal_();
  const today = Utilities.formatDate(new Date(), Session.getScriptTimeZone() || 'America/New_York', 'yyyy-MM-dd');
  return {
    schemaVersion: SHARED_SCHEMA_VERSION,
    goal: goal,
    plannedDaytime: plannedDaytimeRange_(today, today)[0] || null,
    pendingGoal: currentPendingGoal_(),
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
  const numeric = ['age','height_in','current_weight_lb','body_fat_pct','target_body_fat_pct','planned_daily_steps','final_daily_steps','baseline_daily_steps','planned_strength_workouts_week','target_loss_pct_week','estimated_maintenance_calories','calorie_target','protein_min_g','goal_version','waist_in'];
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
    activity_level:String(goal.activity_level||''), planned_daily_steps:numOrBlank_(goal.planned_daily_steps),
    final_daily_steps:numOrBlank_(goal.final_daily_steps||goal.planned_daily_steps), step_ramp_start_date:String(goal.step_ramp_start_date||''),
    baseline_daily_steps:numOrBlank_(goal.baseline_daily_steps),
    planned_strength_workouts_week:numOrBlank_(goal.planned_strength_workouts_week), loss_aggressiveness:String(goal.loss_aggressiveness||'moderate'),
    target_loss_pct_week:numOrBlank_(goal.target_loss_pct_week),
    estimated_maintenance_calories:numOrBlank_(goal.estimated_maintenance_calories),
    calorie_target:numOrBlank_(goal.calorie_target), protein_min_g:numOrBlank_(goal.protein_min_g),
    waist_in:numOrBlank_(goal.waist_in), goal_started_at:String(goal.goal_started_at||new Date().toISOString()), change_type:String(goal.change_type||'manual'),
    goal_version:currentVersion+1, updated_at:new Date().toISOString(), server_updated_at:new Date().toISOString(), updated_by:'fitness_tracker'
  };
  if (!next.calorie_target || !next.protein_min_g || next.target_loss_pct_week==='') throw new Error('Calorie, protein, and weekly target are required.');
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
    const serverNow = new Date().toISOString();
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
      updated_at:String(input.updated_at||''), server_updated_at:serverNow, source:'morning_macros'
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
  let updatedGoal = goal, pendingGoal = null;
  if (body.accept === true) {
    const effectiveDate=String(body.effectiveDate||nextMonday_());
    pendingGoal={pending_id:'PG-'+Utilities.getUuid(),status:'pending',effective_date:effectiveDate,base_goal_version:expected,proposed_calorie_target:recommended,created_at:new Date().toISOString(),server_updated_at:new Date().toISOString(),activated_at:''};
    replaceSingleRow_(getPendingGoalsSheet_(),PENDING_GOAL_HEADERS,pendingGoal);
  }
  const row = {
    adjustment_id:Utilities.getUuid(), created_at:new Date().toISOString(), status,
    target_loss_pct_week:numOrBlank_(body.targetLossPctWeek), actual_loss_pct_week:numOrBlank_(body.actualLossPctWeek),
    old_calorie_target:Number(goal.calorie_target), recommended_calorie_target:recommended,
    accepted_calorie_target:body.accept===true?recommended:'', goal_version_before:expected,
    goal_version_after:expected, trend_start_date:String(body.trendStartDate||''),
    trend_end_date:String(body.trendEndDate||''), notes:String(body.notes||''), server_updated_at:new Date().toISOString()
  };
  appendObjectRow_(getGoalAdjustmentsSheet_(), GOAL_ADJUSTMENT_HEADERS, row);
  return {ok:true,status,pendingGoal:pendingGoal,shared:sharedState_()};
}

function nextMonday_(){ const d=new Date(); const day=d.getDay(); d.setDate(d.getDate()+((8-day)%7||7)); return Utilities.formatDate(d,Session.getScriptTimeZone()||'America/New_York','yyyy-MM-dd'); }
function currentPendingGoal_(){ const rows=rowsAsObjects_(getPendingGoalsSheet_()).filter(r=>String(r.status)==='pending'); return rows.length?rows[rows.length-1]:null; }
function activateDuePendingGoal_(){ const pending=currentPendingGoal_(); if(!pending)return; const today=Utilities.formatDate(new Date(),Session.getScriptTimeZone()||'America/New_York','yyyy-MM-dd'); if(String(pending.effective_date)>today)return; const goal=currentHealthGoal_(); if(!goal||Number(goal.goal_version)!==Number(pending.base_goal_version)){pending.status='cancelled';pending.server_updated_at=new Date().toISOString();replaceSingleRow_(getPendingGoalsSheet_(),PENDING_GOAL_HEADERS,pending);return;} pending.status='activating';pending.server_updated_at=new Date().toISOString();replaceSingleRow_(getPendingGoalsSheet_(),PENDING_GOAL_HEADERS,pending); const next=Object.assign({},goal,{calorie_target:Number(pending.proposed_calorie_target),goal_started_at:new Date().toISOString(),change_type:'adaptive'}); saveHealthGoals_(next,Number(goal.goal_version)); pending.status='activated';pending.activated_at=new Date().toISOString();pending.server_updated_at=pending.activated_at;replaceSingleRow_(getPendingGoalsSheet_(),PENDING_GOAL_HEADERS,pending); }
function saveWeeklyCheckin_(input){ const now=new Date().toISOString(), id=String(input.checkin_id||'WC-'+Utilities.getUuid()); const row={}; WEEKLY_CHECKIN_HEADERS.forEach(h=>row[h]=input[h]===undefined?'':input[h]); row.checkin_id=id;row.created_at=String(row.created_at||now);row.server_updated_at=now;upsertObjectByKey_(getWeeklyCheckinsSheet_(),WEEKLY_CHECKIN_HEADERS,'checkin_id',row);if(input.waist_in)saveWaistMeasurement_({measurement_id:'WM-'+id,date:input.waist_measurement_date||input.date,waist_in:input.waist_in,goal_version:input.goal_version});return{ok:true,checkin:row}; }
function saveWaistMeasurement_(input){ const now=new Date().toISOString(); const row={measurement_id:String(input.measurement_id||'WM-'+Utilities.getUuid()),date:String(input.date||Utilities.formatDate(new Date(),Session.getScriptTimeZone()||'America/New_York','yyyy-MM-dd')),waist_in:numOrBlank_(input.waist_in),goal_version:numOrBlank_(input.goal_version),created_at:now,server_updated_at:now};upsertObjectByKey_(getWaistMeasurementsSheet_(),WAIST_HEADERS,'measurement_id',row);return{ok:true,measurement:row}; }
function saveFoodCapture_(input){
  const now=new Date().toISOString(),text=String(input.raw_text||'').trim(),date=String(input.date||Utilities.formatDate(new Date(),Session.getScriptTimeZone()||'America/New_York','yyyy-MM-dd'));
  if(!text)return{ok:false,error:'Food description is required.'};
  if(!/^\d{4}-\d{2}-\d{2}$/.test(date))return{ok:false,error:'A valid date is required.'};
  const row={capture_id:String(input.capture_id||'FC-'+Utilities.getUuid()),date:date,captured_at:String(input.captured_at||now),raw_text:text,input_type:String(input.input_type||'typed'),status:'pending',estimated_calories:'',estimated_protein_g:'',calorie_low:'',calorie_high:'',protein_low_g:'',protein_high_g:'',confidence:'',notes:'',processed_at:'',processor:'',updated_at:now,server_updated_at:now};
  upsertObjectByKey_(getFoodCapturesSheet_(),FOOD_CAPTURE_HEADERS,'capture_id',row);return{ok:true,capture:row};
}
function updateFoodCaptureEstimate_(input){
  const id=String(input.capture_id||'');if(!id)return{ok:false,error:'capture_id is required.'};
  const sheet=getFoodCapturesSheet_(),rows=rowsAsObjects_(sheet),existing=rows.find(r=>String(r.capture_id)===id);if(!existing)return{ok:false,error:'Food capture not found.'};
  const now=new Date().toISOString(),row={};FOOD_CAPTURE_HEADERS.forEach(h=>row[h]=existing[h]===undefined?'':existing[h]);
  row.status=String(input.status||'estimated');row.estimated_calories=Math.max(0,Math.round(Number(input.estimated_calories)||0));row.estimated_protein_g=Math.max(0,Math.round(Number(input.estimated_protein_g)||0));row.calorie_low=Math.max(0,Math.round(Number(input.calorie_low)||row.estimated_calories));row.calorie_high=Math.max(row.calorie_low,Math.round(Number(input.calorie_high)||row.estimated_calories));row.protein_low_g=Math.max(0,Math.round(Number(input.protein_low_g)||row.estimated_protein_g));row.protein_high_g=Math.max(row.protein_low_g,Math.round(Number(input.protein_high_g)||row.estimated_protein_g));row.confidence=String(input.confidence||'medium');row.notes=String(input.notes||'');row.processed_at=now;row.processor=String(input.processor||'codex_automation');row.updated_at=now;row.server_updated_at=now;
  upsertObjectByKey_(sheet,FOOD_CAPTURE_HEADERS,'capture_id',row);return{ok:true,capture:row};
}
function foodCaptures_(date,pendingOnly){return rowsAsObjects_(getFoodCapturesSheet_()).filter(r=>(!date||String(r.date)===date)&&(!pendingOnly||String(r.status)==='pending'));}

function plannedDaytimeRange_(start, end) {
  return rowsAsObjects_(getPlannedDaytimeSheet_()).filter(r => {
    const d=String(r.date||''); return d && (!start||d>=start) && (!end||d<=end);
  });
}

function getHealthGoalsSheet_(){ return ensureSharedSheet_(SHEET_HEALTH_GOALS,HEALTH_GOAL_HEADERS); }
function getPlannedDaytimeSheet_(){ return ensureSharedSheet_(SHEET_PLANNED_DAYTIME,PLANNED_DAYTIME_HEADERS); }
function getGoalAdjustmentsSheet_(){ return ensureSharedSheet_(SHEET_GOAL_ADJUSTMENTS,GOAL_ADJUSTMENT_HEADERS); }
function getPendingGoalsSheet_(){return ensureSharedSheet_(SHEET_PENDING_GOALS,PENDING_GOAL_HEADERS);}
function getWeeklyCheckinsSheet_(){return ensureSharedSheet_(SHEET_WEEKLY_CHECKINS,WEEKLY_CHECKIN_HEADERS);}
function getWaistMeasurementsSheet_(){return ensureSharedSheet_(SHEET_WAIST_MEASUREMENTS,WAIST_HEADERS);}
function getFoodCapturesSheet_(){return ensureSharedSheet_(SHEET_FOOD_CAPTURES,FOOD_CAPTURE_HEADERS);}

function purgeSharedHealthData_(){
  [getHealthGoalsSheet_(),getPlannedDaytimeSheet_(),getGoalAdjustmentsSheet_(),getPendingGoalsSheet_(),getWeeklyCheckinsSheet_(),getWaistMeasurementsSheet_(),getFoodCapturesSheet_()].forEach(sheet=>{
    const last=sheet.getLastRow();
    if(last>1) sheet.deleteRows(2,last-1);
  });
}

function ensureSharedSheet_(name,headers){
  const sheet=ensureSheet_(name,headers);
  const existing=getHeaders_(sheet);
  headers.forEach((header,index)=>{ if(existing[index]!==header) sheet.getRange(1,index+1).setValue(header); });
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
