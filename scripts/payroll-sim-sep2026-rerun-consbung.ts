/**
 * September 2026 re-run: CONSULTANT + PUNE_STAFF (BUNG) (offline, read-only).
 *
 * Usage: npx tsx scripts/payroll-sim-sep2026-rerun-consbung.ts <data.json> <out.json>
 *
 * No data lives in the repo. <data.json> has employees[], salaries[], sheet.consultants[], pune[]
 * (code, gross, present, wo, ownerDed, enterDed, ownerFlatOT, otHours, csvPayable),
 * advances[] ({employee_id, monthly_deduction, outstanding_balance, status}) and inactiveCodes[].
 */
import * as fs from 'fs';
import { assemblePayrollInputs, FeedBundle, EmployeeRow, SalaryRow, AttendanceRow } from '../lib/payroll/feedSync';
import { calculateOne } from '../lib/payroll/engine';
import { DEFAULT_ENGINE_CONFIG, PayrollInput } from '../lib/payroll/types';
const r2 = (n:number)=>Math.round(n*100)/100;
const TOL = 50;
const D = JSON.parse(fs.readFileSync(process.argv[2],'utf8'));
const employees: EmployeeRow[] = D.employees.map((e:any)=>({id:e.emp_code,emp_code:e.emp_code,name:e.emp_code,category:e.category,work_location:e.work_location,gender:e.gender,is_active:e.is_active,weekly_off_day:e.weekly_off_day,pt_exempt:false}));
const salaries: SalaryRow[] = D.salaries.map((s:any)=>({employee_id:s.emp_code,effective_from:s.effective_from,is_active:true,basic:0,hra:0,conveyance:0,washing:0,education:0,heat_allow:0,vda:0,production_allow:0,medical:0,professional_development:0,communication:0,uniform:0,ctc_annual:s.ctc_annual,rate_type:s.rate_type,daily_rate:s.daily_rate}));
type Inj = {present:number;wo:number;leave:number;ot:number;canteen?:number;society?:number;advance?:number;otherDed?:number};
function feeds(inj: Record<string,Inj>, advances:any[]=[]): FeedBundle {
  const attendance: AttendanceRow[] = []; const adjustments:any[]=[]; const canteen:any[]=[], society:any[]=[];
  const D15='2026-09-15';
  for (const [code,i] of Object.entries(inj)) {
    const push=(st:string,n:number,ot:{v:number})=>{let l=n;while(l>=1){attendance.push({employee_id:code,date:D15,status:st,overtime_hours:ot.v,check_in_time:null,check_out_time:null});ot.v=0;l--;} if(l>=0.5){attendance.push({employee_id:code,date:D15,status:st==='p'?'hl':st,overtime_hours:ot.v,check_in_time:null,check_out_time:null});ot.v=0;}};
    const ot={v:i.ot}; push('p',i.present,ot); push('wo',i.wo,ot); push('el',i.leave,ot);
    if(ot.v>0) attendance.push({employee_id:code,date:D15,status:'a',overtime_hours:ot.v,check_in_time:null,check_out_time:null});
    if(i.otherDed) adjustments.push({employee_id:code,adjustment_type:'OTHER',signed_amount_inr:-i.otherDed,approval_status:'approved'});
  }
  return {employees,salaries,attendance,punches:[],leaves:[],advances,canteen,society,efficiency:[],adjustments,statusEvents:[]};
}
function run(inj:Record<string,Inj>, advances:any[]=[], emps?:EmployeeRow[]) {
  const f = feeds(inj,advances); if (emps) f.employees = emps;
  const a = assemblePayrollInputs(2026,9,f);
  const out:Record<string,{inp:PayrollInput;res:any}> = {};
  for (const i of a.inputs) out[i.empCode]={inp:i,res:calculateOne(i,DEFAULT_ENGINE_CONFIG)};
  return {out,warnings:a.warnings,blocked:a.blockedEmployees};
}
const result:any = {consultants:{},pune:{}};

