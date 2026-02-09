var Puddi = require ('./puddi/puddi.js');
var Drawable = require('./puddi/puddidrawable.js');
var Vector = require('victor');
var TreeNode = require('./tree.js');

/////////////////
// AST RENDERER
/////////////////

var AstRenderer = function(canvas, editor) {
    this._ctx = canvas.getContext('2d');
    this._puddi = new Puddi(canvas);
    this._puddi.setCentered(true);
    this._puddi.setStopAfterDraw(true);
    Drawable.call(this, this._puddi, undefined);
    this._canvas = canvas;
    this._editor = editor;
    this._theme = "light";
}

// set up inheritance
AstRenderer.prototype = Object.create(Drawable.prototype);
AstRenderer.prototype.constructor = AstRenderer;

AstRenderer.prototype.setFps = function(fps) { this._puddi.setFps(fps); };

AstRenderer.prototype.run = function() { this._puddi.resume(); };

AstRenderer.prototype.pause = function() { this._puddi.stop(); };

AstRenderer.prototype.resume = AstRenderer.prototype.run;

AstRenderer.prototype.translate = function(t) {
    this._puddi.translateScaled(t);
    this._puddi.resume();
}

AstRenderer.prototype.scale = function(s) {
    this._puddi.scaleTranslated(s);
    this.refresh();
};

AstRenderer.prototype.refresh = function() {
    this._puddi.refresh();
    this._puddi.resume();
}

AstRenderer.prototype.initPositions = function() {
    if (this._ast) {
	let treeHeight = this._ast.getTreeHeight();
	this._ast.setPosition(new Vector(-this._ast.getWidth() / 2,
					 -treeHeight / 3));
	this._ast.initPositions();
    }
}

AstRenderer.prototype.initScale = function() {
    if (this._ast) {
	let treeWidth = this._ast.getTreeWidth();
	let treeHeight = this._ast.getTreeHeight();
	console.log("treeWidth: " + treeWidth);
	console.log("treeHeight: " + treeHeight);

	let x_ratio = this._canvas.width / treeWidth * 0.98;
	let y_ratio = this._canvas.height / treeHeight;

	if (x_ratio < y_ratio) {
	    console.log("scaling by x. ratio: " + x_ratio);
	    // this.scale(x_ratio);
	    this.scale(Math.min(x_ratio, 1.5));
	}
	else {
	    console.log("scaling by y. ratio: " + y_ratio);
	    this.scale(Math.min(y_ratio, 1.5));
	}
    }
}

AstRenderer.prototype.addAst = function(ast) {
    if (this._ast) {
	this.removeChild(this._ast);
    }
    this._ast = new TreeNode(this._puddi, this, ast);
    if (this._ast.setTheme) {
	this._ast.setTheme(this._theme);
    }
}

AstRenderer.prototype.addFlatAst = function(ast) {
    if (this._ast) {
	this.removeChild(this._ast);
    }
    this._ast = new FlatTreeNode(this._puddi, this, ast);
}

AstRenderer.prototype.optimize = function() {
    // console.log('hello');
    // console.log('lefts: ' + this._ast._lefts());
    // console.log('rights: ' + this._ast._rights());
    // TODO: figure out why we need to squeeze twice
    this._ast.squeeze();
    this._ast.squeeze();
}

AstRenderer.prototype.clear = function() {
    this._ast = null;
    this.clearChildren();
};

AstRenderer.prototype.setTheme = function(theme) {
    this._theme = theme === "dark" ? "dark" : "light";
    if (this._ast && this._ast.setTheme) {
	this._ast.setTheme(this._theme);
    }
};

AstRenderer.prototype.softReset = function() {
    this._puddi.clearTransform();
    this.initScale();
    this.initPositions();
}

AstRenderer.prototype.reset = function() {
    this.clear();
    this._puddi.clearTransform();
}

AstRenderer.prototype.mousemove = function(pos) {
    if (!this._ast) { return; }

    let scale = this._puddi.getScale();
    let scaleInv = 1 / scale;
    pos.x *= scaleInv;
    pos.y *= scaleInv;

    pos.x -= this._canvas.width / 2 * scaleInv + this._puddi.getTranslate().x;
    pos.y -= this._canvas.height / 2 * scaleInv + this._puddi.getTranslate().y;

    let mousedOver = this._ast.containsPos(pos);

    if (mousedOver) {
    	if (this._activeNode) {
    	    if (mousedOver !== this._activeNode) {
    		this._activeNode.setActive(false);
    		this._editor.session.removeMarker(this._activeNodeMarker);
    		this._activeNode = mousedOver;
    		this._activeNode.setActive(true);
                this._puddi.resume();
    	    }
    	}
    	else {
    	    this._activeNode = mousedOver;
    	    this._activeNode.setActive(true);
            this._puddi.resume();
    	}
    }
    else {
    	if (this._activeNode) {
    	    this._activeNode.setActive(false);
    	    this._activeNode = null;
    	    this._editor.session.removeMarker(this._activeNodeMarker);
    	    this._activeNodeMarker = null;
            this._puddi.resume();
    	}
    }

    // this._puddi.resume();
};

AstRenderer.prototype.mouseclick = function(pos) {
    if (!this._ast) { return; }
    let scale = this._puddi.getScale();
    let scaleInv = 1 / scale;
    pos.x *= scaleInv;
    pos.y *= scaleInv;

    pos.x -= this._canvas.width / 2 * scaleInv + this._puddi.getTranslate().x;
    pos.y -= this._canvas.height / 2 * scaleInv + this._puddi.getTranslate().y;
    console.log('clicked: ' + pos.x + ', ' + pos.y);
    let node = this._ast.containsPos(pos);
    console.log('node: ' + node);
    if (node) {
	node.toggleCollapsed();
	// TODO: figure out why we need to squeeze twice
	this._ast.squeeze();
	this._ast.squeeze();
    }

    this._puddi.resume();
}

// EXPORT
module.exports = AstRenderer;
