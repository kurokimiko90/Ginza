import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';

registerHooks({ resolve(specifier, context, next) {
  return next(specifier === 'three' ? new URL('../web/vendor/three.module.js', import.meta.url).href : specifier, context);
} });
const THREE = await import('three');
const { createStreetLighting } = await import('../web/surface-lighting.js');
const operations = [];
globalThis.document = { createElement() {
  return { getContext() { return {
    fillRect() {}, save() {}, restore() {}, translate(x, y) { operations.push([x, y]); },
    scale() {}, createRadialGradient() { return { addColorStop() {} }; },
  }; } };
} };
const lamps = [{ type: 'lamp', x: 10, z: 20, heading: 0 }, { type: 'signal', x: 1, z: 1 }];
const signs = [{ kind: 'shop', x: 2, z: 3, nx: 1, nz: 0 }, { kind: 'crown', x: 1, z: 1 }];
const before = JSON.stringify([lamps, signs]);
const lighting = createStreetLighting([-100, -100, 100, 100], lamps, signs);
assert.equal(operations.length, 3, 'two lamp arms and one ground-level shop source');
assert.equal(JSON.stringify([lamps, signs]), before, 'source positions remain unchanged');
const material = new THREE.MeshStandardMaterial();
let previousCalls = 0;
material.onBeforeCompile = () => previousCalls++;
const group = new THREE.Group();
group.add(new THREE.Mesh(new THREE.PlaneGeometry(), material));
const instanceMaterial = new THREE.MeshStandardMaterial();
const previousInstance = instanceMaterial.onBeforeCompile;
group.add(new THREE.InstancedMesh(new THREE.BoxGeometry(), instanceMaterial, 1));
lighting.attach(group); lighting.attach(group);
assert.equal(instanceMaterial.onBeforeCompile, previousInstance, 'instanced prop shaders are not modified');
const pavement = new THREE.MeshStandardMaterial();
pavement.userData.ginzaPaving = new THREE.Texture();
const pavingGroup = new THREE.Group(); pavingGroup.add(new THREE.Mesh(new THREE.PlaneGeometry(), pavement));
lighting.attach(pavingGroup);
assert.notEqual(material.customProgramCacheKey(), pavement.customProgramCacheKey(), 'paving uses a separate shader program');
const pavingShader = { uniforms: {}, vertexShader: '#include <project_vertex>', fragmentShader: '#include <map_fragment>\n#include <emissivemap_fragment>' };
pavement.onBeforeCompile(pavingShader, {});
assert.ok(pavingShader.fragmentShader.includes('texture2D(ginzaPaving'));
const shader = { uniforms: {}, vertexShader: '#include <project_vertex>', fragmentShader: '#include <emissivemap_fragment>' };
material.onBeforeCompile(shader, {});
assert.equal(previousCalls, 1, 'shared material is patched only once');
assert.ok(shader.vertexShader.includes('modelMatrix * ginzaPosition'));
assert.ok(shader.fragmentShader.includes('ginzaUV.y = 1.0 - ginzaUV.y'));
assert.ok(shader.fragmentShader.includes('smoothstep(0.5, 7.0'));
assert.equal(shader.uniforms.ginzaNight.value, 0);
lighting.setNight(1); assert.equal(shader.uniforms.ginzaNight.value, 1);
lighting.setNight(0); assert.equal(shader.uniforms.ginzaNight.value, 0);
console.log('ok: local light sources, world UV, night updates and instance isolation');
