import * as THREE from './vendor/three.module.min.js';

// Everything, including textures and the pinned renderer, is served by Pages.
// No model, font, analytics, or CDN request is needed to enter the room.
const viewport = document.querySelector('#viewport');
const actionButtons = [...document.querySelectorAll('[data-action]')];
const outfitButtons = [...document.querySelectorAll('[data-color]')];
const status = document.querySelector('#status');
const motionPreference = matchMedia('(prefers-reduced-motion: reduce)');
let reducedMotion = motionPreference.matches;
motionPreference.addEventListener('change', e => { reducedMotion = e.matches; });
let renderer;
try {
  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'low-power' });
} catch (error) {
  window.showRoomError('이 브라우저에서 3D 화면을 열 수 없어요. 최신 Safari 또는 Chrome에서 다시 들어와 주세요.');
  clearTimeout(window.roomLoadTimer);
  throw error;
}
renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.75));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.VSMShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.04;
viewport.appendChild(renderer.domElement);
const scene = new THREE.Scene();
scene.background = new THREE.Color('#e8cfaf');
scene.fog = new THREE.Fog('#e8cfaf', 19, 36);
const camera = new THREE.OrthographicCamera(-6, 6, 4, -4, .1, 60);
const ambient = new THREE.HemisphereLight('#fff4df', '#bc916d', 2.6);
scene.add(ambient);
const sun = new THREE.DirectionalLight('#fff0d5', 2.7);
sun.position.set(-3, 10, 5); sun.castShadow = true;
sun.shadow.mapSize.set(1024, 1024);
Object.assign(sun.shadow.camera, { left: -7, right: 7, top: 7, bottom: -7, near: .5, far: 25 });
sun.shadow.normalBias = .035; sun.shadow.bias = -.00015; sun.shadow.radius = 4; sun.shadow.blurSamples = 8;
scene.add(sun);
const fill = new THREE.DirectionalLight('#fff4ed', 1.5); fill.position.set(4, 4, -3); scene.add(fill);

const mat = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: .8, ...extra });
const palette = { wood: mat('#c7986b'), trim: mat('#a77a51'), lightWood: mat('#dfb990'), cream: mat('#f4e6cc'), clay: mat('#c28d70'), green: mat('#8d9c74'), dark: mat('#72513a') };
const sphereGeometry = new THREE.SphereGeometry(1, 32, 24);
function mesh(geometry, material, parent, position = [0, 0, 0]) {
  const object = new THREE.Mesh(geometry, material); object.position.set(...position);
  object.castShadow = true; object.receiveShadow = true; parent.add(object); return object;
}
function ellipsoid(parent, material, position, scale) { const m = mesh(sphereGeometry, material, parent, position); m.scale.set(...scale); return m; }
function roundedGeometry(w, h, d, r = .08) {
  const s = new THREE.Shape(); const x = -w / 2, y = -h / 2; r = Math.min(r, w / 2, h / 2, d / 2);
  s.moveTo(x + r, y); s.lineTo(x + w - r, y); s.quadraticCurveTo(x + w, y, x + w, y + r);
  s.lineTo(x + w, y + h - r); s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  s.lineTo(x + r, y + h); s.quadraticCurveTo(x, y + h, x, y + h - r);
  s.lineTo(x, y + r); s.quadraticCurveTo(x, y, x + r, y);
  const g = new THREE.ExtrudeGeometry(s, { depth: Math.max(.001, d - r * 2), bevelEnabled: true, bevelSegments: 3, steps: 1, bevelSize: r, bevelThickness: r, curveSegments: 8 });
  g.center(); g.computeBoundingBox(); const bounds=g.boundingBox;
  g.scale(w/(bounds.max.x-bounds.min.x),h/(bounds.max.y-bounds.min.y),d/(bounds.max.z-bounds.min.z)); return g;
}
function box(parent, material, pos, size, radius = .04) { return mesh(roundedGeometry(...size, radius), material, parent, pos); }
function tube(parent, material, points, radius = .025) { return mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points.map(p => new THREE.Vector3(...p))), Math.max(16, points.length * 3), radius, 8, false), material, parent); }
function cylinder(parent, material, pos, rTop, rBottom, height) { return mesh(new THREE.CylinderGeometry(rTop, rBottom, height, 40), material, parent, pos); }
function canvasTexture(draw, width = 512, height = 512) {
  const c = document.createElement('canvas'); c.width = width; c.height = height; draw(c.getContext('2d'), width, height);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = Math.min(4, renderer.capabilities.getMaxAnisotropy()); return t;
}
let randomSeed = 137;
function random() { randomSeed = (randomSeed * 1664525 + 1013904223) >>> 0; return randomSeed / 4294967296; }
const textile = canvasTexture((ctx,w,h) => {
  ctx.fillStyle = '#f3ead5'; ctx.fillRect(0,0,w,h);
  for(let i=0;i<17000;i++){ const v = random(); ctx.strokeStyle = v>.5?'#ffffff65':'#b8a48630'; const x=random()*w,y=random()*h;ctx.beginPath();ctx.ellipse(x,y,1.1,2.1,.5,0,Math.PI*2);ctx.stroke(); }
},256,256);
textile.wrapS = textile.wrapT = THREE.RepeatWrapping; textile.repeat.set(3,2);
const towelMaterial = mat('#fff8e8', { map: textile, bumpMap: textile, bumpScale: .035, roughness: 1 });
const towelSeam = mat('#dacbb0');
const woodTexture = canvasTexture((c,w,h) => { c.fillStyle='#fff0d7';c.fillRect(0,0,w,h);for(let i=0;i<220;i++){ c.strokeStyle=`rgba(140,96,55,${random()*.11})`;c.lineWidth=random()*2+.3;c.beginPath();const y=random()*h;c.moveTo(0,y);c.bezierCurveTo(w*.3,y+random()*12,w*.7,y-random()*12,w,y);c.stroke();}},512,128);
const floorMaterials = ['#cfaa80','#d5b28b','#deba93','#d9b38a'].map(color=>mat(color,{map:woodTexture}));

