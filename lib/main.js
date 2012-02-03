var db = require('./memcache.js');    //store user db in memory!
var crypto = require("crypto");
var accessTokenTTL = 30 * 60 * 1000;   //30 minutes
var refreshTokenTTL = 60 * 60 * 1000;  //60 minutes
var defaultUserGroup = 'user';
var defaultAdminGroup = 'admin';

exports.addUser = function(config, callback) {

  var user = {};
  user.email = config.email;
  if (config.options && config.options.name) user.name = config.options.name;
  user.group = config.options.groupName;
  user.hasLoggedIn = false;
  user.changedInitialPassword = false;
  
  //validate if current user can do this.
  var currentUserEmail = db.get('emailByToken' + config.environment.SECURE_TOKEN);
  if (!currentUserEmail) {
    //check for special cases
    var existingUsers = db.get('userCount');
    if (existingUsers) {
      //this is equivalent to a self-register function
      user.ownedByGroup = defaultAdminGroup;
      user.group = defaultUserGroup;
    } else {
      //this is the first user in the database
      user.ownedByGroup = user.group;  //set this to same group so that user can be managed
    }
  } else {
    user.ownedByGroup = db.get('userByEmail' + currentUserEmail).group;
  }
  
  var checkExisting = db.get('userByEmail' + config.email);
  if (checkExisting) { 
    return callback('User already exists');
  }
  
  //initialize the password
  var passwordObject;
  if (config.options.password) {
    passwordObject = getSecuredPassword(config.options.password);
  } else {
    passwordObject = getNewPassword();
  } 
  user.passwordHash = passwordObject.passwordHash;
  user.passwordSalt = passwordObject.salt;
  
  //save the user
  db.set('userByEmail' + user.email, user);
  db.increment('userCount');
  
  //return the initial password
  var result = {};
  result.password = passwordObject.password;
  callback(null, result);
};

exports.removeUser = function(config, callback) {
  var currentUserEmail = db.get('emailByToken' + config.environment.SECURE_TOKEN);
  if (!currentUserEmail) {
    return callback('Invalid SECURE_TOKEN.  User not removed.');
  }
  var currentUser = db.get('userByEmail' + currentUserEmail);

  var zappedUser = db.get('userByEmail' + config.email);
  if (!zappedUser) {
     return callback('Could not find user ' + config.email);
  }
  
  //validate the user's permission to remove the zappedUser
  var owner = zappedUser.ownedByGroup;
  var currentUserGroup = currentUser.group;
  if (owner != currentUserGroup) {
    return callback('Current user does not have permission to remove ' + config.email);
  }
  
  //remove the user
  db.remove('userByEmail' + zappedUser.email);
  db.decrement('userCount');
  
  callback(null);
}

exports.login = function(config, callback) {
  
  var user = db.get('userByEmail' + config.email);
  if (!user) {
    return callback('User ' + config.email + ' not found');
  }
  
  if (!validatePassword(user, config.options.password)) {
    return callback('Invalid password');
  }
  
  var tokenTTL = 30 * 24 * 60 * 60 * 1000;  //in milliseconds
  var token = formatWordKey(crypto.randomBytes(20));
  db.set('emailByToken' + token, user.email, tokenTTL);
  
  var result = {};
  result.SECURE_TOKEN = token;
  result.firstLogin = !user.hasLoggedIn;
  result.changedInitialPassword = user.changedInitialPassword;
  
  user.hasLoggedIn = true;
  db.set('userByEmail' + user.email, user);
  
  callback(null, result);
}

