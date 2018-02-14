const gpu = new GPU();
const cpu = new GPU({ mode: 'cpu' });

/// ------------------------
/// START KERNEL DEFINITIONS
/// ------------------------

// Kernel: Transforms a linear array of image data into (x,y) data in 4 channels,
// resulting in a 3-D array.
const createTransformLinearToXYZ = kernelCreator =>
    kernelCreator
        .createKernel(function(imageData, width, height) {
            // Image's color channel is every 4 elements (R, G, B, A).
            // Input image data is y-inverted so we need to read from bottom up.
            // Input image data is an integer between 0 to 255, but should return float between 0 to 1.

            var x = 4 * this.thread.x;
            var y = 4 * width * (height - this.thread.y - 1);
            var z = this.thread.z;

            return imageData[x + y + z] / 256;
        })
        .setOutputToTexture(true)
        .setOutput([width, height, 4]);

// Kernel: Embossed filter
const createEmbossedFilter = kernelCreator =>
    kernelCreator
        .createKernel(function(A, width, height) {
            if (
                this.thread.y > 0 &&
                this.thread.y < height - 1 &&
                this.thread.x < width - 1 &&
                this.thread.x > 0 &&
                this.thread.z < 3
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
        })
        .setOutputToTexture(true)
        .setOutput([width, height, 4]);

// Kernel: Gaussian filter (5x5, sigma = 10.0)
const createGaussianFilter = kernelCreator =>
    kernelCreator
        .createKernel(function(A, width, height) {
            if (
                this.thread.y > 1 &&
                this.thread.y < height - 2 &&
                this.thread.x < width - 2 &&
                this.thread.x > 1 &&
                this.thread.z < 3
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
        })
        .setOutputToTexture(true)
        .setOutput([width, height, 4]);

// Kernel: Edge detection (Sobel) filter
const createEdgeDetectionFilter = kernelCreator =>
    kernelCreator
        .createKernel(function(A, width, height) {
            if (
                this.thread.y > 0 &&
                this.thread.y < height - 1 &&
                this.thread.x < width - 1 &&
                this.thread.x > 0 &&
                this.thread.z < 3
            ) {
                return (
                    A[this.thread.z][this.thread.y - 1][this.thread.x - 1] * -1 +
                    A[this.thread.z][this.thread.y - 1][this.thread.x + 1] +
                    A[this.thread.z][this.thread.y][this.thread.x - 1] * -2 +
                    A[this.thread.z][this.thread.y][this.thread.x + 1] * 2 +
                    A[this.thread.z][this.thread.y + 1][this.thread.x - 1] * -1 +
                    A[this.thread.z][this.thread.y + 1][this.thread.x + 1]
                );
            } else {
                return A[this.thread.z][this.thread.y][this.thread.x];
            }
        })
        .setOutputToTexture(true)
        .setOutput([width, height, 4]);

// Kernel: Light tunnel (Apple Photo Booth effect)
const createLightTunnelFilter = kernelCreator =>
    kernelCreator
        .createKernel(function(A, width, height, radius) {
            // Calculate if pixel falls within circle.
            // Don't use floor() because it's unnecessary (division by 2).
            var midpointX = width / 2 - 0.5 * (width % 2);
            var midpointY = height / 2 - 0.5 * (height % 2);

            // Calculate Pythagorean distance (squared to avoid costly sqrt).
            var radiusSquared = radius * radius;
            var distSquared =
                (this.thread.x - midpointX) * (this.thread.x - midpointX) +
                (this.thread.y - midpointY) * (this.thread.y - midpointY);

            // Return actual pixel if it falls within the circle.
            if (distSquared <= radiusSquared) {
                return A[this.thread.z][this.thread.y][this.thread.x];
            }

            // Otherwise, get the pixel at the border of the circle,
            // using trigonometry.
            var angle = atan(midpointY - this.thread.y, midpointX - this.thread.x);
            var x = midpointX - floor(radius * cos(angle));
            var y = midpointY - floor(radius * sin(angle));

            // Return the new pixel.
            return A[this.thread.z][y][x];
        })
        .setOutputToTexture(true)
        .setOutput([width, height, 4]);

// Kernel: Renders a 3-D array into a 2-D graphic array via a Canvas.
const createRenderGraphical = kernelCreator =>
    kernelCreator
        .createKernel(function(A) {
            this.color(
                A[0][this.thread.y][this.thread.x],
                A[1][this.thread.y][this.thread.x],
                A[2][this.thread.y][this.thread.x],
                A[3][this.thread.y][this.thread.x]
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
    transformLinearToXYZ: createTransformLinearToXYZ(gpu),
    embossedFilter: createEmbossedFilter(gpu),
    gaussianFilter: createGaussianFilter(gpu),
    edgeDetectionFilter: createEdgeDetectionFilter(gpu),
    lightTunnelFilter: createLightTunnelFilter(gpu),
    renderGraphical: createRenderGraphical(gpu),
};

const cpuKernels = {
    transformLinearToXYZ: createTransformLinearToXYZ(cpu),
    embossedFilter: createEmbossedFilter(cpu),
    gaussianFilter: createGaussianFilter(cpu),
    edgeDetectionFilter: createEdgeDetectionFilter(cpu),
    lightTunnelFilter: createLightTunnelFilter(cpu),
    renderGraphical: createRenderGraphical(gpu), // Cannot render graphical using 'cpu' mode
};

// Convenience method to fetch the kernel by name based on
// the current GPU mode global state.
function getKernel(kernelName) {
    const kernels = state.isGpuMode ? gpuKernels : cpuKernels;
    return kernels[kernelName];
}