// Warm, open-front dollhouse with a patterned wooden floor and an arched sauna.
box(scene, palette.trim, [0,-.23,0], [12,.4,9], .16);
for (let z=0;z<18;z++) for(let x=0;x<4;x++) mesh(new THREE.BoxGeometry(2.987,.10,.487), floorMaterials[(z+x)%4], scene, [-4.5+x*3,.005,-4.25+z*.5]);
box(scene, mat('#dfbd96'), [0,2.1,-4.5],[12,4.4,.25],.08);
box(scene, palette.trim,[0,.25,-4.30],[12,.3,.15]);
box(scene, palette.lightWood,[0,3.85,-4.24],[12,.16,.25]);
for(let i=0;i<25;i++)box(scene,palette.lightWood,[-5.9+i*.49,1,-4.30],[.035,1.5,.07],.01);
box(scene,palette.trim,[0,1.77,-4.28],[12,.085,.10],.02);
// Arch silhouette: a separate inset and rounded frame, with individually laid bricks.
function archShape(w,h) {const s=new THREE.Shape();s.moveTo(-w/2,0);s.lineTo(w/2,0);s.lineTo(w/2,h-w/2);s.absarc(0,h-w/2,w/2,0,Math.PI,false);s.lineTo(-w/2,0);return s;}
const arch = mesh(new THREE.ExtrudeGeometry(archShape(2.35,3.1),{depth:.13,bevelEnabled:false,curveSegments:40}),mat('#8a5b3d'),scene,[1.1,.08,-4.23]);
const archInner = mesh(new THREE.ShapeGeometry(archShape(1.98,2.85)),mat('#c38c52',{emissive:'#cb823e',emissiveIntensity:.35}),scene,[1.1,.1,-4.07]);
for(let i=0;i<13;i++){const a=i/12*Math.PI;const b=box(scene,i%2?palette.lightWood:palette.wood,[1.1+1.26*Math.cos(a),1.98+1.26*Math.sin(a),-4.00],[.27,.32,.28],.035);b.rotation.z=a-Math.PI/2;}
for(const side of [-1,1])for(let i=0;i<6;i++)box(scene,i%2?palette.lightWood:palette.wood,[1.1+side*1.26,.18+i*.31,-4],[.28,.295,.28],.025);
for(let i=0;i<7;i++)box(scene,palette.trim,[.28+i*.27,1.08,-4.035],[.03,1.9,.03],.008);
box(scene,palette.lightWood,[1.1,.18,-3.90],[2.4,.17,.65]);
function label(text, sub, position, width=1.2) {
 const texture=canvasTexture((c,w,h)=>{c.fillStyle='#f5e6c9';c.fillRect(0,0,w,h);c.fillStyle='#78543b';c.textAlign='center';c.font='600 62px "Malgun Gothic", sans-serif';c.fillText(text,w/2,100);c.fillStyle='#a17b56';c.font='24px sans-serif';c.fillText(sub,w/2,153);},512,200);
 return mesh(new THREE.PlaneGeometry(width,width*200/512),mat('#ffffff',{map:texture}),scene,position);
}
label('황토방','SLOW DOWN · 38°C',[1.1,3.68,-4.08],1.25);
label('온전한 쉼','REST YOUR MIND',[-2.5,2.8,-4.08],1.35);
// Window, diffused paper lanterns, bench, towels and tea tray.
box(scene,palette.trim,[-4.35,2.55,-4.1],[1.65,1.75,.16]);
box(scene,mat('#f7deb0',{emissive:'#ffcb7d',emissiveIntensity:.35}),[-4.35,2.55,-3.99],[1.45,1.55,.08]);
for(let i=-1;i<=1;i++)box(scene,palette.wood,[-4.35+i*.43,2.55,-3.90],[.045,1.56,.06],.01);
for(let i=-1;i<=1;i++)box(scene,palette.wood,[-4.35,2.55+i*.43,-3.90],[1.5,.045,.06],.01);
function lantern(x,y,z){
 cylinder(scene,palette.dark,[x,y+.72,z],.012,.012,.8);
 ellipsoid(scene,mat('#fff0c9',{emissive:'#f8cf86',emissiveIntensity:.6}),[x,y,z],[.34,.42,.34]);
 for(let i=0;i<9;i++){const yy=-.32+i*.08;const r=Math.sqrt(1-(yy/.43)**2)*.342;const ring=mesh(new THREE.TorusGeometry(r,.007,5,48),mat('#d9b781'),scene,[x,y+yy,z]);ring.rotation.x=Math.PI/2;}
 cylinder(scene,palette.trim,[x,y-.42,z],.11,.11,.06);
}
lantern(-1,3.35,-2.9);lantern(4.2,3.25,-3.3);
box(scene,palette.wood,[-3.45,.6,-2.85],[3.6,.2,.85],.07);
for(const x of [-4.8,-2.1])for(const z of [-3.1,-2.6])box(scene,palette.trim,[x,.29,z],[.17,.57,.17]);
for(let i=0;i<3;i++)box(scene,towelMaterial,[-4.45,.78+i*.13,-2.85],[.8,.13,.52],.05);
box(scene,palette.clay,[-2.85,.77,-2.8],[.85,.12,.55]);
for(let i=0;i<3;i++)ellipsoid(scene,mat('#b87b4c'),[-3.08+i*.21,.91,-2.8],[.105,.14,.105]);
function plant(x,z) { cylinder(scene,mat('#bd8f70'),[x,.35,z],.4,.3,.65); cylinder(scene,mat('#6d6346'),[x,.68,z],.34,.34,.03);tube(scene,palette.trim,[[x,.6,z],[x+.04,1.4,z],[x-.08,2.0,z]],.045);for(let i=0;i<9;i++){const a=i*2.4,y=1.05+i*.11;const leaf=ellipsoid(scene,i%2?palette.green:mat('#a5b08c'),[x+Math.sin(a)*.3,y,z+Math.cos(a)*.25],[.16,.36,.07]);leaf.rotation.set(.4,a,Math.sin(a)*.8);}}
plant(4.65,-2.8);
// Woven mats and cushions anchor the character in the room.
function rug(x,z,w,d,color){box(scene,mat(color,{map:textile}),[x,.09,z],[w,.065,d],.025);for(const zz of [-1,1])for(let i=0;i<16;i++)box(scene,palette.cream,[x-w/2+i*w/15,.083,z+zz*(d/2+.055)],[.025,.025,.12],.008);}
rug(.2,1.2,3.5,2.7,'#d8c497');rug(3.6,-.8,1.6,1.8,'#b5b8a0');
const cushion = box(scene,mat('#a7b6a0',{map:textile}),[3.65,.25,-1.3],[1.0,.28,.65],.12);cushion.rotation.y=-.15;
box(scene,palette.wood,[-3,.36,.3],[1.25,.12,.85],.08);
for(const x of [-3.45,-2.55])box(scene,palette.trim,[x,.19,.3],[.12,.32,.55]);
const tray = cylinder(scene,palette.dark,[-3,.46,.3],.34,.34,.035);
const cupMaterial = mat('#edcf99');
cylinder(scene,cupMaterial,[-3,.60,.3],.13,.10,.25);
cylinder(scene,mat('#a77c41'),[-3,.733,.3],.115,.115,.008);
// A contact shadow supplements real shadow maps beneath the plush character.
const shadowTexture = canvasTexture((c,w,h)=>{const g=c.createRadialGradient(w/2,h/2,2,w/2,h/2,w/2);g.addColorStop(0,'rgba(87,56,33,.28)');g.addColorStop(.55,'rgba(87,56,33,.12)');g.addColorStop(1,'rgba(87,56,33,0)');c.fillStyle=g;c.fillRect(0,0,w,h);},128,128);
const shadow = mesh(new THREE.PlaneGeometry(1.8,1.5),new THREE.MeshBasicMaterial({map:shadowTexture,transparent:true,depthWrite:false}),scene,[0,.15,1]);shadow.rotation.x=-Math.PI/2;shadow.castShadow=false;

