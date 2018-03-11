'use strict';

// Constants.
const height = 450;
const width = 600;
const qrCodeLength = 203;
const qrCodeDimension = 29;
const channels = 3;

// Set the colors of the corners of the QR code
// bounding box that should be plotted.
const plotPointColors = [[1, 0, 0], [0, 1, 0], [0, 1, 1], [1, 0, 1]];

// Keep any old textures for the rendered QR code to prevent flashing.
let lastQrCodeIfGpuIs = {};

const KC = {
    LEFT_IMAGE: 'leftImage',
    RIGHT_IMAGE: 'rightImage',
};

const K = {
    TRANSFORM_IMAGE_DATA: 'transformImageData',
    THRESHOLD_FILTER: 'thresholdFilter',
    MEDIAN_FILTER: 'medianFilter',
    MARKER_DETECTION_ROW_WISE: 'markerDetectionRowWise',
    MARKER_DETECTION_COL_WISE: 'markerDetectionColWise',
    MARKER_DETECTION_TOP: 'markerDetectionTop',
    QR_CALCULATE_CORNERS: 'calculateCorners',
    QR_CALCULATE_CORNERS_AS_ARRAY: 'calculateCornersAsArray',
    QR_AFFINE_TRANSFORM: 'affineTransform',
    OUTLINE_QR_CODE: 'outlineQr',
    CREATE_EMPTY_QR_CODE_TEXTURE: 'createEmptyQrCodeTexture',
    RENDER_LEFT: 'renderLeftImage',
    RENDER_LEFT_COLOR: 'renderLeftImageColor',
    RENDER_RIGHT: 'renderQrCode',
    CONVERT_TO_ARRAY: 'convertToArray',
};

function initialize() {
    // Initialize the video elements and stream handler.
    initializeVideo();

    // Initialize kernel creators and add kernels.
    initKernelCreator(KC.LEFT_IMAGE);
    initKernelCreator(KC.RIGHT_IMAGE);
    addKernel(createTransformLinearToXYZ, KC.LEFT_IMAGE, K.TRANSFORM_IMAGE_DATA);
    addKernel(createReturnNonTexture2D, KC.LEFT_IMAGE, K.CONVERT_TO_ARRAY);
    addKernel(createThresholdingFilter, KC.LEFT_IMAGE, K.THRESHOLD_FILTER);
    addKernel(createMedianFilter, KC.LEFT_IMAGE, K.MEDIAN_FILTER);
    addKernel(createMarkerDetectionRowWise, KC.LEFT_IMAGE, K.MARKER_DETECTION_ROW_WISE);
    addKernel(createMarkerDetectionColWise, KC.LEFT_IMAGE, K.MARKER_DETECTION_COL_WISE);
    addKernel(createMarkerDetectionTop, KC.LEFT_IMAGE, K.MARKER_DETECTION_TOP);
    addKernel(createCalculateCorners, KC.LEFT_IMAGE, K.QR_CALCULATE_CORNERS);
    addKernel(createCalculateCornersAsArray, KC.LEFT_IMAGE, K.QR_CALCULATE_CORNERS_AS_ARRAY);
    addKernel(createAffineTransform, KC.RIGHT_IMAGE, K.QR_AFFINE_TRANSFORM);
    addKernel(createOutlineQrCode, KC.LEFT_IMAGE, K.OUTLINE_QR_CODE);
    addKernel(createEmptyQrCodeTexture, KC.RIGHT_IMAGE, K.CREATE_EMPTY_QR_CODE_TEXTURE);
    addKernel(createRenderGreyscale, KC.LEFT_IMAGE, K.RENDER_LEFT, true);
    addKernel(createRenderColor, KC.LEFT_IMAGE, K.RENDER_LEFT_COLOR, true);
    addKernel(createRenderQrCode, KC.RIGHT_IMAGE, K.RENDER_RIGHT, true);

    // Create canvases for CPU and GPU for each of the renderGraphical kernels.
    createCanvas(K.RENDER_LEFT, '.canvas-wrapper.left', width, height);
    createCanvas(K.RENDER_RIGHT, '.canvas-wrapper.right', qrCodeLength, qrCodeLength);

    // Create empty QR code texture in the cache.
    lastQrCodeIfGpuIs[false] = getKernel(K.CREATE_EMPTY_QR_CODE_TEXTURE)();
    lastQrCodeIfGpuIs[true] = getKernel(K.CREATE_EMPTY_QR_CODE_TEXTURE)();
}

