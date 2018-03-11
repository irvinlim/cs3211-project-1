'use strict';

const gpu = new GPU();
const cpu = new GPU({ mode: 'cpu' });

/// ------------------------
/// START KERNEL DEFINITIONS
/// ------------------------

// Kernel: Transforms a linear array of image data into (x,y) data in 4 channels,
// resulting in a 3-D array.
const createTransformLinearToXYZ = createStandardKernel(function(imageData, isCameraFlipped) {
    var x, y, z;

    // Image's color channel is every 4 elements (R, G, B, A). Omit every 4th element.
    z = this.thread.z;

    // Input image data is y-inverted so we need to read from bottom up.
    y = 4 * this.constants.width * (this.constants.height - this.thread.y - 1);

    // Optionally flip the camera if the argument is true.
    if (isCameraFlipped === 0) x = 4 * this.thread.x;
    else x = 4 * (this.constants.width - this.thread.x);

    // Input image data is an integer between 0 to 255, but should return float between 0 to 1.
    return imageData[x + y + z] / 256;
});

// Kernel: Embossed filter
const createEmbossedFilter = createStandardKernel(function(A) {
    if (
        this.thread.y > 0 &&
        this.thread.y < this.constants.height - 1 &&
        this.thread.x < this.constants.width - 1 &&
        this.thread.x > 0 &&
        this.thread.z < this.constants.channels
    ) {
        var c =
            A[this.thread.z][this.thread.y - 1][this.thread.x - 1] * -1 +
            A[this.thread.z][this.thread.y][this.thread.x - 1] * -2 +
            A[this.thread.z][this.thread.y + 1][this.thread.x - 1] * -1 +
            A[this.thread.z][this.thread.y - 1][this.thread.x + 1] +
            A[this.thread.z][this.thread.y][this.thread.x + 1] * 2 +
            A[this.thread.z][this.thread.y + 1][this.thread.x + 1];
        var d =
            A[this.thread.z][this.thread.y - 1][this.thread.x - 1] * -1 +
            A[this.thread.z][this.thread.y - 1][this.thread.x] * -2 +
            A[this.thread.z][this.thread.y - 1][this.thread.x + 1] * -1 +
            A[this.thread.z][this.thread.y + 1][this.thread.x - 1] +
            A[this.thread.z][this.thread.y + 1][this.thread.x] * 2 +
            A[this.thread.z][this.thread.y + 1][this.thread.x + 1];
        return c + d + 0.5;
    } else {
        return A[this.thread.z][this.thread.y][this.thread.x];
    }
});

// Kernel: Gaussian filter (5x5 kernel)
const createGaussianFilter = createStandardKernel(function(A, sigma, k00, k01, k02, k11, k12, k22) {
    if (
        this.thread.y > 1 &&
        this.thread.y < this.constants.height - 2 &&
        this.thread.x < this.constants.width - 2 &&
        this.thread.x > 1 &&
        this.thread.z < this.constants.channels
    ) {
        // Calculate the sum of all terms for a 5x5 kernel.
        var gaussianSum = k00 + (k01 + k02 + k11 + k22) * 4 + k12 * 8;

        // Calculate the result by convolving with the 5x5 kernel.
        var g =
            k00 * A[this.thread.z][this.thread.y][this.thread.x] +
            k01 *
                (A[this.thread.z][this.thread.y - 1][this.thread.x] +
                    A[this.thread.z][this.thread.y][this.thread.x - 1] +
                    A[this.thread.z][this.thread.y][this.thread.x + 1] +
                    A[this.thread.z][this.thread.y + 1][this.thread.x]) +
            k02 *
                (A[this.thread.z][this.thread.y - 2][this.thread.x] +
                    A[this.thread.z][this.thread.y][this.thread.x - 2] +
                    A[this.thread.z][this.thread.y][this.thread.x + 2] +
                    A[this.thread.z][this.thread.y + 2][this.thread.x]) +
            k11 *
                (A[this.thread.z][this.thread.y - 1][this.thread.x - 1] +
                    A[this.thread.z][this.thread.y - 1][this.thread.x + 1] +
                    A[this.thread.z][this.thread.y + 1][this.thread.x - 1] +
                    A[this.thread.z][this.thread.y + 1][this.thread.x + 1]) +
            k12 *
                (A[this.thread.z][this.thread.y - 2][this.thread.x - 1] +
                    A[this.thread.z][this.thread.y - 2][this.thread.x + 1] +
                    A[this.thread.z][this.thread.y - 1][this.thread.x - 2] +
                    A[this.thread.z][this.thread.y - 1][this.thread.x + 2] +
                    A[this.thread.z][this.thread.y + 1][this.thread.x - 2] +
                    A[this.thread.z][this.thread.y + 1][this.thread.x + 2] +
                    A[this.thread.z][this.thread.y + 2][this.thread.x - 1] +
                    A[this.thread.z][this.thread.y + 2][this.thread.x + 1]) +
            k22 *
                (A[this.thread.z][this.thread.y - 2][this.thread.x - 2] +
                    A[this.thread.z][this.thread.y - 2][this.thread.x + 2] +
                    A[this.thread.z][this.thread.y + 2][this.thread.x - 2] +
                    A[this.thread.z][this.thread.y + 2][this.thread.x + 2]);

        // Renormalize the result so that the sum of all terms in the kernel is 1.
        return g / gaussianSum;
    } else {
        return A[this.thread.z][this.thread.y][this.thread.x];
    }
});

