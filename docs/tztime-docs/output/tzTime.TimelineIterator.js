Ext.data.JsonP.tzTime_TimelineIterator({"tagname":"class","name":"tzTime.TimelineIterator","extends":null,"mixins":[],"alternateClassNames":[],"aliases":{},"singleton":false,"requires":[],"uses":[],"enum":null,"override":null,"inheritable":null,"inheritdoc":null,"meta":{},"private":null,"id":"class-tzTime.TimelineIterator","members":{"cfg":[],"property":[],"method":[{"name":"constructor","tagname":"method","owner":"tzTime.TimelineIterator","meta":{},"id":"method-constructor"},{"name":"hasNext","tagname":"method","owner":"tzTime.TimelineIterator","meta":{},"id":"method-hasNext"},{"name":"next","tagname":"method","owner":"tzTime.TimelineIterator","meta":{},"id":"method-next"},{"name":"reset","tagname":"method","owner":"tzTime.TimelineIterator","meta":{},"id":"method-reset"}],"event":[],"css_var":[],"css_mixin":[]},"linenr":401,"files":[{"filename":"Timeline.coffee.js","href":"Timeline.coffee.html#tzTime-TimelineIterator"}],"html_meta":{},"statics":{"cfg":[],"property":[],"method":[],"event":[],"css_var":[],"css_mixin":[]},"component":false,"superclasses":[],"subclasses":[],"mixedInto":[],"parentMixins":[],"html":"<div><pre class=\"hierarchy\"><h4>Files</h4><div class='dependency'><a href='source/Timeline.coffee.html#tzTime-TimelineIterator' target='_blank'>Timeline.coffee.js</a></div></pre><div class='doc-contents'><p>In most cases you'll want to call getAll() on Timeline. TimelineIterator is for use cases where you want to get the\nvalues in the Timeline one at a time.</p>\n\n<p>You usually get a TimelineIterator by calling getIterator() on a Timeline object.</p>\n\n<p>Iterate through days, months, years, etc. skipping weekends and holidays that you\nspecify. It will also iterate over hours, minutes, seconds, etc. and skip times that are not\nbetween the specified work hours.</p>\n\n<h2>Usage</h2>\n\n<pre><code>{TimelineIterator, Timeline, Time} = require('../')\n\ntl = new Timeline({\n  startOn:new Time({granularity: 'day', year: 2009, month:1, day: 1}),\n  endBefore:new Time({granularity: 'day', year: 2009, month:1, day: 8}),\n  workDays: 'Monday, Tuesday, Wednesday, Thursday, Friday',\n  holidays: [\n    {month: 1, day: 1},  # New Years day was a Thursday in 2009\n    {year: 2009, month: 1, day: 2}  # Also got Friday off in 2009\n  ]\n})\n\ntli = tl.getIterator()\n\nwhile (tli.hasNext())\n  console.log(tli.next().toString())\n\n# 2009-01-05\n# 2009-01-06\n# 2009-01-07\n</code></pre>\n\n<p>Now, let's explore how Timelines and TimelineIterators are used together.</p>\n\n<pre><code>tl3 = new Timeline({\n  startOn:new Time('2011-01-06'),\n  endBefore:new Time('2011-01-11'),\n  workDayStartOn: {hour: 9, minute: 0},\n  workDayEndBefore: {hour: 11, minute: 0}  # Very short work day for demo purposes\n})\n</code></pre>\n\n<p>You can specify that the tickType be Timelines rather than Time values. On each call to <code>next()</code>, the\niterator will give you a new Timeline with the <code>startOn</code> value set to what you would have gotten had you\nrequested that the tickType be Times. The `endBefore' of the returned Timeline will be set to the following value.\nThis is how you drill-down from one granularity into a lower granularity.</p>\n\n<p>By default, the granularity of the iterator will equal the <code>startOn</code>/<code>endBefore</code> of the original Timeline.\nHowever, you can provide a different granularity (<code>hour</code> in the example below) for the iterator if you want\nto drill-down at a lower granularity.</p>\n\n<pre><code>tli3 = tl3.getIterator('Timeline', undefined, 'hour')\n\nwhile tli3.hasNext()\n  subTimeline = tli3.next()\n  console.log(\"Sub Timeline goes from #{subTimeline.startOn.toString()} to #{subTimeline.endBefore.toString()}\")\n  subIterator = subTimeline.getIterator('Time')\n  while subIterator.hasNext()\n    console.log('    Hour: ' + subIterator.next().hour)\n\n# Sub Timeline goes from 2011-01-06T00 to 2011-01-07T00\n#     Hour: 9\n#     Hour: 10\n# Sub Timeline goes from 2011-01-07T00 to 2011-01-10T00\n#     Hour: 9\n#     Hour: 10\n# Sub Timeline goes from 2011-01-10T00 to 2011-01-11T00\n#     Hour: 9\n#     Hour: 10\n</code></pre>\n\n<p>There is a lot going on here, so let's poke at it a bit. First, notice how the second sub-Timeline goes from the 7th to the\n10th. That's because there was a weekend in there. We didn't get hours for the Saturday and Sunday.</p>\n\n<p>The above approach (<code>tl3</code>/<code>tli3</code>) is useful for some forms of hand generated analysis, but if you are using Time with\nLumenize, it's overkill because Lumenize is smart enough to do rollups based upon the segments that are returned from the\nlowest granularity Time. So you can just iterate over the lower granularity and Lumenize will automatically manage\nthe drill up/down to day/month/year levels automatically.</p>\n\n<pre><code>tl4 = new Timeline({\n  startOn:'2011-01-06T00',  # Notice how we include the hour now\n  endBefore:'2011-01-11T00',\n  workDayStartOn: {hour: 9, minute: 0},\n  workDayEndBefore: {hour: 11, minute: 0}  # Very short work day for demo purposes\n})\n\ntli4 = tl4.getIterator('ISOString', 'GMT')\n\nwhile tli4.hasNext()\n  console.log(tli4.next())\n\n# 2011-01-06T09:00:00.000Z\n# 2011-01-06T10:00:00.000Z\n# 2011-01-07T09:00:00.000Z\n# 2011-01-07T10:00:00.000Z\n# 2011-01-10T09:00:00.000Z\n# 2011-01-10T10:00:00.000Z\n</code></pre>\n\n<p><code>tl4</code>/<code>tli4</code> covers the same ground as <code>tl3</code>/<code>tli3</code> but without the explicit nesting.</p>\n</div><div class='members'><div class='members-section'><div class='definedBy'>Defined By</div><h3 class='members-title icon-method'>Methods</h3><div class='subsection'><div id='method-constructor' class='member first-child not-inherited'><a href='#' class='side expandable'><span>&nbsp;</span></a><div class='title'><div class='meta'><span class='defined-in' rel='tzTime.TimelineIterator'>tzTime.TimelineIterator</span><br/><a href='source/Timeline.coffee.html#tzTime-TimelineIterator-method-constructor' target='_blank' class='view-source'>view source</a></div><strong class='new-keyword'>new</strong><a href='#!/api/tzTime.TimelineIterator-method-constructor' class='name expandable'>tzTime.TimelineIterator</a>( <span class='pre'>timeline, [tickType], [childGranularity], [tz]</span> ) : <a href=\"#!/api/tzTime.TimelineIterator\" rel=\"tzTime.TimelineIterator\" class=\"docClass\">tzTime.TimelineIterator</a></div><div class='description'><div class='short'> ...</div><div class='long'>\n<h3 class=\"pa\">Parameters</h3><ul><li><span class='pre'>timeline</span> : Timeline<div class='sub-desc'><p>A Timeline object</p>\n</div></li><li><span class='pre'>tickType</span> : String (optional)<div class='sub-desc'><p>An optional String that specifies the type for the returned ticks. Possible values are 'Time' (default),\n   'Timeline', 'Date' (javascript Date Object), and 'ISOString'.</p>\n</div></li><li><span class='pre'>childGranularity</span> : String (optional)<div class='sub-desc'><p>When tickType is 'Timeline', this is the granularity for the startOn and endBefore of the\n   Timeline that is returned.</p>\n</div></li><li><span class='pre'>tz</span> : String (optional)<div class='sub-desc'><p>A Sting specifying the timezone in the standard form,<code>America/New_York</code> for example. This is\n   required if <code>tickType</code> is 'Date' or 'ISOString'.</p>\n</div></li></ul><h3 class='pa'>Returns</h3><ul><li><span class='pre'><a href=\"#!/api/tzTime.TimelineIterator\" rel=\"tzTime.TimelineIterator\" class=\"docClass\">tzTime.TimelineIterator</a></span><div class='sub-desc'>\n</div></li></ul></div></div></div><div id='method-hasNext' class='member  not-inherited'><a href='#' class='side expandable'><span>&nbsp;</span></a><div class='title'><div class='meta'><span class='defined-in' rel='tzTime.TimelineIterator'>tzTime.TimelineIterator</span><br/><a href='source/Timeline.coffee.html#tzTime-TimelineIterator-method-hasNext' target='_blank' class='view-source'>view source</a></div><a href='#!/api/tzTime.TimelineIterator-method-hasNext' class='name expandable'>hasNext</a>( <span class='pre'></span> ) : Boolean</div><div class='description'><div class='short'> ...</div><div class='long'>\n<h3 class='pa'>Returns</h3><ul><li><span class='pre'>Boolean</span><div class='sub-desc'><p>Returns true if there are still things left to iterator over. Note that if there are holidays,\n   weekends or non-workhours to skip, then hasNext() will take that into account. For example if the endBefore is a\n   Sunday, hasNext() will return true the next time it is called after the Friday is returned.</p>\n</div></li></ul></div></div></div><div id='method-next' class='member  not-inherited'><a href='#' class='side expandable'><span>&nbsp;</span></a><div class='title'><div class='meta'><span class='defined-in' rel='tzTime.TimelineIterator'>tzTime.TimelineIterator</span><br/><a href='source/Timeline.coffee.html#tzTime-TimelineIterator-method-next' target='_blank' class='view-source'>view source</a></div><a href='#!/api/tzTime.TimelineIterator-method-next' class='name expandable'>next</a>( <span class='pre'></span> ) : Time/Timeline/Date/String</div><div class='description'><div class='short'> ...</div><div class='long'>\n<h3 class='pa'>Returns</h3><ul><li><span class='pre'>Time/Timeline/Date/String</span><div class='sub-desc'><p>Returns the next value of the iterator. The start will be the first value returned unless it should\n   be skipped due to holiday, weekend, or workhour knockouts.</p>\n</div></li></ul></div></div></div><div id='method-reset' class='member  not-inherited'><a href='#' class='side expandable'><span>&nbsp;</span></a><div class='title'><div class='meta'><span class='defined-in' rel='tzTime.TimelineIterator'>tzTime.TimelineIterator</span><br/><a href='source/Timeline.coffee.html#tzTime-TimelineIterator-method-reset' target='_blank' class='view-source'>view source</a></div><a href='#!/api/tzTime.TimelineIterator-method-reset' class='name expandable'>reset</a>( <span class='pre'></span> )</div><div class='description'><div class='short'>Will go back to the where the iterator started. ...</div><div class='long'><p>Will go back to the where the iterator started.</p>\n</div></div></div></div></div></div></div>"});