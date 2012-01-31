# What is this?

This is a generic API for managing user authentication credentials.  It is approprite for use wherever you have a need to manage usernames & passwords.  It also supports managing client credentials in OAUTH.

The implementation is a reference implementation.  If you already have a database for storing user authentication, then you should fork this project and create your own implementation that references your own database.  Please name your own implementation by appending to this name, e.g. node-userdb-redis (to create a Redis implementation). 

## Why would I use this if it is just a reference implementation?

 - You may use it just to get started with a mock implementation, and once your project is ready, create your own implementation.
 - This represents a standard API for modern user authentication needs, such as OAUTH 2.0.  By using this as a starting point, you are sure to have what you need in order to implement those standards.
 
