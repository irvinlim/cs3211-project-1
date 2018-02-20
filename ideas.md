# Ideas

## Speedup ideas

- [x] Parallelize the conversion of 1-D array to 3-D array
- [ ] Work entirely in a 1-D array throughout
- [x] Omit alpha channel
- [ ] Try using `combineKernels()` again

## Benchmarking techniques

- Use simple timer code
- Chrome profiler + breakpoints
  - Calculate time to render one frame (end-to-end)
- Benchmark the following:
  1. `draw()` on CPU -> filter -> `toimg()`
  2. `draw()` on GPU -> filter -> `toimg()`

## Filter ideas

- [x] Embossing
- [x] Gaussian blur
- [x] Edge detection
- [x] Apple Photo Booth effects (light tunnel, swirl, etc.)
- [x] Simple thresholding (high/low pass) filters
- [ ] Adaptive thresholding
- [ ] Photoshop filters (brightness/contrast)
- [ ] Color filters (color remapping, hue/saturation/lightness)
- [ ] FFT to reduce noise in the image (<https://www.youtube.com/watch?v=YkC-YZSuWjE>)

## Image recognition

- Shape detection (find circles)
- Feature detection
- Object detection

## Feature ideas

- [x] Camera flip
- [x] Parameterizing filters
  - [x] Adjust width of Gaussian blur
  - [x] Adjust size of light tunnel
  - [x] ~~Adjust level of edge detection filter~~
  - [x] Adjust parameters for photo/color filters
- [x] Pipelining (reordering), for example:
  - Gausian Blur -> Sobel -> Thresholding (<http://www.ics.uci.edu/~majumder/DIP/classes/EdgeDetect.pdf>)
- [ ] Select image as target
- [ ] Multi-step kernels (maybe using `createKernelMap()`)

## References

- http://dsynflo.blogspot.sg/2014/10/opencv-qr-code-detection-and-extraction.html
- https://github.com/astorfi/QR_Code
- http://aishack.in/tutorials/scanning-qr-codes-extracting-bits/
- https://math.stackexchange.com/questions/296794/finding-the-transform-matrix-from-4-projected-points-with-javascript
