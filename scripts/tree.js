'use strict';

var Puddi = require ('./puddi/puddi.js');
var Drawable = require('./puddi/puddidrawable.js');
var Vector = require('victor');

//////////////////////
// NORMAL TREE NODES
//////////////////////

var MIN_NODE_WIDTH = 25;
var MIN_NODE_HEIGHT = 25;
var LINK_CONNECTOR_SIZE = 5;
var NEIGHBOR_SPACING = 7;
var CHILD_SPACING = MIN_NODE_HEIGHT * 1.5;

// The first value is the array of position information values.
// The rest are either atoms (strings) or nodes (arrays)
var TreeNode = function(puddi, parent, values) {
    // call superclass constructor
    Drawable.call(this, puddi, parent);
    this._body = [] // strings or links to children
    this._construct(values);
    this._width = Math.max(MIN_NODE_WIDTH, this._textWidth + 10);
    this._height = MIN_NODE_HEIGHT;
    this._computeTreeWidth();
    this._computeTreeHeight();
    this._active = false;
    this._collapsed = false;
    this._hidden = false;
}

// set up inheritance
TreeNode.prototype = Object.create(Drawable.prototype);
TreeNode.prototype.constructor = TreeNode;

TreeNode.prototype._construct = function(values) {
    console.log("constructing ast node");

    this._textWidth = 0;
    this._text_spacing = 3;

    console.log(values)

    // for (let v of values) {
    for (var i = 0; i < values.length; ++i) {
	let v = values[i];
	if (Array.isArray(v)) {
	    // store index of child as link
	    this._body.push(this._children.length);
	    let node = new TreeNode(this._puddi, this, v);
	    this._textWidth += LINK_CONNECTOR_SIZE;
	    if (i < values.length - 1)
		this._textWidth += this._text_spacing;
	}
	else {
	    // store string in body
	    v = v.toString();
	    this._body.push(v);
	    this._textWidth += this._puddi.getCtx().measureText(v).width;
	    if (i < values.length - 1)
		this._textWidth += this._text_spacing;
	}
    }
}

TreeNode.prototype._childrenTreeWidth = function() {
    if (!this._children) { return 0; }
    let w = 0;
    for (let c of this._children) {
	if (c.getTreeWidth) {
	    w += c.getTreeWidth();
	}
    }
    return w + NEIGHBOR_SPACING * (this._children.length - 1);
}

// Not tree width in the algorithms sense, but the total width in 2d
// space of the tree rooted at this node. Assumes the tree widths of
// children have been computed already (should always be the case).
TreeNode.prototype._computeTreeWidth = function() {
    this._treeWidth = Math.max(this._width, this._childrenTreeWidth());
}

// TreeNode.prototype._lefts = function() {
//     let ls = [this._position.x];
//     if (!this._children || !this._children.length) {
// 	return ls;
//     }
//     const child_ls = this._children.map(c => c._lefts());
//     const n = Math.max.apply(null, child_ls.map(x => x.length));
//     for (let i = 0; i < n; ++i) {
// 	let min_l = 0;
// 	for (const l of child_ls) {
// 	    if (i < l.length) {
// 		min_l = Math.min(min_l, l[i]);
// 	    }
// 	}
// 	ls.push(min_l + this._position.x);
//     }
//     return ls;
// }

// TreeNode.prototype._rights = function() {
//     let rs = [this._position.x + this._width];
//     if (!this._children) {
// 	return rs;
//     }
//     const child_rs = this._children.map(c => c._rights());
//     const n = Math.max.apply(null, child_rs.map(x => x.length));
//     for (let i = 0; i < n; ++i) {
// 	let max_r = 0;
// 	for (const r of child_rs) {
// 	    if (i < r.length) {
// 		max_r = Math.max(max_r, r[i]);
// 	    }
// 	}
// 	rs.push(max_r + this._position.x);
//     }
//     return rs;
// }

TreeNode.prototype._lefts = function() {
    let ls = [0];
    if (!this._children || !this._children.length || this._collapsed) {
	return ls;
    }
    const child_ls = this._children.map(c => c._lefts().map(x => x + c._position.x));
    const n = Math.max.apply(null, child_ls.map(x => x.length));
    for (let i = 0; i < n; ++i) {
	let min_l = Number.MAX_SAFE_INTEGER;
	for (const l of child_ls) {
	    if (i < l.length) {
		min_l = Math.min(min_l, l[i]);
	    }
	}
	ls.push(min_l);
    }
    return ls;
}

