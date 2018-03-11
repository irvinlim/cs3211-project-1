#!/usr/bin/env python

"""
CS3211 Lab 1: Computing Gustafson Speedup

Script for iteratively testing the work done as reported
by count-mm-shmem, followed by testing the execution time
of performing the same amount of work (matrix mult.) using
a single core, rounded off as the cube root of the reported
cells that could be computed.

Meant to be run on the SoC Tembusu compute cluster, which takes
the readings from 1 to 40 threads. Readings are taken as the
best of 3.
"""

from subprocess import Popen, PIPE
import re

# The fixed time (in ms) to estimate how much work can be done within.
FIXED_TIME_MS = 100

# The size of the matrix to use for fixed time calculation.
INITIAL_DIM = 2048

# Record all the results in a single array.
all_num_threads = []
all_num_tasks = []
all_dimensions = []
all_timings = []
all_timings_multicore = []
all_speedups = []


def run_extract(dim, threads, timelimit, pattern):
    process = Popen(['./count-mm-shmem', str(dim), str(threads),
                     str(timelimit)], stderr=PIPE, stdout=PIPE)
    output = process.communicate()
    match = re.search(pattern, output[1])

    if not match:
        print("Error: No match")
        print(output)
        quit()

    return match.groups()[0]


def get_max_tasks(dim, threads, timelimit):
    pattern = 'A total of ([0-9.]*) tasks could be completed'
    tasks = []

    for _ in range(3):
        tasks.append(int(run_extract(dim, threads, timelimit, pattern)))

    return max(tasks)


def get_min_timing(dim, threads, timelimit):
    pattern = 'Matrix multiplication took ([0-9.]*) seconds'
    timings = []

    for _ in range(3):
        timings.append(float(run_extract(dim, threads, timelimit, pattern)))

    return min(timings)


for i in range(1, 41):
    print("Using %d threads:" % i)
    all_num_threads.append(i)

    # Get the maximum of the tasks that can be done.
    max_num_tasks = get_max_tasks(INITIAL_DIM, i, FIXED_TIME_MS)
    print("  N = %d" % max_num_tasks)
    all_num_tasks.append(max_num_tasks)

    # Take the cube root to calculate the matrix dimension
    # that should be used for the single thread computation.
    matrix_dim = int(round(max_num_tasks ** (1. / 3)))
    print("  Dim = %d" % matrix_dim)
    all_dimensions.append(matrix_dim)

    # Now compute time(N, 1) such that we do the same
    # amount of tasks but only using 1 processor with no time limit.
    min_timing = get_min_timing(matrix_dim, 1, -1)
    all_timings.append(min_timing)
    print("  time(N, 1) = %f" % min_timing)

    # Because of memory effects, time(N, 1) is not the same as T.
    # Measure the actual T to be used for speedup computation here.
    min_timing_multicore = get_min_timing(matrix_dim, i, -1)
    all_timings_multicore.append(min_timing_multicore)
    print("  time(N, %d) = %f" % (i, min_timing_multicore))

    # Count speedup.
    speedup = min_timing / min_timing_multicore
    all_speedups.append(speedup)
    print("  Speedup = %f" % speedup)

    print("")

print("%s\n\nTabulated:\n" % ("=" * 79))

row_format = "| {:^10} | {:^10} | {:^10} | {:^10} | {:^10} | {:^10} |"
print(row_format.format("Thread", "N", "Dimension", "time(N, 1)", "time(N, P)", "Speedup"))
print("-" * 79)
row_format = "| {:>10} | {:>10} | {:>10} | {:>10.4f} | {:>10.4f} | {:>10.4f} |"
for i, task, dim, timing, multicore, speedup in zip(all_num_threads, all_num_tasks, all_dimensions, all_timings, all_timings_multicore, all_speedups):
    print(row_format.format(i, task, dim, timing, multicore, speedup))

print("\n%s\n\nCSV:\n" % ("=" * 79))

for i, task, dim, timing, multicore, speedup in zip(all_num_threads, all_num_tasks, all_dimensions, all_timings, all_timings_multicore, all_speedups):
    print("%d,%d,%d,%f,%f,%f" % (i, task, dim, timing, multicore, speedup))
