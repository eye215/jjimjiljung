const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.join(__dirname,'..'),versions=new Map();
for(const name of fs.readdirSync(root).filter(n=>n.endsWith('.js')||n==='index.html')){
  const source=fs.readFileSync(path.join(root,name),'utf8');
  for(const match of source.matchAll(/(?:\.\/)?[\w./-]+\.js\?v=(rpg-\d+)/g)){
    if(!versions.has(match[1]))versions.set(match[1],[]);versions.get(match[1]).push(name);
    const target=match[0].split('?')[0];assert(fs.existsSync(path.resolve(root,target)),`Missing module ${target}`);
  }
}
assert.equal(versions.size,1,`Mixed module cache versions: ${JSON.stringify([...versions])}`);
console.log('PASS module cache:',[...versions.keys()][0],'across', [...versions.values()][0].length,'references');
