/**
 * @author pschroen / https://ufo.ai/
 *
 * Remix of https://glitch.com/edit/#!/multiuser-blocks
 */

import express from 'express';
import enableWs from 'express-ws';

const interval = 4000; // 4 second heartbeat

const app = express();
const expressWs = enableWs(app);
expressWs.getWss('/');

app.use(express.static('public'));

//

import { ObjectPool } from '@alienkitty/space.js/three';

import { numPointers } from './src/config/Config.js';

const mousePool = new ObjectPool();

for (let i = 0; i < numPointers; i++) {
	mousePool.put(i);
}

//

const clients = [];
const room = new Array(255);

function getRemoteAddress(request) {
	return (request.headers['x-forwarded-for'] || request.connection.remoteAddress).split(',')[0].trim();
}

function getRemoteAddresses() {
	return clients.map(ws => ws._remoteAddress);
}

function getUsers() {
	if (!clients.length) {
		return;
	}

	const length = clients.length;
	const byteLength = 1 + 6 + 4 + 2; // mouse + color + remoteAddress + latency
	const data = Buffer.allocUnsafe(1 + byteLength * length); // event + size * users
	data.writeUInt8(0, 0);

	let index = 1;

	for (let i = 0; i < length; i++) {
		const client = clients[i];

		data.writeUInt8(client._mouse === null ? numPointers : client._mouse, index);

		const buf = Buffer.from(client._color, 'utf8');

		for (let j = 0; j < 6; j++) {
			data.writeUInt8(buf[j], index + 1 + j);
		}

		data.writeUInt32BE(ip2long(client._remoteAddress), index + 7);
		data.writeUInt16BE(client._latency, index + 11);

		index += byteLength;
	}

	// console.log('USERS:', data);

	return data;
}

function add(ws, request) {
	clients.push(ws);

	for (let i = 0, l = room.length; i < l; i++) {
		if (room[i] === undefined) {
			const remoteAddresses = getRemoteAddresses();

			let count = 1;
			let remoteAddress = getRemoteAddress(request);

			while (remoteAddresses.includes(remoteAddress)) {
				count++;
				remoteAddress = `${getRemoteAddress(request)} (${count})`;
			}

			ws._id = i;
			ws._idle = Date.now();
			ws._mouse = request.query.observer !== undefined ? null : mousePool.get();
			ws._isMove = false;
			ws._isDown = false;
			ws._color = '';
			ws._remoteAddress = remoteAddress;
			ws._latency;

			room[i] = ws;

			console.log('REMOTE:', ws._remoteAddress, request.headers['user-agent']);

			return;
		}
	}
}

function remove(ws) {
	let index = clients.indexOf(ws);

	if (~index) {
		clients.splice(index, 1);
	}

	index = room.indexOf(ws);

	if (~index) {
		room[index] = undefined;
	}

	if (ws._mouse !== null) {
		// Reset after fade out
		setTimeout(() => {
			resetMouse(ws._mouse);

			mousePool.put(ws._mouse);
		}, interval);
	}
}

function broadcast(ws, data) {
	for (let i = 0, l = clients.length; i < l; i++) {
		const client = clients[i];

		if (client !== ws && client.readyState === client.OPEN) {
			client.send(data);
		}
	}
}

function idle() {
	const idleTime = Date.now() - 1800000; // 30 * 60 * 1000

	for (let i = 0, l = clients.length; i < l; i++) {
		const client = clients[i];

		if (client._idle === 0) {
			client._idle = Date.now();
		} else if (client._idle < idleTime) {
			client.terminate();
			console.log('IDLE:', client._id);
		}
	}
}

function users(ws) {
	broadcast(ws, getUsers());
}

