import firebaseRulesPlugin from '@firebase/eslint-plugin-security-rules';

export default [
  {
    ...firebaseRulesPlugin.configs['flat/recommended'],
    rules: {
      ...firebaseRulesPlugin.configs['flat/recommended'].rules,
      'firebase-rules/no-open-writes': 'warn',
      'firebase-rules/no-open-reads': 'warn',
    }
  }
];

