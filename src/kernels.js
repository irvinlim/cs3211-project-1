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
            var y = 4 * width * (height - this.thread.y);
            var z = this.thread.z;

            return imageData[x + y + z] / 256;
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
                A[2][this.thread.y][this.thread.x]
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
    renderGraphical: createRenderGraphical(gpu),
};

const cpuKernels = {
    transformLinearToXYZ: createTransformLinearToXYZ(cpu),
    renderGraphical: createRenderGraphical(gpu), // Cannot render graphical using 'cpu' mode
};

// Convenience method to fetch the kernel by name based on
// the current GPU mode global state.
function getKernel(kernelName) {
    const kernels = state.isGpuMode ? gpuKernels : cpuKernels;
    return kernels[kernelName];
}