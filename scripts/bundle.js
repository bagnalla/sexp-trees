(function(){function r(e,n,t){function o(i,f){if(!n[i]){if(!e[i]){var c="function"==typeof require&&require;if(!f&&c)return c(i,!0);if(u)return u(i,!0);var a=new Error("Cannot find module '"+i+"'");throw a.code="MODULE_NOT_FOUND",a}var p=n[i]={exports:{}};e[i][0].call(p.exports,function(r){var n=e[i][1][r];return o(n||r)},p,p.exports,r,e,n,t)}return n[i].exports}for(var u="function"==typeof require&&require,i=0;i<t.length;i++)o(t[i]);return o}return r})()({1:[function(require,module,exports){
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
    Drawable.call(this, this._puddi, undefined);
    this._canvas = canvas;
    this._editor = editor;
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
}

AstRenderer.prototype.scale = function(s) {
    this._puddi.scaleTranslated(s);
    this.refresh();
};

AstRenderer.prototype.refresh = function() {
    this._puddi.refresh();
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
    this._ast.squeeze();
}

AstRenderer.prototype.clear = function() {
    this._ast = null;
    this.clearChildren();
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
    	    }
    	}
    	else {
    	    this._activeNode = mousedOver;
    	    this._activeNode.setActive(true);
    	}
    }
    else {
    	if (this._activeNode) {
    	    this._activeNode.setActive(false);
    	    this._activeNode = null;
    	    this._editor.session.removeMarker(this._activeNodeMarker);
    	    this._activeNodeMarker = null;
    	}
    }
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
	this._ast.squeeze();
    }
}

