var db = require('./memcache.js');    //store user db in memory!
var crypto = require("crypto");

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
    //check for special case - no users yet, so let this user add himself
    var existingUsers = db.get('userCount');
    if (existingUsers) {
      return callback('Invalid SECURE_TOKEN.  User not added.');
    }
    user.ownedByGroup = user.group;  //set this to same group so that user can be managed
  } else {
    user.ownedByGroup = db.get('userByEmail' + currentUserEmail).group;
  }
  
  var checkExisting = db.get('userByEmail' + config.email);
  if (checkExisting) { 
    return callback('User already exists');
  }
  
  //initialize the password
  var passwordObject = getNewPassword();
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
    return callback('Invalid SECURE_TOKEN.  User not removed.');
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

function formatWordKey(buf) {
	var key = "";  
	var letters = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz";  //no I,O,i,l,o because they hard to read
	for(var i=0;i<buf.length;i++) {
	  var letterNumber = buf[i] % letters.length;  
	  key = key + letters[letterNumber];
	};
	
	return key;
}

function getSecuredPassword(password) {
  var result = {};
  result.password = password;
  result.salt = crypto.randomBytes(12);
  
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

