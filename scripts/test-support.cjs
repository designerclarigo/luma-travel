const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
// Load pure production TS modules, including their real dependencies, without Metro/native mocks.
exports.load = function load(filename, cache = new Map()) {
  const file = path.resolve(__dirname, '..', filename);
  if (cache.has(file)) return cache.get(file).exports;
  const module = { exports: {} }; cache.set(file, module);
  const localRequire = id => {
    if (id.startsWith('.') || id.startsWith('@/')) {
      const candidate = id.startsWith('@/') ? path.resolve(__dirname, '../src', id.slice(2)) : path.resolve(path.dirname(file), id);
      if (candidate.endsWith('.json')) return JSON.parse(fs.readFileSync(candidate, 'utf8'));
      return load(path.relative(path.resolve(__dirname, '..'), candidate + '.ts'), cache);
    }
    return require(id);
  };
  const source = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText;
  new Function('require', 'module', 'exports', source)(localRequire, module, module.exports);
  return module.exports;
};
