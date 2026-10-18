import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve('src/modules');
const expected = new Set(['faculty','opportunities','community','outreach']);
let failed = false;
for (const name of fs.readdirSync(root, { withFileTypes: true })) {
  if (!name.isDirectory()) continue;
  if (!expected.has(name.name)) {
    console.error(`Unexpected module directory: ${name.name}`); failed = true; continue;
  }
  const file = path.join(root,name.name,'module.tsx');
  if (!fs.existsSync(file)) {
    console.error(`Module ${name.name} missing module.tsx`); failed = true;
  } else {
    const source = fs.readFileSync(file,'utf8');
    if (!source.includes('CONTRACT_VERSION') || !source.includes('export default')) {
      console.error(`Module ${name.name} missing version/default export`); failed = true;
    }
  }
}
if (failed) process.exit(1);
console.log('Module package structure OK.');
