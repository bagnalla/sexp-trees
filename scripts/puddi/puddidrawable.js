// Drawable puddi object class

var PuddiObject = require('./puddiobject.js');

function PuddiDrawable(puddi, parent) {
    // call superclass constructor
    PuddiObject.call(this, puddi, parent);
    
    this._color = "black";
}

// set up inheritance
PuddiDrawable.prototype = Object.create(PuddiObject.prototype);
PuddiDrawable.prototype.constructor = PuddiDrawable;

PuddiDrawable.prototype.getColor = function() { return this._color; };

PuddiDrawable.prototype.setColor = function(c) { this._color = c; };

// subclasses should override this function for their drawing code
PuddiDrawable.prototype._drawSelf = function(ctx) {}

PuddiDrawable.prototype.draw = function(ctx) {
    ctx.save();
    this.transform(ctx);

    ctx.fillStyle = this._color;
    ctx.strokeStyle = this._color;

    // draw myself
    this._drawSelf(ctx);
    
    // draw children
    for (let o of this._children) {
	if (o.draw) {
	    o.draw(ctx);
	}
    }
    
    ctx.restore();
};

// EXPORT
module.exports = PuddiDrawable;
