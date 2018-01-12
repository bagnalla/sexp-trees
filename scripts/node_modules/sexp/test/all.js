var test = require('tape');
var sexp = require('../');

test("parsing", function(assert) {

    var input = "(foo bar 1.5 2 3 (('a string' \"another string\")) + - splat)";
    
    var output = [
        'foo',
        'bar',
        1.5,
        2,
        3,
        [
            [
                'a string',
                "another string"
            ]
        ],
        '+',
        '-',
        'splat'
    ];

    assert.deepEqual(sexp(input), output);
    assert.end();

});

test("translation", function(assert) {

    var output = sexp("('foo' bar 1.2)", {
        translateString: function() { return 'string'; },
        translateSymbol: function() { return 'symbol'; },
        translateNumber: function() { return 'number'; }
    });

    assert.deepEqual(output, ['string', 'symbol', 'number']);
    assert.end();

});