// EXPORT
module.exports = AstRenderer;

},{"./puddi/puddi.js":5,"./puddi/puddidrawable.js":6,"./tree.js":8,"victor":4}],2:[function(require,module,exports){
'use strict';

var AstRenderer = require('./astrenderer.js');
var Sexp = require('sexp');
var Vector = require('victor');

// http://stackoverflow.com/a/4253415
String.prototype.escape = function() {
    return this.replace(/\n/g, "\\n")
        .replace(/\"/g, '\\"')
        .replace(/\t/g, "\\t")
};

var hotkeysEnabled = true;
var timeoutId = null;
var astRenderer = null; // create in init()
var activeRenderer = null; // keep track of renderer currently being used
var isDragging = false;
var enablePlusMinusScale = true;

function setError(err) {
    // $("#feedback").text("Error");
    $("#feedback").text(err);
}

function clearError() {
    $("#feedback").text("");
}

function cancelTimeout() {
    if (timeoutId !== null) {
	clearTimeout(timeoutId);
	timeoutId = null;
    }
}

// parse sexp and load tree
function parse() {
    let editor = ace.edit("editor");
    var txt = editor.getValue();
    console.log('parsing: ' + txt);
    try {
	const sexp = Sexp(txt);
	clearError();
	activeRenderer.reset();
	activeRenderer.addAst(sexp);
	activeRenderer.initScale();
	activeRenderer.initPositions();
	activeRenderer.optimize();
    }
    catch (err) {
	console.log(err);
	setError(err);
    }
}

var editorWidthOverride = null;
var x_margin = 75;
var y_margin = 135;

var editorShift = 0;

// fit everything to the screen
function rescale() {
    const screen_width = window.innerWidth
	  || document.documentElement.clientWidth
	  || document.body.clientWidth;
    const screen_height = window.innerHeight
	  || document.documentElement.clientHeight
	  || document.body.clientHeight;
    console.log("width: " + screen_width + ", height: " + screen_height);

    let w = screen_width - x_margin;
    let h = screen_height - y_margin; // vertical space available

    if (editorWidthOverride) {
	var editor_width = editorWidthOverride * w;
    }
    // give editor 80 columns or half the width if not enough space
    else {
	editor_width = Math.min(545, w / 2) + editorShift;
    }
    $("#editor").css("width", editor_width);
    $("#feedback").css("width", editor_width - 4); // minus left margin

    $("#maintdleft").css("width", editor_width);
    $("#maintdright").css("width", w - editor_width);

    let astCanvas = document.getElementById("astcanvas");
    astCanvas.width = w - editor_width - 15;

    astCanvas.height = h;
    $("#editor").css("height", h);

    // refresh editor
    let editor = ace.edit("editor");
    editor.resize();

    // refresh renderers
    activeRenderer.refresh();
}

function increaseFontSize(editor) {
    editor.setOption("fontSize", editor.getOption("fontSize") + 1);
    editor.resize();
}

function decreaseFontSize(editor) {
    editor.setOption("fontSize",
		     Math.max(6, editor.getOption("fontSize") - 1));
    editor.resize();
}

// compute mouse pos relative to canvas given event object
function getMousePos(canvas, evt) {
    var rect = canvas.getBoundingClientRect();
    return {
        x: evt.clientX - rect.left,
        y: evt.clientY - rect.top
    };
}

var scrollSpeed = 20;

function scrollLeft(evt) {
    if (activeRenderer) {
	if (evt) {
	    evt.preventDefault();
	}
	activeRenderer.translate(new Vector(scrollSpeed, 0));
    }
}

function scrollUp(evt) {
    if (activeRenderer) {
	if (evt) {
	    evt.preventDefault();
	}
	activeRenderer.translate(new Vector(0, scrollSpeed));
    }
}

function scrollRight(evt) {
    if (activeRenderer) {
	if (evt) {
	    evt.preventDefault();
	}
	activeRenderer.translate(new Vector(-scrollSpeed, 0));
    }
}

function scrollDown(evt) {
    if (activeRenderer) {
	if (evt) {
	    evt.preventDefault();
	}
	activeRenderer.translate(new Vector(0, -scrollSpeed));
    }
}

function handleMouseWheel(e) {
    var delta = e.wheelDelta || -e.detail;
    if (delta < 0) {
	activeRenderer.scale(0.9);
    }
    else {
	activeRenderer.scale(1.1);
    }
}

// set up editors, canvases, and renderers
function init() {
    let editor = ace.edit("editor");
    editor.setTheme("ace/theme/chrome");
    editor.session.setMode("ace/mode/javascript");
    editor.session.setUseWorker(false);
    editor.setOption("showPrintMargin", false)
    editor.setOption("wrap", true)

    editor.on('change', function() {
	// Parse sexp and load tree
	parse();
    });

    editor.on('focus', function() {
	enablePlusMinusScale = false;
    });
    editor.on('blur', function() {
	enablePlusMinusScale = true;
    });

    $("#editorplusbutton").click(function() {
	increaseFontSize(editor);
    });
    $("#editorminusbutton").click(function() {
	decreaseFontSize(editor);
    });
    $("#editorleftbutton").click(function() {
	editorShift -= 25;
	rescale();
    });
    $("#editorrightbutton").click(function() {
	editorShift += 25;
	rescale();
    });

    // set up ast renderer
    let astCanvas = document.getElementById("astcanvas");
    astRenderer = new AstRenderer(astCanvas, editor);
    // We can reduce CPU usage a bit by limiting the FPS but it
    // becomes flickery when moving the tree around.. not sure why.
    // astRenderer.setFps(20);

    astCanvas.addEventListener('mousemove', function(evt) {
	let pos = getMousePos(astCanvas, evt);
	astRenderer.mousemove(pos);
	if (isDragging) {
	    astRenderer.translate(new Vector(evt.movementX, evt.movementY));
	}
    }, false);
    astCanvas.addEventListener('mousedown', function(evt) {
	isDragging = true;
    }, false);
    astCanvas.addEventListener('mouseup', function(evt) {
	let pos = getMousePos(astCanvas, evt);
	astRenderer.mouseclick(pos);
    }, false);
    astCanvas.addEventListener('mousewheel', handleMouseWheel, false);
    astCanvas.addEventListener('DOMMouseScroll', handleMouseWheel, false);

    $("#astplusbutton").click(function() {
	astRenderer.scale(1.1);
    });
    $("#astminusbutton").click(function() {
	astRenderer.scale(0.9);
    });
    $("#astleftbutton").click(function() {
	scrollLeft();
    });
    $("#astrightbutton").click(function() {
	scrollRight();
    });
    $("#astdownbutton").click(function() {
	scrollDown();
    });
    $("#astupbutton").click(function() {
	scrollUp();
    });

    astRenderer.resume();
    activeRenderer = astRenderer;

    $(window).mouseup(function(){
	isDragging = false;
    });

    setError();
}

window.addEventListener('resize', function(event){
    rescale();
});

$(document).ready(function() {
    init();
    rescale();
});

document.addEventListener('keydown', function(e) {
    if (!hotkeysEnabled) { return; }

    switch (e.keyCode) {
    case 37: // left
    // case 65: // a
	scrollLeft(e);
	break;
    case 38: // up
    // case 87: // w
	scrollUp(e);
	break;
    case 39: // right
    // case 68: // d
	scrollRight(e);
	break;
    case 40: // down
    // case 83: // s
	scrollDown(e);
	break;
    case 66: // b
	break;
    // case 67: // c
    // 	if (compiling) {
    // 	    document.getElementById("cancelbutton").click();
    // 	}
    // 	break;
    case 82: // r
	if (activeRenderer) {
	    activeRenderer.softReset();
	}
	break;
    case 173: // - in firefox
    case 189: // - in chrome
	if (activeRenderer && enablePlusMinusScale) {
	    activeRenderer.scale(0.9);
	}
	break;
    case 61: // + in firefox
    case 187: // + in chrome
	if (activeRenderer && enablePlusMinusScale) {
	    activeRenderer.scale(1.1);
	}
	break;
    default:
    }
});

},{"./astrenderer.js":1,"sexp":3,"victor":4}],3:[function(require,module,exports){
var SPACE   = /[ \r\n\t]/,
    ATOM    = /[^\(\)'"\r\n\t ]/,
    NUMBER  = /^-?\d+(?:\.\d+)?$/;

function sexp(source, opts) {

    opts = opts || {};

    var tSymbol = opts.translateSymbol || function(sym) { return sym; },
        tString = opts.translateString || function(str) { return str; },
        tNumber = opts.translateNumber || parseFloat;

    var ix  = 0,
        len = source.length;

    function parseAtom() {
        var start = ix++;
        while (ix < len && ATOM.test(source[ix]))
            ix++;
        var atom = source.substring(start, ix);
        if (NUMBER.test(atom)) {
            return tNumber(atom);
        } else {
            return tSymbol(atom);
        }
    }

    function parseString(quote) {
        var start = ix++;
        while (ix < len && source[ix] !== quote)
            ix++;
        if (ix === len)
            throw new Error("parse error - unterminated string");
        ix++;
        return tString(source.substring(start + 1, ix - 1));
    }

    function parseSexp() {

        while (SPACE.test(source[ix]))
            ix++;

        if (source[ix++] !== '(')
            throw new Error("parse error");

        var items   = [],
            state   = 'out',
            start   = null;

        while (ix < source.length) {
            var ch = source[ix];
            if (ch === ')') {
                ix++;
                return items;
            } else if (ch === '(') {
                items.push(parseSexp());
            } else if (ch === '"' || ch === '\'') {
                items.push(parseString(ch));
            } else if (SPACE.test(ch)) {
                ix++;
            } else {
                items.push(parseAtom());
            }
        }

        throw new Error("parse error");

    }

    return parseSexp();

}

module.exports = sexp;

},{}],4:[function(require,module,exports){
exports = module.exports = Victor;

/**
 * # Victor - A JavaScript 2D vector class with methods for common vector operations
 */

/**
 * Constructor. Will also work without the `new` keyword
 *
 * ### Examples:
 *     var vec1 = new Victor(100, 50);
 *     var vec2 = Victor(42, 1337);
 *
 * @param {Number} x Value of the x axis
 * @param {Number} y Value of the y axis
 * @return {Victor}
 * @api public
 */
function Victor (x, y) {
	if (!(this instanceof Victor)) {
		return new Victor(x, y);
	}

	/**
	 * The X axis
	 *
	 * ### Examples:
	 *     var vec = new Victor.fromArray(42, 21);
	 *
	 *     vec.x;
	 *     // => 42
	 *
	 * @api public
	 */
	this.x = x || 0;

	/**
	 * The Y axis
	 *
	 * ### Examples:
	 *     var vec = new Victor.fromArray(42, 21);
	 *
	 *     vec.y;
	 *     // => 21
	 *
	 * @api public
	 */
	this.y = y || 0;
};

/**
 * # Static
 */

/**
 * Creates a new instance from an array
 *
 * ### Examples:
 *     var vec = Victor.fromArray([42, 21]);
 *
 *     vec.toString();
 *     // => x:42, y:21
 *
 * @name Victor.fromArray
 * @param {Array} array Array with the x and y values at index 0 and 1 respectively
 * @return {Victor} The new instance
 * @api public
 */
Victor.fromArray = function (arr) {
	return new Victor(arr[0] || 0, arr[1] || 0);
};

/**
 * Creates a new instance from an object
 *
 * ### Examples:
 *     var vec = Victor.fromObject({ x: 42, y: 21 });
 *
 *     vec.toString();
 *     // => x:42, y:21
 *
 * @name Victor.fromObject
 * @param {Object} obj Object with the values for x and y
 * @return {Victor} The new instance
 * @api public
 */
Victor.fromObject = function (obj) {
	return new Victor(obj.x || 0, obj.y || 0);
};

/**
 * # Manipulation
 *
 * These functions are chainable.
 */

/**
 * Adds another vector's X axis to this one
 *
 * ### Examples:
 *     var vec1 = new Victor(10, 10);
 *     var vec2 = new Victor(20, 30);
 *
 *     vec1.addX(vec2);
 *     vec1.toString();
 *     // => x:30, y:10
 *
 * @param {Victor} vector The other vector you want to add to this one
 * @return {Victor} `this` for chaining capabilities
 * @api public
 */
Victor.prototype.addX = function (vec) {
	this.x += vec.x;
	return this;
};

/**
 * Adds another vector's Y axis to this one
 *
 * ### Examples:
 *     var vec1 = new Victor(10, 10);
 *     var vec2 = new Victor(20, 30);
 *
 *     vec1.addY(vec2);
 *     vec1.toString();
 *     // => x:10, y:40
 *
 * @param {Victor} vector The other vector you want to add to this one
 * @return {Victor} `this` for chaining capabilities
 * @api public
 */
Victor.prototype.addY = function (vec) {
	this.y += vec.y;
	return this;
};

/**
 * Adds another vector to this one
 *
 * ### Examples:
 *     var vec1 = new Victor(10, 10);
 *     var vec2 = new Victor(20, 30);
 *
 *     vec1.add(vec2);
 *     vec1.toString();
 *     // => x:30, y:40
 *
 * @param {Victor} vector The other vector you want to add to this one
 * @return {Victor} `this` for chaining capabilities
 * @api public
 */
Victor.prototype.add = function (vec) {
	this.x += vec.x;
	this.y += vec.y;
	return this;
};

/**
 * Adds the given scalar to both vector axis
 *
 * ### Examples:
 *     var vec = new Victor(1, 2);
 *
 *     vec.addScalar(2);
 *     vec.toString();
 *     // => x: 3, y: 4
 *
 * @param {Number} scalar The scalar to add
 * @return {Victor} `this` for chaining capabilities
 * @api public
 */
Victor.prototype.addScalar = function (scalar) {
	this.x += scalar;
	this.y += scalar;
	return this;
};

/**
 * Adds the given scalar to the X axis
 *
 * ### Examples:
 *     var vec = new Victor(1, 2);
 *
 *     vec.addScalarX(2);
 *     vec.toString();
 *     // => x: 3, y: 2
 *
 * @param {Number} scalar The scalar to add
 * @return {Victor} `this` for chaining capabilities
 * @api public
 */
Victor.prototype.addScalarX = function (scalar) {
	this.x += scalar;
	return this;
};

/**
 * Adds the given scalar to the Y axis
 *
 * ### Examples:
 *     var vec = new Victor(1, 2);
 *
 *     vec.addScalarY(2);
 *     vec.toString();
 *     // => x: 1, y: 4
 *
 * @param {Number} scalar The scalar to add
 * @return {Victor} `this` for chaining capabilities
 * @api public
 */
Victor.prototype.addScalarY = function (scalar) {
	this.y += scalar;
	return this;
};

/**
 * Subtracts the X axis of another vector from this one
 *
 * ### Examples:
 *     var vec1 = new Victor(100, 50);
 *     var vec2 = new Victor(20, 30);
 *
 *     vec1.subtractX(vec2);
 *     vec1.toString();
 *     // => x:80, y:50
 *
 * @param {Victor} vector The other vector you want subtract from this one
 * @return {Victor} `this` for chaining capabilities
 * @api public
 */
Victor.prototype.subtractX = function (vec) {
	this.x -= vec.x;
	return this;
};

/**
 * Subtracts the Y axis of another vector from this one
 *
 * ### Examples:
 *     var vec1 = new Victor(100, 50);
 *     var vec2 = new Victor(20, 30);
 *
 *     vec1.subtractY(vec2);
 *     vec1.toString();
 *     // => x:100, y:20
 *
 * @param {Victor} vector The other vector you want subtract from this one
 * @return {Victor} `this` for chaining capabilities
 * @api public
 */
Victor.prototype.subtractY = function (vec) {
	this.y -= vec.y;
	return this;
};

/**
 * Subtracts another vector from this one
 *
 * ### Examples:
 *     var vec1 = new Victor(100, 50);
 *     var vec2 = new Victor(20, 30);
 *
 *     vec1.subtract(vec2);
 *     vec1.toString();
 *     // => x:80, y:20
 *
 * @param {Victor} vector The other vector you want subtract from this one
 * @return {Victor} `this` for chaining capabilities
 * @api public
 */
Victor.prototype.subtract = function (vec) {
	this.x -= vec.x;
	this.y -= vec.y;
	return this;
};

/**
 * Subtracts the given scalar from both axis
 *
 * ### Examples:
 *     var vec = new Victor(100, 200);
 *
 *     vec.subtractScalar(20);
 *     vec.toString();
 *     // => x: 80, y: 180
 *
 * @param {Number} scalar The scalar to subtract
 * @return {Victor} `this` for chaining capabilities
 * @api public
 */
Victor.prototype.subtractScalar = function (scalar) {
	this.x -= scalar;
	this.y -= scalar;
	return this;
};

/**
 * Subtracts the given scalar from the X axis
 *
 * ### Examples:
 *     var vec = new Victor(100, 200);
 *
 *     vec.subtractScalarX(20);
 *     vec.toString();
 *     // => x: 80, y: 200
 *
 * @param {Number} scalar The scalar to subtract
 * @return {Victor} `this` for chaining capabilities
 * @api public
 */
Victor.prototype.subtractScalarX = function (scalar) {
	this.x -= scalar;
	return this;
};

/**
 * Subtracts the given scalar from the Y axis
 *
 * ### Examples:
 *     var vec = new Victor(100, 200);
 *
 *     vec.subtractScalarY(20);
 *     vec.toString();
 *     // => x: 100, y: 180
 *
 * @param {Number} scalar The scalar to subtract
 * @return {Victor} `this` for chaining capabilities
 * @api public
 */
Victor.prototype.subtractScalarY = function (scalar) {
	this.y -= scalar;
	return this;
};

/**
 * Divides the X axis by the x component of given vector
 *
 * ### Examples:
 *     var vec = new Victor(100, 50);
 *     var vec2 = new Victor(2, 0);
 *
 *     vec.divideX(vec2);
 *     vec.toString();
 *     // => x:50, y:50
 *
 * @param {Victor} vector The other vector you want divide by
 * @return {Victor} `this` for chaining capabilities
 * @api public
 */
Victor.prototype.divideX = function (vector) {
	this.x /= vector.x;
	return this;
};

/**
 * Divides the Y axis by the y component of given vector
 *
 * ### Examples:
 *     var vec = new Victor(100, 50);
 *     var vec2 = new Victor(0, 2);
 *
 *     vec.divideY(vec2);
 *     vec.toString();
 *     // => x:100, y:25
 *
 * @param {Victor} vector The other vector you want divide by
 * @return {Victor} `this` for chaining capabilities
 * @api public
 */
Victor.prototype.divideY = function (vector) {
	this.y /= vector.y;
	return this;
};

/**
 * Divides both vector axis by a axis values of given vector
 *
 * ### Examples:
 *     var vec = new Victor(100, 50);
 *     var vec2 = new Victor(2, 2);
 *
 *     vec.divide(vec2);
 *     vec.toString();
 *     // => x:50, y:25
 *
 * @param {Victor} vector The vector to divide by
 * @return {Victor} `this` for chaining capabilities
 * @api public
 */
Victor.prototype.divide = function (vector) {
	this.x /= vector.x;
	this.y /= vector.y;
	return this;
};

/**
 * Divides both vector axis by the given scalar value
 *
 * ### Examples:
 *     var vec = new Victor(100, 50);
 *
 *     vec.divideScalar(2);
 *     vec.toString();
 *     // => x:50, y:25
 *
 * @param {Number} The scalar to divide by
 * @return {Victor} `this` for chaining capabilities
 * @api public
 */
Victor.prototype.divideScalar = function (scalar) {
	if (scalar !== 0) {
		this.x /= scalar;
		this.y /= scalar;
	} else {
		this.x = 0;
		this.y = 0;
	}

	return this;
};

/**
 * Divides the X axis by the given scalar value
 *
 * ### Examples:
 *     var vec = new Victor(100, 50);
 *
 *     vec.divideScalarX(2);
 *     vec.toString();
 *     // => x:50, y:50
 *
 * @param {Number} The scalar to divide by
 * @return {Victor} `this` for chaining capabilities
 * @api public
 */
Victor.prototype.divideScalarX = function (scalar) {
	if (scalar !== 0) {
		this.x /= scalar;
	} else {
		this.x = 0;
	}
	return this;
};

/**
 * Divides the Y axis by the given scalar value
 *
 * ### Examples:
 *     var vec = new Victor(100, 50);
 *
 *     vec.divideScalarY(2);
 *     vec.toString();
 *     // => x:100, y:25
 *
 * @param {Number} The scalar to divide by
 * @return {Victor} `this` for chaining capabilities
 * @api public
 */
Victor.prototype.divideScalarY = function (scalar) {
	if (scalar !== 0) {
		this.y /= scalar;
	} else {
		this.y = 0;
	}
	return this;
};

/**
 * Inverts the X axis
 *
 * ### Examples:
 *     var vec = new Victor(100, 50);
 *
 *     vec.invertX();
 *     vec.toString();
 *     // => x:-100, y:50
 *
 * @return {Victor} `this` for chaining capabilities
 * @api public
 */
Victor.prototype.invertX = function () {
	this.x *= -1;
	return this;
};

/**
 * Inverts the Y axis
 *
 * ### Examples:
 *     var vec = new Victor(100, 50);
 *
 *     vec.invertY();
 *     vec.toString();
 *     // => x:100, y:-50
 *
 * @return {Victor} `this` for chaining capabilities
 * @api public
 */
Victor.prototype.invertY = function () {
	this.y *= -1;
	return this;
};

/**
 * Inverts both axis
 *
 * ### Examples:
 *     var vec = new Victor(100, 50);
 *
 *     vec.invert();
 *     vec.toString();
 *     // => x:-100, y:-50
 *
 * @return {Victor} `this` for chaining capabilities
 * @api public
 */
Victor.prototype.invert = function () {
	this.invertX();
	this.invertY();
	return this;
};

/**
 * Multiplies the X axis by X component of given vector
 *
 * ### Examples:
 *     var vec = new Victor(100, 50);
 *     var vec2 = new Victor(2, 0);
 *
 *     vec.multiplyX(vec2);
 *     vec.toString();
 *     // => x:200, y:50
 *
 * @param {Victor} vector The vector to multiply the axis with
 * @return {Victor} `this` for chaining capabilities
 * @api public
 */
Victor.prototype.multiplyX = function (vector) {
	this.x *= vector.x;
	return this;
};

/**
 * Multiplies the Y axis by Y component of given vector
 *
 * ### Examples:
 *     var vec = new Victor(100, 50);
 *     var vec2 = new Victor(0, 2);
 *
 *     vec.multiplyX(vec2);
 *     vec.toString();
 *     // => x:100, y:100
 *
 * @param {Victor} vector The vector to multiply the axis with
 * @return {Victor} `this` for chaining capabilities
 * @api public
 */
Victor.prototype.multiplyY = function (vector) {
	this.y *= vector.y;
	return this;
};

/**
 * Multiplies both vector axis by values from a given vector
 *
 * ### Examples:
 *     var vec = new Victor(100, 50);
 *     var vec2 = new Victor(2, 2);
 *
 *     vec.multiply(vec2);
 *     vec.toString();
 *     // => x:200, y:100
 *
 * @param {Victor} vector The vector to multiply by
 * @return {Victor} `this` for chaining capabilities
 * @api public
 */
Victor.prototype.multiply = function (vector) {
	this.x *= vector.x;
	this.y *= vector.y;
	return this;
};

/**
 * Multiplies both vector axis by the given scalar value
 *
 * ### Examples:
 *     var vec = new Victor(100, 50);
 *
 *     vec.multiplyScalar(2);
 *     vec.toString();
 *     // => x:200, y:100
 *
 * @param {Number} The scalar to multiply by
 * @return {Victor} `this` for chaining capabilities
 * @api public
 */
Victor.prototype.multiplyScalar = function (scalar) {
	this.x *= scalar;
	this.y *= scalar;
	return this;
};

/**
 * Multiplies the X axis by the given scalar
 *
 * ### Examples:
 *     var vec = new Victor(100, 50);
 *
 *     vec.multiplyScalarX(2);
 *     vec.toString();
 *     // => x:200, y:50
 *
 * @param {Number} The scalar to multiply the axis with
 * @return {Victor} `this` for chaining capabilities
 * @api public
 */
Victor.prototype.multiplyScalarX = function (scalar) {
	this.x *= scalar;
	return this;
};

/**
 * Multiplies the Y axis by the given scalar
 *
 * ### Examples:
 *     var vec = new Victor(100, 50);
 *
 *     vec.multiplyScalarY(2);
 *     vec.toString();
 *     // => x:100, y:100
 *
 * @param {Number} The scalar to multiply the axis with
 * @return {Victor} `this` for chaining capabilities
 * @api public
 */
Victor.prototype.multiplyScalarY = function (scalar) {
	this.y *= scalar;
	return this;
};

/**
 * Normalize
 *
 * @return {Victor} `this` for chaining capabilities
 * @api public
 */
Victor.prototype.normalize = function () {
	var length = this.length();

	if (length === 0) {
		this.x = 1;
		this.y = 0;
	} else {
		this.divide(Victor(length, length));
	}
	return this;
};

Victor.prototype.norm = Victor.prototype.normalize;

/**
 * If the absolute vector axis is greater than `max`, multiplies the axis by `factor`
 *
 * ### Examples:
 *     var vec = new Victor(100, 50);
 *
 *     vec.limit(80, 0.9);
 *     vec.toString();
 *     // => x:90, y:50
 *
 * @param {Number} max The maximum value for both x and y axis
 * @param {Number} factor Factor by which the axis are to be multiplied with
 * @return {Victor} `this` for chaining capabilities
 * @api public
 */
Victor.prototype.limit = function (max, factor) {
	if (Math.abs(this.x) > max){ this.x *= factor; }
	if (Math.abs(this.y) > max){ this.y *= factor; }
	return this;
};

/**
 * Randomizes both vector axis with a value between 2 vectors
 *
 * ### Examples:
 *     var vec = new Victor(100, 50);
 *
 *     vec.randomize(new Victor(50, 60), new Victor(70, 80`));
 *     vec.toString();
 *     // => x:67, y:73
 *
 * @param {Victor} topLeft first vector
 * @param {Victor} bottomRight second vector
 * @return {Victor} `this` for chaining capabilities
 * @api public
 */
Victor.prototype.randomize = function (topLeft, bottomRight) {
	this.randomizeX(topLeft, bottomRight);
	this.randomizeY(topLeft, bottomRight);

	return this;
};

/**
 * Randomizes the y axis with a value between 2 vectors
 *
 * ### Examples:
 *     var vec = new Victor(100, 50);
 *
 *     vec.randomizeX(new Victor(50, 60), new Victor(70, 80`));
 *     vec.toString();
 *     // => x:55, y:50
 *
 * @param {Victor} topLeft first vector
 * @param {Victor} bottomRight second vector
 * @return {Victor} `this` for chaining capabilities
 * @api public
 */
Victor.prototype.randomizeX = function (topLeft, bottomRight) {
	var min = Math.min(topLeft.x, bottomRight.x);
	var max = Math.max(topLeft.x, bottomRight.x);
	this.x = random(min, max);
	return this;
};

/**
 * Randomizes the y axis with a value between 2 vectors
 *
 * ### Examples:
 *     var vec = new Victor(100, 50);
 *
 *     vec.randomizeY(new Victor(50, 60), new Victor(70, 80`));
 *     vec.toString();
 *     // => x:100, y:66
 *
 * @param {Victor} topLeft first vector
 * @param {Victor} bottomRight second vector
 * @return {Victor} `this` for chaining capabilities
 * @api public
 */
Victor.prototype.randomizeY = function (topLeft, bottomRight) {
	var min = Math.min(topLeft.y, bottomRight.y);
	var max = Math.max(topLeft.y, bottomRight.y);
	this.y = random(min, max);
	return this;
};

/**
 * Randomly randomizes either axis between 2 vectors
 *
 * ### Examples:
 *     var vec = new Victor(100, 50);
 *
 *     vec.randomizeAny(new Victor(50, 60), new Victor(70, 80));
 *     vec.toString();
 *     // => x:100, y:77
 *
 * @param {Victor} topLeft first vector
 * @param {Victor} bottomRight second vector
 * @return {Victor} `this` for chaining capabilities
 * @api public
 */
Victor.prototype.randomizeAny = function (topLeft, bottomRight) {
	if (!! Math.round(Math.random())) {
		this.randomizeX(topLeft, bottomRight);
	} else {
		this.randomizeY(topLeft, bottomRight);
	}
	return this;
};

/**
 * Rounds both axis to an integer value
 *
 * ### Examples:
 *     var vec = new Victor(100.2, 50.9);
 *
 *     vec.unfloat();
 *     vec.toString();
 *     // => x:100, y:51
 *
 * @return {Victor} `this` for chaining capabilities
 * @api public
 */
Victor.prototype.unfloat = function () {
	this.x = Math.round(this.x);
	this.y = Math.round(this.y);
	return this;
};

/**
 * Rounds both axis to a certain precision
 *
 * ### Examples:
 *     var vec = new Victor(100.2, 50.9);
 *
 *     vec.unfloat();
 *     vec.toString();
 *     // => x:100, y:51
 *
 * @param {Number} Precision (default: 8)
 * @return {Victor} `this` for chaining capabilities
 * @api public
 */
Victor.prototype.toFixed = function (precision) {
	if (typeof precision === 'undefined') { precision = 8; }
	this.x = this.x.toFixed(precision);
	this.y = this.y.toFixed(precision);
	return this;
};

/**
 * Performs a linear blend / interpolation of the X axis towards another vector
 *
 * ### Examples:
 *     var vec1 = new Victor(100, 100);
 *     var vec2 = new Victor(200, 200);
 *
 *     vec1.mixX(vec2, 0.5);
 *     vec.toString();
 *     // => x:150, y:100
 *
 * @param {Victor} vector The other vector
 * @param {Number} amount The blend amount (optional, default: 0.5)
 * @return {Victor} `this` for chaining capabilities
 * @api public
 */
Victor.prototype.mixX = function (vec, amount) {
	if (typeof amount === 'undefined') {
		amount = 0.5;
	}

	this.x = (1 - amount) * this.x + amount * vec.x;
	return this;
};

/**
 * Performs a linear blend / interpolation of the Y axis towards another vector
 *
 * ### Examples:
 *     var vec1 = new Victor(100, 100);
 *     var vec2 = new Victor(200, 200);
 *
 *     vec1.mixY(vec2, 0.5);
 *     vec.toString();
 *     // => x:100, y:150
 *
 * @param {Victor} vector The other vector
 * @param {Number} amount The blend amount (optional, default: 0.5)
 * @return {Victor} `this` for chaining capabilities
 * @api public
 */
Victor.prototype.mixY = function (vec, amount) {
	if (typeof amount === 'undefined') {
		amount = 0.5;
	}

	this.y = (1 - amount) * this.y + amount * vec.y;
	return this;
};

/**
 * Performs a linear blend / interpolation towards another vector
 *
 * ### Examples:
 *     var vec1 = new Victor(100, 100);
 *     var vec2 = new Victor(200, 200);
 *
 *     vec1.mix(vec2, 0.5);
 *     vec.toString();
 *     // => x:150, y:150
 *
 * @param {Victor} vector The other vector
 * @param {Number} amount The blend amount (optional, default: 0.5)
 * @return {Victor} `this` for chaining capabilities
 * @api public
 */
Victor.prototype.mix = function (vec, amount) {
	this.mixX(vec, amount);
	this.mixY(vec, amount);
	return this;
};

/**
 * # Products
 */

/**
 * Creates a clone of this vector
 *
 * ### Examples:
 *     var vec1 = new Victor(10, 10);
 *     var vec2 = vec1.clone();
 *
 *     vec2.toString();
 *     // => x:10, y:10
 *
 * @return {Victor} A clone of the vector
 * @api public
 */
Victor.prototype.clone = function () {
	return new Victor(this.x, this.y);
};

/**
 * Copies another vector's X component in to its own
 *
 * ### Examples:
 *     var vec1 = new Victor(10, 10);
 *     var vec2 = new Victor(20, 20);
 *     var vec2 = vec1.copyX(vec1);
 *
 *     vec2.toString();
 *     // => x:20, y:10
 *
 * @return {Victor} `this` for chaining capabilities
 * @api public
 */
Victor.prototype.copyX = function (vec) {
	this.x = vec.x;
	return this;
};

/**
 * Copies another vector's Y component in to its own
 *
 * ### Examples:
 *     var vec1 = new Victor(10, 10);
 *     var vec2 = new Victor(20, 20);
 *     var vec2 = vec1.copyY(vec1);
 *
 *     vec2.toString();
 *     // => x:10, y:20
 *
 * @return {Victor} `this` for chaining capabilities
 * @api public
 */
Victor.prototype.copyY = function (vec) {
	this.y = vec.y;
	return this;
};

/**
 * Copies another vector's X and Y components in to its own
 *
 * ### Examples:
 *     var vec1 = new Victor(10, 10);
 *     var vec2 = new Victor(20, 20);
 *     var vec2 = vec1.copy(vec1);
 *
 *     vec2.toString();
 *     // => x:20, y:20
 *
 * @return {Victor} `this` for chaining capabilities
 * @api public
 */
Victor.prototype.copy = function (vec) {
	this.copyX(vec);
	this.copyY(vec);
	return this;
};

/**
 * Sets the vector to zero (0,0)
 *
 * ### Examples:
 *     var vec1 = new Victor(10, 10);
 *		 var1.zero();
 *     vec1.toString();
 *     // => x:0, y:0
 *
 * @return {Victor} `this` for chaining capabilities
 * @api public
 */
Victor.prototype.zero = function () {
	this.x = this.y = 0;
	return this;
};

/**
 * Calculates the dot product of this vector and another
 *
 * ### Examples:
 *     var vec1 = new Victor(100, 50);
 *     var vec2 = new Victor(200, 60);
 *
 *     vec1.dot(vec2);
 *     // => 23000
 *
 * @param {Victor} vector The second vector
 * @return {Number} Dot product
 * @api public
 */
Victor.prototype.dot = function (vec2) {
	return this.x * vec2.x + this.y * vec2.y;
};

Victor.prototype.cross = function (vec2) {
	return (this.x * vec2.y ) - (this.y * vec2.x );
};

/**
 * Projects a vector onto another vector, setting itself to the result.
 *
 * ### Examples:
 *     var vec = new Victor(100, 0);
 *     var vec2 = new Victor(100, 100);
 *
 *     vec.projectOnto(vec2);
 *     vec.toString();
 *     // => x:50, y:50
 *
 * @param {Victor} vector The other vector you want to project this vector onto
 * @return {Victor} `this` for chaining capabilities
 * @api public
 */
Victor.prototype.projectOnto = function (vec2) {
    var coeff = ( (this.x * vec2.x)+(this.y * vec2.y) ) / ((vec2.x*vec2.x)+(vec2.y*vec2.y));
    this.x = coeff * vec2.x;
    this.y = coeff * vec2.y;
    return this;
};


Victor.prototype.horizontalAngle = function () {
	return Math.atan2(this.y, this.x);
};

Victor.prototype.horizontalAngleDeg = function () {
	return radian2degrees(this.horizontalAngle());
};

Victor.prototype.verticalAngle = function () {
	return Math.atan2(this.x, this.y);
};

Victor.prototype.verticalAngleDeg = function () {
	return radian2degrees(this.verticalAngle());
};

Victor.prototype.angle = Victor.prototype.horizontalAngle;
Victor.prototype.angleDeg = Victor.prototype.horizontalAngleDeg;
Victor.prototype.direction = Victor.prototype.horizontalAngle;

Victor.prototype.rotate = function (angle) {
	var nx = (this.x * Math.cos(angle)) - (this.y * Math.sin(angle));
	var ny = (this.x * Math.sin(angle)) + (this.y * Math.cos(angle));

	this.x = nx;
	this.y = ny;

	return this;
};

Victor.prototype.rotateDeg = function (angle) {
	angle = degrees2radian(angle);
	return this.rotate(angle);
};

Victor.prototype.rotateTo = function(rotation) {
	return this.rotate(rotation-this.angle());
};

Victor.prototype.rotateToDeg = function(rotation) {
	rotation = degrees2radian(rotation);
	return this.rotateTo(rotation);
};

Victor.prototype.rotateBy = function (rotation) {
	var angle = this.angle() + rotation;

	return this.rotate(angle);
};

Victor.prototype.rotateByDeg = function (rotation) {
	rotation = degrees2radian(rotation);
	return this.rotateBy(rotation);
};

/**
 * Calculates the distance of the X axis between this vector and another
 *
 * ### Examples:
 *     var vec1 = new Victor(100, 50);
 *     var vec2 = new Victor(200, 60);
 *
 *     vec1.distanceX(vec2);
 *     // => -100
 *
 * @param {Victor} vector The second vector
 * @return {Number} Distance
 * @api public
 */
Victor.prototype.distanceX = function (vec) {
	return this.x - vec.x;
};

/**
 * Same as `distanceX()` but always returns an absolute number
 *
 * ### Examples:
 *     var vec1 = new Victor(100, 50);
 *     var vec2 = new Victor(200, 60);
 *
 *     vec1.absDistanceX(vec2);
 *     // => 100
 *
 * @param {Victor} vector The second vector
 * @return {Number} Absolute distance
 * @api public
 */
Victor.prototype.absDistanceX = function (vec) {
	return Math.abs(this.distanceX(vec));
};

/**
 * Calculates the distance of the Y axis between this vector and another
 *
 * ### Examples:
 *     var vec1 = new Victor(100, 50);
 *     var vec2 = new Victor(200, 60);
 *
 *     vec1.distanceY(vec2);
 *     // => -10
 *
 * @param {Victor} vector The second vector
 * @return {Number} Distance
 * @api public
 */
Victor.prototype.distanceY = function (vec) {
	return this.y - vec.y;
};

/**
 * Same as `distanceY()` but always returns an absolute number
 *
 * ### Examples:
 *     var vec1 = new Victor(100, 50);
 *     var vec2 = new Victor(200, 60);
 *
 *     vec1.distanceY(vec2);
 *     // => 10
 *
 * @param {Victor} vector The second vector
 * @return {Number} Absolute distance
 * @api public
 */
Victor.prototype.absDistanceY = function (vec) {
	return Math.abs(this.distanceY(vec));
};

/**
 * Calculates the euclidean distance between this vector and another
 *
 * ### Examples:
 *     var vec1 = new Victor(100, 50);
 *     var vec2 = new Victor(200, 60);
 *
 *     vec1.distance(vec2);
 *     // => 100.4987562112089
 *
 * @param {Victor} vector The second vector
 * @return {Number} Distance
 * @api public
 */
Victor.prototype.distance = function (vec) {
	return Math.sqrt(this.distanceSq(vec));
};

/**
 * Calculates the squared euclidean distance between this vector and another
 *
 * ### Examples:
 *     var vec1 = new Victor(100, 50);
 *     var vec2 = new Victor(200, 60);
 *
 *     vec1.distanceSq(vec2);
 *     // => 10100
 *
 * @param {Victor} vector The second vector
 * @return {Number} Distance
 * @api public
 */
Victor.prototype.distanceSq = function (vec) {
	var dx = this.distanceX(vec),
		dy = this.distanceY(vec);

	return dx * dx + dy * dy;
};

/**
 * Calculates the length or magnitude of the vector
 *
 * ### Examples:
 *     var vec = new Victor(100, 50);
 *
 *     vec.length();
 *     // => 111.80339887498948
 *
 * @return {Number} Length / Magnitude
 * @api public
 */
Victor.prototype.length = function () {
	return Math.sqrt(this.lengthSq());
};

/**
 * Squared length / magnitude
 *
 * ### Examples:
 *     var vec = new Victor(100, 50);
 *
 *     vec.lengthSq();
 *     // => 12500
 *
 * @return {Number} Length / Magnitude
 * @api public
 */
Victor.prototype.lengthSq = function () {
	return this.x * this.x + this.y * this.y;
};

Victor.prototype.magnitude = Victor.prototype.length;

/**
 * Returns a true if vector is (0, 0)
 *
 * ### Examples:
 *     var vec = new Victor(100, 50);
 *     vec.zero();
 *
 *     // => true
 *
 * @return {Boolean}
 * @api public
 */
Victor.prototype.isZero = function() {
	return this.x === 0 && this.y === 0;
};

/**
 * Returns a true if this vector is the same as another
 *
 * ### Examples:
 *     var vec1 = new Victor(100, 50);
 *     var vec2 = new Victor(100, 50);
 *     vec1.isEqualTo(vec2);
 *
 *     // => true
 *
 * @return {Boolean}
 * @api public
 */
Victor.prototype.isEqualTo = function(vec2) {
	return this.x === vec2.x && this.y === vec2.y;
};

/**
 * # Utility Methods
 */

/**
 * Returns an string representation of the vector
 *
 * ### Examples:
 *     var vec = new Victor(10, 20);
 *
 *     vec.toString();
 *     // => x:10, y:20
 *
 * @return {String}
 * @api public
 */
Victor.prototype.toString = function () {
	return 'x:' + this.x + ', y:' + this.y;
};

/**
 * Returns an array representation of the vector
 *
 * ### Examples:
 *     var vec = new Victor(10, 20);
 *
 *     vec.toArray();
 *     // => [10, 20]
 *
 * @return {Array}
 * @api public
 */
Victor.prototype.toArray = function () {
	return [ this.x, this.y ];
};

/**
 * Returns an object representation of the vector
 *
 * ### Examples:
 *     var vec = new Victor(10, 20);
 *
 *     vec.toObject();
 *     // => { x: 10, y: 20 }
 *
 * @return {Object}
 * @api public
 */
Victor.prototype.toObject = function () {
	return { x: this.x, y: this.y };
};


var degrees = 180 / Math.PI;

function random (min, max) {
    return Math.floor(Math.random() * (max - min + 1) + min);
}

function radian2degrees (rad) {
	return rad * degrees;
}

function degrees2radian (deg) {
	return deg / degrees;
}

},{}],5:[function(require,module,exports){
// Puddi graphics runtime. Each instance of puddi is associated with a
// canvas element.

var Vector = require('victor');

var Puddi = function(canvas, fps) {
    this._ctx = canvas.getContext('2d');
    this._objects = [];
    this._scale = 1.0;
    this._translate = new Vector(0.0, 0.0);
    this._state = {
	canvas: canvas,
	objects: [],
	scale: 1.0,
	translate: new Vector(0.0, 0.0),
	time: 0,
	stopCycle: 0,
	centered: false, // scaling mode
	fps: fps,
	time_elapsed: 0
    }
};

function update(state) {
    // update all objects
    for (let o of state.objects) {
	o.update(state.time_elapsed);
    }
};

function centeredTranslate(state) {
    return new Vector(state.canvas.width / 2 +
		      state.translate.x * state.scale,
		      state.canvas.height / 2 +
		      state.translate.y * state.scale);
}

function getModTranslate(state) {
    if (state.centered) {
	return centeredTranslate(state);
    }
    else {
	return state.translate;
    }
}

function draw(ctx, state) {
    // clear canvas
    let scaleInv = 1 / state.scale;
    let modTranslate = getModTranslate(state);
    ctx.clearRect(-modTranslate.x * scaleInv,
		  -modTranslate.y * scaleInv,
		  ctx.canvas.width * scaleInv,
		  ctx.canvas.height * scaleInv);

    // draw all objects
    for (let o of state.objects) {
	if (o.draw) {
	    o.draw(ctx);
	}
    }
};

Puddi.prototype.run = function() {
    // initialize this._time to the current time
    this._state.time = performance.now();

    // since "this" won't be bound to the puddi object when cycle is
    // called, wrap cycle in a closure with the necessary members of
    // this object.
    
    // let stopCycle = this._stopCycle;
    let stop = this._stop;
    let ctx = this._ctx;
    // let translate = this._translate
    // let scale = this._scale;
    // let time = this._time;
    // let objects = this._objects;
    let state = this._state;
    let cycle = function(tFrame) {
	// re-register for the next frame
	state.stopCycle = window.requestAnimationFrame(cycle);

	state.time_elapsed += tFrame - state.time;
	state.time = tFrame;

	// do nothing if not enough time has elapsed.
	if (state.fps && state.time_elapsed < (1000.0 / state.fps)) {
	    return;
	}

	// update
	if (update(state) < 0) {
	    stop();
	    return;
	}

	// draw
	draw(ctx, state);

	// reset time_elapsed
	state.time_elapsed = 0;
    };

    // register the cycle function with the browser update loop
    this._state.stopCycle = window.requestAnimationFrame(cycle);
};

// deregister from the browser update loop
Puddi.prototype.stop = function() {
    window.cancelAnimationFrame(this._state.stopCycle);
};

// reregister with the browser update loop
Puddi.prototype.resume = function() {
    // this._stopCycle = window.requestAnimationFrame(this._cycle);
    this.run();
};

Puddi.prototype.addObject = function(o) {
    this._state.objects.push(o);
};

Puddi.prototype.removeObject = function(o) {
    for (let i = 0; i < this.state._objects.length; i++) {
	// use the object's provided equals method
	if (o.equals(this._state.objects[i])) {
	    this._state.objects.splice(i, 1);
	}
    }
};

Puddi.prototype.getCtx = function() { return this._ctx; };

Puddi.prototype.setFps = function(fps) { this._state.fps = fps; };

Puddi.prototype.refresh = function() {
    this._state.canvas.width += 0; //  reset canvas transform
    let translate = getModTranslate(this._state);
    this._ctx.transform(this._state.scale, 0, 0, this._state.scale,
			translate.x, translate.y);

    // this._ctx.transform(this._state.scale, 0, 0, this._state.scale,
    // 			this._state.translate.x,
    // 			this._state.translate.y);

    // this._ctx.scale(this._state.scale, this._state.scale);
    // this._ctx.translate(this._state.translate.x * this._state.scale,
    // 			this._state.translate.y * this._state.scale);
};

Puddi.prototype.translate = function(t) {
    this._state.translate.x += t.x;
    this._state.translate.y += t.y;
    this.refresh();
};

Puddi.prototype.translateScaled = function(t) {
    this._state.translate.x += t.x * (1 / this._state.scale);
    this._state.translate.y += t.y * (1 / this._state.scale);
    this.refresh();
};

Puddi.prototype.scale = function(s) {
    this._state.scale *= s;
    this.refresh();
};

Puddi.prototype.scaleTranslated = function(s) {
    // let oldScale = this._state.scale;
    this._state.scale *= s;
    // this._state.translate.x *= 1 / s;
    // this._state.translate.y *= 1 / s;
    this.refresh();
};

Puddi.prototype.getScale = function() { return this._state.scale; };

Puddi.prototype.clearTransform = function() {
    this._state.scale = 1.0;
    this._state.translate = new Vector(0, 0);
    this.refresh();
}

Puddi.prototype.setCentered = function(b) { this._state.centered = b; };

Puddi.prototype.getTranslate = function() {
    return this._state.translate;
}
// EXPORT
module.exports = Puddi;

},{"victor":4}],6:[function(require,module,exports){
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

},{"./puddiobject.js":7}],7:[function(require,module,exports){
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

},{"./puddi.js":5,"victor":4}],8:[function(require,module,exports){
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

// Check if a point is contained within a node of the tree, returning
// the containing node if found.
TreeNode.prototype.containsPos = function(p) {
    if (!this._hidden &&
	p.x >= this._position.x &&
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

},{"./puddi/puddi.js":5,"./puddi/puddidrawable.js":6,"victor":4}]},{},[2]);
