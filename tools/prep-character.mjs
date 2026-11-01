// Reduces a Meshy character GLB for phones (dev tool, not loaded by the game).
// npm i @gltf-transform/core@4 @gltf-transform/extensions@4 @gltf-transform/functions@4 meshoptimizer sharp
// RA=.17 RL=.21 node tools/prep-character.mjs <source.glb> assets/chibi2-mobile.glb 0.4 0.002
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
 // Arm capsules (bind pose): shoulder→elbow→wrist→hand tip. A vertex outside every capsule
 // (the back, the sides, the chest, the shirt) must not follow the arm bones.
 const wp=nd=>{const m=nd.getWorldMatrix();return [m[12],m[13],m[14]]};const byName=nm=>skin.listJoints().find(x=>x.getName()===nm);
 const caps=[];for(const sd of ['Left','Right']){const A=wp(byName('mixamorig:'+sd+'Arm')),F=wp(byName('mixamorig:'+sd+'ForeArm')),H=wp(byName('mixamorig:'+sd+'Hand'));
  let T=H,td=0;const walkT=nd=>{for(const c of nd.listChildren()){const p=wp(c),d=Math.hypot(p[0]-H[0],p[1]-H[1],p[2]-H[2]);if(d>td){td=d;T=p;}walkT(c);}};walkT(byName('mixamorig:'+sd+'Hand'));
  if(td<.06){const d=[H[0]-F[0],H[1]-F[1],H[2]-F[2]],l=Math.hypot(...d);T=[H[0]+d[0]/l*.1,H[1]+d[1]/l*.1,H[2]+d[2]/l*.1];}
  caps.push([A,F,+(process.env.RA||.1)],[F,H,+(process.env.RF||.095)],[H,T,+(process.env.RH||.1)]);}
 const segD=(p,A,B)=>{const ab=[B[0]-A[0],B[1]-A[1],B[2]-A[2]],ap=[p[0]-A[0],p[1]-A[1],p[2]-A[2]];const t=Math.max(0,Math.min(1,(ab[0]*ap[0]+ab[1]*ap[1]+ab[2]*ap[2])/(ab[0]**2+ab[1]**2+ab[2]**2)));return Math.hypot(ap[0]-ab[0]*t,ap[1]-ab[1]*t,ap[2]-ab[2]*t)};
 const spine2=names.indexOf('mixamorig:Spine2');
 // Forearms and hands are bare skin (short sleeves): their capsules only take skin, so the
 // shirt's sides next to the hanging hands do not swing with them.
 const isCloth=i=>{UV.getElement(i,u);const x=Math.min(info.width-1,Math.floor(u[0]*info.width)),y=Math.min(info.height-1,Math.floor(u[1]*info.height)),k=(y*info.width+x)*info.channels;const r=data[k]/255,b=data[k+2]/255;return (r-b)/Math.max(r,.001)<.1&&r>.3;};
 for(let i=0;i<n;i++){pos.getElement(i,a);const cl=isCloth(i),side=cl&&a[1]<+(process.env.UY||.6)&&Math.abs(a[0])<+(process.env.UX||.32);if(!side&&caps.some(([A,B,r],ci)=>(!cl||ci%3===0)&&segD(a,A,B)<r))continue;
  J.getElement(i,j);W.getElement(i,w);let arm=0;for(let c=0;c<4;c++)if(armish[j[c]]&&w[c]>0){arm+=w[c];w[c]=0;}if(!arm)continue;fixed++;
  const t=w.reduce((s,v)=>s+v,0);if(t<1e-4){j[0]=a[1]>.55?spine2:spine;w[0]=1;w[1]=w[2]=w[3]=0;}else for(let c=0;c<4;c++)w[c]/=t;J.setElement(i,j);W.setElement(i,w);}
 console.log('torso verts fixed',fixed);
 // Same for the legs: shirt hems and the back must not swing with the thighs.
 const legSet=new Set();const walkL=nd=>{legSet.add(nd);nd.listChildren().forEach(walkL)};skin.listJoints().filter(x=>/UpLeg$/.test(x.getName())).forEach(walkL);
 const legish=skin.listJoints().map(x=>legSet.has(x));const hipsI=names.indexOf('mixamorig:Hips');const lcaps=[];
 for(const sd of ['Left','Right']){const U=wp(byName('mixamorig:'+sd+'UpLeg')),L=wp(byName('mixamorig:'+sd+'Leg')),F=wp(byName('mixamorig:'+sd+'Foot')),T=wp(byName('mixamorig:'+sd+'ToeBase'));const TE=wp(byName('mixamorig:'+sd+'Toe_End')||byName('mixamorig:'+sd+'ToeBase'));lcaps.push([U,L,+(process.env.RL||.15)],[L,F,.14],[F,T,.14],[T,TE,.13]);}
 let lfixed=0;
 for(let i=0;i<n;i++){pos.getElement(i,a);const shirt=a[1]>.4&&isCloth(i);if(!shirt&&lcaps.some(([A,B,r])=>segD(a,A,B)<r))continue;
  J.getElement(i,j);W.getElement(i,w);let lw=0;for(let c=0;c<4;c++)if(legish[j[c]]&&w[c]>0){lw+=w[c];w[c]=0;}if(!lw)continue;lfixed++;
  const t=w.reduce((s,v)=>s+v,0);if(t<1e-4){j[0]=hipsI;w[0]=1;w[1]=w[2]=w[3]=0;}else for(let c=0;c<4;c++)w[c]/=t;J.setElement(i,j);W.setElement(i,w);}
 console.log('leg verts fixed',lfixed);
 // Soften the cloth's weights over neighbouring vertices, so what is left bends in smooth
 // curves instead of tearing into fins where limb and body weights meet.
 {const key=i=>{pos.getElement(i,a);return a.map(x=>x.toFixed(5)).join()};const ids=new Map(),weld=new Int32Array(n);for(let i=0;i<n;i++){const k=key(i);if(!ids.has(k))ids.set(k,ids.size);weld[i]=ids.get(k);}
  const m=ids.size,nb=Array.from({length:m},()=>new Set()),I=p.getIndices().getArray();for(let t=0;t<I.length;t+=3){const x=weld[I[t]],y=weld[I[t+1]],z=weld[I[t+2]];nb[x].add(y).add(z);nb[y].add(x).add(z);nb[z].add(x).add(y);}
  let ws=Array.from({length:m},()=>null);const cloth=new Uint8Array(m);for(let i=0;i<n;i++){const k=weld[i];if(ws[k])continue;J.getElement(i,j);W.getElement(i,w);const mp=new Map();for(let c=0;c<4;c++)if(w[c]>0)mp.set(j[c],w[c]);ws[k]=mp;pos.getElement(i,a);cloth[k]=isCloth(i)&&a[1]>.3&&a[1]<.8?1:0;}
  for(let pass=0;pass<+(process.env.SMOOTH||4);pass++){ws=ws.map((own,k)=>{if(!cloth[k])return own;const sum=new Map(own);for(const o of nb[k])for(const [b,v] of ws[o])sum.set(b,(sum.get(b)||0)+v*.5);return sum;});}
  for(let i=0;i<n;i++){const k=weld[i];if(!cloth[k])continue;const top=[...ws[k]].sort((x,y)=>y[1]-x[1]).slice(0,4),t=top.reduce((s,x)=>s+x[1],0)||1;J.setElement(i,[0,1,2,3].map(c=>top[c]?.[0]??0));W.setElement(i,[0,1,2,3].map(c=>(top[c]?.[1]??0)/t));}
  console.log('cloth weights smoothed');}
 const hips=names.indexOf('mixamorig:Hips');let crotch=0;if(process.env.CROTCH==='1')
 for(let i=0;i<n;i++){pos.getElement(i,a);const ax=Math.abs(a[0]);if(a[1]>.42||a[1]<.16||ax>.13)continue;UV.getElement(i,u);const x=Math.min(info.width-1,Math.floor(u[0]*info.width)),y=Math.min(info.height-1,Math.floor(u[1]*info.height)),k=(y*info.width+x)*info.channels;const r=data[k]/255,g=data[k+1]/255,b=data[k+2]/255,hi=Math.max(r,g,b),lo=Math.min(r,g,b);if(!((hi-lo)/Math.max(hi,.001)<.14&&hi>.35))continue;
  const f=Math.min(1,Math.max(0,(.13-ax)/.07));J.getElement(i,j);W.getElement(i,w);for(let c=0;c<4;c++)w[c]*=1-f;let hc=j.indexOf(hips);if(hc<0||w[hc]===undefined){hc=w.indexOf(Math.min(...w));j[hc]=hips;}w[hc]+=f;const t=w.reduce((s,v)=>s+v,0);for(let c=0;c<4;c++)w[c]/=t;J.setElement(i,j);W.setElement(i,w);crotch++;}
 console.log('crotch',crotch);}
