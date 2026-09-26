/* Jeremy Ethier 2026 full-body program. Product rules (such as a 12-week accessory review)
   are deliberately kept separate from the exercise prescriptions. */
(function(root){
  const media = {
    press:'https://fitnessprogramer.com/wp-content/uploads/2021/02/Incline-Dumbbell-Press.gif',
    goblet:'https://fitnessprogramer.com/wp-content/uploads/2023/01/Dumbbell-Goblet-Squat.gif',
    squat:'https://fitnessprogramer.com/wp-content/uploads/2021/02/BARBELL-SQUAT.gif',
    inverted:'https://fitnessprogramer.com/wp-content/uploads/2021/06/Inverted-Row.gif',
    assisted:'https://fitnessprogramer.com/wp-content/uploads/2021/04/Assisted-Pull-up.gif',
    neutral:'https://fitnessprogramer.com/wp-content/uploads/2022/08/neutral-grip-pull-up.gif',
    overhand:'https://fitnessprogramer.com/wp-content/uploads/2021/02/Pull-up.gif',
    dbRdl:'https://fitnessprogramer.com/wp-content/uploads/2021/02/Dumbbell-Romanian-Deadlift.gif',
    barRdl:'https://fitnessprogramer.com/wp-content/uploads/2021/02/Barbell-Romanian-Deadlift.gif',
    row:'https://fitnessprogramer.com/wp-content/uploads/2021/02/Seated-Cable-Row.gif',
    y:'https://fitnessprogramer.com/wp-content/uploads/2021/10/Incline-Dumbbell-Y-Raise.gif',
    rear:'https://fitnessprogramer.com/wp-content/uploads/2021/02/Dumbbell-Reverse-Fly.gif',
    deadBug:'https://fitnessprogramer.com/wp-content/uploads/2021/05/Dead-Bug.gif',
    calf:'https://fitnessprogramer.com/wp-content/uploads/2021/06/Standing-Calf-Raise.gif',
    hip:'https://fitnessprogramer.com/wp-content/uploads/2021/02/HiP-ABDUCTION-MACHINE.gif',
    curl:'https://fitnessprogramer.com/wp-content/uploads/2021/02/Seated-Incline-Dumbbell-Curl.gif',
    triceps:'https://fitnessprogramer.com/wp-content/uploads/2021/02/Dumbbell-Triceps-Extension.gif',
    pecDeck:'https://fitnessprogramer.com/wp-content/uploads/2021/02/Pec-Deck-Fly.gif'
  };
  const priorities={core:{name:'Dead Bug',low:5,high:5,tip:'Flatten your lower back; extend opposite arm and leg slowly.',img:media.deadBug},glutes:{name:'Hip Abduction',low:10,high:20,tip:'Control both directions.',img:media.hip},calves:{name:'Straight-Leg Calf Raise',low:10,high:20,tip:'Choose a standing or leg-press straight-leg variation.',img:media.calf},arms:{name:'Arm Superset',low:8,high:12,tip:'Incline dumbbell curl to failure, then overhead triceps extension.',img:media.curl},upperBack:{name:'Incline Kelso Shrug',low:8,high:12,tip:'Chest supported, arms straight; drive shoulder blades up and in.'},upperChest:{name:'Lean-Forward Cable Fly / Pec Deck',low:10,high:15,tip:'Lean your torso forward and use a controlled range.',img:media.pecDeck}};
  const defaults=()=>({version:1,setupComplete:false,benchNotches:0,squatStance:'',squatEmphasis:'balanced',squatLevel:'goblet',pullupBaseline:null,pullupLevel:'inverted',rdlStance:'',rdlEmphasis:'hamstring',rdlLevel:'single',pressAdvanced:false,accessories:['core'],accessorySelectedAt:'',increments:{dumbbell:null,barbell:null,cable:null,assistance:null},updatedAt:''});
  function make(id,name,low,high,tip,img,extra={}){return {id,family:id.split('_')[0],name,sets:3,low,high,unit:'reps',restSec:180,desc:tip,jeremyTips:tip,img:img||'',alt:name,...extra,meta:`3 sets · ${low}–${high} reps`};}
  function plan(input,bodyWeight){
    const s={...defaults(),...(input||{})}; const p=[];
    p.push(make('press_incline','Low-Incline Dumbbell Press',s.pressAdvanced?6:10,s.pressAdvanced?8:15,'Keep elbows in an arrow shape, not flared into a T. Lower under control.',media.press,{family:'press',variation:s.pressAdvanced?'advanced':'beginner',setup:`Bench: ${s.benchNotches||1} notch${s.benchNotches===2?'es':''} above bottom`,equipment:'dumbbell'}));
    const bar=s.squatLevel==='barbell';const squatTip=bar?(s.squatEmphasis==='quads'?'Elevate heels, keep torso relatively upright, let knees travel forward.':s.squatEmphasis==='glutes'?'Push hips back to a bench or box; keep shins relatively vertical.':'Brace and use your saved comfortable stance.'):'Build controlled reps before adding weight.';p.push(make('squat_'+(bar?'barbell':'goblet'),bar?'Barbell Squat':'Goblet Squat',bar?6:10,bar?(s.squatAdvanced?8:10):15,squatTip,bar?media.squat:media.goblet,{family:'squat',variation:bar?'barbell':'goblet',setup:`Stance: ${s.squatStance||'choose a comfortable stance'} · Emphasis: ${s.squatEmphasis}${!bar&&bodyWeight?` · Barbell benchmark: ${(bodyWeight*.5).toFixed(1)} lb × 10`:''}`,equipment:bar?'barbell':'dumbbell'}));
    const pull={inverted:['Inverted Row',10,15,media.inverted],assisted:['Assisted Neutral-Grip Pull-up',5,10,''],neutral:['Neutral-Grip Pull-up',5,10,media.neutral],overhand:['Overhand Pull-up',5,8,media.overhand],weighted:['Weighted Overhand Pull-up',5,8,'']}[s.pullupLevel]||['Inverted Row',10,15,media.inverted];
    p.push(make('pull_'+s.pullupLevel,pull[0],pull[1],pull[2],s.pullupLevel==='assisted'?'Use less assistance or more clean reps; more assistance is not progress.':s.pullupLevel==='inverted'?'Build toward 3 clean sets of 15.':'Use strict reps; avoid swinging.',pull[3],{family:'pull',variation:s.pullupLevel,equipment:s.pullupLevel==='assisted'?'assistance':s.pullupLevel==='weighted'?'barbell':'bodyweight'}));
    const rdl=s.rdlLevel==='barbell'?'barbell':s.rdlLevel==='double'?'double':'single';p.push(make('rdl_'+rdl,rdl==='barbell'?'Barbell Romanian Deadlift':rdl==='double'?'Two-Dumbbell Romanian Deadlift':'Single-Dumbbell Hip Hinge',rdl==='barbell'?6:10,rdl==='barbell'?10:15,`Brace and push hips back. ${s.rdlEmphasis==='glute'?'Use slightly more knee bend.':'Keep knees somewhat straighter for hamstrings.'} Stop where YOUR hinge ends with a flat back; no floor target.`,rdl==='barbell'?media.barRdl:rdl==='double'?media.dbRdl:'',{family:'rdl',variation:rdl,setup:`Stance: ${s.rdlStance||'hop and stick the landing'} · ${s.rdlEmphasis} emphasis`,equipment:rdl==='barbell'?'barbell':'dumbbell'}));
    p.push(make('row_cable','Cable Row',10,15,'Wide overhand grip, feet high, sit tall and brace. Pull elbows back toward lower chest; squeeze shoulder blades and control return. If you cannot feel the back, practice sliding the shoulder blades forward and squeezing them together with straight arms.',media.row,{family:'row',variation:'cable',equipment:'cable'}));
    p.push(make('shoulders_incline_superset','Incline Lateral-Raise Superset',10,20,'Back-supported wide Y raise to failure, then immediately chest-down rear-biased raise to failure. Rest after the pair; keep dumbbells light.',media.y,{family:'shoulders',variation:'y_then_rear',equipment:'dumbbell',superset:true,partB:'Chest-down incline rear-biased raise',partBImg:media.rear}));
    (s.accessories||[]).slice(0,2).forEach(key=>{const a=priorities[key];if(a)p.push(make('accessory_'+key,a.name,a.low,a.high,a.tip,key==='upperChest'?'':a.img,{family:'accessory',variation:key,equipment:key==='core'?'bodyweight':key==='calves'||key==='glutes'?'machine':'dumbbell',superset:key==='arms',partB:key==='arms'?'Overhead Triceps Extension':'',partBImg:key==='arms'?media.triceps:''}));});
    return p;
  }
  function progression(ex,log,previous,increment){
    const reps=(log?.setReps||[]).map(Number),weights=(log?.setWeights||[]).map(Number),full=reps.length>=ex.sets&&reps.slice(0,ex.sets).every(n=>Number.isFinite(n)&&n>0),form=log?.formGood!==false;
    const sameLoad=weights.slice(0,ex.sets).every(w=>w===weights[0]);
    if(!full)return {eligible:false,message:'Log all working sets to see progression.'};
    if(!form)return {eligible:false,message:'Prioritize clean technique; repeat or reduce the load.'};
    if(ex.equipment==='assistance'){
      const assistance=Number(log.assistanceAmount);
      if(!Number.isFinite(assistance)||assistance<0)return {eligible:false,message:'Log assistance to judge progress.'};
      if(previous&&assistance>Number(previous.assistanceAmount))return {eligible:false,message:'More assistance is not progression. Rebuild clean reps at this level.'};
      if(ex.variation==='assisted'&&assistance===0&&reps.every(n=>n>=10))return {eligible:true,nextVariation:'neutral',message:'Clean unassisted sets of 10: consider neutral-grip pull-ups.'};
      return {eligible:false,message:'Add clean reps or reduce assistance when ready.'};
    }
    if(ex.variation==='inverted'&&reps.every(n=>n>=15))return {eligible:true,nextVariation:'assisted',message:'3 × 15 achieved. Ready to try assisted neutral-grip pull-ups.'};
    if(ex.variation==='neutral'&&reps.every(n=>n>=10))return {eligible:true,nextVariation:'overhand',message:'Sets of 10 achieved. Ready to try strict overhand pull-ups.'};
    if(ex.variation==='overhand'&&reps.every(n=>n>8))return {eligible:true,nextVariation:'weighted',message:'More than 8 strict reps per set: weighted pull-ups are available.'};
    if(ex.variation==='weighted'&&reps.every(n=>n<=8))return {eligible:false,message:'Build beyond 8 strict reps before adding more weight.'};
    if(ex.variation==='goblet'&&Number(log.bodyWeightLb)>0&&weights.some((w,i)=>w>=Number(log.bodyWeightLb)*.5&&reps[i]>=10))return {eligible:true,nextVariation:'barbell',message:'Goblet benchmark reached. Barbell squats are available when you choose.'};
    if(ex.equipment==='bodyweight')return {eligible:false,message:'Keep building strict reps at this variation.'};
    if(ex.superset){const b=(log.partBReps||[]).slice(0,ex.sets);if(b.length<ex.sets||!b.every(n=>Number(n)>0))return {eligible:false,message:'Log both halves of each superset before assessing progression.'};if(b.some(n=>Number(n)<ex.high))return {eligible:false,nextWeight:weights[0],message:'Build clean reps in both halves before adding load.'};}
    if(!sameLoad)return {eligible:false,message:'Use one working load across all sets before assessing a load increase.'};
    if(reps.some(n=>n<ex.low)&&previous&&Number(previous.nextRecommendedWeight)>0&&weights[0]===Number(previous.nextRecommendedWeight))return {eligible:false,nextWeight:Number(previous.weight)||'',message:'New load fell below the rep floor. Return to the prior working load.'};
    if(reps.every(n=>n>=ex.high)&&increment>0)return {eligible:true,nextWeight:weights[0]+increment,message:`All ${ex.sets} sets reached ${ex.high} clean reps. Try the next available load next time.`};
    if(reps.every(n=>n>=ex.high))return {eligible:false,message:'Rep target reached. Set your smallest available equipment increment in Workout Settings before increasing load.'};
    return {eligible:false,nextWeight:weights[0],message:'Keep this load and build clean reps within the range.'};
  }
  const api={defaults,plan,progression,priorities,media};if(typeof module!=='undefined'&&module.exports)module.exports=api;root.WorkoutProgram=api;
})(typeof window!=='undefined'?window:globalThis);