// Sculpted chibi: 2.3-head silhouette, pear-shaped clothes, cheek/jaw shaping,
// curved face decal, stitched pocket, articulated limbs and rolled terry towel.
const skin=mat('#f9d6b8',{roughness:.75});
const hair=mat('#6b4434',{roughness:.84});
const shirt=mat('#eaa991');const shorts=mat('#d9957d');const piping=mat('#f9d6bd');
const hero = new THREE.Group(); scene.add(hero); hero.position.set(.2,.13,1.3);
const pillow=box(hero,mat('#ebd7b8',{map:textile}),[0,.13,-1.08],[.98,.22,.65],.10);pillow.visible=false;
const rig = new THREE.Group();hero.add(rig);
function latheBody(parent,material,points,pos,depth=1){const m=mesh(new THREE.LatheGeometry(points.map(p=>new THREE.Vector2(...p)),48),material,parent,pos);m.scale.z=depth;return m;}
latheBody(rig,shirt,[[0,0],[.27,.01],[.36,.07],[.37,.18],[.34,.38],[.29,.53],[.20,.59],[0,.59]],[0,.77,0],.85);
const hem=mesh(new THREE.TorusGeometry(.335,.026,10,48),piping,rig,[0,.84,0]);hem.rotation.x=Math.PI/2;hem.scale.y=.85;
cylinder(rig,skin,[0,1.36,0],.15,.17,.2);
const collar=mesh(new THREE.TorusGeometry(.175,.035,12,40),piping,rig,[0,1.35,0]);collar.rotation.x=Math.PI/2;
box(rig,piping,[.16,1.08,.305],[.17,.15,.025],.025);
tube(rig,shorts,[[.09,1.12,.33],[.16,1.095,.34],[.23,1.12,.33]],.008);
const stitch=mat('#c5826d');
for(let i=0;i<3;i++)ellipsoid(rig,stitch,[0,1.25-i*.09,.3],[.015,.015,.01]);
const legs=[];
for(const side of [-1,1]){
 const pivot=new THREE.Group();pivot.position.set(side*.19,.81,0);rig.add(pivot);legs.push(pivot);
 latheBody(pivot,shorts,[[0,0],[.16,0],[.18,.07],[.17,.29],[0,.32]],[0,-.32,0],.95);
 const leg=mesh(new THREE.CapsuleGeometry(.115,.25,8,20),skin,pivot,[0,-.46,0]);
 ellipsoid(pivot,skin,[0,-.67,.085],[.14,.105,.225]);
 for(let i=0;i<3;i++)ellipsoid(pivot,skin,[-.06+i*.055,-.655,.26],[.035,.04,.036]);
}
const arms=[];
for(const side of [-1,1]){
 const pivot=new THREE.Group();pivot.position.set(side*.30,1.25,0);rig.add(pivot);arms.push(pivot);
 pivot.rotation.z=side*.2;
 const sleeve=mesh(new THREE.CapsuleGeometry(.155,.13,8,24),shirt,pivot,[side*.055,-.12,0]);
 mesh(new THREE.CapsuleGeometry(.105,.20,8,20),skin,pivot,[side*.09,-.32,0]);
 const hand=ellipsoid(pivot,skin,[side*.09,-.48,.01],[.115,.125,.105]);
 ellipsoid(pivot,skin,[side*.025,-.45,.08],[.065,.07,.06]);
}
const head=new THREE.Group();head.position.y=1.88;rig.add(head);
const headGeometry=new THREE.SphereGeometry(1,64,48);
const hp=headGeometry.attributes.position;
for(let i=0;i<hp.count;i++) {const x=hp.getX(i),y=hp.getY(i),z=hp.getZ(i);const cheek=1+.075*Math.exp(-(((y+.28)/.35)**2));hp.setXYZ(i,x*.59*cheek,y*.56,z*.49*(y<-.55?.93:1));}
headGeometry.computeVertexNormals();mesh(headGeometry,skin,head);
for(const side of [-1,1]){ellipsoid(head,skin,[side*.575,-.025,0],[.12,.145,.095]);ellipsoid(head,mat('#eeb89e'),[side*.64,-.025,.043],[.035,.07,.03]);}
ellipsoid(head,hair,[0,.16,-.09],[.593,.46,.435]);
// Soft fringe peeks out beneath the towel, instead of a flat painted hairline.
for(let i=0;i<6;i++){const x=-.4+i*.155;const lock=ellipsoid(head,hair,[x,.29-Math.sin(i*.7)*.035,.36],[.12,.19,.09]);lock.rotation.z=-.25+i*.13;}
const nose=ellipsoid(head,skin,[0,-.085,.49],[.045,.039,.035]);
function faceTexture(expression) {
 return canvasTexture((c,w,h)=>{
  const ellipse=(x,y,rx,ry,color)=>{c.fillStyle=color;c.beginPath();c.ellipse(x,y,rx,ry,0,0,Math.PI*2);c.fill();};
  // Translucent watercolor cheeks.
  for(const x of [105,407]){const g=c.createRadialGradient(x,308,2,x,308,62);g.addColorStop(0,'rgba(230,132,125,.6)');g.addColorStop(.55,'rgba(238,146,135,.34)');g.addColorStop(1,'rgba(245,170,150,0)');c.fillStyle=g;c.fillRect(x-65,244,130,130);for(let i=0;i<3;i++){c.strokeStyle='#d98f8260';c.lineWidth=3;c.beginPath();c.moveTo(x-17+i*16,305);c.lineTo(x-21+i*16,318);c.stroke();}}
  c.lineCap='round';
  for(const x of [163,349]){
   c.strokeStyle='#765041';c.lineWidth=9;c.beginPath();c.moveTo(x-26,171);c.quadraticCurveTo(x,158,x+24,171);c.stroke();
   if(expression==='sleep'||expression==='happy') {c.strokeStyle='#654436';c.lineWidth=10;c.beginPath();c.moveTo(x-26,245);c.quadraticCurveTo(x,expression==='sleep'?267:214,x+26,245);c.stroke();}
   else {ellipse(x,239,29,39,'#51382f');ellipse(x+1,246,21,26,'#87523c');ellipse(x,234,19,27,'#402e29');ellipse(x-10,220,9,11,'#fff9ef');ellipse(x+10,251,4.5,5,'#fce4be');c.strokeStyle='#51382f';c.lineWidth=7;c.beginPath();c.moveTo(x-28,225);c.quadraticCurveTo(x-4,204,x+27,222);c.stroke();}
  }
  c.strokeStyle='#9d5c4c';c.lineWidth=7;c.beginPath();
  if(expression==='sleep'){c.ellipse(256,335,9,12,0,0,Math.PI*2);c.stroke();}
  else if(expression==='happy'){c.moveTo(231,322);c.quadraticCurveTo(256,363,281,322);c.closePath();c.fillStyle='#a65e51';c.fill();ellipse(256,338,13,7,'#edac9b');}
  else {c.moveTo(236,326);c.quadraticCurveTo(256,347,276,326);c.stroke();}
 },512,512);
}
const faces={normal:faceTexture('normal'),sleep:faceTexture('sleep'),happy:faceTexture('happy')};
// Project the illustration onto the front of the sculpted head (no flat face card).
const faceGeometry=new THREE.PlaneGeometry(1.01,.86,40,36);
const fp=faceGeometry.attributes.position;
for(let i=0;i<fp.count;i++){const x=fp.getX(i),y=fp.getY(i)-.055;fp.setXYZ(i,x,y,.496*Math.sqrt(Math.max(.08,1-(x/.63)**2-(y/.58)**2))+.008);}
faceGeometry.computeVertexNormals();
const faceMaterial=new THREE.MeshStandardMaterial({map:faces.normal,transparent:true,roughness:1,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-2});
const face=mesh(faceGeometry,faceMaterial,head);face.castShadow=false;
ellipsoid(head,towelMaterial,[0,.47,-.025],[.60,.23,.48]);
const band=box(head,towelMaterial,[0,.39,.34],[1.02,.17,.20],.07);band.rotation.x=.1;
tube(head,towelSeam,[[-.48,.35,.43],[-.24,.33,.47],[0,.33,.48],[.24,.33,.47],[.48,.35,.43]],.009);
for(const side of [-1,1]){
 const roll=new THREE.Group();roll.position.set(side*.64,.43,.025);roll.rotation.z=side*-.12;head.add(roll);
 ellipsoid(roll,towelMaterial,[0,0,0],[.28,.29,.28]);
 // A continuous raised spiral visibly describes a rolled towel.
 const points=[];for(let i=0;i<=100;i++){const a=i/100*Math.PI*4.9,r=.018+.225*i/100;points.push([Math.cos(a)*r,Math.sin(a)*r,.225+.04*(1-i/100)]);}
 tube(roll,towelSeam,points,.014);
 const raised=points.map(p=>[p[0]*.94,p[1]*.94,p[2]+.012]);tube(roll,towelMaterial,raised,.031);
}
const snack=new THREE.Group();arms[1].add(snack);snack.position.set(.09,-.48,.12);
const egg=ellipsoid(snack,mat('#d8a36d'),[0,0,0],[.115,.155,.11]);
ellipsoid(snack,mat('#fff3d4'),[0,.07,.022],[.102,.095,.099]);
const drink=new THREE.Group();arms[1].add(drink);drink.position.set(.09,-.46,.1);
drink.rotation.x=2.0;
cylinder(drink,mat('#dfc09b'),[0,0,0],.13,.095,.27);
cylinder(drink,mat('#f9ebce'),[0,.14,0],.14,.14,.025);
box(drink,mat('#b98961'),[0,0,.12],[.08,.09,.008],.003);
tube(drink,mat('#f7eee0'),[[.04,.15,0],[.04,.34,0],[-.025,.38,0]],.014);
snack.visible=drink.visible=false;
// A smaller sleeping guest gives the room life without crowding the main avatar.
const guest=new THREE.Group();scene.add(guest);guest.position.set(3.55,.15,-.7);guest.rotation.y=-.45;
ellipsoid(guest,mat('#b6b0ca'),[0,.37,0],[.32,.36,.25]);
ellipsoid(guest,skin,[0,.93,.04],[.41,.37,.34]);
ellipsoid(guest,towelMaterial,[0,1.2,.01],[.4,.14,.33]);
for(const s of [-1,1]){ellipsoid(guest,towelMaterial,[s*.43,1.19,0],[.18,.18,.18]);ellipsoid(guest,skin,[s*.25,.15,.27],[.14,.12,.19]);tube(guest,palette.dark,[[s*.14-.055,.94,.36],[s*.14,.925,.38],[s*.14+.055,.94,.36]],.012);ellipsoid(guest,mat('#eaa799'),[s*.26,.85,.32],[.065,.035,.015]);}
tube(guest,mat('#a3705a'),[[-.04,.82,.375],[0,.8,.38],[.04,.82,.375]],.01);

