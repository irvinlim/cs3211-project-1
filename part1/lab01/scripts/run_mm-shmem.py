#!/usr/bin/env python

"""
CS3211 Lab 1 Task 4

Script for iteratively testing the runtime of mm-shmem
on the SoC xcnc compute cluster, from 1 to 40 threads.
"""

from subprocess import Popen, PIPE
import re

# Matrix size should be from 128 to 2048.
for power in range(7, 12):
    size = 2 ** power
    print("Matrix multiplication of size %d" % size)

    # Record the fastest timing for all threads.
    all_timings = []

    # Iterate from 1 to 40.
    for i in range(40):
        timings = []
        num_threads = i + 1

        # Set the environment variable for modifying the number of threads.
        env_vars = {'OMP_NUM_THREADS': str(num_threads)}

        # Iterate 3 times for each number of thread.
        for _ in range(3):
            # Run process.
            process = Popen(['./mm-shmem', str(size)],
                            stderr=PIPE, stdout=PIPE, env=env_vars)
            output = process.communicate()

            # Extract timing from string.
            pattern = 'Matrix multiplication took ([0-9.]*) seconds\n'
            match = re.match(pattern, output[1])

            if not match:
                print("Error: No match")
                print(output)
                quit()

            time = match.groups()[0]
            timings.append(float(time))

        # Get the maximum of the timings.
        fastest_timing = min(timings)
        print("Using %d threads: %f" % (num_threads, fastest_timing))
        all_timings.append(fastest_timing)

    print(all_timings)
    print("")