app.ws('/', (ws, request) => {
	add(ws, request);

	console.log('USERS:', clients.length);

	if (timeout === null) {
		startTime = 0;
		timeout = setTimeout(onUpdate, 0);

		console.log('Started physics engine');
	}

	ws.on('close', () => {
		remove(ws);
		users(ws);

		console.log('USERS:', clients.length);

		if (!clients.length) {
			clearTimeout(timeout);
			timeout = null;

			console.log('Stopped physics engine');
		}
	});

	ws.on('message', data => {
		ws._idle = 0;

		switch (data.readUInt8(0)) {
			case 1:
				// console.log('HEARTBEAT:', data);
				ws._latency = Math.min(65535, Date.now() - Number(data.readBigUInt64BE(2))); // Clamp to 65535
				break;
			case 4: {
				if (ws._mouse !== null) {
					// console.log('COLOR:', data);
					ws._color = Buffer.from(data.subarray(2), 'utf-8').toString();
					users(ws);
				}
				break;
			}
			case 5: {
				if (ws._mouse !== null) {
					const mouse = `mouse_${ws._mouse}`;
					const position = [data.readFloatBE(3), data.readFloatBE(7), data.readFloatBE(11)];
					// console.log('MOTION:', data, data.readUInt8(2), position);

					physics.setPosition(mouse, position);

					// First input
					if (!ws._isMove) {
						physics.wakeUp(mouse);

						const sphere = `sphere_${ws._mouse}`;
						physics.setPosition(sphere, position);
						physics.wakeUp(sphere);

						ws._isMove = true;
					}

					ws._isDown = !!data.readUInt8(2);
				}
				break;
			}
		}

		// console.log('MESSAGE:', data);
	});

	const heartbeat = () => {
		if (ws.readyState === ws.OPEN) {
			const data = Buffer.allocUnsafe(10);
			data.writeUInt8(1, 0);
			data.writeUInt8(ws._mouse === null ? numPointers : ws._mouse, 1);
			data.writeBigUInt64BE(BigInt(Date.now()), 2);

			ws.send(data);

			setTimeout(heartbeat, interval);
		}
	};

	heartbeat();
	users();
});

setInterval(() => {
	idle();
	users();
}, interval);

//

const listener = app.listen(process.env.PORT, () => {
	console.log(`Listening on port ${listener.address().port}`);
});

// https://stackoverflow.com/questions/1908492/unsigned-integer-in-javascript/7414641#7414641
function ip2long(ip) {
	let ipl = 0;
	ip.split('.').forEach(octet => {
		ipl <<= 8;
		ipl += parseInt(octet, 10);
	});
	return ipl >>> 0;
}

//

import { Group, MathUtils, Vector3 } from 'three';
import { headsTails } from '@alienkitty/space.js/three';
import { OimoPhysicsBuffer } from '@alienkitty/alien.js/three/oimophysics';

const center = new Vector3(0, 0, 0);
const object = new Group();

const physics = new OimoPhysicsBuffer({
	gravity: center
});

for (let i = 0; i < 100; i++) {
	object.position.x = MathUtils.randFloat(10, 100) * (headsTails() ? -1 : 1);
	object.position.y = MathUtils.randFloat(10, 100) * (headsTails() ? -1 : 1);
	object.position.z = MathUtils.randFloat(10, 100) * (headsTails() ? -1 : 1);

	object.rotation.x = MathUtils.degToRad(MathUtils.randInt(0, 360));
	object.rotation.y = MathUtils.degToRad(MathUtils.randInt(0, 360));
	object.rotation.z = MathUtils.degToRad(MathUtils.randInt(0, 360));

	object.updateMatrix();

	physics.add({
		name: `balls_${i}`,
		type: 'sphere',
		position: object.position.toArray(),
		quaternion: object.quaternion.toArray(),
		size: [1],
		density: 1,
		autoSleep: false
	});
}

for (let i = 0; i < numPointers; i++) {
	physics.add({
		name: `sphere_${i}`,
		type: 'sphere',
		size: [1],
		density: 1
	});
}

