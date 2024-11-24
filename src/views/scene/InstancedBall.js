import { Color, DynamicDrawUsage, Group, IcosahedronGeometry, InstancedBufferAttribute, InstancedMesh, Matrix4, MeshBasicMaterial, MeshPhongMaterial, PointLight, ShaderChunk } from 'three';

import { layers, lightColor, numPointers } from '../../config/Config.js';

export class InstancedBall extends Group {
	constructor() {
		super();

		// Lights
		this.color = new Color(lightColor);
		this.lights = [];

		// Physics
		this.radius = 1;
	}

	async initMesh() {
		const color = this.color;

		const geometry = new IcosahedronGeometry(this.radius, 3);

		const material = new MeshPhongMaterial();

		// Based on https://github.com/mrdoob/three.js/blob/dev/examples/jsm/shaders/SubsurfaceScatteringShader.js by daoshengmu

		material.onBeforeCompile = shader => {
			shader.uniforms.thicknessDistortion = { value: 0.1 };
			shader.uniforms.thicknessAmbient = { value: 0 };
			shader.uniforms.thicknessAttenuation = { value: 0.2 };
			shader.uniforms.thicknessPower = { value: 2 };
			shader.uniforms.thicknessScale = { value: 14 };

			// https://github.com/mrdoob/three.js/pull/22147/files

			shader.vertexShader = shader.vertexShader.replace(
				'#include <common>',
				/* glsl */ `
				attribute float instanceVisibility;
				varying float vInstanceVisibility;
				varying vec3 vLightPosition;
				#include <common>
				`
			);

			shader.vertexShader = shader.vertexShader.replace(
				'#include <begin_vertex>',
				/* glsl */ `
				#include <begin_vertex>
				vInstanceVisibility = instanceVisibility;
				vLightPosition = instanceMatrix[3].xyz;
				`
			);

			shader.fragmentShader = shader.fragmentShader.replace(
				'#include <common>',
				/* glsl */ `
				varying float vInstanceVisibility;
				varying vec3 vLightPosition;
				#include <common>
				`
			);

			shader.fragmentShader = shader.fragmentShader.replace(
				'vec4 diffuseColor = vec4( diffuse, opacity );',
				/* glsl */ `
				if (vInstanceVisibility == 0.0) discard;
				vec4 diffuseColor = vec4( diffuse, opacity );
				`
			);

			shader.fragmentShader = shader.fragmentShader.replace(
				'void main() {',
				/* glsl */ `
				uniform float thicknessDistortion;
				uniform float thicknessAmbient;
				uniform float thicknessAttenuation;
				uniform float thicknessPower;
				uniform float thicknessScale;

				void getPointLightInfo(vec3 geometryPosition, vec3 geometryNormal, vec3 geometryViewDir, vec3 geometryClearcoatNormal, out IncidentLight light) {
					vec3 lVector = (viewMatrix * vec4(vLightPosition, 1.0)).xyz - geometryPosition;
					light.direction = normalize(lVector);
					float lightDistance = length(lVector);
					light.color = mix(vColor, vec3(0.5), 0.94);
					light.color *= getDistanceAttenuation(lightDistance, 0.0, 0.0);
					light.visible = (light.color != vec3(0.0));
				}

				void RE_Direct_Scattering(IncidentLight directLight, vec3 geometryPosition, vec3 geometryNormal, vec3 geometryViewDir, vec3 geometryClearcoatNormal, inout ReflectedLight reflectedLight) {
					vec3 thickness = directLight.color * 0.8 * vInstanceVisibility;
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
				ShaderChunk.lights_fragment_begin.replaceAll(
					'RE_Direct( directLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );',
					/* glsl */ `
					// RE_Direct( directLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
					// RE_Direct_Scattering(directLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, reflectedLight);
					`
				)
			);

			shader.fragmentShader = shader.fragmentShader.replace(
				'vec3 totalEmissiveRadiance = emissive;',
				/* glsl */ `
				vec3 totalEmissiveRadiance = vColor * 0.3;
				`
			);

			shader.fragmentShader = shader.fragmentShader.replace(
				'vec3 outgoingLight = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse + reflectedLight.directSpecular + reflectedLight.indirectSpecular + totalEmissiveRadiance;',
				/* glsl */ `
				IncidentLight incidentLight;
				getPointLightInfo(geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, incidentLight);
				RE_Direct_Scattering(incidentLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, reflectedLight);

				vec3 outgoingLight = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse + reflectedLight.directSpecular + reflectedLight.indirectSpecular + totalEmissiveRadiance;
				`
			);
		};

		const mesh = new InstancedMesh(geometry, material, numPointers);
		mesh.instanceMatrix.setUsage(DynamicDrawUsage); // Will be updated every frame
		mesh.layers.enable(layers.buffers);
		this.add(mesh);

		const matrix = new Matrix4();
		const instanceVisibilities = [];

		for (let i = 0; i < mesh.count; i++) {
			matrix.setPosition(0, 0, 0);
			mesh.setMatrixAt(i, matrix);
			mesh.setColorAt(i, color);

			instanceVisibilities.push(0);

			// Not used by the sphere shader itself but for lighting the balls
			const light = new PointLight(lightColor, 1, 4.4, 0);
			light.visible = false;
			this.add(light);

			this.lights.push(light);
		}

		geometry.setAttribute('instanceVisibility', new InstancedBufferAttribute(new Float32Array(instanceVisibilities), 1));

		mesh.geometry.attributes.instanceVisibility.setUsage(DynamicDrawUsage);

		// Occlusion mesh
		const occMesh = mesh.clone();
		occMesh.material = new MeshBasicMaterial();
		occMesh.layers.set(layers.occlusion);
		this.add(occMesh);

		this.geometry = geometry;
		this.mesh = mesh;
		this.occMesh = occMesh;
	}

	// Public methods

	ready = () => this.initMesh();
}
