declare const process: { exit(code: number): never };
import { runAllTests } from './tests';
const results = runAllTests();
for (const r of results) console.log(`${r.passed ? 'PASS' : 'FAIL'}  ${r.name}${r.passed ? '' : '\n      → ' + r.detail}`);
const failed = results.filter(r => !r.passed).length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