// Kernel: Thresholding filter
const createThresholdingFilter = createStandardKernel(function(A, threshold, mode) {
    var r = A[0][this.thread.y][this.thread.x];
    var g = A[1][this.thread.y][this.thread.x];
    var b = A[2][this.thread.y][this.thread.x];

    // Use HSP color model to calculate perceived lightness.
    // @see http://alienryderflex.com/hsp.html
    var brightness = Math.sqrt(0.299 * r * r + 0.587 * g * g + 0.114 * b * b);

    // THRESH_BINARY
    if (mode === 0) {
        if (brightness < threshold) return 0;
        else return 1;
    }

    // THRESH_BINARY_INV
    if (mode === 1) {
        if (brightness < threshold) return 1;
        else return 0;
    }

    // THRESH_TRUNC
    if (mode === 2) {
        if (brightness < threshold) return A[this.thread.z][this.thread.y][this.thread.x];
        else return 1;
    }

    // THRESH_TOZERO
    if (mode === 3) {
        if (brightness < threshold) return 0;
        else return A[this.thread.z][this.thread.y][this.thread.x];
    }

    // THRESH_TOZERO_INV
    if (mode === 4) {
        if (brightness < threshold) return A[this.thread.z][this.thread.y][this.thread.x];
        else return 0;
    }
});

// Kernel: Edge detection (Sobel) filter
const createEdgeDetectionFilter = createStandardKernel(function(A) {
    if (
        this.thread.y > 0 &&
        this.thread.y < this.constants.height - 1 &&
        this.thread.x < this.constants.width - 1 &&
        this.thread.x > 0 &&
        this.thread.z < this.constants.channels
    ) {
        var Gx =
            A[this.thread.z][this.thread.y - 1][this.thread.x - 1] +
            A[this.thread.z][this.thread.y - 1][this.thread.x + 1] * -1 +
            A[this.thread.z][this.thread.y][this.thread.x - 1] * 2 +
            A[this.thread.z][this.thread.y][this.thread.x + 1] * -2 +
            A[this.thread.z][this.thread.y + 1][this.thread.x - 1] +
            A[this.thread.z][this.thread.y + 1][this.thread.x + 1] * -1;

        var Gy =
            A[this.thread.z][this.thread.y - 1][this.thread.x - 1] +
            A[this.thread.z][this.thread.y - 1][this.thread.x] * 2 +
            A[this.thread.z][this.thread.y - 1][this.thread.x + 1] +
            A[this.thread.z][this.thread.y + 1][this.thread.x - 1] * -1 +
            A[this.thread.z][this.thread.y + 1][this.thread.x] * -2 +
            A[this.thread.z][this.thread.y + 1][this.thread.x + 1] * -1;

        return Math.sqrt(Gx * Gx + Gy * Gy);
    } else {
        return A[this.thread.z][this.thread.y][this.thread.x];
    }
});

