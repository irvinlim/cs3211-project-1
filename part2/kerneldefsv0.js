
   var gpu = new GPU();

   function sqr(x) {
      return x*x;
   }
   function dist(x1,y1,x2,y2) {
      return Math.sqrt( sqr(x2-x1)+sqr(y2-y1) );
   }

   gpu.addFunction(sqr);
   gpu.addFunction(dist);

   function makeImg(mode) {
      var opt = {
         dimensions: [800, 600, 4],
         debug: true,
         graphical: false,
         outputToTexture: true,
         mode: mode
      };

      // Transform linear array of image data (1 pixel every 4 elements),
      // as well as inverted vertically.
      var y = gpu.createKernel(function(img) {
        var x = 4 * this.thread.x;
        var y = 4 * 800 * (600 - this.thread.y);
        var z = this.thread.z;

        return img[x + y + z] / 256;
      }, opt);
      return y;
   }

   var toimg = gpu.createKernel(function(A) {
    this.color(A[0][this.thread.y][this.thread.x],A[1][this.thread.y][this.thread.x],A[2][this.thread.y][this.thread.x]);
   }).dimensions([800, 600]).graphical(true);

  function makeFilter(mode) {
      var opt = {
         dimensions: [800, 600, 4],
         debug: true,
         graphical: false,
         outputToTexture: true,
         mode: mode
      };
      var filt = gpu.createKernel(function(A) {
        if (this.thread.y > 0 && this.thread.y < 600-2 && this.thread.x < 800-2 && this.thread.x >0 && this.thread.z <3) {
             var c = A[this.thread.z][this.thread.y-1][this.thread.x-1]*-1 +
                     A[this.thread.z][this.thread.y][this.thread.x-1]*-2 +
                     A[this.thread.z][this.thread.y+1][this.thread.x-1]*-1 +
//                     A[this.thread.z][this.thread.y-1][this.thread.x]*-1 +
//                     A[this.thread.z][this.thread.y][this.thread.x]*9 +
//                     A[this.thread.z][this.thread.y+1][this.thread.x]*-1 +
                     A[this.thread.z][this.thread.y-1][this.thread.x+1] +
                     A[this.thread.z][this.thread.y][this.thread.x+1]*2 +
                     A[this.thread.z][this.thread.y+1][this.thread.x+1];
             var d = A[this.thread.z][this.thread.y-1][this.thread.x-1]*-1 +
                     A[this.thread.z][this.thread.y-1][this.thread.x]*-2 +
                     A[this.thread.z][this.thread.y-1][this.thread.x+1]*-1 +
//                     A[this.thread.z][this.thread.y-1][this.thread.x]*-1 +
//                     A[this.thread.z][this.thread.y][this.thread.x]*9 +
//                     A[this.thread.z][this.thread.y+1][this.thread.x]*-1 +
                     A[this.thread.z][this.thread.y+1][this.thread.x-1] +
                     A[this.thread.z][this.thread.y+1][this.thread.x]*2 +
                     A[this.thread.z][this.thread.y+1][this.thread.x+1];
                 return (c+d)+1 / 2;
          } else {
             return A[this.thread.z][this.thread.y][this.thread.x];
          }
   },opt);
      return filt;
   }


