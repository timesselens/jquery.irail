/**
* iRail API wrapper using jQuery
* Copyright (c) 2010 Tim Esselens <tim.esselens@gmail.com>
*
* Permission is hereby granted, free of charge, to any person obtaining a copy
* of this software and associated documentation files (the "Software"), to deal
* in the Software without restriction, including without limitation the rights
* to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
* copies of the Software, and to permit persons to whom the Software is
* furnished to do so, subject to the following conditions:
*
* The above copyright notice and this permission notice shall be included in
* all copies or substantial portions of the Software.
*
* THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
* IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
* FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
* AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
* LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
* OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
* THE SOFTWARE.
*/

$.ajaxSetup({beforeSend:function(req){req.setRequestHeader("User-Agent","jQuery Useragent script")}});

var irail = function __irail_namespace($) {

    if ( ! typeof $ == "function" ) { throw new Error('jQuery not loaded, check inclusion order'); }

    var _cache = { stations: [], connections: {}, liveboards: {}, vehicles: {}, timestamps: {}, default_lang: null };

    /** 
     * Private functions to external iRails API **********************************************************************************************/

    // ----------------------------------------------------------------------------------------------------------------------------------------
    var _set_default_lang = function(lang) { return _cache.default_lang = lang; }

    // ----------------------------------------------------------------------------------------------------------------------------------------
    var _fetchStations = function() {
        $.ajax({
            type: "GET",
            url: 'http://api.irail.be/stations/',
            data: { format: 'json' },
            cache: false,
            dataType: 'jsonp',
            success: function(json) { 
                _cache.timestamps.last_server_response = new Date().getTime(); 
                if(json.station) { 
                    _cache.stations = json.station; 
                    $(window).trigger('irail.ready'); 
                } 
            },
            error: function(xhr, status_str) {
                throw new Error(['could not fullfil request: ', xhr.status, ' ', xhr.responseText ].join(''));
            }
        });
    };

    // ----------------------------------------------------------------------------------------------------------------------------------------
    var _getConnections = function(opts,callback) {

        var validation_re = {
            from: /^(\w{3}.*)/,
            to: /^(\w{3}.*)/,
            date: /^()$|^(\d{2})\W?(\d{2})\W?(\d{2})$/,     //'DDMMYY'
            time: /^()$|^(\d{2})\W?(\d{2})$/,               //'HHMM',
            timeSel: /^(|arrive|depart)$/,
            typeOfTransport: /^(|train|bus|taxi)$/ 
        };

        // parameter validation. oh Perl, how I wish you were here. Love Tim.
        for(var key in opts) {
            if(opts.hasOwnProperty(key)) {
                if(! validation_re[key]) { throw new Error('caught unwanted parameter: '+key); }
                if(validation_re[key].test( opts[key] )) {
                    opts[key] = opts[key].match( validation_re[key] ).slice(1).join('');
                } else {
                    throw new Error("failed to validate parameter: '"+key+"' using "+ validation_re[key]);
                }
            }
        }

        $.ajax({
            type: "GET",
            url: 'http://api.irail.be/connections/',
            data: $.extend({ format: 'json' }, opts),
            dataType: 'jsonp',
            success: function(json) { 
                
                _cache.timestamps.last_server_response = new Date().getTime(); 

                for(var i in json.connection) { var c = json.connection[i];
                    // identify connection, e.g. brussel_noord__oostende__1290619380
                    var key = ([c.departure.station , '__' , c.arrival.station , '__' , c.departure.time].join('')).replace(/\W/,'_');
                    c.timestamp = json.timestamp;
                    _cache['connections'][key.toLowerCase()] = c;
                }

                if(json.connection) { callback(json.connection); }
            },
            error: function(xhr, status_str) {
                callback(null,xhr);
                throw new Error(['could not fullfil request: ', xhr.status, ' ', xhr.responseText ].join(''));
            }
        });
    };

    // ----------------------------------------------------------------------------------------------------------------------------------------
    var _getLiveBoard = function(system, station, direction, callback) {
				direction = direction.toUpperCase().substr(0,3);
        $.ajax({
            type: "GET",
            url: 'http://api.irail.be/liveboard/?system=' + system,
            data: { format: 'json', station: station, arrdep: direction, lang: _cache.default_lang },
            dataType: 'jsonp',
            success: function(json) { 

                _cache.timestamps.last_server_response = new Date().getTime(); 

								switch (direction) {
									case "DEP" :
                		json.departures = json.departures || {departure:[]};

                    $.each(json.departures.departure, function(_,d) { d.time = parseInt(d.time,10); d.delay = parseInt(d.delay,10); });

                    var dirtxt = { nl: 'VERTREK', en: 'DEPARTURES', fr: 'DEPARTS' };
                    var dliveboard = { 
                        entries: json.departures.departure,
                        timestamp: parseInt(json.timestamp,10), 
                        station: json.station, 
                        direction: dirtxt[_cache.default_lang] || 'DEPARTURES',
                    };
                    _cache['liveboards'][station.toLowerCase() + '_departures'] = dliveboard;
                    callback(dliveboard);
									break;
                	case "ARR":
              			json.arrivals = json.arrivals || {arrival:[]};
                    
                    $.each(json.arrivals.arrival, function(_,a) { a.time = parseInt(a.time,10); a.delay = parseInt(a.delay,10); });
                    var dirtxt = { nl: 'AANKOMST', en: 'ARRIVALS', fr: 'ARRIVEES' };
                    var aliveboard = { 
                        entries: json.arrivals.arrival, 
                        timestamp: parseInt(json.timestamp,10), 
                        station: json.station, 
                        direction: dirtxt[_cache.default_lang] || 'ARRIVALS',
                    };
                    _cache['liveboards'][station.toLowerCase() + '_arrivals'] = aliveboard;
                    callback(aliveboard);
									break;
                }

            },
            error: function(xhr, status_str) {
                callback(null,xhr);
                throw new Error(['could not fullfil request: ', xhr.status, ' ', xhr.responseText ].join(''));
            }
        });
    };

    // ----------------------------------------------------------------------------------------------------------------------------------------
    var _getVehicle = function(vehicle, callback) {
        $.ajax({
            type: "GET",
            url: 'http://api.irail.be/vehicle/',
            data: { format: 'json', id: vehicle },
            dataType: 'jsonp',
            success: function(json) { 

                _cache.timestamps.last_server_response = new Date().getTime(); 

                var transport = { stops: json.stops.stop, timestamp: json.stops.timestamp };
                
                _cache['vehicles'][vehicle] = transport;

                callback(transport);

            },
            error: function(xhr, status_str) {
                callback(null,xhr);
                throw new Error(['could not fullfil request: ', xhr.status, ' ', xhr.responseText ].join(''));
            }
        });
    };

    /**
     * Bootstrap *****************************************************************************************************************************/

    $(function() { _fetchStations(); });


    /**
     * Public API ***************************************************************************************************************************/

    return {
        set_default_lang: function(lang) {
            return _set_default_lang(lang);
        },
        stations: {
            search: function(str) { 
                // return a list of stations that match qr/\Q$str\E/i or null if _cache.stations is not yet loaded
                return _cache.stations.length > 0 ? $.grep(_cache.stations, function(o) { return o.name.match(str,'i'); }) : null;
            }
        },
        connections: {
            lookup: function(opts, callback) {
                callback = callback ? callback : typeof opts.success == 'function' ? opts.success : null;
                if(! typeof callback == "function") { throw new Error('callback not defined'); }
                return _getConnections(opts,callback);

            }
        },
        liveboards: {
            lookup: function(system, station, direction, callback) {
                callback = callback ? callback : typeof direction == "function" ? direction : null;
                direction = typeof direction == "function" ? 'DEP' : direction;
                direction = direction.match(/arr/i) ? 'ARR' : 'DEP';
								system = system.toUpperCase();
                if(! typeof callback == "function") { throw new Error('callback not defined'); }
                if(["NMBS","MIVB"].indexOf(system)==-1) { throw new Error('"'+system+'" is not a valid system'); }
                return _getLiveBoard(system,station,direction,callback);
            }
        },
        vehicles: {
            lookup: function(id, callback) {
                if(! typeof callback == "function") { throw new Error('callback not defined'); }
                return _getVehicle(id,callback);
            }
        },
        cache: {
            get: function(k) { return k ? _cache[k] : _cache; },
            clear: function() { }
        }
    };
}(jQuery);


//vim:ft=javascript,ts=4,sw=4,expandtab
