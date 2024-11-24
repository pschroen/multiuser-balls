import { numPointers, store } from '../config/Config.js';

export class Data {
	// Public methods

	static getUser = id => {
		return store.users.find(item => item.id === id);
	};

	static getUserData = id => {
		const data = this.getUser(id);

		if (!data) {
			return;
		}

		return {
			id: data.id,
			color: data.color || (Number(data.id) === numPointers ? 'Observer' : store.placeholder),
			// remoteAddress: data.remoteAddress,
			latency: data.latency
		};
	};

	static getReticleData = id => {
		const data = this.getUser(id);

		if (!data) {
			return;
		}

		return {
			// primary: data.color || data.remoteAddress,
			primary: data.color || data.id,
			secondary: `${data.latency}ms`
		};
	};
}