exports.changePassword = function(config, callback) {
  var currentUserEmail = db.get('emailByToken' + config.environment.SECURE_TOKEN);
  if (!currentUserEmail) {
    return callback('Invalid SECURE_TOKEN.  Password not changed.');
  }

  var user = db.get('userByEmail' + currentUserEmail);
  if (!user) {
    return callback('User ' + config.email + ' not found');
  }
  
  if (!validatePassword(user, config.options.oldPassword)) {
    return callback('Old password is incorrect');
  }
  
  //get password in secure form
  var passwordObject = getSecuredPassword(config.options.newPassword);
  user.passwordHash = passwordObject.passwordHash;
  user.passwordSalt = passwordObject.salt;
  user.changedInitialPassword = true;
  
  //save the user
  db.set('userByEmail' + user.email, user);
  
  callback();
}

exports.registerOauth2Client = function(config, callback) {
  var currentUserEmail = db.get('emailByToken' + config.environment.SECURE_TOKEN);
  if (!currentUserEmail) {
    return callback('Invalid SECURE_TOKEN.  Client not registered.');
  } 
  
  //check if exists
  var globalUniqueName = config.name + '.' + currentUserEmail;
  var existing = db.get('clientByGlobalUniqueName' + globalUniqueName);
  if (existing) {
    return callback('Client name exists already.');
  }
  if (config.options.clientType != 'public' && config.options.clientType != 'confidential') {
    return callback('Client Type must be either public or confidential');
  }
  
  var client = {};
  client.name = config.name;
  client.type = config.options.clientType;
  client.redirectEndpoint = config.options.redirectEndpoint;
  client.id = formatWordKey(crypto.randomBytes(20));
  client.secret = formatWordKey(crypto.randomBytes(40));
  client.userEmail = currentUserEmail;
  client.globalUniqueName = client.name + '.' + currentUserEmail;
  
  db.set('clientByGlobalUniqueName' + client.globalUniqueName, client);
  db.set('clientGlobalUniqueNameById' + client.id, client.globalUniqueName);
  db.set('clientGlobalUniqueNameBySecret' + client.secret, client.globalUniqueName)
  db.addToIndex('clientNamesByUser' + currentUserEmail, client.name);

  var result = {};
  result.CLIENT_ID = client.id;
  result.CLIENT_SECRET = client.secret;
  
  callback(null, result);
}

exports.unregisterOauth2Client = function(config, callback) {
  var currentUserEmail = db.get('emailByToken' + config.environment.SECURE_TOKEN);
  if (!currentUserEmail) {
    return callback('Invalid SECURE_TOKEN.  Client not unregistered.');
  } 
  
  //check if exists
  var globalUniqueName = config.name + '.' + currentUserEmail;
  var existing = db.get('clientByGlobalUniqueName' + globalUniqueName);
  if (!existing) {
    return callback('Client name does not exist.');
  }
  
  db.remove('clientByGlobalUniqueName' + globalUniqueName);
  db.removeFromIndex('clientNamesByUser' + currentUserEmail, config.name);
  
  callback();
}

exports.listOAuth2Clients = function(config, callback) {
  var currentUserEmail = db.get('emailByToken' + config.environment.SECURE_TOKEN);
  if (!currentUserEmail) {
    return callback('Invalid SECURE_TOKEN.  Clients could not be listed.');
  }
  
  var clientNames = db.getIndex('clientNamesByUser' + currentUserEmail);
  var clients = [];
  for(var i=0;i<clientNames.length;i++) {
    var globalUniqueName = clientNames[i] + '.' + currentUserEmail;
    var client = db.get('clientByGlobalUniqueName' + globalUniqueName); 
    
    clients.push(client);
  }
  
  callback(null, clients);
}

exports.getAuthorizationCode = function(config, callback) {
  var currentUserEmail = db.get('emailByToken' + config.environment.SECURE_TOKEN);
  if (!currentUserEmail) {
    return callback('Invalid SECURE_TOKEN.  Authorization code not granted.');
  }
  
  var globalUniqueName = db.get('clientGlobalUniqueNameById' + config.options.clientId);
  if (!globalUniqueName) {
    return callback('Invalid Client Id.');
  }
  var client = db.get('clientByGlobalUniqueName' + globalUniqueName);
  
  var newCode = formatWordKey(crypto.randomBytes(20));
  var codeTTL = 10 * 60 * 1000;   //10 minutes
  db.set('clientGlobalUniqueNameByAuthCode' + newCode, globalUniqueName, codeTTL);
  db.set('userEmailByAuthCode' + newCode, currentUserEmail, codeTTL)
  db.set('scopeByAuthCode' + newCode, config.scope || []);
  
  var result = {};
  result.code = newCode;
  result.redirectEndpoint = client.redirectEndpoint;
  
  callback(null, result);
}