TreeNode.prototype._rights = function() {
    let rs = [this._width];
    if (!this._children || !this._children.length || this._collapsed) {
	return rs;
    }
    const child_rs = this._children.map(c => c._rights().map(x => x + c._position.x));
    const n = Math.max.apply(null, child_rs.map(x => x.length));
    for (let i = 0; i < n; ++i) {
	let max_r = Number.MIN_SAFE_INTEGER;
	for (const r of child_rs) {
	    if (i < r.length) {
		max_r = Math.max(max_r, r[i]);
	    }
	}
	rs.push(max_r);
    }
    return rs;
}

TreeNode.prototype.squeeze = function() {
    this._children && this._children.forEach(c => c.squeeze());
    if (!this._children || this._children.length < 2 || this._collapsed) {
	return;
    }
    let total_d = 0;
    for (let i = 0; i < this._children.length - 1; ++i) {
	const rights = this._children[i]._rights().map(x => x + this._children[i]._position.x);
	const lefts = this._children[i+1]._lefts().map(x => x + this._children[i+1]._position.x);
	// const rights = this._children[i]._rights();
	// const lefts = this._children[i+1]._lefts();
	// console.log('lefts: ' + lefts);
	// console.log('rights: ' + rights);
	let d = Number.MAX_SAFE_INTEGER;
	for (let j = 0; j < rights.length && j < lefts.length; ++j) {
	    d = Math.min(d, lefts[j] - rights[j] - NEIGHBOR_SPACING);
	}
	console.log('d = ' + d);
	for (let j = 0; j <= i; ++j) {
	    this._children[j].translate(new Vector(d, 0));
	}
	total_d += d;
    }
    this._computeTreeWidth();
    const ls = this._lefts();
    const rs = this._rights();
    ls.shift();
    rs.shift();
    const l = Math.min.apply(null, ls);
    const r = Math.max.apply(null, rs);
    // console.log('pos = ' + this._position.x);
    // console.log('l = ' + l);
    // console.log('r = ' + r);
    this._children.forEach(c => c.translate(new Vector( this._width / 2 - (l+r)/2, 0)));
}

TreeNode.prototype._computeTreeHeight = function() {
    if (!this._children) { return 0; }
    let max_h = this._height;
    for (let c of this._children) {
	if (c.getTreeHeight && c.getTreeHeight() + CHILD_SPACING > max_h) {
	    max_h = c.getTreeHeight() + CHILD_SPACING;
	}
    }
    this._treeHeight = max_h;
}

TreeNode.prototype.getTreeWidth = function() { return this._treeWidth; }
TreeNode.prototype.getTreeHeight = function() { return this._treeHeight; }

// Set the initial positions of children based on their tree widths.
TreeNode.prototype.initPositions = function() {
    let offset_y = CHILD_SPACING;
    // let childrenTreeWidth = this._childrenTreeWidth();
    // let offset_x = -this._treeWidth / 2 + this._width / 2;
    let offset_x = -this._childrenTreeWidth() / 2 + this._width / 2;
    for (let i = 0; i < this._children.length; i++) {
	let child = this._children[i];
	child.initPositions();
	child.setPosition(new Vector(offset_x + child.getTreeWidth() / 2
				     - child.getWidth() / 2, offset_y));
	if (child.getTreeWidth) {
	    offset_x += child.getTreeWidth() + NEIGHBOR_SPACING;
	}
    }
}

TreeNode.prototype.getWidth = function() { return this._width; };
TreeNode.prototype.getHeight = function() { return this._height; };

TreeNode.prototype.setActive = function(a) {
    this._active = a;
    for (let c of this._children) {
	if (c.setActive) {
	    c.setActive(a);
	}
    }
};


// TODO: something isnt right with collapsing nodes...
TreeNode.prototype.setCollapsed = function(c) {
    this._collapsed = c;
    this._children.forEach(c => c.setHidden(c));
}

