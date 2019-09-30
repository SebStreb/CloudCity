const express = require('express');
const cors = require('cors');

const app = express();
app.use(express.json());
app.use(express.static('containers'));
app.use(cors());

const machines = {};
const containers = {};
const timers = {};

const TIMEOUT = 2000;
const DEAD = 'dead';
const ALIVE = 'alive';
const BAD = 'Bad request';

const removeMachine = (machine) => {
	console.log('killing ' + machine);
	machines[machine].status = DEAD;
	machines[machine].resources = undefined;

	machines[machine].containers.forEach((container) => {
		findMachine(container);
		containers[container] = containers[container].filter((elem) => machine != elem);
	});

	machines[machine].containers = [];
	delete timers[machine];
};

const findMachine = (container) => {
	for (const machine in machines) {
		if (machines[machine].status === ALIVE && !machines[machine].containers.includes(container)) {
			containers[container].push(machine);
			machines[machine].containers.push(container);
			return true;
		}
	}
	return false;
};


/* API
	Register a machine or container
	POST /register { machine } OR /register { container }
*/
app.post('/register', (req, res) => {
	if (req.body.hasOwnProperty('machine')) {
		const machine = req.body.machine;

		if (machines.hasOwnProperty(machine)) {
			res.status(403).send('Machine already exists');
			return;
		}

		machines[machine] = {
			status: DEAD,
			resources: undefined,
			containers: [],
		};

		res.status(200).send();
	} else if (req.body.hasOwnProperty('container')) {
		const container = req.body.container;

		if (containers.hasOwnProperty(container)) {
			res.status(403).send('Container already exists');
			return;
		}

		containers[container] = [];

		res.status(200).send();
	} else {
		res.status(400).send(BAD);
		return;
	}
});


/* API
	Report status of a machine
	POST /beat { machine, resources: {cores, memory} }
*/
app.post('/beat', (req, res) => {
	if (!req.body.hasOwnProperty('machine') || !req.body.hasOwnProperty('resources')) {
		res.status(400).send(BAD);
		return;
	}

	const machine = req.body.machine;
	const resources = req.body.resources;

	if (!machines.hasOwnProperty(machine)) {
		res.status(404).send('No such machine');
		return;
	}

	machines[machine].status = 'alive';
	machines[machine].resources = resources;

	if (timers.hasOwnProperty(machine)) {
		clearTimeout(timers[machine]);
	}
	timers[machine] = setTimeout(removeMachine, TIMEOUT, machine);

	res.status(200).send();
});


/* API
	Launch a container
	POST /launch { container }
*/
app.post('/launch', (req, res) => {
	if (!req.body.hasOwnProperty('container')) {
		res.status(400).send(BAD);
		return;
	}

	const container = req.body.container;

	if (!containers.hasOwnProperty(container)) {
		res.status(404).send('No such container');
		return;
	}

	const found = findMachine(container);

	if (!found) {
		res.status(500).send('No machine available');
	} else {
		res.status(200).send();
	}
});


/* API
	Stop a machine or container
	POST /stop { machine } OR /stop { container }
*/
app.post('/stop', (req, res) => {
	if (req.body.hasOwnProperty('machine')) {
		const machine = req.body.machine;

		if (!machines.hasOwnProperty(machine)) {
			res.status(404).send('No such machine');
			return;
		}

		if (machines[machine].status === DEAD) {
			res.status(403).send('Machine is already dead');
			return;
		}

		removeMachine(machine);

		res.status(200).send();
	} else if (req.body.hasOwnProperty('container')) {
		const container = req.body.container;

		if (!containers.hasOwnProperty(container)) {
			res.status(404).send('No such container');
			return;
		}

		containers[container].forEach((machine) => {
			machines[machine].containers = machines[machine].containers.filter((elem) => container != elem);
		});

		containers[container] = [];

		res.status(200).send();
	} else {
		res.status(400).send(BAD);
		return;
	}
});


/* API
	Get informations about a machine
	GET /machine/:machine
	return 200 { status, resources: {cores, memory}, containers: [containers] }
*/
app.get('/machine/:machine', (req, res) => {
	const machine = req.params.machine;

	if (!machines.hasOwnProperty(machine)) {
		res.status(404).send('No such machine');
		return;
	}

	res.status(200).json(machines[machine]);
});


/* API
	Get machines on which container is running
	GET /container/:container
	return 200 { [machines] }
*/
app.get('/container/:container', (req, res) => {
	const container = req.params.container;

	if (!containers.hasOwnProperty(container)) {
		res.status(404).send('No such container');
		return;
	}

	res.status(200).json(containers[container]);
});


/* API
	Get list of registered containers
	GET /containers
	return 200 { [containers] }
*/
app.get('/containers', (req, res) => {
	res.status(200).json(Object.keys(containers));
});


/* API
	Get list of running machines
	GET /machines
	return 200 { [machines] }
*/
app.get('/machines', (req, res) => {
	const running = [];
	for (const machine in machines) {
		if (machines[machine].status === ALIVE) {
			running.push(machine);
		}
	}
	res.status(200).json(running);
});


app.listen(3000);
