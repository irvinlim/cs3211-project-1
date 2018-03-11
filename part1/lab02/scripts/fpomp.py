#!/usr/bin/env python

"""
CS3211 Lab 2 Task 4

Script to find the largest error margin from running
fpomp several times.
"""

from subprocess import Popen, PIPE
import re

largest_error_margin = 0

for power in range(1, 100):
    # Run process.
    process = Popen(['./fpomp'], stderr=PIPE, stdout=PIPE)
    output = process.communicate()

    # Extract timing from string.
    pattern = 'Final sum is ([0-9.]*)\n'
    rx = re.compile(pattern)
    matches = rx.findall(output[0])

    if not matches:
        print("Error: No match")
        print(output)
        quit()

    sums = [float(sum) for sum in matches]
    margin = max(sums) - min(sums)
    largest_error_margin = max(margin, largest_error_margin)

print("Largest error margin found after 100 runs is %f" % largest_error_margin)