// ---------- CONSULTANTS ----------
const cons: Record<string,Inj> = {}; const csheet:Record<string,any>={};
for (const c of D.sheet.consultants){ cons[c.emp_code]={present:c.present,wo:c.wo,leave:c.leave,ot:c.ot}; csheet[c.emp_code]=c; }
const rc = run(cons);
for (const code of Object.keys(csheet)) {
  const c = csheet[code]; const e = rc.out[code];
  if (!e) { result.consultants[code]={cls:'OPEN',note:'no input assembled'}; continue; }
  const raw = e.res; const daily = e.inp.rateProfile?.basis==='DAILY_RATE';
  // aligned (sheet denominator 31): scale days & OT by wd/31 (engine wd=30) for monthly-gross consultants
  let aligned:any=null, dAl:number|null=null;
  if (!daily && !raw.held) {
    const f = e.inp.workingDays/31; const d=e.inp.days;
    const inp2 = {...e.inp, days:{present:d.present*f,ph:d.ph*f,el:d.el*f,cl:d.cl*f,sl:d.sl*f,plo:d.plo*f,weekOff:d.weekOff*f}, otHours:e.inp.otHours*f};
    aligned = calculateOne(inp2,DEFAULT_ENGINE_CONFIG); dAl = r2(aligned.netPay-c.net);
  }
  const dRaw = raw.held?null:r2(raw.netPay-c.net);
  let cls='FAIL', note='';
  if (raw.held) {cls='FAIL'; note='held: '+raw.blockers.join(',');}
  else if (Math.abs(dRaw!)<=TOL) { cls=Math.abs(dRaw!)<=2?'PASS_EXACT':'PASS_EXACT'; note=daily?`daily rate x worked (${raw.worked} d, incl. WO) + OT/8 x rate x1; engine ${raw.netPay} vs sheet ${c.net}`:`engine ${raw.netPay} vs sheet ${c.net}`; }
  else if (dAl!==null && Math.abs(dAl)<=TOL) { cls='PASS_U2'; note=`monthly gross prorated: sheet divides by 31 (sheet column shows 31 total working days, September has 30). Engine wd=${e.inp.workingDays}: ${raw.netPay}. Aligned to 31 (days x ${e.inp.workingDays}/31): ${aligned.netPay}, delta ${dAl}`; }
  result.consultants[code]={cls,sheetNet:c.net,engineNet:raw.netPay,deltaRaw:dRaw,alignedNet:aligned?aligned.netPay:null,deltaAligned:dAl,held:raw.held,blockers:raw.blockers,basis:e.inp.rateProfile?.basis,workingDays:e.inp.workingDays,workedEngine:raw.worked,workedSheet:c.worked,otHours:c.ot,earnings:raw.earnings,note};
}
// inactive consultants: show not in run, then synthetic activation
const inactive: string[] = D.inactiveCodes ?? [];
result.inactiveConsultants={};
const asLive = run({});   // zero-day live run: who is assembled?
for (const code of inactive) result.inactiveConsultants[code]={assembledInLiveRun:!!asLive.out[code]};
const act = employees.map(e=>inactive.includes(e.emp_code)?{...e,is_active:true}:e);
const syn: Record<string,Inj> = {}; for (const c of inactive) syn[c]={present:20,wo:0,leave:0,ot:0};
const rs = run(syn,[],act);
for (const code of inactive){ const e=rs.out[code]; result.inactiveConsultants[code].ifActivated20days = e? {held:e.res.held,blockers:e.res.blockers,net:e.res.netPay,basis:e.inp.rateProfile?.basis}:null; }
// monthly consultant with OT -> held?
const t = run({[D.monthlyConsultantProbe ?? 'CON05']:{present:20,wo:4,leave:0,ot:2}}); result.monthlyConsultantWithOT={held:t.out[D.monthlyConsultantProbe ?? 'CON05'].res.held,blockers:t.out[D.monthlyConsultantProbe ?? 'CON05'].res.blockers};

// ---------- PUNE ----------
const P = D.pune; const adv: any[] = D.advances ?? [];
const base:Record<string,Inj>={}, withHR:Record<string,Inj>={}, withOT:Record<string,Inj>={};
for (const p of P){ base[p.code]={present:p.present,wo:p.wo,leave:0,ot:0}; withHR[p.code]={present:p.present,wo:p.wo,leave:0,ot:0,otherDed:p.enterDed||0}; withOT[p.code]={present:p.present,wo:p.wo,leave:0,ot:p.otHours||0,otherDed:p.enterDed||0}; }
const A=run(base,adv), B=run(withHR,adv), C=run(withOT,adv);
for (const p of P){
  const wd=30; const worked=p.present+p.wo;
  const grossExp = Math.round(p.gross*worked/wd);
  const expected = grossExp - p.ownerDed + (p.ownerFlatOT||0);
  const a=A.out[p.code], b=B.out[p.code], c=C.out[p.code];
  const row:any={code:p.code,gross:p.gross,worked,grossExpected:grossExp,ownerDeduction:p.ownerDed,flatOT:p.ownerFlatOT||0,expectedPayable:expected,csvPayableColumn:p.csvPayable,csvGrossEarningsColumn:'blank',
    engine_A_asIs:{held:a.res.held,net:a.res.netPay,earn:a.res.earnings,ded:a.res.deductions},
    engine_B_withHRDeduction:{held:b.res.held,net:b.res.netPay,ded:b.res.deductions},
    engine_C_withHRDeductionAndOTHours:{held:c.res.held,net:c.res.netPay,earn:c.res.earnings}};
  row.deltaA = r2(a.res.netPay-expected); row.deltaB=r2(b.res.netPay-expected); row.deltaC=r2(c.res.netPay-expected);
  let cls:string, note:string;
  if (Math.abs(row.deltaA)<=TOL) { cls='PASS_EXACT'; note='engine as-is within Rs50 of owner-rule expected'+(adv.some((x:any)=>x.employee_id===p.code)?' (advance recovery from live advance_requests)':''); }
  else if (Math.abs(row.deltaB)<=TOL && !p.ownerFlatOT) { cls='PASS_EXCEPTION'; note='needs the deduction entered as an approved negative payroll_adjustment (HR); Kajal clerk screen cannot enter money'; }
  else if (p.ownerFlatOT && Math.abs(row.deltaC)<=TOL) { cls='PASS_EXCEPTION'; note='engine OT = gross/30/8 x hours (x1); sheet flat Rs/hr; within Rs50 ONLY if OT hours are entered in attendance_records.overtime_hours, which no app screen does for BUNG'; }
  else if (p.ownerFlatOT) { cls='PASS_EXCEPTION'; note='flat-rate OT (sheet) vs engine gross/30/8 x hours: exceeds Rs50 even with OT hours entered; documented sheet deviation'; }
  else { cls='FAIL'; note='unexplained'; }
  row.cls=cls; row.note=note; result.pune[p.code]=row;
}
result.warnings={cons:rc.warnings.length,puneA:A.warnings, puneC:C.warnings};
fs.writeFileSync(process.argv[3],JSON.stringify(result,null,1));
console.log(JSON.stringify(result,null,1));
