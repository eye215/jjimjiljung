// Offline, geometry-only refinement of the existing mobile GLBs.
// Requires sharp (image decoding only). UVs, textures, skin weights, skeleton and clips
// stay byte-for-byte intact. Run from the repo root with a separate source GLB.
const fs = require('node:fs');
const sharp = require('sharp');

async function refine(input, output, profile = 'plain') {
  const bytes = fs.readFileSync(input), jsonLength = bytes.readUInt32LE(12);
  const gltf = JSON.parse(bytes.subarray(20, 20 + jsonLength));
  const binStart = 28 + jsonLength, bin = Buffer.from(bytes.subarray(binStart));
  const primitive = gltf.meshes[0].primitives[0];
  if (gltf.meshes.length !== 1 || gltf.meshes[0].primitives.length !== 1) throw Error('Expected one skinned primitive');
  const widths = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4 };
  function accessor(index) {
    const a = gltf.accessors[index], b = gltf.bufferViews[a.bufferView];
    const size = a.componentType === 5126 || a.componentType === 5125 ? 4 : 2;
    const dim = widths[a.type], stride = b.byteStride || size * dim, offset = (b.byteOffset || 0) + (a.byteOffset || 0);
    if (a.sparse || !dim || ![5126, 5125, 5123].includes(a.componentType)) throw Error('Unsupported accessor');
    return { count: a.count, dim, offset, stride, size,
      get(i, c = 0) { const k = offset + i * stride + c * size; return a.componentType === 5126 ? bin.readFloatLE(k) : a.componentType === 5125 ? bin.readUInt32LE(k) : bin.readUInt16LE(k); },
      set(i, c, v) { if (a.componentType !== 5126) throw Error('Only float attributes may change'); bin.writeFloatLE(v, offset + i * stride + c * 4); }
    };
  }
  const P = accessor(primitive.attributes.POSITION), N = accessor(primitive.attributes.NORMAL);
  const UV = accessor(primitive.attributes.TEXCOORD_0), I = accessor(primitive.indices);
  const tex = gltf.textures[gltf.materials[primitive.material].pbrMetallicRoughness.baseColorTexture.index];
  const im = gltf.images[tex.extensions?.EXT_texture_webp?.source ?? tex.source], view = gltf.bufferViews[im.bufferView];
  const {data, info} = await sharp(bin.subarray(view.byteOffset || 0, (view.byteOffset || 0) + view.byteLength)).removeAlpha().raw().toBuffer({resolveWithObject: true});
  const ids = new Map(), vertexGroup = new Uint32Array(P.count), groups = [];
  for (let i = 0; i < P.count; i++) {
    const p = [P.get(i, 0), P.get(i, 1), P.get(i, 2)], key = p.map(v => v.toFixed(5)).join(',');
    if (!ids.has(key)) { ids.set(key, groups.length); groups.push({p, original: p.slice(), vertices: [], neighbors: new Set(), hairVotes: 0}); }
    const id = ids.get(key), g = groups[id]; vertexGroup[i] = id; g.vertices.push(i);
    const x = Math.max(0, Math.min(info.width - 1, Math.floor(UV.get(i, 0) * info.width)));
    const y = Math.max(0, Math.min(info.height - 1, Math.floor(UV.get(i, 1) * info.height)));
    const k = (y * info.width + x) * info.channels, r = data[k] / 255, green = data[k + 1] / 255, b = data[k + 2] / 255;
    // Do not select eyes/eyebrows or the white towel. Front face stays protected.
    const face = p[2] > .22 && Math.abs(p[0]) < .32 && p[1] < 1.08;
    if (!face && p[1] > .83 && r > .025 && r < .48 && r > green * 1.12 && r > b * 1.4 && .2126*r + .7152*green + .0722*b < .3) g.hairVotes++;
  }
  for (let t = 0; t < I.count; t += 3) {
    const a = vertexGroup[I.get(t)], b = vertexGroup[I.get(t + 1)], c = vertexGroup[I.get(t + 2)];
    groups[a].neighbors.add(b).add(c); groups[b].neighbors.add(a).add(c); groups[c].neighbors.add(a).add(b);
  }
  const hair = groups.map(g => g.hairVotes === g.vertices.length && g.neighbors.size > 2);
  // Keep the skin boundary stationary; soften the mask over three edge rings.
  let weight = hair.map(v => v ? 1 : 0);
  for (let pass = 0; pass < 3; pass++) weight = groups.map((g, i) => hair[i] ? Math.min(weight[i], ...[...g.neighbors].map(j => weight[j] + .3)) : 0);
  // Low-pass Taubin pairs remove micro corrugation without shrinking the head.
  for (let pass = 0; pass < 36; pass++) for (const factor of [.5, -.51]) {
    const next = groups.map((g, i) => {
      if (!weight[i]) return g.p;
      const mean = [0, 0, 0]; for (const j of g.neighbors) for (let c = 0; c < 3; c++) mean[c] += groups[j].p[c] / g.neighbors.size;
      const p = g.p.map((v, c) => v + (mean[c] - v) * factor * weight[i]);
      const delta = p.map((v, c) => v - g.original[c]), length = Math.hypot(...delta), limit = .025;
      return length > limit ? g.original.map((v, c) => v + delta[c] * limit / length) : p;
    });
    groups.forEach((g, i) => { g.p = next[i]; });
  }
  // Fit the surrounding cheek/forehead surface across each baked eye recess.
  // This removes geometric dents under shader-painted expressions, not their colour.
  const eye = profile === 'cap' ? [.174, .926] : [.19, .942];
  const faceChanged = new Set(), faceNormals = new Map();
  function solve(matrix, vector) {
    const a = matrix.map((r, i) => [...r, vector[i]]);
    for (let c = 0; c < 6; c++) {
      let pivot = c; for (let r = c + 1; r < 6; r++) if (Math.abs(a[r][c]) > Math.abs(a[pivot][c])) pivot = r;
      [a[c], a[pivot]] = [a[pivot], a[c]]; if (Math.abs(a[c][c]) < 1e-9) throw Error('Eye surface fit is singular');
      const div = a[c][c]; for (let k = c; k <= 6; k++) a[c][k] /= div;
      for (let r = 0; r < 6; r++) if (r !== c) { const f = a[r][c]; for (let k = c; k <= 6; k++) a[r][k] -= f * a[c][k]; }
    }
    return a.map(r => r[6]);
  }
  const mouth = profile === 'cap' ? [.006, .872] : [-.012, .888];
  const patches = [[-eye[0],eye[1],.085,.08],[eye[0],eye[1],.085,.08],[mouth[0],mouth[1],.075,.045]];
  for (const [cx,cy,rx,ry] of patches) {
    const coords = g => [(g.original[0] - cx) / rx, (g.original[1] - cy) / ry];
    const features = (x, y) => [1, x, y, x*x, x*y, y*y];
    const matrix = Array.from({length: 6}, () => Array(6).fill(0)), vector = Array(6).fill(0);
    let samples = 0;
    for (const g of groups) {
      const [x, y] = coords(g), radius = Math.hypot(x, y);
      if (g.original[2] < .27 || radius < 1.05 || radius > (ry < .05 ? 2.2 : 1.5)) continue;
      const f = features(x, y); samples++;
      for (let a = 0; a < 6; a++) { vector[a] += f[a] * g.original[2]; for (let b = 0; b < 6; b++) matrix[a][b] += f[a] * f[b]; }
    }
    if (samples < 12) throw Error('Not enough surrounding skin samples');
    const fit = solve(matrix, vector);
    for (let i = 0; i < groups.length; i++) {
      const g = groups[i], [x, y] = coords(g), radius = Math.hypot(x, y);
      if (g.original[2] < .27 || radius > 1.5) continue;
      const nx = -(fit[1] + 2*fit[3]*x + fit[4]*y)/rx;
      const ny = -(fit[2] + fit[4]*x + 2*fit[5]*y)/ry;
      const normalLength = Math.hypot(nx,ny,1);
      const nt = Math.max(0,Math.min(1,(1.5-radius)/.45));
      faceNormals.set(i,{normal:[nx/normalLength,ny/normalLength,1/normalLength],blend:nt*nt*(3-2*nt)});
      if (radius > 1.2) continue;
      const z = features(x, y).reduce((sum, v, j) => sum + v * fit[j], 0);
      const t = Math.max(0, Math.min(1, (1.2 - radius) / .3)), blend = t*t*(3 - 2*t);
      const delta = Math.max(-.035, Math.min(.035, z - g.p[2])) * blend;
      if (Math.abs(delta) > 1e-7) { g.p[2] += delta; faceChanged.add(i); }
    }
  }
  const changed = new Set(); let maxDisplacement = 0;
  groups.forEach((g, i) => { const delta = Math.hypot(...g.p.map((v, c) => v - g.original[c])); if (delta > 1e-7) { changed.add(i); maxDisplacement = Math.max(maxDisplacement, delta); for (const id of g.vertices) for (let c = 0; c < 3; c++) P.set(id, c, g.p[c]); } });
  // Recompute only affected surface normals, including the immediate shared ring.
  const affected = new Set(changed); for (const i of changed) for (const j of groups[i].neighbors) affected.add(j);
  const sums = groups.map(() => [0, 0, 0]);
  for (let t = 0; t < I.count; t += 3) {
    const ids3 = [0,1,2].map(c => vertexGroup[I.get(t+c)]), [a,b,c] = ids3.map(i => groups[i].p);
    const u = b.map((v,i)=>v-a[i]), v = c.map((v,i)=>v-a[i]);
    const normal = [u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]];
    for (const i of ids3) for (let c = 0; c < 3; c++) sums[i][c] += normal[c];
  }
  for (const i of affected) { const len = Math.hypot(...sums[i]); if (len < 1e-12) continue; for (const id of groups[i].vertices) for (let c = 0; c < 3; c++) N.set(id, c, sums[i][c]/len); }
  // Analytic normals across the fitted eye patch prevent the old low-poly eye rim
  // from reappearing as a triangular highlight even after the recess is removed.
  for(const [i,{normal,blend}] of faceNormals)for(const id of groups[i].vertices){const n=normal.map((v,c)=>N.get(id,c)*(1-blend)+v*blend),len=Math.hypot(...n);for(let c=0;c<3;c++)N.set(id,c,n[c]/len);}
  // Shared triangles can touch the neck: keep every body sample byte-identical.
  for(let i=0;i<P.count;i++)if(bytes.readFloatLE(binStart+P.offset+i*P.stride+4)<=.8){
    for(const attr of [P,N])bytes.copy(bin,attr.offset+i*attr.stride,binStart+attr.offset+i*attr.stride,binStart+attr.offset+i*attr.stride+12);
  }
  // The buffer size, layout and original JSON are retained exactly. Existing accessor
  // bounds enclose the small inward surface edits (verify before writing).
  const bounds = gltf.accessors[primitive.attributes.POSITION];
  for (let i=0;i<P.count;i++) for(let c=0;c<3;c++) if(P.get(i,c)<bounds.min[c]-1e-6||P.get(i,c)>bounds.max[c]+1e-6) throw Error('Refinement exceeds original bounds');
  const result = Buffer.from(bytes); bin.copy(result, binStart);
  const report={profile,vertices:P.count,hairGroups:hair.filter(Boolean).length,eyeGroups:faceChanged.size,changedGroups:changed.size,maxDisplacement,unchangedBytesExceptPositionAndNormals:true};
  const allowed=new Uint8Array(bin.length);for(const attr of [P,N])for(let i=0;i<attr.count;i++)allowed.fill(1,attr.offset+i*attr.stride,attr.offset+i*attr.stride+12);
  for(let i=0;i<bin.length;i++)if(!allowed[i]&&bin[i]!==bytes[binStart+i])throw Error('Unexpected mutation outside position/normal attributes');
  fs.writeFileSync(output,result);
  console.log(JSON.stringify(report)); return report;
}
if(require.main===module)refine(...process.argv.slice(2)).catch(e=>{console.error(e);process.exitCode=1;});
module.exports={refine};
