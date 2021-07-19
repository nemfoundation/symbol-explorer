const fs = require('fs');
const http = require('http');

const PORT = 4000;
const CONFIG_ROUTE = '/config';
const DEFAULT_CONFIG_PATH = '/src/config/default.json';
const STATIC_FOLDER = '/www';
const INDEX_HTML = '/index.html';
const STATIC_CACHE_AGE = 31536000;
const INDEX_CACHE_AGE = 172800;

let ENV;


const readConfig = (callback) => {
	const ENV = process.env;

	fs.readFile(__dirname + DEFAULT_CONFIG_PATH, (err, data) => {
		if (err) throw Error('Failed to read default config. ' + err);
		else {
			const defaultConfig = JSON.parse(data);
			const parsedENV = {};
			Object.keys(ENV).forEach(key => {
				try {
					if (defaultConfig[key]) {
						parsedENV[key] = JSON.parse(ENV[key]);
					}
				}
				catch(e) {
					parsedENV[key] = ENV[key];
				}
			});
			const mergedConfig = {
				...defaultConfig,
				...parsedENV
			};

			callback(mergedConfig);
		}
	});
};

const getFile = (url, errCallback, callback) => {
	fs.readFile(__dirname + STATIC_FOLDER + url, (err, data) => {
		if (err) {
			if(typeof errCallback === 'function')
				errCallback(err);
		}
		else
			if(typeof callback === 'function')
				callback(data);
	});
};

const send = (res, data, age) => {
	res.setHeader('Cache-Control', 'public, max-age=' + age);
	res.writeHead(200);
	res.end(data);
};

const sendJSON = (res, data) => {
	res.setHeader('Content-Type', 'application/json');
	send(res, JSON.stringify(data), INDEX_CACHE_AGE);
}

const sendError = (res, err, code) => {
	res.writeHead(code);
	res.end(JSON.stringify(err));
	return;
};

readConfig(res => {
	ENV = res;

	http.createServer((req, res) => {
		let cacheAge = 0;

		if(req.url === '/') {
			cacheAge = INDEX_CACHE_AGE;
			req.url = INDEX_HTML;
		}
		else {
			cacheAge = STATIC_CACHE_AGE;
		}

		if(req.url === CONFIG_ROUTE) {
			sendJSON(res, ENV);
		}
		else {
			getFile(req.url,
				() => {
					getFile(INDEX_HTML,
						err => sendError(res, err, 404),
						data => send(res, data, cacheAge)
					);
				},
				data => send(res, data, cacheAge)
			);
		}
	}).listen(ENV.PORT || PORT);

	console.log('Server is running on port: ' + PORT);
});
