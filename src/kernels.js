const gpu = new GPU();
const cpu = new GPU({ mode: 'cpu' });

/// ------------------------
/// START KERNEL DEFINITIONS
/// ------------------------

// Kernel: Transforms a linear array of image data into (x,y) data in 4 channels,
// resulting in a 3-D array.
const createTransformLinearToXYZ = createStandardKernel(function(imageData) {
    // Image's color channel is every 4 elements (R, G, B, A). Omit every 4th element.
    // Input image data is y-inverted so we need to read from bottom up.
    // Input image data is an integer between 0 to 255, but should return float between 0 to 1.

    var x = 4 * this.thread.x;
    var y = 4 * this.constants.width * (this.constants.height - this.thread.y - 1);
    var z = this.thread.z;

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

// Kernel: Gaussian filter (5x5, sigma = 10.0)
const createGaussianFilter = createStandardKernel(function(A) {
    if (
        this.thread.y > 1 &&
        this.thread.y < this.constants.height - 2 &&
        this.thread.x < this.constants.width - 2 &&
        this.thread.x > 1 &&
        this.thread.z < this.constants.channels
    ) {
        return (
            A[this.thread.z][this.thread.y - 2][this.thread.x - 2] * 0.039206 +
            A[this.thread.z][this.thread.y - 2][this.thread.x - 1] * 0.039798 +
            A[this.thread.z][this.thread.y - 2][this.thread.x] * 0.039997 +
            A[this.thread.z][this.thread.y - 2][this.thread.x + 1] * 0.039798 +
            A[this.thread.z][this.thread.y - 2][this.thread.x + 2] * 0.039206 +
            A[this.thread.z][this.thread.y - 1][this.thread.x - 2] * 0.039798 +
            A[this.thread.z][this.thread.y - 1][this.thread.x - 1] * 0.040399 +
            A[this.thread.z][this.thread.y - 1][this.thread.x] * 0.040601 +
            A[this.thread.z][this.thread.y - 1][this.thread.x + 1] * 0.040399 +
            A[this.thread.z][this.thread.y - 1][this.thread.x + 2] * 0.039798 +
            A[this.thread.z][this.thread.y][this.thread.x - 2] * 0.039997 +
            A[this.thread.z][this.thread.y][this.thread.x - 1] * 0.040601 +
            A[this.thread.z][this.thread.y][this.thread.x] * 0.040804 +
            A[this.thread.z][this.thread.y][this.thread.x + 1] * 0.040601 +
            A[this.thread.z][this.thread.y][this.thread.x + 2] * 0.039997 +
            A[this.thread.z][this.thread.y + 1][this.thread.x - 2] * 0.039798 +
            A[this.thread.z][this.thread.y + 1][this.thread.x - 1] * 0.040399 +
            A[this.thread.z][this.thread.y + 1][this.thread.x] * 0.040601 +
            A[this.thread.z][this.thread.y + 1][this.thread.x + 1] * 0.040399 +
            A[this.thread.z][this.thread.y + 1][this.thread.x + 2] * 0.039798 +
            A[this.thread.z][this.thread.y + 2][this.thread.x - 2] * 0.039206 +
            A[this.thread.z][this.thread.y + 2][this.thread.x - 1] * 0.039798 +
            A[this.thread.z][this.thread.y + 2][this.thread.x] * 0.039997 +
            A[this.thread.z][this.thread.y + 2][this.thread.x + 1] * 0.039798 +
            A[this.thread.z][this.thread.y + 2][this.thread.x + 2] * 0.039206
        );
    } else {
        return A[this.thread.z][this.thread.y][this.thread.x];
    }
});

// Kernel: Edge detection (Sobel) filter
const createEdgeDetectionFilter = createStandardKernel(function(A, level) {
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
const createLightTunnelFilter = createStandardKernel(function(A, radius) {
    // Calculate if pixel falls within circle.
    // Don't use floor() because it's unnecessary (division by 2).
    var midpointX = this.constants.width / 2 - 0.5 * (this.constants.width % 2);
    var midpointY = this.constants.height / 2 - 0.5 * (this.constants.height % 2);

    // Calculate Pythagorean distance (squared to avoid costly sqrt).
    var radiusSquared = radius * radius;
    var distSquared =
        (this.thread.x - midpointX) * (this.thread.x - midpointX) +
        (this.thread.y - midpointY) * (this.thread.y - midpointY);

    // Return actual pixel if it falls within the circle.
    if (distSquared <= radiusSquared) {
        return A[this.thread.z][this.thread.y][this.thread.x];
    }

    // Otherwise, get the pixel at the border of the circle, using trigonometry.
    var angle = Math.atan(midpointY - this.thread.y, midpointX - this.thread.x);
    var x = midpointX - Math.floor(radius * Math.cos(angle));
    var y = midpointY - Math.floor(radius * Math.sin(angle));

    // Return the new pixel.
    return A[this.thread.z][y][x];
});

// Kernel: Renders a 3-D array into a 2-D graphic array via a Canvas.
const createRenderGraphical = mode =>
    getKernelCreator(mode)
        .createKernel(function(A) {
            this.color(
                A[0][this.thread.y][this.thread.x],
                A[1][this.thread.y][this.thread.x],
                A[2][this.thread.y][this.thread.x],
                1
            );
        })
        .setGraphical(true)
        .setOutput([width, height]);

/// ----------------------
/// END KERNEL DEFINITIONS
/// ----------------------

// Create dictionary of kernels for both CPU and GPU.
// Necessary because `.mode()` is missing in V1 gpu.js.
const gpuKernels = {
    transformLinearToXYZ: createTransformLinearToXYZ('gpu'),
    embossedFilter: createEmbossedFilter('gpu'),
    gaussianFilter: createGaussianFilter('gpu'),
    edgeDetectionFilter: createEdgeDetectionFilter('gpu'),
    lightTunnelFilter: createLightTunnelFilter('gpu'),
    renderGraphical: createRenderGraphical('gpu'),
};

const cpuKernels = {
    transformLinearToXYZ: createTransformLinearToXYZ('cpu'),
    embossedFilter: createEmbossedFilter('cpu'),
    gaussianFilter: createGaussianFilter('cpu'),
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
function createStandardKernel(kernelFunc) {
    return mode =>
        getKernelCreator(mode).createKernel(kernelFunc, {
            constants: {
                isGpu: mode === 'gpu' ? 1 : 0,
                width,
                height,
                channels,
            },
            output: [width, height, channels],
            outputToTexture: true,
        });
}

// Convenience method to fetch the kernel by name based on
// the current GPU mode global state.
function getKernel(kernelName) {
    const kernels = state.isGpuMode ? gpuKernels : cpuKernels;
    return kernels[kernelName];
}