TreeNode.prototype.toggleCollapsed = function(c) {
    if (!this._children || !this._children.length) { return; }
    this._collapsed = !this._collapsed;
    this._children.forEach(c => c.setHidden(this._collapsed));
}

TreeNode.prototype.setHidden = function(h) {
    this._hidden = h;
    if (!this._collapsed) {
	this._children.forEach(c => c.setHidden(h));
    }
}

// Recursively check tree if a point is inside a node
// and return that node.
TreeNode.prototype.containsPos = function(p) {
    if (p.x >= this._position.x &&
	p.x <= this._position.x + this._width &&
	p.y >= this._position.y - this._height / 2 &&
	p.y <= this._position.y + this._height / 2) {
	return this;
    }

    for (let c of this._children) {
	if (c.containsPos) {
	    // adjust point to local coordinate space for children
	    let localPoint = new Vector(p.x - this._position.x,
					p.y - this._position.y);
	    let contains = c.containsPos(localPoint);
	    if (contains) { return contains; }
	}
    }
    return null;
}

TreeNode.prototype._drawSelf = function(ctx) {
    if (this._hidden) { return; }
    ctx.lineWidth = 2;
    let textHeight = 10;// get font size from ctx
    ctx.fillStyle = "white";
    ctx.fillRect(0, -this._height / 2, this._width, this._height);
    ctx.strokeRect(0, -this._height / 2, this._width, this._height);
    if (this._active) {
    	ctx.fillStyle = "rgba(100,200,100,0.4)";
    	ctx.fillRect(0, -this._height / 2, this._width, this._height);
    }
    ctx.fillStyle = "black";

    let offset_x = this._width / 2 - this._textWidth / 2;
    for (let x of this._body) {
	if (Number.isInteger(x)) {
	    if (!this._collapsed) {
		// draw line to child
		if (this._active) {
		    ctx.strokeStyle = "rgba(255, 0, 0, 0.25)";
		}
		else {
		    ctx.strokeStyle = "rgba(0, 0, 0, 0.25)";
		}
		let childPos = this._children[x].getPosition();
		let childWidth = this._children[x].getWidth();
		let childHeight = this._children[x].getHeight();
		ctx.beginPath();
		ctx.moveTo(offset_x + LINK_CONNECTOR_SIZE / 2, LINK_CONNECTOR_SIZE / 4);
		ctx.lineTo(childPos.x + childWidth / 2,
			   childPos.y - childHeight / 2);
		ctx.stroke();

		// if (this._active) {
		// 	ctx.fillStyle = "darkred";
		// }
		// else {
		// 	ctx.fillStyle = "darkgreen";
		// }
		ctx.fillStyle = "black";

		// draw link to child indexed by x
		// ctx.fillRect(offset_x, -LINK_CONNECTOR_SIZE / 4,
		// 		 LINK_CONNECTOR_SIZE, LINK_CONNECTOR_SIZE);

		ctx.beginPath();
		ctx.arc(offset_x + LINK_CONNECTOR_SIZE / 2,
	    		LINK_CONNECTOR_SIZE / 4,
	    		LINK_CONNECTOR_SIZE / 2, 0, Math.PI, true);
		ctx.arc(offset_x + LINK_CONNECTOR_SIZE / 2,
	    		LINK_CONNECTOR_SIZE / 4,
	    		LINK_CONNECTOR_SIZE / 2, Math.PI, 0, true);
		ctx.fill();
	    }
	    else {
		ctx.fillStyle = "black";	
		ctx.beginPath();
		ctx.moveTo(offset_x, LINK_CONNECTOR_SIZE / 4);
		ctx.lineTo(offset_x + LINK_CONNECTOR_SIZE, LINK_CONNECTOR_SIZE / 4);
		ctx.stroke();
	    }

	    offset_x += LINK_CONNECTOR_SIZE + this._text_spacing;
	}
	else {
	    ctx.fillStyle = "black";
	    // draw atom string
	    ctx.fillText(x, offset_x, textHeight / 2.5);
	    offset_x += this._puddi.getCtx().measureText(x).width +
		this._text_spacing;
	}
    }
    if (this._collapsed) {
	ctx.fillStyle = "rgba(0, 0, 0, 0.25)";
	ctx.fillRect(0, -this._height / 2, this._width, this._height);
    } 
};

// EXPORT
module.exports = TreeNode;
