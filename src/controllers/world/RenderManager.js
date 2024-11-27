import { AdditiveBlending, Color, MathUtils, Mesh, MeshBasicMaterial, OrthographicCamera, Vector2, Vector3, WebGLRenderTarget } from 'three';
import { getDoubleRenderTarget, tween } from '@alienkitty/space.js/three';
import { BloomCompositeMaterial, BlurMaterial, CopyMaterial, DatamoshMaterial, DrawBuffers, FXAAMaterial, LuminosityMaterial, MotionBlurCompositeMaterial, SMAABlendMaterial, SMAAEdgesMaterial, SMAAWeightsMaterial, UnrealBloomBlurMaterial, VolumetricLightLensflareMaterial } from '@alienkitty/alien.js/three';

import { WorldController } from './WorldController.js';
import { CompositeMaterial } from '../../materials/CompositeMaterial.js';
import { DirtMaterial } from '../../materials/DirtMaterial.js';

import { isHighQuality, layers, numPointers } from '../../config/Config.js';

const BlurDirectionX = new Vector2(1, 0);
const BlurDirectionY = new Vector2(0, 1);

export class RenderManager {
	static init(renderer, scene, camera, view, displayScene, displayCamera) {
		this.renderer = renderer;
		this.scene = scene;
		this.camera = camera;
		this.view = view;
		this.displayScene = displayScene;
		this.displayCamera = displayCamera;

		// Volumetric light and lens flare
		this.lightPosition = new Vector3();
		this.vlExposure = 0.1;
		this.vlDecay = 1;
		this.vlDensity = 1;
		this.vlWeight = 0.4;
		this.vlClamp = 1;
		this.lensflareScale = new Vector2(2.5, 2.5);
		this.lensflareExposure = 0.02;
		this.lensflareClamp = 1;
		this.blurResolutionScale = 0.25;
		this.blurAmount = 2.5;

		// Datamosh
		this.datamoshAmount = 0;
		this.datamoshLossy = 1;
		this.datamoshDamping = 0.96;
		this.firstMosh = true;

		// Bloom
		this.luminosityThreshold = 0.1;
		this.luminositySmoothing = 1;
		this.bloomStrength = 0.3;
		this.bloomRadius = 0.2;
		this.bloomDistortion = 1;

		// Final
		this.distortion = 0.2;
		this.grainAmount = 0.03;
		this.boost = 1.1;
		this.reduction = 0.9;

		this.initRenderer();
	}

