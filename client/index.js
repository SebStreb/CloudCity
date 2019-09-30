const express = require('express');

const path = require('path');
const cors = require('cors');

const app = express();
app.use(express.static('scripts'));
app.use(cors());

app.get('/', (req, res) => {
	res.sendFile(path.join(__dirname + '/views/index.html'));
});

app.get('/client', (req, res) => {
	res.sendFile(path.join(__dirname + '/views/client.html'));
});

app.get('/server', (req, res) => {
	res.sendFile(path.join(__dirname + '/views/server.html'));
});

app.listen(8080);
