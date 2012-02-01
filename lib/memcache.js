var cache = {};

exports.set = function(key, val, ttlMilliseconds) {
	cache[key] = val;
	
	if (ttlMilliseconds) {
		//this does not account for the same key being used multiple times (BUG)
		setTimeout(function() {
			exports.remove(key);
		}, ttlMilliseconds)
	}
}

exports.get = function(key) {
	if (cache.hasOwnProperty(key)) {
		return cache[key];
	} 
}

exports.remove = function(key) {
	if (cache.hasOwnProperty(key)) {
		console.log('deleting ' + key + ' from cache - timed out');
		delete cache[key];
	}
}

exports.increment = function(key) {
  var val = exports.get(key);
  if (val) {
    exports.set(key, val + 1);
  } else {
    exports.set(key, 1);
  }
}

exports.decrement = function(key) {
  var val = exports.get(key);
  if (val) {
    exports.set(key, val - 1);
  } else {
    //should not happen, but allowed
    exports.set(key, -1);
  }
}

exports.addToIndex = function(key, newItem) {
  var val = exports.get(key) || [];
  val.push(newItem);
  
  exports.set(key, val);
}

exports.removeFromIndex = function(key, badItem) {
  var val = exports.get(key) || [];
  var newVal = [];
  for (var i=0;i<val.length;i++) {
    if (val[i] != badItem) {
      newVal.push(val[i]);
    }
  }
  
  exports.set(key, newVal);
}

exports.getIndex = function(key) {
  return exports.get(key) || [];
}