function initialize() {
    // Initialize video element.
    const video = document.getElementById('video');
    video.style.height = height;
    video.style.width = width;

    // Add event handlers to receive video stream from camera.
    const streamHandler = stream => {
        video.src = URL.createObjectURL(stream);
        video.play();
    };

    if (typeof navigator.mediaDevices.getUserMedia === 'undefined') {
        navigator.getUserMedia({ video: true, audio: false }, streamHandler);
    } else {
        navigator.mediaDevices.getUserMedia({ video: true, audio: false }).then(streamHandler);
    }

    // Create a Canvas for both CPU and GPU modes.
    const cpuCanvas = cpuKernels.renderGraphical.getCanvas();
    const gpuCanvas = gpuKernels.renderGraphical.getCanvas();
    document.querySelector('.canvas-wrapper').appendChild(cpuCanvas);
    document.querySelector('.canvas-wrapper').appendChild(gpuCanvas);
    cpuCanvas.width = width;
    cpuCanvas.height = height;
    gpuCanvas.width = width;
    gpuCanvas.height = height;
}

addEventListener('DOMContentLoaded', initialize);

function renderLoop() {
    // Calculate and display FPS.
    document.querySelector('#fps').innerHTML = fps.getFPS();

    // Draw the contents of the video on the video canvas.
    const video = document.getElementById('video');
    const context = document.getElementById('videoCanvas').getContext('2d');
    context.drawImage(video, 0, 0, width, height);

    // Extract the image data from the canvas.
    let data = context.getImageData(0, 0, width, height).data;

    /// MAIN SECTION
    /// Execute kernel functions to process and render image for this frame.

    // Transform linear image data into 3-D array for proper computation.
    data = getKernel('transformLinearToXYZ')(data);

    // Add light tunnel filter.
    if (state.isLightTunnelFilterEnabled) {
        data = getKernel('lightTunnelFilter')(data, Number(state.lightTunnelFilterRadius));
    }

    // Add embossed filter.
    if (state.isEmbossedFilterEnabled) {
        data = getKernel('embossedFilter')(data);
    }

    // Add gaussian filter.
    if (state.isGaussianFilterEnabled) {
        data = getKernel('gaussianFilter')(data);
    }

    // Add edge detection filter.
    if (state.isEdgeDetectionFilterEnabled) {
        data = getKernel('edgeDetectionFilter')(data);
    }

    // Render image in the final canvas.
    getKernel('renderGraphical')(data);

    // Show only the current canvas and fix the size.
    const canvas = getKernel('renderGraphical').getCanvas();
    document.querySelectorAll('.canvas-wrapper canvas').forEach(el => (el.style.display = 'none'));
    canvas.style.display = 'inline';
    canvas.width = width;
    canvas.height = height;

    // Request next frame to render.
    renderLoopRequestId = requestAnimationFrame(renderLoop);
}
