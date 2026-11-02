// Protect every byte except head position/normal samples: animation, skin weights,
// UVs, texture, mesh topology and the body must match the original Claude assets.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const expected={plain:'71d52eca4e9978a5a3d42e185ba9c27a623667b82487a276c11ee4a5ff7948f7',cap:'d08054f194e2fe9f2a2de11002924d4c2715f0eabf1e746bc60dca84d21082d0'};
function inspect(file){
  const b=fs.readFileSync(file),len=b.readUInt32LE(12),g=JSON.parse(b.subarray(20,20+len)),start=28+len;
  const primitive=g.meshes[0].primitives[0],a=g.accessors[primitive.attributes.POSITION],n=g.accessors[primitive.attributes.NORMAL];
  const offset=(attr,i)=>start+(g.bufferViews[attr.bufferView].byteOffset||0)+(attr.byteOffset||0)+i*(g.bufferViews[attr.bufferView].byteStride||12);
  const protectedBytes=Buffer.from(b);let head=0;
  for(let i=0;i<a.count;i++){
    const p=offset(a,i),np=offset(n,i),v=[0,4,8].map(c=>b.readFloatLE(p+c)),normal=[0,4,8].map(c=>b.readFloatLE(np+c));
    assert(v.every(Number.isFinite)&&normal.every(Number.isFinite),'Finite geometry');
    const length=Math.hypot(...normal);
    assert(length<1e-8||Math.abs(length-1)<.002,'Unit normals (original degenerate triangles may have zero normals)');
    if(v[1]>.78){head++;protectedBytes.fill(0,p,p+12);protectedBytes.fill(0,np,np+12);}
  }
  return {digest:crypto.createHash('sha256').update(protectedBytes).digest('hex'),vertices:a.count,head};
}
if(require.main===module){for(const profile of ['plain','cap']){const file=path.join(__dirname,'../assets/chibi2'+(profile==='cap'?'-cap':'')+'-mobile.glb'),result=inspect(file);assert.equal(result.digest,expected[profile],profile+' preserves the body, rig, clips, texture and UVs');console.log('PASS head model',profile,result.vertices+' vertices');}}
module.exports={inspect};
