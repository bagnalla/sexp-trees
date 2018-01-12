# sexp

A simple s-expression parser. Turns this:

    (concat foo 1 (this and that "look here's a string"))

Into this:

    [ 'concat',
      'foo',
      1,
      [ 'this', 'and', 'that', 'look here\'s a string' ] ]

## Installation

    $ npm install sexp

## Usage

    var sexp = require('sexp');
    var ary = sexp("(foo bar 'string with spaces' 1 (2 3 4))")

## API

#### `sexp(source, [options])`

Parse `source` and convert to an array of s-expressions.

Supported options:

  * `translateString`: callback used to process quoted values. Default: identity.
  * `translateSymbol`: callback used to process unquoted, non-numeric values. Default: identity.
  * `translateNumber`: callback used to process numeric values. Default: `parseFloat`.

## Limitations

  * Doesn't recognise escape sequences inside strings
