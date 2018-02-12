var canvas, video, width, height, context;
var copyVideo = false;
var canvasReady = false;
var arr = [];
var imageData;
var firsttimevid = true;
var renderLoopRequestId;

function draw() {
    if (copyVideo) {
        context.drawImage(video, 0, 0, canvas.width, canvas.height);
        imageData = context.getImageData(0, 0, 800, 600);
        if (firsttimevid === true) {
            for (var channel = 0; channel < 4; channel++) {
                arr.push([]);
                for (var y = 0; y < 600; y++) {
                    arr[channel].push([]);
                }
            }
        }
        firsttimevid = false;
        var pointer = 0;
        for (var y = 0; y < 600; y++) {
            for (var x = 0; x < 800; x++) {
                arr[0][600 - y - 1][x] = imageData.data[pointer++] / 256;
                arr[1][600 - y - 1][x] = imageData.data[pointer++] / 256;
                arr[2][600 - y - 1][x] = imageData.data[pointer++] / 256;
                arr[3][600 - y - 1][x] = imageData.data[pointer++] / 256;
            }
        }

        canvasReady = true;
    }
    //     console.log(arr);
    requestAnimationFrame(draw);
}

navigator.getUserMedia =
    navigator.getUserMedia ||
    navigator.webkitGetUserMedia ||
    navigator.mozGetUserMedia ||
    navigator.msGetUserMedia;

function initialize() {
    video = document.getElementById('video');
    width = video.width;
    height = video.height;

    canvas = document.getElementById('videoCanvas');
    console.log(videoCanvas);
    context = canvas.getContext('2d');

    video.addEventListener(
        'playing',
        function() {
            console.log('Started');
            copyVideo = true;
        },
        true
    );

    if (typeof navigator.mediaDevices.getUserMedia === 'undefined') {
        navigator.getUserMedia({ video: true }, streamHandler, errorHandler);
    } else {
        navigator.mediaDevices
            .getUserMedia({ video: true })
            .then(streamHandler)
            .catch(errorHandler);
    }
}

var myKernelImg = makeImg('gpu');
var myCodeImg = makeImg('cpu');
var myKernelFilter1 = makeFilter('gpu');
var myKernelFilter2 = makeFilter('gpu');
var myCodeFilter1 = makeFilter('cpu');
var myCodeFilter2 = makeFilter('cpu');
var orig;
var afterload = false;
var animIndex = 0;
var canvas = myKernelImg.getCanvas();
document.querySelector('.canvas-wrapper').appendChild(canvas);

var f = document.querySelector('#fps');

function renderLoop() {
    f.innerHTML = fps.getFPS();
    if (canvasReady === true) {
        if (selection === 0) {
            orig = myKernelImg(arr);
            // console.log(orig);
            afterload = true;
            var C = orig;

            if (filtering === 0) {
                // var D = myCodeFilter1(C);
                // var X = myCodeFilter2(D);
                var X = myCodeFilter2(C);
            } else {
                var X = C;
            }
        } else {
            orig = myKernelImg(arr);
            // console.log(orig);
            afterload = true;
            var C = orig;
            if (filtering === 0) {
                // var D = myKernelFilter1(C);
                // var X = myKernelFilter2(D);
                var X = myKernelFilter2(C);
            } else {
                var X = C;
            }
        }
        var E = toimg(X);
    } else {
        console.log('video not ready yet');
    }
    // setTimeout(renderLoop, 1);            // Uncomment this line, and comment the next line
    renderLoopRequestId = requestAnimationFrame(renderLoop); // to see how fast this could run...
}

function streamHandler(stream) {
    video.src = URL.createObjectURL(stream);
    video.play();
    console.log('In startStream');
    requestAnimationFrame(draw);
}

addEventListener('DOMContentLoaded', initialize);
