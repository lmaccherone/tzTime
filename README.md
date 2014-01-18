[![build status](https://travis-ci.org/lmaccherone/tzTime.png?branch=master)](http://travis-ci.org/lmaccherone/tzTime)
# tzTime #

Copyright (c) 2009-2013, Lawrence S. Maccherone, Jr.

_Timezone transformations in the browser and node.js plus timezone precise timeline creation for charting._

## Features ##

* Transform into and out of any timezone using Olson timezone rules
* Timezone rule files embedded in the minified browser package. No need to host them
  seperately.
* Create timezone precise time-series axis for charts

  * Knockout weekends, holidays, non-workhours
  * Work with timezone precision
  * Work in any granularity

    * Year, quarter, week, day, hour, etc.
    * No more recording `2012-03-05T00:00:00.000Z` when you really just mean `2012-03-05`
    * Create and use custom granularities: `R02I04-07` = Seventh day of fourth iteration in
      second release

* Tested - Over 450 tests
* [Documented](http://lmaccherone.github.com/tzTime/docs/tztime-docs/index.html) - Robust
  documentation
* [DocTested](https://github.com/lmaccherone/coffeedoctest) - The examples will always match
  the code because it fails automated testing when they don't

## Credits ##

Authors:

* [Larry Maccherone](http://maccherone.com)
* Jennifer Maccherone

Used when running:

* [timezoneJS](https://github.com/mde/timezone-js) - library for Olson
  [tz file](http://www.twinsun.com/tz/tz-link.htm) parsing.  Although I haven't touched the
  actual tz file parsing code, I have modified timezoneJS fairly significantly. The original 
  included a drop-in replacement for JavaScript's Date object which I have removed. I also 
  modified it to work on node.js and in the browser once "browserified" by bundling the tz 
  files.

Used when developing:

* [Node.js](http://nodejs.org/)
* [CoffeeScript](http://coffeescript.org/)
* [coffeedoctest](https://github.com/lmaccherone/coffeedoctest) (by Larry Maccherone)
* [nodeunit](https://github.com/caolan/nodeunit)
* [browserify with fileify plugin (modified)](https://github.com/substack/node-browserify)
* [uglify-js](https://github.com/mishoo/UglifyJS)
* [wrench](https://github.com/ryanmcgrath/wrench-js)
* [marked](https://github.com/chjj/marked)

## Using from a browser ##

If you are using Lumenize, you don't need to do anything. The browser package for Lumenize includes tzTime. If you just
want to use tzTime without Lumenize, then you can either host it on your own site.

Then:

`var tzTime = require('./tzTime');`
`var timeline = new tzTime.Timeline({startOn:'2012-01', endBefore:'2013-01'});`
    
## Installation for node.js usage ##

To install, run the following from the root folder of your project:

`npm install tzTime --save`

## Installation for development ##

The documentation system uses jsduck so you'll need to install that like this:

`[sudo] gem install jsduck`

## Documentation and source code ##

* [API Documentation](http://lmaccherone.github.com/tzTime/docs/tztime-docs/index.html)
* [Source Repository](https://github.com/lmaccherone/tzTime)

## Changelog ##

* 0.6.12 - 2014-01-18 Updated to the latest coffee-script and jsduck
* 0.6.11 - 2013-08-30 Stopped doing chdir in timezone.js because it was breaking other uses
* 0.6.10 - 2013-04-24 Restoring timezone-js.js that was removed with .gitignore
* 0.6.9 - 2013-04-24 Fixed side effect bug issue #2
* 0.6.8 - 2013-04-24 Uses JSON2 for IE7 compatibility
* 0.6.6 - 2013-02-14 Updated to latest version of jsduckify
* 0.6.5 - 2012-02-09 Documention fixes
* 0.6.4 - 2013-02-07 Timezone is safely ignored when sending in strings without 'Z' at the 
  end. Also, made it an error to send in timeshifted string formats like '...+01:00'. 
* 0.6.3 - 2013-02-07 Made it an error to instantiate a Time object with an ISOString without a 
  timezone. Also, ignore timezone when sending a string without the ending 'Z' or '+01:00'
* 0.6.2 - 2013-02-03 Expose utils for Lumenize usage
* 0.6.1 - 2013-02-03 Fix Travis-CI badge
* 0.6.0 - 2013-02-02 Original version when first broken out from [Lumenize](http://lmaccherone.github.com/Lumenize)

## MIT License ##

Copyright (c) 2011, 2012, 2013 Lawrence S. Maccherone, Jr.

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated 
documentation files (the "Software"), to deal in the Software without restriction, including without limitation 
the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and 
to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED 
TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL 
THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF 
CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS 
IN THE SOFTWARE.





