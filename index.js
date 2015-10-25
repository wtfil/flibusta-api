var app = require('koa')();
var router = require('koa-router')();
var request = require('request');
var unzip = require('unzip');
var ORIGIN = 'http://flibusta.net';
var SITE_URL = process.env.NODE_ENV === 'production' ?
	'http://flibusta-api.herokuapp.com/' :
	'http://127.0.0.1:3000';

router.get('/search', search);
router.get('/download/:id/:format', download);
app.use(router.routes());
app.listen(process.env.PORT || 3000);

function get(url) {
	return cb => request(url, function (err, _, body) {
		cb(err, body);
	});
}
function getUnzip(url, format) {
	return cb => {
		request(url)
			.pipe(unzip.Parse())
			.on('entry', entry => {
				var ext = entry.path.split('.').pop();
				var chunks = [];
				if (entry.type === 'File' && ext === format) {
					cb(null, entry);
				} else {
					entry.autodrain();
				}
			});
	}
}

function* search() {
	var formats = ['mobi', 'fb2', 'epub', 'txt'];
	var page = yield get(`${ORIGIN}/booksearch?ask=${encodeURIComponent(this.query.name)}`);
	var re = /<a href="(\/b\/([^"]+))">([^<]+)<\/a>/g;
	var results = [], match, pages, url, bookId;

	while((match = re.exec(page))) {
		url = ORIGIN + match[1];
		bookId = match[2];
		results.push({
			url, bookId,
			links: formats.map(format => ({
				format,
				url: url + '/' + format,
				downloadUrl: SITE_URL + '/download/' + bookId + '/' + format
			})),
			name: match[3],
		});
	}

	this.body = results;
}

function* download(next) {
	var url = `${ORIGIN}/b/${this.params.id}/${this.params.format}`;
	if (this.params.format === 'mobi') {
		this.body = request(url);
		return;
	}
	var entry = yield getUnzip(url, this.params.format);
	this.set('Content-Disposition', `attachment; filename=${entry.path}`);
	this.set('Content-Type', 'application/octet-stream; charset=utf-8');
	this.body = entry;
}