// A few translucent motes, kept subtle and disabled for reduced motion.
const motePositions=new Float32Array(36*3);for(let i=0;i<36;i++){motePositions[i*3]=(random()-.5)*10;motePositions[i*3+1]=random()*3.5+.4;motePositions[i*3+2]=(random()-.5)*6;}
const motesGeometry=new THREE.BufferGeometry();motesGeometry.setAttribute('position',new THREE.BufferAttribute(motePositions,3));
const motes=new THREE.Points(motesGeometry,new THREE.PointsMaterial({color:'#fff3ce',size:.028,transparent:true,opacity:.6,depthWrite:false}));scene.add(motes);

let action='stand',target=new THREE.Vector3(.2,.13,1.3),facing=.18,elapsed=0,contextLost=false,raf=0,lastTime=0;
const messages={stand:'어서 와요, 푹 쉬다 가요.',sit:'따끈따끈, 마음까지 풀리는 중.',lie:'오늘도 애썼어요. 잠깐 눈 감아요.',egg:'톡, 한 입. 이 맛에 찜질방 오죠.',drink:'달고 시원해. 식혜 한 모금의 행복.'};
function setAction(next){
 action=next;target.copy(hero.position);status.textContent=messages[next];
 for(const button of actionButtons){const selected=button.dataset.action===next;button.classList.toggle('selected',selected);button.setAttribute('aria-pressed',String(selected));}
 snack.visible=next==='egg';drink.visible=next==='drink';pillow.visible=next==='lie';
 document.querySelector('#hint').textContent=next==='stand'?'바닥을 톡 누르면 걸어가요 ↗':'다시 걷고 싶으면 바닥을 톡 눌러요 ↗';
}
actionButtons.forEach(button=>button.addEventListener('click',()=>setAction(button.dataset.action)));
const colors={peach:['#eaa991','#d9957d','#f9d6bd'],mint:['#a8c9ba','#86ad9c','#d9e7ce'],lilac:['#beb1d5','#a294bd','#e4d7ed']};
function setOutfit(color){
 const c=colors[color];if(!c)return;shirt.color.set(c[0]);shorts.color.set(c[1]);piping.color.set(c[2]);
 for(const b of outfitButtons){const active=b.dataset.color===color;b.classList.toggle('active',active);b.setAttribute('aria-pressed',String(active));}
 try{localStorage.setItem('jjimjiljung-outfit',color);}catch{/* Private browsing may disable storage. */}
}
outfitButtons.forEach(b=>b.addEventListener('click',()=>setOutfit(b.dataset.color)));
try{setOutfit(localStorage.getItem('jjimjiljung-outfit')||'peach');}catch{/* Default palette is already applied. */}
const raycaster=new THREE.Raycaster();const floorPlane=new THREE.Plane(new THREE.Vector3(0,1,0),-.13);const hit=new THREE.Vector3();
function moveTo(x,z){setAction('stand');target.set(THREE.MathUtils.clamp(x,-1.45,1.65),.13,THREE.MathUtils.clamp(z,-.45,2.45));}
viewport.addEventListener('pointerdown',e=>{if(contextLost)return;const r=viewport.getBoundingClientRect();raycaster.setFromCamera(new THREE.Vector2((e.clientX-r.left)/r.width*2-1,-(e.clientY-r.top)/r.height*2+1),camera);if(raycaster.ray.intersectPlane(floorPlane,hit))moveTo(hit.x,hit.z);});
viewport.addEventListener('keydown',e=>{const keys={ArrowLeft:[-.4,0],ArrowRight:[.4,0],ArrowUp:[0,-.4],ArrowDown:[0,.4]};if(keys[e.key]){e.preventDefault();const [x,z]=keys[e.key];moveTo(target.x+x,target.z+z);}});
function resize(){const w=viewport.clientWidth,h=viewport.clientHeight;if(!w||!h)return;renderer.setSize(w,h);const aspect=w/h;const height=aspect<1?7.35:6.5;camera.left=-height*aspect/2;camera.right=height*aspect/2;camera.top=height/2;camera.bottom=-height/2;camera.position.set(aspect<1?3.0:4.5,6.5,11.5);camera.lookAt(aspect<1?.1:0,1.0,.05);camera.updateProjectionMatrix();}
new ResizeObserver(resize).observe(viewport);resize();

