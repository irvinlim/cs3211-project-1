'use strict';

// Constants.
const height = 450;
const width = 600;
const qrCodeLength = 203;
const qrCodeDimension = 29;
const channels = 3;

// Set default threshold level for this page.
getFilterByName('thresholdingFilter').params.filter(
    param => param.name === 'threshold'
)[0].value = 0.4;

document.querySelector(
    'input[data-filter-name=thresholdingFilter][data-param-name=threshold]'
).value = 0.4;

const KC = {
    LEFT_IMAGE: 'leftImage',
    RIGHT_IMAGE: 'rightImage',
};

const K = {
    TRANSFORM_IMAGE_DATA: 'transformLinearToXYZ',
    THRESHOLD_FILTER: 'thresholdFilter',
    MEDIAN_FILTER: 'medianFilter',
    MARKER_DETECTION_ROW_WISE: 'markerDetectionRowWise',
    MARKER_DETECTION_COL_WISE: 'markerDetectionColWise',
    MARKER_DETECTION_COMBINED: 'markerDetectionCombined',
    MARKER_DETECTION_TOP: 'markerDetectionTop',
    QR_CALCULATE_CORNERS: 'calculateCorners',
    QR_PERSPECTIVE_WARP: 'perspectiveWarp',
    PLOT_MARKERS: 'plotMarkers',
    PLOT_POINTS: 'plotPoints',
    RENDER_LEFT: 'renderLeftImage',
    RENDER_LEFT_COLOR: 'renderLeftImageColor',
    RENDER_QR_CODE: 'renderQrCode',
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
    addKernel(createMarkerDetection, KC.LEFT_IMAGE, K.MARKER_DETECTION_ROW_WISE);
    addKernel(createMarkerDetection, KC.LEFT_IMAGE, K.MARKER_DETECTION_COL_WISE);
    addKernel(createMarkerDetectionCombined, KC.LEFT_IMAGE, K.MARKER_DETECTION_COMBINED);
    addKernel(createMarkerDetectionTop, KC.LEFT_IMAGE, K.MARKER_DETECTION_TOP);
    addKernel(createCalculateCorners, KC.LEFT_IMAGE, K.QR_CALCULATE_CORNERS);
    addKernel(createPerspectiveWarp, KC.RIGHT_IMAGE, K.QR_PERSPECTIVE_WARP);
    addKernel(createPlotMarkers, KC.LEFT_IMAGE, K.PLOT_MARKERS);
    addKernel(createPlotPoints, KC.LEFT_IMAGE, K.PLOT_POINTS);
    addKernel(createRenderGreyscale, KC.LEFT_IMAGE, K.RENDER_LEFT, true);
    addKernel(createRenderColor, KC.LEFT_IMAGE, K.RENDER_LEFT_COLOR, true);
    addKernel(createRenderQrCode, KC.RIGHT_IMAGE, K.RENDER_QR_CODE, true);

    // Create canvases for CPU and GPU for each of the renderGraphical kernels.
    createCanvas(K.RENDER_LEFT, '.canvas-wrapper.original', width, height);
    createCanvas(K.RENDER_QR_CODE, '.canvas-wrapper.thresholded', qrCodeLength, qrCodeLength);
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
    const thresholdFilterState = getFilterByName('thresholdingFilter');
    const thresholdLevel = getParamValueByName(thresholdFilterState, 'threshold');
    const thresholdedImage = getKernel(K.THRESHOLD_FILTER)(originalImage, thresholdLevel, 0);

    // Apply median filter to remove artifacts after thresholding.
    const medianFilteredImage = getKernel(K.MEDIAN_FILTER)(thresholdedImage, width, height);

    // Identify markers.
    const rowWise = getKernel(K.MARKER_DETECTION_ROW_WISE)(medianFilteredImage, 0);
    const colWise = getKernel(K.MARKER_DETECTION_COL_WISE)(medianFilteredImage, 1);
    const markerLocationsCombined = getKernel(K.MARKER_DETECTION_COMBINED)(rowWise, colWise);
    const topMarkers = getKernel(K.MARKER_DETECTION_TOP)(rowWise, colWise);

    // Calculate the corners of the QR code.
    const calculatedCorners = getKernel(K.QR_CALCULATE_CORNERS)(rowWise, colWise, topMarkers);

    // Copy the left image so that we can render it later.
    // Note that this is the expensive step as we have to transfer data from GPU back to CPU and back again.
    const medianFilteredImageCopy = getKernel(K.CONVERT_TO_ARRAY)(medianFilteredImage);

    // Perform perspective transform on the image based on the markers found.
    const warpedQrCode = getKernel(K.QR_PERSPECTIVE_WARP)(
        medianFilteredImageCopy,
        calculatedCorners,
        qrCodeDimension
    );

    // Plot markers on the image.
    const markersPlotted = getKernel(K.PLOT_MARKERS)(thresholdedImage, markerLocationsCombined);
    const pointsPlotted = getKernel(K.PLOT_POINTS)(markersPlotted, calculatedCorners, [
        [1, 0, 0],
        [0, 1, 0],
        [0, 1, 1],
        [1, 0, 1],
    ]);

    // Render each of the images at each stage.
    getKernel(K.RENDER_LEFT_COLOR, true)(pointsPlotted);
    getKernel(K.RENDER_QR_CODE, true)(warpedQrCode);

    // Fix canvas sizes.
    setCanvasSize(K.RENDER_LEFT, width, height);
    setCanvasSize(K.RENDER_QR_CODE, qrCodeLength, qrCodeLength);

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
