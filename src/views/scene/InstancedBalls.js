import { Color, DynamicDrawUsage, Group, IcosahedronGeometry, InstancedMesh, MathUtils, MeshStandardMaterial, RepeatWrapping, ShaderChunk, Vector2 } from 'three';
import { headsTails } from '@alienkitty/space.js/three';

import { WorldController } from '../../controllers/world/WorldController.js';

import { layers } from '../../config/Config.js';

// https://adinunz.io/translucentPearls/

// Based on http://lo-th.github.io/Oimo.js/#planet

export class InstancedBalls extends Group {
	constructor() {
		super();

		// Physics
		this.radius = 1;
	}

	async initMesh() {
		const { anisotropy, loadTexture } = WorldController;

		const geometry = new IcosahedronGeometry(this.radius, 12);

		// Second set of UVs for aoMap and lightMap
		// https://threejs.org/docs/#api/en/materials/MeshStandardMaterial.aoMap
		geometry.attributes.uv1 = geometry.attributes.uv;

		// Textures
		const [map, normalMap, ormMap, thicknessMap] = await Promise.all([
			// loadTexture('assets/textures/uv.jpg'),
			loadTexture('assets/textures/pbr/pitted_metal_basecolor.jpg'),
			loadTexture('assets/textures/pbr/pitted_metal_normal.jpg'),
			// https://occlusion-roughness-metalness.glitch.me/
			loadTexture('assets/textures/pbr/pitted_metal_orm.jpg'),
			loadTexture('assets/textures/pbr/pitted_metal_height.jpg')
		]);

		map.anisotropy = anisotropy;
		map.wrapS = RepeatWrapping;
		map.wrapT = RepeatWrapping;
		map.repeat.set(2, 1);

		normalMap.anisotropy = anisotropy;
		normalMap.wrapS = RepeatWrapping;
		normalMap.wrapT = RepeatWrapping;
		normalMap.repeat.set(2, 1);

		ormMap.anisotropy = anisotropy;
		ormMap.wrapS = RepeatWrapping;
		ormMap.wrapT = RepeatWrapping;
		ormMap.repeat.set(2, 1);

		thicknessMap.anisotropy = anisotropy;
		thicknessMap.wrapS = RepeatWrapping;
		thicknessMap.wrapT = RepeatWrapping;
		thicknessMap.repeat.set(2, 1);

		const material = new MeshStandardMaterial({
			color: new Color().offsetHSL(0, 0, -0.65),
			metalness: 0.7,
			roughness: 2,
			map,
			metalnessMap: ormMap,
			roughnessMap: ormMap,
			aoMap: ormMap,
			aoMapIntensity: 1,
			normalMap,
			normalScale: new Vector2(3, 3)
		});

		// Second channel for aoMap and lightMap
		// https://threejs.org/docs/#api/en/materials/MeshStandardMaterial.aoMap
		material.aoMap.channel = 1;

		// Based on https://github.com/mrdoob/three.js/blob/dev/examples/jsm/shaders/SubsurfaceScatteringShader.js by daoshengmu
		// Based on https://gist.github.com/mattdesl/2ee82157a86962347dedb6572142df7c

		material.onBeforeCompile = shader => {
			shader.uniforms.thicknessMap = { value: thicknessMap };
			shader.uniforms.thicknessDistortion = { value: 0.05 };
			shader.uniforms.thicknessAmbient = { value: 0 };
			shader.uniforms.thicknessAttenuation = { value: 0.8 };
			shader.uniforms.thicknessPower = { value: 2 };
			shader.uniforms.thicknessScale = { value: 16 };

			shader.fragmentShader = shader.fragmentShader.replace(
				'void main() {',
				/* glsl */ `
				uniform sampler2D thicknessMap;
				uniform float thicknessDistortion;
				uniform float thicknessAmbient;
				uniform float thicknessAttenuation;
				uniform float thicknessPower;
				uniform float thicknessScale;

				void RE_Direct_Scattering(IncidentLight directLight, vec2 uv, vec3 geometryPosition, vec3 geometryNormal, vec3 geometryViewDir, vec3 geometryClearcoatNormal, PhysicalMaterial material, inout ReflectedLight reflectedLight) {
					vec3 thickness = directLight.color * texture(thicknessMap, uv).r;
					vec3 scatteringHalf = normalize(directLight.direction + (geometryNormal * thicknessDistortion));
					float scatteringDot = pow(saturate(dot(geometryViewDir, -scatteringHalf)), thicknessPower) * thicknessScale;
					vec3 scatteringIllu = (scatteringDot + thicknessAmbient) * thickness;
					reflectedLight.directDiffuse += material.diffuseColor * directLight.color * scatteringIllu * thicknessAttenuation;
				}

				void main() {
				`
			);

			shader.fragmentShader = shader.fragmentShader.replace(
				'#include <lights_fragment_begin>',
				// ShaderChunk.lights_fragment_begin.replaceAll(
				ShaderChunk.lights_fragment_begin.replace(
					'RE_Direct( directLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );',
					/* glsl */ `
					// RE_Direct( directLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
					RE_Direct_Scattering(directLight, vAoMapUv, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight);
					`
				)
			);
		};

		const mesh = new InstancedMesh(geometry, material, 100);
		mesh.instanceMatrix.setUsage(DynamicDrawUsage); // Will be updated every frame
		mesh.layers.enable(layers.buffers);
		this.add(mesh);

		const object = new Group();

		for (let i = 0; i < mesh.count; i++) {
			object.position.x = MathUtils.randFloat(10, 100) * (headsTails() ? -1 : 1);
			object.position.y = MathUtils.randFloat(10, 100) * (headsTails() ? -1 : 1);
			object.position.z = MathUtils.randFloat(10, 100) * (headsTails() ? -1 : 1);

			object.rotation.x = MathUtils.degToRad(MathUtils.randInt(0, 360));
			object.rotation.y = MathUtils.degToRad(MathUtils.randInt(0, 360));
			object.rotation.z = MathUtils.degToRad(MathUtils.randInt(0, 360));

			object.updateMatrix();

			mesh.setMatrixAt(i, object.matrix);
		}

		// mesh.computeBoundingSphere();

		this.mesh = mesh;
	}

	// Public methods

	ready = () => this.initMesh();
}