// Optional synthesized room ambience. Audio is only created after an explicit tap.
let audioContext,source,audioGain,audioEnabled=false;
document.querySelector('#sound').addEventListener('click',async()=>{
 const button=document.querySelector('#sound');
 try{
  if(!audioContext){const Audio=window.AudioContext||window.webkitAudioContext;if(!Audio)throw Error('Audio unavailable');audioContext=new Audio();const buffer=audioContext.createBuffer(1,audioContext.sampleRate*3,audioContext.sampleRate);const data=buffer.getChannelData(0);let v=0;for(let i=0;i<data.length;i++){v=(v+(Math.random()*2-1)*.015)/1.015;data[i]=v*2;}source=audioContext.createBufferSource();source.buffer=buffer;source.loop=true;const filter=audioContext.createBiquadFilter();filter.type='lowpass';filter.frequency.value=450;audioGain=audioContext.createGain();audioGain.gain.value=0;source.connect(filter).connect(audioGain).connect(audioContext.destination);source.start();}
  await audioContext.resume();audioEnabled=!audioEnabled;audioGain.gain.setTargetAtTime(audioEnabled?.3:0,audioContext.currentTime,.25);button.setAttribute('aria-pressed',String(audioEnabled));button.setAttribute('aria-label',audioEnabled?'찜질방 소리 끄기':'찜질방 소리 켜기');button.innerHTML=(audioEnabled?'소리 켜짐':'소리 꺼짐')+' <span>♪</span>';
 }catch{status.textContent='이 브라우저에서는 소리를 켤 수 없어요. 조용히 쉬어 가요.';}
});