	static initRenderer() {
		const { screenTriangle, resolution, texelSize, time, frame, textureLoader } = WorldController;

		// Manually clear
		this.renderer.autoClear = false;

		// Clear colors
		this.clearColor = new Color(0, 0, 0);
		this.currentClearColor = new Color();
		this.renderer.setClearColor(this.clearColor, 0);

		// Fullscreen triangle
		this.screenCamera = new OrthographicCamera(-1, 1, 1, -1, 0, 1);
		this.screen = new Mesh(screenTriangle);
		this.screen.frustumCulled = false;

		// Render targets
		this.renderTargetA = new WebGLRenderTarget(1, 1, {
			depthBuffer: false
		});

		if (isHighQuality) {
			this.renderTargetB = this.renderTargetA.clone();

			this.renderTargetBlurA = this.renderTargetA.clone();
			this.renderTargetBlurB = this.renderTargetA.clone();
			this.renderTargetBlurC = this.renderTargetA.clone();

			this.renderTargetsHorizontal = [];
			this.renderTargetsVertical = [];
			this.nMips = 5;

			this.renderTargetBright = this.renderTargetA.clone();
			this.renderTargetEdges = this.renderTargetA.clone();
			this.renderTargetWeights = this.renderTargetA.clone();

			for (let i = 0, l = this.nMips; i < l; i++) {
				this.renderTargetsHorizontal.push(this.renderTargetA.clone());
				this.renderTargetsVertical.push(this.renderTargetA.clone());
			}

			this.renderTargetA.depthBuffer = true;
			this.renderTargetBlurA.depthBuffer = true;

			this.datamosh = getDoubleRenderTarget(1, 1, {
				depthBuffer: false
			});

			// G-Buffer
			this.drawBuffers = new DrawBuffers(this.renderer, this.scene, this.camera, layers.buffers, {
				cameraBlur: false
			});

			// Motion blur composite material
			this.motionBlurCompositeMaterial = new MotionBlurCompositeMaterial(textureLoader);
			this.motionBlurCompositeMaterial.uniforms.tVelocity.value = this.drawBuffers.renderTarget.textures[1];

			// Occlusion material
			this.blackoutMaterial = new MeshBasicMaterial({ color: 0x000000 });

			// Gaussian blur materials
			this.hBlurMaterial = new BlurMaterial(BlurDirectionX);
			this.hBlurMaterial.uniforms.uBlurAmount.value = this.blurAmount;

			this.vBlurMaterial = new BlurMaterial(BlurDirectionY);
			this.vBlurMaterial.uniforms.uBlurAmount.value = this.blurAmount;

			// Volumetric light material
			this.vlMaterial = new VolumetricLightLensflareMaterial();
			this.vlMaterial.uniforms.uExposure.value = this.vlExposure;
			this.vlMaterial.uniforms.uDecay.value = this.vlDecay;
			this.vlMaterial.uniforms.uDensity.value = this.vlDensity;
			this.vlMaterial.uniforms.uWeight.value = this.vlWeight;
			this.vlMaterial.uniforms.uClamp.value = this.vlClamp;
			this.vlMaterial.uniforms.uLensflareScale.value = this.lensflareScale;
			this.vlMaterial.uniforms.uLensflareExposure.value = this.lensflareExposure;
			this.vlMaterial.uniforms.uLensflareClamp.value = this.lensflareClamp;
			this.vlMaterial.uniforms.uResolution = resolution;

			// Copy material
			this.copyMaterial = new CopyMaterial();
			this.copyMaterial.blending = AdditiveBlending;

			// Datamosh material
			this.datamoshMaterial = new DatamoshMaterial();
			this.datamoshMaterial.uniforms.tVelocity.value = this.drawBuffers.renderTarget.textures[1];
			this.datamoshMaterial.uniforms.uAmount.value = this.datamoshAmount;
			this.datamoshMaterial.uniforms.uLossy.value = this.datamoshLossy;
			this.datamoshMaterial.uniforms.uDamping.value = this.datamoshDamping;
			this.datamoshMaterial.uniforms.uResolution = resolution;
			this.datamoshMaterial.uniforms.uTime = time;
			this.datamoshMaterial.uniforms.uFrame = frame;

			// Luminosity high pass material
			this.luminosityMaterial = new LuminosityMaterial();
			this.luminosityMaterial.uniforms.uThreshold.value = this.luminosityThreshold;
			this.luminosityMaterial.uniforms.uSmoothing.value = this.luminositySmoothing;

			// Separable Gaussian blur materials
			this.blurMaterials = [];

			const kernelSizeArray = [3, 5, 7, 9, 11];

			for (let i = 0, l = this.nMips; i < l; i++) {
				this.blurMaterials.push(new UnrealBloomBlurMaterial(kernelSizeArray[i]));
			}

			// Bloom composite material
			this.bloomCompositeMaterial = new BloomCompositeMaterial();
			this.bloomCompositeMaterial.uniforms.tBlur1.value = this.renderTargetsVertical[0].texture;
			this.bloomCompositeMaterial.uniforms.tBlur2.value = this.renderTargetsVertical[1].texture;
			this.bloomCompositeMaterial.uniforms.tBlur3.value = this.renderTargetsVertical[2].texture;
			this.bloomCompositeMaterial.uniforms.tBlur4.value = this.renderTargetsVertical[3].texture;
			this.bloomCompositeMaterial.uniforms.tBlur5.value = this.renderTargetsVertical[4].texture;
			this.bloomCompositeMaterial.uniforms.uBloomFactors.value = this.bloomFactors();

			// Composite material
			this.compositeMaterial = new CompositeMaterial();
			this.compositeMaterial.uniforms.uRGBAmount.value = this.distortion;
			this.compositeMaterial.uniforms.uGrainAmount.value = this.grainAmount;
			this.compositeMaterial.uniforms.uBoost.value = this.boost;
			this.compositeMaterial.uniforms.uReduction.value = this.reduction;

			// SMAA edge detection material
			this.edgesMaterial = new SMAAEdgesMaterial();
			this.edgesMaterial.uniforms.uTexelSize = texelSize;

			// SMAA weights material
			this.weightsMaterial = new SMAAWeightsMaterial(textureLoader);
			this.weightsMaterial.uniforms.uTexelSize = texelSize;

			// SMAA material
			this.smaaMaterial = new SMAABlendMaterial();
			this.smaaMaterial.uniforms.tWeightMap.value = this.renderTargetWeights.texture;
			this.smaaMaterial.uniforms.uTexelSize = texelSize;

			// Dirt material
			this.dirtMaterial = new DirtMaterial();
			this.dirtMaterial.uniforms.uBloomDistortion.value = this.bloomDistortion;
		} else {
			this.renderTargetA.depthBuffer = true;

			// FXAA material
			this.fxaaMaterial = new FXAAMaterial();
			this.fxaaMaterial.uniforms.uResolution = resolution;
		}
	}

