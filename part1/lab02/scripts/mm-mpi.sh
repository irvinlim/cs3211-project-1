#!/bin/bash

set -e

MACHINEFILES=(1 2 4 8 16)

for m in $MACHINEFILES; do
    echo "Using machinefile.$m:";
    echo "=====================";

    for i in `seq 1 8`; do 
        np="$(($i * 8))"
        echo "Running on $np procesors:"; 
        echo "";

        for j in `seq 1 3`; do 
            time mpirun --oversubscribe -np $np -machinefile "machinefile.$m" ./mm-mpi; 
        done; 
    done;
done;
