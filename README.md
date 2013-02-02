[![build status](https://secure.travis-ci.org/lmaccherone/tzTime.png)](http://travis-ci.org/lmaccherone/tzTime)
# tzTime #

Copyright (c) 2009-2013, Lawrence S. Maccherone, Jr.

_Timezone transformations in the browser and node.js plus timezone precise timeline creation for charting._

## Features ##

* Create time-series axis for charts
  * Knockout weekends, holidays, non-workhours
  * Work with timezone precision
  * Work in any granularity
    * Year, quarter, week, day, hour, etc.
    * No more recording `2012-03-05T00:00:00.000Z` when you really just mean `2012-03-05`
    * Create and use custom granularities: `R02I04-07` = Seventh day of fourth iteration in second release
* Tested - Over 300 tests
* [Documented](http://lmaccherone.github.com/tzTime/docs/tzTimes-docs/index.html) - Robust documentation for an open source library
* [DocTested](https://github.com/lmaccherone/coffeedoctest) - The examples will always match the code because it fails automated testing
   when they don't

## Credits ##

Authors:

* [Larry Maccherone](http://maccherone.com)
* Jennifer Maccherone

Used when running:

* [timezoneJS](https://github.com/mde/timezone-js) - library for [tz file](http://www.twinsun.com/tz/tz-link.htm) parsing. Although I haven't touched the actual tz file parsing code, I have modified timezoneJS fairly significantly. The original included a drop-in replacement for JavaScript's Date object which I have removed. I also modified it to work on node.js and in the browser once "browserified" by bundling the tz files.

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

To use in a browser, either host it on your own site, or if your volume is low enough, you can directly hit the github pages for the deploy version:

`<script type="text/javascript" src="https://raw.github.com/lmaccherone/Lumenize/v{{version}}/deploy/Lumenize-min.js"></script>`

Replace `{{version}}` with the version of tzTime you wish to use (probably the latest). See the Changelog section for information about versions. Example:

`<script type="text/javascript" src="https://raw.github.com/lmaccherone/tzTime/v0.6.0/deploy/tzTime-min.js"></script>`

The package is fairly large ~205KB but most of that is the embedded timezone files which compress really well. The Github pages server will gzip the package so it's only ~45KB over the wire.

Then at the top of the javascript where you want to call it, put the following:

`var tzTime = require('./tzTime');`

Then to use it, you can either create local aliases like:

`var Time = tzTime.Time;`

or you can just use the tzTime namespace:

`var timeline = new tzTime.Time();`
    
## Installation for node.js usage ##

To install, run the following from the root folder of your project:

`npm install tzTime --save`

## Documentation and source code ##

* [API Documentation](http://lmaccherone.github.com/tzTime/docs/tzTime-docs/index.html)
* [Source Repository](https://github.com/lmaccherone/tzTime)

## Changelog ##

* 0.6.0 - 2013-02-03 Original version when first broken out from [Lumenize](http://lmaccherone.github.com/Lumenize)

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





