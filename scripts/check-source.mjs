/** Lightweight offline structural check; full checking is npm run typecheck/test/build. */
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import ts from 'typescript';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (file) => readFileSync(path.join(root, file));
const hash = (buffer) => createHash('sha256').update(buffer).digest('hex');
function assert(ok, message) {
  if (!ok) throw Error(`Source verification failed: ${message}`);
}
const required = [
  'MEMORY.md', 'README.md', 'docs/模块集成协议.md', 'docs/产品规划.md',
  'src/sdk/contracts.ts', 'sdk/contracts.ts',
  'src/app/App.tsx', 'src/app/services/hostApi.ts', 'src/app/services/modules.ts',
  'src/app/services/db.ts', 'src/app/pages/Onboarding.tsx',
  'prompts/00_主体开发Agent.txt',
  'prompts/01_导师调查faculty_Agent.txt',
  'prompts/02_科研项目opportunities_Agent.txt',
  'prompts/03_公共Space社区community_Agent.txt',
  'prompts/04_套瓷邮件outreach_Agent.txt',
];
for (const filename of required) assert(existsSync(path.join(root,filename)), `missing ${filename}`);
assert(hash(read('src/sdk/contracts.ts')) === hash(read('sdk/contracts.ts')), 'SDK copies differ');

function walk(dir) {
  return readdirSync(dir).flatMap(name => {
    const filename=path.join(dir,name);
    return statSync(filename).isDirectory() ? walk(filename) : [filename];
  });
}
const files=walk(path.join(root,'src')).filter(f=>/\.(tsx?|jsx?)$/.test(f));
let bad=0;
for (const filename of files) {
  const isTSX=filename.endsWith('.tsx');
  const source=readFileSync(filename,'utf8');
  const result=ts.transpileModule(source, {
    fileName:filename,
    reportDiagnostics:true,
    compilerOptions:{
      target:ts.ScriptTarget.ES2022,
      module:ts.ModuleKind.ESNext,
      ...(isTSX ? { jsx: ts.JsxEmit.ReactJSX } : {}),
    },
  });
  for(const diag of result.diagnostics??[]) {
    if(diag.category !== ts.DiagnosticCategory.Error) continue;
    const line=diag.file&&diag.start!=null?diag.file.getLineAndCharacterOfPosition(diag.start).line+1:'?';
    console.error(`${path.relative(root,filename)}:${line} ${ts.flattenDiagnosticMessageText(diag.messageText,' ')}`);
    bad++;
  }
}
assert(bad===0, `${bad} TypeScript syntax errors`);
console.log(`SDK copies match. ${files.length} source/test files parsed. ${required.length} required artifacts present.`);
