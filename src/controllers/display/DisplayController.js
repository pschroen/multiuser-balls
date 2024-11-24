export class DisplayController {
	static init(camera, view) {
		this.camera = camera;
		this.view = view;
	}

	// Public methods

	static resize = (width, height, dpr) => {
		this.camera.left = -width / 2;
		this.camera.right = width / 2;
		this.camera.top = height / 2;
		this.camera.bottom = -height / 2;
		this.camera.updateProjectionMatrix();
		this.camera.position.x = width / 2;
		this.camera.position.y = -height / 2;

		this.view.resize(width, height, dpr);
	};

	static update = () => {
		if (!this.view.visible) {
			return;
		}

		this.view.update();
	};

	static animateIn = () => {
		this.view.animateIn();
	};

	static toggle = show => {
		this.view.toggle(show);
	};

	static ready = () => this.view.ready();
}
