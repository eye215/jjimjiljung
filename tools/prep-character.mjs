// Reduces a Meshy character GLB for phones (dev tool, not loaded by the game).
// npm i @gltf-transform/core@4 @gltf-transform/extensions@4 @gltf-transform/functions@4 meshoptimizer sharp
// node tools/prep-character.mjs <source.glb> assets/chibi2-mobile.glb 0.4 0.002 0.63   (ratio, error, torso top)
import {NodeIO} from '@gltf-transform/core';import {ALL_EXTENSIONS} from '@gltf-transform/extensions';
import {weld, simplify, normals, prune, dedup, resample, textureCompress} from '@gltf-transform/functions';
import {MeshoptSimplifier} from 'meshoptimizer'; import sharp from 'sharp';
const [src,out,ratio]=process.argv.slice(2);
const io=new NodeIO().registerExtensions(ALL_EXTENSIONS);const d=await io.read(src);
const p=d.getRoot().listMeshes()[0].listPrimitives()[0];
p.setAttribute('NORMAL',null);
// unify skin weights per position (avg of copies, top-4)
const pos=p.getAttribute('POSITION'),J=p.getAttribute('JOINTS_0'),W=p.getAttribute('WEIGHTS_0'),n=pos.getCount();
const groups=new Map(),a=[],j=[],w=[];
for(let i=0;i<n;i++){pos.getElement(i,a);const k=a.map(x=>x.toFixed(5)).join();let g=groups.get(k);if(!g)groups.set(k,g={m:new Map(),ids:[]});g.ids.push(i);J.getElement(i,j);W.getElement(i,w);for(let c=0;c<4;c++)if(w[c]>0)g.m.set(j[c],(g.m.get(j[c])||0)+w[c]);}
for(const g of groups.values()){const top=[...g.m].sort((x,y)=>y[1]-x[1]).slice(0,4);const t=top.reduce((s,x)=>s+x[1],0);const jj=[0,0,0,0],ww=[0,0,0,0];top.forEach(([b,v],c)=>{jj[c]=b;ww[c]=v/t});for(const i of g.ids){J.setElement(i,jj);W.setElement(i,ww);}}
// shirt torso (white cloth below the armpits) follows the spine, not the arms
{const tex=d.getRoot().listMaterials()[0].getBaseColorTexture();const {data,info}=await sharp(Buffer.from(tex.getImage())).raw().toBuffer({resolveWithObject:true});
 const UV=p.getAttribute('TEXCOORD_0'),skin=d.getRoot().listSkins()[0],names=skin.listJoints().map(n=>n.getName());
 const armSet=new Set();const walk=n=>{armSet.add(n);n.listChildren().forEach(walk)};skin.listJoints().filter(n=>/Shoulder$/.test(n.getName())).forEach(walk);const armish=skin.listJoints().map(n=>armSet.has(n));const spine=names.indexOf('mixamorig:Spine1');let fixed=0;const u=[];
 for(let i=0;i<n;i++){pos.getElement(i,a);if(a[1]>+(process.argv[6]||.56)||a[1]<.3)continue;UV.getElement(i,u);const x=Math.min(info.width-1,Math.floor(u[0]*info.width)),y=Math.min(info.height-1,Math.floor(u[1]*info.height)),k=(y*info.width+x)*info.channels;
  const r=data[k]/255,g=data[k+1]/255,b=data[k+2]/255,hi=Math.max(r,g,b),lo=Math.min(r,g,b);if(!((hi-lo)/Math.max(hi,.001)<.14&&hi>.35))continue;
  J.getElement(i,j);W.getElement(i,w);let arm=0;for(let c=0;c<4;c++)if(armish[j[c]]){arm+=w[c];w[c]=0;}if(!arm)continue;fixed++;
  const t=w.reduce((s,v)=>s+v,0);if(t<1e-4){j[0]=spine;w[0]=1;w[1]=w[2]=w[3]=0;}else for(let c=0;c<4;c++)w[c]/=t;J.setElement(i,j);W.setElement(i,w);}
 console.log('torso verts fixed',fixed);
 const hips=names.indexOf('mixamorig:Hips');let crotch=0;if(process.env.CROTCH==='1')
 for(let i=0;i<n;i++){pos.getElement(i,a);const ax=Math.abs(a[0]);if(a[1]>.42||a[1]<.16||ax>.13)continue;UV.getElement(i,u);const x=Math.min(info.width-1,Math.floor(u[0]*info.width)),y=Math.min(info.height-1,Math.floor(u[1]*info.height)),k=(y*info.width+x)*info.channels;const r=data[k]/255,g=data[k+1]/255,b=data[k+2]/255,hi=Math.max(r,g,b),lo=Math.min(r,g,b);if(!((hi-lo)/Math.max(hi,.001)<.14&&hi>.35))continue;
  const f=Math.min(1,Math.max(0,(.13-ax)/.07));J.getElement(i,j);W.getElement(i,w);for(let c=0;c<4;c++)w[c]*=1-f;let hc=j.indexOf(hips);if(hc<0||w[hc]===undefined){hc=w.indexOf(Math.min(...w));j[hc]=hips;}w[hc]+=f;const t=w.reduce((s,v)=>s+v,0);for(let c=0;c<4;c++)w[c]/=t;J.setElement(i,j);W.setElement(i,w);crotch++;}
 console.log('crotch',crotch);}
