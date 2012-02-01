# What is this?

This is a generic API for managing user authentication credentials.  It is approprite for use wherever you have a need to manage usernames & passwords.  It also supports OAUTH 2.0, and so can be used as a backend for an OAUTH 2 implementation.

The implementation is a reference implementation that stores the user database in the process memory.  If you already have a database for storing user authentication, then you should fork this project and create your own implementation that references your own database.  

## Why would I use this if it is just an in-memory implementation?

 - You may use it just to get started with a mock implementation, and once your project is ready, create your own implementation.
 - This represents a standard API for modern user authentication needs and OAUTH 2.0.  By using this as a starting point, you are sure to have what you need in order to implement those standards
 - This API follows best practices for storing passwords, and is thus a good starting point for your own implementation
 - You can use this as a mock implementation for testing
 
# Adding the first user

This implementation allows the first user to be added without a valid SECURE_TOKEN.  

# How groups work

Groups are implemented as a simple tiered admin system.  Every user has a group, and when they add another user then that group is stored as the "owner" of that new user.  Any user in the owner-group can manage that user.  An example heirarchy of groups is:

 - supervisor
 - admin
 - peon
 
Each group can manage the group below it, and users in the top-level group can manage each other.  So supervisors can manage supervisors and admins, and admins can manage peons, and peons cannot manage anyone.

