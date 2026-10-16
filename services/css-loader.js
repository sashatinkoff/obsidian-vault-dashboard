// services/css-loader.js — подключает все css/*.css (по имени файла) одним <style> в документ.
const { hash } = require("lib/misc");
module.exports = async function loadCss(storage, root) {
  const files = (await storage.listFiles("css")).filter((f) => f.endsWith(".css")).sort();
  const parts = [];
  for (const f of files) parts.push(`/* ${f.split("/").pop()} */\n` + (await storage.readText("css/" + f.split("/").pop())));
  const id = "sf-style-" + hash(root);
  let el = document.getElementById(id);
  if (!el) { el = document.createElement("style"); el.id = id; document.head.appendChild(el); }
  el.textContent = parts.join("\n\n");
  return files.length;
};
