'use strict';

var vr = function() {
	return {
		peerConnections: [],
		leftStream: null, 
		rightStream: null,
		leftVideo: vidL,
		rightVideo: vidR
	}
}

vr.bindSource = function() {

}

vr.listen = function() {

}



var leftPeerConnection;
var rightPeerConnection;

var gotLeftStream = false;
var gotRightStream = false;

var vidL = document.getElementById('vidL');
var vidR = document.getElementById('vidR');

function listen() {
	var servers = null;

	window.primus.write({command:'vr:connect', payload:null}); //Send message aboout new VR connection
	
	leftPeerConnection = new RTCPeerConnection(servers);
	trace('Created peer connection object');
	
	leftPeerConnection.onicecandidate = function (event) {
		gotIceCandidate(this, event);
	};
	leftPeerConnection.onaddstream = function (event) {
		gotRemoteStream('left', event);
	};


	rightPeerConnection = new RTCPeerConnection(servers);
	trace('Created peer connection object');
	
	rightPeerConnection.onicecandidate = function (event) {
		gotIceCandidate(this, event);
	};
	rightPeerConnection.onaddstream = function (event) {
		gotRemoteStream('right', event);
	};
    /*
	rightPeerConnection = new RTCPeerConnection(servers);
	trace('Created right peer connection object');
	rightPeerConnection.onicecandidate = gotRightIceCandidate;
	rightPeerConnection.onaddstream = gotRightRemoteStream;*/
}

function bindSource(source_id, payload) {
		var pc = null;
		if (!gotLeftStream) {
			pc = leftPeerConnection;
		} else {
			pc = rightPeerConnection;
		}
		console.log('got source', source_id, payload);
		
		pc.setRemoteDescription(new RTCSessionDescription(payload.sdp));
		payload.candidates.forEach(function(candidate) {
			console.log('Add ice candidate', candidate);
			pc.addIceCandidate(new RTCIceCandidate(candidate));
		})

		pc.createAnswer(
			function(desc) {
				pc.setLocalDescription(desc);
	            console.log('Sending VR answer to source with id ' + source_id);
				signaling.send({command:'vr:answer', payload:{source:source_id, description: desc}});
		});
		gotLeftStream = true;
}

signaling.onMessage = function(data) {
	switch (data.command)
	{
		case 'sources':
			console.log('Command appears to be list of sources');
			for (var source_id in data.payload.sources) {
				bindSource(source_id, data.payload.sources[source_id]);
			}
		break;
	}
};

function gotRemoteDescription(pc, description) {
  pc.setRemoteDescription(description);
  trace('Answer from remotePeerConnection: \n' + description.sdp);
}

function gotIceCandidate(pc, event) {
  if (event.candidate) {
    pc.addIceCandidate(new RTCIceCandidate(event.candidate));
    trace('Local ICE candidate: \n' + event.candidate.candidate);
  }
}


function gotRemoteStream(side, event) {
  console.log(event);
  if (side == 'left') {
  	vidL.src = URL.createObjectURL(event.stream);
  	vidL.play();	
  } else {
  	vidR.src = URL.createObjectURL(event.stream);
  	vidR.play();	
  }
  trace('Received remote stream');
}

function gotIceCandidate(pc, event) {
  if (event.candidate) {
    pc.addIceCandidate(new RTCIceCandidate(event.candidate));
    trace('Remote ICE candidate: \n ' + event.candidate.candidate);
  }
}

function toggleFullScreen() {
  if (!document.fullscreenElement &&    // alternative standard method
      !document.mozFullScreenElement && !document.webkitFullscreenElement && !document.msFullscreenElement ) {  // current working methods
    if (document.documentElement.requestFullscreen) {
      document.documentElement.requestFullscreen();
    } else if (document.documentElement.msRequestFullscreen) {
      document.documentElement.msRequestFullscreen();
    } else if (document.documentElement.mozRequestFullScreen) {
      document.documentElement.mozRequestFullScreen();
    } else if (document.documentElement.webkitRequestFullscreen) {
      document.documentElement.webkitRequestFullscreen(Element.ALLOW_KEYBOARD_INPUT);
    }
  } else {
    if (document.exitFullscreen) {
      document.exitFullscreen();
    } else if (document.msExitFullscreen) {
      document.msExitFullscreen();
    } else if (document.mozCancelFullScreen) {
      document.mozCancelFullScreen();
    } else if (document.webkitExitFullscreen) {
      document.webkitExitFullscreen();
    }
  }
}

window.addEventListener("keydown", function(e) {
	if (e.keyCode == 32) {
		vidR.pause();
		vidL.pause();
		var t = vidR.src;
		vidR.src = vidL.src;
		vidL.src = t;
		vidR.play();
		vidL.play();
	}
	if (e.keyCode == 13) {
    	toggleFullScreen();
  	}
}, false);

listen();