// Kernel: Light tunnel (Apple Photo Booth effect)
const createLightTunnelFilter = createStandardKernel(
    function(A, radius) {
        // Calculate if pixel falls within circle.
        // Don't use floor() because it's unnecessary (division by 2).
        var midpointX = this.constants.width / 2 - 0.5 * (this.constants.width % 2);
        var midpointY = this.constants.height / 2 - 0.5 * (this.constants.height % 2);

        // Calculate Pythagorean distance (squared to avoid costly sqrt).
        var radiusSquared = radius * radius;
        var distSquared =
            (this.thread.x - midpointX) * (this.thread.x - midpointX) + (this.thread.y - midpointY) * (this.thread.y - midpointY);

        // Return actual pixel if it falls within the circle.
        if (distSquared <= radiusSquared) {
            return A[this.thread.z][this.thread.y][this.thread.x];
        } else {
            // Otherwise, get the pixel at the border of the circle, using trigonometry.
            var opp = midpointY - this.thread.y;
            var adj = midpointX - this.thread.x;
            var angle = atan2(opp, adj);

            var x = midpointX - Math.floor(radius * Math.cos(angle));
            var y = midpointY - Math.floor(radius * Math.sin(angle));

            // Return the new pixel.
            return A[this.thread.z][y][x];
        }
    },
    { atan2 }
);

// Kernel: Renders a 3-D array into a 2-D graphic array via a Canvas.
const createRenderGraphical = mode =>
    getKernelCreator(mode)
        .createKernel(function(A) {
            this.color(A[0][this.thread.y][this.thread.x], A[1][this.thread.y][this.thread.x], A[2][this.thread.y][this.thread.x], 1);
        })
        .setGraphical(true)
        .setOutput([width, height]);

/// ----------------------
/// END KERNEL DEFINITIONS
/// ----------------------
/// START CUSTOM FUNCTIONS
/// ----------------------

// Polyfill for Math.atan2().
// Formula: https://en.wikipedia.org/wiki/Atan2#Definition_and_computation
function atan2(y, x) {
    var angle;
    var PI = this.constants.PI;

    if (x > 0) {
        angle = Math.atan(y / x);
    } else if (x < 0) {
        if (y >= 0) {
            angle = Math.atan(y / x) + PI;
        } else {
            angle = Math.atan(y / x) - PI;
        }
    } else {
        if (y > 0) {
            angle = PI / 2;
        } else {
            angle = PI / -2;
        }
    }

    return angle;
}

/// --------------------
/// END CUSTOM FUNCTIONS
/// --------------------

// Create dictionary of kernels for both CPU and GPU.
// Necessary because `.mode()` is missing in V1 gpu.js.
const gpuKernels = {
    transformLinearToXYZ: createTransformLinearToXYZ('gpu'),
    embossedFilter: createEmbossedFilter('gpu'),
    gaussianFilter: createGaussianFilter('gpu'),
    thresholdingFilter: createThresholdingFilter('gpu'),
    edgeDetectionFilter: createEdgeDetectionFilter('gpu'),
    lightTunnelFilter: createLightTunnelFilter('gpu'),
    renderGraphical: createRenderGraphical('gpu'),
};

const cpuKernels = {
    transformLinearToXYZ: createTransformLinearToXYZ('cpu'),
    embossedFilter: createEmbossedFilter('cpu'),
    gaussianFilter: createGaussianFilter('cpu'),
    thresholdingFilter: createThresholdingFilter('cpu'),
    edgeDetectionFilter: createEdgeDetectionFilter('cpu'),
    lightTunnelFilter: createLightTunnelFilter('cpu'),
    renderGraphical: createRenderGraphical('gpu'), // Cannot render graphical using 'cpu' mode
};

// Convenience method to fetch the kernel creator.
function getKernelCreator(mode) {
    return mode === 'gpu' ? gpu : cpu;
}

// Convenience method to create a kernel creator method, using the
// standard options of output size and pipelining to texture.
function createStandardKernel(kernelFunc, customFunctions) {
    return mode =>
        getKernelCreator(mode).createKernel(kernelFunc, {
            constants: {
                isGpu: mode === 'gpu' ? 1 : 0,
                width,
                height,
                channels,
                PI: Math.PI,
                E: Math.E,
            },
            output: [width, height, channels],
            outputToTexture: true,
            functions: customFunctions,
        });
}

// Convenience method to fetch the kernel by name based on
// the current GPU mode global state.
function getKernel(kernelName) {
    const kernels = state.isGpuMode ? gpuKernels : cpuKernels;
    return kernels[kernelName];
}
