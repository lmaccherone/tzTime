/*
tztime version: 1.0.0
*/
var require = function (file, cwd) {
    var resolved = require.resolve(file, cwd || '/');
    var mod = require.modules[resolved];
    if (!mod) throw new Error(
        'Failed to resolve module ' + file + ', tried ' + resolved
    );
    var cached = require.cache[resolved];
    var res = cached? cached.exports : mod();
    return res;
};

require.paths = [];
require.modules = {};
require.cache = {};
require.extensions = [".js",".coffee",".json"];

require._core = {
    'assert': true,
    'events': true,
    'fs': true,
    'path': true,
    'vm': true
};

require.resolve = (function () {
    return function (x, cwd) {
        if (!cwd) cwd = '/';
        
        if (require._core[x]) return x;
        var path = require.modules.path();
        cwd = path.resolve('/', cwd);
        var y = cwd || '/';
        
        if (x.match(/^(?:\.\.?\/|\/)/)) {
            var m = loadAsFileSync(path.resolve(y, x))
                || loadAsDirectorySync(path.resolve(y, x));
            if (m) return m;
        }
        
        var n = loadNodeModulesSync(x, y);
        if (n) return n;
        
        throw new Error("Cannot find module '" + x + "'");
        
        function loadAsFileSync (x) {
            x = path.normalize(x);
            if (require.modules[x]) {
                return x;
            }
            
            for (var i = 0; i < require.extensions.length; i++) {
                var ext = require.extensions[i];
                if (require.modules[x + ext]) return x + ext;
            }
        }
        
        function loadAsDirectorySync (x) {
            x = x.replace(/\/+$/, '');
            var pkgfile = path.normalize(x + '/package.json');
            if (require.modules[pkgfile]) {
                var pkg = require.modules[pkgfile]();
                var b = pkg.browserify;
                if (typeof b === 'object' && b.main) {
                    var m = loadAsFileSync(path.resolve(x, b.main));
                    if (m) return m;
                }
                else if (typeof b === 'string') {
                    var m = loadAsFileSync(path.resolve(x, b));
                    if (m) return m;
                }
                else if (pkg.main) {
                    var m = loadAsFileSync(path.resolve(x, pkg.main));
                    if (m) return m;
                }
            }
            
            return loadAsFileSync(x + '/index');
        }
        
        function loadNodeModulesSync (x, start) {
            var dirs = nodeModulesPathsSync(start);
            for (var i = 0; i < dirs.length; i++) {
                var dir = dirs[i];
                var m = loadAsFileSync(dir + '/' + x);
                if (m) return m;
                var n = loadAsDirectorySync(dir + '/' + x);
                if (n) return n;
            }
            
            var m = loadAsFileSync(x);
            if (m) return m;
        }
        
        function nodeModulesPathsSync (start) {
            var parts;
            if (start === '/') parts = [ '' ];
            else parts = path.normalize(start).split('/');
            
            var dirs = [];
            for (var i = parts.length - 1; i >= 0; i--) {
                if (parts[i] === 'node_modules') continue;
                var dir = parts.slice(0, i + 1).join('/') + '/node_modules';
                dirs.push(dir);
            }
            
            return dirs;
        }
    };
})();

require.alias = function (from, to) {
    var path = require.modules.path();
    var res = null;
    try {
        res = require.resolve(from + '/package.json', '/');
    }
    catch (err) {
        res = require.resolve(from, '/');
    }
    var basedir = path.dirname(res);
    
    var keys = (Object.keys || function (obj) {
        var res = [];
        for (var key in obj) res.push(key);
        return res;
    })(require.modules);
    
    for (var i = 0; i < keys.length; i++) {
        var key = keys[i];
        if (key.slice(0, basedir.length + 1) === basedir + '/') {
            var f = key.slice(basedir.length);
            require.modules[to + f] = require.modules[basedir + f];
        }
        else if (key === basedir) {
            require.modules[to] = require.modules[basedir];
        }
    }
};

(function () {
    var process = {};
    var global = typeof window !== 'undefined' ? window : {};
    var definedProcess = false;
    
    require.define = function (filename, fn) {
        if (!definedProcess && require.modules.__browserify_process) {
            process = require.modules.__browserify_process();
            definedProcess = true;
        }
        
        var dirname = require._core[filename]
            ? ''
            : require.modules.path().dirname(filename)
        ;
        
        var require_ = function (file) {
            var requiredModule = require(file, dirname);
            var cached = require.cache[require.resolve(file, dirname)];

            if (cached && cached.parent === null) {
                cached.parent = module_;
            }

            return requiredModule;
        };
        require_.resolve = function (name) {
            return require.resolve(name, dirname);
        };
        require_.modules = require.modules;
        require_.define = require.define;
        require_.cache = require.cache;
        var module_ = {
            id : filename,
            filename: filename,
            exports : {},
            loaded : false,
            parent: null
        };
        
        require.modules[filename] = function () {
            require.cache[filename] = module_;
            fn.call(
                module_.exports,
                require_,
                module_,
                module_.exports,
                dirname,
                filename,
                process,
                global
            );
            module_.loaded = true;
            return module_.exports;
        };
    };
})();


require.define("path",function(require,module,exports,__dirname,__filename,process,global){function filter (xs, fn) {
    var res = [];
    for (var i = 0; i < xs.length; i++) {
        if (fn(xs[i], i, xs)) res.push(xs[i]);
    }
    return res;
}

// resolves . and .. elements in a path array with directory names there
// must be no slashes, empty elements, or device names (c:\) in the array
// (so also no leading and trailing slashes - it does not distinguish
// relative and absolute paths)
function normalizeArray(parts, allowAboveRoot) {
  // if the path tries to go above the root, `up` ends up > 0
  var up = 0;
  for (var i = parts.length; i >= 0; i--) {
    var last = parts[i];
    if (last == '.') {
      parts.splice(i, 1);
    } else if (last === '..') {
      parts.splice(i, 1);
      up++;
    } else if (up) {
      parts.splice(i, 1);
      up--;
    }
  }

  // if the path is allowed to go above the root, restore leading ..s
  if (allowAboveRoot) {
    for (; up--; up) {
      parts.unshift('..');
    }
  }

  return parts;
}

// Regex to split a filename into [*, dir, basename, ext]
// posix version
var splitPathRe = /^(.+\/(?!$)|\/)?((?:.+?)?(\.[^.]*)?)$/;

// path.resolve([from ...], to)
// posix version
exports.resolve = function() {
var resolvedPath = '',
    resolvedAbsolute = false;

for (var i = arguments.length; i >= -1 && !resolvedAbsolute; i--) {
  var path = (i >= 0)
      ? arguments[i]
      : process.cwd();

  // Skip empty and invalid entries
  if (typeof path !== 'string' || !path) {
    continue;
  }

  resolvedPath = path + '/' + resolvedPath;
  resolvedAbsolute = path.charAt(0) === '/';
}

// At this point the path should be resolved to a full absolute path, but
// handle relative paths to be safe (might happen when process.cwd() fails)

// Normalize the path
resolvedPath = normalizeArray(filter(resolvedPath.split('/'), function(p) {
    return !!p;
  }), !resolvedAbsolute).join('/');

  return ((resolvedAbsolute ? '/' : '') + resolvedPath) || '.';
};

// path.normalize(path)
// posix version
exports.normalize = function(path) {
var isAbsolute = path.charAt(0) === '/',
    trailingSlash = path.slice(-1) === '/';

// Normalize the path
path = normalizeArray(filter(path.split('/'), function(p) {
    return !!p;
  }), !isAbsolute).join('/');

  if (!path && !isAbsolute) {
    path = '.';
  }
  if (path && trailingSlash) {
    path += '/';
  }
  
  return (isAbsolute ? '/' : '') + path;
};


// posix version
exports.join = function() {
  var paths = Array.prototype.slice.call(arguments, 0);
  return exports.normalize(filter(paths, function(p, index) {
    return p && typeof p === 'string';
  }).join('/'));
};


exports.dirname = function(path) {
  var dir = splitPathRe.exec(path)[1] || '';
  var isWindows = false;
  if (!dir) {
    // No dirname
    return '.';
  } else if (dir.length === 1 ||
      (isWindows && dir.length <= 3 && dir.charAt(1) === ':')) {
    // It is just a slash or a drive letter with a slash
    return dir;
  } else {
    // It is a full dirname, strip trailing slash
    return dir.substring(0, dir.length - 1);
  }
};


exports.basename = function(path, ext) {
  var f = splitPathRe.exec(path)[2] || '';
  // TODO: make this comparison case-insensitive on windows?
  if (ext && f.substr(-1 * ext.length) === ext) {
    f = f.substr(0, f.length - ext.length);
  }
  return f;
};


exports.extname = function(path) {
  return splitPathRe.exec(path)[3] || '';
};

});

require.define("__browserify_process",function(require,module,exports,__dirname,__filename,process,global){var process = module.exports = {};

process.nextTick = (function () {
    var canSetImmediate = typeof window !== 'undefined'
        && window.setImmediate;
    var canPost = typeof window !== 'undefined'
        && window.postMessage && window.addEventListener
    ;

    if (canSetImmediate) {
        return function (f) { return window.setImmediate(f) };
    }

    if (canPost) {
        var queue = [];
        window.addEventListener('message', function (ev) {
            if (ev.source === window && ev.data === 'browserify-tick') {
                ev.stopPropagation();
                if (queue.length > 0) {
                    var fn = queue.shift();
                    fn();
                }
            }
        }, true);

        return function nextTick(fn) {
            queue.push(fn);
            window.postMessage('browserify-tick', '*');
        };
    }

    return function nextTick(fn) {
        setTimeout(fn, 0);
    };
})();

process.title = 'browser';
process.browser = true;
process.env = {};
process.argv = [];

process.binding = function (name) {
    if (name === 'evals') return (require)('vm')
    else throw new Error('No such module. (Possibly not yet loaded)')
};

(function () {
    var cwd = '/';
    var path;
    process.cwd = function () { return cwd };
    process.chdir = function (dir) {
        if (!path) path = require('path');
        cwd = path.resolve(dir, cwd);
    };
})();

});

require.define("/package.json",function(require,module,exports,__dirname,__filename,process,global){module.exports = {"main":"./tzTime"}
});

require.define("/tzTime.js",function(require,module,exports,__dirname,__filename,process,global){// Generated by CoffeeScript 1.9.3

/*
 * tzTime #

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

* Work in a particular granularity like day, week, month, or quarter and not worry about the fiddly bits of finer
  granularity. JavaScript's Date object forces you to think about the fact that the underlying representation is milliseconds
  from the unix epoch.
* Month is 1-indexed (rather than 0-indexed like Javascript's Date object)
* Date/Time math (add 3 months, subtract 2 weeks, etc.)
* Work with ISO-8601 formatted strings (called 'ISOString' in this library)

   * Added: Quarter form (e.g. 2012Q3 equates to 2012-07-01)
   * Not supported: Ordinal form (e.g. 2012-001 for 2012-01-01, 2011-365 for 2012-12-31) not supported

## Granularity ##

Each Time object has a granularity. This means that you never have to
worry about any bits lower than your specified granularity. A day has only
year, month, and day segments. You are never tempted to specify 11:59pm
to specify the end of a day-long timebox.

Time supports the following granularities:

* `year`
    * `month`
        * `day`
            * `hour`
               * `minute`
                   * `second`
                       * `millisecond`
    * `quarter` (but not quarter_month, day, etc.)
    * `week` (ISO-8601 style week numbering)
       * `week_day` (Monday = 1, Sunday = 7)

Also, you can define your own custom hierarchical granularities, for example...

* `release`
   * `iteration`
      * `iteration_day`

## Timezone precision ##

It's very hard to do filtering and grouping of time-series data with timezone precision.

For instance, 11pm in California on December 25 (Christmas holiday) is 2am December 26 (not a holiday)
in New York. This also happens to be 7am December 26 GMT. If you have an event that occurs at
2011-12-26T07:00:00.000Z, then you need to decide what timezone to use as your context before you
decide if that event occured on Christmas day or not. It's not just holidays where this can burn you.
Deciding if a piece of work finished in one time range versus another can make a difference for
you metrics. The time range metrics for a distributed team should look the same regardless
of whether those metrics were generated in New York versus Los Angeles... versus Bangalore.

The javascript Date object lets you work in either the local time or Zulu (GMT/UTC) time but it doesn't let you
control the timezone. Do you know the correct way to apply the timezone shift to a JavaScript Date Object?
Do you know when Daylight Savings Time kicks in and New York is 4 hours shifted from GMT instead of 5? Will
you remember to do it perfectly every time it's needed in your code?

If you need this precision, Time helps by clearly delineating the moment when you need to do
timezone manipulation... the moment you need to compare/query timestamped data. You can do all of your
holiday/weekend knockout manipulation without regard to timezone and only consider the timezone
upon query submission or comparison.

## Month is 1-indexed as you would expect ##

Javascript's date object uses 0 for January and 11 for December. Time uses 1 for January and 12 for December...
which is what ISO-8601 uses and what humans expect. Everyone who works with the javascript Date Object at one
point or another gets burned by this.

## Week support ##

Time has ISO-8601 week support. Implications of using this ISO format (paraphrased info from wikipedia):

* All weeks have 7 days (i.e. there are no fractional weeks).
* Any given day falls into a single week which means that incrementing across the year boundary in week
  granularity is without gaps or repeats.
* Weeks are contained within a single year. (i.e. weeks are never spit over two years).
* The above two implications also mean that we have to warp the boundaries of the year to accomplish this. In week
  granularity dates may appear in a different year than you would expect and some years have 53 weeks.
* The date directly tells the weekday.
* All years start with a Monday and end with a Sunday.
* Dates represented as yyyyWww-d can be sorted as strings.

**In general, it just greatly simplifies the use of week granularity in a chart situation.**

The ISO-8601 standard is an elegant and well thought out approach to dealing with week granularity. The only real
downside to this approach is that USA folks expect the week to start on Sunday. However, the ISO-8601 spec starts
each week on Monday. Following ISO-8601, Time uses 1 for Monday and 7 for Sunday which aligns with
the US standard for every day except Sunday. The US standard is to use 0 for Sunday. This library says, "tough luck"
to folks who are unhappy that the week starts on Monday. Live with the fact that weeks in this library start on Monday
as they do in the ISO-8601 standard, or roll your own library. :-)
 */

(function() {
  var Timeline;

  exports.Time = require('./src/Time').Time;

  Timeline = require('./src/Timeline');

  exports.TimelineIterator = Timeline.TimelineIterator;

  exports.Timeline = Timeline.Timeline;

  exports.utils = require('./src/utils');

}).call(this);

});

