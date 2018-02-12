# CS3211 Project 1

This is a submission for CS3211 Parallel and Concurrent Programming, Project 1 (_Image Processing: Implementation and Analysis_).

This module was taken in AY 17/18, under A/P Hugh Anderson and Prof. John Gustafson.

## Instructions

This program runs in the browser, preferably on Google Chrome. As it requires access to the device's camera, it must be run on the `http` protocol instead of the `file` protocol.

The solution is to start a static HTTP server, such as Python 3's [`http.server`](https://docs.python.org/3/library/http.server.html) or in Node.js, [`http-server`](https://www.npmjs.com/package/http-server).

For `http.server` (Python 3):

```sh
cd src
python -m http.server
# Now open localhost:8000
```

Otherwise, for `http-server` (Node.js):

```sh
# Install http-server globally
npm i -g http-server
cd src
http-server
```
