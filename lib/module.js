'use strict';

var max = Math.max;
var min = Math.min;
var sign = Math.sign || function (x) {
    return +x === x ? x === 0 ? x : x > 0 ? 1 : -1 : NaN;
};

var codeFontStack = 'Menlo';
var codeFontSize = '13px';

var svgDiagramStyle = '\n        display:block;\n        font-family: ' + codeFontStack + ';\n        font-size: ' + codeFontSize + ';\n        text-align:center;\n        stroke-linecap:round;\n        stroke-width: ' + STROKE_WIDTH + 'px;\n        stroke:#000;\n        fill:#000;\n        width: 300px;\n        height: auto;\n';

var styleTag = '\n  <style>\n    svg.diagram{\n        ' + svgDiagramStyle + '\n        }\n\n        .svg.diagram .opendot{\n        fill:#FFF\n        }\n\n        svg.diagram text {\n        stroke:none;\n        }\n  </style>\n';

var htmlWrap = function htmlWrap(s) {

    var s1 = '<!DOCTYPE html>\n<html>\n  <head>\n    <title>SVG</title>\n  </head>\n  <body>\n' + s + '\n  </body>\n</html>';
    return s1;
};

// For minification. This is admittedly scary.
var _ = String.prototype;
_.rp = _.replace;
_.ss = _.substring;

// Regular expression version of String.indexOf
_.regexIndexOf = function (regex, startpos) {
    var i = this.ss(startpos || 0).search(regex);
    return i >= 0 ? i + (startpos || 0) : i;
};

/** In pixels of lines in diagrams */
var STROKE_WIDTH = 2;

/** Enable for debugging to view character bounds in diagrams */
var DEBUG_SHOW_GRID = false;

/** Overlay the non-empty characters of the original source in diagrams */
var DEBUG_SHOW_SOURCE = DEBUG_SHOW_GRID;

/** Use to suppress passing through text in diagrams */
var DEBUG_HIDE_PASSTHROUGH = DEBUG_SHOW_SOURCE;

