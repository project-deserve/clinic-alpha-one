import { html, render } from '/clinic-alpha-one/dist/lit-html.min.js';

let $iq, $msg, $pres, _ , __, dayjs, converse_html, _converse, hostname = "localhost", host = "localhost:7070";
	
var converse_api = (function(api)
{
    window.addEventListener("unload", function()
    {
        console.debug("converse_api addListener unload");
    });

    window.addEventListener("load", function()
    {
		const username = sessionStorage.getItem("project.deserve.user");
		const password = sessionStorage.getItem("project.deserve.password");		
		
		if (!username) {
			WebAuthnGoJS.CreateContext(JSON.stringify({RPDisplayName: "Project Deserve", RPID: window.location.hostname, RPOrigin: window.location.origin}), (err, val) => {
				if (!err) {
					navigator.credentials.get({password: true}).then(function(credential) {
						console.debug("window.load credential", credential);	
						
						if (credential) {
							loginUser(credential.id, credential.password);
						} else {
							registerUser();							
						}
					}).catch(function(err){
						console.error("window.load credential error", err);	
						registerUser();					
					});	
				}
			});		
		} else {
			setupConverse(username, password);
		}
    });
		
    async function setupConverse(username, password)
    {
		sessionStorage.setItem("project.deserve.user", username);
		sessionStorage.setItem("project.deserve.password", password);		
		
		const pass = await hashCode(password);
		
        var config =
        {
            theme: 'concord',
			assets_path: "/clinic-alpha-one/dist/",			
            allow_non_roster_messaging: true,
            loglevel: 'info',
            authentication: 'login',
            auto_login: true,
		    discover_connection_methods: false,					
            jid: username + "@" + hostname,
			password: pass,
            default_domain: hostname,
            domain_placeholder: hostname,
            locked_domain: hostname,
            auto_away: 300,
            auto_reconnect: true,
			nickname: username,
            bosh_service_url: location.protocol + '//' + host + '/http-bind/',
            auto_join_rooms:['deserve_chat@conference.' + hostname],
			auto_join_private_chats: [],
            message_archiving: 'always',
			websocket_url: (host == "localhost:7070" || location.protocol == "http:" ? "ws://" : "wss://") + host + '/ws/',
            whitelisted_plugins: ['deserve']
        }

        console.debug("converse_api setupConverse", config);

        converse.plugins.add("deserve", {
            dependencies: [],

            initialize: function () {
                _converse = this._converse;
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
		console.debug("loadJS", name);
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

	function bufferDecode(value) {
	  return Uint8Array.from(atob(value), c => c.charCodeAt(0));
	}

	function bufferEncode(value) {
	  return btoa(String.fromCharCode.apply(null, new Uint8Array(value)))
		.replace(/\+/g, "-")
		.replace(/\//g, "_")
		.replace(/=/g, "");;
	}

	function loginUser(username, userStr) {
		const user = JSON.parse(userStr);
		console.debug("loginUser", user);		
		
		const loginCredRequest = (credentialRequestOptions) => {
			credentialRequestOptions.publicKey.challenge = bufferDecode(credentialRequestOptions.publicKey.challenge);
			credentialRequestOptions.publicKey.allowCredentials.forEach(function (listItem) {
			  listItem.id = bufferDecode(listItem.id)
			});

			return navigator.credentials.get({
			  publicKey: credentialRequestOptions.publicKey
			})
		}

		WebAuthnGoJS.BeginLogin(userStr, (err, data) => {
			if (err) {
			  alert(err); return;
			}

			data = JSON.parse(data);
			user.authenticationSessionData = data.authenticationSessionData;

			loginCredRequest(data.credentialRequestOptions).then((assertion) => {
				let authData = assertion.response.authenticatorData;
				let clientDataJSON = assertion.response.clientDataJSON;
				let rawId = assertion.rawId;
				let sig = assertion.response.signature;
				let userHandle = assertion.response.userHandle;

				const finishLoginObj = {
					id: assertion.id,
					rawId: bufferEncode(rawId),
					type: assertion.type,
					response: {
						authenticatorData: bufferEncode(authData),
						clientDataJSON: bufferEncode(clientDataJSON),
						signature: bufferEncode(sig),
						userHandle: bufferEncode(userHandle)
					}
				}

				const loginBodyStr = JSON.stringify(finishLoginObj);
				const authSessDataStr = JSON.stringify(user.authenticationSessionData)

				WebAuthnGoJS.FinishLogin(userStr, authSessDataStr, loginBodyStr, (err, result) => {
					console.debug("Login result", username, err, result);
					if (!err) setupConverse(username, userStr);
				});
			}).catch((err) => {
				console.error("Login failed", err);
			});
	  });
	}	
	
	function registerUser() {
		const username = prompt("Please enter a username").toLocaleLowerCase().replaceAll(" ", "");
		const token = prompt("Please enter your password");

		if (!username || username === "" || !token || token === "") {
			return;
		}

		const createPromiseFunc = (credentialCreationOptions) => 
		{
			credentialCreationOptions.publicKey.challenge = bufferDecode(credentialCreationOptions.publicKey.challenge);
			credentialCreationOptions.publicKey.user.id = bufferDecode(credentialCreationOptions.publicKey.user.id);
			
			if (credentialCreationOptions.publicKey.excludeCredentials) 
			{
			  for (var i = 0; i < credentialCreationOptions.publicKey.excludeCredentials.length; i++) {
				credentialCreationOptions.publicKey.excludeCredentials[i].id = bufferDecode(credentialCreationOptions.publicKey.excludeCredentials[i].id);
			  }
			}

			return navigator.credentials.create({
			  publicKey: credentialCreationOptions.publicKey
			})
		}

		const user = {
			id: Math.floor(Math.random() * 1000000000),
			name: username,
			displayName: username,
			credentials: [],
		};
  
		const userStr = JSON.stringify(user);

		WebAuthnGoJS.BeginRegistration(userStr, (err, data) => 
		{
			if (err) {
			  alert(err); return;
			}
			
			data = JSON.parse(data);
			user.registrationSessionData = data.registrationSessionData;

			createPromiseFunc(data.credentialCreationOptions).then((credential) => {
				let attestationObject = credential.response.attestationObject;
				let clientDataJSON = credential.response.clientDataJSON;
				let rawId = credential.rawId;

				const registrationBody = {
					id: credential.id,
					rawId: bufferEncode(rawId),
					type: credential.type,
					response: {
					  attestationObject: bufferEncode(attestationObject),
					  clientDataJSON: bufferEncode(clientDataJSON),
					},
				};

				// Stringify
				const regBodyStr = JSON.stringify(registrationBody);
				const sessDataStr = JSON.stringify(user.registrationSessionData)

				WebAuthnGoJS.FinishRegistration(userStr, sessDataStr, regBodyStr, (err, result) => 
				{
					if (!err) {
						const credential = JSON.parse(result);
						credential.github_token = token;
						user.credentials.push(credential);						
						registerCredential(username, JSON.stringify(user));
					}
				});
				
			}).catch((err) => {
				console.error("Registration failed", err);
			});
		})
	}
	
	function registerCredential(id, pass) {
		navigator.credentials.create({password: {id: id, password: pass}}).then(function(credential)
		{
			console.debug("registerCredential", credential);
		
			if (credential) {
				navigator.credentials.store(credential).then(function()
				{
					console.log("registerCredential - storeCredentials stored");
					registerXmppUser(id, pass);					

				}).catch(function (err) {
					console.error("registerCredential - storeCredentials error", err);
				});
			}

		}).catch(function (err) {
			console.error("registerCredential - storeCredentials error", err);		
		});			
	}	

	async function hashCode(target){
	   var buffer = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(target));
	   var chars = Array.prototype.map.call(new Uint8Array(buffer), ch => String.fromCharCode(ch)).join('');
	   return btoa(chars);
	}
	
	async function registerXmppUser(id, pass) {		
		const url = location.protocol + '//' + host + '/http-bind/';
		const connection = new Strophe.Connection(url);	
		const password = await hashCode(pass);
		
		const callback = function (status) 
		{
			if (status === Strophe.Status.REGISTER) {
				connection.register.fields.username = id;
				connection.register.fields.password = password;
				connection.register.submit();
				
			} else if (status === Strophe.Status.REGISTERED) {
				console.debug("callback - registered!");
				connection.disconnect();				
				setupConverse(id, pass);				
				
			} else if (status === Strophe.Status.CONFLICT) {
				console.log("callback - user already existed!");
				connection.disconnect();				
				setupConverse(id, pass);				
				
			} else if (status === Strophe.Status.NOTACCEPTABLE) {
				console.log("callback - registration form not properly filled out.");
				connection.disconnect();				
				
			} else if (status === Strophe.Status.REGIFAIL) {
				console.log("callback - The Server does not support In-Band Registration");
				connection.disconnect();				
			}
		};
			
		connection.register.connect(hostname, callback);		
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
	
	loadCSS('/clinic-alpha-one/dist/converse.min.css');
	loadJS('/clinic-alpha-one/dist/go-webauthn.min.js');		
	loadJS('/clinic-alpha-one/dist/stophe.min.js');
	loadJS('/clinic-alpha-one/dist/strophe.register.js');
	loadJS('/clinic-alpha-one/dist/libsignal-protocol.min.js');	
	loadJS('/clinic-alpha-one/dist/converse.js');	

    return api;

}(converse_api || {}));