require.define("/src/Time.js",function(require,module,exports,__dirname,__filename,process,global){// Generated by CoffeeScript 1.9.3
(function() {
  var Time, timezoneJS, utils,
    indexOf = [].indexOf || function(item) { for (var i = 0, l = this.length; i < l; i++) { if (i in this && this[i] === item) return i; } return -1; };

  utils = require('./utils');

  timezoneJS = require('../lib/timezone-js.js').timezoneJS;

  Time = (function() {

    /*
    @class Time
    
    ## Basic usage ##
    
        {TimelineIterator, Timeline, Time} = require('../')
    
    Get Time objects from partial ISOStrings. The granularity is automatically inferred from how many segments you provide.
    
        d1 = new Time('2011-02-28')
        console.log(d1.toString())
         * 2011-02-28
    
    Spell it all out with a JavaScript object
    
        d2 = new Time({granularity: Time.DAY, year: 2011, month: 3, day: 1})
        console.log(d2.toString())
         * 2011-03-01
        
    Increment/decrement and compare Times without regard to timezone
    
        console.log(d1.greaterThanOrEqual(d2))
         * false
    
        d1.increment()
        console.log(d1.equal(d2))
         * true
    
    Do math on them.
        
        d3 = d1.add(5)
        console.log(d3.toString())
         * 2011-03-06
    
    Get the day of the week.
    
        console.log(d3.dowString())
         * Sunday
        
    Subtraction is just addition with negative numbers.
    
        d3.addInPlace(-6)
        console.log(d3.toString())
         * 2011-02-28
    
    If you start on the last day of a month, adding a month takes you to the last day of the next month, 
    even if the number of days are different.
        
        d3.addInPlace(1, 'month')  
        console.log(d3.toString())
         * 2011-03-31
        
    Deals well with year-granularity math and leap year complexity.
    
        d4 = new Time('2004-02-29')  # leap day
        d4.addInPlace(1, 'year')  # adding a year takes us to a non-leap year
        console.log(d4.toString())
         * 2005-02-28
        
    Week granularity correctly wraps and deals with 53-week years.
    
        w1 = new Time('2004W53-6')
        console.log(w1.inGranularity(Time.DAY).toString())
         * 2005-01-01
        
    Convert between any of the standard granularities. Also converts custom granularities (not shown) to
    standard granularities if you provide a `rataDieNumber()` function with your custom granularities.
    
        d5 = new Time('2005-01-01')  # goes the other direction also
        console.log(d5.inGranularity('week_day').toString())
         * 2004W53-6
        
        q1 = new Time('2011Q3')
        console.log(q1.inGranularity(Time.MILLISECOND).toString())
         * 2011-07-01T00:00:00.000
        
    ## Timezones ##
    
    Time does timezone sensitive conversions.
    
        console.log(new Time('2011-01-01').getJSDate('America/Denver').toISOString())
         * 2011-01-01T07:00:00.000Z
     */
    var g, ref, spec;

    function Time(value, granularity, tz) {

      /*
      @constructor
      @param {Object/Number/Date/String} value
      @param {String} [granularity]
      @param {String} [tz]
      
      The constructor for Time supports the passing in of a String, a rata die number (RDN), or a config Object
      
      ## String ##
      
      There are two kinds of strings that can be passed into the constructor:
      
      1. Human strings relative to now (e.g. "this day", "previous month", "next quarter", "this millisecond in Pacific/Fiji", etc.)
      2. ISO-8601 or custom masked (e.g. "I03D10" - 10th day of 3rd iteration)
      
      ## Human strings relative to now ##
      
      The string must be in the form `(this, previous, next) |granularity| [in |timezone|]`
      
      Examples
      
      * `this day` today
      * `next month` next month
      * `this day in Pacific/Fiji` the day that it currently is in Fiji
      * `previous hour in America/New_York` the hour before the current hour in New York
      * `next quarter` next quarter
      * `previous week` last week
      
      ## ISO-8601 or custom masked ##
      
      When you pass in an ISO-8601 or custom mask string, Time uses the masks that are defined for each granularity to figure out the granularity...
      unless you explicitly provide a granularity. This parser works on all valid ISO-8601 forms except orginal dates (e.g. `"2012-288"`)
      It even supports week number form (`"2009W52-7"`) and we've added a form for Quarter granularity (e.g. `"2009Q4"`).
      The canonical form (`"2009-01-01T12:34:56.789"`) will work as will any shortened subset of it (`"2009-01-01"`,
      `"2009-01-01T12:34"`, etc.). Plus it will even parse strings in whatever custom granularity you provide based
      upon the mask that you provide for that granularity.
      
      If the granularity is specified but not all of the segments are provided, Time will fill in the missing value
      with the `lowest` value from _granularitySpecs.
      
      The ISO forms that omit the delimiters or use spaces as the delimeters are not supported. Also unsupported are strings
      with a time shift indicator on the end (`...+05:00`). However, if you pass in a string with a "Z" at the end, Time
      will assume that you want to convert from GMT to local (abstract) time and you must provide a timezone.
      
      There are two special Strings that are recognized: `BEFORE_FIRST` and `PAST_LAST`. You must provide a granularity if you
      are instantiating a Time with these values. They are primarily used for custom granularities where your users
      may mistakenly request charts for iterations and releases that have not yet been defined. They are particularly useful when 
      you want to iterate to the last defined iteration/release.
      
      ## Rata Die Number ##
      
      The **rata die number (RDN)** for a date is the number of days since 0001-01-01. You will probably never work
      directly with this number but it's what Time uses to convert between granularities. When you are instantiating
      a Time from an RDN, you must provide a granularity. Using RDN will work even for the granularities finer than day.
      Time will populate the finer grained segments (hour, minute, etc.) with the approriate `lowest` value.
      
      ## Date ##
      
      You can also pass in a JavaScript Date() Object. The passing in of a tz with this option doesn't make sense. You'll end
      up with the same Time value no matter what because the JS Date() already sorta has a timezone. I'm not sure if this
      option is even really useful. In most cases, you are probably better off using Time.getISOStringFromJSDate()
      
      ## Object ##
      
      You can also explicitly spell out the segments in a specification Object in the form of
      `{granularity: Time.DAY, year: 2009, month: 1, day: 1}`. If the granularity is specified but not all of the segments are
      provided, Time will fill in the missing value with the appropriate `lowest` value from _granularitySpecs.
      
      ## granularity ##
      
      If you provide a granularity it will take precedence over whatever fields you've provided in your config or whatever segments
      you have provided in your string. Time will leave off extra values and fill in missing ones with the appropriate `lowest`
      value.
      
      ## tz ##
      
      Most of the time, Time assumes that any dates you pass in are timezone less. You'll specify Christmas as 12-25, then you'll
      shift the boundaries of Christmas for a specific timezone for boundary comparison.
      
      However, if you provide a tz parameter to this constructor, Time will assume you are passing in a true GMT date/time and shift into
      the provided timezone. So...
      
          d = new Time('2011-01-01T02:00:00:00.000Z', Time.DAY, 'America/New_York')
          console.log(d.toString())
           * 2010-12-31
          
      Rule of thumb on when you want to use timezones:
      
      1. If you have true GMT date/times and you want to create a Time, provide the timezone to this constructor.
      2. If you have abstract days like Christmas or June 10th and you want to delay the timezone consideration, don't provide a timezone to this constructor.
      3. In either case, if the dates you want to compare to are in GMT, but you've got Times or Timelines, you'll have to provide a timezone on
         the way back out of Time/Timeline
       */
      var config, jsDate, k, len, newCT, newConfig, rdn, ref, ref1, ref2, ref3, s, segment;
      this.beforePastFlag = '';
      switch (utils.type(value)) {
        case 'string':
          s = value;
          if ((s.slice(-3, -2) === ':' && (ref = s.slice(-6, -5), indexOf.call('+-', ref) >= 0)) || s.slice(-1) === 'Z') {
            if (tz != null) {
              if (s.slice(-3, -2) === ':' && (ref1 = s.slice(-6, -5), indexOf.call('+-', ref1) >= 0)) {
                throw new Error("tzTime.Time does not know how to deal with time shifted ISOStrings like what you sent: " + s);
              }
              if (s.slice(-1) === 'Z') {
                s = s.slice(0, -1);
              }
              newCT = new Time(s, 'millisecond');
              jsDate = newCT.getJSDateFromGMTInTZ(tz);
            } else {
              throw new Error("Must provide a tz parameter when instantiating a Time object with ISOString that contains timeshift/timezone specification. You provided: " + s + ".");
            }
          } else {
            this._setFromString(s, granularity);
            tz = void 0;
          }
          break;
        case 'number':
          rdn = value;
          if (tz != null) {
            newCT = new Time(rdn, 'millisecond');
            jsDate = newCT.getJSDateFromGMTInTZ(tz);
          } else {
            this._setFromRDN(rdn, granularity);
          }
          break;
        case 'date':
          jsDate = value;
          if (tz != null) {
            newCT = new Time(jsDate, 'millisecond');
            jsDate = newCT.getJSDateFromGMTInTZ(tz);
          }
          if (tz == null) {
            tz = 'GMT';
          }
          break;
        case 'object':
          config = {};
          config.granularity = value.granularity;
          config.beforePastFlag = value.beforePastFlag;
          ref2 = Time._granularitySpecs[value.granularity].segments;
          for (k = 0, len = ref2.length; k < len; k++) {
            segment = ref2[k];
            config[segment] = value[segment];
          }
          if (tz != null) {
            config.granularity = 'millisecond';
            newCT = new Time(config);
            jsDate = newCT.getJSDateFromGMTInTZ(tz);
          } else {
            this._setFromConfig(config);
          }
      }
      if (tz != null) {
        if ((ref3 = this.beforePastFlag) === 'BEFORE_FIRST' || ref3 === 'PAST_LAST') {
          throw new Error("Cannot do timezone manipulation on " + this.beforePastFlag);
        }
        if (granularity != null) {
          this.granularity = granularity;
        }
        if (this.granularity == null) {
          this.granularity = 'millisecond';
        }
        newConfig = {
          year: jsDate.getUTCFullYear(),
          month: jsDate.getUTCMonth() + 1,
          day: jsDate.getUTCDate(),
          hour: jsDate.getUTCHours(),
          minute: jsDate.getUTCMinutes(),
          second: jsDate.getUTCSeconds(),
          millisecond: jsDate.getUTCMilliseconds(),
          granularity: 'millisecond'
        };
        newCT = new Time(newConfig).inGranularity(this.granularity);
        this._setFromConfig(newCT);
      }
      this._inBoundsCheck();
      this._overUnderFlow();
    }


    /*
    `_granularitySpecs` is a static object that is used to tell Time what to do with particular granularties. You can think of
    each entry in it as a sort of sub-class of Time. In that sense Time is really a factory generating Time objects
    of type granularity. When custom timebox granularities are added to Time by `Time.addGranularity()`, it adds to this
    `_granularitySpecs` object.
     */

    Time._granularitySpecs = {};

    Time._granularitySpecs['millisecond'] = {
      segments: ['year', 'month', 'day', 'hour', 'minute', 'second', 'millisecond'],
      mask: '####-##-##T##:##:##.###',
      lowest: 0,
      rolloverValue: function() {
        return 1000;
      }
    };

    Time._granularitySpecs['second'] = {
      segments: ['year', 'month', 'day', 'hour', 'minute', 'second'],
      mask: '####-##-##T##:##:##',
      lowest: 0,
      rolloverValue: function() {
        return 60;
      }
    };

    Time._granularitySpecs['minute'] = {
      segments: ['year', 'month', 'day', 'hour', 'minute'],
      mask: '####-##-##T##:##',
      lowest: 0,
      rolloverValue: function() {
        return 60;
      }
    };

    Time._granularitySpecs['hour'] = {
      segments: ['year', 'month', 'day', 'hour'],
      mask: '####-##-##T##',
      lowest: 0,
      rolloverValue: function() {
        return 24;
      }
    };

    Time._granularitySpecs['day'] = {
      segments: ['year', 'month', 'day'],
      mask: '####-##-##',
      lowest: 1,
      rolloverValue: function(ct) {
        return ct.daysInMonth() + 1;
      }
    };

    Time._granularitySpecs['month'] = {
      segments: ['year', 'month'],
      mask: '####-##',
      lowest: 1,
      rolloverValue: function() {
        return 12 + 1;
      }
    };

    Time._granularitySpecs['year'] = {
      segments: ['year'],
      mask: '####',
      lowest: 1,
      rolloverValue: function() {
        return 9999 + 1;
      }
    };

    Time._granularitySpecs['week'] = {
      segments: ['year', 'week'],
      mask: '####W##',
      lowest: 1,
      rolloverValue: function(ct) {
        if (ct.is53WeekYear()) {
          return 53 + 1;
        } else {
          return 52 + 1;
        }
      }
    };

    Time._granularitySpecs['week_day'] = {
      segments: ['year', 'week', 'week_day'],
      mask: '####W##-#',
      lowest: 1,
      rolloverValue: function(ct) {
        return 7 + 1;
      }
    };

    Time._granularitySpecs['quarter'] = {
      segments: ['year', 'quarter'],
      mask: '####Q#',
      lowest: 1,
      rolloverValue: function() {
        return 4 + 1;
      }
    };

    Time._expandMask = function(granularitySpec) {
      var character, i, mask, segmentEnd;
      mask = granularitySpec.mask;
      if (mask != null) {
        if (mask.indexOf('#') >= 0) {
          i = mask.length - 1;
          while (mask.charAt(i) !== '#') {
            i--;
          }
          segmentEnd = i;
          while (mask.charAt(i) === '#') {
            i--;
          }
          granularitySpec.segmentStart = i + 1;
          granularitySpec.segmentLength = segmentEnd - i;
          return granularitySpec.regex = new RegExp(((function() {
            var k, len, ref, results;
            ref = mask.split('');
            results = [];
            for (k = 0, len = ref.length; k < len; k++) {
              character = ref[k];
              results.push(character === '#' ? '\\d' : character);
            }
            return results;
          })()).join(''));
        } else {
          return granularitySpec.regex = new RegExp(mask);
        }
      }
    };

    ref = Time._granularitySpecs;
    for (g in ref) {
      spec = ref[g];
      Time._expandMask(spec);
      Time[g.toUpperCase()] = g;
    }

    timezoneJS.timezone.zoneFileBasePath = '../files/tz';

    timezoneJS.timezone.init();

    Time.prototype._inBoundsCheck = function() {
      var gs, k, len, lowest, results, rolloverValue, segment, segments, temp;
      if (this.beforePastFlag === '' || (this.beforePastFlag == null)) {
        if (!this.granularity) {
          throw new Error('@granularity should be set before _inBoundsCheck is ever called.');
        }
        segments = Time._granularitySpecs[this.granularity].segments;
        results = [];
        for (k = 0, len = segments.length; k < len; k++) {
          segment = segments[k];
          gs = Time._granularitySpecs[segment];
          temp = this[segment];
          lowest = gs.lowest;
          rolloverValue = gs.rolloverValue(this);
          if (temp < lowest || temp >= rolloverValue) {
            if (temp === lowest - 1) {
              this[segment]++;
              results.push(this.decrement(segment));
            } else if (temp === rolloverValue) {
              this[segment]--;
              results.push(this.increment(segment));
            } else {
              throw new Error("Tried to set " + segment + " to " + temp + ". It must be >= " + lowest + " and < " + rolloverValue);
            }
          } else {
            results.push(void 0);
          }
        }
        return results;
      }
    };

    Time.prototype._setFromConfig = function(config) {
      var k, len, results, segment, segments;
      utils.assert(config.granularity != null, 'A granularity property must be part of the supplied config.');
      this.granularity = config.granularity;
      this.beforePastFlag = config.beforePastFlag != null ? config.beforePastFlag : '';
      segments = Time._granularitySpecs[this.granularity].segments;
      results = [];
      for (k = 0, len = segments.length; k < len; k++) {
        segment = segments[k];
        if (config[segment] != null) {
          results.push(this[segment] = config[segment]);
        } else {
          results.push(this[segment] = Time._granularitySpecs[segment].lowest);
        }
      }
      return results;
    };

    Time.prototype._setFromString = function(s, granularity) {
      var gs, k, l, len, ref1, ref2, results, sSplit, segment, segments, stillParsing, sub, tz, zuluCT;
      if (s === 'PAST_LAST' || s === 'BEFORE_FIRST') {
        if (granularity != null) {
          this.granularity = granularity;
          this.beforePastFlag = s;
          return;
        } else {
          throw new Error('PAST_LAST/BEFORE_FIRST must have a granularity');
        }
      }
      sSplit = s.split(' ');
      if ((ref1 = sSplit[0]) === 'this' || ref1 === 'next' || ref1 === 'previous') {
        if (sSplit[2] === 'in' && (sSplit[3] != null)) {
          tz = sSplit[3];
        } else {
          tz = void 0;
        }
        zuluCT = new Time(new Date(), sSplit[1], tz);
        this._setFromConfig(zuluCT);
        if (sSplit[0] === 'next') {
          this.increment();
        } else if (sSplit[0] === 'previous') {
          this.decrement();
        }
        return;
      }
      ref2 = Time._granularitySpecs;
      for (g in ref2) {
        spec = ref2[g];
        if (spec.segmentStart + spec.segmentLength === s.length || spec.mask.indexOf('#') < 0) {
          if (spec.regex.test(s)) {
            granularity = g;
            break;
          }
        }
      }
      if (granularity == null) {
        throw new Error("Error parsing string '" + s + "'. Couldn't identify granularity.");
      }
      this.granularity = granularity;
      segments = Time._granularitySpecs[this.granularity].segments;
      stillParsing = true;
      results = [];
      for (k = 0, len = segments.length; k < len; k++) {
        segment = segments[k];
        if (stillParsing) {
          gs = Time._granularitySpecs[segment];
          l = gs.segmentLength;
          sub = Time._getStringPart(s, segment);
          if (sub.length !== l) {
            stillParsing = false;
          }
        }
        if (stillParsing) {
          results.push(this[segment] = Number(sub));
        } else {
          results.push(this[segment] = Time._granularitySpecs[segment].lowest);
        }
      }
      return results;
    };

    Time._getStringPart = function(s, segment) {
      var l, st, sub;
      spec = Time._granularitySpecs[segment];
      l = spec.segmentLength;
      st = spec.segmentStart;
      sub = s.substr(st, l);
      return sub;
    };

    Time.prototype._setFromRDN = function(rdn, granularity) {
      var J, a, afterCT, afterRDN, b, beforeCT, beforeRDN, c, config, d, da, db, dc, dg, granularitySpec, j, k, len, m, n, ref1, segment, specForLowest, w, x, y, z;
      config = {
        granularity: granularity
      };
      utils.assert(granularity != null, "Must provide a granularity when constructing with a Rata Die Number.");
      switch (granularity) {
        case 'week':
        case 'week_day':
          w = Math.floor((rdn - 1) / 7);
          d = (rdn - 1) % 7;
          n = Math.floor(w / 20871);
          w = w % 20871;
          z = w + (w >= 10435 ? 1 : 0);
          c = Math.floor(z / 5218);
          w = z % 5218;
          x = w * 28 + [15, 23, 3, 11][c];
          y = Math.floor(x / 1461);
          w = x % 1461;
          config['year'] = y + n * 400 + c * 100 + 1;
          config['week'] = Math.floor(w / 28) + 1;
          config['week_day'] = d + 1;
          return this._setFromConfig(config);
        case 'year':
        case 'month':
        case 'day':
        case 'hour':
        case 'minute':
        case 'second':
        case 'millisecond':
        case 'quarter':
          J = rdn + 1721425;
          j = J + 32044;
          g = Math.floor(j / 146097);
          dg = j % 146097;
          c = Math.floor((Math.floor(dg / 36524) + 1) * 3 / 4);
          dc = dg - c * 36524;
          b = Math.floor(dc / 1461);
          db = dc % 1461;
          a = Math.floor((Math.floor(db / 365) + 1) * 3 / 4);
          da = db - a * 365;
          y = g * 400 + c * 100 + b * 4 + a;
          m = Math.floor((da * 5 + 308) / 153) - 2;
          d = da - Math.floor((m + 4) * 153 / 5) + 122;
          config['year'] = y - 4800 + Math.floor((m + 2) / 12);
          config['month'] = (m + 2) % 12 + 1;
          config['day'] = Math.floor(d) + 1;
          config['quarter'] = Math.floor((config.month - 1) / 3) + 1;
          return this._setFromConfig(config);
        default:
          granularitySpec = Time._granularitySpecs[granularity];
          specForLowest = {
            granularity: granularity
          };
          ref1 = granularitySpec.segments;
          for (k = 0, len = ref1.length; k < len; k++) {
            segment = ref1[k];
            specForLowest[segment] = Time._granularitySpecs[segment].lowest;
          }
          beforeCT = new Time(specForLowest);
          beforeRDN = beforeCT.rataDieNumber();
          afterCT = beforeCT.add(1);
          afterRDN = afterCT.rataDieNumber();
          if (rdn < beforeRDN) {
            this.beforePastFlag = 'BEFORE_FIRST';
            return;
          }
          while (true) {
            if (rdn < afterRDN && rdn >= beforeRDN) {
              this._setFromConfig(beforeCT);
              return;
            }
            beforeCT = afterCT;
            beforeRDN = afterRDN;
            afterCT = beforeCT.add(1);
            afterRDN = afterCT.rataDieNumber();
            if (afterCT.beforePastFlag === 'PAST_LAST') {
              if (rdn >= Time._granularitySpecs[beforeCT.granularity].endBeforeDay.rataDieNumber()) {
                this._setFromConfig(afterCT);
                this.beforePastFlag === 'PAST_LAST';
                return;
              } else if (rdn >= beforeRDN) {
                this._setFromConfig(beforeCT);
                return;
              } else {
                throw new Error("RDN: " + rdn + " seems to be out of range for " + granularity);
              }
            }
          }
          throw new Error("Something went badly wrong setting custom granularity " + granularity + " for RDN: " + rdn);
      }
    };

    Time.prototype._isGranularityCoarserThanDay = function() {

      /*
      @method granularityAboveDay
      @private
      @return {Boolean} true if the Time Object's granularity is above (coarser than) "day" level
       */
      var k, len, ref1, segment;
      ref1 = Time._granularitySpecs[this.granularity].segments;
      for (k = 0, len = ref1.length; k < len; k++) {
        segment = ref1[k];
        if (segment.indexOf('day') >= 0) {
          return false;
        }
      }
      return true;
    };

    Time.prototype.getJSDate = function(tz) {

      /*
      @method getJSDate
      @param {String} tz
      @return {Date}
      
      Returns a JavaScript Date Object properly shifted. This Date Object can be compared to other Date Objects that you know
      are already in the desired timezone. If you have data that comes from an API in GMT. You can first create a Time object from
      it and then (using this getJSDate() function) you can compare it to JavaScript Date Objects created in local time.
      
      The full name of this function should be getJSDateInGMTasummingThisCTDateIsInTimezone(tz). It converts **TO** GMT 
      (actually something that can be compared to GMT). It does **NOT** convert **FROM** GMT. Use getJSDateFromGMTInTZ()
      if you want to go in the other direction.
        
      ## Usage ##
      
          ct = new Time('2011-01-01')
          d = new Date(Date.UTC(2011, 0, 1))
          
          console.log(ct.getJSDate('GMT').getTime() == d.getTime())
           * true
          
          console.log(ct.inGranularity(Time.HOUR).add(-5).getJSDate('America/New_York').getTime() == d.getTime())
           * true
       */
      var ct, newDate, offset, utcMilliseconds;
      if (this.beforePastFlag === 'PAST_LAST') {
        return new Date(9999, 0, 1);
      }
      if (this.beforePastFlag === 'BEFORE_FIRST') {
        return new Date('0001-01-01');
      }
      utils.assert(tz != null, 'Must provide a timezone when calling getJSDate');
      ct = this.inGranularity('millisecond');
      utcMilliseconds = Date.UTC(ct.year, ct.month - 1, ct.day, ct.hour, ct.minute, ct.second, ct.millisecond);
      offset = timezoneJS.timezone.getTzInfo(new Date(utcMilliseconds), tz).tzOffset;
      utcMilliseconds += offset * 1000 * 60;
      newDate = new Date(utcMilliseconds);
      return newDate;
    };

    Time.prototype.getISOStringInTZ = function(tz) {

      /*
      @method getISOStringInTZ
      @param {String} tz
      @return {String} The canonical ISO-8601 date in zulu representation but shifted to the specified tz
      
          console.log(new Time('2012-01-01').getISOStringInTZ('Europe/Berlin'))
           * 2011-12-31T23:00:00.000Z
       */
      var jsDate;
      utils.assert(tz != null, 'Must provide a timezone when calling getShiftedISOString');
      jsDate = this.getJSDate(tz);
      return Time.getISOStringFromJSDate(jsDate);
    };

    Time.getISOStringFromJSDate = function(jsDate) {

      /*
      @method getISOStringFromJSDate
      @static
      @param {Date} jsDate
      @return {String}
      
      Given a JavaScript Date() Object, this will return the canonical ISO-8601 form.
      
      If you don't provide any parameters, it will return now, like `new Date()` except this is a zulu string.
      
          console.log(Time.getISOStringFromJSDate(new Date(0)))
           * 1970-01-01T00:00:00.000Z
       */
      var day, hour, millisecond, minute, month, s, second, year;
      if (jsDate == null) {
        jsDate = new Date();
      }
      year = jsDate.getUTCFullYear();
      month = jsDate.getUTCMonth() + 1;
      day = jsDate.getUTCDate();
      hour = jsDate.getUTCHours();
      minute = jsDate.getUTCMinutes();
      second = jsDate.getUTCSeconds();
      millisecond = jsDate.getUTCMilliseconds();
      s = Time._pad(year, 4) + '-' + Time._pad(month, 2) + '-' + Time._pad(day, 2) + 'T' + Time._pad(hour, 2) + ':' + Time._pad(minute, 2) + ':' + Time._pad(second, 2) + '.' + Time._pad(millisecond, 3) + 'Z';
      return s;
    };

    Time.prototype.getJSDateFromGMTInTZ = function(tz) {

      /*
      @method getJSDateInTZfromGMT
      @param {String} tz
      @return {Date}
      
      This assumes that the Time is an actual GMT date/time as opposed to some abstract day like Christmas and shifts
      it into the specified timezone.
      
      Note, this function will be off by an hour for the times near midnight on the days where there is a shift to/from daylight 
      savings time. The tz rules engine is designed to go in the other direction so we're mis-using it. This means we are using the wrong
      moment in rules-space for that hour. The cost of fixing this issue was deemed to high for chart applications.
      
          console.log(new Time('2012-01-01').getJSDateFromGMTInTZ('Europe/Berlin').toISOString())
           * 2012-01-01T01:00:00.000Z
       */
      var ct, newDate, offset, utcMilliseconds;
      if (this.beforePastFlag === 'PAST_LAST') {
        return new Date(9999, 0, 1);
      }
      if (this.beforePastFlag === 'BEFORE_FIRST') {
        return new Date('0001-01-01');
      }
      utils.assert(tz != null, 'Must provide a timezone when calling getJSDate');
      ct = this.inGranularity('millisecond');
      utcMilliseconds = Date.UTC(ct.year, ct.month - 1, ct.day, ct.hour, ct.minute, ct.second, ct.millisecond);
      offset = timezoneJS.timezone.getTzInfo(new Date(utcMilliseconds), tz).tzOffset;
      utcMilliseconds -= offset * 1000 * 60;
      newDate = new Date(utcMilliseconds);
      return newDate;
    };

    Time.prototype.getSegmentsAsObject = function() {

      /*
      @method getSegmentsAsObject
      @return {Object} Returns a simple JavaScript Object containing the segments. This is useful when using utils.match
      for holiday comparison
      
          t = new Time('2011-01-10')
          console.log(t.getSegmentsAsObject())
           * { year: 2011, month: 1, day: 10 }
       */
      var k, len, rawObject, segment, segments;
      segments = Time._granularitySpecs[this.granularity].segments;
      rawObject = {};
      for (k = 0, len = segments.length; k < len; k++) {
        segment = segments[k];
        rawObject[segment] = this[segment];
      }
      return rawObject;
    };

    Time.prototype.getSegmentsAsArray = function() {

      /*
      @method getSegmentsAsArray
      @return {Array} Returns a simple JavaScript Array containing the segments. This is useful for doing hierarchical
        aggregations using Lumenize.OLAPCube.
      
          t = new Time('2011-01-10')
          console.log(t.getSegmentsAsArray())
           * [ 2011, 1, 10 ]
       */
      var a, k, len, segment, segments;
      segments = Time._granularitySpecs[this.granularity].segments;
      a = [];
      for (k = 0, len = segments.length; k < len; k++) {
        segment = segments[k];
        a.push(this[segment]);
      }
      return a;
    };

    Time.prototype.toString = function() {

      /*
      @method toString
      @return {String} Uses granularity `mask` in _granularitySpecs to generate the string representation.
      
          t = new Time({year: 2012, month: 1, day: 1, granularity: Time.MINUTE}).toString()
          console.log(t.toString())
          console.log(t)
           * 2012-01-01T00:00
           * 2012-01-01T00:00
       */
      var after, before, granularitySpec, k, l, len, ref1, s, segment, segments, start;
      if ((ref1 = this.beforePastFlag) === 'BEFORE_FIRST' || ref1 === 'PAST_LAST') {
        s = "" + this.beforePastFlag;
      } else {
        s = Time._granularitySpecs[this.granularity].mask;
        segments = Time._granularitySpecs[this.granularity].segments;
        for (k = 0, len = segments.length; k < len; k++) {
          segment = segments[k];
          granularitySpec = Time._granularitySpecs[segment];
          l = granularitySpec.segmentLength;
          start = granularitySpec.segmentStart;
          before = s.slice(0, start);
          after = s.slice(start + l);
          s = before + Time._pad(this[segment], l) + after;
        }
      }
      return s;
    };

    Time._pad = function(n, l) {
      var result;
      result = n.toString();
      while (result.length < l) {
        result = '0' + result;
      }
      return result;
    };

    Time.DOW_N_TO_S_MAP = {
      0: 'Sunday',
      1: 'Monday',
      2: 'Tuesday',
      3: 'Wednesday',
      4: 'Thursday',
      5: 'Friday',
      6: 'Saturday',
      7: 'Sunday'
    };

    Time.MONTH_TO_S_MAP = {
      1: 'January',
      2: 'February',
      3: 'March',
      4: 'April',
      5: 'May',
      6: 'June',
      7: 'July',
      8: 'August',
      9: 'September',
      10: 'October',
      11: 'November',
      12: 'December'
    };

    Time.DOW_MONTH_TABLE = [0, 3, 2, 5, 0, 3, 5, 1, 4, 6, 2, 4];

    Time.prototype.dowNumber = function() {

      /*
      @method dowNumber
      @return {Number}
      Returns the day of the week as a number. Monday = 1, Sunday = 7
      
          console.log(new Time('2012-01-01').dowNumber())
           * 7
       */
      var dayNumber, ref1, y;
      if (this.granularity === 'week_day') {
        return this.week_day;
      }
      if ((ref1 = this.granularity) === 'day' || ref1 === 'hour' || ref1 === 'minute' || ref1 === 'second' || ref1 === 'millisecond') {
        y = this.year;
        if (this.month < 3) {
          y--;
        }
        dayNumber = (y + Math.floor(y / 4) - Math.floor(y / 100) + Math.floor(y / 400) + Time.DOW_MONTH_TABLE[this.month - 1] + this.day) % 7;
        if (dayNumber === 0) {
          return 7;
        } else {
          return dayNumber;
        }
      } else {
        return this.inGranularity('day').dowNumber();
      }
    };

    Time.prototype.dowString = function() {

      /*
      @method dowString
      @return {String} Returns the day of the week as a String (e.g. "Monday")
      
          console.log(new Time('2012-01-01').dowString())
           * Sunday
       */
      return Time.DOW_N_TO_S_MAP[this.dowNumber()];
    };

    Time.prototype.monthString = function() {

      /*
      @method monthString
      @return {String} Returns the month as a String (e.g. "January")
      
          console.log(new Time('2012-01-01').monthString())
           * January
       */
      return Time.MONTH_TO_S_MAP[this.month];
    };

    Time.prototype.rataDieNumber = function() {

      /*
      @method rataDieNumber
      @return {Number} Returns the counting number for days starting with 0001-01-01 (i.e. 0 AD). Note, this differs
      from the Unix Epoch which starts on 1970-01-01. This function works for
      granularities finer than day (hour, minute, second, millisecond) but ignores the segments of finer granularity than
      day. Also called common era days.
      
          console.log(new Time('0001-01-01').rataDieNumber())
           * 1
      
          rdn2012 = new Time('2012-01-01').rataDieNumber()
          rdn1970 = new Time('1970-01-01').rataDieNumber()
          ms1970To2012 = (rdn2012 - rdn1970) * 24 * 60 * 60 * 1000
          msJSDate2012 = Number(new Date('2012-01-01'))
          console.log(ms1970To2012 == msJSDate2012)
           * true
       */
      var ew, monthDays, y, yearDays;
      if (this.beforePastFlag === 'BEFORE_FIRST') {
        return -1;
      } else if (this.beforePastFlag === 'PAST_LAST') {
        return utils.MAX_INT;
      } else if (Time._granularitySpecs[this.granularity].rataDieNumber != null) {
        return Time._granularitySpecs[this.granularity].rataDieNumber(this);
      } else {
        y = this.year - 1;
        yearDays = y * 365 + Math.floor(y / 4) - Math.floor(y / 100) + Math.floor(y / 400);
        ew = Math.floor((yearDays + 3) / 7);
        if (this.month != null) {
          monthDays = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334][this.month - 1];
          if (this.isLeapYear() && this.month >= 3) {
            monthDays++;
          }
        } else if (this.quarter != null) {
          monthDays = [0, 90, 181, 273][this.quarter - 1];
          if (this.isLeapYear() && this.quarter >= 2) {
            monthDays++;
          }
        } else {
          monthDays = 0;
        }
        switch (this.granularity) {
          case 'year':
            return yearDays + 1;
          case 'month':
          case 'quarter':
            return yearDays + monthDays + 1;
          case 'day':
          case 'hour':
          case 'minute':
          case 'second':
          case 'millisecond':
            return yearDays + monthDays + this.day;
          case 'week':
            return (ew + this.week - 1) * 7 + 1;
          case 'week_day':
            return (ew + this.week - 1) * 7 + this.week_day;
        }
      }
    };

    Time.prototype.inGranularity = function(granularity) {

      /*
      @method inGranularity
      @param {String} granularity
      @return {Time} Returns a new Time object for the same date-time as this object but in the specified granularity.
      Fills in missing finer granularity segments with `lowest` values. Drops segments when convernting to a coarser
      granularity.
      
          console.log(new Time('2012W01-1').inGranularity(Time.DAY).toString())
           * 2012-01-02
      
          console.log(new Time('2012Q3').inGranularity(Time.MONTH).toString())
           * 2012-07
       */
      var newTime, ref1, tempGranularity;
      if ((ref1 = this.granularity) === 'year' || ref1 === 'month' || ref1 === 'day' || ref1 === 'hour' || ref1 === 'minute' || ref1 === 'second' || ref1 === 'millisecond') {
        if (granularity === 'year' || granularity === 'month' || granularity === 'day' || granularity === 'hour' || granularity === 'minute' || granularity === 'second' || granularity === 'millisecond') {
          tempGranularity = this.granularity;
          this.granularity = granularity;
          newTime = new Time(this);
          this.granularity = tempGranularity;
          return newTime;
        }
      }
      return new Time(this.rataDieNumber(), granularity);
    };

    Time.prototype.daysInMonth = function() {

      /*
      @method daysInMonth
      @return {Number} Returns the number of days in the current month for this Time
      
          console.log(new Time('2012-02').daysInMonth())
           * 29
       */
      switch (this.month) {
        case 4:
        case 6:
        case 9:
        case 11:
          return 30;
        case 1:
        case 3:
        case 5:
        case 7:
        case 8:
        case 10:
        case 12:
        case 0:
          return 31;
        case 2:
          if (this.isLeapYear()) {
            return 29;
          } else {
            return 28;
          }
      }
    };

    Time.prototype.isLeapYear = function() {

      /*
      @method isLeapYear
      @return {Boolean} true if this is a leap year
      
          console.log(new Time('2012').isLeapYear())
           * true
       */
      if (this.year % 4 === 0) {
        if (this.year % 100 === 0) {
          if (this.year % 400 === 0) {
            return true;
          } else {
            return false;
          }
        } else {
          return true;
        }
      } else {
        return false;
      }
    };

    Time.YEARS_WITH_53_WEEKS = [4, 9, 15, 20, 26, 32, 37, 43, 48, 54, 60, 65, 71, 76, 82, 88, 93, 99, 105, 111, 116, 122, 128, 133, 139, 144, 150, 156, 161, 167, 172, 178, 184, 189, 195, 201, 207, 212, 218, 224, 229, 235, 240, 246, 252, 257, 263, 268, 274, 280, 285, 291, 296, 303, 308, 314, 320, 325, 331, 336, 342, 348, 353, 359, 364, 370, 376, 381, 387, 392, 398];

    Time.prototype.is53WeekYear = function() {

      /*
      @method is53WeekYear
      @return {Boolean} true if this is a 53-week year
      
          console.log(new Time('2015').is53WeekYear())
           * true
       */
      var lookup;
      lookup = this.year % 400;
      return indexOf.call(Time.YEARS_WITH_53_WEEKS, lookup) >= 0;
    };

    Time.prototype.equal = function(other) {

      /*
      @method equal
      @param {Time} other
      @return {Boolean} Returns true if this equals other. Throws an error if the granularities don't match.
      
          d3 = new Time({granularity: Time.DAY, year: 2011, month: 12, day: 31})
          d4 = new Time('2012-01-01').add(-1)
          console.log(d3.equal(d4))
           * true
       */
      var k, len, segment, segments;
      utils.assert(this.granularity === other.granularity, "Granulary of " + this + " does not match granularity of " + other + " on equality/inequality test");
      if (this.beforePastFlag === 'PAST_LAST' && other.beforePastFlag === 'PAST_LAST') {
        return true;
      }
      if (this.beforePastFlag === 'BEFORE_FIRST' && other.beforePastFlag === 'BEFORE_FIRST') {
        return true;
      }
      if (this.beforePastFlag === 'PAST_LAST' && other.beforePastFlag !== 'PAST_LAST') {
        return false;
      }
      if (this.beforePastFlag === 'BEFORE_FIRST' && other.beforePastFlag !== 'BEFORE_FIRST') {
        return false;
      }
      if (other.beforePastFlag === 'PAST_LAST' && this.beforePastFlag !== 'PAST_LAST') {
        return false;
      }
      if (other.beforePastFlag === 'BEFORE_FIRST' && this.beforePastFlag !== 'BEFORE_FIRST') {
        return false;
      }
      segments = Time._granularitySpecs[this.granularity].segments;
      for (k = 0, len = segments.length; k < len; k++) {
        segment = segments[k];
        if (this[segment] !== other[segment]) {
          return false;
        }
      }
      return true;
    };

    Time.prototype.greaterThan = function(other) {

      /*
      @method greaterThan
      @param {Time} other
      @return {Boolean} Returns true if this is greater than other. Throws an error if the granularities don't match
      
          d1 = new Time({granularity: Time.DAY, year: 2011, month: 2, day: 28})
          d2 = new Time({granularity: Time.DAY, year: 2011, month: 3, day: 1})
          console.log(d1.greaterThan(d2))
           * false
          console.log(d2.greaterThan(d1))
           * true
       */
      var k, len, segment, segments;
      utils.assert(this.granularity === other.granularity, "Granulary of " + this + " does not match granularity of " + other + " on equality/inequality test");
      if (this.beforePastFlag === 'PAST_LAST' && other.beforePastFlag === 'PAST_LAST') {
        return false;
      }
      if (this.beforePastFlag === 'BEFORE_FIRST' && other.beforePastFlag === 'BEFORE_FIRST') {
        return false;
      }
      if (this.beforePastFlag === 'PAST_LAST' && other.beforePastFlag !== 'PAST_LAST') {
        return true;
      }
      if (this.beforePastFlag === 'BEFORE_FIRST' && other.beforePastFlag !== 'BEFORE_FIRST') {
        return false;
      }
      if (other.beforePastFlag === 'PAST_LAST' && this.beforePastFlag !== 'PAST_LAST') {
        return false;
      }
      if (other.beforePastFlag === 'BEFORE_FIRST' && this.beforePastFlag !== 'BEFORE_FIRST') {
        return true;
      }
      segments = Time._granularitySpecs[this.granularity].segments;
      for (k = 0, len = segments.length; k < len; k++) {
        segment = segments[k];
        if (this[segment] > other[segment]) {
          return true;
        }
        if (this[segment] < other[segment]) {
          return false;
        }
      }
      return false;
    };

    Time.prototype.greaterThanOrEqual = function(other) {

      /*
      @method greaterThanOrEqual
      @param {Time} other
      @return {Boolean} Returns true if this is greater than or equal to other
      
          console.log(new Time('2012').greaterThanOrEqual(new Time('2012')))
           * true
       */
      var gt;
      gt = this.greaterThan(other);
      if (gt) {
        return true;
      }
      return this.equal(other);
    };

    Time.prototype.lessThan = function(other) {

      /*
      @method lessThan
      @param {Time} other
      @return {Boolean} Returns true if this is less than other
      
          console.log(new Time(1000, Time.DAY).lessThan(new Time(999, Time.DAY)))  # Using RDN constructor
           * false
       */
      return other.greaterThan(this);
    };

    Time.prototype.lessThanOrEqual = function(other) {

      /*
      @method lessThanOrEqual
      @param {Time} other
      @return {Boolean} Returns true if this is less than or equal to other
      
          console.log(new Time('this day').lessThanOrEqual(new Time('next day')))  # Using relative constructor
           * true
       */
      return other.greaterThanOrEqual(this);
    };

    Time.prototype._overUnderFlow = function() {
      var granularitySpec, highestLevel, highestLevelSpec, lowest, ref1, rolloverValue, value;
      if ((ref1 = this.beforePastFlag) === 'BEFORE_FIRST' || ref1 === 'PAST_LAST') {
        return true;
      } else {
        granularitySpec = Time._granularitySpecs[this.granularity];
        highestLevel = granularitySpec.segments[0];
        highestLevelSpec = Time._granularitySpecs[highestLevel];
        value = this[highestLevel];
        rolloverValue = highestLevelSpec.rolloverValue(this);
        lowest = highestLevelSpec.lowest;
        if (value >= rolloverValue) {
          this.beforePastFlag = 'PAST_LAST';
          return true;
        } else if (value < lowest) {
          this.beforePastFlag = 'BEFORE_FIRST';
          return true;
        } else {
          return false;
        }
      }
    };

    Time.prototype.decrement = function(granularity) {

      /*
      @method decrement
      @param {String} [granularity]
      @chainable
      @return {Time}
      Decrements this by 1 in the granularity of the Time or the granularity specified if it was specified
      
          console.log(new Time('2016W01').decrement().toString())
           * 2015W53
       */
      var granularitySpec, gs, i, k, lastDayInMonthFlag, len, results, segment, segments;
      if (this.beforePastFlag === 'PAST_LAST') {
        this.beforePastFlag = '';
        granularitySpec = Time._granularitySpecs[this.granularity];
        segments = granularitySpec.segments;
        results = [];
        for (k = 0, len = segments.length; k < len; k++) {
          segment = segments[k];
          gs = Time._granularitySpecs[segment];
          results.push(this[segment] = gs.rolloverValue(this) - 1);
        }
        return results;
      } else {
        lastDayInMonthFlag = this.day === this.daysInMonth();
        if (granularity == null) {
          granularity = this.granularity;
        }
        granularitySpec = Time._granularitySpecs[granularity];
        segments = granularitySpec.segments;
        this[granularity]--;
        if (granularity === 'year') {
          if (this.day > this.daysInMonth()) {
            this.day = this.daysInMonth();
          }
        } else {
          i = segments.length - 1;
          segment = segments[i];
          granularitySpec = Time._granularitySpecs[segment];
          while ((i > 0) && (this[segment] < granularitySpec.lowest)) {
            this[segments[i - 1]]--;
            this[segment] = granularitySpec.rolloverValue(this) - 1;
            i--;
            segment = segments[i];
            granularitySpec = Time._granularitySpecs[segment];
          }
          if (granularity === 'month' && (this.granularity !== 'month')) {
            if (lastDayInMonthFlag || (this.day > this.daysInMonth())) {
              this.day = this.daysInMonth();
            }
          }
        }
        this._overUnderFlow();
        return this;
      }
    };

    Time.prototype.increment = function(granularity) {

      /*
      @method increment
      @param {String} [granularity]
      @chainable
      @return {Time}
      Increments this by 1 in the granularity of the Time or the granularity specified if it was specified
      
          console.log(new Time('2012Q4').increment().toString())
           * 2013Q1
       */
      var granularitySpec, gs, i, k, lastDayInMonthFlag, len, results, segment, segments;
      if (this.beforePastFlag === 'BEFORE_FIRST') {
        this.beforePastFlag = '';
        granularitySpec = Time._granularitySpecs[this.granularity];
        segments = granularitySpec.segments;
        results = [];
        for (k = 0, len = segments.length; k < len; k++) {
          segment = segments[k];
          gs = Time._granularitySpecs[segment];
          results.push(this[segment] = gs.lowest);
        }
        return results;
      } else {
        lastDayInMonthFlag = this.day === this.daysInMonth();
        if (granularity == null) {
          granularity = this.granularity;
        }
        granularitySpec = Time._granularitySpecs[granularity];
        segments = granularitySpec.segments;
        this[granularity]++;
        if (granularity === 'year') {
          if (this.day > this.daysInMonth()) {
            this.day = this.daysInMonth();
          }
        } else {
          i = segments.length - 1;
          segment = segments[i];
          granularitySpec = Time._granularitySpecs[segment];
          while ((i > 0) && (this[segment] >= granularitySpec.rolloverValue(this))) {
            this[segment] = granularitySpec.lowest;
            this[segments[i - 1]]++;
            i--;
            segment = segments[i];
            granularitySpec = Time._granularitySpecs[segment];
          }
          if ((granularity === 'month') && (this.granularity !== 'month')) {
            if (lastDayInMonthFlag || (this.day > this.daysInMonth())) {
              this.day = this.daysInMonth();
            }
          }
        }
        this._overUnderFlow();
        return this;
      }
    };

    Time.prototype.addInPlace = function(qty, granularity) {

      /*
      @method addInPlace
      @chainable
      @param {Number} qty Can be negative for subtraction
      @param {String} [granularity]
      @return {Time} Adds qty to the Time object. It uses increment and decrement so it's not going to be efficient for large values
      of qty, but it should be fine for charts where we'll increment/decrement small values of qty.
      
          console.log(new Time('2011-11-01').addInPlace(3, Time.MONTH).toString())
           * 2012-02-01
       */
      if (granularity == null) {
        granularity = this.granularity;
      }
      if (qty === 0) {
        return this;
      }
      if (qty === 1) {
        this.increment(granularity);
      } else if (qty > 1) {
        this.increment(granularity);
        this.addInPlace(qty - 1, granularity);
      } else if (qty === -1) {
        this.decrement(granularity);
      } else {
        this.decrement(granularity);
        this.addInPlace(qty + 1, granularity);
      }
      return this;
    };

    Time.prototype.add = function(qty, granularity) {

      /*
      @method add
      @param {Number} qty
      @param {String} [granularity]
      @return {Time}
      Adds (or subtracts) quantity (negative quantity) and returns a new Time. Not efficient for large qty.
      
         console.log(new Time('2012-01-01').add(-10, Time.MONTH))
          * 2011-03-01
       */
      var newTime;
      newTime = new Time(this);
      newTime.addInPlace(qty, granularity);
      return newTime;
    };

    Time.addGranularity = function(granularitySpec) {

      /*
      @method addGranularity
      @static
      @param {Object} granularitySpec see {@link Time#_granularitySpecs} for existing _granularitySpecs
      @cfg {String[]} segments an Array identifying the ancestry (e.g. for 'day', it is: `['year', 'month', 'day']`)
      @cfg {String} mask a String used to identify when this granularity is passed in and to serialize it on the way out.
      @cfg {Number} lowest the lowest possible value for this granularity. 0 for millisecond but 1 for day.
      @cfg {Function} rolloverValue a callback function that will say when to rollover the next coarser granularity.
      
      addGranularity allows you to add your own hierarchical granularities to Time. Once you add a granularity to Time
      you can then instantiate Time objects in your newly specified granularity. You specify new granularities with
      granularitySpec object like this:
          
          granularitySpec = {
            release: {
              segments: ['release'],
              mask: 'R##',
              lowest: 1,
              endBeforeDay: new Time('2011-07-01')
              rolloverValue: (ct) ->
                return Time._granularitySpecs.iteration.timeBoxes.length + 1  # Yes, it's correct to use the length of iteration.timeBoxes
              rataDieNumber: (ct) ->
                return Time._granularitySpecs.iteration.timeBoxes[ct.release-1][1-1].startOn.rataDieNumber()
            },
            iteration: {
              segments: ['release', 'iteration'],
              mask: 'R##I##',
              lowest: 1,
              endBeforeDay: new Time('2011-07-01')
              timeBoxes: [
                [
                  {startOn: new Time('2011-01-01'), label: 'R1 Iteration 1'},
                  {startOn: new Time('2011-02-01'), label: 'R1 Iteration 2'},
                  {startOn: new Time('2011-03-01'), label: 'R1 Iteration 3'},
                ],
                [
                  {startOn: new Time('2011-04-01'), label: 'R2 Iteration 1'},
                  {startOn: new Time('2011-05-01'), label: 'R2 Iteration 2'},
                  {startOn: new Time('2011-06-01'), label: 'R2 Iteration 3'},
                ]
              ]
              rolloverValue: (ct) ->
                temp = Time._granularitySpecs.iteration.timeBoxes[ct.release-1]?.length + 1
                if temp? and not isNaN(temp) and ct.beforePastFlag != 'PAST_LAST'
                  return temp
                else
                  numberOfReleases = Time._granularitySpecs.iteration.timeBoxes.length
                  return Time._granularitySpecs.iteration.timeBoxes[numberOfReleases-1].length + 1
      
              rataDieNumber: (ct) ->
                return Time._granularitySpecs.iteration.timeBoxes[ct.release-1][ct.iteration-1].startOn.rataDieNumber()
            },
            iteration_day: {  # By convention, it knows to use day functions on it. This is the lowest allowed custom granularity
              segments: ['release', 'iteration', 'iteration_day'],
              mask: 'R##I##-##',
              lowest: 1,
              endBeforeDay: new Time('2011-07-01'),
              rolloverValue: (ct) ->
                iterationTimeBox = Time._granularitySpecs.iteration.timeBoxes[ct.release-1]?[ct.iteration-1]
                if !iterationTimeBox? or ct.beforePastFlag == 'PAST_LAST'
                  numberOfReleases = Time._granularitySpecs.iteration.timeBoxes.length
                  numberOfIterationsInLastRelease = Time._granularitySpecs.iteration.timeBoxes[numberOfReleases-1].length
                  iterationTimeBox = Time._granularitySpecs.iteration.timeBoxes[numberOfReleases-1][numberOfIterationsInLastRelease-1]
                  
                thisIteration = iterationTimeBox.startOn.inGranularity('iteration')
                nextIteration = thisIteration.add(1)
                if nextIteration.beforePastFlag == 'PAST_LAST'
                  return Time._granularitySpecs.iteration_day.endBeforeDay.rataDieNumber() - iterationTimeBox.startOn.rataDieNumber() + 1
                else
                  return nextIteration.rataDieNumber() - iterationTimeBox.startOn.rataDieNumber() + 1
                 
              rataDieNumber: (ct) ->
                return Time._granularitySpecs.iteration.timeBoxes[ct.release-1][ct.iteration-1].startOn.rataDieNumber() + ct.iteration_day - 1
            }
          }    
          Time.addGranularity(granularitySpec)
      
      
      The `mask` must cover all of the segments to get down to the granularity being specified. The digits of the granularity segments
      are represented with `#`. Any other characters can be used as a delimeter, but it should always be one character to comply with 
      the expectations of the Lumenize hierarchy visualizations. All of the standard granularities start with a 4-digit year to
      distinguish your custom granularity, your highest level must start with some number of digits other than 4 or a prefix letter 
      (`R` in the example above).
      
      In order for the TimelineIterator to work, you must provide `rolloverValue` and `rataDieNumber` callback functions. You should
      be able to mimic (or use as-is) the example above for most use cases. Notice how the `rataDieNumber` function simply leverages
      `rataDieNumber` functions for the standard granularities.
      
      In order to convert into this granularity from some other granularity, you must provide an `inGranularity` callback [NOT YET IMPLEMENTED].
      But Time will convert to any of the standard granularities from even custom granularities as long as a `rataDieNumber()` function
      is provided.
      
      **The `timeBoxes` property in the `granularitySpec` Object above has no special meaning** to Time or TimelineIterator. It's simply used
      by the `rolloverValue` and `rataDieNumber` functions. The boundaries could come from where ever you want and even have been encoded as
      literals in the `rolloverValue` and `rataDieNumber` callback functions.
      
      The convention of naming the lowest order granularity with `_day` at the end IS signficant. Time knows to treat that as a day-level
      granularity. If there is a use-case for it, Time could be upgraded to allow you to drill down into hours, minutes, etc. from any
      `_day` granularity but right now those lower order time granularities are only supported for the canonical ISO-6801 form.
       */
      var results;
      results = [];
      for (g in granularitySpec) {
        spec = granularitySpec[g];
        Time._expandMask(spec);
        this._granularitySpecs[g] = spec;
        results.push(Time[g.toUpperCase()] = g);
      }
      return results;
    };

    return Time;

  })();

  exports.Time = Time;

}).call(this);

});

