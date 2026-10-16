// filters/formula.js — человекочитаемая формула из состояния фильтра: ( #a OR #b ) AND NOT ( #x ).
const { label } = require("filters/attrs");

function toTokens(f) {
  const groups = [];
  if (f.any.length) groups.push({ mode: "any", op: "OR", tags: f.any });
  if (f.all.length) groups.push({ mode: "all", op: "AND", tags: f.all });
  const out = [];
  const sep = () => { if (out.length) out.push({ t: "op", v: "AND" }); };
  for (const g of groups) {
    sep(); out.push({ t: "paren", v: "(" });
    g.tags.forEach((tag, i) => { if (i) out.push({ t: "op", v: g.op }); out.push({ t: "tag", v: "#" + tag, tag, mode: g.mode }); });
    out.push({ t: "paren", v: ")" });
  }
  if (f.not.length) {
    sep(); out.push({ t: "op", v: "NOT", neg: true }, { t: "paren", v: "(" });
    f.not.forEach((tag, i) => { if (i) out.push({ t: "op", v: "OR" }); out.push({ t: "tag", v: "!#" + tag, tag, mode: "not" }); });
    out.push({ t: "paren", v: ")" });
  }
  for (const a of f.attrs) { sep(); out.push({ t: "attr", v: label(a), attr: a }); }
  if (f.day) { sep(); out.push({ t: "day", v: "день: " + f.day }); }
  return out;
}
const toString = (f) => toTokens(f).map((t) => t.v).join(" ");
module.exports = { toTokens, toString };
