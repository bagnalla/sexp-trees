// Base puddi object class

var Puddi = require('./puddi.js');
var Vector = require('victor');

var idCounter = 0;

var PuddiObject = function (puddi, parent) {
    this._puddi = puddi;
    this._id = idCounter++;
    this._position = new Vector(0, 0);
    this._rotation = 0.0;
    this._scale = 1.0
    this._targetPosition = new Vector(0, 0);
    this._velocity = 0.0;
    this._children = []
    
    if (parent) {
	parent.addChild(this);
    }
    else {
	puddi.addObject(this);
    }
};

PuddiObject.prototype.equals = function(o) {
    if (!o._id) { return false; }
    return this._id == o._id;
};

PuddiObject.prototype.getId = function() { return this._id; };
PuddiObject.prototype.getPosition = function() { return this._position; };
PuddiObject.prototype.getRotation = function() { return this._rotation; };
PuddiObject.prototype.getScale = function() { return this._scale; };
PuddiObject.prototype.getTargetPosition = function() {
    return this._targetPosition;
};
PuddiObject.prototype.getVelocity = function() { return this._velocity; };

PuddiObject.prototype.setPosition = function(p) { this._position = p; };
PuddiObject.prototype.setRotation = function(r) { this._rotation = r; };
PuddiObject.prototype.setScale = function(s) { this._scale = s; };
PuddiObject.prototype.setTargetPosition = function(tp) {
    this._targetPosition = tp;
};
PuddiObject.prototype.setVelocity = function(v) { this._velocity = v; };

PuddiObject.prototype.translate = function(v) {
    this.setPosition(this._position.add(v));
};
PuddiObject.prototype.rotate = function(r) { this._rotation += r; };
PuddiObject.prototype.scale = function(s) { this._scale *= s; };

PuddiObject.prototype.addChild = function(o) { this._children.push(o); };
PuddiObject.prototype.removeChild = function(o) {
    for (let i = 0; i < this._children.length; i++) {
	if (o.equals(this._children[i])) {
	    this._children.splice(i, 1);
	}
    }
};
PuddiObject.prototype.removeChildAt = function(i) {
    this._children.splice(i, 1);
}
PuddiObject.prototype.clearChildren = function() {
    this._children = [];
}

PuddiObject.prototype.transform = function(ctx) {
    ctx.transform(this._scale, 0, 0, this._scale,
		  this._position.x, this._position.y);
    ctx.rotate(this._rotation);
};

// subclasses should override this for their update code
PuddiObject.prototype._updateSelf = function(time_elapsed) {}

PuddiObject.prototype.update = function(time_elapsed) {
    if (this._position.x != this._targetPosition.x ||
	this._position.y != this._targetPosition.y) {
	let v = this._velocity * time_elapsed;
	let displacement =
	    this._targetPosition.clone().subtract(this._position);
	if (displacement.length() <= v) {
	    this.setPosition(this._targetPosition.clone());
	}
	else {
	    this.translate(displacement.normalize().multiply(new Vector(v, v)));
	}
    }
    
    this._updateSelf(time_elapsed);

    for (let o of this._children) {
	o.update(time_elapsed);
    }
}

PuddiObject.prototype.delete = function() {
    for (let o of this._children) {
	o.delete();
    }
    this.puddi.removeObject(this);
}

// EXPORT
module.exports = PuddiObject;
