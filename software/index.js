let loginModal;
	
var deserve_api = (function(api)
{
    window.addEventListener("unload", function()
    {
        console.debug("deserve_api addListener unload");
    });

    window.addEventListener("load", function()
    {
		const username = sessionStorage.getItem("project.deserve.user");
		const password = sessionStorage.getItem("project.deserve.password");	

		if (!username || !password) {
			WebAuthnGoJS.CreateContext(JSON.stringify({RPDisplayName: "Project Deserve", RPID: window.location.hostname, RPOrigin: window.location.origin}), (err, val) => {
				if (err) {
					location.href = "/";
				}
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
			});		
		} else {
			displayCredentials(username, password);
		}
    });
	
	function displayCredentials(username, password) {
		sessionStorage.setItem("project.deserve.user", username);
		sessionStorage.setItem("project.deserve.password", password);	

		
		console.debug("displayCredentials", username, password);
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
				console.error("Login failed", err);				
				location.href = "/";
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
					
					if (err) {
						location.href = "/";
					}						
					displayCredentials(username, userStr);
				});
			}).catch((err) => {
				console.error("Login failed", err);
				location.href = "/";				
			});
	  });
	}	
	

	function registerUser() {
		//getCredentials(createUserCredentials);
		const username = prompt("Username?");
		const token = prompt("Token?");
		
		createUserCredentials(username, token);
	}	
	
	function createUserCredentials(username, token) 
	{
		if (!username || username === "" || !token || token === "") {
			location.href = "/";
		}
		
		const displayName = username;
		username = username.toLocaleLowerCase().replaceAll(" ", "");		

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
			displayName: displayName,
			credentials: [],
		};
  
		const userStr = JSON.stringify(user);

		WebAuthnGoJS.BeginRegistration(userStr, (err, data) => 
		{
			if (err) {
				console.error("Registration failed", err);				
				location.href = "/";
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
					if (err) {
						console.error("Registration failed", err);				
						location.href = "/";
					}
					
					const credential = JSON.parse(result);
					credential.github_token = token;
					user.credentials.push(credential);						
					registerCredential(username, JSON.stringify(user));

				});
				
			}).catch((err) => {
				console.error("Registration failed", err);
				location.href = "/";				
			});
		})
	}
	
	async function hashCode(target){
	   var buffer = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(target));
	   var chars = Array.prototype.map.call(new Uint8Array(buffer), ch => String.fromCharCode(ch)).join('');
	   return btoa(chars);
	}
	
	function registerCredential(id, pass) {
		navigator.credentials.create({password: {id: id, password: pass}}).then(function(credential)
		{
			console.debug("registerCredential", credential);
		
			if (credential) {
				navigator.credentials.store(credential).then(function()
				{
					console.log("registerCredential - storeCredentials stored");				
					displayCredentials(id, pass);				

				}).catch(function (err) {
					console.error("registerCredential - storeCredentials error", err);
				});
			}

		}).catch(function (err) {
			console.error("registerCredential - storeCredentials error", err);		
		});			
	}	

    //-------------------------------------------------------
    //
    //  UI
    //
    //-------------------------------------------------------	
	
    function getCredentials(callback) {
        const template = 
`			<div class="modal-header">
				<h4 class="modal-title">Project Deserve - Login</h4>
			</div>
			<div class="modal-body">
				<form id="login_user" class="form-inline">
					<div class="form-group">
						<label for="user_name">Name</label>
						<input id="user_name" class="form-control" type="text"/>
					</div>
					<div class="form-group">
						<label for="user_password">Access Code</label>
						<input id="user_password" class="form-control" type="text"/>
					</div>
				</form>
			</div>
		`;

        if (!loginModal) {
            loginModal = new tingle.modal({
                footer: true,
                stickyFooter: false,
                closeMethods: ['overlay', 'button', 'escape'],
                closeLabel: 'Login',

                beforeOpen: function () {
                    console.debug("beforeOpen");
                }
            });

            loginModal.setContent(template);

            loginModal.addFooterBtn("Login", 'tingle-btn tingle-btn-primary', () => {
				const username = document.querySelector('#user_name').value;
				const password = document.querySelector('#user_password').value;

                console.debug("Login", username);	
				callback(username, password);
                loginModal.close();				
            });

            loginModal.addFooterBtn("Close", 'tingle-btn tingle-btn-secondary', () => {
                loginModal.close();
            });
        }

        loginModal.open();
    }	

    //-------------------------------------------------------
    //
    //  Startup
    //
    //-------------------------------------------------------
	
	loadCSS('./software/tingle.min.css');	
	loadJS('./software/tingle.min.js');	
	loadJS('./software/go-webauthn.min.js');		

    return api;

}(deserve_api || {}));