	static bloomFactors() {
		const bloomFactors = [1, 0.8, 0.6, 0.4, 0.2];

		for (let i = 0, l = this.nMips; i < l; i++) {
			const factor = bloomFactors[i];
			bloomFactors[i] = this.bloomStrength * MathUtils.lerp(factor, 1.2 - factor, this.bloomRadius);
		}

		return bloomFactors;
	}

	static setLightPosition(position) {
		this.lightPosition.copy(position).project(this.camera);

		const x = (this.lightPosition.x + 1) / 2;
		const y = (this.lightPosition.y + 1) / 2;

		this.vlMaterial.uniforms.uLightPosition.value.set(x, y);
	}

	static rendererState() {
		this.currentOverrideMaterial = this.scene.overrideMaterial;
		this.currentBackground = this.scene.background;
		this.renderer.getClearColor(this.currentClearColor);
		this.currentClearAlpha = this.renderer.getClearAlpha();
	}

	static restoreRendererState() {
		this.scene.overrideMaterial = this.currentOverrideMaterial;
		this.scene.background = this.currentBackground;
		this.renderer.setClearColor(this.currentClearColor, this.currentClearAlpha);
	}

	// Public methods

	static resize = (width, height, dpr) => {
		this.renderer.setPixelRatio(dpr);
		this.renderer.setSize(width, height);

		width = Math.round(width * dpr);
		height = Math.round(height * dpr);

		this.renderTargetA.setSize(width, height);

		if (isHighQuality) {
			this.renderTargetB.setSize(width, height);

			this.datamosh.setSize(width, height);

			this.drawBuffers.setSize(width, height);

			// Gaussian blur
			const blurWidth = Math.round(width * this.blurResolutionScale);
			const blurHeight = Math.round(height * this.blurResolutionScale);

			this.renderTargetBlurA.setSize(blurWidth, blurHeight);
			this.renderTargetBlurB.setSize(blurWidth, blurHeight);
			this.renderTargetBlurC.setSize(blurWidth, blurHeight);

			this.hBlurMaterial.uniforms.uResolution.value.set(blurWidth, blurHeight);
			this.vBlurMaterial.uniforms.uResolution.value.set(blurWidth, blurHeight);

			// Unreal bloom
			width = MathUtils.floorPowerOfTwo(width) / 2;
			height = MathUtils.floorPowerOfTwo(height) / 2;

			this.renderTargetBright.setSize(width, height);
			this.renderTargetEdges.setSize(width, height);
			this.renderTargetWeights.setSize(width, height);

			for (let i = 0, l = this.nMips; i < l; i++) {
				this.renderTargetsHorizontal[i].setSize(width, height);
				this.renderTargetsVertical[i].setSize(width, height);

				this.blurMaterials[i].uniforms.uResolution.value.set(width, height);

				width /= 2;
				height /= 2;
			}
		}
	};