function damp(object,key,to,dt,speed=9){object[key]=THREE.MathUtils.damp(object[key],to,speed,dt);}
function frame(now){
 if(contextLost||document.hidden)return;
 const dt=Math.min((now-lastTime)/1000||.016,.05);lastTime=now;elapsed+=dt;
 const dx=target.x-hero.position.x,dz=target.z-hero.position.z,distance=Math.hypot(dx,dz);const walking=action==='stand'&&distance>.025;
 if(walking){const step=Math.min(distance,dt*1.25);hero.position.x+=dx/distance*step;hero.position.z+=dz/distance*step;facing=Math.atan2(dx,dz);}else facing=.18;
 let angle=facing-hero.rotation.y;angle=Math.atan2(Math.sin(angle),Math.cos(angle));hero.rotation.y+=angle*Math.min(1,dt*8);
 const sleep=action==='lie',sitting=action==='sit';const cycle=elapsed*9;
 damp(rig.rotation,'x',sleep?-Math.PI/2:0,dt,6);
 damp(rig.position,'y',sleep?.46:sitting?-.40:walking&&!reducedMotion?Math.abs(Math.sin(cycle))*.035:0,dt);
 // A reclining rig rests along the mat, with a pillow under its head.
 damp(rig.position,'z',sleep?.8:0,dt,6);
 for(let i=0;i<2;i++){
  damp(legs[i].rotation,'x',sitting?-1.32:sleep?.45:walking?Math.sin(cycle+i*Math.PI)*.48:0,dt);
  damp(legs[i].rotation,'z',sitting?(i===0?-.25:.25):0,dt);
  const eating=(action==='egg'||action==='drink')&&i===1;
  damp(arms[i].rotation,'x',eating?-2.0:sitting?-.5:sleep?-.18:walking?-Math.sin(cycle+i*Math.PI)*.35:0,dt);
  damp(arms[i].rotation,'z',eating?-.25:i===0?-.14:.14,dt);
 }
 if(!reducedMotion){head.rotation.z=Math.sin(elapsed*1.3)*.025;head.position.y=1.88+Math.sin(elapsed*2)*.008;guest.scale.y=1+Math.sin(elapsed*1.8)*.008;motes.rotation.y=elapsed*.008;}else{head.rotation.z=0;head.position.y=1.88;guest.scale.y=1;}
 const blink=!reducedMotion&&elapsed%4.7>4.52;const expression=sleep||blink?'sleep':action==='egg'||action==='drink'?'happy':'normal';if(faceMaterial.map!==faces[expression]){faceMaterial.map=faces[expression];faceMaterial.needsUpdate=true;}
 shadow.position.set(hero.position.x,.15,hero.position.z);shadow.scale.set(sleep?1.1:1,sleep?1.7:1,1);
 motes.visible=!reducedMotion;
 renderer.render(scene,camera);raf=requestAnimationFrame(frame);
}
renderer.domElement.addEventListener('webglcontextlost',e=>{e.preventDefault();contextLost=true;cancelAnimationFrame(raf);window.showRoomError('3D 화면이 잠시 멈췄어요. 다시 들어가면 편안한 방으로 돌아갈 수 있어요.');});
renderer.domElement.addEventListener('webglcontextrestored',()=>location.reload());
document.addEventListener('visibilitychange',()=>{if(document.hidden){cancelAnimationFrame(raf);if(audioContext)audioContext.suspend().catch(()=>{});}else{lastTime=performance.now();if(!contextLost)raf=requestAnimationFrame(frame);if(audioEnabled&&audioContext)audioContext.resume().catch(()=>{});}});
renderer.render(scene,camera);
clearTimeout(window.roomLoadTimer);document.querySelector('#loading').hidden=true;document.querySelector('#error').hidden=true;
viewport.dataset.ready='true';lastTime=performance.now();raf=requestAnimationFrame(frame);
