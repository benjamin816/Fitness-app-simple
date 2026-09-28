const {chromium}=require('playwright');
const path=require('node:path');
const {pathToFileURL}=require('node:url');

(async()=>{
  const browser=await chromium.launch({headless:true});
  const page=await browser.newPage({viewport:{width:390,height:844}});
  const errors=[];page.on('pageerror',error=>errors.push(error.message));
  await page.route(/script\.google\.com/,route=>route.abort());
  await page.addInitScript(()=>{
    if(localStorage.getItem('ben_tracker_v12_settings'))return;
    localStorage.setItem('ben_tracker_v12_settings',JSON.stringify({
      sharedGoal:{goal_version:1,age:35,sex:'male',height_in:68,current_weight_lb:165,physique_goal:'maintain',calorie_target:2000,protein_min_g:124,planned_strength_workouts_week:2,goal_started_at:new Date().toISOString()},
      workoutProgram:{version:1,setupComplete:true,benchNotches:1,squatStance:'hip width, toes forward',squatEmphasis:'balanced',pullupBaseline:0,pullupLevel:'inverted',rdlEmphasis:'hamstring',rdlLevel:'single',accessories:['core'],increments:{dumbbell:null,barbell:null,cable:null,assistance:null}}
    }));
  });
  await page.goto(pathToFileURL(path.join(__dirname,'..','index.html')).href);
  await page.locator('#openPlanBtn').click({force:true});
  await page.locator('#beginCalibration').click();
  async function acceptCalibration(weight,reps,partB){
    if(weight!==null)await page.locator('#calWeight').fill(String(weight));
    await page.locator('#calReps').fill(String(reps));
    if(partB!==undefined)await page.locator('#calRepsB').fill(String(partB));
    await page.locator('[data-difficulty="aboutRight"]').click();
    await page.locator('#countCalibrationSet').click();
  }
  async function finishSets(superset=false){
    for(let set=2;set<=3;set++){
      await page.locator('.wpRep:visible').fill('11');
      await page.locator('#nextExercise').click();
      if(superset){await page.locator('.wpBRep:visible').fill('11');await page.locator('#nextExercise').click();}
    }
    await page.locator('#nextExercise').click();
  }
  await acceptCalibration(30,12);await finishSets();
  await acceptCalibration(20,12);await finishSets();
  await page.locator('[data-pull-level="inverted"]').click();
  await acceptCalibration(null,12);await finishSets();
  await acceptCalibration(20,12);await finishSets();
  await acceptCalibration(30,12);await finishSets();
  await acceptCalibration(5,12,12);await finishSets(true);
  await acceptCalibration(null,5);await finishSets();
  await page.getByText('Your program is calibrated',{exact:true}).waitFor();
  const state=await page.evaluate(()=>({settings:JSON.parse(localStorage.getItem('ben_tracker_v12_settings')),store:JSON.parse(localStorage.getItem('ben_tracker_v12_store'))}));
  if(!state.settings.workoutProgram.calibrationCompletedAt)throw new Error('Program calibration was not marked complete');
  if(Object.keys(state.settings.workoutProgram.calibratedExercises||{}).length!==7)throw new Error('Not every exercise was calibrated');
  if(state.settings.workoutProgram.workingWeights.press_incline!==30)throw new Error('Press default was not saved');
  const day=Object.values(state.store.days)[0];
  if(!day?.workoutCompleted)throw new Error('First workout was not completed');
  await page.locator('#finishWorkout').click();
  await page.evaluate(()=>{const store=JSON.parse(localStorage.getItem('ben_tracker_v12_store'));const date=Object.keys(store.days)[0];const prior=new Date(`${date}T12:00:00`);prior.setDate(prior.getDate()-1);store.days[prior.toISOString().slice(0,10)]=store.days[date];delete store.days[date];localStorage.setItem('ben_tracker_v12_store',JSON.stringify(store));});
  await page.reload();
  await page.locator('#openPlanBtn').click({force:true});
  if(await page.locator('#beginCalibration').count())throw new Error('Calibration repeated after completion');
  if(await page.locator('.wpWeight:visible').first().inputValue()!=='30')throw new Error('Saved working weight was not prefilled');
  if(errors.length)throw new Error(errors.join('\n'));
  console.log('Full calibration flow passed');
  await browser.close();
})().catch(error=>{console.error(error);process.exit(1)});
