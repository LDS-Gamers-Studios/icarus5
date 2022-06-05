const fs = require("fs");
const homoglyphs = fs.readFileSync('data/homoglyphs.txt');

console.log(homoglyphs);