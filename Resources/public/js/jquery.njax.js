/**
 * NJAX is "Navigation in AJAX".
 *
 * Allows browsers to navigate your page without doing full page loads,
 * but rather making AJAX requests and injecting responses into the body
 * using history.pushState() functionality to manipulate the browser's
 * addres bar.
 *
 * Greatly speeds up navigation.
 *
 * Very similar, and in fact greatly based on PJAX <https://github.com/defunkt/jquery-pjax>
 * with some added functionality.
 * 
 * @author Michał Dudek <michal@michaldudek.pl>
 * @copyright Copyright (c) 2013, Neverbland <http://www.neverbland.com>
 * @license MIT
 */

/*global jQuery*/

(function($, window, document, undefined) {
    "use strict";

    /***********************************************
     * NJAX PRIVATE METHODS AND VARIABLES
     ***********************************************/
    // prepare some variables
    var

    /**
     * Dictionary of default options.
     *
     * Can be accessed publicly by $.njax.defaults
     * e.g. $.njax.defaults.target = '#content-wrap'
     * 
     * @type {Object}
     */
    defaults = {
        /**
         * Should a new state be pushed? Usually yes, but not for history navigation.
         * 
         * @type {Boolean}
         */
        pushState   : true,

        /**
         * Target where the received content will be inserted.
         * 
         * @type {String} CSS selector.
         */
        target      : '#content',

        /**
         * After loading the new page should it scroll to top of the target?
         * 
         * If {Number} given then it will be treated as offset/margin to scrolling.
         * 
         * @type {Boolean|Number}
         */
        scrollToTarget : false,

        /**
         * Speed at which the scroll to target should animate.
         *
         * @type {Number}
         */
        scrollSpeed : 200,

        /**
         * Method of inserting the new content.
         * 
         * One of the following : 'insert' (default), 'prepend', 'append', 'replace'.
         * 
         * @type {String}
         */
        insert      : 'insert',

        /**
         * If set to true then all appended javascripts will be ignored and no njax modules executed.
         * 
         * @type {Boolean}
         */
        noScripts   : false,

        /**
         * Format of the response.
         * 
         * @type {String} Either 'html' or 'json'.
         */
        format      : 'json',

        /**
         * Fragment of the received page that should be inserted into the page.
         * 
         * @type {String} CSS selector.
         */
        fragment    : null,

        /**
         * Similar to fragment but instead of inserting a single fragment it will insert the specific elements targeted by the given selector.
         * 
         * So for example if you want to append new items to a list specify a selector for them.
         * 
         * Takes precedence before 'fragment'.
         * 
         * @type {String} CSS selector.
         */
        elements   : null,

        /**
         * Filter response manually with a callback function.
         * 
         * @type {Function}
         */
        filterResponse : null,

        /**
         * Name of the partial that the server should render.
         * 
         * @type {String}
         */
        partial     : null,

        /**
         * Title of the page - the HTML title will be changed upon receiving successful response from the server.
         * 
         * @type {String}
         */
        title       : document.title,

        /**
         * Timeout (in ms) for the request.
         * 
         * @type {Number}
         */
        timeoutTime : 60000,

        /**
         * Callback called when starting njax request.
         * 
         * @param  {Event} ev  Start event.
         */
        start     : function(ev) {
            $.noop(ev);
        },

        /**
         * Callback called when njax request has been finished and fully handled.
         * 
         * @param  {Event} ev  Start event.
         */
        end    : function(ev) {
            $.noop(ev);
        },

        /**
         * Callback called when njax request responded with an error.
         * 
         * @param  {String} url      URL of the request.
         * @param  {Object} options  Options for the request.
         * @param  {jqXHR} xhr       jQuery XHR object.
         * @param  {String} status   Status of the request.
         * @param  {String} error    Error message.
         */
        error       : function(ev) {
            $.noop(ev);
        },

        /**
         * Callback called when njax request was successful.
         * 
         * NOTE: This doesn't override the njax behavior - inserting the content, changing the page title, etc, are still handled by internal code.
         * 
         * @param  {Object} data     Data returned from the server.
         * @param  {Object} response Parsed response data from the server (including content, page title, partial).
         * @param  {String} url      URL of the request.
         * @param  {Object} options  Options for the request.
         * @param  {jqXHR} xhr       jQuery XHR object.
         * @param  {String} status   Status of the request.
         */
        success     : function(ev) {
            $.noop(ev);
        },

        /**
         * Callback called when the njax request timed out.
         * 
         * @param  {String} url      URL of the request.
         * @param  {Object} options  Options for the request.
         * @param  {jqXHR} xhr       jQuery XHR object.
         * @param  {Object} settings XHR settings.
         */
        timeout     : function(ev) {
            $.noop(ev);
        }
    },

    /**
     * Window object wrapped in jQuery
     * 
     * @type {jQuery}
     */
    $win = $(window),

    /**
     * Document object wrapped in jQuery
     * 
     * @type {jQuery}
     */
    //$doc = $(document),
    
    /**
     * Head element wrapped in jQuery.
     * 
     * @type {jQuery}
     */
    $head = $('head'),

    /**
     * Body element wrapped in jQuery
     * 
     * @type {jQuery}
     */
    $body = $(document.body),

    /**
     * Collection of body and html elements, used by animateIntoView().
     * 
     * @type {jQuery}
     */
    $bodyAndHtml = $body.add('html'),

    /**
     * Is njax supported by the browser or not?
     * 
     * @type {Boolean}
     */
    supported = false,

    /**
     * History manager.
     *
     * Referenced here for better minification, but also possibility of later injecting History.js.
     * 
     * @type {history}
     */
    history = window.history,

    /**
     * Current XmlHttpRequest.
     *
     * @type {jqXHR}
     */
    currentXhr,

    /**
     * Last njax request.
     *
     * @type {Object}
     */
    last,

    /**
     * Timeout timer.
     */
    timeoutTimer,

    /**
     * Helper variable that informs other handlers is the current handling of events silent.
     *
     * Set to true to ignore initial page load popstate event.
     *
     * @type {Boolean}
     */
    silent = true,

    /**
     * Cache with various info about states.
     * 
     * @type {Object}
     */
    cache = {},

    /**
     * Stores information about loaded CSS files.
     * 
     * @type {Object}
     */
    loadedCss = {},

    /**
     * Stores information about loaded JavaScript files.
     * 
     * @type {Object}
     */
    loadedJavaScript = {},

    /**
     * All registered JavaScript modules, by js file URL.
     * 
     * @type {Object}
     */
    javaScriptModules = {},

    /**
     * List of currently loaded JavaScript modules.
     * 
     * @type {Array}
     */
    currentJavaScriptModules = [],

    /**
     * URL of a currently executed/eval'd script.
     *
     * Used by JavaScript management functions to properly assign modules to their owning files.
     * 
     * @type {String}
     */
    currentJavaScriptUrl = null,

    /**
     * Data about the current state.
     * 
     * @type {Object}
     */
    currentState = {
        title : document.title
    },

    /***********************************************
     * PRIVATE NJAX FUNCTIONS
     ***********************************************/
    request = function(url, target, options) {
        if (!supported) {
            window.location.href = url;
            return;
        }

        // URL is required
        if (!url) {
            throw new TypeError('No url given for njax request');
        }

        target = target || $.njax.defaults.target;

        if (typeof target !== 'string') {
            throw new TypeError('Njax request requires target to be a string selector, "' + typeof(target) + '" given.');
        }

        // target is required
        var $target = $(target).eq(0);
            //_target = target; // need to store original target value for later reference
        if (!$target.length) {
            throw new TypeError('Njax request requires a selector for an existing target, "' + target + '" given.');
        }

        // merge the options with defaults
        options = $.extend(true, {}, $.njax.defaults, options);

        // cancel current XmlHttpRequest, if any
        if (currentXhr && currentXhr.readyState < 4) {
            currentXhr.onreadystatechange = $.noop;
            currentXhr.abort();
        }

        // store the current state data (can be customized by application)
        var globalState = getGlobalState();

        // make the XmlHttpRequest to get the page
        currentXhr = $.ajax({
            url : url,
            dataType : options.format === 'html' ? 'html' : 'json',

            /**
             * Executed before njax request has been sent.
             *
             * @param {jqXHR} xhr
             * @param {Object} settings
             * 
             * @triggers njax:start On target element.
             * @triggers njax:timeout On target element when the request times out.
             */
            beforeSend : function(xhr, settings) {
                // set some headers for the request
                xhr.setRequestHeader('X-NJAX', 'true');
                xhr.setRequestHeader('X-NJAX-Format', options.format);
                if (options.fragment) {
                    xhr.setRequestHeader('X-NJAX-Fragment', options.fragment);
                }
                if (options.partial) {
                    xhr.setRequestHeader('X-NJAX-Partial', options.partial);
                }

                // trigger the loading event
                if (trigger($target, 'njax:start', [url, options, xhr, settings], options.start)) {
                    xhr.abort();
                    return false;
                }

                // reset the last stored request
                last = null;

                // create timeout handling
                if (options.timeoutTime > 0) {
                    timeoutTimer = setTimeout(function() {
                        // abort the request
                        xhr.abort();

                        // and trigger the timeout event
                        trigger($target, 'njax:timeout', [url, options, xhr, settings], options.timeout);
                    }, options.timeoutTime);
                }
            },

            success : function(data, status, xhr) {
                // make this process silent
                silent = true;

                // hold some parsed response data in this variable
                var response = {
                    $content : $(),
                    url : xhr.getResponseHeader('X-NJAX-Display-URL') || url,
                    title : xhr.getResponseHeader('X-NJAX-Title') || options.title,
                    partial : xhr.getResponseHeader('X-NJAX-Partial') || null,
                    data : $.parseJSON(xhr.getResponseHeader('X-NJAX-Data')) || {},
                    css : [],
                    js : []
                };

                /*
                 * PARSE RESPONSE TO OBJECT
                 */
                if (options.format === 'html') {
                    // HTML response
                    response.$content = $($.trim(data));

                    // parse the added CSS files
                    selectAll(response.$content, 'link[rel="stylesheet"]').each(function() {
                        var $tag = $(this),
                            url = $tag.attr('href');

                        if (!url) {
                            return true; // continue
                        }

                        response.css.push({
                            url : url,
                            media : $tag.attr('media') || 'all'
                        });

                        // no longer keep it in the code so that the browser won't use it either
                        $tag.remove();
                    });

                    // parse the added JS files
                    selectAll(response.$content, 'script[src]').each(function() {
                        var $tag = $(this),
                            url = $tag.attr('src');

                        // only take care of local scripts
                        if (isLocalUrl(url)) {
                            response.js.push({
                                url : url
                            });
                            $tag.remove();
                        }
                    });
                
                } else {
                    // JSON response
                    response.$content = $($.trim(data.content));
                    response.js = data.js || [];
                    response.css = data.css || [];
                }

                /*
                 * FILTER THE RESPONSE CONTENT 
                 * based on given options
                 */
                if (typeof options.filterResponse === 'function') {

                    // use custom function
                    response.$content = options.filterResponse(response.$content);

                } else if (options.elements) {

                    // select specific elements
                    var $elements = response.$content.filter(options.elements);
                    if (!$elements.length) {
                        $elements = response.$content.find(options.elements);
                    }

                    response.$content = $elements;

                } else if (options.fragment) {

                    // specific fragment
                    var $fragment = response.$content.filter(options.fragment);
                    if (!$fragment.length) {
                        $fragment = response.$content.find(options.fragment);
                    }
                    response.$content = $fragment.html() || '';

                }

                /*
                 * PUSH STATE MAGIC
                 */
                storeCurrentState($.extend(true, {}, {
                    target : target
                }, globalState));

                // push new state
                if (options.pushState) {
                    pushState(response.url, response.title, {
                        target : target,
                        // cloning options manually because only serializable options can be stored in state (no functions)
                        options : {
                            partial : options.partial,
                            fragment : options.fragment
                        }
                    });
                }

                /*
                 * INSERT CONTENT
                 */
                if (options.insert === 'append') {
                    // append to target
                    $target.append(response.$content);

                } else if (options.insert === 'prepend') {
                    // prepend to target
                    $target.prepend(response.$content);

                } else if (options.insert === 'replace') {
                    // replace the target
                    var $replaceWith = response.$content;
                    $target.replaceWith($replaceWith);
                    $target = $replaceWith;

                } else {
                    // simply insert to the target
                    $target.html(response.$content);
                }

                // load the attached CSS files
                loadCss(response.css);

                // unload previous modules
                // and load the attached JS files
                if (!options.noScripts) {
                    unloadJavaScriptModules();
                    loadJavaScript(response.js);
                }
                

                // track the pageview in Google Analytics
                if (window._gaq !== undefined) {
                    window._gaq.push(['_trackPageview']);
                }

                // if all done then scroll to target (if so requested)
                if (options.scrollToTarget) {
                    animateIntoView($target, options.scrollSpeed, options.scrollToTarget);
                }

                // trigger success event
                trigger($target, 'njax:success', [response, data, url, options, xhr, status], options.success);

                // store this request params so we will be able to reload the page using njax
                last = {
                    url : url,
                    target : target,
                    options : options
                };

                // turn off silence
                silent = false;
            },

            /**
             * Executed when the njax request responds with an error.
             * 
             * @param  {jqXHR} xhr
             * @param  {Number} status HTTP response code.
             * @param  {String} error Error message / type.
             *
             * @triggers njax:error On target element.
             */
            error : function(xhr, status, error) {
                // ignore aborts
                if (error === 'abort') {
                    return;
                }

                silent = true;

                /*
                 * PUSH STATE MAGIC
                 */
                storeCurrentState($.extend(true, {}, {
                    target : target
                }, globalState));

                // push new state
                if (options.pushState) {
                    pushState(url, options.title, {
                        target : target,
                        // cloning options manually because only serializable options can be stored in state (no functions)
                        options : {
                            partial : options.partial,
                            fragment : options.fragment
                        }
                    });
                }

                // trigger error event
                trigger($target, 'njax:error', [url, options, xhr, status, error], options.error);

                // turn off silence
                silent = false;
            },

            /**
             * Executed when everything has been completed.
             *
             * @param  {jqXHR}  xhr
             * @param  {Number} status HTTP response code.
             *
             * @triggers njax:end On target element.
             */
            complete : function(xhr, status) {
                clearTimeout(timeoutTimer);
                silent = false;
                trigger($target, 'njax:end', [url, options, xhr, status], options.end);
            }


        });

        return currentXhr;
    },

    /**
     * Adds the passed CSS files into the page.
     * 
     * @param  {Array} files Array of CSS files.
     */
    loadCss = function(files) {
        $.each(files, function(i, css) {
            // if already loaded before then don't load again
            if (loadedCss[css.url] !== undefined) {
                return true;
            }

            // create a link tag and append it to head
            loadedCss[css.url] = $('<link />', {
                rel : 'stylesheet',
                href : css.url,
                media : css.media
            }).appendTo($head);
        });
    },

    /**
     * Adds the passed JavaScript files into the page.
     *
     * If it's an external file then it loads it by adding a script tag to the page's body.
     * If it's a local file that was previously loaded and registered a module then it executes that module.
     * If it's a local file then it loads it if it wasn't previously loaded.
     * 
     * @param  {Array} files Array of JavaScript files.
     */
    loadJavaScript = function(files) {
        var queue = [],
            execute = function(url, code) {
                // execute this code only if it is first in the queue (FIFO)
                if ($.inArray(url, queue) === 0) {
                    // remove it from the queue and execute
                    queue.shift();

                    // store the URL for this code in a global var
                    // so if the code is registering a module it can properly assign it
                    currentJavaScriptUrl = url;

                    // store it in loaded javascripts
                    loadedJavaScript[url] = {
                        url : url,
                        local : true
                    };

                    // evaluate the code
                    $.globalEval(code);

                    // clean up
                    currentJavaScriptUrl = null;

                } else {
                    // if this JavaScript isn't first in the queue yet
                    // then wait a bit and check again
                    setTimeout(function() {
                        execute(url, code);
                    }, 50);
                }
            };

        $.each(files, function(i, js) {

            // handle script from external source
            if (!isLocalUrl(js.url)) {
                // if already loaded then ignore
                if (loadedJavaScript[js.url] !== undefined) {
                    return true; // continue
                }

                // load it by simply adding a script tag to the page
                var $tag = $('<script />', {
                    src : js.url,
                    type : 'text/javascript'
                }).appendTo($body);

                loadedJavaScript[js.url] = $.extend(true, {}, js, {
                    tag : $tag,
                    local : false
                });

                return true; // continue
            }

            // handle local script that was already loaded
            if (loadedJavaScript[js.url] !== undefined) {
                // but we're only taking care of js modules here
                // if there was no module in the file then it's already been executed, so don't execute it again
                if (javaScriptModules[js.url] !== undefined) {
                    $.each(javaScriptModules[js.url], function(i, module) {
                        currentJavaScriptModules.push(module);
                        module.load();
                    });
                }

                return true; // continue
            }

            // parse files that haven't been loaded yet
            queue.push(js.url);
            $.ajax({
                url : js.url,
                dataType : 'text',
                success : function(code) {
                    execute(js.url, code);
                },
                error : function() {
                    execute(js.url, '');
                }
            });
        });
    },

    /**
     * Unloads all currently registered JavaScript modules.
     */
    unloadJavaScriptModules = function() {
        $.each(currentJavaScriptModules, function(i, module) {
            module.unload();
        });

        // reset
        currentJavaScriptModules = [];
    },

    /**
     * Registers JavaScript module.
     * 
     * @param  {Function} onLoadFn [optional]
     * @param  {Function} onUnloadFn [optional]
     */
    registerJavaScript = function(onLoadFn, onUnloadFn) {
        var module = {
            load : typeof onLoadFn === 'function' ? onLoadFn : $.noop,
            unload : typeof onUnloadFn === 'function' ? onUnloadFn : $.noop
        };

        // and if we can read the URL from which this module is executed
        // then make sure it's assigned to it
        if (currentJavaScriptUrl) {
            if (javaScriptModules[currentJavaScriptUrl] === undefined) {
                javaScriptModules[currentJavaScriptUrl] = [];
            }

            javaScriptModules[currentJavaScriptUrl].push(module);
        }

        // register it in currently running modules
        // and finally automatically run this javascript
        currentJavaScriptModules.push(module);
        module.load();
    },

    /**
     * Reloads the current page, ie. repeats the last njax call.
     */
    reload = function() {
        // if no last request stored then simply reload the page
        if (!last) {
            window.location.reload(); 
        }

        request(last.url, last.target, last.options);
    },

    /**
     * Wrapper function around history.pushState() that retrieves the new state and stores it in currentState as well as returning it.
     * 
     * @param  {String} url   URL to be displayed in the browser's address bar.
     * @param  {String} title Page title that you may want to set.
     * @param  {Object} data [optional] Any additional state data.
     * @return {Object} New state.
     */
    pushState = function(url, title, data) {
        title = $.trim(title).length ? title : null;
        data = data || {};

        var newState = $.extend(true, {}, {
            id : createId(),
            scrollTop : $win.scrollTop(),
            url : url
        }, data);

        history.pushState(newState, title, url);
        // set document title explicitly as pushState no longer does that in new browsers
        document.title = title;

        currentState = newState;
        return currentState;
    },

    /**
     * Updates the current state info in history.
     * 
     * @param  {Object} data [optional] Any additional state data.
     */
    storeCurrentState = function(data) {
        var newState = $.extend(true, {}, currentState, {
            id : currentState.id || createId(),
            scrollTop : $win.scrollTop(),
            url : window.location.pathname + window.location.search
        }, data);

        history.replaceState(newState, currentState.title);
        // set document title explicitly as replaceState no longer does that in new browsers
        document.title = currentState.title;

        currentState = newState;
    },

    /**
     * Triggers a custom event on the given element with attached data.
     * 
     * @param  {jQuery}   $el  jQuery Element.
     * @param  {String}   type Event type/name.
     * @param  {Array}    args Arguments passed to event listeners.
     * @param  {Function} fn   [optional] Additional listener to be registered for this event and unregistered immediately after calling it.
     * @return {Boolean} Is default prevented?
     */
    trigger = function($el, type, args, fn) {
        // if additional function passed then simply bind it as listener
        if (typeof fn === 'function') {
            $el.on(type + '.njaxtrigger', fn);
        }

        var ev = $.Event(type, {
            relatedTarget : $el
        });
        $el.trigger(ev, args);

        // unbind the previously bound listener
        $el.off(type + '.njaxtrigger');

        return ev.isDefaultPrevented();
    },

    /**
     * Checks if the event (usually a click event) is a qualified njax event.
     * 
     * ie. if the njax-related code should be executed. This is to help simulate native browser behavior.
     * It checks the following:
     * - if the modifier button (cmd, ctrl, alt, shift) was pressed during the event
     * - if the protocol and host of the link match the current
     * - if the link isn't only a hash change
     * 
     * @param  {Event}  ev
     * @return {Boolean} If true then you should proceed with executing njax related code.
     */
    isNjaxEvent = function(ev) {
        var link = ev.currentTarget;

        // if modifier key pressed then ignore the njax functionality
        if (ev.which > 1 || ev.metaKey || ev.ctrlKey || ev.altKey || ev.shiftKey) {
            return false;
        }

        // ignore cross origin links
        if (window.location.protocol !== link.protocol || window.location.host !== link.host) {
            return false;
        }

        // ignore hashes on the same page
        if (link.hash && link.href.replace(link.hash, '') === window.location.href.replace(window.location.hash, '')) {
            return false;
        }
        
        // ignore empty hash "foo.html#"
        if (link.href === '#' || link.href === window.location.href + '#') {
            return false;
        }

        return true;
    },

    /**
     * Checks if the given URL is local to the page (served from the same server with the same protocol)
     * 
     * @param  {String}  url
     * @return {Boolean}
     */
    isLocalUrl = function(url) {
        var link = parseUrl(url);
        return ((link.protocol === window.location.protocol) && (link.host === window.location.host));
    },

    /**
     * Parses the given URL to more easily accessible object of URL parts.
     * 
     * @param  {String} url
     * @return {Object}
     */
    parseUrl = function(url) {
        var link = document.createElement('a');
        link.href = url;
        return link;
    },

    /**
     * Creates a unique ID for new state.
     * 
     * @return {String}
     */
    createId = function() {
        var id = '0';
        while(1) {
            id = (new Date()).getTime() + ''; // make string
            if (cache[id] === undefined) {
                break;
            }
        }
        return id;
    },

    /**
     * Returns global state that will be attached to every state.
     * 
     * @return {Object}
     */
    getGlobalState = function() {
        return typeof $.njax.globalState === 'function' ? $.njax.globalState.apply(window) : $.njax.globalState;
    },

    /**
     * Returns a partial for the given target. Helps with proper history navigation.
     *
     * Should be overwritten by user.
     *
     * By default it returns the default partial.
     * 
     * @param  {String} target Target for which a request is being made.
     * @return {String}
     */
    partialForTarget = function(target) {
        return $.njax.defaults.partial;
    },

    /**
     * Selects all elements matching the selector.
     *
     * It not only does .find() but also .filter().
     * 
     * @param  {jQuery} $el      Element to select from.
     * @param  {String} selector CSS selector.
     * @return {jQuery}
     */
    selectAll = function($el, selector) {
        var $selected = $el.find(selector);
        $selected = $selected.add($selected.filter(selector));
        return $selected;
    },

    /**
     * Scrolls the body/document to match the top of the element.
     *
     * @param {jQuery} $el Element to scroll to.
     * @param {Number} speed [optional] Speed of the animation. Default: 200.
     * @param {Number} margin [optional] Margin from the top. Default: 0.
     */
    animateIntoView = function($el, speed, margin) {
        speed = (speed === undefined) ? 200 : speed;
        margin = parseInt(margin, 10) || 0;

        // break if there's no such item!
        if (!$el.length) {
            return;
        }

        $bodyAndHtml.animate({
            scrollTop : $el.offset().top - margin
        }, speed);
    };

    /***********************************************
     * ADD TO JQUERY
     ***********************************************/
    // register as a jQuery function
    $.njax = function() {
        if (!arguments.length) {
            throw new Error("$.njax() requires at least one argument!");
        }

        // reroute to appropriate functions based on types of arguments
        if (typeof arguments[0] === 'function') {
            // registering a js module
            registerJavaScript.apply(window, arguments);
            
        } else if (typeof arguments[0] === 'string') {
            // loading
            request.apply(window, arguments);
        }
    };

    // register as jQuery plugin
    $.fn.njax = function(ev, options) {
        if (!supported) {
            return true;
        }

        var $el = $(this);

        if (!$el.is('a[href]')) {
            throw new TypeError("$().njax() can only be called on 'a' elements that have a href attribute.");
        }

        if (typeof ev !== "object") {
            throw new TypeError("$().njax() requires the original event (usually click) to be passed as first argument.");
        }

        // if not njax event then ignore
        if (!isNjaxEvent(ev)) {
            return true;
        }

        options = options || {};

        // read options from data-njax attribute
        var opt = $el.data('njax') || {},
            url = $el.attr('href') || false,
            target = $el.data('njaxTarget') || opt.target || options.target || $.njax.defaults.target;

        // if not sufficient info then break
        if (!target || !url) {
            return true;
        }

        // merge options
        opt = $.extend({}, $.njax.defaults, options, opt);

        // merge options with specific data-njax-* attributes to ensure backward compatibility
        opt.fragment = $el.data('njaxFragment') || opt.fragment;
        opt.partial = $el.data('njaxPartial') || opt.partial;
        opt.format = $el.data('njaxFormat') || opt.format;

        // make njax request
        request(url, target, opt);

        // prevent default
        return false;
    };

    // link the defaults to jQuery
    $.njax.defaults = defaults;

    // make some functions public
    $.njax.isNjaxEvent = isNjaxEvent;
    $.njax.reload = reload;
    $.njax.refresh = reload;
    $.njax.partialForTarget = partialForTarget;

    // custom global state, either an object or a function, for client implementation
    $.njax.globalState = {};

    /***********************************************
     * CHECK SUPPORT
     ***********************************************/
    supported = (window.history && window.history.pushState && window.history.replaceState &&
        // pushState isn't reliable on iOS until 5
        !navigator.userAgent.match(/((iPod|iPhone|iPad)\.+\bOS\s+[1-4]|WebApps\/\.+CFNetwork)/)
    );

    /***********************************************
     * INITIALIZE
     ***********************************************/
    // but only if njax is supported
    if (supported) {

        // set the state for the current (initial) page load
        storeCurrentState();

        // get initially loaded CSS files
        $('link[rel="stylesheet"]').each(function() {
            var $tag = $(this),
                url = $tag.attr('href');

            if (url) {
                loadedCss[url] = $tag;
            }
        });

        // get initially loaded JavaScript files
        $('script[src]').each(function() {
            var $tag = $(this),
                url = $tag.attr('src');

            if (url) {
                loadedJavaScript[url] = {
                    url : url,
                    local : isLocalUrl(url),
                    tag : $tag
                };
            }
        });

        /***********************************************
         * REGISTER LISTENERS
         ***********************************************/
        /**
         * Register click listener for anchor elements with data-njax attribute.
         */
        $body.on('click', 'a[data-njax]', function(ev) {
            return $(this).njax(ev);
        });

        /**
         * Register popstate listener for handling of history navigation (back/forward buttons).
         *
         * @triggers njax:history
         */
        $win.on('popstate.njax', function(ev) {
            // if silent mode then ignore this
            if (silent) {
                return;
            }

            var newState = ev.originalEvent.state,
                direction = parseInt(currentState.id, 10) <= parseInt(newState.id, 10) ? 'forward' : 'back',
                target = direction === 'back' ? newState.target : currentState.target,
                $target = $(target).eq(0);

            // if there is no such target on page then do a normal page load
            if (!supported || !$target.length) {
                window.location = newState.url;
                return false;
            }

            // trigger history event
            if (trigger($target, 'njax:history', [direction, newState])) {
                return false;
            }

            currentState = newState;

            // make njax request for this page
            request(newState.url, target, {
                pushState : false,
                partial : $.njax.partialForTarget(target),
                success : function() {
                    // also update scroll position like a browser would - restore on back, top on forward
                    $win.scrollTop(direction === 'back' ? newState.scrollTop : 0);
                }
            });
        });

    }

})(jQuery, window, document);