// Clean the baked cloth and hair: speckles and blotches made the 찜질복 look ragged.
// White cloth: flatten its brightness towards a wide local average; hair: edge-aware smoothing.
// Skin, eyes, mouth and cheeks are left exactly as painted.
if(process.env.CLEAN!=='0'){const tex=d.getRoot().listMaterials()[0].getBaseColorTexture();const {data,info}=await sharp(Buffer.from(tex.getImage())).removeAlpha().raw().toBuffer({resolveWithObject:true});
 const W2=info.width,H2=info.height,px=new Float32Array(data);const cls=new Uint8Array(W2*H2);
 for(let i=0;i<W2*H2;i++){const r=px[i*3]/255,g=px[i*3+1]/255,b=px[i*3+2]/255,hi=Math.max(r,g,b),lo=Math.min(r,g,b),lum=.2126*r+.7152*g+.0722*b;cls[i]=(hi-lo)/Math.max(hi,.001)<.16&&lum>.3?1:(lum<.3&&r>=b)?2:0;}
 const box=(src,rad)=>{const out=new Float32Array(src.length),tmp=new Float32Array(src.length);for(let y=0;y<H2;y++){let acc=[0,0,0],cnt=0;for(let x=-rad;x<W2+rad;x++){const xa=x+rad,xr=x-rad-1;if(xa<W2&&xa>=0){const k=(y*W2+xa);if(cls[k]===1){acc[0]+=src[k*3];acc[1]+=src[k*3+1];acc[2]+=src[k*3+2];cnt++;}}if(xr>=0&&xr<W2){const k=(y*W2+xr);if(cls[k]===1){acc[0]-=src[k*3];acc[1]-=src[k*3+1];acc[2]-=src[k*3+2];cnt--;}}if(x>=0&&x<W2){const k=y*W2+x;if(cnt>0){tmp[k*3]=acc[0]/cnt;tmp[k*3+1]=acc[1]/cnt;tmp[k*3+2]=acc[2]/cnt;}else{tmp[k*3]=src[k*3];tmp[k*3+1]=src[k*3+1];tmp[k*3+2]=src[k*3+2];}}}}
  for(let x=0;x<W2;x++){let acc=[0,0,0],cnt=0;for(let y=-rad;y<H2+rad;y++){const ya=y+rad,yr=y-rad-1;if(ya<H2&&ya>=0){const k=ya*W2+x;if(cls[k]===1){acc[0]+=tmp[k*3];acc[1]+=tmp[k*3+1];acc[2]+=tmp[k*3+2];cnt++;}}if(yr>=0&&yr<H2){const k=yr*W2+x;if(cls[k]===1){acc[0]-=tmp[k*3];acc[1]-=tmp[k*3+1];acc[2]-=tmp[k*3+2];cnt--;}}if(y>=0&&y<H2){const k=y*W2+x;if(cnt>0){out[k*3]=acc[0]/cnt;out[k*3+1]=acc[1]/cnt;out[k*3+2]=acc[2]/cnt;}else{out[k*3]=tmp[k*3];out[k*3+1]=tmp[k*3+1];out[k*3+2]=tmp[k*3+2];}}}}return out;};
 const rad=Math.round(W2/256),blur=box(box(px,rad),rad),keep=+(process.env.KEEP||.3);
 for(let i=0;i<W2*H2;i++)if(cls[i]===1)for(let c=0;c<3;c++)px[i*3+c]=blur[i*3+c]+(px[i*3+c]-blur[i*3+c])*keep;
 for(let pass=0;pass<3;pass++){const src=px.slice();for(let y=1;y<H2-1;y++)for(let x=1;x<W2-1;x++){const k=y*W2+x;if(cls[k]!==2)continue;for(let c=0;c<3;c++){const v=src[k*3+c];let sum=0,nn=0;for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){const kk=k+dy*W2+dx;if(cls[kk]!==2)continue;const u=src[kk*3+c];if(Math.abs(u-v)<40){sum+=u;nn++;}}px[k*3+c]=sum/nn;}}}
 const outBuf=Buffer.from(Uint8ClampedArray.from(px));tex.setImage(new Uint8Array(await sharp(outBuf,{raw:{width:W2,height:H2,channels:3}}).png().toBuffer())).setMimeType('image/png');
 console.log('texture cleaned',W2,H2);}
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
