'use strict';

/**
 * Various html elements
 */
var sourceVid = document.getElementById('source');
var videoSelect = document.querySelector('select#videosource');
var broadcastButton = document.getElementById('broadcast');
var toggleCrosshairButton = document.getElementById('toggleCrosshair');
var crossHair = document.getElementById('crosshair');

/**
 * Variable for local webcam stream
 */
var localStream;
/**
 * Peer connection to VR
 */
var peerConnection;

/**
 * SHIM for mediaDevices.enumerateDevices
 * courtesy of http://stackoverflow.com/questions/14610945/how-to-choose-input-video-device-for-webrtc/20087996#20087996
 */
if (navigator.mediaDevices && navigator.mediaDevices.enumerateDevices) {
    // Firefox 38+, Microsoft Edge, and Chrome 44+ seems having support of enumerateDevices
    navigator.enumerateDevices = function(callback) {
        navigator.mediaDevices.enumerateDevices().then(callback);
    };
}

function getAllAudioVideoDevices(successCallback, failureCallback) {
    if (!navigator.enumerateDevices && window.MediaStreamTrack && window.MediaStreamTrack.getSources) {
        navigator.enumerateDevices = window.MediaStreamTrack.getSources.bind(window.MediaStreamTrack);
    }

    if (!navigator.enumerateDevices && navigator.mediaDevices.enumerateDevices) {
        navigator.enumerateDevices = navigator.mediaDevices.enumerateDevices.bind(navigator);
    }

    if (!navigator.enumerateDevices) {
        failureCallback(null, 'Neither navigator.mediaDevices.enumerateDevices NOR MediaStreamTrack.getSources are available.');
        return;
    }

    var allMdiaDevices = [];
    var allAudioDevices = [];
    var allVideoDevices = [];

    var audioInputDevices = [];
    var audioOutputDevices = [];
    var videoInputDevices = [];
    var videoOutputDevices = [];

    navigator.enumerateDevices(function(devices) {
        devices.forEach(function(_device) {
            var device = {};
            for (var d in _device) {
                device[d] = _device[d];
            }

            // make sure that we are not fetching duplicate devics
            var skip;
            allMdiaDevices.forEach(function(d) {
                if (d.id === device.id) {
                    skip = true;
                }
            });

            if (skip) {
                return;
            }

            // if it is MediaStreamTrack.getSources
            if (device.kind === 'audio') {
                device.kind = 'audioinput';
            }

            if (device.kind === 'video') {
                device.kind = 'videoinput';
            }

            if (!device.deviceId) {
                device.deviceId = device.id;
            }

            if (!device.id) {
                device.id = device.deviceId;
            }

            if (!device.label) {
                device.label = 'Please invoke getUserMedia once.';
            }

            if (device.kind === 'audioinput' || device.kind === 'audio') {
                audioInputDevices.push(device);
            }

            if (device.kind === 'audiooutput') {
                audioOutputDevices.push(device);
            }

            if (device.kind === 'videoinput' || device.kind === 'video') {
                videoInputDevices.push(device);
            }

            if (device.kind.indexOf('audio') !== -1) {
                allAudioDevices.push(device);
            }

            if (device.kind.indexOf('video') !== -1) {
                allVideoDevices.push(device);
            }

            // there is no 'videoouput' in the spec.
            // so videoOutputDevices will always be [empty]

            allMdiaDevices.push(device);
        });

        if (successCallback) {
            successCallback({
                allMdiaDevices: allMdiaDevices,
                allVideoDevices: allVideoDevices,
                allAudioDevices: allAudioDevices,
                videoInputDevices: videoInputDevices,
                audioInputDevices: audioInputDevices,
                audioOutputDevices: audioOutputDevices
            });
        }
    });
}


