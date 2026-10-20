// ESLint = the "code checker". Run `npm run lint` before every pull request.
// Most rules here come straight from Lab 2 and Lab 4 (code smells + good function design).
const js = require('@eslint/js');
const globals = require('globals');
const prettier = require('eslint-config-prettier');

// The layer rule from Milestone 1, enforced automatically:
// a layer may only require() the layer directly BELOW it.
// (ESLint's built-in import rule only checks `import`, so this small custom rule checks `require`.)
const layersPlugin = {
  rules: {
    'no-forbidden-layer': {
      meta: { type: 'problem', schema: [{ type: 'object' }] },
      create(context) {
        const { forbidden, message } = context.options[0];
        const isForbidden = (path) =>
          forbidden.some((layer) => new RegExp(`(^|/)${layer}(/|$)`).test(path));
        return {
          CallExpression(node) {
            const [argument] = node.arguments;
            const isRequire = node.callee.name === 'require' && argument?.type === 'Literal';
            if (isRequire && isForbidden(String(argument.value))) {
              context.report({ node, message });
            }
          },
        };
      },
    },
  },
};

const layerRule = (forbidden, message) => ({
  'layers/no-forbidden-layer': ['error', { forbidden, message }],
});

module.exports = [
  { ignores: ['node_modules/', 'coverage/', 'data/'] },
  js.configs.recommended,
  { plugins: { layers: layersPlugin } },

  // Rules for ALL our code
  {
    files: ['**/*.js'],
    languageOptions: { ecmaVersion: 2023, sourceType: 'commonjs', globals: globals.node },
    rules: {
      eqeqeq: 'error', // always === , never ==
      'no-var': 'error', // use const / let
      'prefer-const': 'error', // const unless you really reassign
      'no-else-return': 'error', // Lab 2: "unnecessary else"
      'max-depth': ['warn', 3], // Lab 2: arrow anti-pattern -> use return early
      'max-params': ['warn', 3], // Lab 2: too many arguments -> pass an object
      'no-magic-numbers': [
        'warn',
        { ignore: [-1, 0, 1], ignoreArrayIndexes: true, ignoreDefaultValues: true },
      ], // Lab 4: avoid magic numbers -> name them in src/config.js or a constant
      complexity: ['warn', 10], // keep functions small (one responsibility)
      'no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    },
  },

  // Layer boundaries (the most important rule in this project)
  {
    files: ['src/presentation/**/*.js'],
    rules: layerRule(
      ['data-access'],
      'Presentation must not touch the data layer. Call a service in src/business instead.',
    ),
  },
  {
    files: ['src/business/**/*.js'],
    rules: layerRule(
      ['presentation'],
      'Business logic must not know about HTTP/UI. Return data or throw an AppError instead.',
    ),
  },
  {
    files: ['src/data-access/**/*.js'],
    rules: layerRule(
      ['presentation', 'business'],
      'The data layer only stores and loads data. No business rules, no HTTP.',
    ),
  },
  {
    files: ['src/domain/**/*.js'],
    rules: layerRule(
      ['presentation', 'business', 'data-access'],
      'Domain models are plain objects and must not depend on any layer.',
    ),
  },

  // Browser code (the frontend in /public)
  {
    files: ['public/**/*.js'],
    languageOptions: { sourceType: 'script', globals: globals.browser },
  },

  // Tests: Jest globals, numbers are fine here
  {
    files: ['tests/**/*.js'],
    languageOptions: { globals: { ...globals.node, ...globals.jest } },
    rules: { 'no-magic-numbers': 'off' },
  },

  // Config files at the root are not app code
  { files: ['*.config.js'], rules: { 'no-magic-numbers': 'off' } },

  prettier, // must stay last: turns off rules that fight with Prettier formatting
];
