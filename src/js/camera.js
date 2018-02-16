'use strict';

// Vendor-specific getUserMedia shim.
navigator.getUserMedia =
    navigator.getUserMedia ||
    navigator.webkitGetUserMedia ||
    navigator.mozGetUserMedia ||
    navigator.msGetUserMedia;

function initializeVideo() {
    // Initialize video element.
    const video = document.getElementById('video');
    video.style.height = height;
    video.style.width = width;

    // Add event handlers to receive video stream from camera.
    const streamHandler = stream => {
        video.src = URL.createObjectURL(stream);
        video.play();
    };

    // Set the event handler for the video stream, depending on the browser's media API.
    if (typeof navigator.mediaDevices.getUserMedia === 'undefined') {
        navigator.getUserMedia({ video: true, audio: false }, streamHandler);
    } else {
        navigator.mediaDevices.getUserMedia({ video: true, audio: false }).then(streamHandler);
    }
}

function fetchVideoImageData() {
    // Draw the contents of the video on the video canvas.
    const video = document.getElementById('video');
    const context = document.getElementById('videoCanvas').getContext('2d');
    context.drawImage(video, 0, 0, width, height);

    // Extract the image data from the canvas.
    const data = context.getImageData(0, 0, width, height).data;

    return data;
}