getAllAudioVideoDevices(function(result) {
    if (result.allMdiaDevices.length) {
        console.debug('Number of audio/video devices available:', result.allMdiaDevices.length);
    }

    if (result.allVideoDevices.length) {
        console.debug('Number of video devices available:', result.allVideoDevices.length);
    }

    if (result.allAudioDevices.length) {
        console.debug('Number of audio devices available:', result.allAudioDevices.length);
    }

    if (result.videoInputDevices.length) {
        console.debug('Number of video-input devices available:', result.videoInputDevices.length);
    }

    if (result.audioInputDevices.length) {
        console.debug('Number of audio-input devices available:', result.audioInputDevices.length);
    }

    if (result.audioOutputDevices.length) {
        console.debug('Number of audio-output devices available:', result.audioOutputDevices.length);
    }

    if (result.allMdiaDevices.length && result.allMdiaDevices[0].label === 'Please invoke getUserMedia once.') {
        console.warn('It seems you did not invoke navigator-getUserMedia before using these API.');
    }

    console.info('All audio input devices:');
    result.audioInputDevices.forEach(function(device) {
        console.log('Audio input device id:', device.id, 'Device label:', device.label);
    });

    console.info('All audio output devices:');
    result.audioOutputDevices.forEach(function(device) {
        console.log('Audio output device id:', device.id, 'Device label:', device.label);
    });

    console.info('All video input devices:');
    result.videoInputDevices.forEach(function(device) {
        console.log('Video input device id:', device.id, 'Device label:', device.label);

        var option = document.createElement('option');
        option.value = device.id;
        option.text = device.label || 'camera ' + (videoSelect.length + 1);
        videoSelect.appendChild(option);


    });
}, function(error) {
    alert(error);
});

/**
 * Start local stream with chosen device
 */
function stream(){
  if (!!window.stream) {
    sourceVid.src = null;
  }
  broadcastButton.disabled = false;
  toggleCrosshairButton.disabled = false;
  var videoSource = videoSelect.value;
  var constraints = {
    /*audio: {
      optional: [{sourceId: audioSource}]
    },*/
    video: {
      mandatory: {
        minWidth: 640,
        minHeight: 480
      },
      optional: [{sourceId: videoSource}]
    }
  };
  	navigator.mediaDevices.getUserMedia(constraints)
	.then(function(stream) {
      console.log('Received local stream');
      sourceVid.srcObject = stream;
      localStream = stream;
  })
	.catch(function(e) {
	  console.error('getUserMedia() error: ' + e.name);
	});
}

/**
 * Start peer connection initialization
 * Announce source to server over signaling channel.
 */
function broadcast() {
	console.log('broadcasting');
	if (localStream.getVideoTracks().length > 0) {
	    trace('Using video device: ' + localStream.getVideoTracks()[0].label);
	}
	if (localStream.getAudioTracks().length > 0) {
	  trace('Using audio device: ' + localStream.getAudioTracks()[0].label);
	}

	var servers = null;

	peerConnection = new RTCPeerConnection(servers);
	trace('Created local peer connection object peerConnection');
	peerConnection.onicecandidate = gotIceCandidate;
  peerConnection.addStream(localStream);

  trace('Added localStream to peerConnection');
  peerConnection.createOffer(gotLocalDescription);

}

function gotIceCandidate(event) {
  if (event.candidate) {
    peerConnection.addIceCandidate(new RTCIceCandidate(event.candidate));
    trace('Local ICE candidate: \n' + event.candidate.candidate);
    signaling.send({command:'source:candidate', payload:event.candidate});
  }
}

function gotRemoteDescription(description) {
  trace('Answer from remotePeerConnection: \n' + description.sdp);
  peerConnection.setRemoteDescription(description);
}

function gotRemoteStream(event) {
  //remoteVideo.src = URL.createObjectURL(event.stream);
  trace('Received remote stream');
}

function gotLocalDescription(description) {
  peerConnection.setLocalDescription(description);
  trace('Offer from localPeerConnection: \n' + description.sdp);

  signaling.send({command:'source:connect', payload:description});
}

/**
 * Signaling channel message callback
 */
signaling.onMessage = function message(data) {
    if (data.command === undefined) return;
    switch (data.command) {
      case 'vr:answer':
        console.log('got remote description from vR');
        peerConnection.setRemoteDescription(new RTCSessionDescription(data.payload))
        broadcastButton.classList.toggle('btn-suceess');
        broadcastButton.value = "Casting...";
      break;
      case 'vr:disconnect':
        /*peerConnection.close();
        broadcastButton.classList.toggle('btn-suceess');
        broadcastButton.value = "Restart Casting";*/
      break;
    }
    console.log('handle data');
};

broadcastButton.onclick = broadcast;
/**
 * Toggle crosshair and center it reelative to videoSource.
 * TODO: Retoggle on device rotation.
 */
toggleCrosshair.onclick = function() {
  crossHair.style.top = -1*sourceVid.videoHeight/2-40 + 'px';
  crossHair.classList.toggle('hidden')
};

videoSelect.onchange = stream;