	static update = () => {
		const renderer = this.renderer;
		const scene = this.scene;
		const camera = this.camera;
		const view = this.view;

		const renderTargetA = this.renderTargetA;

		if (isHighQuality) {
			const renderTargetB = this.renderTargetB;
			const renderTargetBlurA = this.renderTargetBlurA;
			const renderTargetBlurB = this.renderTargetBlurB;
			const renderTargetBlurC = this.renderTargetBlurC;
			const renderTargetBright = this.renderTargetBright;
			const renderTargetEdges = this.renderTargetEdges;
			const renderTargetWeights = this.renderTargetWeights;
			const renderTargetsHorizontal = this.renderTargetsHorizontal;
			const renderTargetsVertical = this.renderTargetsVertical;

			// Renderer state
			this.rendererState();

			// G-Buffer layer
			camera.layers.set(layers.buffers);

			this.drawBuffers.update();

			// Scene layer
			camera.layers.set(layers.default);

			renderer.setRenderTarget(renderTargetA);
			renderer.clear();
			renderer.render(scene, camera);

			// Occlusion layers
			scene.background = null;

			// Composite all the layers
			renderer.setRenderTarget(renderTargetBlurC);
			renderer.clear();

			for (let i = 0; i < numPointers; i++) {
				if (view.ball.lights[i].visible) {
					camera.layers.set(layers.default);

					scene.overrideMaterial = this.blackoutMaterial;
					renderer.setRenderTarget(renderTargetBlurA);
					renderer.clear();
					renderer.render(scene, camera);
					scene.overrideMaterial = this.currentOverrideMaterial;

					camera.layers.set(layers.occlusion);

					// Light blackout
					for (let j = 0; j < numPointers; j++) {
						if (view.ball.lights[j].visible && j !== i) {
							view.ball.occMesh.setColorAt(j, this.clearColor);
						}
					}

					view.ball.occMesh.instanceColor.needsUpdate = true;

					renderer.render(scene, camera);

					this.hBlurMaterial.uniforms.tMap.value = renderTargetBlurA.texture;
					this.screen.material = this.hBlurMaterial;
					renderer.setRenderTarget(renderTargetBlurB);
					renderer.clear();
					renderer.render(this.screen, this.screenCamera);

					this.vBlurMaterial.uniforms.tMap.value = renderTargetBlurB.texture;
					this.screen.material = this.vBlurMaterial;
					renderer.setRenderTarget(renderTargetBlurA);
					renderer.clear();
					renderer.render(this.screen, this.screenCamera);

					this.vlMaterial.uniforms.tMap.value = renderTargetBlurA.texture;
					this.vlMaterial.uniforms.uExposure.value = this.vlExposure * this.view.ball.lights[i].intensity;
					this.setLightPosition(this.view.ball.lights[i].position);
					this.screen.material = this.vlMaterial;
					renderer.setRenderTarget(renderTargetBlurB);
					renderer.clear();
					renderer.render(this.screen, this.screenCamera);

					// Composite all the layers
					this.copyMaterial.uniforms.tMap.value = renderTargetBlurB.texture;
					this.screen.material = this.copyMaterial;
					renderer.setRenderTarget(renderTargetBlurC);
					renderer.render(this.screen, this.screenCamera);

					// Restore light settings
					for (let j = 0; j < numPointers; j++) {
						if (view.ball.lights[j].visible && j !== i) {
							view.ball.occMesh.setColorAt(j, this.view.ball.lights[j].color);
						}
					}

					view.ball.occMesh.instanceColor.needsUpdate = true;
				}
			}

			// Post-processing
			camera.layers.set(layers.default);

			scene.background = null;
			renderer.setClearColor(this.clearColor, 1);

			// Motion blur pass
			this.motionBlurCompositeMaterial.uniforms.tMap.value = renderTargetA.texture;
			this.screen.material = this.motionBlurCompositeMaterial;
			renderer.setRenderTarget(renderTargetB);
			renderer.clear();
			renderer.render(this.screen, this.screenCamera);

			// Datamosh pass
			if (this.datamoshAmount) {
				if (this.firstMosh) {
					this.firstMosh = false;
					this.datamoshMaterial.uniforms.tOld.value = renderTargetB.texture;
				} else {
					this.datamoshMaterial.uniforms.tOld.value = this.datamosh.read.texture;
				}

				this.datamoshMaterial.uniforms.tNew.value = renderTargetB.texture;
				this.datamoshMaterial.uniforms.uAmount.value = this.datamoshAmount;
				this.screen.material = this.datamoshMaterial;
				renderer.setRenderTarget(this.datamosh.write);
				renderer.clear();
				renderer.render(this.screen, this.screenCamera);
				this.datamosh.swap();
			}

			// Extract bright areas
			this.luminosityMaterial.uniforms.tMap.value = this.datamoshAmount ? this.datamosh.read.texture : renderTargetB.texture;
			this.screen.material = this.luminosityMaterial;
			renderer.setRenderTarget(renderTargetBright);
			renderer.clear();
			renderer.render(this.screen, this.screenCamera);

			// Blur all the mips progressively
			let inputRenderTarget = renderTargetBright;

			for (let i = 0, l = this.nMips; i < l; i++) {
				this.screen.material = this.blurMaterials[i];

				this.blurMaterials[i].uniforms.tMap.value = inputRenderTarget.texture;
				this.blurMaterials[i].uniforms.uDirection.value = BlurDirectionX;
				renderer.setRenderTarget(renderTargetsHorizontal[i]);
				renderer.clear();
				renderer.render(this.screen, this.screenCamera);

				this.blurMaterials[i].uniforms.tMap.value = this.renderTargetsHorizontal[i].texture;
				this.blurMaterials[i].uniforms.uDirection.value = BlurDirectionY;
				renderer.setRenderTarget(renderTargetsVertical[i]);
				renderer.clear();
				renderer.render(this.screen, this.screenCamera);

				inputRenderTarget = renderTargetsVertical[i];
			}

			// Composite all the mips
			this.screen.material = this.bloomCompositeMaterial;
			renderer.setRenderTarget(renderTargetsHorizontal[0]);
			renderer.clear();
			renderer.render(this.screen, this.screenCamera);

			// Composite pass
			this.compositeMaterial.uniforms.tScene.value = this.datamoshAmount ? this.datamosh.read.texture : renderTargetB.texture;
			this.screen.material = this.compositeMaterial;
			renderer.setRenderTarget(renderTargetA);
			renderer.clear();
			renderer.render(this.screen, this.screenCamera);

			// HUD scene
			renderer.render(this.displayScene, this.displayCamera);

			// SMAA edge detection pass
			this.edgesMaterial.uniforms.tMap.value = renderTargetA.texture;
			this.screen.material = this.edgesMaterial;
			renderer.setRenderTarget(renderTargetEdges);
			renderer.clear();
			renderer.render(this.screen, this.screenCamera);

			// SMAA weights pass
			this.weightsMaterial.uniforms.tMap.value = renderTargetEdges.texture;
			this.screen.material = this.weightsMaterial;
			renderer.setRenderTarget(renderTargetWeights);
			renderer.clear();
			renderer.render(this.screen, this.screenCamera);

			// SMAA pass (render to screen)
			this.smaaMaterial.uniforms.tMap.value = renderTargetA.texture;
			this.screen.material = this.smaaMaterial;
			renderer.setRenderTarget(null);
			renderer.clear();
			renderer.render(this.screen, this.screenCamera);

			// Dirt pass (render to screen)
			this.dirtMaterial.uniforms.tBloom.value = renderTargetsHorizontal[0].texture;
			this.dirtMaterial.uniforms.tAdd.value = renderTargetBlurC.texture;
			this.screen.material = this.dirtMaterial;
			renderer.render(this.screen, this.screenCamera);

			// Restore renderer settings
			this.restoreRendererState();
		} else {
			// Scene pass
			renderer.setRenderTarget(renderTargetA);
			renderer.clear();
			renderer.render(scene, camera);

			// HUD scene
			renderer.render(this.displayScene, this.displayCamera);

			// FXAA pass (render to screen)
			this.fxaaMaterial.uniforms.tMap.value = renderTargetA.texture;
			this.screen.material = this.fxaaMaterial;
			renderer.setRenderTarget(null);
			renderer.clear();
			renderer.render(this.screen, this.screenCamera);
		}
	};

	static start = () => {
		if (!isHighQuality) {
			return;
		}

		this.compositeMaterial.uniforms.uRGBAmount.value = 0;
		this.compositeMaterial.uniforms.uGrainAmount.value = 0;
		this.compositeMaterial.uniforms.uBoost.value = 1;
		this.compositeMaterial.uniforms.uReduction.value = 0;
	};

	static animateIn = () => {
		if (!isHighQuality) {
			return;
		}

		tween(this.compositeMaterial.uniforms.uRGBAmount, { value: this.distortion }, 1000, 'easeOutQuart');
		tween(this.compositeMaterial.uniforms.uGrainAmount, { value: this.grainAmount }, 1000, 'easeOutQuart');
		tween(this.compositeMaterial.uniforms.uBoost, { value: this.boost }, 1000, 'easeOutQuart');
		tween(this.compositeMaterial.uniforms.uReduction, { value: this.reduction }, 1000, 'easeOutQuart');
	};
}
