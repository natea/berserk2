/*
 * Copyright (c) 2011 Brad Taylor <brad@getcoded.net>
 *
 * Permission is hereby granted, free of charge, to any person obtaining
 * a copy of this software and associated documentation files (the
 * "Software"), to deal in the Software without restriction, including
 * without limitation the rights to use, copy, modify, merge, publish,
 * distribute, sublicense, and/or sell copies of the Software, and to
 * permit persons to whom the Software is furnished to do so, subject to
 * the following conditions:
 *
 * The above copyright notice and this permission notice shall be
 * included in all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
 * EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
 * MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND
 * NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE
 * LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION
 * OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION
 * WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
 */

function Timeline (args) {
	this._init(args);
}

Timeline.prototype = {
	_options : {
		latestEventsUrl : null,
		previousEventsUrl : null,
		timeUpdateFrequency : 30000,
		updateFrequency : 5000,
		cullFrequency : 30000,
		timelineEventCount : 50,
		newEventAdded : null
	},

	_MONTHS : [
		'January', 'Feburary', 'March', 'April',
		'May', 'June', 'July', 'August',
		'September', 'October', 'November', 'December'
	],

	_DAYS : [
		'Sunday', 'Monday', 'Tuesday', 'Wednesday',
		'Thursday', 'Friday', 'Saturday'
	],

	_init : function (options) {
		this._options = $.extend({}, this._options, options);
		this._fetchingDown = false;

		var klass = this;

		this._updateRelativeTimes();
		window.setInterval(function () { klass._updateRelativeTimes() },
		                   this._options.timeUpdateFrequency);

		window.setInterval(function () { klass.update(); },
		                   this._options.updateFrequency);

		window.setInterval(function () { klass.cullEventList(); },
		                   this._options.cullFrequency);

		$(window).scroll(function () {
			// Fetch down starting when we're viewing the last 20% of the page
			var startFetching = $(document).height() - $(window).height()
					    - ($('#timeline-event-container').height() * 0.2);
			if ($(window).scrollTop() < startFetching)
				return;

			klass.fetchDown();
		});
	},

	_getRelativeDateString : function (date) {
		var curr = new Date().getTime() / 1000;
		var diff = curr - date;

		var mesg = '';
		if (diff < 60) {
			mesg = 'moments ago';
		} else if (diff < 3600) {
			var mins = Math.round(diff / 60);
			mesg = mins + ' minute' + (mins == 1 ? '' : 's') + ' ago';
		} else if (diff < 43200) {
			var hours = Math.round(diff / 3600);
			mesg = hours + ' hour' + (hours == 1 ? '' : 's') + ' ago';
		} else if (diff < 172800) {
			mesg = "Yesterday";
		} else if (diff < 518400) {
			var dt = new Date(date * 1000);
			mesg = this._DAYS[dt.getDay()];
		} else {
			var dt = new Date(date * 1000);
			if (dt.year == curr.year)
				mesg = this._MONTHS[dt.getMonth()] + ' ' + dt.getDate();
			else
				mesg = this._MONTHS[dt.getMonth()] + ' ' + dt.getDate() + ' ' + dt.getFullYear();
		}
		return mesg;
	},

	_addHiddenEvent : function (e, prepend) {
		var li = $('<li>').addClass('timeline-event').attr('data-id', e.pk)
				  .attr('data-timestamp', e.date)
				  .append($('<p>').addClass('timeline-date')
						  .text(this._getRelativeDateString(e.date)))
				  .append($('<p>').html(e.message));
		if (e.task != '')
			li.append($('<p>').addClass('timeline-event-task').html(e.task));
		if (e.comment != '')
			li.append($('<p>').addClass('timeline-event-comment').html(e.comment));

		li.hide();
		if (prepend) {
			$('#timeline-event-container').prepend(li);
		} else {
			$('#timeline-event-container').append(li);
		}
		return li;
	},

	_updateRelativeTimes : function () {
 		var klass = this;
		$.each($('.timeline-event'), function (i, e) {
			var date = $(e).attr('data-timestamp');
			$(e).children('.timeline-date').first()
			    .text(klass._getRelativeDateString(date));
		});
	},

	fetchDown : function () {
		if (this._fetchingDown)
			return;

		var earlier_than = $('#timeline-event-container').attr('data-earlier-than');
		if (earlier_than < 0)
			return;

		var url = this._options.previousEventsUrl.replace('99', earlier_than);

		var klass = this;
		this._fetchingDown = true;
		$.getJSON(url, function (data) {
			$.each(data.events, function (i, e) {
				var li = klass._addHiddenEvent(e, false);
				li.slideDown();
			});

			// Update the earlier-than for subsequent runs
			$('#timeline-event-container').attr('data-earlier-than',
			                                    data.new_earlier_than);
			klass._fetchingDown = false;
		});
	},

	update : function () {
		var start_after = $('#timeline-event-container').attr('data-start-after');
		var url = this._options.latestEventsUrl.replace('99', start_after);

		var klass = this;
		$.getJSON(url, function (data) {
			$.each(data.events, function (i, e) {
				var li = klass._addHiddenEvent(e, true);
				li.delay(i * 800).slideDown();

				if (klass._options.newEventAdded)
					klass._options.newEventAdded(e);
			});

			// Update the start-after for subsequent runs
			$('#timeline-event-container').attr('data-start-after',
			                                    data.new_start_after);
		});
	},

	cullEventList : function () {
		var events = $('.timeline-event');
		var maxEvents = this._options.timelineEventCount;

		if (events.length <= maxEvents)
			return;

		// Don't cull items if we're currently fetching
		if (this._fetchingDown)
			return;

		// Only cull items if we're at the top, or close to the top so
		// we don't cull items if we're in the middle of scrolling down
		if ($(window).scrollTop() > 300)
			return;

		// Make sure earlier-than is updated so that fetchDown will
		// continue to operate properly.
		var newEarlierThan = $(events[maxEvents - 1]).attr('data-id');
		$('#timeline-event-container').attr('data-earlier-than',
                                                    newEarlierThan);

		events.slice(maxEvents).remove();
	},
};
