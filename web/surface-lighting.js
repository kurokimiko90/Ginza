import * as THREE from 'three';

// Static ground-level illumination approximation, not shadow-casting lights or SSR.
// One shared map keeps the cost independent of the number of street lamps.
export function createStreetLighting(bounds, lamps, signs, storefronts = []) {
  const [minX, minZ, maxX, maxZ] = bounds;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 2048;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#000'; ctx.fillRect(0, 0, 2048, 2048);
  const sx = 2048 / (maxX - minX), sz = 2048 / (maxZ - minZ);
  function pool(x, z, radius, strength) {
    ctx.save();
    ctx.translate((x - minX) * sx, (z - minZ) * sz);
    ctx.scale(sx, sz);
    const glow = ctx.createRadialGradient(0, 0, 0, 0, 0, radius);
    glow.addColorStop(0, `rgba(255,238,210,${strength})`);
    glow.addColorStop(0.4, `rgba(255,238,210,${strength * 0.65})`);
    glow.addColorStop(1, 'rgba(255,238,210,0)');
    ctx.globalCompositeOperation = 'lighten';
    ctx.fillStyle = glow; ctx.fillRect(-radius, -radius, radius * 2, radius * 2);
    ctx.restore();
  }
  for (const lamp of lamps.filter(p => p.type === 'lamp')) {
    pool(lamp.x + Math.cos(lamp.heading) * 1.2, lamp.z - Math.sin(lamp.heading) * 1.2, 10, 0.85);
    pool(lamp.x - Math.cos(lamp.heading) * 1.2, lamp.z + Math.sin(lamp.heading) * 1.2, 6, 0.6);
  }
  for (const s of signs.filter(s => s.kind !== 'crown')) pool(s.x + s.nx * 2, s.z + s.nz * 2, 5, 0.32);
  for (const s of storefronts) pool(s.x, s.z, 4.2, 0.5);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const uniforms = {
    ginzaLightMap: { value: texture }, ginzaNight: { value: 0 },
    ginzaBounds: { value: new THREE.Vector4(minX, minZ, maxX - minX, maxZ - minZ) },
  };
  const attached = new Set();
  return {
    attach(group) {
      group.traverse(object => {
        if (object.isInstancedMesh) return; // Keep instanced prop shaders independent.
        for (const material of [object.material].flat().filter(Boolean)) {
          if (!material.isMeshStandardMaterial || attached.has(material)) continue;
          attached.add(material);
          const previous = material.onBeforeCompile;
          const previousKey = material.customProgramCacheKey();
          const paving = material.userData.ginzaPaving;
          material.onBeforeCompile = function(shader, renderer) {
            previous.call(this, shader, renderer);
            Object.assign(shader.uniforms, uniforms);
            shader.vertexShader = 'varying vec3 vGinzaWorld;\n' + shader.vertexShader;
            // transformed includes morph/skin; instance transform precedes model transform.
            shader.vertexShader = shader.vertexShader.replace('#include <project_vertex>', `
              vec4 ginzaPosition = vec4(transformed, 1.0);
              #ifdef USE_INSTANCING
                ginzaPosition = instanceMatrix * ginzaPosition;
              #endif
              vGinzaWorld = (modelMatrix * ginzaPosition).xyz;
              #include <project_vertex>`);
            shader.fragmentShader = 'varying vec3 vGinzaWorld;\nuniform sampler2D ginzaLightMap;\nuniform float ginzaNight;\nuniform vec4 ginzaBounds;\n' + shader.fragmentShader;
            if (paving) {
              shader.uniforms.ginzaPaving = { value: paving };
              shader.fragmentShader = 'uniform sampler2D ginzaPaving;\n' + shader.fragmentShader;
              shader.fragmentShader = shader.fragmentShader.replace('#include <map_fragment>', `
                #include <map_fragment>
                diffuseColor.rgb *= mix(vec3(1.0), texture2D(ginzaPaving, vGinzaWorld.xz * vec2(0.5, -0.5)).rgb * 1.4, 0.85);`);
            }
            shader.fragmentShader = shader.fragmentShader.replace('#include <emissivemap_fragment>', `
              #include <emissivemap_fragment>
              vec2 ginzaUV = (vGinzaWorld.xz - ginzaBounds.xy) / ginzaBounds.zw;
              float ginzaInside = step(0.0, ginzaUV.x) * step(0.0, ginzaUV.y) * step(ginzaUV.x, 1.0) * step(ginzaUV.y, 1.0);
              ginzaUV.y = 1.0 - ginzaUV.y;
              float ginzaHeight = 1.0 - smoothstep(0.5, 7.0, vGinzaWorld.y);
              totalEmissiveRadiance += texture2D(ginzaLightMap, ginzaUV).rgb * diffuseColor.rgb * ginzaNight * ginzaHeight * ginzaInside * 1.7;`);
          };
          material.customProgramCacheKey = () => `${previousKey}|ginza-street-light-v2|paving:${!!paving}`;
          material.needsUpdate = true;
        }
      });
    },
    setNight(night) { uniforms.ginzaNight.value = night; },
  };
}
