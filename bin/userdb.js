#!/usr/bin/env node

var perfectapi = require('perfectapi');  
var path = require('path');
var main = require('../lib/main.js');

var configPath = path.resolve(__dirname, '..', 'perfectapi.json');
var parser = new perfectapi.Parser();
module.exports = parser.parse(configPath);

//handle the commands
parser.on("addUser", function(config, callback) {
  main.addUser(config, function(err, result) {
    callback(err, result);
  });
});

parser.on("removeUser", function(config, callback) {
  main.removeUser(config, function(err, result) {
    callback(err, result);
  });
});

parser.on("login", function(config, callback) {
  main.login(config, function(err, result) {
    callback(err, result);
  });
});

parser.on("changePassword", function(config, callback) {
  main.changePassword(config, function(err, result) {
    callback(err, result);
  });
});

parser.on("registerOauth2Client", function(config, callback) {
  main.registerOauth2Client(config, function(err, result) {
    callback(err, result);
  });
});

parser.on("unregisterOauth2Client", function(config, callback) {
  main.unregisterOauth2Client(config, function(err, result) {
    callback(err, result);
  });
});

parser.on("listOAuth2Clients", function(config, callback) {
  main.listOAuth2Clients(config, function(err, result) {
    callback(err, result);
  });
});