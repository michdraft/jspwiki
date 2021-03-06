/*
    JSPWiki - a JSP-based WikiWiki clone.

    Licensed to the Apache Software Foundation (ASF) under one
    or more contributor license agreements.  See the NOTICE file
    distributed with this work for additional information
    regarding copyright ownership.  The ASF licenses this file
    to you under the Apache License, Version 2.0 (the
    "License"); fyou may not use this file except in compliance
    with the License.  You may obtain a copy of the License at

       http://www.apache.org/licenses/LICENSE-2.0

    Unless required by applicable law or agreed to in writing,
    software distributed under the License is distributed on an
    "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
    KIND, either express or implied.  See the License for the
    specific language governing permissions and limitations
    under the License.
*/


/*eslint-env browser*/
/*global $, $$, Form, Hash, Behavior, HighlightQuery, Accesskey */
/*exported  Wiki */

/*
Script: wiki.js
    Javascript routines to support JSPWiki, a JSP-based WikiWiki clone.

Dependencies:
    Based on http://mootools.net/
    * mootools-core.js : v1.5.1 excluding the Compatibility module
    * mootools-more.js : v1.5.1 including...
        Class.Binds, Hash, Element.Shortcuts, Fx.Elements, Fx.Accordion, Drag,
        Drag.Move, Hash.Cookie, Swiff

Depends on :
    moo-extend/Behaviour.js
    moo-extend/Element.Extend.js
    moo-extend/Array.Extend.js
    moo-extend/String.js
    moo-extend/HighlightQuery.js
    moo-extend/Acceskey.js
    moo-extend/Form.File.js
    moo-extend/Form.MultipleFile.js
    moo-extend/Request.js
    wiki/Navigate.js
    wiki/Recents.js
    wiki/FindPages.js
    wiki/Search.js
    wiki/Prefs.js
*/

//"use strict";

