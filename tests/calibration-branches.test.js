const {chromium}=require('playwright');
const path=require('node:path');
const {pathToFileURL}=require('node:url');

(async()=>{
  const browser=await chromium.launch({headless:true});
  const page=await browser.newPage({viewport:{width:390,height:844}});
  const errors=[];page.on('pageerror',error=>errors.push(error.message));
  await page.route(/script\.google\.com/,route=>route.abort());
  await page.addInitScript(()=>localStorage.setItem('ben_tracker_v12_settings',JSON.stringify({
    sharedGoal:{goal_version:1,age:35,sex:'male',height_in:68,current_weight_lb:100,physique_goal:'maintain',calorie_target:2000,protein_min_g:100,planned_strength_workouts_week:2,goal_started_at:new Date().toISOString()},
    workoutProgram:{version:1,setupComplete:true,benchNotches:1,squatStance:'hip width, toes forward',squatEmphasis:'balanced',pullupBaseline:0,pullupLevel:'inverted',rdlEmphasis:'hamstring',rdlLevel:'single',accessories:['core'],increments:{dumbbell:null,barbell:null,cable:null,assistance:null}}
  })));
  await page.goto(pathToFileURL(path.join(__dirname,'..','index.html')).href);
  await page.locator('#openPlanBtn').click({force:true});await page.locator('#beginCalibration').click();
  await page.locator('#calWeight').fill('20');await page.locator('#calReps').fill('12');await page.locator('[data-difficulty="aboutRight"]').click();await page.locator('#countCalibrationSet').click();
  for(let i=0;i<2;i++){await page.locator('.wpRep:visible').fill('12');await page.locator('#nextExercise').click();}
  await page.locator('#nextExercise').click();
  await page.getByText('Goblet Squat',{exact:true}).first().waitFor();
  await page.locator('#calWeight').fill('50');await page.locator('#calReps').fill('10');await page.locator('[data-difficulty="aboutRight"]').click();
  await page.locator('#calibrateBarbell').click();
  await page.getByText('Barbell Squat',{exact:true}).first().waitFor();
  if(await page.locator('#calWeight').inputValue()!=='45')throw new Error('Barbell calibration did not start conservatively');
  await page.locator('#calReps').fill('8');await page.locator('[data-difficulty="aboutRight"]').click();await page.locator('#countCalibrationSet').click();
  const program=await page.evaluate(()=>JSON.parse(localStorage.getItem('ben_tracker_v12_settings')).workoutProgram);
  if(program.squatLevel!=='barbell'||!program.calibratedExercises.squat_goblet||!program.calibratedExercises.squat_barbell)throw new Error('Separate goblet and barbell calibrations were not saved');
  if(errors.length)throw new Error(errors.join('\n'));
  console.log('Calibration branches passed');
  await browser.close();
})().catch(error=>{console.error(error);process.exit(1)});
