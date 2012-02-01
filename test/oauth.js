var userdb = require('../bin/userdb.js');

describe('userdb', function(){
  var password;
  var newPassword = 'qwerty';
  var redirectEndpoint = "http://redirectEndpoint/";
  var SECURE_TOKEN, CLIENT_ID, CLIENT_SECRET, USER_SECURE_TOKEN, AUTH_CODE, ACCESS_TOKEN, REFRESH_TOKEN;
  var CLIENT_ID2, CLIENT_SECRET2, AUTH_CODE2, ACCESS_TOKEN2, REFRESH_TOKEN2;
  var email = 'steve@perfectapi.com';
  
  describe('addUser', function() {
    it('should return a password', function() {
      var config = { email: email, options: {groupName: 'superuser'} };
      userdb.addUser(config, function(err, result) {
        if (err) throw err;
        result.should.have.property('password');
        
        password = result.password;
      })
    })  
  })

  describe('login', function() {
    it('should return a token', function() {
      var config = { email: email, options: {password: password} };
      userdb.login(config, function(err, result) {
        if (err) throw err;
        result.should.have.property('SECURE_TOKEN');
      
        SECURE_TOKEN = result.SECURE_TOKEN;
      })
    })
  })
  
  describe('change Password', function() {
    it('should work without error', function(done) {
      var config = { environment: {"SECURE_TOKEN": SECURE_TOKEN}, options: {oldPassword: password, newPassword: newPassword} };
      userdb.changePassword(config, done);
    })
  })
  
  describe('registerClient', function() {
    it('should return client id and secret for a public client', function() {
      var config = { environment: {"SECURE_TOKEN": SECURE_TOKEN}, name: "my public client app", options: {clientType: "public", redirectEndpoint: redirectEndpoint} };
      userdb.registerOauth2Client(config, function(err, result) {
        if (err) throw err;
        
        result.should.have.property('CLIENT_ID');
        result.should.have.property('CLIENT_SECRET');
        
        CLIENT_ID = result.CLIENT_ID;
        CLIENT_SECRET = result.CLIENT_SECRET;
      })
    })
    it('should return client id and secret for a confidential client', function() {
      var config = { environment: {"SECURE_TOKEN": SECURE_TOKEN}, name: "my confidential client app", options: {clientType: "confidential", redirectEndpoint: redirectEndpoint} };
      userdb.registerOauth2Client(config, function(err, result) {
        if (err) throw err;
        
        result.should.have.property('CLIENT_ID');
        result.should.have.property('CLIENT_SECRET');
        
        CLIENT_ID2 = result.CLIENT_ID;
        CLIENT_SECRET2 = result.CLIENT_SECRET;
      })
    })
    it('should give an error if clientType not public or confidential', function() {
      var config = { environment: {"SECURE_TOKEN": SECURE_TOKEN}, name: "my bad client app", options: {clientType: "badType", redirectEndpoint: redirectEndpoint} };
      userdb.registerOauth2Client(config, function(err, result) {
        err.should.have.property('name');
      })
    })
  })
  
  describe('setup user for oauth', function() {
    //need to create another user to be the resource owner
    it('should get us a secure token for use later on', function() {
      var config = { email: 'someuser@perfectapi.com', options: {groupName: 'user'}, environment: {"SECURE_TOKEN": SECURE_TOKEN} };
      userdb.addUser(config, function(err, result) {
        if (err) throw err;
        
        config.options.password = result.password;
        userdb.login(config, function(err, result) {
          if (err) throw err;
          
          USER_SECURE_TOKEN = result.SECURE_TOKEN;
      
        })
      })         
    })
  })

  describe('getAuthorizationCode', function() {
    it('should return a code and an endpoint', function() {
      var config = { scope: ['test1', 'test2'], options: {clientId: CLIENT_ID}, environment: {SECURE_TOKEN: USER_SECURE_TOKEN} };
      userdb.getAuthorizationCode(config, function(err, result) {
        if (err) throw err;
        
        result.should.have.property('code');
        result.should.have.property('redirectEndpoint');
        
        result.redirectEndpoint.should.equal(redirectEndpoint);
        AUTH_CODE = result.code;
      })      
    })
    it('should return a code and an endpoint for confidential client too', function() {
      var config = { scope: ['test3', 'test4'], options: {clientId: CLIENT_ID2}, environment: {SECURE_TOKEN: USER_SECURE_TOKEN} };
      userdb.getAuthorizationCode(config, function(err, result) {
        if (err) throw err;
        
        result.should.have.property('code');
        result.should.have.property('redirectEndpoint');
        
        result.redirectEndpoint.should.equal(redirectEndpoint);
        AUTH_CODE2 = result.code;
      })      
    })
  })
  
  describe('getPublicAccessToken', function() {
    it('should return an access token and a refresh token', function() {
      var config = { code: AUTH_CODE };
      userdb.getPublicAccessToken(config, function(err, result) {
        if (err) throw err;
        
        result.should.have.property('token');
        result.should.have.property('refreshToken');
        result.should.have.property('expiresIn', 30 * 60);
        result.should.have.property('redirectEndpoint', redirectEndpoint);
        
        ACCESS_TOKEN = result.token;
        REFRESH_TOKEN = result.refreshToken;
      })
    })
  })
  
  describe('getConfidentialAccessToken', function() {
    it('should give an error if client id is wrong', function() {
      var config = { code: AUTH_CODE2, environment: {CLIENT_ID: CLIENT_ID, CLIENT_SECRET: CLIENT_SECRET2} };
      userdb.getConfidentialAccessToken(config, function(err, result) {
        err.should.have.property('name');
      })      
    })
    it('should give an error if client secret is wrong', function() {
      var config = { code: AUTH_CODE2, environment: {CLIENT_ID: CLIENT_ID2, CLIENT_SECRET: CLIENT_SECRET} };
      userdb.getConfidentialAccessToken(config, function(err, result) {
        err.should.have.property('name');
      })      
    })
    it('should return an access token and refresh token', function() {
      var config = { code: AUTH_CODE2, environment: {CLIENT_ID: CLIENT_ID2, CLIENT_SECRET: CLIENT_SECRET2} };
      userdb.getConfidentialAccessToken(config, function(err, result) {
        if (err) throw err;
        
        result.should.have.property('token');
        result.should.have.property('refreshToken');
        result.should.have.property('expiresIn', 30 * 60);
        result.should.have.property('redirectEndpoint', redirectEndpoint);
        
        ACCESS_TOKEN2 = result.token;
        REFRESH_TOKEN2 = result.refreshToken;
      })    
    })

  })
  
  describe('getGrantedScope', function() {
    it('should return the initially granted scope', function() {
      
      var config = { accessToken: ACCESS_TOKEN };
      userdb.getGrantedScope(config, function(err, result) {
        if (err) throw err;
        
        result.should.have.property('scope');
        result.scope.should.have.length(2);
        result.scope[0].should.equal('test1');
        result.scope[1].should.equal('test2');
      })  
    })
    it('should return the initially granted scope for confidential too', function() {     
      var config = { accessToken: ACCESS_TOKEN2 };
      userdb.getGrantedScope(config, function(err, result) {
        if (err) throw err;
        
        result.should.have.property('scope');
        result.scope.should.have.length(2);
        result.scope[0].should.equal('test3');
        result.scope[1].should.equal('test4');
      })  
    })
  })
  
  describe('getPublicRefreshedAccessToken', function() {
    it('should return a new access token and new refresh token', function() {
      var config = {refreshToken: REFRESH_TOKEN};
      userdb.getPublicRefreshedAccessToken(config, function(err, result) {
        if (err) throw err;
      
        result.should.have.property('token');
        result.should.have.property('refreshToken');
        result.should.have.property('expiresIn', 30 * 60);
        
        result.token.should.not.equal(ACCESS_TOKEN);
        result.refreshToken.should.not.equal(REFRESH_TOKEN);

        ACCESS_TOKEN = result.token;
      })
    })
    it('should return an error if we try use the same refresh token again', function() {
      var config = {refreshToken: REFRESH_TOKEN};
      userdb.getPublicRefreshedAccessToken(config, function(err, result) {
        err.should.have.property('name');
      }) 
    })
    it('should work if we use the new access token', function() {
      var config = { accessToken: ACCESS_TOKEN };
      userdb.getGrantedScope(config, function(err, result) {
        if (err) throw err;
        
        result.should.have.property('scope');
        result.scope.should.have.length(2);
        result.scope[0].should.equal('test1');
        result.scope[1].should.equal('test2');
      })  
    })
  })
  
  describe('getConfidentialRefreshedAccessToken', function() {
    it('should return a new access token and new refresh token', function() {
      var config = {refreshToken: REFRESH_TOKEN2, environment: {CLIENT_ID: CLIENT_ID2, CLIENT_SECRET: CLIENT_SECRET2}};
      userdb.getConfidentialRefreshedAccessToken(config, function(err, result) {
        if (err) throw err;
      
        result.should.have.property('token');
        result.should.have.property('refreshToken');
        result.should.have.property('expiresIn', 30 * 60);
        
        result.token.should.not.equal(ACCESS_TOKEN2);
        result.refreshToken.should.not.equal(REFRESH_TOKEN2);

        ACCESS_TOKEN2 = result.token;
      })
    })
    it('should return an error if we try use the same refresh token again', function() {
      var config = {refreshToken: REFRESH_TOKEN2, environment: {CLIENT_ID: CLIENT_ID2, CLIENT_SECRET: CLIENT_SECRET2}};
      userdb.getConfidentialRefreshedAccessToken(config, function(err, result) {
        err.should.have.property('name');
      }) 
    })
    it('should work if we use the new access token', function() {
      var config = { accessToken: ACCESS_TOKEN2, environment: {CLIENT_ID: CLIENT_ID2, CLIENT_SECRET: CLIENT_SECRET2}};
      userdb.getGrantedScope(config, function(err, result) {
        if (err) throw err;
        
        result.should.have.property('scope');
        result.scope.should.have.length(2);
        result.scope[0].should.equal('test3');
        result.scope[1].should.equal('test4');
      })  
    })
  })
})


















