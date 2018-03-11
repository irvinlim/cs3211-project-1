#!/usr/bin/env python

import sys
import re
from argparse import ArgumentParser, FileType


def parse(text):
    processors = re.split(r'Running on \d* procesors:\n', text)[1:]

    all_comm_timings = []
    all_comp_timings = []
    all_real_timings = []

    # Iterate for each p.
    for tries in processors:
        times = re.split(r'user\s*[0-9m.]*s\nsys\s*[0-9m.]*s\n', tries)[:-1]

        comm_timings = []
        comp_timings = []
        real_timings = []

        # Iterate for each of the 3 tries.
        for time in times:
            slavetimes = re.split(r'\n ---', time)[1:]
            slave_comm_timings = []
            slave_comp_timings = []

            # Iterate for each of the slaves.
            for slavetime in slavetimes:
                timing = slavetime.strip()
                matches = re.match(
                    (r'SLAVE \d*: communication_time=\s*([0-9.]*) seconds; computation_time=\s*([0-9.]*) seconds'), timing)
                (comm_time, comp_time) = [float(string) for string in matches.groups()]
                slave_comm_timings.append(comm_time)
                slave_comp_timings.append(comp_time)

            # Find the maximum timing amongst all slaves.
            max_slave_comm_timing = max(slave_comm_timings)
            comm_timings.append(max_slave_comm_timing)
            max_slave_comp_timing = max(slave_comp_timings)
            comp_timings.append(max_slave_comp_timing)

            # Get the timer timing.
            match = re.search(r'real\s*0m([0-9.]*)s\n', time)
            real_timing = float(match.groups()[0])
            real_timings.append(real_timing)

        # Get the minimum of the peak comm/comp timings.
        all_comm_timings.append(min(comm_timings))
        all_comp_timings.append(min(comp_timings))
        all_real_timings.append(min(real_timings))

    # Print all timings.
    for comm, comp, real in zip(all_comm_timings, all_comp_timings, all_real_timings):
        print("%f %f %f" % (comm, comp, real))


def main():
    parser = ArgumentParser()
    parser.add_argument('infile', default=sys.stdin, type=FileType('r'))
    args = parser.parse_args()

    text = args.infile.read()
    parse(text)


if __name__ == "__main__":
    main()
