'use strict';

var options = {};
var primus = Primus.connect(options);
//primus.open();
var wsConnected = false;
primus.on('open', function() {
	wsConnected = true;
})
primus.on('end', function() {
	wsConnected = false;
});

window.primus = primus;

var signaling = function() {
	return {};
}

primus.on('data', function(data) {
	console.log('Got signaling message!');
	signaling.onMessage(data);
})

signaling.send = function(data) {
	console.log('Sending signaling message!');
	primus.write(data);
}