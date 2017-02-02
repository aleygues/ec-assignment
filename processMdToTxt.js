/*
**
** OpenWhisk function
** 
** This function is notified by a "push" event 
** comming from GitHub
** The function get changes (files added or modified)
** and process them in order to get .txt files
** The new files are uploaded to Bluemix Object Storage
** 
*/

// --------------- CONFIG --------------------
// CONFIG CLIENT OBJECT STORAGE
var BLUEMIX_OBJECTSTORAGE_CREDENTIALS = {
  "auth_url": "https://identity.open.softlayer.com",
  "project": "object_storage_dac5eed7_cc16_4b6a_94ba_d235f4af46d2",
  "projectId": "701dc03c8ac543079de1fadc691f5d74",
  "region": "dallas",
  "userId": "7ceb10bde8a14292832a6c919f060c87",
  "username": "admin_d8d77571139d52e116a65026ae4c03f007bd12a0",
  "password": "Fc.OP(g1?AO~4XzT",
  "domainId": "aac4d15e639d466da6db6137553826b2",
  "domainName": "1187701",
  "role": "admin"
};
var BLUEMIX_OBJECTSTORAGE_CONTAINER = "EC-G6";
// -------------- END CONFIG ------------------

// IMPORTS
var request = require('request');
var marked  = require('marked');
var pkgcloud = require('pkgcloud');
var stream = require('stream');

// CLIENT and CONFIG
var config = {
    provider: 'openstack',
    useServiceCatalog: true,
    useInternal: false,
    keystoneAuthVersion: 'v3',
    authUrl: 	BLUEMIX_OBJECTSTORAGE_CREDENTIALS.auth_url,
    tenantId: 	BLUEMIX_OBJECTSTORAGE_CREDENTIALS.projectId,
    domainId: 	BLUEMIX_OBJECTSTORAGE_CREDENTIALS.domainId,
    username: 	BLUEMIX_OBJECTSTORAGE_CREDENTIALS.username,
    password: 	BLUEMIX_OBJECTSTORAGE_CREDENTIALS.password,
    region: 	BLUEMIX_OBJECTSTORAGE_CREDENTIALS.region
};
var client, upload_container;

// PROCESS FUNCTION - get file as input, process it, request upload
function processFile(name, content) {
	// md to txt
	var txt = removeMd(content);

	// .md to .txt
	var name_parts = name.split('.');
	if(name_parts.length > 1)
		name_parts[name_parts.length - 1] = 'txt';
	else
		name_parts.push('txt');
	name = name_parts.join('.');

	// let's upload
	upload(name, txt);
}

// UPLOAD FUNCTION - upload the output file to bluemix
function upload(name, content) {
	// create container just once
	if(upload_container)
		uploadInContainer();
	else
		client.createContainer({ name: BLUEMIX_OBJECTSTORAGE_CONTAINER }, function (err, container) {
		    if (err)
				return console.error(err);
			upload_container = container;
			uploadInContainer();
		});

	var uploadInContainer = function() {
		var s = new stream.PassThrough();
		var upload = client.upload({
		    container: upload_container,
		    remote: name
		});
		s.pipe(upload);
		s.write(content);
		s.end();
	}
}

function loadChanges(params) {

	// get compare code
	var parts = params.compare.split('/');
	var code = parts[parts.length - 1];

	// get compare url
	var parts = params.repository.compare_url.split('/');
	parts[parts.length - 1] = code;
	var compare_url = parts.join('/');

	// handle file informations
	function getFile(file) {
		var url = file.contents_url;
		var name = file.filename;
		var status = file.status;

		if(status === 'added' || status === 'modified') {
			request({
				url : url,
				headers : {'user-agent': 'node.js'}
			}, function(error, response, body) {
				var result = JSON.parse(body);
				// using native node atob
				var content = new Buffer(result.content, 'base64').toString('utf-8');
				processFile(name, content)
			});
		}
	};

	// get all files
	request({
		url : compare_url,
		headers : {'user-agent': 'node.js'}
	}, function(error, response, body) {
		var compare_result = JSON.parse(body);
		var files = compare_result.files;

		for(var i = 0; i < files.length; i++) {
			var file = files[i];
			getFile(file);
		}
	});
}

// MAIN FUNCTION - Called by OpenWhisk NodeJS instance
// Handle GitHub input event
function main(params) {

	// async response
	return new Promise(function(resolve, reject) { 

		// create the client to upload to Object Storage
		// if the authentification failed, just stop here
		// it's useless to process files if they cannot be uploaded then
		client = pkgcloud.storage.createClient(config);

		client.auth(function(err) {
		    if (err) {
		        return reject(err);
		    }
		    loadChanges(params);
		});
	});
}

// REMOVE MD FUNCTION
// source : https://github.com/stiang/remove-markdown
function removeMd(md, options) {
	options = options || {};
	options.stripListLeaders = options.hasOwnProperty('stripListLeaders') ? options.stripListLeaders : true;
	options.gfm = options.hasOwnProperty('gfm') ? options.gfm : true;

	var output = md;
	try {
		if (options.stripListLeaders) {
			output = output.replace(/^([\s\t]*)([\*\-\+]|\d\.)\s+/gm, '$1');
		}
		if (options.gfm){
			output = output
			// Header
			.replace(/\n={2,}/g, '\n')
			// Strikethrough
			.replace(/~~/g, '')
			// Fenced codeblocks
			.replace(/`{3}.*\n/g, '');
		}
		output = output
		// Remove HTML tags
		.replace(/<(.*?)>/g, '$1')
		// Remove setext-style headers
		.replace(/^[=\-]{2,}\s*$/g, '')
		// Remove footnotes?
		.replace(/\[\^.+?\](\: .*?$)?/g, '')
		.replace(/\s{0,2}\[.*?\]: .*?$/g, '')
		// Remove images
		.replace(/\!\[.*?\][\[\(].*?[\]\)]/g, '')
		// Remove inline links
		.replace(/\[(.*?)\][\[\(].*?[\]\)]/g, '$1')
		// Remove Blockquotes
		.replace(/>/g, '')
		// Remove reference-style links?
		.replace(/^\s{1,2}\[(.*?)\]: (\S+)( ".*?")?\s*$/g, '')
		// Remove atx-style headers
		.replace(/^\#{1,6}\s*([^#]*)\s*(\#{1,6})?/gm, '$1')
		.replace(/([\*_]{1,3})(\S.*?\S)\1/g, '$2')
		.replace(/(`{3,})(.*?)\1/gm, '$2')
		.replace(/^-{3,}\s*$/g, '')
		.replace(/`(.+?)`/g, '$1')
		.replace(/\n{2,}/g, '\n\n');
	} catch(e) {
		return md;
	}
	return output;
};