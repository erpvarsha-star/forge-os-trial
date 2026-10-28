/** populationFilter pure helpers (PATCH_112). Run: npx tsx scripts/payroll-category-runs.test.ts */
import { filterByPopulation, isPayPopulation, PAY_POPULATIONS } from '../supabase/functions/payroll-run/lib/populationFilter'

let pass = 0, fail = 0
const check = (n: string, c: boolean, d = '') => { c ? (pass++, console.log(`  ok  ${n}`)) : (fail++, console.log(`FAIL  ${n} ${d}`)) }

const inputs = [
  { empCode: 'VFL1001', category: 'STAFF' },
  { empCode: 'F001', category: 'PERMANENT_WORKER' },
  { empCode: 'F002', category: 'PERMANENT_WORKER' },
  { empCode: 'CON01', category: 'CONSULTANT' },
  { empCode: 'BUNG01', category: 'PUNE_STAFF' },
]

// NULL / undefined population = whole-population run: everything passes, same array
check('null passes all', filterByPopulation(inputs, null).length === 5)
check('undefined passes all', filterByPopulation(inputs, undefined).length === 5)
check('null returns inputs untouched', filterByPopulation(inputs, null) === inputs)

// each category keeps only its members
check('STAFF keeps 1', filterByPopulation(inputs, 'STAFF').every((i) => i.category === 'STAFF') && filterByPopulation(inputs, 'STAFF').length === 1)
check('PERMANENT_WORKER keeps 2', filterByPopulation(inputs, 'PERMANENT_WORKER').length === 2 && filterByPopulation(inputs, 'PERMANENT_WORKER').every((i) => i.empCode.startsWith('F')))
check('CONSULTANT keeps 1', filterByPopulation(inputs, 'CONSULTANT').map((i) => i.empCode).join() === 'CON01')
check('PUNE_STAFF keeps 1', filterByPopulation(inputs, 'PUNE_STAFF').map((i) => i.empCode).join() === 'BUNG01')

// unknown / unexpected category values are simply not matched (no crash, no leak into other runs)
check('unknown category filtered out', filterByPopulation([...inputs, { empCode: 'X1', category: 'APPRENTICE' }], 'STAFF').length === 1)
check('unknown population matches nothing', filterByPopulation(inputs, 'APPRENTICE').length === 0)

// empty input
check('empty input -> empty out (null)', filterByPopulation([], null).length === 0)
check('empty input -> empty out (category)', filterByPopulation([], 'STAFF').length === 0)

// validator used by the edge function 'create' action
check('isPayPopulation accepts the 4 values', PAY_POPULATIONS.every((p) => isPayPopulation(p)))
check('isPayPopulation rejects junk', !isPayPopulation('') && !isPayPopulation('staff') && !isPayPopulation(null) && !isPayPopulation(3))

console.log(`\n${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)