/*
Class: Wiki
    Javascript support functions for jspwiki.  (singleton)
*/
var Wiki = {

    version: "haddock03",  //used to validate compatible preference cookies

    initialize: function(){

        var wiki = this,
            behavior = new Behavior();

        wiki.add = behavior.add.bind(behavior);
        wiki.once = behavior.once.bind(behavior);
        wiki.update = behavior.update.bind(behavior);


        // add core jspwiki behaviors; needed to support the default template jsp's
        wiki.add( "body", wiki.caniuse )

            .add( "[accesskey]", Accesskey )

            //.add("input[placeholder]", function(element){ element.placeholderX(); })

            //toggle effect:  toggle .active class on this element when clicking toggle element
            //.add("[data-toggle]", "onToggle", {attr:"data-toggle"})
            .add( "[data-toggle]", function(element){

                element.onToggle( element.get("data-toggle"), function(isActive){
                    var pref = element.get("data-toggle-pref");
                    if( pref ){
                        //console.log(pref, isActive);
                        wiki.prefs.set(pref, isActive ? "active" : "");
                    }
                });
            })

            //generate modal confirmation boxes, eg prompting to execute
            //an unrecoverable action such as deleting a page or attachment
            //.add("[data-toggle]", "onModal", {attr:"data-modal"})
            .add( "[data-modal]", function(element){
                element.onModal( element.get("data-modal") );
            })

            //hover effects: show/hide this element when hovering over its parent element
            //.add("[data-toggle]", "onHover", {attr:"data-hover-parent"})
            .add( "[data-hover-parent]", function(element){
                element.onHover( element.get("data-hover-parent") );
            })

            //make navigation bar sticky (simulate position:sticky; )
            //.add(".sticky", "onSticky" )
            .add( ".sticky", function(element){
                element.onSticky();
            })

            //highlight previous search query in cookie or referrer page
            .add( ".page-content", function(element){

                var previousQuery = "PrevQuery";

                HighlightQuery( element, wiki.prefs.get(previousQuery) );
                wiki.prefs.erase(previousQuery);

            })

            //activate quick navigation searchbox
            .add( ".searchbox .dropdown-menu", function(element){

                var recentSearch = "RecentSearch", prefs = wiki.prefs;

                //activate Recent Searches functionality
                new wiki.Recents( element, {
                    items: prefs.get(recentSearch),
                    onChange: function( items ){
                        items ? prefs.set(recentSearch, items) : prefs.erase(recentSearch);
                    }
                });

                //activate Quick Navigation functionality
                new wiki.Findpages(element, {
                    rpc: function(value, callback){
                        wiki.jsonrpc("/search/pages", [value, 16], callback);
                    },
                    toUrl: wiki.toUrl.bind(wiki),
                    allowClone: function(){
                        return /view|preview|info|attach/.test( wiki.Context );
                    }
                });
            })

            //activate ajax search routines on Search.jsp
            .add( "#searchform2", function(form){

                wiki.search = new wiki.Search( form, {
                    xhrURL: wiki.XHRSearch,
                    onComplete: function(){
                        //console.log(form.query.get("value"));
                        wiki.prefs.set("PrevQuery", form.query.get("value"));
                    }
                });
            })

            //activate attachment upload routines
            .add( "#files", Form.File, {
                max: 8,
                rpc: function(progressid, callback){
                    //console.log("progress", progressid);
                    wiki.jsonrpc("/progressTracker", [progressid], callback);
                }
            });

        window.addEvents({
            popstate: wiki.popstate,
            domready: wiki.domready.bind(wiki)
        });



    },

    caniuse: function( body ){

        //Modernizr.addTest('flexbox', testAllProps('flexBasis', '1px', true));
        var hasNativeFlex = document.createElement('b');

        hasNativeFlex.style.cssText = "flex-basis:1px;";
        if(!!hasNativeFlex.style.length){
            body.addClass("can-flex");
        };

    },

    /*
    Function: domready
        After the DOM is fully loaded:
        - initialize the meta data wiki properties
        - initialize the section Links
        - when the "referrer" url (previous page) contains a "section=" parameter,
          scroll the wiki page to the right section
    */
    domready: function(){

        var wiki = this;

        wiki.dropdowns();

        wiki.meta();

        wiki.prefs = new Hash.Cookie("JSPWikiUserPrefs", {
            path: wiki.BasePath,
            duration: 20
        });

        //Object.each(wiki.prefs.hash, function(item,key){ console.log("PREFS  ",key,"=>",item); });

        if( wiki.version != wiki.prefs.get("version") ){
            wiki.prefs.empty();
            wiki.prefs.set("version", wiki.version);
        }


        //wiki.url = null;  //CHECK:  why this is needed?
        if( wiki.prefs.get("SectionEditing") && wiki.EditPermission && (wiki.Context != "preview") ){

            wiki.addEditLinks( wiki.toUrl( wiki.PageName, true ) );

        }

        //console.log( "section", document.referrer, document.referrer.match( /\&section=(\d+)$/ ) );
        wiki.scrollTo( ( document.referrer.match( /\&section=(\d+)$/ ) || [,-1])[1] );

        // initialize all registered behaviors
        wiki.update();

        //on page-load, also read the #hash and fire popstate events
        wiki.popstate();

        wiki.autofocus();

    },

    /*
    Function: popstate
        When pressing the back-button, the "popstate" event is fired.
        This popstate function will fire a internal 'popstate' event
        on the target DOM element.

        Behaviors (such as Tabs or Accordions) can push the ID of their
        visible content on the window.location hash.
        This ID can be retrieved when the back-button is pressed.

        When clicking a link referring to hidden content (tab, accordion), the
        popstate event is 'bubbled' up the DOM tree.

    */
    popstate: function(){

        var target = $(location.hash.slice(1)),
            events,
            popstate = "popstate";

        //console.log( popstate, location.hash, target );

        //only send popstate events to targets within the main page; eg not sidebar
        if( target && target.getParent(".page-content") ){

            while( !target.hasClass("page-content") ){

                events = target.retrieve("events"); //mootools specific - to read registered events on elements

                if( events && events[popstate] ){

                    target.fireEvent(popstate);

                }

                target = target.getParent();

            }
        }
    },

    autofocus: function(){

        var els, element;

        if( !("autofocus" in document.createElement("input") ) ){
            // editor/plain.jsp  textarea#wikiText
            // login.jsp         input#j_username
            // prefs/prefs       input#assertedName
            // find              input#query2
            els = $$("input[autofocus=autofocus], textarea[autofocus=autofocus]");
            while( els[0] ){
                element = els.shift();
                //console.log("autofocus", element, element.autofocus, element.isVisible(), element.offsetWidth, element.offsetHeight, "$", element.getStyle("display"), "$");
                if( element.isVisible() ){
                    element.focus();
                    return;
                }
            }
        }

    },

    /*
    Function: meta
        Read all the "meta" dom elements, prefixed with "wiki",
        and add them as properties to the wiki object.
        EG  <meta name="wikiContext">  becomes  wiki.Context
        * wikiContext : jspwiki requestcontext variable (view, edit, info, ...)
        * wikiBaseUrl
        * wikiPageUrl: page url template with dummy pagename "%23%24%25"
        * wikiEditUrl : edit page url
        * wikiJsonUrl : JSON-RPC / AJAX url
        * wikiPageName : pagename without blanks
        * wikiUserName
        * wikiTemplateUrl : path of the jsp template
        * wikiApplicationName
        * wikiEditPermission
    */
    meta: function(){

        var url,
            wiki = this,
            host = location.host;

        $$("meta[name^=wiki]").each( function(el){
            wiki[el.get("name").slice(4)] = el.get("content") || "";
        });

        // BasePath: if JSPWiki is installed in the root, then we have to make sure that
        // the cookie-cutter works properly here.
        url = wiki.BaseUrl;
        url = url ? url.slice( url.indexOf(host) + host.length, -1 ) : "";
        wiki.BasePath = ( url /*===""*/ ) ? url : "/";
        //console.log("basepath: " + wiki.BasePath);

    },

    /*
    Function: dropdowns
        Parse wikipages such ase MoreMenu, HomeMenu to act as bootstrap
        compatible dropdown menu items.
    */
    dropdowns: function(){

        $$( "ul.dropdown-menu > li > ul" ).each( function(ul){

            var li, parentLi = ul.getParent();

            while( (li = ul.getFirst("li")) ){

                if( li.innerHTML.trim() == "----" ){

                    li.addClass("divider");

                } else if( !li.getFirst() || !li.getFirst("a") ){

                    li.addClass("dropdown-header");

                }
                li.inject(parentLi, "before");

            }
            ul.dispose();

        });

        /* (deprecated) "pre-HADDOCK" moremenu style
              Consists of a list of links, with \\ delimitters
              Each <p> becomes a set of li, one for each link
              The block is terminated with a divider, if more <p's> are coming
        */
        $$( "ul.dropdown-menu > li.more-menu > p" ).each( function(element){

            var parentLi = element.getParent();

            element.getElements('a').each( function(link){
                ['li',[link]].slick().inject(parentLi, "before");
            });
            if( element.getNext('p *,hr') ){
                'li.divider'.slick().inject(parentLi, "before") ;
            }
            element.dispose();

        });

    },

    /*
    Function: getSections
        Returns the list of all section headers, excluding the header of the Table Of Contents.
    */
    getSections: function(){
        return $$(".page-content [id^=section]:not(#section-TOC)");
    },

    /*
    Function: scrollTo
        Scrolls the page to the section previously being edited - if any
        Section counting starts at 1??
    */
    scrollTo: function( index ){

        //console.log("Scroll to section ", index, ", Number of sections:", this.getSections().length );
        var element = this.getSections()[index];

        if( element ){
            location.replace( "#" + element.get("id") );
        }

    },

    /*
    Property: toUrl
        Convert a wiki pagename to a full wiki-url.
        Use the correct url template: view(default), edit-url or clone-url
    */
    toUrl: function(pagename, isEdit, isClone){

        var urlTemplate = isClone ? this.CloneUrl : isEdit ? this.EditUrl : this.PageUrl;
        return urlTemplate.replace(/%23%24%25/, this.cleanPageName(pagename) );

    },

    /*
    Property: toPageName
        Parse a wiki-url and return the corresponding wiki pagename
    */
    toPageName: function(url){

        var s = this.PageUrl.escapeRegExp().replace(/%23%24%25/, "(.+)");
        return ( url.match( RegExp(s) ) || [0, false] )[1];

    },

    /*
    Property: cleanPageName
        Remove all not-allowed chars from a pagename.
        Trim all whitespace, allow letters, digits and punctuation chars: ()&+, -=._$
        Mirror of org.apache.wiki.parser.MarkupParser.cleanPageName()
    */
    cleanPageName: function( pagename ){

        //\w is short for [A-Z_a-z0-9_]
        return pagename.clean().replace(/[^\w\u00C0-\u1FFF\u2800-\uFFFD\(\)&\+,\-=\.\$ ]/g, "");

    },

    /*
    Function: addEditLinks
        Add to each Section title (h2/h3/h4) a quick edit link.
        FFS: should better move server side
        FFS: add section #hash to automatically go back to the section being edited
    */
    addEditLinks: function( url ){

        var description = "quick.edit".localize();

        url = url + (url.contains("?") ? "&" : "?") + "section=";

        this.getSections().each( function(element, index){

            element.grab("a.editsection".slick({ html: description, href: url + index }));

        });

    },

    /*
    Function: configPrefs  (sofar only used in edit mode)
        Initialize the configuration checkboxes from the wiki prefs cookie.
        Save any change to the checkboxes back into the wiki prefs cookie.
        Also take care of switching between different editor types, saving the
        new editor type into the wiki prefs cookie.

        EG: tabcompletion, smartpairs, autosuggest, livepreview, previewcolumn. editor-type
    */
    configPrefs: function( form, onChangeFn ){

        var wiki = this;

        function onCheck(){

            var cmd = this.getAttribute("data-cmd"),
                isChecked = this.checked;

            wiki.toggleLivePreview(form, cmd, isChecked);
            wiki.prefs.set(cmd, isChecked);  //persist in the pref cookie
            if( onChangeFn ){ onChangeFn(cmd, isChecked); }

        }

        //Handle all configuration checkboxes
        form.getElements("[type=checkbox][data-cmd]").each( function( el ){

            el.checked = !!wiki.prefs.get(el.getAttribute("data-cmd"));
            el.addEvent("click", onCheck );
            onCheck.apply(el);

        });

        //Persist the selected editor type in the pref cookie
        form.getElements("a.editor-type").addEvent("click", function(){
            wiki.prefs.set("editor", this.get("text"));
        });

    },


    toggleLivePreview: function( container, cmd, state ){

        if( cmd.test( /livepreview|previewcolumn/ ) ){

            var previewcontainer = container.getElement(".edit-area").ifClass(state, cmd),
                ajaxpreview = container.getElement(".ajaxpreview");

            if( cmd == "livepreview" ){

                //disable the previewcolumn toolbar cmd checkbox
                container.getElement("[data-cmd=previewcolumn]").disabled = !state;

            } else {

                /* Toggle the position of the preview-area in the dom

                1. HORIZONTAL SIDE BY SIDE VIEW
                div.snip
                    div.toolbar
                    div.edit-area.livepreview.previewcolumn
                        div.col-50
                        div.col-50.ajaxpreview
                    div.resizer

                2. VERTICAL VIEW
                div.snip
                    div.toolbar
                    div.edit-area.livepreview
                        div.col-50
                    div.resizer
                    div.col-50.ajaxpreview
                */

                if( !state ){ previewcontainer = previewcontainer.getParent(); }
                previewcontainer.grab(ajaxpreview);

            }
        }

    },

    getXHRPreview: function( getContent, previewElement ){

        var wiki = this,
            loading = "loading",
            preview = function(p){ previewElement.removeClass(loading).set("text", p);};

        return (function(){

            previewElement.addClass(loading);

            new Request({
                url: wiki.XHRHtml2Markup,
                data: {
                    htmlPageText: getContent()
                },
                onSuccess: function(responseText){
                    preview( responseText.trim() );
                },
                onFailure: function(e){
                    preview( "Sorry, HTML to Wiki Markup conversion failed :=() " + e );
                }
            }).send();

        }).debounce();

    },

    /*
    Function: resizer
        Resize the target element, by dragging a .resizer handle.
        Multiple elements can be resized via the callback.
        The .resizer element can specify a prefs cookie to retrieve/store the height.
        Used by the plain and wysiwyg editor.

    Arguments:
        target - DOM element to be resized
        callback - function, to allow resizing of more elements

    Globals:
        wiki - main wiki object, to get/set preference fields
        textarea - resizable textarea (DOM element)
        preview - preview (DOM element)
    */
    resizer: function( target, callback ){

        var prefs = this.prefs,
            handle = document.getElement(".resizer"),
            pref = handle.getAttribute("data-pref"),
            h;

        function helpdragging(add){ handle.ifClass(add, "dragging"); }

        //targets.setStyle(height, options.initial || "100%" );
        if( pref ){
            h = prefs.get(pref) || 300;
            target.setStyle("height", h );
            callback( h );
        }

        target.makeResizable({
            handle: handle,
            modifiers: { x: null },
            onDrag: function(){
                h = this.value.now.y;
                callback(h);
                if(pref){ prefs.set(pref, h); }
            },
            onBeforeStart: helpdragging.pass(true),
            onComplete: helpdragging.pass(false),
            onCancel: helpdragging.pass(false)
        });

    },


    /*
    Function: jsonrpc
        Generic json-rpc routines to talk to the backend jspwiki-engine.
    Note:
        Uses the JsonUrl which is read from the meta element "WikiJsonUrl"
        {{{ <meta name="wikiJsonUrl" content="/JSPWiki-pipo/JSON-RPC" /> }}}
    Supported rpc calls:
        - {{search.findPages}} gets the list of pagenames with partial match
        - {{progressTracker.getProgress}} get a progress indicator of attachment upload
        - {{search.getSuggestions}} gets the list of pagenames with partial match
    Example:
        (start code)
        //Wiki.ajaxJsonCall('/search/pages,[Janne,20]', function(result){
        Wiki.jsonrpc("search.findPages", ["Janne", 20], function(result){
            //do something with the resulting json object
        });
        (end)
    */
    //jsonid: 1e4, //seed -- not used anymore
    jsonrpc: function(method, params, callback){

        if( this.JsonUrl ){

            //console.log(method, JSON.stringify(params) );

            //NOTE:  this is half a JSON rpc ... only responseText is JSON formatted
            new Request({
                url: this.JsonUrl + method,
                //method:"post"     //defaults to "POST"
                //urlEncoded: true, //content-type header = www-form-urlencoded + encoding
                //encoding: utf-8,
                onSuccess: function( responseText ){

                    //console.log(responseText, JSON.parse( responseText ) );
                    callback( JSON.parse( responseText ) )

                },
                onError: function(error){
                    //console.log(error);
                    callback( null );
                    throw new Error("Wiki rpc error: " + error);
                }

            }).send( "params=" + params );

            /* obsolete
            new Request.JSON({
                //url: this.JsonUrl,
                url: this.JsonUrl + method,
                data: JSON.encode({     //FFS ECMASCript5; JSON.stringify() ok >IE8
                    //jsonrpc:'2.0', //CHECK
                    id: this.jsonid++,
                    method: method,
                    params: params
                }),
                method: "post",
                onSuccess: function( response ){
                    if( response.error ){
                        throw new Error("Wiki servier rpc error: " + response.error);
                        callback(null);
                    } else {
                        callback( response.result );
                    }
                },
                onError: function(error){
                    //console.log(error);
                    throw new Error("Wiki rpc error: "+error);
                    callback(null);

                }
            }).send();
            */

        }

    }

};

Wiki.initialize();
