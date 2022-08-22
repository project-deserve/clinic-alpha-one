import { html, render } from './lit-html.min.js';

let Strophe, $iq, $msg, $pres, _ , __, dayjs, converse_html, _converse, hostname = "pade.chat", host = "pade.chat:5443";
	
var converse_api = (function(api)
{
    window.addEventListener("unload", function()
    {
        console.debug("converse_api addListener unload");
    });

    window.addEventListener("load", function()
    {
		loadCSS('/clinic-alpha-one/dist/converse.min.css');
		loadJS('/clinic-alpha-one/dist/libsignal-protocol.min.js');
		loadJS('/clinic-alpha-one/dist/converse.js');
		
		loadJS('/packages/galene/galene.js');			

		setupConverse();
    });
	
    function setupConverse()
    {
        if (!window.converse)
        {
            setTimeout(setupConverse, 500);
            return;
        }

        var config =
        {
            theme: 'concord',
			assets_path: "/clinic-alpha-one/dist/",			
            allow_non_roster_messaging: true,
            loglevel: 'info',
            authentication: 'anonymous',
            auto_login: true,
		    discover_connection_methods: false,					
            jid: hostname,
            default_domain: hostname,
            domain_placeholder: hostname,
            locked_domain: hostname,
            auto_away: 300,
            auto_reconnect: true,
            bosh_service_url: 'https://' + host + '/http-bind/',
            auto_join_rooms:['deserve_chat@conference.' + hostname],
            message_archiving: 'always',
			websocket_url: (host == "localhost:7070" || location.protocol == "http:" ? "ws://" : "wss://") + host + '/ws/',
            whitelisted_plugins: ['deserve']
        }

        console.debug("converse_api setupConverse", config);

        converse.plugins.add("deserve", {
            dependencies: [],

            initialize: function () {
                _converse = this._converse;

                Strophe = converse.env.Strophe;
                $iq = converse.env.$iq;
                $msg = converse.env.$msg;
                $pres = converse.env.$pres;
                _ = converse.env._;
                __ = _converse.__;
                dayjs = converse.env.dayjs;
                converse_html = converse.env.html;

                _converse.api.listen.on('getToolbarButtons', function(toolbar_el, buttons)
                {
                    //console.debug("getToolbarButtons", toolbar_el);

                    buttons.push(converse_html`
                        <button class="deserve-exit" title="${__('Minimize chat')}" @click=${exitConversation} .chatview=${this.chatview}/>
                            <converse-icon class="fa fa-minus" size="1em"></converse-icon>
                        </button>
                    `);
                    return buttons;
                });

            }

        });

        converse.initialize( config );
    };

    function exitConversation(ev)
    {
        ev.stopPropagation();
        ev.preventDefault();

        const toolbar_el = converse.env.utils.ancestor(ev.target, 'converse-chat-toolbar');
        console.debug("exitConversation", toolbar_el.model);
        const view = _converse.chatboxviews.get(toolbar_el.model.get("jid"));
        if (view) view.minimize(ev);
    }

    function loadJS(name)
    {
        var s1 = document.createElement('script');
        s1.src = name;
        s1.async = false;
        document.body.appendChild(s1);
    }

    function loadCSS(name)
    {
        var head  = document.getElementsByTagName('head')[0];
        var link  = document.createElement('link');
        link.rel  = 'stylesheet';
        link.type = 'text/css';
        link.href = name;
        head.appendChild(link);
    }

    //-------------------------------------------------------
    //
    //  Startup
    //
    //-------------------------------------------------------

    const div = document.createElement('div');
    const container = "#conversejs .converse-chatboxes {bottom: 45px;}\n";
    const control = "#conversejs.converse-overlayed .toggle-controlbox {display: none;}\n";
    const chatroom = "#conversejs .chat-head-chatroom, #conversejs.converse-embedded .chat-head-chatroom { background-color: #eee; }\n";
    const chatbox = "#conversejs.converse-overlayed #minimized-chats .minimized-chats-flyout .chat-head { background-color: #eee;}";

    div.innerHTML = '<style>' + control + chatroom + chatbox + '</style><div id="conversejs" class="theme-concord"></div>';
    document.body.appendChild(div);

    return api;

}(converse_api || {}));