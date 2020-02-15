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