// rename clips, drop walking_2
const names={'_01a19124_192d_7216_9f78_d06e5a6eb33c':'Sit','_01a1966f_14a3_766f_8b1f_70977ab79c86':'Cheer'};
for(const an of d.getRoot().listAnimations()){const nm=an.getName();if(nm==='walking_2'){an.dispose();continue;}if(names[nm])an.setName(names[nm]);}
await MeshoptSimplifier.ready;
await d.transform(weld(), simplify({simplifier:MeshoptSimplifier,ratio:+ratio,error:+(process.argv[5]||0.004)}), resample(), prune(), dedup(),
  textureCompress({encoder:sharp,targetFormat:'webp',resize:[+(process.env.TEX||2048),+(process.env.TEX||2048)],quality:90}));
// drop metallicRoughness texture (not used by our material)
for(const m of d.getRoot().listMaterials()){m.setMetallicRoughnessTexture(null);m.setMetallicFactor(0);m.setRoughnessFactor(1);}
{const q=d.getRoot().listMeshes().flatMap(m=>m.listPrimitives()).find(x=>x.getIndices()),P=q.getAttribute('POSITION'),I=q.getIndices().getArray(),c=P.getCount(),N=d.createAccessor().setType('VEC3').setArray(new Float32Array(c*3)).setBuffer(P.getBuffer()),acc=new Map(),a=[0,0,0],b=[0,0,0],e=[0,0,0],key=i=>{P.getElement(i,a);return a.map(x=>x.toFixed(5)).join()};
q.setAttribute('NORMAL',N);const ks=[];for(let i=0;i<c;i++)ks.push(key(i));
for(let t=0;t<I.length;t+=3){P.getElement(I[t],a);P.getElement(I[t+1],b);P.getElement(I[t+2],e);const u=[b[0]-a[0],b[1]-a[1],b[2]-a[2]],v=[e[0]-a[0],e[1]-a[1],e[2]-a[2]],n=[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]];for(const i of [I[t],I[t+1],I[t+2]]){const k=ks[i];const s=acc.get(k)||[0,0,0];s[0]+=n[0];s[1]+=n[1];s[2]+=n[2];acc.set(k,s);}}
for(let i=0;i<c;i++){const s=acc.get(ks[i])||[0,1,0];const l=Math.hypot(...s)||1;N.setElement(i,[s[0]/l,s[1]/l,s[2]/l]);}} await d.transform(prune());

await io.write(out,d);