require.define("/src/utils.js",function(require,module,exports,__dirname,__filename,process,global){// Generated by CoffeeScript 1.9.3
(function() {
  var AssertException, ErrorBase, assert, clone, compare, decodeUtf8, encodeUtf8, exactMatch, filterMatch, isArray, keys, log, lzwDecode, lzwEncode, match, startsWith, trim, type, values,
    extend = function(child, parent) { for (var key in parent) { if (hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; },
    hasProp = {}.hasOwnProperty;

  exports.MAX_INT = 2147483647;

  exports.MIN_INT = -2147483648;

  ErrorBase = (function(superClass) {
    extend(ErrorBase, superClass);

    function ErrorBase(message1) {
      this.message = message1 != null ? message1 : 'Unknown error.';
      if (Error.captureStackTrace != null) {
        Error.captureStackTrace(this, this.constructor);
      }
      this.name = this.constructor.name;
    }

    ErrorBase.prototype.toString = function() {
      return this.name + ": " + this.message;
    };

    return ErrorBase;

  })(Error);

  AssertException = (function(superClass) {
    extend(AssertException, superClass);

    function AssertException() {
      return AssertException.__super__.constructor.apply(this, arguments);
    }

    return AssertException;

  })(ErrorBase);

  assert = function(exp, message) {
    if (!exp) {
      throw new exports.AssertException(message);
    }
  };

  match = function(obj1, obj2) {
    var key, value;
    for (key in obj1) {
      value = obj1[key];
      if (value !== obj2[key]) {
        return false;
      }
    }
    return true;
  };

  exactMatch = function(a, b) {
    var atype, btype, key, val;
    if (a === b) {
      return true;
    }
    atype = typeof a;
    btype = typeof b;
    if (atype !== btype) {
      return false;
    }
    if ((!a && b) || (a && !b)) {
      return false;
    }
    if (atype !== 'object') {
      return false;
    }
    if (a.length && (a.length !== b.length)) {
      return false;
    }
    for (key in a) {
      val = a[key];
      if (!(key in b) || !exactMatch(val, b[key])) {
        return false;
      }
    }
    return true;
  };

  filterMatch = function(obj1, obj2) {
    var key, value;
    if (!(type(obj1) === 'object' && type(obj2) === 'object')) {
      throw new Error('obj1 and obj2 must both be objects when calling filterMatch');
    }
    for (key in obj1) {
      value = obj1[key];
      if (!exactMatch(value, obj2[key])) {
        return false;
      }
    }
    return true;
  };

  trim = function(val) {
    if (String.prototype.trim != null) {
      return val.trim();
    } else {
      return val.replace(/^\s+|\s+$/g, "");
    }
  };

  startsWith = function(bigString, potentialStartString) {
    return bigString.substring(0, potentialStartString.length) === potentialStartString;
  };

  isArray = function(a) {
    return Object.prototype.toString.apply(a) === '[object Array]';
  };

  type = (function() {
    var classToType, j, len, name, ref;
    classToType = {};
    ref = "Boolean Number String Function Array Date RegExp Undefined Null".split(" ");
    for (j = 0, len = ref.length; j < len; j++) {
      name = ref[j];
      classToType["[object " + name + "]"] = name.toLowerCase();
    }
    return function(obj) {
      var strType;
      strType = Object.prototype.toString.call(obj);
      return classToType[strType] || "object";
    };
  })();

  clone = function(obj) {
    var flags, key, newInstance;
    if ((obj == null) || typeof obj !== 'object') {
      return obj;
    }
    if (obj instanceof Date) {
      return new Date(obj.getTime());
    }
    if (obj instanceof RegExp) {
      flags = '';
      if (obj.global != null) {
        flags += 'g';
      }
      if (obj.ignoreCase != null) {
        flags += 'i';
      }
      if (obj.multiline != null) {
        flags += 'm';
      }
      if (obj.sticky != null) {
        flags += 'y';
      }
      return new RegExp(obj.source, flags);
    }
    newInstance = new obj.constructor();
    for (key in obj) {
      newInstance[key] = clone(obj[key]);
    }
    return newInstance;
  };

  keys = Object.keys || function(obj) {
    var key, val;
    return (function() {
      var results;
      results = [];
      for (key in obj) {
        val = obj[key];
        results.push(key);
      }
      return results;
    })();
  };

  values = function(obj) {
    var key, val;
    return (function() {
      var results;
      results = [];
      for (key in obj) {
        val = obj[key];
        results.push(val);
      }
      return results;
    })();
  };

  log = function(s) {
    var pre;
    if ((typeof document !== "undefined" && document !== null ? document.createElement : void 0) != null) {
      pre = document.createElement('pre');
      pre.innerHTML = s;
      return document.body.appendChild(pre);
    } else {
      return console.log(s);
    }
  };

  compare = function(a, b) {
    var aString, bString, index, j, len, value;
    if (a === null) {
      return 1;
    }
    if (b === null) {
      return -1;
    }
    switch (type(a)) {
      case 'number':
      case 'boolean':
      case 'date':
        return b - a;
      case 'array':
        for (index = j = 0, len = a.length; j < len; index = ++j) {
          value = a[index];
          if (b.length - 1 >= index && value < b[index]) {
            return 1;
          }
          if (b.length - 1 >= index && value > b[index]) {
            return -1;
          }
        }
        if (a.length < b.length) {
          return 1;
        } else if (a.length > b.length) {
          return -1;
        } else {
          return 0;
        }
        break;
      case 'object':
      case 'string':
        aString = JSON.stringify(a);
        bString = JSON.stringify(b);
        if (aString < bString) {
          return 1;
        } else if (aString > bString) {
          return -1;
        } else {
          return 0;
        }
        break;
      default:
        throw new Error("Do not know how to sort objects of type " + (utils.type(a)) + ".");
    }
  };

  encodeUtf8 = function(s) {
    return unescape(encodeURIComponent(s));
  };

  decodeUtf8 = function(s) {
    return decodeURIComponent(escape(s));
  };

  lzwEncode = function(s) {
    var code, currChar, data, dict, i, out, phrase;
    s = encodeUtf8(s);
    dict = {};
    data = (s + "").split("");
    out = [];
    currChar = void 0;
    phrase = data[0];
    code = 256;
    i = 1;
    while (i < data.length) {
      currChar = data[i];
      if (dict[phrase + currChar] != null) {
        phrase += currChar;
      } else {
        out.push((phrase.length > 1 ? dict[phrase] : phrase.charCodeAt(0)));
        dict[phrase + currChar] = code;
        code++;
        phrase = currChar;
      }
      i++;
    }
    out.push((phrase.length > 1 ? dict[phrase] : phrase.charCodeAt(0)));
    i = 0;
    while (i < out.length) {
      out[i] = String.fromCharCode(out[i]);
      i++;
    }
    return out.join("");
  };

  lzwDecode = function(s) {
    var code, currChar, currCode, data, dict, i, oldPhrase, out, outS, phrase;
    dict = {};
    data = (s + "").split("");
    currChar = data[0];
    oldPhrase = currChar;
    out = [currChar];
    code = 256;
    phrase = void 0;
    i = 1;
    while (i < data.length) {
      currCode = data[i].charCodeAt(0);
      if (currCode < 256) {
        phrase = data[i];
      } else {
        phrase = (dict[currCode] ? dict[currCode] : oldPhrase + currChar);
      }
      out.push(phrase);
      currChar = phrase.charAt(0);
      dict[code] = oldPhrase + currChar;
      code++;
      oldPhrase = phrase;
      i++;
    }
    outS = out.join("");
    return decodeUtf8(outS);
  };

  exports.log = log;

  exports.AssertException = AssertException;

  exports.assert = assert;

  exports.match = match;

  exports.filterMatch = filterMatch;

  exports.trim = trim;

  exports.startsWith = startsWith;

  exports.isArray = isArray;

  exports.type = type;

  exports.clone = clone;

  exports.keys = keys;

  exports.values = values;

  exports.compare = compare;

  exports.lzwEncode = lzwEncode;

  exports.lzwDecode = lzwDecode;

  exports._ = require('underscore');

}).call(this);

});

require.define("/node_modules/underscore/package.json",function(require,module,exports,__dirname,__filename,process,global){module.exports = {"main":"underscore.js"}
});

require.define("/node_modules/underscore/underscore.js",function(require,module,exports,__dirname,__filename,process,global){//     Underscore.js 1.8.3
//     http://underscorejs.org
//     (c) 2009-2015 Jeremy Ashkenas, DocumentCloud and Investigative Reporters & Editors
//     Underscore may be freely distributed under the MIT license.

(function() {

  // Baseline setup
  // --------------

  // Establish the root object, `window` in the browser, or `exports` on the server.
  var root = this;

  // Save the previous value of the `_` variable.
  var previousUnderscore = root._;

  // Save bytes in the minified (but not gzipped) version:
  var ArrayProto = Array.prototype, ObjProto = Object.prototype, FuncProto = Function.prototype;

  // Create quick reference variables for speed access to core prototypes.
  var
    push             = ArrayProto.push,
    slice            = ArrayProto.slice,
    toString         = ObjProto.toString,
    hasOwnProperty   = ObjProto.hasOwnProperty;

  // All **ECMAScript 5** native function implementations that we hope to use
  // are declared here.
  var
    nativeIsArray      = Array.isArray,
    nativeKeys         = Object.keys,
    nativeBind         = FuncProto.bind,
    nativeCreate       = Object.create;

  // Naked function reference for surrogate-prototype-swapping.
  var Ctor = function(){};

  // Create a safe reference to the Underscore object for use below.
  var _ = function(obj) {
    if (obj instanceof _) return obj;
    if (!(this instanceof _)) return new _(obj);
    this._wrapped = obj;
  };

  // Export the Underscore object for **Node.js**, with
  // backwards-compatibility for the old `require()` API. If we're in
  // the browser, add `_` as a global object.
  if (typeof exports !== 'undefined') {
    if (typeof module !== 'undefined' && module.exports) {
      exports = module.exports = _;
    }
    exports._ = _;
  } else {
    root._ = _;
  }

  // Current version.
  _.VERSION = '1.8.3';

  // Internal function that returns an efficient (for current engines) version
  // of the passed-in callback, to be repeatedly applied in other Underscore
  // functions.
  var optimizeCb = function(func, context, argCount) {
    if (context === void 0) return func;
    switch (argCount == null ? 3 : argCount) {
      case 1: return function(value) {
        return func.call(context, value);
      };
      case 2: return function(value, other) {
        return func.call(context, value, other);
      };
      case 3: return function(value, index, collection) {
        return func.call(context, value, index, collection);
      };
      case 4: return function(accumulator, value, index, collection) {
        return func.call(context, accumulator, value, index, collection);
      };
    }
    return function() {
      return func.apply(context, arguments);
    };
  };

  // A mostly-internal function to generate callbacks that can be applied
  // to each element in a collection, returning the desired result — either
  // identity, an arbitrary callback, a property matcher, or a property accessor.
  var cb = function(value, context, argCount) {
    if (value == null) return _.identity;
    if (_.isFunction(value)) return optimizeCb(value, context, argCount);
    if (_.isObject(value)) return _.matcher(value);
    return _.property(value);
  };
  _.iteratee = function(value, context) {
    return cb(value, context, Infinity);
  };

  // An internal function for creating assigner functions.
  var createAssigner = function(keysFunc, undefinedOnly) {
    return function(obj) {
      var length = arguments.length;
      if (length < 2 || obj == null) return obj;
      for (var index = 1; index < length; index++) {
        var source = arguments[index],
            keys = keysFunc(source),
            l = keys.length;
        for (var i = 0; i < l; i++) {
          var key = keys[i];
          if (!undefinedOnly || obj[key] === void 0) obj[key] = source[key];
        }
      }
      return obj;
    };
  };

  // An internal function for creating a new object that inherits from another.
  var baseCreate = function(prototype) {
    if (!_.isObject(prototype)) return {};
    if (nativeCreate) return nativeCreate(prototype);
    Ctor.prototype = prototype;
    var result = new Ctor;
    Ctor.prototype = null;
    return result;
  };

  var property = function(key) {
    return function(obj) {
      return obj == null ? void 0 : obj[key];
    };
  };

  // Helper for collection methods to determine whether a collection
  // should be iterated as an array or as an object
  // Related: http://people.mozilla.org/~jorendorff/es6-draft.html#sec-tolength
  // Avoids a very nasty iOS 8 JIT bug on ARM-64. #2094
  var MAX_ARRAY_INDEX = Math.pow(2, 53) - 1;
  var getLength = property('length');
  var isArrayLike = function(collection) {
    var length = getLength(collection);
    return typeof length == 'number' && length >= 0 && length <= MAX_ARRAY_INDEX;
  };

  // Collection Functions
  // --------------------

  // The cornerstone, an `each` implementation, aka `forEach`.
  // Handles raw objects in addition to array-likes. Treats all
  // sparse array-likes as if they were dense.
  _.each = _.forEach = function(obj, iteratee, context) {
    iteratee = optimizeCb(iteratee, context);
    var i, length;
    if (isArrayLike(obj)) {
      for (i = 0, length = obj.length; i < length; i++) {
        iteratee(obj[i], i, obj);
      }
    } else {
      var keys = _.keys(obj);
      for (i = 0, length = keys.length; i < length; i++) {
        iteratee(obj[keys[i]], keys[i], obj);
      }
    }
    return obj;
  };

  // Return the results of applying the iteratee to each element.
  _.map = _.collect = function(obj, iteratee, context) {
    iteratee = cb(iteratee, context);
    var keys = !isArrayLike(obj) && _.keys(obj),
        length = (keys || obj).length,
        results = Array(length);
    for (var index = 0; index < length; index++) {
      var currentKey = keys ? keys[index] : index;
      results[index] = iteratee(obj[currentKey], currentKey, obj);
    }
    return results;
  };

  // Create a reducing function iterating left or right.
  function createReduce(dir) {
    // Optimized iterator function as using arguments.length
    // in the main function will deoptimize the, see #1991.
    function iterator(obj, iteratee, memo, keys, index, length) {
      for (; index >= 0 && index < length; index += dir) {
        var currentKey = keys ? keys[index] : index;
        memo = iteratee(memo, obj[currentKey], currentKey, obj);
      }
      return memo;
    }

    return function(obj, iteratee, memo, context) {
      iteratee = optimizeCb(iteratee, context, 4);
      var keys = !isArrayLike(obj) && _.keys(obj),
          length = (keys || obj).length,
          index = dir > 0 ? 0 : length - 1;
      // Determine the initial value if none is provided.
      if (arguments.length < 3) {
        memo = obj[keys ? keys[index] : index];
        index += dir;
      }
      return iterator(obj, iteratee, memo, keys, index, length);
    };
  }

  // **Reduce** builds up a single result from a list of values, aka `inject`,
  // or `foldl`.
  _.reduce = _.foldl = _.inject = createReduce(1);

  // The right-associative version of reduce, also known as `foldr`.
  _.reduceRight = _.foldr = createReduce(-1);

  // Return the first value which passes a truth test. Aliased as `detect`.
  _.find = _.detect = function(obj, predicate, context) {
    var key;
    if (isArrayLike(obj)) {
      key = _.findIndex(obj, predicate, context);
    } else {
      key = _.findKey(obj, predicate, context);
    }
    if (key !== void 0 && key !== -1) return obj[key];
  };

  // Return all the elements that pass a truth test.
  // Aliased as `select`.
  _.filter = _.select = function(obj, predicate, context) {
    var results = [];
    predicate = cb(predicate, context);
    _.each(obj, function(value, index, list) {
      if (predicate(value, index, list)) results.push(value);
    });
    return results;
  };

  // Return all the elements for which a truth test fails.
  _.reject = function(obj, predicate, context) {
    return _.filter(obj, _.negate(cb(predicate)), context);
  };

  // Determine whether all of the elements match a truth test.
  // Aliased as `all`.
  _.every = _.all = function(obj, predicate, context) {
    predicate = cb(predicate, context);
    var keys = !isArrayLike(obj) && _.keys(obj),
        length = (keys || obj).length;
    for (var index = 0; index < length; index++) {
      var currentKey = keys ? keys[index] : index;
      if (!predicate(obj[currentKey], currentKey, obj)) return false;
    }
    return true;
  };

  // Determine if at least one element in the object matches a truth test.
  // Aliased as `any`.
  _.some = _.any = function(obj, predicate, context) {
    predicate = cb(predicate, context);
    var keys = !isArrayLike(obj) && _.keys(obj),
        length = (keys || obj).length;
    for (var index = 0; index < length; index++) {
      var currentKey = keys ? keys[index] : index;
      if (predicate(obj[currentKey], currentKey, obj)) return true;
    }
    return false;
  };

  // Determine if the array or object contains a given item (using `===`).
  // Aliased as `includes` and `include`.
  _.contains = _.includes = _.include = function(obj, item, fromIndex, guard) {
    if (!isArrayLike(obj)) obj = _.values(obj);
    if (typeof fromIndex != 'number' || guard) fromIndex = 0;
    return _.indexOf(obj, item, fromIndex) >= 0;
  };

  // Invoke a method (with arguments) on every item in a collection.
  _.invoke = function(obj, method) {
    var args = slice.call(arguments, 2);
    var isFunc = _.isFunction(method);
    return _.map(obj, function(value) {
      var func = isFunc ? method : value[method];
      return func == null ? func : func.apply(value, args);
    });
  };

  // Convenience version of a common use case of `map`: fetching a property.
  _.pluck = function(obj, key) {
    return _.map(obj, _.property(key));
  };

  // Convenience version of a common use case of `filter`: selecting only objects
  // containing specific `key:value` pairs.
  _.where = function(obj, attrs) {
    return _.filter(obj, _.matcher(attrs));
  };

  // Convenience version of a common use case of `find`: getting the first object
  // containing specific `key:value` pairs.
  _.findWhere = function(obj, attrs) {
    return _.find(obj, _.matcher(attrs));
  };

  // Return the maximum element (or element-based computation).
  _.max = function(obj, iteratee, context) {
    var result = -Infinity, lastComputed = -Infinity,
        value, computed;
    if (iteratee == null && obj != null) {
      obj = isArrayLike(obj) ? obj : _.values(obj);
      for (var i = 0, length = obj.length; i < length; i++) {
        value = obj[i];
        if (value > result) {
          result = value;
        }
      }
    } else {
      iteratee = cb(iteratee, context);
      _.each(obj, function(value, index, list) {
        computed = iteratee(value, index, list);
        if (computed > lastComputed || computed === -Infinity && result === -Infinity) {
          result = value;
          lastComputed = computed;
        }
      });
    }
    return result;
  };

  // Return the minimum element (or element-based computation).
  _.min = function(obj, iteratee, context) {
    var result = Infinity, lastComputed = Infinity,
        value, computed;
    if (iteratee == null && obj != null) {
      obj = isArrayLike(obj) ? obj : _.values(obj);
      for (var i = 0, length = obj.length; i < length; i++) {
        value = obj[i];
        if (value < result) {
          result = value;
        }
      }
    } else {
      iteratee = cb(iteratee, context);
      _.each(obj, function(value, index, list) {
        computed = iteratee(value, index, list);
        if (computed < lastComputed || computed === Infinity && result === Infinity) {
          result = value;
          lastComputed = computed;
        }
      });
    }
    return result;
  };

  // Shuffle a collection, using the modern version of the
  // [Fisher-Yates shuffle](http://en.wikipedia.org/wiki/Fisher–Yates_shuffle).
  _.shuffle = function(obj) {
    var set = isArrayLike(obj) ? obj : _.values(obj);
    var length = set.length;
    var shuffled = Array(length);
    for (var index = 0, rand; index < length; index++) {
      rand = _.random(0, index);
      if (rand !== index) shuffled[index] = shuffled[rand];
      shuffled[rand] = set[index];
    }
    return shuffled;
  };

  // Sample **n** random values from a collection.
  // If **n** is not specified, returns a single random element.
  // The internal `guard` argument allows it to work with `map`.
  _.sample = function(obj, n, guard) {
    if (n == null || guard) {
      if (!isArrayLike(obj)) obj = _.values(obj);
      return obj[_.random(obj.length - 1)];
    }
    return _.shuffle(obj).slice(0, Math.max(0, n));
  };

  // Sort the object's values by a criterion produced by an iteratee.
  _.sortBy = function(obj, iteratee, context) {
    iteratee = cb(iteratee, context);
    return _.pluck(_.map(obj, function(value, index, list) {
      return {
        value: value,
        index: index,
        criteria: iteratee(value, index, list)
      };
    }).sort(function(left, right) {
      var a = left.criteria;
      var b = right.criteria;
      if (a !== b) {
        if (a > b || a === void 0) return 1;
        if (a < b || b === void 0) return -1;
      }
      return left.index - right.index;
    }), 'value');
  };

  // An internal function used for aggregate "group by" operations.
  var group = function(behavior) {
    return function(obj, iteratee, context) {
      var result = {};
      iteratee = cb(iteratee, context);
      _.each(obj, function(value, index) {
        var key = iteratee(value, index, obj);
        behavior(result, value, key);
      });
      return result;
    };
  };

  // Groups the object's values by a criterion. Pass either a string attribute
  // to group by, or a function that returns the criterion.
  _.groupBy = group(function(result, value, key) {
    if (_.has(result, key)) result[key].push(value); else result[key] = [value];
  });

  // Indexes the object's values by a criterion, similar to `groupBy`, but for
  // when you know that your index values will be unique.
  _.indexBy = group(function(result, value, key) {
    result[key] = value;
  });

  // Counts instances of an object that group by a certain criterion. Pass
  // either a string attribute to count by, or a function that returns the
  // criterion.
  _.countBy = group(function(result, value, key) {
    if (_.has(result, key)) result[key]++; else result[key] = 1;
  });

  // Safely create a real, live array from anything iterable.
  _.toArray = function(obj) {
    if (!obj) return [];
    if (_.isArray(obj)) return slice.call(obj);
    if (isArrayLike(obj)) return _.map(obj, _.identity);
    return _.values(obj);
  };

  // Return the number of elements in an object.
  _.size = function(obj) {
    if (obj == null) return 0;
    return isArrayLike(obj) ? obj.length : _.keys(obj).length;
  };

  // Split a collection into two arrays: one whose elements all satisfy the given
  // predicate, and one whose elements all do not satisfy the predicate.
  _.partition = function(obj, predicate, context) {
    predicate = cb(predicate, context);
    var pass = [], fail = [];
    _.each(obj, function(value, key, obj) {
      (predicate(value, key, obj) ? pass : fail).push(value);
    });
    return [pass, fail];
  };

  // Array Functions
  // ---------------

  // Get the first element of an array. Passing **n** will return the first N
  // values in the array. Aliased as `head` and `take`. The **guard** check
  // allows it to work with `_.map`.
  _.first = _.head = _.take = function(array, n, guard) {
    if (array == null) return void 0;
    if (n == null || guard) return array[0];
    return _.initial(array, array.length - n);
  };

  // Returns everything but the last entry of the array. Especially useful on
  // the arguments object. Passing **n** will return all the values in
  // the array, excluding the last N.
  _.initial = function(array, n, guard) {
    return slice.call(array, 0, Math.max(0, array.length - (n == null || guard ? 1 : n)));
  };

  // Get the last element of an array. Passing **n** will return the last N
  // values in the array.
  _.last = function(array, n, guard) {
    if (array == null) return void 0;
    if (n == null || guard) return array[array.length - 1];
    return _.rest(array, Math.max(0, array.length - n));
  };

  // Returns everything but the first entry of the array. Aliased as `tail` and `drop`.
  // Especially useful on the arguments object. Passing an **n** will return
  // the rest N values in the array.
  _.rest = _.tail = _.drop = function(array, n, guard) {
    return slice.call(array, n == null || guard ? 1 : n);
  };

  // Trim out all falsy values from an array.
  _.compact = function(array) {
    return _.filter(array, _.identity);
  };

  // Internal implementation of a recursive `flatten` function.
  var flatten = function(input, shallow, strict, startIndex) {
    var output = [], idx = 0;
    for (var i = startIndex || 0, length = getLength(input); i < length; i++) {
      var value = input[i];
      if (isArrayLike(value) && (_.isArray(value) || _.isArguments(value))) {
        //flatten current level of array or arguments object
        if (!shallow) value = flatten(value, shallow, strict);
        var j = 0, len = value.length;
        output.length += len;
        while (j < len) {
          output[idx++] = value[j++];
        }
      } else if (!strict) {
        output[idx++] = value;
      }
    }
    return output;
  };

  // Flatten out an array, either recursively (by default), or just one level.
  _.flatten = function(array, shallow) {
    return flatten(array, shallow, false);
  };

  // Return a version of the array that does not contain the specified value(s).
  _.without = function(array) {
    return _.difference(array, slice.call(arguments, 1));
  };

  // Produce a duplicate-free version of the array. If the array has already
  // been sorted, you have the option of using a faster algorithm.
  // Aliased as `unique`.
  _.uniq = _.unique = function(array, isSorted, iteratee, context) {
    if (!_.isBoolean(isSorted)) {
      context = iteratee;
      iteratee = isSorted;
      isSorted = false;
    }
    if (iteratee != null) iteratee = cb(iteratee, context);
    var result = [];
    var seen = [];
    for (var i = 0, length = getLength(array); i < length; i++) {
      var value = array[i],
          computed = iteratee ? iteratee(value, i, array) : value;
      if (isSorted) {
        if (!i || seen !== computed) result.push(value);
        seen = computed;
      } else if (iteratee) {
        if (!_.contains(seen, computed)) {
          seen.push(computed);
          result.push(value);
        }
      } else if (!_.contains(result, value)) {
        result.push(value);
      }
    }
    return result;
  };

  // Produce an array that contains the union: each distinct element from all of
  // the passed-in arrays.
  _.union = function() {
    return _.uniq(flatten(arguments, true, true));
  };

  // Produce an array that contains every item shared between all the
  // passed-in arrays.
  _.intersection = function(array) {
    var result = [];
    var argsLength = arguments.length;
    for (var i = 0, length = getLength(array); i < length; i++) {
      var item = array[i];
      if (_.contains(result, item)) continue;
      for (var j = 1; j < argsLength; j++) {
        if (!_.contains(arguments[j], item)) break;
      }
      if (j === argsLength) result.push(item);
    }
    return result;
  };

  // Take the difference between one array and a number of other arrays.
  // Only the elements present in just the first array will remain.
  _.difference = function(array) {
    var rest = flatten(arguments, true, true, 1);
    return _.filter(array, function(value){
      return !_.contains(rest, value);
    });
  };

  // Zip together multiple lists into a single array -- elements that share
  // an index go together.
  _.zip = function() {
    return _.unzip(arguments);
  };

  // Complement of _.zip. Unzip accepts an array of arrays and groups
  // each array's elements on shared indices
  _.unzip = function(array) {
    var length = array && _.max(array, getLength).length || 0;
    var result = Array(length);

    for (var index = 0; index < length; index++) {
      result[index] = _.pluck(array, index);
    }
    return result;
  };

  // Converts lists into objects. Pass either a single array of `[key, value]`
  // pairs, or two parallel arrays of the same length -- one of keys, and one of
  // the corresponding values.
  _.object = function(list, values) {
    var result = {};
    for (var i = 0, length = getLength(list); i < length; i++) {
      if (values) {
        result[list[i]] = values[i];
      } else {
        result[list[i][0]] = list[i][1];
      }
    }
    return result;
  };

  // Generator function to create the findIndex and findLastIndex functions
  function createPredicateIndexFinder(dir) {
    return function(array, predicate, context) {
      predicate = cb(predicate, context);
      var length = getLength(array);
      var index = dir > 0 ? 0 : length - 1;
      for (; index >= 0 && index < length; index += dir) {
        if (predicate(array[index], index, array)) return index;
      }
      return -1;
    };
  }

  // Returns the first index on an array-like that passes a predicate test
  _.findIndex = createPredicateIndexFinder(1);
  _.findLastIndex = createPredicateIndexFinder(-1);

  // Use a comparator function to figure out the smallest index at which
  // an object should be inserted so as to maintain order. Uses binary search.
  _.sortedIndex = function(array, obj, iteratee, context) {
    iteratee = cb(iteratee, context, 1);
    var value = iteratee(obj);
    var low = 0, high = getLength(array);
    while (low < high) {
      var mid = Math.floor((low + high) / 2);
      if (iteratee(array[mid]) < value) low = mid + 1; else high = mid;
    }
    return low;
  };

  // Generator function to create the indexOf and lastIndexOf functions
  function createIndexFinder(dir, predicateFind, sortedIndex) {
    return function(array, item, idx) {
      var i = 0, length = getLength(array);
      if (typeof idx == 'number') {
        if (dir > 0) {
            i = idx >= 0 ? idx : Math.max(idx + length, i);
        } else {
            length = idx >= 0 ? Math.min(idx + 1, length) : idx + length + 1;
        }
      } else if (sortedIndex && idx && length) {
        idx = sortedIndex(array, item);
        return array[idx] === item ? idx : -1;
      }
      if (item !== item) {
        idx = predicateFind(slice.call(array, i, length), _.isNaN);
        return idx >= 0 ? idx + i : -1;
      }
      for (idx = dir > 0 ? i : length - 1; idx >= 0 && idx < length; idx += dir) {
        if (array[idx] === item) return idx;
      }
      return -1;
    };
  }

  // Return the position of the first occurrence of an item in an array,
  // or -1 if the item is not included in the array.
  // If the array is large and already in sort order, pass `true`
  // for **isSorted** to use binary search.
  _.indexOf = createIndexFinder(1, _.findIndex, _.sortedIndex);
  _.lastIndexOf = createIndexFinder(-1, _.findLastIndex);

  // Generate an integer Array containing an arithmetic progression. A port of
  // the native Python `range()` function. See
  // [the Python documentation](http://docs.python.org/library/functions.html#range).
  _.range = function(start, stop, step) {
    if (stop == null) {
      stop = start || 0;
      start = 0;
    }
    step = step || 1;

    var length = Math.max(Math.ceil((stop - start) / step), 0);
    var range = Array(length);

    for (var idx = 0; idx < length; idx++, start += step) {
      range[idx] = start;
    }

    return range;
  };

  // Function (ahem) Functions
  // ------------------

  // Determines whether to execute a function as a constructor
  // or a normal function with the provided arguments
  var executeBound = function(sourceFunc, boundFunc, context, callingContext, args) {
    if (!(callingContext instanceof boundFunc)) return sourceFunc.apply(context, args);
    var self = baseCreate(sourceFunc.prototype);
    var result = sourceFunc.apply(self, args);
    if (_.isObject(result)) return result;
    return self;
  };

  // Create a function bound to a given object (assigning `this`, and arguments,
  // optionally). Delegates to **ECMAScript 5**'s native `Function.bind` if
  // available.
  _.bind = function(func, context) {
    if (nativeBind && func.bind === nativeBind) return nativeBind.apply(func, slice.call(arguments, 1));
    if (!_.isFunction(func)) throw new TypeError('Bind must be called on a function');
    var args = slice.call(arguments, 2);
    var bound = function() {
      return executeBound(func, bound, context, this, args.concat(slice.call(arguments)));
    };
    return bound;
  };

  // Partially apply a function by creating a version that has had some of its
  // arguments pre-filled, without changing its dynamic `this` context. _ acts
  // as a placeholder, allowing any combination of arguments to be pre-filled.
  _.partial = function(func) {
    var boundArgs = slice.call(arguments, 1);
    var bound = function() {
      var position = 0, length = boundArgs.length;
      var args = Array(length);
      for (var i = 0; i < length; i++) {
        args[i] = boundArgs[i] === _ ? arguments[position++] : boundArgs[i];
      }
      while (position < arguments.length) args.push(arguments[position++]);
      return executeBound(func, bound, this, this, args);
    };
    return bound;
  };

  // Bind a number of an object's methods to that object. Remaining arguments
  // are the method names to be bound. Useful for ensuring that all callbacks
  // defined on an object belong to it.
  _.bindAll = function(obj) {
    var i, length = arguments.length, key;
    if (length <= 1) throw new Error('bindAll must be passed function names');
    for (i = 1; i < length; i++) {
      key = arguments[i];
      obj[key] = _.bind(obj[key], obj);
    }
    return obj;
  };

  // Memoize an expensive function by storing its results.
  _.memoize = function(func, hasher) {
    var memoize = function(key) {
      var cache = memoize.cache;
      var address = '' + (hasher ? hasher.apply(this, arguments) : key);
      if (!_.has(cache, address)) cache[address] = func.apply(this, arguments);
      return cache[address];
    };
    memoize.cache = {};
    return memoize;
  };

  // Delays a function for the given number of milliseconds, and then calls
  // it with the arguments supplied.
  _.delay = function(func, wait) {
    var args = slice.call(arguments, 2);
    return setTimeout(function(){
      return func.apply(null, args);
    }, wait);
  };

  // Defers a function, scheduling it to run after the current call stack has
  // cleared.
  _.defer = _.partial(_.delay, _, 1);

  // Returns a function, that, when invoked, will only be triggered at most once
  // during a given window of time. Normally, the throttled function will run
  // as much as it can, without ever going more than once per `wait` duration;
  // but if you'd like to disable the execution on the leading edge, pass
  // `{leading: false}`. To disable execution on the trailing edge, ditto.
  _.throttle = function(func, wait, options) {
    var context, args, result;
    var timeout = null;
    var previous = 0;
    if (!options) options = {};
    var later = function() {
      previous = options.leading === false ? 0 : _.now();
      timeout = null;
      result = func.apply(context, args);
      if (!timeout) context = args = null;
    };
    return function() {
      var now = _.now();
      if (!previous && options.leading === false) previous = now;
      var remaining = wait - (now - previous);
      context = this;
      args = arguments;
      if (remaining <= 0 || remaining > wait) {
        if (timeout) {
          clearTimeout(timeout);
          timeout = null;
        }
        previous = now;
        result = func.apply(context, args);
        if (!timeout) context = args = null;
      } else if (!timeout && options.trailing !== false) {
        timeout = setTimeout(later, remaining);
      }
      return result;
    };
  };

  // Returns a function, that, as long as it continues to be invoked, will not
  // be triggered. The function will be called after it stops being called for
  // N milliseconds. If `immediate` is passed, trigger the function on the
  // leading edge, instead of the trailing.
  _.debounce = function(func, wait, immediate) {
    var timeout, args, context, timestamp, result;

    var later = function() {
      var last = _.now() - timestamp;

      if (last < wait && last >= 0) {
        timeout = setTimeout(later, wait - last);
      } else {
        timeout = null;
        if (!immediate) {
          result = func.apply(context, args);
          if (!timeout) context = args = null;
        }
      }
    };

    return function() {
      context = this;
      args = arguments;
      timestamp = _.now();
      var callNow = immediate && !timeout;
      if (!timeout) timeout = setTimeout(later, wait);
      if (callNow) {
        result = func.apply(context, args);
        context = args = null;
      }

      return result;
    };
  };

  // Returns the first function passed as an argument to the second,
  // allowing you to adjust arguments, run code before and after, and
  // conditionally execute the original function.
  _.wrap = function(func, wrapper) {
    return _.partial(wrapper, func);
  };

  // Returns a negated version of the passed-in predicate.
  _.negate = function(predicate) {
    return function() {
      return !predicate.apply(this, arguments);
    };
  };

  // Returns a function that is the composition of a list of functions, each
  // consuming the return value of the function that follows.
  _.compose = function() {
    var args = arguments;
    var start = args.length - 1;
    return function() {
      var i = start;
      var result = args[start].apply(this, arguments);
      while (i--) result = args[i].call(this, result);
      return result;
    };
  };

  // Returns a function that will only be executed on and after the Nth call.
  _.after = function(times, func) {
    return function() {
      if (--times < 1) {
        return func.apply(this, arguments);
      }
    };
  };

  // Returns a function that will only be executed up to (but not including) the Nth call.
  _.before = function(times, func) {
    var memo;
    return function() {
      if (--times > 0) {
        memo = func.apply(this, arguments);
      }
      if (times <= 1) func = null;
      return memo;
    };
  };

  // Returns a function that will be executed at most one time, no matter how
  // often you call it. Useful for lazy initialization.
  _.once = _.partial(_.before, 2);

  // Object Functions
  // ----------------

  // Keys in IE < 9 that won't be iterated by `for key in ...` and thus missed.
  var hasEnumBug = !{toString: null}.propertyIsEnumerable('toString');
  var nonEnumerableProps = ['valueOf', 'isPrototypeOf', 'toString',
                      'propertyIsEnumerable', 'hasOwnProperty', 'toLocaleString'];

  function collectNonEnumProps(obj, keys) {
    var nonEnumIdx = nonEnumerableProps.length;
    var constructor = obj.constructor;
    var proto = (_.isFunction(constructor) && constructor.prototype) || ObjProto;

    // Constructor is a special case.
    var prop = 'constructor';
    if (_.has(obj, prop) && !_.contains(keys, prop)) keys.push(prop);

    while (nonEnumIdx--) {
      prop = nonEnumerableProps[nonEnumIdx];
      if (prop in obj && obj[prop] !== proto[prop] && !_.contains(keys, prop)) {
        keys.push(prop);
      }
    }
  }

  // Retrieve the names of an object's own properties.
  // Delegates to **ECMAScript 5**'s native `Object.keys`
  _.keys = function(obj) {
    if (!_.isObject(obj)) return [];
    if (nativeKeys) return nativeKeys(obj);
    var keys = [];
    for (var key in obj) if (_.has(obj, key)) keys.push(key);
    // Ahem, IE < 9.
    if (hasEnumBug) collectNonEnumProps(obj, keys);
    return keys;
  };

  // Retrieve all the property names of an object.
  _.allKeys = function(obj) {
    if (!_.isObject(obj)) return [];
    var keys = [];
    for (var key in obj) keys.push(key);
    // Ahem, IE < 9.
    if (hasEnumBug) collectNonEnumProps(obj, keys);
    return keys;
  };

  // Retrieve the values of an object's properties.
  _.values = function(obj) {
    var keys = _.keys(obj);
    var length = keys.length;
    var values = Array(length);
    for (var i = 0; i < length; i++) {
      values[i] = obj[keys[i]];
    }
    return values;
  };

  // Returns the results of applying the iteratee to each element of the object
  // In contrast to _.map it returns an object
  _.mapObject = function(obj, iteratee, context) {
    iteratee = cb(iteratee, context);
    var keys =  _.keys(obj),
          length = keys.length,
          results = {},
          currentKey;
      for (var index = 0; index < length; index++) {
        currentKey = keys[index];
        results[currentKey] = iteratee(obj[currentKey], currentKey, obj);
      }
      return results;
  };

  // Convert an object into a list of `[key, value]` pairs.
  _.pairs = function(obj) {
    var keys = _.keys(obj);
    var length = keys.length;
    var pairs = Array(length);
    for (var i = 0; i < length; i++) {
      pairs[i] = [keys[i], obj[keys[i]]];
    }
    return pairs;
  };

  // Invert the keys and values of an object. The values must be serializable.
  _.invert = function(obj) {
    var result = {};
    var keys = _.keys(obj);
    for (var i = 0, length = keys.length; i < length; i++) {
      result[obj[keys[i]]] = keys[i];
    }
    return result;
  };

  // Return a sorted list of the function names available on the object.
  // Aliased as `methods`
  _.functions = _.methods = function(obj) {
    var names = [];
    for (var key in obj) {
      if (_.isFunction(obj[key])) names.push(key);
    }
    return names.sort();
  };

  // Extend a given object with all the properties in passed-in object(s).
  _.extend = createAssigner(_.allKeys);

  // Assigns a given object with all the own properties in the passed-in object(s)
  // (https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Object/assign)
  _.extendOwn = _.assign = createAssigner(_.keys);

  // Returns the first key on an object that passes a predicate test
  _.findKey = function(obj, predicate, context) {
    predicate = cb(predicate, context);
    var keys = _.keys(obj), key;
    for (var i = 0, length = keys.length; i < length; i++) {
      key = keys[i];
      if (predicate(obj[key], key, obj)) return key;
    }
  };

  // Return a copy of the object only containing the whitelisted properties.
  _.pick = function(object, oiteratee, context) {
    var result = {}, obj = object, iteratee, keys;
    if (obj == null) return result;
    if (_.isFunction(oiteratee)) {
      keys = _.allKeys(obj);
      iteratee = optimizeCb(oiteratee, context);
    } else {
      keys = flatten(arguments, false, false, 1);
      iteratee = function(value, key, obj) { return key in obj; };
      obj = Object(obj);
    }
    for (var i = 0, length = keys.length; i < length; i++) {
      var key = keys[i];
      var value = obj[key];
      if (iteratee(value, key, obj)) result[key] = value;
    }
    return result;
  };

   // Return a copy of the object without the blacklisted properties.
  _.omit = function(obj, iteratee, context) {
    if (_.isFunction(iteratee)) {
      iteratee = _.negate(iteratee);
    } else {
      var keys = _.map(flatten(arguments, false, false, 1), String);
      iteratee = function(value, key) {
        return !_.contains(keys, key);
      };
    }
    return _.pick(obj, iteratee, context);
  };

  // Fill in a given object with default properties.
  _.defaults = createAssigner(_.allKeys, true);

  // Creates an object that inherits from the given prototype object.
  // If additional properties are provided then they will be added to the
  // created object.
  _.create = function(prototype, props) {
    var result = baseCreate(prototype);
    if (props) _.extendOwn(result, props);
    return result;
  };

  // Create a (shallow-cloned) duplicate of an object.
  _.clone = function(obj) {
    if (!_.isObject(obj)) return obj;
    return _.isArray(obj) ? obj.slice() : _.extend({}, obj);
  };

  // Invokes interceptor with the obj, and then returns obj.
  // The primary purpose of this method is to "tap into" a method chain, in
  // order to perform operations on intermediate results within the chain.
  _.tap = function(obj, interceptor) {
    interceptor(obj);
    return obj;
  };

  // Returns whether an object has a given set of `key:value` pairs.
  _.isMatch = function(object, attrs) {
    var keys = _.keys(attrs), length = keys.length;
    if (object == null) return !length;
    var obj = Object(object);
    for (var i = 0; i < length; i++) {
      var key = keys[i];
      if (attrs[key] !== obj[key] || !(key in obj)) return false;
    }
    return true;
  };


  // Internal recursive comparison function for `isEqual`.
  var eq = function(a, b, aStack, bStack) {
    // Identical objects are equal. `0 === -0`, but they aren't identical.
    // See the [Harmony `egal` proposal](http://wiki.ecmascript.org/doku.php?id=harmony:egal).
    if (a === b) return a !== 0 || 1 / a === 1 / b;
    // A strict comparison is necessary because `null == undefined`.
    if (a == null || b == null) return a === b;
    // Unwrap any wrapped objects.
    if (a instanceof _) a = a._wrapped;
    if (b instanceof _) b = b._wrapped;
    // Compare `[[Class]]` names.
    var className = toString.call(a);
    if (className !== toString.call(b)) return false;
    switch (className) {
      // Strings, numbers, regular expressions, dates, and booleans are compared by value.
      case '[object RegExp]':
      // RegExps are coerced to strings for comparison (Note: '' + /a/i === '/a/i')
      case '[object String]':
        // Primitives and their corresponding object wrappers are equivalent; thus, `"5"` is
        // equivalent to `new String("5")`.
        return '' + a === '' + b;
      case '[object Number]':
        // `NaN`s are equivalent, but non-reflexive.
        // Object(NaN) is equivalent to NaN
        if (+a !== +a) return +b !== +b;
        // An `egal` comparison is performed for other numeric values.
        return +a === 0 ? 1 / +a === 1 / b : +a === +b;
      case '[object Date]':
      case '[object Boolean]':
        // Coerce dates and booleans to numeric primitive values. Dates are compared by their
        // millisecond representations. Note that invalid dates with millisecond representations
        // of `NaN` are not equivalent.
        return +a === +b;
    }

    var areArrays = className === '[object Array]';
    if (!areArrays) {
      if (typeof a != 'object' || typeof b != 'object') return false;

      // Objects with different constructors are not equivalent, but `Object`s or `Array`s
      // from different frames are.
      var aCtor = a.constructor, bCtor = b.constructor;
      if (aCtor !== bCtor && !(_.isFunction(aCtor) && aCtor instanceof aCtor &&
                               _.isFunction(bCtor) && bCtor instanceof bCtor)
                          && ('constructor' in a && 'constructor' in b)) {
        return false;
      }
    }
    // Assume equality for cyclic structures. The algorithm for detecting cyclic
    // structures is adapted from ES 5.1 section 15.12.3, abstract operation `JO`.

    // Initializing stack of traversed objects.
    // It's done here since we only need them for objects and arrays comparison.
    aStack = aStack || [];
    bStack = bStack || [];
    var length = aStack.length;
    while (length--) {
      // Linear search. Performance is inversely proportional to the number of
      // unique nested structures.
      if (aStack[length] === a) return bStack[length] === b;
    }

    // Add the first object to the stack of traversed objects.
    aStack.push(a);
    bStack.push(b);

    // Recursively compare objects and arrays.
    if (areArrays) {
      // Compare array lengths to determine if a deep comparison is necessary.
      length = a.length;
      if (length !== b.length) return false;
      // Deep compare the contents, ignoring non-numeric properties.
      while (length--) {
        if (!eq(a[length], b[length], aStack, bStack)) return false;
      }
    } else {
      // Deep compare objects.
      var keys = _.keys(a), key;
      length = keys.length;
      // Ensure that both objects contain the same number of properties before comparing deep equality.
      if (_.keys(b).length !== length) return false;
      while (length--) {
        // Deep compare each member
        key = keys[length];
        if (!(_.has(b, key) && eq(a[key], b[key], aStack, bStack))) return false;
      }
    }
    // Remove the first object from the stack of traversed objects.
    aStack.pop();
    bStack.pop();
    return true;
  };

  // Perform a deep comparison to check if two objects are equal.
  _.isEqual = function(a, b) {
    return eq(a, b);
  };

  // Is a given array, string, or object empty?
  // An "empty" object has no enumerable own-properties.
  _.isEmpty = function(obj) {
    if (obj == null) return true;
    if (isArrayLike(obj) && (_.isArray(obj) || _.isString(obj) || _.isArguments(obj))) return obj.length === 0;
    return _.keys(obj).length === 0;
  };

  // Is a given value a DOM element?
  _.isElement = function(obj) {
    return !!(obj && obj.nodeType === 1);
  };

  // Is a given value an array?
  // Delegates to ECMA5's native Array.isArray
  _.isArray = nativeIsArray || function(obj) {
    return toString.call(obj) === '[object Array]';
  };

  // Is a given variable an object?
  _.isObject = function(obj) {
    var type = typeof obj;
    return type === 'function' || type === 'object' && !!obj;
  };

  // Add some isType methods: isArguments, isFunction, isString, isNumber, isDate, isRegExp, isError.
  _.each(['Arguments', 'Function', 'String', 'Number', 'Date', 'RegExp', 'Error'], function(name) {
    _['is' + name] = function(obj) {
      return toString.call(obj) === '[object ' + name + ']';
    };
  });

  // Define a fallback version of the method in browsers (ahem, IE < 9), where
  // there isn't any inspectable "Arguments" type.
  if (!_.isArguments(arguments)) {
    _.isArguments = function(obj) {
      return _.has(obj, 'callee');
    };
  }

  // Optimize `isFunction` if appropriate. Work around some typeof bugs in old v8,
  // IE 11 (#1621), and in Safari 8 (#1929).
  if (typeof /./ != 'function' && typeof Int8Array != 'object') {
    _.isFunction = function(obj) {
      return typeof obj == 'function' || false;
    };
  }

  // Is a given object a finite number?
  _.isFinite = function(obj) {
    return isFinite(obj) && !isNaN(parseFloat(obj));
  };

  // Is the given value `NaN`? (NaN is the only number which does not equal itself).
  _.isNaN = function(obj) {
    return _.isNumber(obj) && obj !== +obj;
  };

  // Is a given value a boolean?
  _.isBoolean = function(obj) {
    return obj === true || obj === false || toString.call(obj) === '[object Boolean]';
  };

  // Is a given value equal to null?
  _.isNull = function(obj) {
    return obj === null;
  };

  // Is a given variable undefined?
  _.isUndefined = function(obj) {
    return obj === void 0;
  };

  // Shortcut function for checking if an object has a given property directly
  // on itself (in other words, not on a prototype).
  _.has = function(obj, key) {
    return obj != null && hasOwnProperty.call(obj, key);
  };

  // Utility Functions
  // -----------------

  // Run Underscore.js in *noConflict* mode, returning the `_` variable to its
  // previous owner. Returns a reference to the Underscore object.
  _.noConflict = function() {
    root._ = previousUnderscore;
    return this;
  };

  // Keep the identity function around for default iteratees.
  _.identity = function(value) {
    return value;
  };

  // Predicate-generating functions. Often useful outside of Underscore.
  _.constant = function(value) {
    return function() {
      return value;
    };
  };

  _.noop = function(){};

  _.property = property;

  // Generates a function for a given object that returns a given property.
  _.propertyOf = function(obj) {
    return obj == null ? function(){} : function(key) {
      return obj[key];
    };
  };

  // Returns a predicate for checking whether an object has a given set of
  // `key:value` pairs.
  _.matcher = _.matches = function(attrs) {
    attrs = _.extendOwn({}, attrs);
    return function(obj) {
      return _.isMatch(obj, attrs);
    };
  };

  // Run a function **n** times.
  _.times = function(n, iteratee, context) {
    var accum = Array(Math.max(0, n));
    iteratee = optimizeCb(iteratee, context, 1);
    for (var i = 0; i < n; i++) accum[i] = iteratee(i);
    return accum;
  };

  // Return a random integer between min and max (inclusive).
  _.random = function(min, max) {
    if (max == null) {
      max = min;
      min = 0;
    }
    return min + Math.floor(Math.random() * (max - min + 1));
  };

  // A (possibly faster) way to get the current timestamp as an integer.
  _.now = Date.now || function() {
    return new Date().getTime();
  };

   // List of HTML entities for escaping.
  var escapeMap = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#x27;',
    '`': '&#x60;'
  };
  var unescapeMap = _.invert(escapeMap);

  // Functions for escaping and unescaping strings to/from HTML interpolation.
  var createEscaper = function(map) {
    var escaper = function(match) {
      return map[match];
    };
    // Regexes for identifying a key that needs to be escaped
    var source = '(?:' + _.keys(map).join('|') + ')';
    var testRegexp = RegExp(source);
    var replaceRegexp = RegExp(source, 'g');
    return function(string) {
      string = string == null ? '' : '' + string;
      return testRegexp.test(string) ? string.replace(replaceRegexp, escaper) : string;
    };
  };
  _.escape = createEscaper(escapeMap);
  _.unescape = createEscaper(unescapeMap);

  // If the value of the named `property` is a function then invoke it with the
  // `object` as context; otherwise, return it.
  _.result = function(object, property, fallback) {
    var value = object == null ? void 0 : object[property];
    if (value === void 0) {
      value = fallback;
    }
    return _.isFunction(value) ? value.call(object) : value;
  };

  // Generate a unique integer id (unique within the entire client session).
  // Useful for temporary DOM ids.
  var idCounter = 0;
  _.uniqueId = function(prefix) {
    var id = ++idCounter + '';
    return prefix ? prefix + id : id;
  };

  // By default, Underscore uses ERB-style template delimiters, change the
  // following template settings to use alternative delimiters.
  _.templateSettings = {
    evaluate    : /<%([\s\S]+?)%>/g,
    interpolate : /<%=([\s\S]+?)%>/g,
    escape      : /<%-([\s\S]+?)%>/g
  };

  // When customizing `templateSettings`, if you don't want to define an
  // interpolation, evaluation or escaping regex, we need one that is
  // guaranteed not to match.
  var noMatch = /(.)^/;

  // Certain characters need to be escaped so that they can be put into a
  // string literal.
  var escapes = {
    "'":      "'",
    '\\':     '\\',
    '\r':     'r',
    '\n':     'n',
    '\u2028': 'u2028',
    '\u2029': 'u2029'
  };

  var escaper = /\\|'|\r|\n|\u2028|\u2029/g;

  var escapeChar = function(match) {
    return '\\' + escapes[match];
  };

  // JavaScript micro-templating, similar to John Resig's implementation.
  // Underscore templating handles arbitrary delimiters, preserves whitespace,
  // and correctly escapes quotes within interpolated code.
  // NB: `oldSettings` only exists for backwards compatibility.
  _.template = function(text, settings, oldSettings) {
    if (!settings && oldSettings) settings = oldSettings;
    settings = _.defaults({}, settings, _.templateSettings);

    // Combine delimiters into one regular expression via alternation.
    var matcher = RegExp([
      (settings.escape || noMatch).source,
      (settings.interpolate || noMatch).source,
      (settings.evaluate || noMatch).source
    ].join('|') + '|$', 'g');

    // Compile the template source, escaping string literals appropriately.
    var index = 0;
    var source = "__p+='";
    text.replace(matcher, function(match, escape, interpolate, evaluate, offset) {
      source += text.slice(index, offset).replace(escaper, escapeChar);
      index = offset + match.length;

      if (escape) {
        source += "'+\n((__t=(" + escape + "))==null?'':_.escape(__t))+\n'";
      } else if (interpolate) {
        source += "'+\n((__t=(" + interpolate + "))==null?'':__t)+\n'";
      } else if (evaluate) {
        source += "';\n" + evaluate + "\n__p+='";
      }

      // Adobe VMs need the match returned to produce the correct offest.
      return match;
    });
    source += "';\n";

    // If a variable is not specified, place data values in local scope.
    if (!settings.variable) source = 'with(obj||{}){\n' + source + '}\n';

    source = "var __t,__p='',__j=Array.prototype.join," +
      "print=function(){__p+=__j.call(arguments,'');};\n" +
      source + 'return __p;\n';

    try {
      var render = new Function(settings.variable || 'obj', '_', source);
    } catch (e) {
      e.source = source;
      throw e;
    }

    var template = function(data) {
      return render.call(this, data, _);
    };

    // Provide the compiled source as a convenience for precompilation.
    var argument = settings.variable || 'obj';
    template.source = 'function(' + argument + '){\n' + source + '}';

    return template;
  };

  // Add a "chain" function. Start chaining a wrapped Underscore object.
  _.chain = function(obj) {
    var instance = _(obj);
    instance._chain = true;
    return instance;
  };

  // OOP
  // ---------------
  // If Underscore is called as a function, it returns a wrapped object that
  // can be used OO-style. This wrapper holds altered versions of all the
  // underscore functions. Wrapped objects may be chained.

  // Helper function to continue chaining intermediate results.
  var result = function(instance, obj) {
    return instance._chain ? _(obj).chain() : obj;
  };

  // Add your own custom functions to the Underscore object.
  _.mixin = function(obj) {
    _.each(_.functions(obj), function(name) {
      var func = _[name] = obj[name];
      _.prototype[name] = function() {
        var args = [this._wrapped];
        push.apply(args, arguments);
        return result(this, func.apply(_, args));
      };
    });
  };

  // Add all of the Underscore functions to the wrapper object.
  _.mixin(_);

  // Add all mutator Array functions to the wrapper.
  _.each(['pop', 'push', 'reverse', 'shift', 'sort', 'splice', 'unshift'], function(name) {
    var method = ArrayProto[name];
    _.prototype[name] = function() {
      var obj = this._wrapped;
      method.apply(obj, arguments);
      if ((name === 'shift' || name === 'splice') && obj.length === 0) delete obj[0];
      return result(this, obj);
    };
  });

  // Add all accessor Array functions to the wrapper.
  _.each(['concat', 'join', 'slice'], function(name) {
    var method = ArrayProto[name];
    _.prototype[name] = function() {
      return result(this, method.apply(this._wrapped, arguments));
    };
  });

  // Extracts the result from a wrapped and chained object.
  _.prototype.value = function() {
    return this._wrapped;
  };

  // Provide unwrapping proxy for some methods used in engine operations
  // such as arithmetic and JSON stringification.
  _.prototype.valueOf = _.prototype.toJSON = _.prototype.value;

  _.prototype.toString = function() {
    return '' + this._wrapped;
  };

  // AMD registration happens at the end for compatibility with AMD loaders
  // that may not enforce next-turn semantics on modules. Even though general
  // practice for AMD registration is to be anonymous, underscore registers
  // as a named module because, like jQuery, it is a base library that is
  // popular enough to be bundled in a third party lib, but not be part of
  // an AMD load request. Those cases could generate an error when an
  // anonymous define() is called outside of a loader request.
  if (typeof define === 'function' && define.amd) {
    define('underscore', [], function() {
      return _;
    });
  }
}.call(this));

});

require.define("/lib/timezone-js.js",function(require,module,exports,__dirname,__filename,process,global){/*
 * Copyright 2010 Matthew Eernisse (mde@fleegix.org)
 * and Open Source Applications Foundation
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 * Credits: Ideas included from incomplete JS implementation of Olson
 * parser, "XMLDAte" by Philippe Goetz (philippe.goetz@wanadoo.fr)
 *
 * Contributions:
 * Jan Niehusmann
 * Ricky Romero
 * Preston Hunt (prestonhunt@gmail.com),
 * Dov. B Katz (dov.katz@morganstanley.com),
 * Peter Bergström (pbergstr@mac.com)
*/
if (typeof fleegix == 'undefined') { var fleegix = {}; }
if (typeof exports.timezoneJS == 'undefined') { exports.timezoneJS = {}; }

fs = require('fs');
path = require('path');
utils = require('../src/utils');

exports.timezoneJS.timezone = new function() {
  var _this = this;
  var monthMap = { 'jan': 0, 'feb': 1, 'mar': 2, 'apr': 3,'may': 4, 'jun': 5,
    'jul': 6, 'aug': 7, 'sep': 8, 'oct': 9, 'nov': 10, 'dec': 11 };
  var dayMap = {'sun': 0,'mon' :1, 'tue': 2, 'wed': 3, 'thu': 4, 'fri': 5, 'sat': 6 };
  var regionMap = {'EST':'northamerica','MST':'northamerica','HST':'northamerica','EST5EDT':'northamerica','CST6CDT':'northamerica','MST7MDT':'northamerica','PST8PDT':'northamerica','America':'northamerica','Pacific':'australasia','Atlantic':'europe','Africa':'africa','Indian':'africa','Antarctica':'antarctica','Asia':'asia','Australia':'australasia','Europe':'europe','WET':'europe','CET':'europe','MET':'europe','EET':'europe'};
  var regionExceptions = {'Pacific/Honolulu':'northamerica','Atlantic/Bermuda':'northamerica','Atlantic/Cape_Verde':'africa','Atlantic/St_Helena':'africa','Indian/Kerguelen':'antarctica','Indian/Chagos':'asia','Indian/Maldives':'asia','Indian/Christmas':'australasia','Indian/Cocos':'australasia','America/Danmarkshavn':'europe','America/Scoresbysund':'europe','America/Godthab':'europe','America/Thule':'europe','Asia/Yekaterinburg':'europe','Asia/Omsk':'europe','Asia/Novosibirsk':'europe','Asia/Krasnoyarsk':'europe','Asia/Irkutsk':'europe','Asia/Yakutsk':'europe','Asia/Vladivostok':'europe','Asia/Sakhalin':'europe','Asia/Magadan':'europe','Asia/Kamchatka':'europe','Asia/Anadyr':'europe','Africa/Ceuta':'europe','America/Argentina/Buenos_Aires':'southamerica','America/Argentina/Cordoba':'southamerica','America/Argentina/Tucuman':'southamerica','America/Argentina/La_Rioja':'southamerica','America/Argentina/San_Juan':'southamerica','America/Argentina/Jujuy':'southamerica','America/Argentina/Catamarca':'southamerica','America/Argentina/Mendoza':'southamerica','America/Argentina/Rio_Gallegos':'southamerica','America/Argentina/Ushuaia':'southamerica','America/Aruba':'southamerica','America/La_Paz':'southamerica','America/Noronha':'southamerica','America/Belem':'southamerica','America/Fortaleza':'southamerica','America/Recife':'southamerica','America/Araguaina':'southamerica','America/Maceio':'southamerica','America/Bahia':'southamerica','America/Sao_Paulo':'southamerica','America/Campo_Grande':'southamerica','America/Cuiaba':'southamerica','America/Porto_Velho':'southamerica','America/Boa_Vista':'southamerica','America/Manaus':'southamerica','America/Eirunepe':'southamerica','America/Rio_Branco':'southamerica','America/Santiago':'southamerica','Pacific/Easter':'southamerica','America/Bogota':'southamerica','America/Curacao':'southamerica','America/Guayaquil':'southamerica','Pacific/Galapagos':'southamerica','Atlantic/Stanley':'southamerica','America/Cayenne':'southamerica','America/Guyana':'southamerica','America/Asuncion':'southamerica','America/Lima':'southamerica','Atlantic/South_Georgia':'southamerica','America/Paramaribo':'southamerica','America/Port_of_Spain':'southamerica','America/Montevideo':'southamerica','America/Caracas':'southamerica'};

  function invalidTZError(t) {
    throw new Error('Timezone "' + t + '" is either incorrect, or not loaded in the timezone registry.');
  }
  function builtInLoadZoneFile(fileName, opts) {
    if (typeof fleegix.xhr == 'undefined') {
      throw new Error('Please use the Fleegix.js XHR module, or define your own transport mechanism for downloading zone files.');
    }
    var url = _this.zoneFileBasePath + '/' + fileName;
    if (!opts.async) {
      var ret = fleegix.xhr.doReq({
        url: url,
        async: false
      });
      return _this.parseZones(ret);
    }
    else {
      return fleegix.xhr.send({
        url: url,
        method: 'get',
        handleSuccess: function (str) {
          if (_this.parseZones(str)) {
            if (typeof opts.callback == 'function') {
              opts.callback();
            }
          }
          return true;
        },
        handleErr: function () {
          throw new Error('Error retrieving "' + url + '" zoneinfo file.');
        }
      });
    }
  }
  
  
  function myLoadZoneFile(fileName, opts) {
    var url = path.join(_this.zoneFileBasePath, fileName) + '.lzw';
    
    // If running in node.js
    if (fs.readFileSync) {
      url = path.join(__dirname, url);

      var ret
      if (fs.existsSync(url)) {
        ret = utils.lzwDecode(fs.readFileSync(url, 'utf8'));
      } else {
        throw new Error('Cannot find ' + url + ' from directory ' + __dirname);
      }
      return _this.parseZones(ret);
    }
    
    // If running in the browser assume tz files are "fileified" into the source and can be "require"d
    var files = require('files');
    var filesName = 'tz/' + fileName + '.lzw'
    if (files[filesName]) {
        return _this.parseZones(utils.lzwDecode(files[filesName]));
    } else {
        throw new Error(filesName + ' not found embedded in this package.');
    };
  }
  
  
  function getRegionForTimezone(tz) {
    var exc = regionExceptions[tz];
    var ret;
    if (exc) {
      return exc;
    }
    else {
      reg = tz.split('/')[0];
      ret = regionMap[reg];
      // If there's nothing listed in the main regions for
      // this TZ, check the 'backward' links
      if (!ret) {
        var link = _this.zones[tz];
        if (typeof link == 'string') {
          return getRegionForTimezone(link);
        }
        else {
          // Backward-compat file hasn't loaded yet, try looking in there
          if (!_this.loadedZones.backward) {
            // This is for obvious legacy zones (e.g., Iceland) that
            // don't even have a prefix like "America/" that look like
            // normal zones
            var parsed = _this.loadZoneFile('backward', true);
            return getRegionForTimezone(tz);
          }
          else {
            invalidTZError(tz);
          }
        }
      }
      return ret;
    }
  }
  function parseTimeString(str) {
    var pat = /(\d+)(?::0*(\d*))?(?::0*(\d*))?([wsugz])?$/;
    var hms = str.match(pat);
    hms[1] = parseInt(hms[1], 10);
    hms[2] = hms[2] ? parseInt(hms[2], 10) : 0;
    hms[3] = hms[3] ? parseInt(hms[3], 10) : 0;
    return hms;
  }
  function getZone(dt, tz) {
    var t = tz;
    var zoneList = _this.zones[t];
    // Follow links to get to an acutal zone
    while (typeof zoneList == "string") {
      t = zoneList;
      zoneList = _this.zones[t];
    }
    if (!zoneList) {
      // Backward-compat file hasn't loaded yet, try looking in there
      if (!_this.loadedZones.backward) {
        // This is for backward entries like "America/Fort_Wayne" that
        // getRegionForTimezone *thinks* it has a region file and zone
        // for (e.g., America => 'northamerica'), but in reality it's a
        // legacy zone we need the backward file for
        var parsed = _this.loadZoneFile('backward', true);
        return getZone(dt, tz);
      }
      invalidTZError(t);
    }
    for(var i = 0; i < zoneList.length; i++) {
      var z = zoneList[i];
      if (!z[3]) { break; }
      var yea = parseInt(z[3], 10);
      var mon = 11;
      var dat = 31;
      if (z[4]) {
        mon = monthMap[z[4].substr(0, 3).toLowerCase()];
        dat = parseInt(z[5], 10);
      }
      var t = z[6] ? z[6] : '23:59:59';
      t = parseTimeString(t);
      var d = Date.UTC(yea, mon, dat, t[1], t[2], t[3]);
      if (dt.getTime() < d) { break; }
    }
    if (i == zoneList.length) { throw new Error('No Zone found for "' + timezone + '" on ' + dt); }
    return zoneList[i];

  }
  function getBasicOffset(z) {
    var off = parseTimeString(z[0]);
    var adj = z[0].indexOf('-') == 0 ? -1 : 1
    off = adj * (((off[1] * 60 + off[2]) *60 + off[3]) * 1000);
    return -off/60/1000;
  }

  // if isUTC is true, date is given in UTC, otherwise it's given
  // in local time (ie. date.getUTC*() returns local time components)
  function getRule( date, zone, isUTC ) {
    var ruleset = zone[1];
    var basicOffset = getBasicOffset( zone );

    // Convert a date to UTC. Depending on the 'type' parameter, the date
    // parameter may be:
    // 'u', 'g', 'z': already UTC (no adjustment)
    // 's': standard time (adjust for time zone offset but not for DST)
    // 'w': wall clock time (adjust for both time zone and DST offset)
    //
    // DST adjustment is done using the rule given as third argument
    var convertDateToUTC = function( date, type, rule ) {
      var offset = 0;

      if(type == 'u' || type == 'g' || type == 'z') { // UTC
          offset = 0;
      } else if(type == 's') { // Standard Time
          offset = basicOffset;
      } else if(type == 'w' || !type ) { // Wall Clock Time
          offset = getAdjustedOffset(basicOffset,rule);
      } else {
          throw("unknown type "+type);
      }
      offset *= 60*1000; // to millis

      return new Date( date.getTime() + offset );
    }

    // Step 1:  Find applicable rules for this year.
    // Step 2:  Sort the rules by effective date.
    // Step 3:  Check requested date to see if a rule has yet taken effect this year.  If not,
    // Step 4:  Get the rules for the previous year.  If there isn't an applicable rule for last year, then
    //      there probably is no current time offset since they seem to explicitly turn off the offset
    //      when someone stops observing DST.
    //      FIXME if this is not the case and we'll walk all the way back (ugh).
    // Step 5:  Sort the rules by effective date.
    // Step 6:  Apply the most recent rule before the current time.

    var convertRuleToExactDateAndTime = function( yearAndRule, prevRule )
    {
      var year = yearAndRule[0];
      var rule = yearAndRule[1];

      // Assume that the rule applies to the year of the given date.
      var months = {
        "Jan": 0, "Feb": 1, "Mar": 2, "Apr": 3, "May": 4, "Jun": 5,
        "Jul": 6, "Aug": 7, "Sep": 8, "Oct": 9, "Nov": 10, "Dec": 11
      };

      var days = {
        "sun": 0, "mon": 1, "tue": 2, "wed": 3, "thu": 4, "fri": 5, "sat": 6
      }

      var hms = parseTimeString( rule[ 5 ] );
      var effectiveDate;

      if ( !isNaN( rule[ 4 ] ) ) // If we have a specific date, use that!
      {
        effectiveDate = new Date( Date.UTC( year, months[ rule[ 3 ] ], rule[ 4 ], hms[ 1 ], hms[ 2 ], hms[ 3 ], 0 ) );
      }
      else // Let's hunt for the date.
      {
        var targetDay,
          operator;

        if ( rule[ 4 ].substr( 0, 4 ) === "last" ) // Example: lastThu
        {
          // Start at the last day of the month and work backward.
          effectiveDate = new Date( Date.UTC( year, months[ rule[ 3 ] ] + 1, 1, hms[ 1 ] - 24, hms[ 2 ], hms[ 3 ], 0 ) );
          targetDay = days[ rule[ 4 ].substr( 4, 3 ).toLowerCase( ) ];
          operator = "<=";
        }
        else // Example: Sun>=15
        {
          // Start at the specified date.
          effectiveDate = new Date( Date.UTC( year, months[ rule[ 3 ] ], rule[ 4 ].substr( 5 ), hms[ 1 ], hms[ 2 ], hms[ 3 ], 0 ) );
          targetDay = days[ rule[ 4 ].substr( 0, 3 ).toLowerCase( ) ];
          operator = rule[ 4 ].substr( 3, 2 );
        }

        var ourDay = effectiveDate.getUTCDay( );

        if ( operator === ">=" ) // Go forwards.
        {
          effectiveDate.setUTCDate( effectiveDate.getUTCDate( ) + ( targetDay - ourDay + ( ( targetDay < ourDay ) ? 7 : 0 ) ) );
        }
        else // Go backwards.  Looking for the last of a certain day, or operator is "<=" (less likely).
        {
          effectiveDate.setUTCDate( effectiveDate.getUTCDate( ) + ( targetDay - ourDay - ( ( targetDay > ourDay ) ? 7 : 0 ) ) );
        }
      }

      // if previous rule is given, correct for the fact that the starting time of the current
      // rule may be specified in local time
      if(prevRule) {
        effectiveDate = convertDateToUTC(effectiveDate, hms[4], prevRule);
      }

      return effectiveDate;
    }

    var findApplicableRules = function( year, ruleset )
    {
      var applicableRules = [];

      for ( var i in ruleset )
      {
        if ( Number( ruleset[ i ][ 0 ] ) <= year ) // Exclude future rules.
        {
          if (
            Number( ruleset[ i ][ 1 ] ) >= year                                            // Date is in a set range.
            || ( Number( ruleset[ i ][ 0 ] ) === year && ruleset[ i ][ 1 ] === "only" )    // Date is in an "only" year.
            || ruleset[ i ][ 1 ] === "max"                                                 // We're in a range from the start year to infinity.
          )
          {
            // It's completely okay to have any number of matches here.
            // Normally we should only see two, but that doesn't preclude other numbers of matches.
            // These matches are applicable to this year.
            applicableRules.push( [year, ruleset[ i ]] );
          }
        }
      }

      return applicableRules;
    }

    var compareDates = function( a, b, prev )
    {
      if ( a.constructor !== Date ) {
        a = convertRuleToExactDateAndTime( a, prev );
      } else if(prev) {
        a = convertDateToUTC(a, isUTC?'u':'w', prev);
      }
      if ( b.constructor !== Date ) {
        b = convertRuleToExactDateAndTime( b, prev );
      } else if(prev) {
        b = convertDateToUTC(b, isUTC?'u':'w', prev);
      }

      a = Number( a );
      b = Number( b );

      return a - b;
    }

    var year = date.getUTCFullYear( );
    var applicableRules;

    applicableRules = findApplicableRules( year, _this.rules[ ruleset ] );
    applicableRules.push( date );
    // While sorting, the time zone in which the rule starting time is specified
    // is ignored. This is ok as long as the timespan between two DST changes is
    // larger than the DST offset, which is probably always true.
    // As the given date may indeed be close to a DST change, it may get sorted
    // to a wrong position (off by one), which is corrected below.
    applicableRules.sort( compareDates );

    if ( applicableRules.indexOf( date ) < 2 ) { // If there are not enough past DST rules...
      applicableRules = applicableRules.concat(findApplicableRules( year-1, _this.rules[ ruleset ] ));
      applicableRules.sort( compareDates );
    }

    var pinpoint = applicableRules.indexOf( date );
    if ( pinpoint > 1 && compareDates( date, applicableRules[pinpoint-1], applicableRules[pinpoint-2][1] ) < 0 ) {
      // the previous rule does not really apply, take the one before that
      return applicableRules[ pinpoint - 2 ][1];
    } else if ( pinpoint > 0 && pinpoint < applicableRules.length - 1 && compareDates( date, applicableRules[pinpoint+1], applicableRules[pinpoint-1][1] ) > 0) {
      // the next rule does already apply, take that one
      return applicableRules[ pinpoint + 1 ][1];
    } else if ( pinpoint === 0 ) {
      // no applicable rule found in this and in previous year
      return null;
    } else {
      return applicableRules[ pinpoint - 1 ][1];
    }
  }
  function getAdjustedOffset(off, rule) {
    var save = rule[6];
    var t = parseTimeString(save);
    var adj = save.indexOf('-') == 0 ? -1 : 1;
    var ret = (adj*(((t[1] *60 + t[2]) * 60 + t[3]) * 1000));
    ret = ret/60/1000;
    ret -= off
    ret = -Math.ceil(ret);
    return ret;
  }
  function getAbbreviation(zone, rule) {
    var res;
    var base = zone[2];
    if (base.indexOf('%s') > -1) {
      var repl;
      if (rule) {
        repl = rule[7]=='-'?'':rule[7];
      }
      // FIXME: Right now just falling back to Standard --
      // apparently ought to use the last valid rule,
      // although in practice that always ought to be Standard
      else {
        repl = 'S';
      }
      res = base.replace('%s', repl);
    }
    else if (base.indexOf('/') > -1) {
      // chose one of two alternative strings
      var t = parseTimeString(rule[6]);
      var isDst = (t[1])||(t[2])||(t[3]);
      res = base.split("/",2)[isDst?1:0];
    } else {
      res = base;
    }
    return res;
  }

  this.zoneFileBasePath;
  this.zoneFiles = ['africa', 'antarctica', 'asia',
    'australasia', 'backward', 'etcetera', 'europe',
    'northamerica', 'pacificnew', 'southamerica'];
  this.loadingSchemes = {
    PRELOAD_ALL: 'preloadAll',
    LAZY_LOAD: 'lazyLoad',
    MANUAL_LOAD: 'manualLoad'
  }
  this.loadingScheme = this.loadingSchemes.PRELOAD_ALL;
  this.defaultZoneFile =
    this.loadingScheme == this.loadingSchemes.PRELOAD_ALL ?
      this.zoneFiles : 'northamerica';
  this.loadedZones = {};
  this.zones = {};
  this.rules = {};

  this.init = function (o) {
    var opts = { async: true };
    var sync = false;
    var def = this.defaultZoneFile;
    var parsed;
    // Override default with any passed-in opts
    for (var p in o) {
      opts[p] = o[p];
    }
    if (typeof def == 'string') {
      throw new Error('in init def==string')
      parsed = this.loadZoneFile(def, opts);
    }
    else {
      var ret
      this.loadedZones['africa'] = true;
      ret = utils.lzwDecode(fs.readFileSync('files/tz/africa.lzw', 'utf8'));
      _this.parseZones(ret);
      this.loadedZones['antarctica'] = true;
      ret = utils.lzwDecode(fs.readFileSync('files/tz/antarctica.lzw', 'utf8'));
      _this.parseZones(ret);
      this.loadedZones['asia'] = true;
      ret = utils.lzwDecode(fs.readFileSync('files/tz/asia.lzw', 'utf8'));
      _this.parseZones(ret);
      this.loadedZones['australasia'] = true;
      ret = utils.lzwDecode(fs.readFileSync('files/tz/australasia.lzw', 'utf8'));
      _this.parseZones(ret);
      this.loadedZones['backward'] = true;
      ret = utils.lzwDecode(fs.readFileSync('files/tz/backward.lzw', 'utf8'));
      _this.parseZones(ret);
      this.loadedZones['etcetera'] = true;
      ret = utils.lzwDecode(fs.readFileSync('files/tz/etcetera.lzw', 'utf8'));
      _this.parseZones(ret);
      this.loadedZones['europe'] = true;
      ret = utils.lzwDecode(fs.readFileSync('files/tz/europe.lzw', 'utf8'));
      _this.parseZones(ret);
      this.loadedZones['northamerica'] = true;
      ret = utils.lzwDecode(fs.readFileSync('files/tz/northamerica.lzw', 'utf8'));
      _this.parseZones(ret);
      this.loadedZones['pacificnew'] = true;
      ret = utils.lzwDecode(fs.readFileSync('files/tz/pacificnew.lzw', 'utf8'));
      _this.parseZones(ret);
      this.loadedZones['southamerica'] = true;
      ret = utils.lzwDecode(fs.readFileSync('files/tz/southamerica.lzw', 'utf8'));
      _this.parseZones(ret);



      //if (opts.callback) {
      //  throw new Error('Async load with callback is not supported for multiple default zonefiles.');
      //}
      //for (var i = 0; i < def.length; i++) {
      //  parsed = this.loadZoneFile(def[i], opts);
      //}
    }
  };
  // Get the zone files via XHR -- if the sync flag
  // is set to true, it's being called by the lazy-loading
  // mechanism, so the result needs to be returned inline
  this.loadZoneFile = function (fileName, opts) {
    throw new Error('timezone-js is trying to load a timezone file that it does not have: ' + fileName);
    if (typeof this.zoneFileBasePath == 'undefined') {
      throw new Error('Please define a base path to your zone file directory -- timezoneJS.timezone.zoneFileBasePath.');
    }
    // ========================
    // Define your own transport mechanism here
    // and comment out the default below
    // ========================
    //if (! this.loadedZones[fileName]) {
    //  this.loadedZones[fileName] = true;
    //  // return builtInLoadZoneFile(fileName, opts);
    //  return myLoadZoneFile(fileName, opts);
    //}

  };
  this.loadZoneJSONData = function (url, sync) {
    var processData = function (data) {
      data = eval('('+ data +')');
      for (var z in data.zones) {
        _this.zones[z] = data.zones[z];
      }
      for (var r in data.rules) {
        _this.rules[r] = data.rules[r];
      }
    }
    if (sync) {
      var data = fleegix.xhr.doGet(url);
      processData(data);
    }
    else {
      fleegix.xhr.doGet(processData, url);
    }
  };
  this.loadZoneDataFromObject = function (data) {
    if (!data) { return; }
    for (var z in data.zones) {
      _this.zones[z] = data.zones[z];
    }
    for (var r in data.rules) {
      _this.rules[r] = data.rules[r];
    }
  };
  this.getAllZones = function() {
    var arr = [];
    for (z in this.zones) { arr.push(z); }
    return arr.sort();
  };
  this.parseZones = function(str) {
    var s = '';
    var lines = str.split('\n');
    var arr = [];
    var chunk = '';
    var zone = null;
    var rule = null;
    for (var i = 0; i < lines.length; i++) {
      l = lines[i];
      if (l.match(/^\s/)) {
        l = "Zone " + zone + l;
      }
      l = l.split("#")[0];
      if (l.length > 3) {
        arr = l.split(/\s+/);
        chunk = arr.shift();
        switch(chunk) {
          case 'Zone':
            zone = arr.shift();
            if (!_this.zones[zone]) { _this.zones[zone] = [] }
            _this.zones[zone].push(arr);
            break;
          case 'Rule':
            rule = arr.shift();
            if (!_this.rules[rule]) { _this.rules[rule] = [] }
            _this.rules[rule].push(arr);
            break;
          case 'Link':
            // No zones for these should already exist
            if (_this.zones[arr[1]]) {
              throw new Error('Error with Link ' + arr[1]);
            }
            // Create the link
            _this.zones[arr[1]] = arr[0];
            break;
          case 'Leap':
            break;
          default:
            // Fail silently
            break;
        }
      }
    }
    return true;
  };
  this.getTzInfo = function(dt, tz, isUTC) {
    // Lazy-load any zones not yet loaded
    if (this.loadingScheme == this.loadingSchemes.LAZY_LOAD) {
      // Get the correct region for the zone
      var zoneFile = getRegionForTimezone(tz);
      if (!zoneFile) {
        throw new Error('Not a valid timezone ID.');
      }
      else {
        if (!this.loadedZones[zoneFile]) {
          // Get the file and parse it -- use synchronous XHR
          var parsed = this.loadZoneFile(zoneFile, true);
        }
      }
    }
    var zone = getZone(dt, tz);
    var off = getBasicOffset(zone);
    // See if the offset needs adjustment
    var rule = getRule(dt, zone, isUTC);
    if (rule) {
      off = getAdjustedOffset(off, rule);
    }
    var abbr = getAbbreviation(zone, rule);
    return { tzOffset: off, tzAbbr: abbr };
  }
};
  
exports.timezoneJS.parseISO = function (timestring) {
  var pat = '^(?:([+-]?[0-9]{4,})(?:-([0-9]{2})(?:-([0-9]{2}))?)?)?' +
    '(?:T(?:([0-9]{2})(?::([0-9]{2})(?::([0-9]{2})(?:\\.' +
    '([0-9]{3}))?)?)?)?(Z|[-+][0-9]{2}:[0-9]{2})?)?$';
  var match = timestring.match(pat);
  if (match) {
    var parts = {
      year: match[1] || 0,
      month:  match[2] || 1,
      day:  match[3] || 1,
      hour:  match[4] || 0,
      minute:  match[5] || 0,
      second:  match[6] || 0,
      milli:  match[7] || 0,
      offset:  match[8] || "Z"
    };

    var utcDate = Date.UTC(parts.year, parts.month-1, parts.day,
      parts.hour, parts.minute, parts.second, parts.milli);

    if (parts.offset !== "Z") {
      match = parts.offset.match('([-+][0-9]{2})(?::([0-9]{2}))?');
      if (!match) {
        return NaN;
      }
      var offset = match[1]*60*60*1000+(match[2] || 0)*60*1000;
      utcDate -= offset;
    }
    
    return new Date(utcDate);
  }
  else {
    return null;
  }
};





});

require.define("fs",function(require,module,exports,__dirname,__filename,process,global){// nothing to see here... no file methods for the browser

});

require.define("/src/Timeline.js",function(require,module,exports,__dirname,__filename,process,global){// Generated by CoffeeScript 1.9.3
(function() {
  var Time, Timeline, TimelineIterator, timezoneJS, utils,
    indexOf = [].indexOf || function(item) { for (var i = 0, l = this.length; i < l; i++) { if (i in this && this[i] === item) return i; } return -1; };

  Time = require('./Time').Time;

  timezoneJS = require('./../lib/timezone-js.js').timezoneJS;

  utils = require('./utils');

  Timeline = (function() {

    /*
    @class Timeline
    
    Allows you to specify a timeline with weekend, holiday and non-work hours knocked out and timezone precision.
    
    ## Basic usage ##
    
        {TimelineIterator, Timeline, Time} = require('../')
    
        tl = new Timeline({
          startOn: '2011-01-03',
          endBefore: '2011-01-05',
        })
    
        console.log(t.toString() for t in tl.getAll())
         * [ '2011-01-03', '2011-01-04' ]
    
    Notice how the endBefore, '2011-01-05', is excluded. Timelines are inclusive of the startOn and exclusive of the
    endBefore. This allows the endBefore to be the startOn of the next with no overlap or gap. This focus on precision
    pervades the design of the Time library.
    
    Perhaps the most common use of Timeline is to return a Timeline of ISOStrings shifted to the correct timezone.
    Since ISOString comparisons give the expected chronological results and many APIs return their date/time stamps as
    ISOStrings, it's convenient and surprisingly fast to do your own bucketing operations after you've gotten a Timeline
    of ISOStrings.
    
        console.log(tl.getAll('ISOString', 'America/New_York'))
         * [ '2011-01-03T05:00:00.000Z', '2011-01-04T05:00:00.000Z' ]
    
    ## More advanced usage ##
     
    Now let's poke at Timeline behavior a little more. Let's start by creating a more advanced Timeline:
    
        tl = new Timeline({
          startOn: '2011-01-02',
          endBefore: '2011-01-07',
          holidays: [
            {month: 1, day: 1},  # Notice the lack of a year specification
            '2011-01-04'  # Got January 4 off also in 2011. Allows ISO strings.
          ]
        })
        
    `workDays` is already defaulted but you could have overridden it.
    
        console.log(tl.workDays)
         * [ 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday' ]
        
    Another common use case is to get a Timeline to return child Timelines. You see, Timelines can be thought of as
    time boxes with a startOn and an endBefore. You might have a big time box for the entire x-axis for a chart
    but if you want to bucket raw data into each tick on the x-axis, you'll need to know where each sub-time box starts
    and ends.
    
        subTimelines = tl.getAll('Timeline')
        console.log((t.startOn.toString() + ' to ' + t.endBefore.toString() for t in subTimelines))
         * [ '2011-01-03 to 2011-01-05',
         *   '2011-01-05 to 2011-01-06',
         *   '2011-01-06 to 2011-01-07' ]
    
    Notice how the first subTimeline went all the way from 03 to 05. That's because we specified 04 as a holiday.
    Timelines are contiguous without gaps or overlap. You can see that the endBefore of one subTimeline is always the startOn
    of the next.
    
    Now, let's create a Timeline with `hour` granularity and show of the concept that Timelines also serve as time boxes by
    learning about the contains() method.
        
        tl2 = new Timeline({
          startOn: '2011-01-02T00',
          endBefore: '2011-01-07T00',
        })
        
    `startOn` is inclusive.
    
        console.log(tl2.contains('2011-01-02T00'))
         * true
        
    But `endBefore` is exclusive
    
        console.log(tl2.contains('2011-01-07T00'))
         * false
    
    But just before `endBefore` is OK
    
        console.log(tl2.contains('2011-01-06T23'))
         * true
    
    All of the above comparisons assume that the `startOn`/`endBefore` boundaries are in the same timezone as the contains date.
    
    ## Timezone sensitive comparisions ##
    
    Now, let's look at how you do timezone sensitive comparisions.
    
    If you pass in a timezone, then it will shift the Timeline boundaries to that timezone to compare to the 
    date/timestamp that you pass in. This system is optimized to the pattern where you first define your boundaries without regard 
    to timezone. Christmas day is a holiday in any timezone. Saturday and Sunday are non work days in any timezone. The iteration
    starts on July 10th; etc. THEN you have a bunch of data that you have stored in a database in GMT. Maybe you've pulled
    it down from an API but the data is represented with ISOString. You then want to decide if the ISOString
    is contained within the iteration as defined by a particular timezone, or is a Saturday, or is during workhours, etc. 
    The key concept to remember is that the timebox boundaries are shifted NOT the other way around. It says at what moment
    in time July 10th starts on in a particular timezone and internally represents that in a way that can be compared to
    an ISOString.
    
    So, when it's 3am in GMT on 2011-01-02, it's still 2011-01-01 in New York. Using the above `tl2` timeline, we say:
    
        console.log(tl2.contains('2011-01-02T03:00:00.000Z', 'America/New_York'))
         * false
        
    But it's still 2011-01-06 in New York, when it's 3am in GMT on 2011-01-07
        
        console.log(tl2.contains('2011-01-07T03:00:00.000Z', 'America/New_York'))
         * true
     */
    function Timeline(config) {

      /*
      @constructor
      @param {Object} config
      
      @cfg {Time/ISOString} [startOn] Unless it falls on a knocked out moment, this is the first value in the resulting Timeline
        If it falls on a knocked out moment, it will advance to the first appropriate moment after startOn.
        You must specify 2 out of 3 of startOn, endBefore, and limit.
      @cfg {Time/ISOString} [endBefore] Must match granularity of startOn. Timeline will stop before returning this value.
        You must specify 2 out of 3 of startOn, endBefore, and limit.
      @cfg {Number} [limit] You can specify limit and either startOn or endBefore and only get back this many.
        You must specify 2 out of 3 of startOn, endBefore, and limit.
      @cfg {Number} [step = 1 or -1] Use -1 to march backwards from endBefore - 1. Currently any
         values other than 1 and -1 are not well tested.
      @cfg {String} [granularity = granularity of startOn or endBefore] Used to determine the granularity of the ticks.
        Note, this can be different from the granularity of startOn and endBefore. For example:
      
          {
            startOn: '2012-01', # Month Granularity
            endBefore: '2012-02', # Month Granularity
            granularity: Time.DAY # Day granularity
          }
      
      @cfg {String[]/String} [workDays =  ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']] List of days of the
        week that you work on. You can specify this as an Array of Strings (['Monday', 'Tuesday', ...]) or a single comma
        seperated String ("Monday,Tuesday,...").
      @cfg {Array} [holidays] An optional Array of either ISOStrings or JavaScript Objects (and you can mix and match). Example:
      
          [{month: 12, day: 25}, {year: 2011, month: 11, day: 24}, "2012-12-24"]
      
         Notice how you can leave off the year if the holiday falls on the same day every year.
      @cfg {Object} [workDayStartOn = {hour: 0, minute: 0}] An optional object in the form {hour: 8, minute: 15}.
        If minute is zero it can be omitted. If workDayStartOn is later than workDayEndBefore, then it assumes that you
        work the night shift and your work  hours span midnight.
      
        The use of workDayStartOn and workDayEndBefore only make sense when the granularity is "hour" or finer.
      
        Note: If the business closes at 5:00pm, you'll want to leave workDayEndBefore to 17:00, rather
        than 17:01. Think about it, you'll be open 4:59:59.999pm, but you'll be closed at 5:00pm. This also makes all of
        the math work. 9am to 5pm means 17 - 9 = an 8 hour work day.
      @cfg {Object} [workDayEndBefore = {hour: 24, minute: 60}] An optional object in the form {hour: 17, minute: 0}.
        If minute is zero it can be omitted.
       */
      var h, holiday, idx, j, len, m, ref, ref1, s;
      this.memoizedTicks = {};
      if (config.endBefore != null) {
        this.endBefore = config.endBefore;
        if (this.endBefore !== 'PAST_LAST') {
          if (utils.type(this.endBefore) === 'string') {
            this.endBefore = new Time(this.endBefore);
          }
          this.granularity = this.endBefore.granularity;
        }
      }
      if (config.startOn != null) {
        this.startOn = config.startOn;
        if (this.startOn !== 'BEFORE_FIRST') {
          if (utils.type(this.startOn) === 'string') {
            this.startOn = new Time(this.startOn);
          }
          this.granularity = this.startOn.granularity;
        }
      }
      if (config.granularity != null) {
        this.granularity = config.granularity;
        if (this.startOn != null) {
          this.startOn = this.startOn.inGranularity(this.granularity);
        }
        if (this.endBefore != null) {
          this.endBefore = this.endBefore.inGranularity(this.granularity);
        }
      }
      if (!this.granularity) {
        throw new Error('Cannot determine granularity for Timeline.');
      }
      if (this.startOn === 'BEFORE_FIRST') {
        this.startOn = new Time(this.startOn, this.granularity);
      }
      if (this.endBefore === 'PAST_LAST') {
        this.endBefore === new Time(this.endBefore, this.granularity);
      }
      if (!this.endBefore) {
        this.endBefore = new Time('PAST_LAST', this.granularity);
      }
      if (!this.startOn) {
        this.startOn = new Time('BEFORE_FIRST', this.granularity);
      }
      this.limit = config.limit != null ? config.limit : utils.MAX_INT;
      if (config.workDays != null) {
        this.workDays = config.workDays;
      } else if (config.workdays != null) {
        this.workDays = config.workdays;
      } else {
        this.workDays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
      }
      if (utils.type(this.workDays) === 'string') {
        this.workDays = (function() {
          var j, len, ref, results;
          ref = this.workDays.split(',');
          results = [];
          for (j = 0, len = ref.length; j < len; j++) {
            s = ref[j];
            results.push(utils.trim(s));
          }
          return results;
        }).call(this);
      }
      this.holidays = config.holidays != null ? config.holidays : [];
      ref = this.holidays;
      for (idx = j = 0, len = ref.length; j < len; idx = ++j) {
        holiday = ref[idx];
        if (utils.type(holiday) === 'string') {
          this.holidays[idx] = new Time(holiday).getSegmentsAsObject();
        }
      }
      this.workDayStartOn = config.workDayStartOn != null ? config.workDayStartOn : void 0;
      if (this.workDayStartOn != null) {
        h = this.workDayStartOn.hour != null ? this.workDayStartOn.hour : 0;
        m = this.workDayStartOn.minute != null ? this.workDayStartOn.minute : 0;
        this.startOnWorkMinutes = h * 60 + m;
        if (this.startOnWorkMinutes < 0) {
          this.startOnWorkMinutes = 0;
        }
      } else {
        this.startOnWorkMinutes = 0;
      }
      this.workDayEndBefore = config.workDayEndBefore != null ? config.workDayEndBefore : void 0;
      if (this.workDayEndBefore != null) {
        h = this.workDayEndBefore.hour != null ? this.workDayEndBefore.hour : 24;
        m = this.workDayEndBefore.minute != null ? this.workDayEndBefore.minute : 0;
        this.endBeforeWorkMinutes = h * 60 + m;
        if (this.endBeforeWorkMinutes > 24 * 60) {
          this.endBeforeWorkMinutes = 24 * 60;
        }
      } else {
        this.endBeforeWorkMinutes = 24 * 60;
      }
      if (config.step != null) {
        this.step = config.step;
      } else if ((config.endBefore != null) && ((ref1 = this.startOn) != null ? ref1.greaterThan(this.endBefore) : void 0)) {
        this.step = -1;
      } else if ((config.endBefore != null) && (config.startOn == null) && (config.limit != null)) {
        this.step = -1;
      } else {
        this.step = 1;
      }
      utils.assert(((config.startOn != null) && (config.endBefore != null)) || ((config.startOn != null) && (config.limit != null) && this.step > 0) || ((config.endBefore != null) && (config.limit != null) && this.step < 0), 'Must provide two out of "startOn", "endBefore", or "limit" and the sign of step must match.');
    }

    Timeline.prototype.getIterator = function(tickType, tz, childGranularity) {
      if (tickType == null) {
        tickType = 'Time';
      }

      /*
      @method getIterator
      @param {String} [tickType] An optional String that specifies what type should be returned on each call to next().
        Possible values are 'Time' (default), 'Timeline', 'Date' (javascript Date Object), and 'ISOString'.
      @param {String} [tz] A Sting specifying the timezone in the standard form,`America/New_York` for example. This is
        required if `tickType` is 'Date' or 'ISOString'.
      @param {String} [childGranularity] When tickType is 'Timeline', this is the granularity for the startOn and endBefore of the
        Timeline that is returned.
      @return {TimelineIterator}
      
      Returns a new TimelineIterator using this Timeline as the boundaries.
       */
      return new TimelineIterator(this, tickType, tz, childGranularity);
    };

    Timeline.prototype.getAllRaw = function(tickType, tz, childGranularity) {
      var temp, tli;
      if (tickType == null) {
        tickType = 'Time';
      }

      /*
      @method getAllRaw
      @param {String} [tickType] An optional String that specifies the type should be returned. Possible values are 'Time' (default),
         'Timeline', 'Date' (javascript Date Object), and 'ISOString'.
      @param {String} [tz] A Sting specifying the timezone in the standard form,`America/New_York` for example. This is
         required if `tickType` is 'Date' or 'ISOString'.
      @param {String} [childGranularity] When tickType is 'Timeline', this is the granularity for the startOn and endBefore of the
         Timeline that is returned.
      @return {Time[]/Date[]/Timeline[]/String[]}
      
      Returns all of the points in the timeline. Note, this will come back in the order specified
      by step so they could be out of chronological order. Use getAll() if they must be in chronological order.
       */
      tli = this.getIterator(tickType, tz, childGranularity);
      temp = [];
      while (tli.hasNext()) {
        temp.push(tli.next());
      }
      return temp;
    };

    Timeline.prototype.getAll = function(tickType, tz, childGranularity) {
      var parameterKey, parameterKeyObject, ticks;
      if (tickType == null) {
        tickType = 'Time';
      }

      /*
      @method getAll
      @param {String} [tickType] An optional String that specifies what should be returned. Possible values are 'Time' (default),
         'Timeline', 'Date' (javascript Date Object), and 'ISOString'.
      @param {String} [tz] A Sting specifying the timezone in the standard form,`America/New_York` for example. This is
         required if `tickType` is 'Date' or 'ISOString'.
      @param {String} [childGranularity] When tickType is 'Timeline', this is the granularity for the startOn and endBefore of the
         Timeline object that is returned.
      @return {Time[]/Date[]/Timeline[]/String[]}
      
      Returns all of the points in the timeline in chronological order. If you want them in the order specified by `step`
      then use getAllRaw(). Note, the output of this function is memoized so that subsequent calls to getAll() for the
      same Timeline instance with the same parameters will return the previously calculated values. This makes it safe
      to call it repeatedly within loops and means you don't need to worry about holding onto the result on the client
      side.
       */
      parameterKeyObject = {
        tickType: tickType
      };
      if (tz != null) {
        parameterKeyObject.tz = tz;
      }
      if (childGranularity != null) {
        parameterKeyObject.childGranularity = childGranularity;
      }
      parameterKey = JSON.stringify(parameterKeyObject);
      ticks = this.memoizedTicks[parameterKey];
      if (ticks == null) {
        ticks = this.getAllRaw(tickType, tz, childGranularity);
        if (ticks.length > 1) {
          if ((ticks[0] instanceof Time && ticks[0].greaterThan(ticks[1])) || (utils.type(ticks[0]) === 'string' && ticks[0] > ticks[1])) {
            ticks.reverse();
          }
        }
        this.memoizedTicks[parameterKey] = ticks;
      }
      return ticks;
    };

    Timeline.prototype.ticksThatIntersect = function(startOn, endBefore, tz) {

      /*
      @method ticksThatIntersect
      @param {Time/ISOString} startOn The start of the time period of interest
      @param {Time/ISOString} endBefore The moment just past the end of the time period of interest
      @param {String} tz The timezone you want to use for the comparison
      @return {Array}
      
      Returns the list of ticks from this Timeline that intersect with the time period specified by the parameters
      startOn and endBefore. This is a convenient way to "tag" a timebox as overlaping with particular moments on
      your Timeline. A common pattern for Lumenize calculators is to use ticksThatIntersect to "tag" each snapshot
      and then do groupBy operations with an OLAPCube.
       */
      var en, i, isoDateRegExp, out, st, ticks, ticksLength;
      utils.assert(this.limit === utils.MAX_INT, 'Cannot call `ticksThatIntersect()` on Timelines specified with `limit`.');
      out = [];
      if (utils.type(startOn) === 'string') {
        utils.assert(utils.type(endBefore) === 'string', 'The type for startOn and endBefore must match.');
        isoDateRegExp = /\d\d\d\d-\d\d-\d\dT\d\d:\d\d:\d\d.\d\d\dZ/;
        utils.assert(isoDateRegExp.test(startOn), 'startOn must be in form ####-##-##T##:##:##.###Z');
        utils.assert(isoDateRegExp.test(endBefore), 'endBefore must be in form ####-##-##T##:##:##.###Z');
        utils.assert(tz != null, "Must specify parameter tz when submitting ISO string boundaries.");
        ticks = this.getAll('ISOString', tz);
        if (ticks[0] >= endBefore || ticks[ticks.length - 1] < startOn) {
          out = [];
        } else {
          i = 0;
          ticksLength = ticks.length;
          while (i < ticksLength && ticks[i] < startOn) {
            i++;
          }
          while (i < ticksLength && ticks[i] < endBefore) {
            out.push(ticks[i]);
            i++;
          }
        }
      } else if (startOn instanceof Time) {
        utils.assert(endBefore instanceof Time, 'The type for startOn and endBefore must match.');
        startOn = startOn.inGranularity(this.granularity);
        endBefore = endBefore.inGranularity(this.granularity);
        if (this.endBefore.lessThan(this.startOn)) {
          st = this.endBefore;
          en = this.startOn;
        } else {
          st = this.startOn;
          en = this.endBefore;
        }
        if (st.greaterThanOrEqual(endBefore) || en.lessThan(startOn)) {
          out = [];
        } else {
          ticks = this.getAll();
          i = 0;
          ticksLength = ticks.length;
          while (i < ticksLength && ticks[i].lessThan(startOn)) {
            i++;
          }
          while (i < ticksLength && ticks[i].lessThan(endBefore)) {
            out.push(ticks[i]);
            i++;
          }
        }
      } else {
        throw new Error("startOn must be a String or a Time object.");
      }
      return out;
    };

    Timeline.prototype.contains = function(date, tz) {

      /*
      @method contains
      @param {Time/Date/String} date can be either a JavaScript date object or an ISO-8601 formatted string
      @param {String} [tz]
      @return {Boolean} true if the date provided is within this Timeline.
      
      ## Usage: ##
      
      We can create a Timeline from May to just before July.
      
          tl = new Timeline({
            startOn: '2011-05',
            endBefore: '2011-07'
          })
      
          console.log(tl.contains('2011-06-15T12:00:00.000Z', 'America/New_York'))
           * true
       */
      var endBefore, startOn, target;
      utils.assert(this.limit === utils.MAX_INT, 'Cannot call `contains()` on Timelines specified with `limit`.');
      if (date instanceof Time) {
        return date.lessThan(this.endBefore) && date.greaterThanOrEqual(this.startOn);
      }
      utils.assert((tz != null) || utils.type(date) !== 'date', 'Timeline.contains() requires a second parameter (timezone) when the first parameter is a Date()');
      switch (utils.type(date)) {
        case 'string':
          if (tz != null) {
            target = timezoneJS.parseISO(date);
          } else {
            target = new Time(date);
            return target.lessThan(this.endBefore) && target.greaterThanOrEqual(this.startOn);
          }
          break;
        case 'date':
          target = date.getTime();
          break;
        default:
          throw new Error('Timeline.contains() requires that the first parameter be of type Time, String, or Date');
      }
      startOn = this.startOn.getJSDate(tz);
      endBefore = this.endBefore.getJSDate(tz);
      return target < endBefore && target >= startOn;
    };

    return Timeline;

  })();

  TimelineIterator = (function() {

    /*
    @class TimelineIterator
    
    In most cases you'll want to call getAll() on Timeline. TimelineIterator is for use cases where you want to get the
    values in the Timeline one at a time.
    
    You usually get a TimelineIterator by calling getIterator() on a Timeline object.
    
    Iterate through days, months, years, etc. skipping weekends and holidays that you
    specify. It will also iterate over hours, minutes, seconds, etc. and skip times that are not
    between the specified work hours.
    
    ## Usage ##
    
        {TimelineIterator, Timeline, Time} = require('../')
    
        tl = new Timeline({
          startOn:new Time({granularity: 'day', year: 2009, month:1, day: 1}),
          endBefore:new Time({granularity: 'day', year: 2009, month:1, day: 8}),
          workDays: 'Monday, Tuesday, Wednesday, Thursday, Friday',
          holidays: [
            {month: 1, day: 1},  # New Years day was a Thursday in 2009
            {year: 2009, month: 1, day: 2}  # Also got Friday off in 2009
          ]
        })
    
        tli = tl.getIterator()
    
        while (tli.hasNext())
          console.log(tli.next().toString())
    
         * 2009-01-05
         * 2009-01-06
         * 2009-01-07
    
    Now, let's explore how Timelines and TimelineIterators are used together.
    
        tl3 = new Timeline({
          startOn:new Time('2011-01-06'),
          endBefore:new Time('2011-01-11'),
          workDayStartOn: {hour: 9, minute: 0},
          workDayEndBefore: {hour: 11, minute: 0}  # Very short work day for demo purposes
        })
    
    You can specify that the tickType be Timelines rather than Time values. On each call to `next()`, the
    iterator will give you a new Timeline with the `startOn` value set to what you would have gotten had you
    requested that the tickType be Times. The `endBefore' of the returned Timeline will be set to the next value.
    This is how you drill-down from one granularity into a lower granularity.
    
    By default, the granularity of the iterator will equal the `startOn`/`endBefore` of the original Timeline.
    However, you can provide a different granularity (`hour` in the example below) for the iterator if you want
    to drill-down at a lower granularity.
    
        tli3 = tl3.getIterator('Timeline', undefined, 'hour')
    
        while tli3.hasNext()
          subTimeline = tli3.next()
          console.log("Sub Timeline goes from #{subTimeline.startOn.toString()} to #{subTimeline.endBefore.toString()}")
          subIterator = subTimeline.getIterator('Time')
          while subIterator.hasNext()
            console.log('    Hour: ' + subIterator.next().hour)
    
         * Sub Timeline goes from 2011-01-06T00 to 2011-01-07T00
         *     Hour: 9
         *     Hour: 10
         * Sub Timeline goes from 2011-01-07T00 to 2011-01-10T00
         *     Hour: 9
         *     Hour: 10
         * Sub Timeline goes from 2011-01-10T00 to 2011-01-11T00
         *     Hour: 9
         *     Hour: 10
    
    There is a lot going on here, so let's poke at it a bit. First, notice how the second sub-Timeline goes from the 7th to the
    10th. That's because there was a weekend in there. We didn't get hours for the Saturday and Sunday.
    
    The above approach (`tl3`/`tli3`) is useful for some forms of hand generated analysis, but if you are using Time with
    Lumenize, it's overkill because Lumenize is smart enough to do rollups based upon the segments that are returned from the
    lowest granularity Time. So you can just iterate over the lower granularity and Lumenize will automatically manage
    the drill up/down to day/month/year levels automatically.
    
        tl4 = new Timeline({
          startOn:'2011-01-06T00',  # Notice how we include the hour now
          endBefore:'2011-01-11T00',
          workDayStartOn: {hour: 9, minute: 0},
          workDayEndBefore: {hour: 11, minute: 0}  # Very short work day for demo purposes
        })
    
        tli4 = tl4.getIterator('ISOString', 'GMT')
    
        while tli4.hasNext()
          console.log(tli4.next())
    
         * 2011-01-06T09:00:00.000Z
         * 2011-01-06T10:00:00.000Z
         * 2011-01-07T09:00:00.000Z
         * 2011-01-07T10:00:00.000Z
         * 2011-01-10T09:00:00.000Z
         * 2011-01-10T10:00:00.000Z
    
    `tl4`/`tli4` covers the same ground as `tl3`/`tli3` but without the explicit nesting.
     */
    var StopIteration, _contains;

    function TimelineIterator(timeline, tickType1, tz, childGranularity1) {
      var ref;
      this.tickType = tickType1 != null ? tickType1 : 'Time';
      this.childGranularity = childGranularity1;

      /*
      @constructor
      @param {Timeline} timeline A Timeline object
      @param {String} [tickType] An optional String that specifies the type for the returned ticks. Possible values are 'Time' (default),
         'Timeline', 'Date' (javascript Date Object), and 'ISOString'.
      @param {String} [childGranularity=granularity of timeline] When tickType is 'Timeline', this is the granularity for the startOn and endBefore of the
         Timeline that is returned.
      @param {String} [tz] A Sting specifying the timezone in the standard form,`America/New_York` for example. This is
         required if `tickType` is 'Date' or 'ISOString'.
       */
      utils.assert((ref = this.tickType) === 'Time' || ref === 'Timeline' || ref === 'Date' || ref === 'ISOString', "tickType must be 'Time', 'Timeline', 'Date', or 'ISOString'. You provided " + this.tickType + ".");
      utils.assert(this.tickType !== 'Date' || (tz != null), 'Must provide a tz (timezone) parameter when tickType is Date.');
      utils.assert(this.tickType !== 'ISOString' || (tz != null), 'Must provide a tz (timezone) parameter when returning ISOStrings.');
      if (this.tz == null) {
        this.tz = tz;
      }
      if (timeline instanceof Timeline) {
        this.timeline = timeline;
      } else {
        this.timeline = new Timeline(timeline);
      }
      if (this.childGranularity == null) {
        this.childGranularity = timeline.granularity;
      }
      this.reset();
    }

    StopIteration = typeof StopIteration === 'undefined' ? utils.StopIteration : StopIteration;

    TimelineIterator.prototype.reset = function() {

      /*
      @method reset
      
      Will go back to the where the iterator started.
       */
      if (this.timeline.step > 0) {
        this.current = new Time(this.timeline.startOn);
      } else {
        this.current = new Time(this.timeline.endBefore);
        this.current.decrement();
      }
      this.count = 0;
      return this._proceedToNextValid();
    };

    _contains = function(t, startOn, endBefore) {
      return t.lessThan(endBefore) && t.greaterThanOrEqual(startOn);
    };

    TimelineIterator.prototype.hasNext = function() {

      /*
      @method hasNext
      @return {Boolean} Returns true if there are still things left to iterator over. Note that if there are holidays,
         weekends or non-workhours to skip, then hasNext() will take that into account.
       */
      return _contains(this.current, this.timeline.startOn, this.timeline.endBefore) && (this.count < this.timeline.limit);
    };

    TimelineIterator.prototype._shouldBeExcluded = function() {
      var currentInDay, currentMinutes, holiday, j, len, ref, ref1, ref2;
      if (this.current._isGranularityCoarserThanDay()) {
        return false;
      }
      currentInDay = this.current.inGranularity('day');
      if (ref = this.current.dowString(), indexOf.call(this.timeline.workDays, ref) < 0) {
        return true;
      }
      ref1 = this.timeline.holidays;
      for (j = 0, len = ref1.length; j < len; j++) {
        holiday = ref1[j];
        if (utils.match(holiday, currentInDay)) {
          return true;
        }
      }
      if ((ref2 = this.timeline.granularity) === 'hour' || ref2 === 'minute' || ref2 === ' second' || ref2 === 'millisecond') {
        currentMinutes = this.current.hour * 60;
        if (this.current.minute != null) {
          currentMinutes += this.current.minute;
        }
        if (this.timeline.startOnWorkMinutes <= this.timeline.endBeforeWorkMinutes) {
          if ((currentMinutes < this.timeline.startOnWorkMinutes) || (currentMinutes >= this.timeline.endBeforeWorkMinutes)) {
            return true;
          }
        } else {
          if ((this.timeline.startOnWorkMinutes >= currentMinutes && currentMinutes > this.timeline.endBeforeWorkMinutes)) {
            return true;
          }
        }
      }
      return false;
    };

    TimelineIterator.prototype._proceedToNextValid = function() {
      var results;
      results = [];
      while (this.hasNext() && this._shouldBeExcluded()) {
        if (this.timeline.step > 0) {
          results.push(this.current.increment());
        } else {
          results.push(this.current.decrement());
        }
      }
      return results;
    };

    TimelineIterator.prototype.next = function() {

      /*
      @method next
      @return {Time/Timeline/Date/String} Returns the next value of the iterator. The start will be the first value returned unless it should
         be skipped due to holiday, weekend, or workhour knockouts.
       */
      var childtimeline, config, currentCopy, i, j, ref;
      if (!this.hasNext()) {
        throw new StopIteration('Cannot call next() past end.');
      }
      currentCopy = new Time(this.current);
      this.count++;
      for (i = j = ref = Math.abs(this.timeline.step); ref <= 1 ? j <= 1 : j >= 1; i = ref <= 1 ? ++j : --j) {
        if (this.timeline.step > 0) {
          this.current.increment();
        } else {
          this.current.decrement();
        }
        this._proceedToNextValid();
      }
      switch (this.tickType) {
        case 'Time':
          return currentCopy;
        case 'Date':
          return currentCopy.getJSDate(this.tz);
        case 'ISOString':
          return currentCopy.getISOStringInTZ(this.tz);
        case 'Timeline':
          config = {
            startOn: currentCopy.inGranularity(this.childGranularity),
            endBefore: this.current.inGranularity(this.childGranularity),
            workDays: this.timeline.workDays,
            holidays: this.timeline.holidays,
            workDayStartOn: this.timeline.workDayStartOn,
            workDayEndBefore: this.timeline.workDayEndBefore
          };
          childtimeline = new Timeline(config);
          return childtimeline;
        default:
          throw new Error("You asked for tickType " + this.tickType + ". Only 'Time', 'Date', 'ISOString', and 'Timeline' are allowed.");
      }
    };

    return TimelineIterator;

  })();

  exports.Timeline = Timeline;

  exports.TimelineIterator = TimelineIterator;

}).call(this);

});
