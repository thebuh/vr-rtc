'use strict';


// modules
var staticServ = require( 'node-static' ),
    port = 8080,
    http = require( 'http' ),
    https = require( 'https' ),
    fs = require( 'fs' );

// config
var file = new staticServ.Server( './', {
    cache: 3600,
    gzip: true
} );

// serve
/*var httpServer = http.createServer( function ( request, response ) {
    request.addListener( 'end', function () {
        file.serve( request, response );
    } ).resume();
} ).listen( port );*/
var httpsServer = https.createServer( {
    key: fs.readFileSync('./certs/server.key'),
    cert: fs.readFileSync('./certs/server.crt'),
    ca: fs.readFileSync('./certs/ca.crt'),
    requestCert: true,
    rejectUnauthrized: false,
}, function ( request, response ) {
    request.addListener( 'end', function () {
        file.serve( request, response );
    } ).resume();
} ).listen( port );

var Primus = require('primus');

var primus = Primus(httpsServer, { pathname: 'ws', transformer: 'websockets', parser: 'JSON' });

var peers = { 
	vrs: {}, 
	sources: {}
};


primus.on('connection', function connection(spark) {
	console.log('Signaling channel connection');	
	spark.on('data', function (data) {
		//console.log('received data from the client', data);
		if (data.command === undefined) {
			console.log('no comamnd');
			return;
		}
		switch (data.command) {
			case 'source:connect':
				console.log('New source connection');
				if (peers.sources[spark.id] === undefined) {
					peers.sources[spark.id] = { candidates: [], sdp: null};
				}
				peers.sources[spark.id].sdp = data.payload;
			break;
			case 'source:candidate':
				console.log('Source candidates');
				if (peers.sources[spark.id] === undefined) {
					peers.sources[spark.id] = { candidates: [], sdp: null};
				}
				peers.sources[spark.id].candidates.push(data.payload);
			break;
			case 'vr:connect':
				console.log('New VR connection');
				peers.vrs[spark.id] = data.payload;
				
			 	spark.write({command:'sources', payload:{ sources:peers.sources }});
			break;
			case 'vr:answer':
				console.log('Forwarding VR answer');
				var sspark = primus.spark(data.payload.source);
				if (sspark !== undefined) {
					peers.sources[data.payload.source].connected = true;
					sspark.write({command:'vr:answer', payload:data.payload.description});	
				}
			break;
		}
	    
  	});
});

primus.on('disconnection', function (spark) {
	console.log('Signaling channel disconnect');
	if (peers.vrs[spark.id] !== undefined) {
		delete peers.vrs[spark.id];
		console.log('Seems like VR. Notifying sources');
		primus.write({command:'vr:disconnect', payload:{id:spark.id}});
	}
	
	if (peers.sources[spark.id] !== undefined) {
		delete peers.sources[spark.id];
		console.log('Seems like source. Notifying VR');
		primus.write({command:'source:disconnect', payload:{id:spark.id}});
	}
});

primus.on('error', function error(err) {
  console.error('Something horrible has happened', err.stack);
});