/** Converts <>&" to their HTML escape sequences */
function escapeHTMLEntities(str) {
    return String(str).rp(/&/g, '&amp;').rp(/</g, '&lt;').rp(/>/g, '&gt;').rp(/"/g, '&quot;');
}

/** Returns true if this character is a "letter" under the ASCII definition */
function isASCIILetter(c) {
    var code = c.charCodeAt(0);
    return code >= 65 && code <= 90 || code >= 97 && code <= 122;
}

function equalizeLineLengths(str) {
    var lineArray = str.split('\n');
    var longest = 0;
    lineArray.forEach(function (line) {
        longest = max(longest, line.length);
    });

    // Worst case spaces needed for equalizing lengths
    // http://stackoverflow.com/questions/1877475/repeat-character-n-times
    var spaces = Array(longest + 1).join(' ');

    var result = '';
    lineArray.forEach(function (line) {
        // Append the needed number of spaces onto each line, and
        // reconstruct the output with newlines
        result += line + spaces.ss(line.length) + '\n';
    });

    return result;
}

/** Converts diagramString, which is a Markdeep diagram without the
    surrounding asterisks, to SVG (HTML). 

    alignmentHint is the float alignment desired for the SVG tag,
    which can be 'floatleft', 'floatright', or ''
 */
function diagramToSVG(diagramString, alignmentHint) {
    // Clean up diagramString if line endings are ragged
    diagramString = equalizeLineLengths(diagramString);

    // Temporarily replace 'o' that is surrounded by other text
    // with another character to avoid processing it as a point 
    // decoration. This will be replaced in the final svg and is
    // faster than checking each neighborhood each time.
    var HIDE_O = '';
    diagramString = diagramString.rp(/([a-z]|[A-Z])o([a-z]|[A-Z])/g, '$1' + HIDE_O + '$2');

    /** Pixels per character */
    var SCALE = 8;

    /** Multiply Y coordinates by this when generating the final SVG
        result to account for the aspect ratio of text files. This
        MUST be 2 */
    var ASPECT = 2;

    var DIAGONAL_ANGLE = Math.atan(1.0 / ASPECT) * 180 / Math.PI;

    var EPSILON = 1e-6;

    // The order of the following is based on rotation angles
    // and is used for ArrowSet.toSVG
    var ARROW_HEAD_CHARACTERS = '>v<^';
    var POINT_CHARACTERS = 'o*';
    var JUMP_CHARACTERS = '()';
    var UNDIRECTED_VERTEX_CHARACTERS = "+";
    var VERTEX_CHARACTERS = UNDIRECTED_VERTEX_CHARACTERS + ".'";

    // GRAY[i] is the Unicode block character for (i+1)/4 level gray
    var GRAY_CHARACTERS = '░▒▓▔▉';

    // TRI[i] is a right-triangle rotated by 90*i
    var TRI_CHARACTERS = '◢◣◤◥';

    var DECORATION_CHARACTERS = ARROW_HEAD_CHARACTERS + POINT_CHARACTERS + JUMP_CHARACTERS + GRAY_CHARACTERS + TRI_CHARACTERS;

    function isUndirectedVertex(c) {
        return UNDIRECTED_VERTEX_CHARACTERS.indexOf(c) + 1;
    }

    function isVertex(c) {
        return VERTEX_CHARACTERS.indexOf(c) !== -1;
    }

    function isTopVertex(c) {
        return isUndirectedVertex(c) || c === '.';
    }

    function isBottomVertex(c) {
        return isUndirectedVertex(c) || c === "'";
    }

    function isVertexOrLeftDecoration(c) {
        return isVertex(c) || c === '<' || isPoint(c);
    }

    function isVertexOrRightDecoration(c) {
        return isVertex(c) || c === '>' || isPoint(c);
    }
    //function isArrowHead(c)        { return ARROW_HEAD_CHARACTERS.indexOf(c) + 1; }
    function isGray(c) {
        return GRAY_CHARACTERS.indexOf(c) + 1;
    }

    function isTri(c) {
        return TRI_CHARACTERS.indexOf(c) + 1;
    }

    // "D" = Diagonal slash (/), "B" = diagonal Backslash (\)
    // Characters that may appear anywhere on a solid line
    function isSolidHLine(c) {
        return c === '-' || isUndirectedVertex(c) || isJump(c);
    }

    function isSolidVLineOrJumpOrPoint(c) {
        return isSolidVLine(c) || isJump(c) || isPoint(c);
    }

    function isSolidVLine(c) {
        return c === '|' || isUndirectedVertex(c);
    }

    function isSolidDLine(c) {
        return c === '/' || isUndirectedVertex(c);
    }

    function isSolidBLine(c) {
        return c === '\\' || isUndirectedVertex(c);
    }

    function isJump(c) {
        return JUMP_CHARACTERS.indexOf(c) + 1;
    }

    function isPoint(c) {
        return POINT_CHARACTERS.indexOf(c) + 1;
    }

    function isDecoration(c) {
        return DECORATION_CHARACTERS.indexOf(c) + 1;
    }
    //function isEmpty(c)            { return c === ' '; }

    ///////////////////////////////////////////////////////////////////////////////
    // Math library

    /** Invoke as new Vec2(v) to clone or new Vec2(x, y) to create from coordinates.
        Can also invoke without new for brevity. */
    function Vec2(x, y) {
        // Detect when being run without new
        if (!(this instanceof Vec2)) {
            return new Vec2(x, y);
        }

        if (y === undefined) {
            if (x === undefined) {
                x = y = 0;
            } else if (x instanceof Vec2) {
                y = x.y;
                x = x.x;
            } else {
                console.error("Vec2 requires one Vec2 or (x, y) as an argument");
            }
        }
        this.x = x;
        this.y = y;
        Object.seal(this);
    }

    /** Returns an SVG representation */
    Vec2.prototype.toString = Vec2.prototype.toSVG = function () {
        return '' + this.x * SCALE + ',' + this.y * SCALE * ASPECT + ' ';
    };

    /** The grid is */
    function makeGrid(str) {
        /** Converts a "rectangular" string defined by newlines into 2D
            array of characters. Grids are immutable. */

        /** Returns ' ' for out of bounds values */
        var grid = function grid(x, y) {
            if (y === undefined) {
                if (x instanceof Vec2) {
                    y = x.y;
                    x = x.x;
                } else {
                    console.error('grid requires either a Vec2 or (x, y)');
                }
            }

            return x >= 0 && x < grid.width && y >= 0 && y < grid.height ? str[y * (grid.width + 1) + x] : ' ';
        };

        // Elements are true when consumed
        grid._used = [];

        grid.width = str.indexOf('\n');
        grid.height = str.split('\n').length;
        if (str[str.length - 1] === '\n') {
            --grid.height;
        }

        /** Mark this location. Takes a Vec2 or (x, y) */
        grid.setUsed = function (x, y) {
            if (y === undefined) {
                if (x instanceof Vec2) {
                    y = x.y;
                    x = x.x;
                } else {
                    console.error('grid requires either a Vec2 or (x, y)');
                }
            }
            if (x >= 0 && x < grid.width && y >= 0 && y < grid.height) {
                // Match the source string indexing
                grid._used[y * (grid.width + 1) + x] = true;
            }
        };

        grid.isUsed = function (x, y) {
            if (y === undefined) {
                if (x instanceof Vec2) {
                    y = x.y;
                    x = x.x;
                } else {
                    console.error('grid requires either a Vec2 or (x, y)');
                }
            }
            return this._used[y * (this.width + 1) + x] === true;
        };

        /** Returns true if there is a solid vertical line passing through (x, y) */
        grid.isSolidVLineAt = function (x, y) {
            if (y === undefined) {
                y = x.x;
                x = x.x;
            }

            var up = grid(x, y - 1);
            var c = grid(x, y);
            var dn = grid(x, y + 1);

            var uprt = grid(x + 1, y - 1);
            var uplt = grid(x - 1, y - 1);

            if (isSolidVLine(c)) {
                // Looks like a vertical line...does it continue?
                return isTopVertex(up) || up === '^' || isSolidVLine(up) || isJump(up) || isBottomVertex(dn) || dn === 'v' || isSolidVLine(dn) || isJump(dn) || isPoint(up) || isPoint(dn) || grid(x, y - 1) === '_' || uplt === '_' || uprt === '_' ||

                // Special case of 1-high vertical on two curved corners 
                (isTopVertex(uplt) || isTopVertex(uprt)) && (isBottomVertex(grid(x - 1, y + 1)) || isBottomVertex(grid(x + 1, y + 1)));
            } else if (isTopVertex(c) || c === '^') {
                // May be the top of a vertical line
                return isSolidVLine(dn) || isJump(dn) && c !== '.';
            } else if (isBottomVertex(c) || c === 'v') {
                return isSolidVLine(up) || isJump(up) && c !== "'";
            } else if (isPoint(c)) {
                return isSolidVLine(up) || isSolidVLine(dn);
            }

            return false;
        };
        /** Returns true if there is a solid middle (---) horizontal line
            passing through (x, y). Ignores underscores. */
        grid.isSolidHLineAt = function (x, y) {
            if (y === undefined) {
                y = x.x;
                x = x.x;
            }

            var ltlt = grid(x - 2, y);
            var lt = grid(x - 1, y);
            var c = grid(x + 0, y);
            var rt = grid(x + 1, y);
            var rtrt = grid(x + 2, y);

            if (isSolidHLine(c) || isSolidHLine(lt) && isJump(c)) {
                // Looks like a horizontal line...does it continue? We need three in a row.
                if (isSolidHLine(lt)) {
                    return isSolidHLine(rt) || isVertexOrRightDecoration(rt) || isSolidHLine(ltlt) || isVertexOrLeftDecoration(ltlt);
                } else if (isVertexOrLeftDecoration(lt)) {
                    return isSolidHLine(rt);
                } else {
                    return isSolidHLine(rt) && (isSolidHLine(rtrt) || isVertexOrRightDecoration(rtrt));
                }
            } else if (c === '<') {
                return isSolidHLine(rt) && isSolidHLine(rtrt);
            } else if (c === '>') {
                return isSolidHLine(lt) && isSolidHLine(ltlt);
            } else if (isVertex(c)) {
                return isSolidHLine(lt) && isSolidHLine(ltlt) || isSolidHLine(rt) && isSolidHLine(rtrt);
            }

            return false;
        };

        /** Returns true if there is a solid backslash line passing through (x, y) */
        grid.isSolidBLineAt = function (x, y) {
            if (y === undefined) {
                y = x.x;
                x = x.x;
            }
            var c = grid(x, y);
            var lt = grid(x - 1, y - 1);
            var rt = grid(x + 1, y + 1);

            if (c === '\\') {
                // Looks like a diagonal line...does it continue? We need two in a row.
                return isSolidBLine(rt) || isBottomVertex(rt) || isPoint(rt) || rt === 'v' || isSolidBLine(lt) || isTopVertex(lt) || isPoint(lt) || lt === '^' || grid(x, y - 1) === '/' || grid(x, y + 1) === '/' || rt === '_' || lt === '_';
            } else if (c === '.') {
                return rt === '\\';
            } else if (c === "'") {
                return lt === '\\';
            } else if (c === '^') {
                return rt === '\\';
            } else if (c === 'v') {
                return lt === '\\';
            } else if (isVertex(c) || isPoint(c) || c === '|') {
                return isSolidBLine(lt) || isSolidBLine(rt);
            }
        };

        /** Returns true if there is a solid diagonal line passing through (x, y) */
        grid.isSolidDLineAt = function (x, y) {
            if (y === undefined) {
                y = x.x;
                x = x.x;
            }

            var c = grid(x, y);
            var lt = grid(x - 1, y + 1);
            var rt = grid(x + 1, y - 1);

            if (c === '/' && (grid(x, y - 1) === '\\' || grid(x, y + 1) === '\\')) {
                // Special case of tiny hexagon corner
                return true;
            } else if (isSolidDLine(c)) {
                // Looks like a diagonal line...does it continue? We need two in a row.
                return isSolidDLine(rt) || isTopVertex(rt) || isPoint(rt) || rt === '^' || rt === '_' || isSolidDLine(lt) || isBottomVertex(lt) || isPoint(lt) || lt === 'v' || lt === '_';
            } else if (c === '.') {
                return lt === '/';
            } else if (c === "'") {
                return rt === '/';
            } else if (c === '^') {
                return lt === '/';
            } else if (c === 'v') {
                return rt === '/';
            } else if (isVertex(c) || isPoint(c) || c === '|') {
                return isSolidDLine(lt) || isSolidDLine(rt);
            }
            return false;
        };

        grid.toString = function () {
            return str;
        };

        return Object.freeze(grid);
    }

    /** A 1D curve. If C is specified, the result is a bezier with
        that as the tangent control point */
    function Path(A, B, C, D, dashed) {
        if (!(A instanceof Vec2 && B instanceof Vec2)) {
            console.error('Path constructor requires at least two Vec2s');
        }
        this.A = A;
        this.B = B;
        if (C) {
            this.C = C;
            if (D) {
                this.D = D;
            } else {
                this.D = C;
            }
        }

        this.dashed = dashed || false;

        Object.freeze(this);
    }

    var _ = Path.prototype;
    _.isVertical = function () {
        return this.B.x === this.A.x;
    };

    _.isHorizontal = function () {
        return this.B.y === this.A.y;
    };

    /** Diagonal lines look like: / See also backDiagonal */
    _.isDiagonal = function () {
        var dx = this.B.x - this.A.x;
        var dy = this.B.y - this.A.y;
        return Math.abs(dy + dx) < EPSILON;
    };

    _.isBackDiagonal = function () {
        var dx = this.B.x - this.A.x;
        var dy = this.B.y - this.A.y;
        return Math.abs(dy - dx) < EPSILON;
    };

    _.isCurved = function () {
        return this.C !== undefined;
    };

    /** Does this path have any end at (x, y) */
    _.endsAt = function (x, y) {
        if (y === undefined) {
            y = x.y;
            x = x.x;
        }
        return this.A.x === x && this.A.y === y || this.B.x === x && this.B.y === y;
    };

    /** Does this path have an up end at (x, y) */
    _.upEndsAt = function (x, y) {
        if (y === undefined) {
            y = x.y;
            x = x.x;
        }
        return this.isVertical() && this.A.x === x && min(this.A.y, this.B.y) === y;
    };

    /** Does this path have an up end at (x, y) */
    _.diagonalUpEndsAt = function (x, y) {
        if (!this.isDiagonal()) {
            return false;
        }
        if (y === undefined) {
            y = x.y;
            x = x.x;
        }
        if (this.A.y < this.B.y) {
            return this.A.x === x && this.A.y === y;
        } else {
            return this.B.x === x && this.B.y === y;
        }
    };

    /** Does this path have a down end at (x, y) */
    _.diagonalDownEndsAt = function (x, y) {
        if (!this.isDiagonal()) {
            return false;
        }
        if (y === undefined) {
            y = x.y;
            x = x.x;
        }
        if (this.B.y < this.A.y) {
            return this.A.x === x && this.A.y === y;
        } else {
            return this.B.x === x && this.B.y === y;
        }
    };

    /** Does this path have an up end at (x, y) */
    _.backDiagonalUpEndsAt = function (x, y) {
        if (!this.isBackDiagonal()) {
            return false;
        }
        if (y === undefined) {
            y = x.y;
            x = x.x;
        }
        if (this.A.y < this.B.y) {
            return this.A.x === x && this.A.y === y;
        } else {
            return this.B.x === x && this.B.y === y;
        }
    };

    /** Does this path have a down end at (x, y) */
    _.backDiagonalDownEndsAt = function (x, y) {
        if (!this.isBackDiagonal()) {
            return false;
        }
        if (y === undefined) {
            y = x.y;
            x = x.x;
        }
        if (this.B.y < this.A.y) {
            return this.A.x === x && this.A.y === y;
        } else {
            return this.B.x === x && this.B.y === y;
        }
    };

    /** Does this path have a down end at (x, y) */
    _.downEndsAt = function (x, y) {
        if (y === undefined) {
            y = x.y;
            x = x.x;
        }
        return this.isVertical() && this.A.x === x && max(this.A.y, this.B.y) === y;
    };

    /** Does this path have a left end at (x, y) */
    _.leftEndsAt = function (x, y) {
        if (y === undefined) {
            y = x.y;
            x = x.x;
        }
        return this.isHorizontal() && this.A.y === y && min(this.A.x, this.B.x) === x;
    };

    /** Does this path have a right end at (x, y) */
    _.rightEndsAt = function (x, y) {
        if (y === undefined) {
            y = x.y;
            x = x.x;
        }
        return this.isHorizontal() && this.A.y === y && max(this.A.x, this.B.x) === x;
    };

    _.verticalPassesThrough = function (x, y) {
        if (y === undefined) {
            y = x.y;
            x = x.x;
        }
        return this.isVertical() && this.A.x === x && min(this.A.y, this.B.y) <= y && max(this.A.y, this.B.y) >= y;
    };

    _.horizontalPassesThrough = function (x, y) {
        if (y === undefined) {
            y = x.y;
            x = x.x;
        }
        return this.isHorizontal() && this.A.y === y && min(this.A.x, this.B.x) <= x && max(this.A.x, this.B.x) >= x;
    };

    /** Returns a string suitable for inclusion in an SVG tag */
    _.toSVG = function () {
        var svg = '<path d="M ' + this.A;

        if (this.isCurved()) {
            svg += 'C ' + this.C + this.D + this.B;
        } else {
            svg += 'L ' + this.B;
        }
        svg += '" style="fill:none;"';
        if (this.dashed) {
            svg += ' stroke-dasharray="3,6"';
        }
        svg += '/>';
        return svg;
    };

    /** A group of 1D curves. This was designed so that all of the
        methods can later be implemented in O(1) time, but it
        currently uses O(n) implementations for source code
        simplicity. */
    function PathSet() {
        this._pathArray = [];
    }

    var PS = PathSet.prototype;
    PS.insert = function (path) {
        this._pathArray.push(path);
    };

    /** Returns a new method that returns true if method(x, y) 
        returns true on any element of _pathAray */
    function makeFilterAny(method) {
        return function (x, y) {
            for (var i = 0; i < this._pathArray.length; ++i) {
                if (method.call(this._pathArray[i], x, y)) {
                    return true;
                }
            }
            return false;
        };
    }

    // True if an up line ends at these coordinates. Recall that the
    // variable _ is bound to the Path prototype still.
    PS.upEndsAt = makeFilterAny(_.upEndsAt);
    PS.diagonalUpEndsAt = makeFilterAny(_.diagonalUpEndsAt);
    PS.backDiagonalUpEndsAt = makeFilterAny(_.backDiagonalUpEndsAt);
    PS.diagonalDownEndsAt = makeFilterAny(_.diagonalDownEndsAt);
    PS.backDiagonalDownEndsAt = makeFilterAny(_.backDiagonalDownEndsAt);
    PS.downEndsAt = makeFilterAny(_.downEndsAt);
    PS.leftEndsAt = makeFilterAny(_.leftEndsAt);
    PS.rightEndsAt = makeFilterAny(_.rightEndsAt);
    PS.endsAt = makeFilterAny(_.endsAt);
    PS.verticalPassesThrough = makeFilterAny(_.verticalPassesThrough);
    PS.horizontalPassesThrough = makeFilterAny(_.horizontalPassesThrough);

    /** Returns an SVG string */
    PS.toSVG = function () {
        var svg = '';
        for (var i = 0; i < this._pathArray.length; ++i) {
            svg += this._pathArray[i].toSVG() + '\n';
        }
        return svg;
    };

    function DecorationSet() {
        this._decorationArray = [];
    }

    var DS = DecorationSet.prototype;

    /** insert(x, y, type, <angle>)  
        insert(vec, type, <angle>)
         angle is the angle in degrees to rotate the result */
    DS.insert = function (x, y, type, angle) {
        if (type === undefined) {
            type = y;
            y = x.y;
            x = x.x;
        }

        if (!isDecoration(type)) {
            console.error('Illegal decoration character: ' + type);
        }
        var d = {
            C: Vec2(x, y),
            type: type,
            angle: angle || 0
        };

        // Put arrows at the front and points at the back so that
        // arrows always draw under points

        if (isPoint(type)) {
            this._decorationArray.push(d);
        } else {
            this._decorationArray.unshift(d);
        }
    };

    DS.toSVG = function () {
        var svg = '';
        for (var i = 0; i < this._decorationArray.length; ++i) {
            var decoration = this._decorationArray[i];
            var C = decoration.C;

            if (isJump(decoration.type)) {
                // Slide jumps
                var dx = decoration.type === ')' ? +0.75 : -0.75;
                var up = Vec2(C.x, C.y - 0.5);
                var dn = Vec2(C.x, C.y + 0.5);
                var cup = Vec2(C.x + dx, C.y - 0.5);
                var cdn = Vec2(C.x + dx, C.y + 0.5);

                svg += '<path d="M ' + dn + ' C ' + cdn + cup + up + '" style="fill:none;"/>';
            } else if (isPoint(decoration.type)) {

                svg += '<circle cx="' + C.x * SCALE + '" cy="' + C.y * SCALE * ASPECT + '" r="' + (SCALE - STROKE_WIDTH) + '" class="' + (decoration.type === '*' ? 'closed' : 'open') + 'dot"/>';
            } else if (isGray(decoration.type)) {

                var shade = Math.round((3 - GRAY_CHARACTERS.indexOf(decoration.type)) * 63.75);
                svg += '<rect x="' + (C.x - 0.5) * SCALE + '" y="' + (C.y - 0.5) * SCALE * ASPECT + '" width="' + SCALE + '" height="' + SCALE * ASPECT + '" fill="rgb(' + shade + ',' + shade + ',' + shade + ')"/>';
            } else if (isTri(decoration.type)) {
                // 30-60-90 triangle
                var index = TRI_CHARACTERS.indexOf(decoration.type);
                var xs = 0.5 - (index & 1);
                var ys = 0.5 - (index >> 1);
                xs *= sign(ys);
                var tip = Vec2(C.x + xs, C.y - ys);
                var _up = Vec2(C.x + xs, C.y + ys);
                var _dn = Vec2(C.x - xs, C.y + ys);
                svg += '<polygon points="' + tip + _up + _dn + '" style="stroke:none"/>\n';
            } else {
                // Arrow head
                var _tip = Vec2(C.x + 1, C.y);
                var _up2 = Vec2(C.x - 0.5, C.y - 0.35);
                var _dn2 = Vec2(C.x - 0.5, C.y + 0.35);
                svg += '<polygon points="' + _tip + _up2 + _dn2 + '"  style="stroke:none" transform="rotate(' + decoration.angle + ',' + C + ')"/>\n';
            }
        }
        return svg;
    };

    ////////////////////////////////////////////////////////////////////////////

    function findPaths(grid, pathSet) {
        // Does the line from A to B contain at least one c?
        function lineContains(A, B, c) {
            var dx = sign(B.x - A.x);
            var dy = sign(B.y - A.y);
            var x, y;

            for (x = A.x, y = A.y; x !== B.x || y !== B.y; x += dx, y += dy) {
                if (grid(x, y) === c) {
                    return true;
                }
            }

            // Last point
            return grid(x, y) === c;
        }

        // Find all solid vertical lines. Iterate horizontally
        // so that we never hit the same line twice
        for (var x = 0; x < grid.width; ++x) {
            for (var y = 0; y < grid.height; ++y) {
                if (grid.isSolidVLineAt(x, y)) {
                    // This character begins a vertical line...now, find the end
                    var A = Vec2(x, y);
                    do {
                        grid.setUsed(x, y);
                        ++y;
                    } while (grid.isSolidVLineAt(x, y));
                    var B = Vec2(x, y - 1);

                    var up = grid(A);
                    var upup = grid(A.x, A.y - 1);

                    if (!isVertex(up) && (upup === '-' || upup === '_' || grid(A.x - 1, A.y - 1) === '_' || grid(A.x + 1, A.y - 1) === '_' || isBottomVertex(upup)) || isJump(upup)) {
                        // Stretch up to almost reach the line above (if there is a decoration,
                        // it will finish the gap)
                        A.y -= 0.5;
                    }

                    var dn = grid(B);
                    var dndn = grid(B.x, B.y + 1);
                    if (!isVertex(dn) && (dndn === '-' || isTopVertex(dndn)) || isJump(dndn) || grid(B.x - 1, B.y) === '_' || grid(B.x + 1, B.y) === '_') {
                        // Stretch down to almost reach the line below
                        B.y += 0.5;
                    }

                    // Don't insert degenerate lines
                    if (A.x !== B.x || A.y !== B.y) {
                        pathSet.insert(new Path(A, B));
                    }

                    // Continue the search from the end value y+1
                }

                // Some very special patterns for the short lines needed on
                // circuit diagrams. Only invoke these if not also on a curve
                //      _  _    
                //    -'    '-
                else if (grid(x, y) === "'" && (grid(x - 1, y) === '-' && grid(x + 1, y - 1) === '_' && !isSolidVLineOrJumpOrPoint(grid(x - 1, y - 1)) || grid(x - 1, y - 1) === '_' && grid(x + 1, y) === '-' && !isSolidVLineOrJumpOrPoint(grid(x + 1, y - 1)))) {
                        pathSet.insert(new Path(Vec2(x, y - 0.5), Vec2(x, y)));
                    }

                    //    _.-  -._ 
                    else if (grid(x, y) === '.' && (grid(x - 1, y) === '_' && grid(x + 1, y) === '-' && !isSolidVLineOrJumpOrPoint(grid(x + 1, y + 1)) || grid(x - 1, y) === '-' && grid(x + 1, y) === '_' && !isSolidVLineOrJumpOrPoint(grid(x - 1, y + 1)))) {
                            pathSet.insert(new Path(Vec2(x, y), Vec2(x, y + 0.5)));
                        }
            } // y
        } // x

        // Find all solid horizontal lines
        for (var _y = 0; _y < grid.height; ++_y) {
            for (var _x = 0; _x < grid.width; ++_x) {
                if (grid.isSolidHLineAt(_x, _y)) {
                    // Begins a line...find the end
                    var _A = Vec2(_x, _y);
                    do {
                        grid.setUsed(_x, _y);
                        ++_x;
                    } while (grid.isSolidHLineAt(_x, _y));
                    var _B = Vec2(_x - 1, _y);

                    // Detect curves and shorten the edge
                    if (!isVertex(grid(_A.x - 1, _A.y)) && (isTopVertex(grid(_A)) && isSolidVLineOrJumpOrPoint(grid(_A.x - 1, _A.y + 1)) || isBottomVertex(grid(_A)) && isSolidVLineOrJumpOrPoint(grid(_A.x - 1, _A.y - 1)))) {
                        ++_A.x;
                    }

                    if (!isVertex(grid(_B.x + 1, _B.y)) && (isTopVertex(grid(_B)) && isSolidVLineOrJumpOrPoint(grid(_B.x + 1, _B.y + 1)) || isBottomVertex(grid(_B)) && isSolidVLineOrJumpOrPoint(grid(_B.x + 1, _B.y - 1)))) {
                        --_B.x;
                    }

                    // Don't insert degenerate lines
                    if (_A.x !== _B.x || _A.y !== _B.y) {
                        pathSet.insert(new Path(_A, _B));
                    }
                    // Continue the search from the end x+1
                }
            }
        } // y

        // Find all solid left-to-right downward diagonal lines (BACK DIAGONAL)
        for (var _i = -grid.height; _i < grid.width; ++_i) {
            for (var _x2 = _i, _y2 = 0; _y2 < grid.height; ++_y2, ++_x2) {
                if (grid.isSolidBLineAt(_x2, _y2)) {
                    // Begins a line...find the end
                    var _A2 = Vec2(_x2, _y2);
                    do {
                        ++_x2;
                        ++_y2;
                    } while (grid.isSolidBLineAt(_x2, _y2));
                    var _B2 = Vec2(_x2 - 1, _y2 - 1);

                    // Ensure that the entire line wasn't just vertices
                    if (lineContains(_A2, _B2, '\\')) {
                        for (var j = _A2.x; j <= _B2.x; ++j) {
                            grid.setUsed(j, _A2.y + (j - _A2.x));
                        }

                        var top = grid(_A2);
                        var _up3 = grid(_A2.x, _A2.y - 1);
                        var uplt = grid(_A2.x - 1, _A2.y - 1);
                        if (_up3 === '/' || uplt === '_' || _up3 === '_' || !isVertex(top) && (isSolidHLine(uplt) || isSolidVLine(uplt))) {
                            // Continue half a cell more to connect for:
                            //  ___   ___
                            //  \        \    /      ----     |
                            //   \        \   \        ^      |^
                            _A2.x -= 0.5;
                            _A2.y -= 0.5;
                        } else if (isPoint(uplt)) {
                            // Continue 1/4 cell more to connect for:
                            //
                            //  o
                            //   ^
                            //    \
                            _A2.x -= 0.25;
                            _A2.y -= 0.25;
                        }

                        var dnrt = grid(_B2.x + 1, _B2.y + 1);
                        if (grid(_B2.x, _B2.y + 1) === '/' || grid(_B2.x + 1, _B2.y) === '_' || grid(_B2.x - 1, _B2.y) === '_' || !isVertex(grid(_B2)) && (isSolidHLine(dnrt) || isSolidVLine(dnrt))) {
                            // Continue half a cell more to connect for:
                            //                       \      \ |
                            //  \       \     \       v      v|
                            //   \__   __\    /      ----     |

                            _B2.x += 0.5;
                            _B2.y += 0.5;
                        } else if (isPoint(dnrt)) {
                            // Continue 1/4 cell more to connect for:
                            //
                            //    \
                            //     v
                            //      o

                            _B2.x += 0.25;
                            _B2.y += 0.25;
                        }

                        pathSet.insert(new Path(_A2, _B2));
                        // Continue the search from the end x+1,y+1
                    } // lineContains
                }
            }
        } // i

        // Find all solid left-to-right upward diagonal lines (DIAGONAL)
        for (var i = -grid.height; i < grid.width; ++i) {
            for (var _x3 = i, _y3 = grid.height - 1; _y3 >= 0; --_y3, ++_x3) {
                if (grid.isSolidDLineAt(_x3, _y3)) {
                    // Begins a line...find the end
                    var _A3 = Vec2(_x3, _y3);
                    do {
                        ++_x3;
                        --_y3;
                    } while (grid.isSolidDLineAt(_x3, _y3));
                    var _B3 = Vec2(_x3 - 1, _y3 + 1);

                    if (lineContains(_A3, _B3, '/')) {
                        // This is definitely a line. Commit the characters on it
                        for (var _j = _A3.x; _j <= _B3.x; ++_j) {
                            grid.setUsed(_j, _A3.y - (_j - _A3.x));
                        }

                        var _up4 = grid(_B3.x, _B3.y - 1);
                        var uprt = grid(_B3.x + 1, _B3.y - 1);
                        if (_up4 === '\\' || _up4 === '_' || uprt === '_' || !isVertex(grid(_B3)) && (isSolidHLine(uprt) || isSolidVLine(uprt))) {

                            // Continue half a cell more to connect at:
                            //     __   __  ---     |
                            //    /      /   ^     ^|
                            //   /      /   /     / |

                            _B3.x += 0.5;
                            _B3.y -= 0.5;
                        } else if (isPoint(uprt)) {

                            // Continue 1/4 cell more to connect at:
                            //
                            //       o
                            //      ^
                            //     /

                            _B3.x += 0.25;
                            _B3.y -= 0.25;
                        }

                        var dnlt = grid(_A3.x - 1, _A3.y + 1);
                        if (grid(_A3.x, _A3.y + 1) === '\\' || grid(_A3.x - 1, _A3.y) === '_' || grid(_A3.x + 1, _A3.y) === '_' || !isVertex(grid(_A3)) && (isSolidHLine(dnlt) || isSolidVLine(dnlt))) {

                            // Continue half a cell more to connect at:
                            //               /     \ |
                            //    /  /      v       v|
                            // __/  /__   ----       | 

                            _A3.x -= 0.5;
                            _A3.y += 0.5;
                        } else if (isPoint(dnlt)) {

                            // Continue 1/4 cell more to connect at:
                            //
                            //       /
                            //      v
                            //     o

                            _A3.x -= 0.25;
                            _A3.y += 0.25;
                        }
                        pathSet.insert(new Path(_A3, _B3));

                        // Continue the search from the end x+1,y-1
                    } // lineContains
                }
            }
        } // y

        // Now look for curved corners. The syntax constraints require
        // that these can always be identified by looking at three
        // horizontally-adjacent characters.
        for (var _y4 = 0; _y4 < grid.height; ++_y4) {
            for (var _x4 = 0; _x4 < grid.width; ++_x4) {
                var c = grid(_x4, _y4);

                // Note that because of undirected vertices, the
                // following cases are not exclusive
                if (isTopVertex(c)) {
                    // -.
                    //   |
                    if (isSolidHLine(grid(_x4 - 1, _y4)) && isSolidVLine(grid(_x4 + 1, _y4 + 1))) {
                        grid.setUsed(_x4 - 1, _y4);
                        grid.setUsed(_x4, _y4);
                        grid.setUsed(_x4 + 1, _y4 + 1);
                        pathSet.insert(new Path(Vec2(_x4 - 1, _y4), Vec2(_x4 + 1, _y4 + 1), Vec2(_x4 + 1.1, _y4), Vec2(_x4 + 1, _y4 + 1)));
                    }

                    //  .-
                    // |
                    if (isSolidHLine(grid(_x4 + 1, _y4)) && isSolidVLine(grid(_x4 - 1, _y4 + 1))) {
                        grid.setUsed(_x4 - 1, _y4 + 1);
                        grid.setUsed(_x4, _y4);
                        grid.setUsed(_x4 + 1, _y4);
                        pathSet.insert(new Path(Vec2(_x4 + 1, _y4), Vec2(_x4 - 1, _y4 + 1), Vec2(_x4 - 1.1, _y4), Vec2(_x4 - 1, _y4 + 1)));
                    }
                }

                // Special case patterns:
                //   .  .   .  .    
                //  (  o     )  o
                //   '  .   '  '
                if ((c === ')' || isPoint(c)) && grid(_x4 - 1, _y4 - 1) === '.' && grid(_x4 - 1, _y4 + 1) === "\'") {
                    grid.setUsed(_x4, _y4);
                    grid.setUsed(_x4 - 1, _y4 - 1);
                    grid.setUsed(_x4 - 1, _y4 + 1);
                    pathSet.insert(new Path(Vec2(_x4 - 2, _y4 - 1), Vec2(_x4 - 2, _y4 + 1), Vec2(_x4 + 0.6, _y4 - 1), Vec2(_x4 + 0.6, _y4 + 1)));
                }

                if ((c === '(' || isPoint(c)) && grid(_x4 + 1, _y4 - 1) === '.' && grid(_x4 + 1, _y4 + 1) === "\'") {
                    grid.setUsed(_x4, _y4);
                    grid.setUsed(_x4 + 1, _y4 - 1);
                    grid.setUsed(_x4 + 1, _y4 + 1);
                    pathSet.insert(new Path(Vec2(_x4 + 2, _y4 - 1), Vec2(_x4 + 2, _y4 + 1), Vec2(_x4 - 0.6, _y4 - 1), Vec2(_x4 - 0.6, _y4 + 1)));
                }

                if (isBottomVertex(c)) {
                    //   |
                    // -' 
                    if (isSolidHLine(grid(_x4 - 1, _y4)) && isSolidVLine(grid(_x4 + 1, _y4 - 1))) {
                        grid.setUsed(_x4 - 1, _y4);
                        grid.setUsed(_x4, _y4);
                        grid.setUsed(_x4 + 1, _y4 - 1);
                        pathSet.insert(new Path(Vec2(_x4 - 1, _y4), Vec2(_x4 + 1, _y4 - 1), Vec2(_x4 + 1.1, _y4), Vec2(_x4 + 1, _y4 - 1)));
                    }

                    // | 
                    //  '-
                    if (isSolidHLine(grid(_x4 + 1, _y4)) && isSolidVLine(grid(_x4 - 1, _y4 - 1))) {
                        grid.setUsed(_x4 - 1, _y4 - 1);
                        grid.setUsed(_x4, _y4);
                        grid.setUsed(_x4 + 1, _y4);
                        pathSet.insert(new Path(Vec2(_x4 + 1, _y4), Vec2(_x4 - 1, _y4 - 1), Vec2(_x4 - 1.1, _y4), Vec2(_x4 - 1, _y4 - 1)));
                    }
                }
            } // for x
        } // for y

        // Find low horizontal lines marked with underscores. These
        // are so simple compared to the other cases that we process
        // them directly here without a helper function. Process these
        // from top to bottom and left to right so that we can read
        // them in a single sweep.
        // 
        // Exclude the special case of double underscores going right
        // into an ASCII character, which could be a source code
        // identifier such as __FILE__ embedded in the diagram.
        for (var _y5 = 0; _y5 < grid.height; ++_y5) {
            for (var _x5 = 0; _x5 < grid.width - 2; ++_x5) {
                var lt = grid(_x5 - 1, _y5);

                if (grid(_x5, _y5) === '_' && grid(_x5 + 1, _y5) === '_' && (!isASCIILetter(grid(_x5 + 2, _y5)) || lt === '_') && (!isASCIILetter(lt) || grid(_x5 + 2, _y5) === '_')) {

                    var ltlt = grid(_x5 - 2, _y5);
                    var _A4 = Vec2(_x5 - 0.5, _y5 + 0.5);

                    if (lt === '|' || grid(_x5 - 1, _y5 + 1) === '|' || lt === '.' || grid(_x5 - 1, _y5 + 1) === "'") {
                        // Extend to meet adjacent vertical
                        _A4.x -= 0.5;

                        // Very special case of overrunning into the side of a curve,
                        // needed for logic gate diagrams
                        if (lt === '.' && (ltlt === '-' || ltlt === '.') && grid(_x5 - 2, _y5 + 1) === '(') {
                            _A4.x -= 0.5;
                        }
                    } else if (lt === '/') {
                        _A4.x -= 1.0;
                    }

                    // Detect overrun of a tight double curve
                    if (lt === '(' && ltlt === '(' && grid(_x5, _y5 + 1) === "'" && grid(_x5, _y5 - 1) === '.') {
                        _A4.x += 0.5;
                    }
                    lt = ltlt = undefined;

                    do {
                        grid.setUsed(_x5, _y5);
                        ++_x5;
                    } while (grid(_x5, _y5) === '_');

                    var _B4 = Vec2(_x5 - 0.5, _y5 + 0.5);
                    var _c = grid(_x5, _y5);
                    var rt = grid(_x5 + 1, _y5);
                    var _dn3 = grid(_x5, _y5 + 1);

                    if (_c === '|' || _dn3 === '|' || _c === '.' || _dn3 === "'") {
                        // Extend to meet adjacent vertical
                        _B4.x += 0.5;

                        // Very special case of overrunning into the side of a curve,
                        // needed for logic gate diagrams
                        if (_c === '.' && (rt === '-' || rt === '.') && grid(_x5 + 1, _y5 + 1) === ')') {
                            _B4.x += 0.5;
                        }
                    } else if (_c === '\\') {
                        _B4.x += 1.0;
                    }

                    // Detect overrun of a tight double curve
                    if (_c === ')' && rt === ')' && grid(_x5 - 1, _y5 + 1) === "'" && grid(_x5 - 1, _y5 - 1) === '.') {
                        _B4.x += -0.5;
                    }

                    pathSet.insert(new Path(_A4, _B4));
                }
            } // for x
        } // for y
    } // findPaths

    function findDecorations(grid, pathSet, decorationSet) {
        function isEmptyOrVertex(c) {
            return c === ' ' || /[^a-zA-Z0-9]|[ov]/.test(c);
        }

        /** Is the point in the center of these values on a line? Allow points that are vertically
            adjacent but not horizontally--they wouldn't fit anyway, and might be text. */
        function onLine(up, dn, lt, rt) {
            return (isEmptyOrVertex(dn) || isPoint(dn)) && (isEmptyOrVertex(up) || isPoint(up)) && isEmptyOrVertex(rt) && isEmptyOrVertex(lt);
        }

        for (var x = 0; x < grid.width; ++x) {
            for (var j = 0; j < grid.height; ++j) {
                var c = grid(x, j);
                var y = j;

                if (isJump(c)) {

                    // Ensure that this is really a jump and not a stray character
                    if (pathSet.downEndsAt(x, y - 0.5) && pathSet.upEndsAt(x, y + 0.5)) {
                        decorationSet.insert(x, y, c);
                        grid.setUsed(x, y);
                    }
                } else if (isPoint(c)) {
                    var up = grid(x, y - 1);
                    var dn = grid(x, y + 1);
                    var lt = grid(x - 1, y);
                    var rt = grid(x + 1, y);

                    if (pathSet.rightEndsAt(x - 1, y) || // Must be at the end of a line...
                    pathSet.leftEndsAt(x + 1, y) || // or completely isolated NSEW
                    pathSet.downEndsAt(x, y - 1) || pathSet.upEndsAt(x, y + 1) || pathSet.upEndsAt(x, y) || // For points on vertical lines 
                    pathSet.downEndsAt(x, y) || // that are surrounded by other characters

                    onLine(up, dn, lt, rt)) {

                        decorationSet.insert(x, y, c);
                        grid.setUsed(x, y);
                    }
                } else if (isGray(c)) {
                    decorationSet.insert(x, y, c);
                    grid.setUsed(x, y);
                } else if (isTri(c)) {
                    decorationSet.insert(x, y, c);
                    grid.setUsed(x, y);
                } else {
                    // Arrow heads

                    // If we find one, ensure that it is really an
                    // arrow head and not a stray character by looking
                    // for a connecting line.
                    var dx = 0;
                    if (c === '>' && (pathSet.rightEndsAt(x, y) || pathSet.horizontalPassesThrough(x, y))) {
                        if (isPoint(grid(x + 1, y))) {
                            // Back up if connecting to a point so as to not
                            // overlap it
                            dx = -0.5;
                        }
                        decorationSet.insert(x + dx, y, '>', 0);
                        grid.setUsed(x, y);
                    } else if (c === '<' && (pathSet.leftEndsAt(x, y) || pathSet.horizontalPassesThrough(x, y))) {
                        if (isPoint(grid(x - 1, y))) {
                            // Back up if connecting to a point so as to not
                            // overlap it
                            dx = 0.5;
                        }
                        decorationSet.insert(x + dx, y, '>', 180);
                        grid.setUsed(x, y);
                    } else if (c === '^') {
                        // Because of the aspect ratio, we need to look
                        // in two slots for the end of the previous line
                        if (pathSet.upEndsAt(x, y - 0.5)) {
                            decorationSet.insert(x, y - 0.5, '>', 270);
                            grid.setUsed(x, y);
                        } else if (pathSet.upEndsAt(x, y)) {
                            decorationSet.insert(x, y, '>', 270);
                            grid.setUsed(x, y);
                        } else if (pathSet.diagonalUpEndsAt(x + 0.5, y - 0.5)) {
                            decorationSet.insert(x + 0.5, y - 0.5, '>', 270 + DIAGONAL_ANGLE);
                            grid.setUsed(x, y);
                        } else if (pathSet.diagonalUpEndsAt(x + 0.25, y - 0.25)) {
                            decorationSet.insert(x + 0.25, y - 0.25, '>', 270 + DIAGONAL_ANGLE);
                            grid.setUsed(x, y);
                        } else if (pathSet.diagonalUpEndsAt(x, y)) {
                            decorationSet.insert(x, y, '>', 270 + DIAGONAL_ANGLE);
                            grid.setUsed(x, y);
                        } else if (pathSet.backDiagonalUpEndsAt(x, y)) {
                            decorationSet.insert(x, y, c, 270 - DIAGONAL_ANGLE);
                            grid.setUsed(x, y);
                        } else if (pathSet.backDiagonalUpEndsAt(x - 0.5, y - 0.5)) {
                            decorationSet.insert(x - 0.5, y - 0.5, c, 270 - DIAGONAL_ANGLE);
                            grid.setUsed(x, y);
                        } else if (pathSet.backDiagonalUpEndsAt(x - 0.25, y - 0.25)) {
                            decorationSet.insert(x - 0.25, y - 0.25, c, 270 - DIAGONAL_ANGLE);
                            grid.setUsed(x, y);
                        } else if (pathSet.verticalPassesThrough(x, y)) {
                            // Only try this if all others failed
                            decorationSet.insert(x, y - 0.5, '>', 270);
                            grid.setUsed(x, y);
                        }
                    } else if (c === 'v') {
                        if (pathSet.downEndsAt(x, y + 0.5)) {
                            decorationSet.insert(x, y + 0.5, '>', 90);
                            grid.setUsed(x, y);
                        } else if (pathSet.downEndsAt(x, y)) {
                            decorationSet.insert(x, y, '>', 90);
                            grid.setUsed(x, y);
                        } else if (pathSet.diagonalDownEndsAt(x, y)) {
                            decorationSet.insert(x, y, '>', 90 + DIAGONAL_ANGLE);
                            grid.setUsed(x, y);
                        } else if (pathSet.diagonalDownEndsAt(x - 0.5, y + 0.5)) {
                            decorationSet.insert(x - 0.5, y + 0.5, '>', 90 + DIAGONAL_ANGLE);
                            grid.setUsed(x, y);
                        } else if (pathSet.diagonalDownEndsAt(x - 0.25, y + 0.25)) {
                            decorationSet.insert(x - 0.25, y + 0.25, '>', 90 + DIAGONAL_ANGLE);
                            grid.setUsed(x, y);
                        } else if (pathSet.backDiagonalDownEndsAt(x, y)) {
                            decorationSet.insert(x, y, '>', 90 - DIAGONAL_ANGLE);
                            grid.setUsed(x, y);
                        } else if (pathSet.backDiagonalDownEndsAt(x + 0.5, y + 0.5)) {
                            decorationSet.insert(x + 0.5, y + 0.5, '>', 90 - DIAGONAL_ANGLE);
                            grid.setUsed(x, y);
                        } else if (pathSet.backDiagonalDownEndsAt(x + 0.25, y + 0.25)) {
                            decorationSet.insert(x + 0.25, y + 0.25, '>', 90 - DIAGONAL_ANGLE);
                            grid.setUsed(x, y);
                        } else if (pathSet.verticalPassesThrough(x, y)) {
                            // Only try this if all others failed
                            decorationSet.insert(x, y + 0.5, '>', 90);
                            grid.setUsed(x, y);
                        }
                    } // arrow heads
                } // decoration type
            } // y
        } // x
    } // findArrowHeads

    //var grid = new Grid(diagramString);
    var grid = makeGrid(diagramString);

    var pathSet = new PathSet();
    var decorationSet = new DecorationSet();

    findPaths(grid, pathSet);
    findDecorations(grid, pathSet, decorationSet);

    var svg = '<svg class="diagram" xmlns="http://www.w3.org/2000/svg" version="1.1" height="' + (grid.height + 1) * SCALE * ASPECT + '" width="' + (grid.width + 1) * SCALE + '"';

    if (alignmentHint === 'floatleft') {
        svg += ' style="float:left;margin: 15px 30px 15px 0px;"';
    } else if (alignmentHint === 'floatright') {
        svg += ' style="float:right;margin: 15px 0px 15px 30px;"';
    } else if (alignmentHint === 'center') {
        svg += ' style="margin: 0px auto 0px auto;"';
    }

    svg += '>';
    svg += styleTag;
    svg += '<g transform="translate(' + Vec2(1, 1) + ')">\n';

    if (DEBUG_SHOW_GRID) {
        svg += '<g style="opacity:0.1">\n';
        for (var x = 0; x < grid.width; ++x) {
            for (var y = 0; y < grid.height; ++y) {
                svg += '<rect x="' + ((x - 0.5) * SCALE + 1) + '" + y="' + ((y - 0.5) * SCALE * ASPECT + 2) + '" width="' + (SCALE - 2) + '" height="' + (SCALE * ASPECT - 2) + '" style="fill:';
                if (grid.isUsed(x, y)) {
                    svg += 'red;';
                } else if (grid(x, y) === ' ') {
                    svg += 'gray; opacity:0.05';
                } else {
                    svg += 'blue;';
                }
                svg += '"/>\n';
            }
        }
        svg += '</g>\n';
    }

    svg += pathSet.toSVG();
    svg += decorationSet.toSVG();

    // Convert any remaining characters
    if (!DEBUG_HIDE_PASSTHROUGH) {
        svg += '<g transform="translate(0,0)">';
        for (var _y6 = 0; _y6 < grid.height; ++_y6) {
            for (var _x6 = 0; _x6 < grid.width; ++_x6) {
                var c = grid(_x6, _y6);
                if (/[\u2B22\u2B21]/.test(c)) {
                    // Enlarge hexagons so that they fill a grid
                    svg += '<text text-anchor="middle" x="' + _x6 * SCALE + '" y="' + (4 + _y6 * SCALE * ASPECT) + '" style="font-size:20.5px">' + escapeHTMLEntities(c) + '</text>';
                } else if (c !== ' ' && !grid.isUsed(_x6, _y6)) {
                    svg += '<text text-anchor="middle" x="' + _x6 * SCALE + '" y="' + (4 + _y6 * SCALE * ASPECT) + '">' + escapeHTMLEntities(c) + '</text>';
                } // if
            } // y
        } // x
        svg += '</g>';
    }

    if (DEBUG_SHOW_SOURCE) {
        // Offset the characters a little for easier viewing
        svg += '<g transform="translate(2, 2)">\n';
        for (var _x7 = 0; _x7 < grid.width; ++_x7) {
            for (var _y7 = 0; _y7 < grid.height; ++_y7) {
                var _c2 = grid(_x7, _y7);
                if (_c2 !== ' ') {
                    svg += '<text text-anchor="middle" x="' + _x7 * SCALE + '" y="' + (4 + _y7 * SCALE * ASPECT) + '" style="fill:#F00;font-family:Menlo,monospace;font-size:12px;text-align:center">' + escapeHTMLEntities(_c2) + '</text>';
                } // if
            } // y
        } // x
        svg += '</g>';
    } // if

    svg += '</g></svg>';

    svg = svg.rp(new RegExp(HIDE_O, 'g'), 'o');

    return svg;
}

var _module = function _module(_ref) {
    var _ = _ref._;
    var shelljs = _ref.shelljs;
    var bluebird = _ref.bluebird;

    if (_.any([_, bluebird, shelljs], _.isUndefined)) {
        return undefined;
    }

    var execAsync = function execAsync(cmd) {
        return new bluebird(function (resolve) {
            shelljs.exec(cmd, {
                async: true
            }, function (code, stdout) {
                resolve({
                    code: code,
                    stdout: stdout
                });
            });
        });
    };

    var dia2svg = function dia2svg(string) {
        return diagramToSVG(string, '');
    };

    var dia2html = function dia2html(string) {
        return htmlWrap(dia2svg(string));
    };

    return {
        readHelp: function readHelp() {
            return execAsync('cat ../docs/usage.md');
        },
        dia2svg: dia2svg,
        dia2html: dia2html
    };
};

module.exports = _module;