exports.getPublicAccessToken = function(config, callback) {
  var globalUniqueName = db.get('clientGlobalUniqueNameByAuthCode' + config.code);
  if (!globalUniqueName) {
    return callback('Invalid code.  Access token not granted.');
  }
  var client = db.get('clientByGlobalUniqueName' + globalUniqueName);
  if (client.type != 'public') {
    return callback('Invalid client - this client type only supports confidential access tokens (use getConfidentialAccessToken)');
  }
  var scope = db.get('scopeByAuthCode' + config.code);
  if (!scope) {
    return callback('Could not find scope for auth code ' + config.code);
  }
  var accessToken = formatWordKey(crypto.randomBytes(20));
  var refreshToken = formatWordKey(crypto.randomBytes(20));


  saveAccessToken(globalUniqueName, accessToken, refreshToken, scope)
  db.remove('clientGlobalUniqueNameByAuthCode' + config.code)   //code cannot be re-used
  
  var result = {};
  result.token = accessToken;
  result.refreshToken = refreshToken;
  result.expiresIn = accessTokenTTL / 1000;
  result.redirectEndpoint = client.redirectEndpoint;
  
  callback(null, result);
}

exports.getConfidentialAccessToken = function(config, callback) {
  var globalUniqueName = db.get('clientGlobalUniqueNameByAuthCode' + config.code);
  if (!globalUniqueName) {
    return callback('Invalid code.  Access token not granted.');
  }
  var client = db.get('clientByGlobalUniqueName' + globalUniqueName);
  if (client.type != 'confidential') {
    return callback('Invalid client - this client type only supports public access tokens (use getPublicAccessToken)');
  }
  var checkClient1 = db.get('clientGlobalUniqueNameBySecret' + config.environment.CLIENT_SECRET);
  var checkClient2 = db.get('clientGlobalUniqueNameById' + config.environment.CLIENT_ID);
  if ((globalUniqueName != checkClient1) || (globalUniqueName != checkClient2)) {
    return callback('Client authorization failed (invalid client id + secret)');
  }
  
  var accessToken = formatWordKey(crypto.randomBytes(20));
  var refreshToken = formatWordKey(crypto.randomBytes(20));

  var scope = db.get('scopeByAuthCode' + config.code);
  saveAccessToken(globalUniqueName, accessToken, refreshToken, scope);
  db.remove('clientGlobalUniqueNameByAuthCode' + config.code);   //code cannot be re-used
 
  var result = {};
  result.token = accessToken;
  result.refreshToken = refreshToken;
  result.expiresIn = accessTokenTTL / 1000;
  result.redirectEndpoint = client.redirectEndpoint;
  
  callback(null, result);
}

exports.getPublicRefreshedAccessToken = function(config, callback) {
  var globalUniqueName = db.get('clientGlobalUniqueNameByRefreshToken' + config.refreshToken);
  if (!globalUniqueName) {
    return callback('Invalid refresh token.  Access token not granted.');
  }
  var client = db.get('clientByGlobalUniqueName' + globalUniqueName);
  if (client.type != 'public') {
    return callback('Invalid client - this client type only supports confidential access tokens (use getConfidentialRefreshedAccessToken)');
  }

  var accessToken = formatWordKey(crypto.randomBytes(20));
  var refreshToken = formatWordKey(crypto.randomBytes(20));

  var scope = db.get('scopeByRefreshToken' + config.refreshToken);
  saveAccessToken(globalUniqueName, accessToken, refreshToken, scope);
  db.remove('clientGlobalUniqueNameByRefreshToken' + config.refreshToken);  //refresh token cannot be re-used
  
  var result = {};
  result.token = accessToken;
  result.refreshToken = refreshToken;
  result.expiresIn = accessTokenTTL / 1000;
  
  callback(null, result);
}

