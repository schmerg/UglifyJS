var jsp = require("./parse-js"),
    pro = require("./process"),
    slice = jsp.slice,
    member = jsp.member,
    PRECEDENCE = jsp.PRECEDENCE,
    OPERATORS = jsp.OPERATORS;

function ast_squeeze_more(ast) {
        var w = pro.ast_walker(), walk = w.walk;
        return w.with_walkers({
                "call": function(expr, args) {
                        if (expr[0] == "dot" && expr[2] == "toString" && args.length == 0) {
                                // foo.toString()  ==>  foo+""
                                return [ "binary", "+", expr[1], [ "string", "" ]];
                        }
                }
        }, function() {
                return walk(ast);
        });
};

function ast_mangle_properties(ast, manglePrefix, props) {
    var w = pro.ast_walker(), walk = w.walk, MAP = pro.MAP;
    var mprops = { };
    for (var i = 0; i < props.length; ++i) {
        mprops[props[i]] = manglePrefix+i;
    };
    var mprop = function(p) {
        return (typeof p === "string" && mprops.hasOwnProperty(p)) ? mprops[p] : p;
    };
    var n = 0;
    return w.with_walkers({
        "sub": function(expr, subscript) {
            // the normal squeeze has already rewritten abc["xyz"] as abc.xyz but just in case...
            if (subscript[0] == "string") {
                return [ "sub", walk(expr), [ "string", mprop(subscript[1]) ] ];
            }
            return [ "sub", walk(expr), walk(subscript) ];
        },
        "dot": function(expr) {
            return [ "dot", walk(expr) ].concat(MAP(slice(arguments, 1), mprop));
        },
        "assign": function(op, lvalue, rvalue) {
            // the default 'assign' walker doesn't walk the lvalue
            return [ "assign", op, walk(lvalue), walk(rvalue) ];
        },
        "binary": function(op, left, right) {
            // check for '"abc" in object'
            if (op === "in" && left[0] === "string") {
                left = ["string", mprop(left[1]) ];
            }
            return [ "binary", op, walk(left), walk(right) ];
        },
        "call": function(expr, args) {
            // Normally as soon as you start passing property names around in variables or as parameters,
            // the game is over, but for 2 special built-in functions we look for string literals
            if (expr[0] === "dot" &&
                (expr[expr.length-1] === "hasOwnProperty" || expr[expr.length-1] === "propertyIsEnumerable")) {
                if (args.length === 1 && args[0][0] === "string") {
                    args = [ ["string", mprop(args[0][1]) ] ];
                }
            }
            return [ "call", walk(expr), MAP(args, walk) ];
        },
        "object": function(props) {
            return [ "object", MAP(props, function(p){
                var p0 = mprop(p[0]);
                return p.length == 2
                    ? [ p0, walk(p[1]) ]
                    : [ p0, walk(p[1]), p[2] ]; // get/set-ter
            }) ];
        }
    }, function() {
        return walk(ast);
    });
};

exports.ast_squeeze_more = ast_squeeze_more;
exports.ast_mangle_properties = ast_mangle_properties;
