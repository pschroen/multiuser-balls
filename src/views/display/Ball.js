import { Color, Group, IcosahedronGeometry, Mesh, MeshPhongMaterial, PointLight, ShaderChunk } from 'three';

import { lightColor } from '../../config/Config.js';

export class Ball extends Group {
	constructor() {
		super();

		// Physics
		this.radius = 0.075;

		this.initMesh();
		this.initLight();
		this.setColor(this.light.color);
	}

	initMesh() {
		const geometry = new IcosahedronGeometry(this.radius, 3);

		const material = new MeshPhongMaterial({
			color: new Color(0.5, 0.5, 0.5),
			emissive: new Color(lightColor),
			emissiveIntensity: 0.9
		});

		// Based on https://github.com/mrdoob/three.js/blob/dev/examples/jsm/shaders/SubsurfaceScatteringShader.js by daoshengmu

		material.onBeforeCompile = shader => {
			shader.uniforms.thicknessDistortion = { value: 0.1 };
			shader.uniforms.thicknessAmbient = { value: 0 };
			shader.uniforms.thicknessAttenuation = { value: 0.2 };
			shader.uniforms.thicknessPower = { value: 2 };
			shader.uniforms.thicknessScale = { value: 16 };

			shader.fragmentShader = shader.fragmentShader.replace(
				'void main() {',
				/* glsl */ `
				uniform float thicknessDistortion;
				uniform float thicknessAmbient;
				uniform float thicknessAttenuation;
				uniform float thicknessPower;
				uniform float thicknessScale;

				void RE_Direct_Scattering(IncidentLight directLight, vec3 geometryPosition, vec3 geometryNormal, vec3 geometryViewDir, vec3 geometryClearcoatNormal, inout ReflectedLight reflectedLight) {
					vec3 thickness = directLight.color * 0.8;
					vec3 scatteringHalf = normalize(directLight.direction + (geometryNormal * thicknessDistortion));
					float scatteringDot = pow(saturate(dot(geometryViewDir, -scatteringHalf)), thicknessPower) * thicknessScale;
					vec3 scatteringIllu = (scatteringDot + thicknessAmbient) * thickness;
					reflectedLight.directDiffuse += scatteringIllu * thicknessAttenuation * directLight.color;
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
					RE_Direct_Scattering(directLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, reflectedLight);
					`
				)
			);
		};

		const mesh = new Mesh(geometry, material);
		this.add(mesh);

		this.material = material;
	}

	initLight() {
		const light = new PointLight(lightColor, 1, 1, 0);
		this.add(light);

		this.light = light;
	}

	// Public methods

	setColor = color => {
		this.material.emissive.copy(color);
		this.light.color.copy(color).lerp(this.material.color, 0.94);
	};
}