addEventListener('DOMContentLoaded', initialize);

function renderLoop() {
    // Calculate and display FPS.
    document.querySelector('#fps').innerHTML = fps.getFPS();

    // Fetches image data from the video canvas.
    const imageData = fetchVideoImageData();

    // Transform linear image data into 3-D array for proper computation.
    const cameraFlipped = state.isCameraFlipped ? 1 : 0;
    const originalImage = getKernelTimed(K.TRANSFORM_IMAGE_DATA)(imageData, cameraFlipped);

    // Threshold the original image.
    const thresholdFilterState = getFilterByName('thresholdingFilter');
    const thresholdLevel = getParamValueByName(thresholdFilterState, 'threshold');
    const thresholdedImage = getKernelTimed(K.THRESHOLD_FILTER)(originalImage, thresholdLevel, 0);

    // Apply median filter to remove artifacts after thresholding.
    const filteredImage = getKernelTimed(K.MEDIAN_FILTER)(thresholdedImage);

    // Identify markers.
    const rowWise = getKernelTimed(K.MARKER_DETECTION_ROW_WISE)(filteredImage, 0);
    const colWise = getKernelTimed(K.MARKER_DETECTION_COL_WISE)(filteredImage, 1);
    const topMarkers = getKernelTimed(K.MARKER_DETECTION_TOP)(rowWise, colWise);

    // Calculate the corners of the QR code.
    const corners = getKernelTimed(K.QR_CALCULATE_CORNERS)(rowWise, colWise, topMarkers);

    // Outline the QR code on the original image.
    const outlinedQrCode = getKernelTimed(K.OUTLINE_QR_CODE)(filteredImage, corners, plotPointColors);

    // Render the outlined QR code.
    getKernelTimed(K.RENDER_LEFT_COLOR, true)(outlinedQrCode);

    // Render the QR code in the 2nd canvas if enabled.
    if (state.isOutputQrCodeEnabled) {
        // Copy the left image so that we can render it later.
        // Note that this is the expensive step as we have to transfer data from GPU back to CPU and back again.
        const leftImageCopy = getKernelTimed(K.CONVERT_TO_ARRAY)(filteredImage);

        // Recalculate corners as array instead for affine transformation.
        // Doing this twice shouldn't be that much more expensive (i.e. calculating the previous one should be negligible).
        const corners = getKernelTimed(K.QR_CALCULATE_CORNERS_AS_ARRAY)(rowWise, colWise, topMarkers);

        // Perform affine transform on the image based on the markers found.
        const lastTexture = lastQrCodeIfGpuIs[state.isGpuMode];
        const transformedQrCode = getKernelTimed(K.QR_AFFINE_TRANSFORM)(leftImageCopy, corners, qrCodeDimension, lastTexture);
        lastQrCodeIfGpuIs[state.isGpuMode] = transformedQrCode;

        // Render the extracted QR code.
        getKernelTimed(K.RENDER_RIGHT, true)(transformedQrCode);
    }

    // Fix canvas sizes.
    setCanvasSize(K.RENDER_LEFT, width, height);
    setCanvasSize(K.RENDER_RIGHT, qrCodeLength, qrCodeLength);

    // Request next frame to render.
    state.renderLoopRequestId = requestAnimationFrame(renderLoop);
}

function createCanvas(kernelName, containerSelector, width, height) {
    const canvas = kernels.gpu[kernelName].getCanvas();
    document.querySelector(containerSelector).appendChild(canvas);
    canvas.width = width;
    canvas.height = height;
}

function setCanvasSize(kernelName, width, height) {
    const canvas = getKernel(kernelName, true).getCanvas();
    canvas.width = width;
    canvas.height = height;
}