exports.getConfidentialRefreshedAccessToken = function(config, callback) {
  var globalUniqueName = db.get('clientGlobalUniqueNameByRefreshToken' + config.refreshToken);
  if (!globalUniqueName) {
    return callback('Invalid refresh token.  Access token not granted.');
  }
  var client = db.get('clientByGlobalUniqueName' + globalUniqueName);
  if (client.type != 'confidential') {
    return callback('Invalid client - this client type only supports public access tokens (use getPublicRefreshedAccessToken)');
  }
  var checkClient1 = db.get('clientGlobalUniqueNameBySecret' + config.environment.CLIENT_SECRET);
  var checkClient2 = db.get('clientGlobalUniqueNameById' + config.environment.CLIENT_ID);
  if ((globalUniqueName != checkClient1) || (globalUniqueName != checkClient2)) {
    return callback('Client authorization failed (invalid client id + secret)');
  }

  var accessToken = formatWordKey(crypto.randomBytes(20));
  var refreshToken = formatWordKey(crypto.randomBytes(20));

  var scope = db.get('scopeByRefreshToken' + config.refreshToken);
  saveAccessToken(globalUniqueName, accessToken, refreshToken, scope);
  db.remove('clientGlobalUniqueNameByRefreshToken' + config.refreshToken);  //refresh token cannot be re-used
  
  var result = {};
  result.token = accessToken;
  result.refreshToken = refreshToken;
  result.expiresIn = accessTokenTTL / 1000;
  
  callback(null, result);  
}

exports.getGrantedScope = function(config, callback) {
  var globalUniqueName = db.get('clientGlobalUniqueNameByAccessToken' + config.accessToken);
  if (!globalUniqueName) {
    return callback('Invalid refresh token.  Access token not granted.');
  }
  
  var scope = db.get('scopeByAccessToken' + config.accessToken);
 
  var result = {};
  result.scope = scope;
  callback(null, result);
}

function saveAccessToken(globalUniqueName, accessToken, refreshToken, scope) {
  db.set('clientGlobalUniqueNameByRefreshToken' + refreshToken, globalUniqueName, refreshTokenTTL);
  db.set('clientGlobalUniqueNameByAccessToken' + accessToken, globalUniqueName, accessTokenTTL);
  db.set('scopeByAccessToken' + accessToken, scope, accessTokenTTL);
  db.set('scopeByRefreshToken' + refreshToken, scope, refreshTokenTTL);
}

function formatWordKey(buf) {
	var key = "";  
	var letters = "ACDEFGHJKLMNPQRSTUVWXYZabcdefghjknpqrstuvxyz2345679";  //some letters skipped because they hard to distinguish from others
	for(var i=0;i<buf.length;i++) {
	  var letterNumber = buf[i] % letters.length;  
	  key = key + letters[letterNumber];
	};
	
	return key;
}

function getSecuredPassword(password) {
  var result = {};
  result.password = password;
  result.salt = crypto.randomBytes(20);
  
  var hash = crypto.createHash('sha1');
  hash.update(result.salt);
  hash.update(result.password);
  result.passwordHash = hash.digest();
  
  return result;
}

function getNewPassword() {
  var password = formatWordKey(crypto.randomBytes(10));
  var result = getSecuredPassword(password);
  return result;
}

function validatePassword(user, password) {
  var hash = crypto.createHash('sha1');
  hash.update(user.passwordSalt);
  hash.update(password);
  
  return (hash.digest().toString() == user.passwordHash.toString());
}

