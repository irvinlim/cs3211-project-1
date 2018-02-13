
   var selection = 0;
   var filtering = 0;
   var counter = 0;

   function change( el ) {
      if ( el.value === "Using CPU" ) {
         selection = 1;
         el.value = "Using GPU";
      } else {
         selection = 0;
         el.value = "Using CPU";
      }
   }
   function changeFilter( el ) {
      if ( el.value === "Filtering" ) {
         filtering = 1;
         el.value = "No Filter";
      } else {
         filtering = 0;
         el.value = "Filtering";
      }
   }



