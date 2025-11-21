/**
 * Lightweight CSP lint: require nonce on inline <style> and next/<Script> usages.
 * Note: This is a heuristic to catch common cases; not a substitute for full CSP audits.
 */
module.exports = {
  root: true,
  extends: ['next/core-web-vitals'],
  settings: {
    next: {
      rootDir: ['apps/web'],
    },
  },
  rules: {
    // Ensure plugin is registered so inline disables resolve cleanly
    'react-hooks/exhaustive-deps': 'warn',
    '@next/next/no-html-link-for-pages': 'off',
    // Enforce nonce on inline <style>
    'no-restricted-syntax': [
      'error',
      {
        selector:
          "JSXOpeningElement[name.name='style']:not([attributes.0.name.name='nonce']):not([attributes.1.name.name='nonce']):not([attributes.2.name.name='nonce'])",
        message: 'Inline <style> must include nonce={nonce} from NonceContext when ENABLE_STRICT_CSP=true.',
      },
      {
        selector:
          "JSXOpeningElement[name.name='Script']:not([attributes.0.name.name='nonce']):not([attributes.1.name.name='nonce']):not([attributes.2.name.name='nonce'])",
        message: 'next/Script must include nonce={nonce} from NonceContext when ENABLE_STRICT_CSP=true.',
      },
    ],
  },
};