for (let i = 0; i < numPointers; i++) {
	physics.add({
		name: `mouse_${i}`,
		kinematic: true
	});
}

for (let i = 0; i < numPointers; i++) {
	physics.add({
		name: `mouseJoint_${i}`,
		type: 'joint',
		mode: 'spherical',
		body1: `sphere_${i}`,
		body2: `mouse_${i}`,
		springDamper: [15, 1]
	});
}

for (let i = 0; i < numPointers; i++) {
	resetMouse(i);
}

function resetMouse(index) {
	const mouse = `mouse_${index}`;
	const sphere = `sphere_${index}`;
	const position = [0, 0, 101 + index]; // Initial position behind the camera

	physics.setPosition(mouse, position);
	physics.sleep(mouse);

	physics.setPosition(sphere, position);
	physics.sleep(sphere);
}

//

class Ball {
	constructor(name) {
		this.force = new Vector3();
		this.forceDamping = 0.007;
		this.forceThreshold = 0.3;
		this.contact = false;

		physics.setContactCallback(name, this.onContact);
	}

	// Event handlers

	onContact = (body, name) => {
		if (this.contact) {
			return;
		}

		const linearVelocity = body.getLinearVelocity();
		const mass = body.getMass();

		this.force.addScaledVector(linearVelocity, mass);
		this.force.multiplyScalar(this.forceDamping);

		const force = this.force.length();

		if (force > this.forceThreshold) {
			this.contact = true;

			const data = Buffer.allocUnsafe(6);
			data.writeUInt8(3, 0);
			data.writeUInt8(parseInt(name.match(/\d+$/)[0], 10), 1);
			data.writeFloatBE(force, 2);

			// console.log('CONTACT:', name, data);
			broadcast(null, data);

			setTimeout(() => {
				this.contact = false;
			}, 250);
		} else {
			this.force.multiplyScalar(0);
		}
	};
}

for (let i = 0; i < 100; i++) {
	new Ball(`balls_${i}`);
}

//

import { performance } from 'node:perf_hooks';

const force = new Vector3();

const resetOrientation = [0, 0, 0, 1];
const resetVelocity = [0, 0, 0];

const timestep = 1000 / 61;
const byteLength = 8 * 4; // 8 * float32 for buffer size
const startIndex = 1 + byteLength * 100; // event + size * balls

let startTime = 0;
let timeout = null;

function onUpdate() {
	startTime = performance.now();

	// Zero-G impulse applied to the balls towards the centre of the scene
	for (let i = 0; i < 100; i++) {
		const body = physics.bodies[i];

		object.position.copy(body.getPosition());
		object.quaternion.copy(body.getOrientation());
		object.updateMatrix();

		force.copy(object.position).negate().normalize().multiplyScalar(0.1);
		body.applyImpulse(force, center);
	}

	physics.step();

	const data = Buffer.allocUnsafe(1 + physics.array.buffer.byteLength); // event + size
	data.writeUInt8(2, 0);

	Buffer.from(physics.array.buffer).copy(data, 1);

	// Overwrite sleeping index with isMove and isDown state
	let index;

	for (let i = 0, l = clients.length; i < l; i++) {
		const client = clients[i];

		if (client._mouse !== null) {
			index = startIndex + byteLength * client._mouse;

			data.writeFloatLE(
				client._isMove ? client._isDown ? 2 : 1 : 0,
				index + 28 // 7 * float32 for sleeping index
			);

			// Reset sphere orientation and velocities
			const sphere = `sphere_${client._mouse}`;
			physics.setOrientation(sphere, resetOrientation);
			physics.setLinearVelocity(sphere, resetVelocity);
			physics.setAngularVelocity(sphere, resetVelocity);
		}
	}

	// console.log('BUFFER:', data);
	broadcast(null, data);

	if (timeout !== null) {
		timeout = setTimeout(onUpdate, Math.max(0, timestep - (performance.now() - startTime)));
	}
}
