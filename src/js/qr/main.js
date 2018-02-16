'use strict';

// Constants.
const height = 300;
const width = 400;
const channels = 3;

const KC = {
    ORIGINAL_IMAGE: 'originalImage',
    THRESHOLDED_IMAGE: 'thresholdedImage',
};

const K = {
    TRANSFORM_IMAGE_DATA: 'transformLinearToXYZ',
    THRESHOLD_FILTER: 'thresholdFilter',
    EDGE_DETECTION_FILTER: 'edgeDetectionFilter',
    RENDER_ORIGINAL: 'renderOriginalImage',
    RENDER_THRESHOLDED: 'renderThresholdedImage',
    RETURN_NON_TEXTURE_FROM_ORIGINAL: 'returnNonTextureFromOriginal',
};

function initialize() {
    // Initialize the video elements and stream handler.
    initializeVideo();

    // Initialize kernel creators and add kernels.
    initKernelCreator(KC.ORIGINAL_IMAGE);
    initKernelCreator(KC.THRESHOLDED_IMAGE);
    addKernel(createTransformLinearToXYZ, KC.ORIGINAL_IMAGE, K.TRANSFORM_IMAGE_DATA);
    addKernel(createReturnNonTexture2D, KC.ORIGINAL_IMAGE, K.RETURN_NON_TEXTURE_FROM_ORIGINAL);
    addKernel(createRenderGreyscale, KC.ORIGINAL_IMAGE, K.RENDER_ORIGINAL, true);
    addKernel(createThresholdingFilter, KC.THRESHOLDED_IMAGE, K.THRESHOLD_FILTER);
    addKernel(createEdgeDetectionFilter, KC.THRESHOLDED_IMAGE, K.EDGE_DETECTION_FILTER);
    addKernel(createRenderGreyscale, KC.THRESHOLDED_IMAGE, K.RENDER_THRESHOLDED, true);

    // Create canvases for CPU and GPU for each of the renderGraphical kernels.
    createCanvas(K.RENDER_ORIGINAL, '.canvas-wrapper.original');
    createCanvas(K.RENDER_THRESHOLDED, '.canvas-wrapper.thresholded');
}

addEventListener('DOMContentLoaded', initialize);

function renderLoop() {
    // Calculate and display FPS.
    document.querySelector('#fps').innerHTML = fps.getFPS();

    // Fetches image data from the video canvas.
    const imageData = fetchVideoImageData();

    // Transform linear image data into 3-D array for proper computation.
    const originalImage = getKernel(K.TRANSFORM_IMAGE_DATA)(
        imageData,
        width,
        height,
        state.isCameraFlipped ? 1 : 0
    );

    // Threshold the original image.
    const originalImageCopy = getKernel(K.RETURN_NON_TEXTURE_FROM_ORIGINAL)(originalImage);
    const thresholdedImage = getKernel(K.THRESHOLD_FILTER)(originalImageCopy, 0.5, 0);

    // Edge detection.
    const edgedDetectedImage = getKernel(K.EDGE_DETECTION_FILTER)(thresholdedImage, width, height);

    // Render each of the images at each stage.
    getKernel(K.RENDER_ORIGINAL, true)(originalImage);
    getKernel(K.RENDER_THRESHOLDED, true)(edgedDetectedImage);

    // Fix canvas sizes.
    setCanvasSize(K.RENDER_ORIGINAL, '.canvas-wrapper.original');
    setCanvasSize(K.RENDER_THRESHOLDED, '.canvas-wrapper.thresholded');

    // Request next frame to render.
    state.renderLoopRequestId = requestAnimationFrame(renderLoop);
}

function createCanvas(kernelName, containerSelector) {
    const canvas = kernels.gpu[kernelName].getCanvas();
    document.querySelector(containerSelector).appendChild(canvas);
    canvas.width = width;
    canvas.height = height;
}

function setCanvasSize(kernelName) {
    const canvas = getKernel(kernelName, true).getCanvas();
    canvas.width = width;
    canvas.height = height;
}
