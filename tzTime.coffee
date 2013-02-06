###
# tzTime #

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
###

exports.Time = require('./src/Time').Time

Timeline = require('./src/Timeline')
exports.TimelineIterator = Timeline.TimelineIterator
exports.Timeline = Timeline.Timeline

exports.utils = require('./src/utils')

